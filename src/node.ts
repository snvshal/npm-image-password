import { createHash, scrypt as nodeScrypt } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { Buffer } from 'node:buffer';
import { bufferToHex } from './index';

export async function hashStream(
  path: string,
  algorithm: 'sha256' | 'sha384' | 'sha512' = 'sha256',
) {
  const hash = createHash(algorithm);
  await new Promise<void>((resolve, reject) => {
    createReadStream(path)
      .on('error', reject)
      .on('data', (chunk) => hash.update(chunk))
      .on('end', () => resolve());
  });
  return bufferToHex(Uint8Array.from(hash.digest()));
}

export async function scryptDerive(
  passwordBytes: Uint8Array,
  saltBytes: Uint8Array,
  keyLength: number,
  N: number = 16384,
  r: number = 8,
  p: number = 1,
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    nodeScrypt(
      Buffer.from(passwordBytes),
      Buffer.from(saltBytes),
      keyLength,
      { N, r, p },
      (err, derivedKey) => {
        if (err) return reject(err);
        resolve(new Uint8Array(derivedKey));
      },
    );
  });
}





