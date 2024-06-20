const fs = require('fs');
const brotli = require('brotli');
const jpeg = require('jpeg-js');

// Function to convert YUV to RGB
function yuvToRgb(y, u, v) {
    u -= 128;
    v -= 128;
    const r = y + 1.13983 * v;
    const g = y - 0.39465 * u - 0.58060 * v;
    const b = y + 2.03211 * u;
    return [r, g, b].map(val => Math.max(0, Math.min(255, Math.round(val)))); // Clamp to [0, 255]
}

// Advanced delta decoding with larger context
function advancedDeltaDecode(buffer, width) {
    const decoded = Buffer.alloc(buffer.length);
    let prevRow = new Array(width).fill([0, 0, 0]);

    for (let i = 0; i < buffer.length; i += 3) {
        const row = Math.floor(i / (width * 3));
        const col = (i / 3) % width;

        const prev = row === 0 ? [0, 0, 0] : prevRow[col];

        decoded[i] = (buffer[i] + prev[0]) % 256;
        decoded[i + 1] = (buffer[i + 1] + prev[1]) % 256;
        decoded[i + 2] = (buffer[i + 2] + prev[2]) % 256;

        prevRow[col] = [decoded[i], decoded[i + 1], decoded[i + 2]];
    }
    return decoded;
}

function readAntFile(filename) {
    const buffer = fs.readFileSync(filename);
    const signature = buffer.slice(0, 4).toString('ascii');
    if (signature !== 'ANT\0') {
        throw new Error('Invalid file format');
    }

    const width = buffer.readUInt32BE(4);
    const height = buffer.readUInt32BE(8);
    const colorDepth = buffer.readUInt8(12);
    const compressedData = buffer.slice(13);

    console.log(`Reading file with width: ${width}, height: ${height}, colorDepth: ${colorDepth}`);

    let decompressedData;
    try {
        decompressedData = Buffer.from(brotli.decompress(compressedData));
        console.log(`Decompressed data size: ${decompressedData.length}`);
    } catch (error) {
        console.error('Error during Brotli decompression:', error);
        throw new Error('Failed to decompress pixel data');
    }

    const yuvData = advancedDeltaDecode(decompressedData, width);
    return { width, height, colorDepth, yuvData };
}

function createJpgFromAnt(antFilePath, jpgFilePath) {
    const { width, height, colorDepth, yuvData } = readAntFile(antFilePath);
    const rawData = Buffer.alloc(width * height * 4);

    // Convert YUV to RGB
    for (let i = 0, j = 0; i < rawData.length; i += 4, j += 3) {
        const [r, g, b] = yuvToRgb(yuvData[j], yuvData[j + 1], yuvData[j + 2]);
        rawData[i] = r;
        rawData[i + 1] = g;
        rawData[i + 2] = b;
        rawData[i + 3] = 255; // Alpha channel
    }

    const jpegImageData = jpeg.encode({ data: rawData, width, height }, 90); // 90 is the quality of the output JPEG

    fs.writeFileSync(jpgFilePath, jpegImageData.data);
    console.log(`Decoded ${antFilePath} to ${jpgFilePath}`);
}

// Example usage
const antFilePath = 'output_optimized.ant';
const jpgFilePath = 'decoded_optimized_output.jpg';
createJpgFromAnt(antFilePath, jpgFilePath);
