const fs = require('fs');
const zlib = require('zlib');
const sharp = require('sharp');
const util = require('util');

const brotliCompress = util.promisify(zlib.brotliCompress);

async function createAntFile(filename, width, height, compressedData) {
    const signature = Buffer.from('ANT\0', 'ascii');
    const metadata = Buffer.alloc(8); // 4 bytes for width, 4 for height

    metadata.writeUInt32BE(width, 0);
    metadata.writeUInt32BE(height, 4);

    const content = Buffer.concat([signature, metadata, compressedData]);

    await fs.promises.writeFile(filename, content);
}

async function encodePngToAnt(pngFilePath, antFilePath) {
    try {
        console.log(`Reading PNG file: ${pngFilePath}`);
        
        // Get image dimensions
        const metadata = await sharp(pngFilePath).metadata();
        console.log(`Image dimensions: ${metadata.width}x${metadata.height}`);

        // Convert PNG to WebP with high compression
        console.log('Converting to WebP...');
        const webpBuffer = await sharp(pngFilePath)
            .webp({ quality: 90, lossless: false, effort: 6 })
            .toBuffer();

        console.log(`WebP buffer size: ${webpBuffer.length} bytes`);

        // Apply Brotli compression to WebP data
        console.log('Applying Brotli compression...');
        const brotliCompressed = await brotliCompress(webpBuffer, {
            params: {
                [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_GENERIC,
                [zlib.constants.BROTLI_PARAM_QUALITY]: zlib.constants.BROTLI_MAX_QUALITY,
                [zlib.constants.BROTLI_PARAM_SIZE_HINT]: webpBuffer.length
            }
        });

        console.log(`Compressed data size: ${brotliCompressed.length} bytes`);

        await createAntFile(antFilePath, metadata.width, metadata.height, brotliCompressed);
        console.log(`Encoded ${pngFilePath} to ${antFilePath}`);
    } catch (error) {
        console.error('Error encoding PNG to ANT:', error);
    }
}

// Example usage
const pngFilePath = 'input.png';
const antFilePath = 'output_optimized.ant';
encodePngToAnt(pngFilePath, antFilePath);
