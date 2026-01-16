## image-password

Use images as passwords. This library normalizes image bytes from many inputs (Buffer, ArrayBuffer, Blob/File, URL, data URL), hashes them (SHA-256/384/512), and can derive stable keys with PBKDF2 across Node and browsers. Now includes EXIF stripping, input size limits, and timing-safe verification.

### Install

```bash
npm i image-password
```

Node 18+ recommended. In Node, remote URL fetching uses `undici`.

### API

```ts
import { hashImage, deriveKeyFromImage, bufferToHex, toBase64 } from 'image-password';

// Hash an image input → hex string
const hex = await hashImage(input, { algorithm: 'SHA-256', normalize: 'raw' });

// Derive a key from image bytes using PBKDF2 → Uint8Array
const key = await deriveKeyFromImage(input, {
  algorithm: 'SHA-256',
  iterations: 200_000,
  length: 32,
  salt: 'image-password',
  maxBytes: 10 * 1024 * 1024, // 10MB limit
});
```

### Inputs Supported

- Buffer, ArrayBuffer, Uint8Array
- Blob, File (browser)
- string/URL: remote URL or `data:` URL

### Options and Security Notes

- `normalize: 'exif-stripped'` removes JPEG APP1 EXIF and PNG eXIf chunks.
- `maxBytes` rejects inputs larger than the given number of bytes (after fetch). Consider setting per your risk appetite.
- PBKDF2 defaults: 200k iterations, SHA-256, 32 bytes. Tune for your performance and security goals.
- Use per-user salt (e.g., user ID) and store only the derived key or hash.
- Use `verifyHash(a, b)` for timing-safe equality of hex digests.

### Examples

```ts
// From a file input (browser)
const file = inputEl.files![0];
const loginKey = await deriveKeyFromImage(file, { salt: userId, iterations: 200_000 });

// From a URL
const pwHex = await hashImage('https://example.com/photo.jpg');

// As a data URL
const pwHex2 = await hashImage('data:image/png;base64,iVBORw0KGgo...');

// Timing-safe verify
const ok = verifyHash(pwHex, pwHex2);
```

### Why not pixels?

This library intentionally hashes the original bytes, not decoded pixel buffers, to avoid encoding ambiguities. If you require pixel-based normalization (e.g., resize, format conversion), do that step yourself first and pass the resulting bytes here.

### License

MIT
