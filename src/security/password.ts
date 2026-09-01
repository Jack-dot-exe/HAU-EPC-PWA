const DEFAULT_ITERATIONS = 120_000;
const KEYLEN_BITS = 256;
const DIGEST = "SHA-256";

function bufToBase64(buf: ArrayBuffer | ArrayBufferLike): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function base64ToBuf(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function randomSalt(bytes = 16): Uint8Array {
  const salt = new Uint8Array(bytes);
  crypto.getRandomValues(salt);
  return salt;
}

async function importPasswordKey(password: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
}

export async function hashPassword(password: string, iterations = DEFAULT_ITERATIONS) {
  const salt = randomSalt(16);
  const key = await importPasswordKey(password);

  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: DIGEST },
    key,
    KEYLEN_BITS
  );

  return {
    saltB64: bufToBase64(salt.buffer),
    hashB64: bufToBase64(bits),
    iterations,
  };
}

export async function verifyPassword(
  password: string,
  saltB64: string,
  expectedHashB64: string,
  iterations: number
) {
  const salt = new Uint8Array(base64ToBuf(saltB64));
  const key = await importPasswordKey(password);

  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: DIGEST },
    key,
    KEYLEN_BITS
  );

  const hashB64 = bufToBase64(bits);
  return hashB64 === expectedHashB64;
}
