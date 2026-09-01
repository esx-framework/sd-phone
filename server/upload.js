// Every .js in a resource shares one V8 scope, so this file keeps its own: a bare const here
// collides with the identically named one in crypto.js and the whole file fails to load.
(() => {

const https = require('node:https');

// FiveM's JS runtime injects `exports` as the registration function; plain CommonJS binds it to
// the module's exports object instead.
const registerExport = typeof exports === 'function' ? exports : global.exports;

const QBOX_HOST = 'api.qbox.re';
const QBOX_PATH = '/v1/file';

// The provider's own ceiling, rejected here so an oversized capture never leaves the box.
const MAX_BYTES = 100 * 1024 * 1024;

// Qbox error codes mapped onto the tokens the phone already translates. Anything absent collapses
// to 'provider'.
const CODE_BY_QBOX = {
    MISSING_API_KEY:      'no-key',
    INVALID_API_KEY:      'no-key',
    INVALID_KEY_METADATA: 'no-key',
    MISSING_FILE:         'bad-data',
    INVALID_FILENAME:     'bad-data',
    INVALID_PATH:         'bad-data',
};

let counter = 0;

/**
 * Splits a base64 data-URL into its media type and bytes. Bare base64 with no `data:` prefix is
 * accepted too.
 * @param {string} dataUrl
 * @returns {{ bytes: Buffer, mime: string } | null}
 */
function decode(dataUrl) {
    if (typeof dataUrl !== 'string' || dataUrl === '') return null;

    const match = /^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,(.*)$/s.exec(dataUrl);
    const mime = match?.[1] || 'application/octet-stream';
    const payload = match ? match[2] : dataUrl;

    try {
        const bytes = Buffer.from(payload, 'base64');
        return bytes.length > 0 ? { bytes, mime } : null;
    } catch {
        return null;
    }
}

/**
 * Strips the characters that would break out of a Content-Disposition header.
 * @param {string} name
 * @returns {string}
 */
function safeName(name) {
    const cleaned = String(name ?? '').replace(/[\r\n"\\]/g, '').trim();
    return cleaned === '' ? 'sdphone-upload' : cleaned.slice(0, 120);
}

/**
 * Builds the multipart/form-data body Qbox expects, as bytes.
 * @param {string} boundary
 * @param {Buffer} bytes file contents
 * @param {string} mime file media type
 * @param {string} filename
 * @returns {Buffer}
 */
function multipart(boundary, bytes, mime, filename) {
    const head = Buffer.from(
        `--${boundary}\r\n`
        + `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n`
        + `Content-Type: ${mime}\r\n\r\n`,
        'utf8',
    );

    const tail = Buffer.from(
        `\r\n--${boundary}\r\n`
        + `Content-Disposition: form-data; name="filename"\r\n\r\n${filename}\r\n`
        + `--${boundary}--\r\n`,
        'utf8',
    );

    return Buffer.concat([head, bytes, tail]);
}

/**
 * Hands an outcome back to the Lua caller waiting on this ticket.
 * @param {string} ticket
 * @param {string|null} url
 * @param {string|null} err
 * @param {string|null} code
 */
function announce(ticket, url, err, code) {
    const send = typeof emit === 'function' ? emit : TriggerEvent;
    send('sd-phone:server:upload:done', ticket, url, err, code);
}

/**
 * Uploads one media payload to the Qbox CDN and announces the outcome on
 * `sd-phone:server:upload:done`.
 * @param {string} ticket correlation id minted by the Lua caller
 * @param {string} key Qbox CDN API token
 * @param {string} dataUrl base64 data-URL or bare base64
 * @param {string} filename name stored alongside the upload
 */
function upload(ticket, key, dataUrl, filename) {
    if (typeof key !== 'string' || key === '') {
        return announce(ticket, null, 'No Qbox CDN key configured on this server', 'no-key');
    }

    const decoded = decode(dataUrl);
    if (!decoded) return announce(ticket, null, 'Empty or unreadable media payload', 'bad-data');

    if (decoded.bytes.length > MAX_BYTES) {
        return announce(ticket, null, 'That file is larger than the Qbox CDN 100 MB limit', 'bad-data');
    }

    counter += 1;
    const boundary = `sdphone${Date.now().toString(16)}${counter.toString(16)}`;
    const body = multipart(boundary, decoded.bytes, decoded.mime, safeName(filename));

    const req = https.request({
        host:    QBOX_HOST,
        path:    QBOX_PATH,
        method:  'POST',
        headers: {
            'Authorization':  `Bearer ${key}`,
            'Accept':         'application/json',
            'Content-Type':   `multipart/form-data; boundary=${boundary}`,
            'Content-Length': body.length,
        },
    }, (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
            const text = Buffer.concat(chunks).toString('utf8');
            let parsed = null;
            try { parsed = JSON.parse(text); } catch { parsed = null; }

            if (res.statusCode < 200 || res.statusCode > 299) {
                const code = CODE_BY_QBOX[parsed?.code] ?? 'provider';
                const why = parsed?.error || `HTTP ${res.statusCode}`;
                console.log(`^1[sd-phone:upload]^0 Qbox CDN rejected the upload: ${res.statusCode} ${text}`);
                return announce(ticket, null, `Qbox CDN upload failed: ${why}`, code);
            }

            const url = parsed?.data?.url;
            if (typeof url !== 'string' || url === '') {
                console.log(`^1[sd-phone:upload]^0 Qbox CDN returned no URL: ${text}`);
                return announce(ticket, null, 'Qbox CDN returned no URL', 'provider');
            }

            return announce(ticket, url, null, null);
        });
    });

    req.on('error', (err) => {
        console.log(`^1[sd-phone:upload]^0 Qbox CDN upload failed: ${err?.message ?? err}`);
        announce(ticket, null, 'Could not reach the Qbox CDN', 'provider');
    });

    req.end(body);
}

registerExport('sdUploadReady', () => {
    try {
        return typeof Buffer === 'function' && typeof require('node:https').request === 'function';
    } catch {
        return false;
    }
});

registerExport('sdUploadQbox', (ticket, key, dataUrl, filename) => {
    upload(String(ticket), key, dataUrl, filename);
    return true;
});

})();
