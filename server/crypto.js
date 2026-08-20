const crypto = require('node:crypto');

const RESOURCE = GetCurrentResourceName();
const SECRET_FILE = '.secret';

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 32;
const SALT_LEN = 16;
const IV_LEN = 12;

function loadSecret() {
    const convar = GetConvar('sd_phone_secret', '');
    if (convar && convar.trim() !== '') {
        return crypto.createHash('sha256').update(convar.trim(), 'utf8').digest();
    }

    const saved = LoadResourceFile(RESOURCE, SECRET_FILE);
    if (saved && /^[0-9a-f]{64}$/i.test(saved.trim())) {
        return Buffer.from(saved.trim(), 'hex');
    }

    const generated = crypto.randomBytes(32);
    SaveResourceFile(RESOURCE, SECRET_FILE, generated.toString('hex'), -1);
    console.log(
        '^3[sd-phone:crypto]^0 no `sd_phone_secret` convar set, so a server secret was generated ' +
        `into ${RESOURCE}/${SECRET_FILE}. Back this file up: losing it makes saved Passwords ` +
        'unreadable and forces every account through a password reset.'
    );
    return generated;
}

const SECRET = loadSecret();
const PEPPER = crypto.createHmac('sha256', SECRET).update('pepper').digest();
const VAULT_KEY = crypto.createHmac('sha256', SECRET).update('vault').digest();

function peppered(plain) {
    return Buffer.concat([Buffer.from(String(plain), 'utf8'), PEPPER]);
}

function hashPassword(plain) {
    const salt = crypto.randomBytes(SALT_LEN);
    const dk = crypto.scryptSync(peppered(plain), salt, KEY_LEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
    return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('base64')}$${dk.toString('base64')}`;
}

function verifyPassword(plain, stored) {
    if (typeof stored !== 'string') return false;
    const parts = stored.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
    try {
        const want = Buffer.from(parts[5], 'base64');
        const dk = crypto.scryptSync(peppered(plain), Buffer.from(parts[4], 'base64'), want.length, {
            N: Number(parts[1]), r: Number(parts[2]), p: Number(parts[3]),
        });
        return dk.length === want.length && crypto.timingSafeEqual(dk, want);
    } catch (err) {
        return false;
    }
}

function encrypt(plain) {
    if (typeof plain !== 'string' || plain === '') return plain;
    const iv = crypto.randomBytes(IV_LEN);
    const cipher = crypto.createCipheriv('aes-256-gcm', VAULT_KEY, iv);
    const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return `v1$${iv.toString('base64')}$${cipher.getAuthTag().toString('base64')}$${body.toString('base64')}`;
}

function decrypt(blob) {
    if (typeof blob !== 'string') return null;
    const parts = blob.split('$');
    if (parts.length !== 4 || parts[0] !== 'v1') return null;
    try {
        const decipher = crypto.createDecipheriv('aes-256-gcm', VAULT_KEY, Buffer.from(parts[1], 'base64'));
        decipher.setAuthTag(Buffer.from(parts[2], 'base64'));
        return Buffer.concat([decipher.update(Buffer.from(parts[3], 'base64')), decipher.final()]).toString('utf8');
    } catch (err) {
        return null;
    }
}

// FiveM's JS runtime injects `exports` as the registration function; plain CommonJS binds it to
// the module's exports object instead. Resolving both keeps the file loadable off-server.
const registerExport = typeof exports === 'function' ? exports : global.exports;

registerExport('sdCryptoReady', () => true);
registerExport('sdCryptoHashPassword', hashPassword);
registerExport('sdCryptoVerifyPassword', verifyPassword);
registerExport('sdCryptoEncrypt', encrypt);
registerExport('sdCryptoDecrypt', decrypt);
registerExport('sdCryptoSha256', (s) => crypto.createHash('sha256').update(String(s), 'utf8').digest('hex'));
registerExport('sdCryptoRandomHex', (n) => crypto.randomBytes(Math.min(64, Math.max(1, Number(n) || 32))).toString('hex'));
