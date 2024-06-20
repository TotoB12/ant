const fs = require('fs');
const brotli = require('brotli');
const jpeg = require('jpeg-js');

// Function to convert RGB to YUV
function rgbToYuv(r, g, b) {
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    const u = -0.14713 * r - 0.28886 * g + 0.436 * b;
    const v = 0.615 * r - 0.51499 * g - 0.10001 * b;
    return [y, u, v];
}

// Advanced delta encoding with larger context
function advancedDeltaEncode(buffer, width) {
    const encoded = Buffer.alloc(buffer.length);
    let prevRow = new Array(width).fill([0, 0, 0]);

    for (let i = 0; i < buffer.length; i += 3) {
        const row = Math.floor(i / (width * 3));
        const col = (i / 3) % width;
        const curr = [buffer[i], buffer[i + 1], buffer[i + 2]];

        const prev = row === 0 ? [0, 0, 0] : prevRow[col];

        encoded[i] = (curr[0] - prev[0] + 256) % 256;
        encoded[i + 1] = (curr[1] - prev[1] + 256) % 256;
        encoded[i + 2] = (curr[2] - prev[2] + 256) % 256;

        prevRow[col] = curr;
    }
    return encoded;
}

function createAntFile(filename, width, height, colorDepth, compressedData) {
    const signature = Buffer.from('ANT\0', 'ascii');
    const metadata = Buffer.alloc(9); // 4 bytes for width, 4 for height, 1 for colorDepth

    metadata.writeUInt32BE(width, 0);
    metadata.writeUInt32BE(height, 4);
    metadata.writeUInt8(colorDepth, 8);

    const content = Buffer.concat([signature, metadata, compressedData]);

    fs.writeFileSync(filename, content);
}

function encodeJpegToAnt(jpegFilePath, antFilePath) {
    const jpegData = fs.readFileSync(jpegFilePath);
    const rawImageData = jpeg.decode(jpegData, { useTArray: true });

    const { width, height, data } = rawImageData;
    const colorDepth = 24;

    const yuvData = Buffer.alloc(width * height * 3);

    // Convert RGB to YUV
    for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
        const [y, u, v] = rgbToYuv(data[i], data[i + 1], data[i + 2]);
        yuvData[j] = Math.round(y);
        yuvData[j + 1] = Math.round(u + 128); // Offset U and V by 128 to fit in 8-bit
        yuvData[j + 2] = Math.round(v + 128);
    }

    const deltaEncodedData = advancedDeltaEncode(yuvData, width);
    const compressedData = Buffer.from(brotli.compress(deltaEncodedData, {
        mode: 0,   // Text mode for more aggressive compression
        quality: 11,
        lgwin: 24,
        lgblock: 0
    }));

    console.log(`Compressed data size: ${compressedData.length}`);

    createAntFile(antFilePath, width, height, colorDepth, compressedData);
    console.log(`Encoded ${jpegFilePath} to ${antFilePath}`);
}

// Example usage
const jpegFilePath = '132.jpg';
const antFilePath = 'output_optimized.ant';
encodeJpegToAnt(jpegFilePath, antFilePath);
