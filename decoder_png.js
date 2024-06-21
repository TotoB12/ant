const fs = require('fs');
const zlib = require('zlib');
const sharp = require('sharp');
const util = require('util');

const brotliDecompress = util.promisify(zlib.brotliDecompress);

async function readAntFile(filename) {
    const buffer = await fs.promises.readFile(filename);
    const signature = buffer.slice(0, 4).toString('ascii');
    if (signature !== 'ANT\0') {
        throw new Error('Invalid file format');
    }

    const width = buffer.readUInt32BE(4);
    const height = buffer.readUInt32BE(8);
    const compressedData = buffer.slice(12);

    console.log(`Reading file with width: ${width}, height: ${height}`);

    try {
        // Decompress with Brotli
        const decompressedData = await brotliDecompress(compressedData);
        console.log(`Decompressed data size: ${decompressedData.length} bytes`);
        return { width, height, webpData: decompressedData };
    } catch (error) {
        console.error('Error during decompression:', error);
        throw new Error('Failed to decompress WebP data');
    }
}

async function createPngFromAnt(antFilePath, pngFilePath) {
    try {
        const { webpData } = await readAntFile(antFilePath);

        // Convert WebP data to PNG
        await sharp(webpData)
            .png()
            .toFile(pngFilePath);

        console.log(`Decoded ${antFilePath} to ${pngFilePath}`);
    } catch (error) {
        console.error('Error decoding ANT to PNG:', error);
    }
}

// Example usage
const antFilePath = 'output_optimized.ant';
const pngFilePath = 'decoded_optimized_output.png';
createPngFromAnt(antFilePath, pngFilePath);
