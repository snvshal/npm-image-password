import { describe, it, expect } from 'vitest';
import { scryptDerive } from '../src/node';

describe('node utilities', () => {
  it('derives with scrypt', async () => {
    const key = await scryptDerive(
      new TextEncoder().encode('pw'),
      new TextEncoder().encode('salt'),
      32,
      1024,
      8,
      1,
    );
    expect(key.byteLength).toBe(32);
  });
});





