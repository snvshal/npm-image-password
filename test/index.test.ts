import { describe, it, expect } from 'vitest';
import { hashImage, deriveKeyFromImage, bufferToHex, verifyHash, hexToBytes } from '../src/index';

describe('image-password', () => {
  const sample = new TextEncoder().encode('hello-image');

  it('hashes bytes deterministically', async () => {
    const h1 = await hashImage(sample);
    const h2 = await hashImage(sample);
    expect(h1).toBe(h2);
    expect(h1.length).toBe(64);
  });

  it('derives key with PBKDF2', async () => {
    const key = await deriveKeyFromImage(sample, { salt: 'salt', iterations: 10_000, length: 16 });
    expect(key.byteLength).toBe(16);
  });

  it('verifyHash uses timing safe compare', async () => {
    const h = await hashImage(sample);
    const ok = verifyHash(h, h);
    expect(ok).toBe(true);
    const bad = verifyHash(h, h.slice(0, -2) + '00');
    expect(bad).toBe(false);
  });

  it('hexToBytes parses hex', () => {
    const b = hexToBytes('00ff');
    expect(Array.from(b)).toEqual([0, 255]);
  });
});





