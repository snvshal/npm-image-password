export type NormalizeMode = 'raw' | 'exif-stripped';

export function stripExif(bytes: Uint8Array): Uint8Array {
  if (isJPEG(bytes)) return stripExifFromJPEG(bytes);
  if (isPNG(bytes)) return stripExifFromPNG(bytes);
  return bytes;
}

function isJPEG(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8;
}

function isPNG(bytes: Uint8Array): boolean {
  if (bytes.length < 8) return false;
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) if (bytes[i] !== sig[i]) return false;
  return true;
}

// Remove APP1 EXIF segments from JPEG while preserving other segments and image data
function stripExifFromJPEG(bytes: Uint8Array): Uint8Array {
  let offset = 2; // skip SOI
  const out: number[] = [0xff, 0xd8];
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) break;
    const marker = bytes[offset + 1];
    // Start of Scan (SOS) - copy rest of file
    if (marker === 0xda) {
      out.push(0xff, 0xda);
      for (let i = offset + 2; i < bytes.length; i++) out.push(bytes[i]!);
      break;
    }
    // standalone markers without length
    if (marker === 0xd8 || marker === 0xd9) {
      out.push(0xff, marker);
      offset += 2;
      continue;
    }
    if (offset + 4 > bytes.length) break;
    const len = (bytes[offset + 2]! << 8) | bytes[offset + 3]!;
    if (len < 2 || offset + 2 + len > bytes.length) break;
    const segmentStart = offset;
    const segmentEnd = offset + 2 + len;
    // APP1 (EXIF)
    if (marker === 0xe1) {
      // skip copying APP1
    } else {
      for (let i = segmentStart; i < segmentEnd; i++) out.push(bytes[i]!);
    }
    offset = segmentEnd;
  }
  return new Uint8Array(out);
}

// Remove PNG eXIf chunks only. Other chunks preserved untouched.
function stripExifFromPNG(bytes: Uint8Array): Uint8Array {
  const out: number[] = [];
  // signature
  for (let i = 0; i < 8 && i < bytes.length; i++) out.push(bytes[i]!);
  let offset = 8;
  while (offset + 8 <= bytes.length) {
    const length = readUint32(bytes, offset);
    const typeStart = offset + 4;
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const crcEnd = dataEnd + 4;
    if (crcEnd > bytes.length) break;
    const type = String.fromCharCode(
      bytes[typeStart]!,
      bytes[typeStart + 1]!,
      bytes[typeStart + 2]!,
      bytes[typeStart + 3]!,
    );
    if (type !== 'eXIf') {
      // copy entire chunk (len + type + data + crc)
      for (let i = offset; i < crcEnd; i++) out.push(bytes[i]!);
    }
    offset = crcEnd;
    if (type === 'IEND') break;
  }
  return new Uint8Array(out);
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset]! << 24) |
      (bytes[offset + 1]! << 16) |
      (bytes[offset + 2]! << 8) |
      bytes[offset + 3]!) >>>
    0
  );
}





