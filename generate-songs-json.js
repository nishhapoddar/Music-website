const fs = require('fs');
const path = require('path');

const songDir = path.join(__dirname, 'song');
const outputFile = path.join(__dirname, 'songs.json');

function readSyncSafeInteger(buffer, offset) {
  return (
    (buffer[offset] << 21) |
    (buffer[offset + 1] << 14) |
    (buffer[offset + 2] << 7) |
    buffer[offset + 3]
  );
}

function hashString(input) {
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function createCoverArt(title, seed) {
  const baseHash = hashString(`${title}-${seed}`);
  const hue = baseHash % 360;
  const hue2 = (hue + 45) % 360;
  const label = title.slice(0, 2).toUpperCase();
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" role="img" aria-label="${title}">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="hsl(${hue}, 78%, 52%)" />
          <stop offset="100%" stop-color="hsl(${hue2}, 72%, 34%)" />
        </linearGradient>
      </defs>
      <rect width="400" height="400" rx="40" fill="url(#g)" />
      <circle cx="320" cy="84" r="70" fill="rgba(255,255,255,0.12)" />
      <circle cx="88" cy="320" r="84" fill="rgba(0,0,0,0.16)" />
      <text x="200" y="225" text-anchor="middle" dominant-baseline="middle" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="120" font-weight="700">${label}</text>
    </svg>
  `.trim();

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function findTerminator(buffer, start, encoding) {
  if (encoding === 1 || encoding === 2) {
    for (let index = start; index < buffer.length - 1; index += 1) {
      if (buffer[index] === 0x00 && buffer[index + 1] === 0x00) {
        return index;
      }
    }

    return -1;
  }

  return buffer.indexOf(0x00, start);
}

function decodeUtf16Buffer(buffer, hasBom) {
  if (!buffer.length) {
    return '';
  }

  let workingBuffer = buffer;

  if (hasBom && buffer.length >= 2) {
    const bom = buffer.readUInt16BE(0);

    if (bom === 0xfeff) {
      workingBuffer = buffer.slice(2);
    } else if (bom === 0xfffe) {
      const swapped = Buffer.alloc(buffer.length - 2);

      for (let index = 2; index < buffer.length; index += 2) {
        swapped[index - 2] = buffer[index + 1];
        swapped[index - 1] = buffer[index];
      }

      return swapped.toString('utf16le').replace(/^\uFEFF/, '').trim();
    }
  }

  return workingBuffer.toString('utf16le').replace(/^\uFEFF/, '').trim();
}

function decodeId3Text(buffer) {
  if (!buffer.length) {
    return '';
  }

  const encoding = buffer[0];
  const valueBuffer = buffer.slice(1);

  if (encoding === 0) {
    return valueBuffer.toString('latin1').replace(/\u0000+$/, '').trim();
  }

  if (encoding === 3) {
    return valueBuffer.toString('utf8').replace(/\u0000+$/, '').trim();
  }

  if (encoding === 1) {
    return decodeUtf16Buffer(valueBuffer, true);
  }

  if (encoding === 2) {
    const swapped = Buffer.alloc(valueBuffer.length);

    for (let index = 0; index < valueBuffer.length - 1; index += 2) {
      swapped[index] = valueBuffer[index + 1];
      swapped[index + 1] = valueBuffer[index];
    }

    return swapped.toString('utf16le').replace(/^\uFEFF/, '').trim();
  }

  return valueBuffer.toString('utf8').replace(/\u0000+$/, '').trim();
}

function extractId3TextFrame(filePath, frameName) {
  const buffer = fs.readFileSync(filePath);

  if (buffer.length < 10 || buffer.toString('ascii', 0, 3) !== 'ID3') {
    return '';
  }

  const version = buffer[3];
  const tagSize = readSyncSafeInteger(buffer, 6);
  const tagEnd = Math.min(buffer.length, 10 + tagSize);
  let offset = 10;

  while (offset + 10 <= tagEnd) {
    const frameId = buffer.toString('ascii', offset, offset + 4);

    if (/^\u0000{4}$/.test(frameId)) {
      break;
    }

    let frameSize;

    if (version === 4) {
      frameSize = readSyncSafeInteger(buffer, offset + 4);
    } else {
      frameSize = buffer.readUInt32BE(offset + 4);
    }

    if (!frameSize) {
      break;
    }

    const frameDataStart = offset + 10;
    const frameDataEnd = frameDataStart + frameSize;

    if (frameDataEnd > tagEnd) {
      break;
    }

    if (frameId === frameName) {
      return decodeId3Text(buffer.slice(frameDataStart, frameDataEnd));
    }

    offset = frameDataEnd;
  }

  return '';
}

function extractEmbeddedCover(filePath) {
  const buffer = fs.readFileSync(filePath);

  if (buffer.length < 10 || buffer.toString('ascii', 0, 3) !== 'ID3') {
    return null;
  }

  const version = buffer[3];
  const tagSize = readSyncSafeInteger(buffer, 6);
  const tagEnd = Math.min(buffer.length, 10 + tagSize);
  let offset = 10;

  while (offset + 10 <= tagEnd) {
    const frameId = buffer.toString('ascii', offset, offset + 4);

    if (/^\u0000{4}$/.test(frameId)) {
      break;
    }

    let frameSize;

    if (version === 4) {
      frameSize = readSyncSafeInteger(buffer, offset + 4);
    } else {
      frameSize = buffer.readUInt32BE(offset + 4);
    }

    if (!frameSize) {
      break;
    }

    const frameDataStart = offset + 10;
    const frameDataEnd = frameDataStart + frameSize;

    if (frameDataEnd > tagEnd) {
      break;
    }

    if (frameId === 'APIC') {
      const frameData = buffer.slice(frameDataStart, frameDataEnd);
      const encoding = frameData[0];
      let cursor = 1;

      const mimeEnd = frameData.indexOf(0x00, cursor);
      if (mimeEnd === -1) {
        return null;
      }

      const mimeType = frameData.toString('ascii', cursor, mimeEnd) || 'image/jpeg';
      cursor = mimeEnd + 1;

      cursor += 1;

      const descriptionEnd = findTerminator(frameData, cursor, encoding);
      if (descriptionEnd === -1) {
        return null;
      }

      const imageStart = encoding === 1 || encoding === 2 ? descriptionEnd + 2 : descriptionEnd + 1;
      const imageBuffer = frameData.slice(imageStart);

      if (!imageBuffer.length) {
        return null;
      }

      return `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
    }

    offset = frameDataEnd;
  }

  return null;
}

const songs = fs
  .readdirSync(songDir)
  .filter((file) => file.toLowerCase().endsWith('.mp3'))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  .map((file, index) => {
    const fullPath = path.join(songDir, file);
    const rawTitle = extractId3TextFrame(fullPath, 'TIT2');
    const title = rawTitle || path.parse(file).name;
    const cover = extractEmbeddedCover(fullPath) || createCoverArt(title, index + 1);

    return {
      id: index + 1,
      title,
      file: `song/${file}`,
      cover,
    };
  });

fs.writeFileSync(outputFile, JSON.stringify(songs, null, 2));

console.log(`Wrote ${songs.length} songs to ${path.basename(outputFile)}`);