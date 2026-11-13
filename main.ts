import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { createHash } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const sourcePath = join(__dirname, 'entry.png');

const buf = readFileSync(sourcePath);
const size = buf.length;
if (size > 1048576) {
  console.error(`Error: File size ${size} exceeds 1MB (1048576 bytes)`);
  process.exit(1);
}

let format: string;
let width = 0;
let height = 0;

// Detect format by magic bytes
const isPng =
  size >= 8 &&
  buf[0] === 0x89 &&
  buf[1] === 0x50 &&
  buf[2] === 0x4e &&
  buf[3] === 0x47 &&
  buf[4] === 0x0d &&
  buf[5] === 0x0a &&
  buf[6] === 0x1a &&
  buf[7] === 0x0a;

const isJpeg = size >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;

if (isPng) {
  format = 'PNG';
  if (size < 33) {
    console.error('Error: PNG file too small for IHDR');
    process.exit(1);
  }
  width = buf.readUInt32BE(16);
  height = buf.readUInt32BE(20);

  // Verify PNG integrity: must end with IEND chunk
  const iendType = buf.subarray(buf.length - 12, buf.length - 8).toString('ascii');
  if (iendType !== 'IEND') {
    console.error('Error: PNG missing valid IEND chunk at end');
    process.exit(1);
  }
} else if (isJpeg) {
  format = 'JPEG';
  let offset = 2;
  let foundSof = false;
  while (offset < buf.length) {
    if (buf[offset] !== 0xff) {
      console.error(`Error: Expected JPEG marker at offset ${offset}`);
      process.exit(1);
    }
    const marker = buf[offset + 1];
    if (marker === 0xd9 || marker === 0xda) {
      break;
    }
    if (marker >= 0xd0 && marker <= 0xd7) {
      offset += 2;
      continue;
    }
    if (offset + 4 > buf.length) break;
    const length = buf.readUInt16BE(offset + 2);
    if ((marker >= 0xc0 && marker <= 0xcf) && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      height = buf.readUInt16BE(offset + 5);
      width = buf.readUInt16BE(offset + 7);
      foundSof = true;
      break;
    }
    offset += 2 + length;
  }
  if (!foundSof) {
    console.error('Error: JPEG SOF marker not found');
    process.exit(1);
  }

  // Verify JPEG integrity: must end with FF D9
  if (buf[buf.length - 2] !== 0xff || buf[buf.length - 1] !== 0xd9) {
    console.error('Error: JPEG does not end with FF D9');
    process.exit(1);
  }
} else {
  console.error('Error: Unknown image format (magic bytes mismatch)');
  process.exit(1);
}

if (width > 1024 || height > 1024) {
  console.error(`Error: Dimensions ${width}x${height} exceed 1024x1024 limit`);
  process.exit(1);
}

const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, 'entry.png');
writeFileSync(outPath, buf);

const writtenBuf = readFileSync(outPath);
if (writtenBuf.length !== size) {
  console.error(`Error: Written file size ${writtenBuf.length} does not match expected size ${size}`);
  process.exit(1);
}
if (isPng && (writtenBuf[0] !== 0x89 || writtenBuf[1] !== 0x50)) {
  console.error('Error: Re-checked output file magic bytes failed for PNG');
  process.exit(1);
}
if (isJpeg && (writtenBuf[0] !== 0xff || writtenBuf[1] !== 0xd8)) {
  console.error('Error: Re-checked output file magic bytes failed for JPEG');
  process.exit(1);
}
if (Buffer.compare(buf, writtenBuf) !== 0) {
  console.error('Error: Written file does not match source file');
  process.exit(1);
}

const md5 = createHash('md5').update(buf).digest('hex');
console.log(`${format} ${width}x${height} ${size} bytes md5:${md5}`);
