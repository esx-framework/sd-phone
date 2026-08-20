// SDMR/1 wire constants. Clause numbers refer to the sd-phone Media Relay Protocol Specification.

export const PROTOCOL_NAME = 'SDMR';
export const WIRE_VERSION = 1;
export const SUBPROTOCOL = 'sdphone-media-v1';

// Clause 2: binary media frame layout.
export const SDMR_HEADER_BYTES = 24;
export const MAGIC = 0xa7;
export const VERSION = 0x01;

export const KIND = { INIT: 0x01, KEY: 0x02, DELTA: 0x03, JPEG: 0x04 };
export const KIND_NAME = { 1: 'INIT', 2: 'KEY', 3: 'DELTA', 4: 'JPEG' };

export const FLAG = { REPLAY: 0x01, DISCONTINUITY: 0x02, LAST: 0x04 };
export const FLAG_MASK = FLAG.REPLAY | FLAG.DISCONTINUITY | FLAG.LAST;

// Clause 13: constant reference.
export const MAX_MESSAGE_BYTES = 1_048_576;
export const MAX_CONTROL_BYTES = 8_192;
export const MAX_TOKEN_CHARS = 1_024;
export const MAX_STREAMS_PER_SOCKET = 12;
export const MAX_STREAMS_GLOBAL = 256;

export const HELLO_TIMEOUT_MS = 5_000;
export const RELAY_PING_MS = 15_000;
export const SOCKET_IDLE_MS = 30_000;

export const CLOCK_SKEW_S = 5;
export const TOKEN_TTL_S_MAX = 120;
export const JTI_SWEEP_MS = 10_000;
export const JTI_MAX = 100_000;
export const AUTH_FAIL_MAX = 20;
export const AUTH_FAIL_WINDOW_MS = 60_000;
export const AUTH_BAN_MS = 300_000;

export const PRIME_MAX_GOPS = 2;
export const PRIME_MAX_FRAMES = 120;
export const PRIME_MAX_BYTES = 2_097_152;
export const PRIME_MAX_AGE_MS = 30_000;
export const LINGER_MS = 10_000;

export const SOFT_LIMIT = 1_048_576;
export const HARD_LIMIT = 4_194_304;
export const CONTROL_HEADROOM = 1_048_576;
export const SLOW_VIEWER_MS = 5_000;
export const INGEST_WINDOW_MS = 1_000;
export const INGEST_MAX_BYTES_CEIL = 4_194_304;
export const INGEST_OVER_WINDOWS_MAX = 3;
export const INGEST_ERROR_MS = 2_000;

export const KEYFRAME_REQUEST_MS = 1_000;
export const VIEWERS_COALESCE_MS = 500;
export const DROP_REPORT_MS = 2_000;

export const CONTROL_SKEW_MS = 30_000;

// Clause 4.19: close codes.
export const CLOSE = {
    NORMAL: 1000,
    GOING_AWAY: 1001,
    PROTOCOL: 4400,
    AUTH: 4401,
    SCOPE: 4403,
    TIMEOUT: 4408,
    DUPLICATE: 4409,
    TOO_LARGE: 4413,
    RATE_LIMITED: 4429,
    INTERNAL: 4500,
};

// Clause 5.1: stream key grammar.
export const STREAM_KEY_RE = /^(mdt|photogram|vibez):(cam|live):[A-Za-z0-9_-]{1,64}$/;

export const MODES = new Set(['video', 'image']);
export const WIRES = new Set(['chunks', 'mse']);
