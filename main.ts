import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { statSync, readFileSync, createReadStream, createWriteStream, mkdirSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { createHash } from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const sourcePath = join(__dirname, 'entry.png');

const stats = statSync(sourcePath);
if (stats.size > 1048576) {
  throw new Error(`File size ${stats.size} bytes exceeds maximum allowed 1048576 bytes`);
}

function validateAndGetDimensions(buf: Buffer): { width: number; height: number } {
  if (buf.length >= 8 &&
      buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
      buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a) {
    if (buf.length < 24) {
      throw new Error('PNG file too small to contain IHDR dimensions');
    }
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    if (width > 1024 || height > 1024) {
      throw new Error(`PNG dimensions ${width}x${height} exceed maximum allowed 1024x1024`);
    }
    return { width, height };
  }

  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    let offset = 2;
    while (offset < buf.length) {
      if (buf[offset] !== 0xff) {
        throw new Error(`Invalid JPEG marker at offset ${offset}`);
      }
      const marker = buf[offset + 1];
      if (marker === 0xd9 || marker === 0xda) {
        break;
      }
      if (marker >= 0xd0 && marker <= 0xd7) {
        offset += 2;
        continue;
      }
      if (offset + 4 > buf.length) {
        break;
      }
      const length = buf.readUInt16BE(offset + 2);
      if ((marker >= 0xc0 && marker <= 0xcf) && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        if (offset + 9 > buf.length) {
          throw new Error('JPEG SOF segment truncated');
        }
        const height = buf.readUInt16BE(offset + 5);
        const width = buf.readUInt16BE(offset + 7);
        if (width > 1024 || height > 1024) {
          throw new Error(`JPEG dimensions ${width}x${height} exceed maximum allowed 1024x1024`);
        }
        return { width, height };
      }
      offset += 2 + length;
    }
    throw new Error('JPEG Start Of Frame (SOF) segment not found');
  }

  throw new Error('Invalid magic bytes: file is neither a valid PNG nor JPEG');
}

const fileBuf = readFileSync(sourcePath);
const dims = validateAndGetDimensions(fileBuf);

const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, 'entry.png');

const hashSource = createHash('sha256');
const readStream = createReadStream(sourcePath, { highWaterMark: 64 * 1024 });
const writeStream = createWriteStream(outPath);

readStream.on('data', (chunk) => {
  hashSource.update(chunk);
});

await pipeline(readStream, writeStream);
const sourceHash = hashSource.digest('hex');

const writtenBuf = readFileSync(outPath);
const hashWritten = createHash('sha256').update(writtenBuf).digest('hex');

if (sourceHash !== hashWritten) {
  throw new Error(`Hash mismatch: source SHA-256 (${sourceHash}) does not match written file SHA-256 (${hashWritten})`);
}

console.log(`${stats.size} bytes, dims:${dims.width}x${dims.height}, sha256:${sourceHash.slice(0, 16)}`);
