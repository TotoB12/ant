const fs = require('fs');
const brotli = require('brotli');
const { PNG } = require('pngjs');

function rgbToYuv(r, g, b) {
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    const u = -0.14713 * r - 0.28886 * g + 0.436 * b;
    const v = 0.615 * r - 0.51499 * g - 0.10001 * b;
    return [y, u, v];
}

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
    const metadata = Buffer.alloc(9);

    metadata.writeUInt32BE(width, 0);
    metadata.writeUInt32BE(height, 4);
    metadata.writeUInt8(colorDepth, 8);

    const content = Buffer.concat([signature, metadata, compressedData]);

    fs.writeFileSync(filename, content);
}

function encodePngToAnt(pngFilePath, antFilePath) {
    fs.createReadStream(pngFilePath)
        .pipe(new PNG())
        .on('parsed', function() {
            const { width, height, data } = this;
            const colorDepth = 24;

            const yuvData = Buffer.alloc(width * height * 3);

            for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
                const [y, u, v] = rgbToYuv(data[i], data[i + 1], data[i + 2]);
                yuvData[j] = Math.round(y);
                yuvData[j + 1] = Math.round(u + 128);
                yuvData[j + 2] = Math.round(v + 128);
            }

            const deltaEncodedData = advancedDeltaEncode(yuvData, width);
            const compressedData = Buffer.from(brotli.compress(deltaEncodedData, {
                mode: 0,
                quality: 11,
                lgwin: 24,
                lgblock: 0
            }));

            console.log(`Compressed data size: ${compressedData.length}`);

            createAntFile(antFilePath, width, height, colorDepth, compressedData);
            console.log(`Encoded ${pngFilePath} to ${antFilePath}`);
        })
        .on('error', function(err) {
            console.error('Error reading PNG file:', err);
        });
}

const pngFilePath = '132.png';
const antFilePath = 'output_optimized.ant';
encodePngToAnt(pngFilePath, antFilePath);
