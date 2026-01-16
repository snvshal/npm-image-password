import { fetch as undiciFetch } from 'undici';
import { stripExif } from './normalize';
import { InputTooLargeError, FetchFailedError, UnsupportedInputError } from './errors';
import { timingSafeEqual } from './timing';

export type ImageInput = ArrayBuffer | Uint8Array | Buffer | Blob | File | string | URL;

type DigestAlgorithm = 'SHA-256' | 'SHA-384' | 'SHA-512';

export interface HashOptions {
  algorithm?: DigestAlgorithm;
  normalize?: 'raw' | 'exif-stripped';
  maxBytes?: number; // reject if input larger than this (post-fetch)
}

export interface DeriveKeyOptions extends HashOptions {
  salt?: Uint8Array | string;
  iterations?: number; // PBKDF2 iterations
  length?: number; // desired key length in bytes
}

const isNode = typeof process !== 'undefined' && !!(process as any).versions?.node;

async function getBytes(input: ImageInput): Promise<Uint8Array> {
  if (input instanceof Uint8Array) return input;
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(input))
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (typeof Blob !== 'undefined' && input instanceof Blob) {
    const buf = new Uint8Array(await input.arrayBuffer());
    return buf;
  }
  if (typeof File !== 'undefined' && input instanceof File) {
    const buf = new Uint8Array(await input.arrayBuffer());
    return buf;
  }
  if (typeof input === 'string' || input instanceof URL) {
    const url = input.toString();
    // Data URL fast-path
    if (url.startsWith('data:')) {
      const base64 = url.substring(url.indexOf(',') + 1);
      const bin =
        typeof atob === 'function'
          ? atob(base64)
          : Buffer.from(base64, 'base64').toString('binary');
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }
    const resp = await (typeof fetch === 'function' ? fetch(url) : undiciFetch(url));
    if (!resp.ok) throw new FetchFailedError(resp.status, resp.statusText);
    const ab = await resp.arrayBuffer();
    return new Uint8Array(ab);
  }
  throw new UnsupportedInputError();
}

async function subtleDigest(algorithm: DigestAlgorithm, data: Uint8Array): Promise<ArrayBuffer> {
  // Prefer Web Crypto subtle when available
  const cryptoObj: Crypto | undefined = (globalThis as any).crypto;
  if (cryptoObj && 'subtle' in cryptoObj && cryptoObj.subtle) {
    const ab = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
    const copy = new Uint8Array(ab.byteLength);
    copy.set(new Uint8Array(ab));
    return cryptoObj.subtle.digest(algorithm, copy);
  }
  // Node fallback using node:crypto
  if (isNode) {
    const nodeCrypto = await import('node:crypto');
    const hash = nodeCrypto.createHash(algorithm.replace('-', '').toLowerCase());
    hash.update(Buffer.from(data));
    return Uint8Array.from(hash.digest()).buffer;
  }
  throw new Error('No crypto implementation available');
}

function maybeNormalize(bytes: Uint8Array, mode: HashOptions['normalize']): Uint8Array {
  if (mode === 'exif-stripped') return stripExif(bytes);
  return bytes;
}

export async function hashImage(input: ImageInput, options: HashOptions = {}): Promise<string> {
  const { algorithm = 'SHA-256', normalize = 'raw', maxBytes } = options;
  const raw = await getBytes(input);
  if (typeof maxBytes === 'number' && raw.byteLength > maxBytes) {
    throw new InputTooLargeError(raw.byteLength, maxBytes);
  }
  const bytes = maybeNormalize(raw, normalize);
  const digest = await subtleDigest(algorithm, bytes);
  return bufferToHex(new Uint8Array(digest));
}

export async function deriveKeyFromImage(
  input: ImageInput,
  options: DeriveKeyOptions = {},
): Promise<Uint8Array> {
  const algorithm: DigestAlgorithm = options.algorithm ?? 'SHA-256';
  const normalize: HashOptions['normalize'] = options.normalize ?? 'raw';
  const salt: Uint8Array | string = options.salt ?? 'image-password';
  const iterationsNum: number = options.iterations ?? 200_000;
  const lengthBytes: number = options.length ?? 32;

  const raw = await getBytes(input);
  if (typeof (options as any).maxBytes === 'number' && raw.byteLength > (options as any).maxBytes) {
    throw new InputTooLargeError(raw.byteLength, (options as any).maxBytes);
  }
  const bytes = maybeNormalize(raw, normalize);
  const saltBytes = typeof salt === 'string' ? new TextEncoder().encode(salt) : salt;

  const cryptoObj: Crypto | undefined = (globalThis as any).crypto;
  if (cryptoObj && 'subtle' in cryptoObj && cryptoObj.subtle) {
    const key = await cryptoObj.subtle.importKey(
      'raw',
      new Uint8Array(bytes),
      { name: 'PBKDF2' },
      false,
      ['deriveBits'],
    );
    const bits = await cryptoObj.subtle.deriveBits(
      {
        name: 'PBKDF2',
        hash: algorithm,
        salt: new Uint8Array(saltBytes),
        iterations: iterationsNum,
      },
      key,
      lengthBytes * 8,
    );
    return new Uint8Array(bits);
  }

  if (isNode === true) {
    const nodeCrypto = await import('node:crypto');
    return await new Promise<Uint8Array>((resolve, reject) => {
      nodeCrypto.pbkdf2(
        Buffer.from(bytes),
        Buffer.from(saltBytes),
        iterationsNum,
        lengthBytes,
        algorithm.replace('-', '').toLowerCase(),
        (err: NodeJS.ErrnoException | null, derivedKey: Buffer) => {
          if (err) return reject(err);
          resolve(new Uint8Array(derivedKey));
        },
      );
    });
  }

  throw new Error('No crypto implementation available');
}

export function bufferToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    const h = bytes[i]!.toString(16).padStart(2, '0');
    out += h;
  }
  return out;
}

export function toBase64(bytes: Uint8Array): string {
  if (typeof (globalThis as any).btoa === 'function') {
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
    return (globalThis as any).btoa(s);
  }
  return Buffer.from(bytes).toString('base64');
}

export async function verifyImageHash(
  input: ImageInput,
  expectedHex: string,
  options: HashOptions = {},
): Promise<boolean> {
  const actual = await hashImage(input, options);
  return verifyHash(expectedHex, actual);
}

export function verifyHash(expectedHex: string, actualHex: string): boolean {
  const a = hexToBytes(expectedHex);
  const b = hexToBytes(actualHex);
  return timingSafeEqual(a, b);
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim().toLowerCase();
  if (clean.length % 2 !== 0) throw new Error('Invalid hex length');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    out[i / 2] = parseInt(clean.slice(i, i + 2), 16);
  }
  return out;
}

export default {
  hashImage,
  deriveKeyFromImage,
  verifyImageHash,
  bufferToHex,
  toBase64,
  verifyHash,
  hexToBytes,
};

export * from './errors';
export * from './normalize';
export * from './timing';
export * from './node';
