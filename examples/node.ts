import { readFile } from 'node:fs/promises';
import { hashImage, deriveKeyFromImage, bufferToHex } from '../src/index';

async function main() {
  const img = await readFile(__filename); // just some bytes as a stand-in
  const hex = await hashImage(img);
  const key = await deriveKeyFromImage(img, { salt: 'demo', iterations: 100_000, length: 32 });
  console.log('hash(hex):', hex);
  console.log('key(hex):', bufferToHex(key));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
