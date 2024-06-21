const fs = require('fs');
const zlib = require('zlib');
const sharp = require('sharp');
const util = require('util');
const readline = require('readline');

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

async function askOutputFormat() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const question = util.promisify(rl.question).bind(rl);

    let outputFormat;
    try {
        const answer = await question('Enter the desired output format (1 for PNG, 2 for JPG): ');
        if (answer === '1') {
            outputFormat = 'png';
        } else if (answer === '2') {
            outputFormat = 'jpg';
        } else {
            console.error('Invalid input, defaulting to PNG.');
            outputFormat = 'png';
        }
    } finally {
        rl.close();
    }

    return outputFormat;
}

async function createImageFromAnt(antFilePath, outputFileBasePath) {
    try {
        const { webpData } = await readAntFile(antFilePath);
        const outputFormat = await askOutputFormat();

        // Determine the full output file path with the correct extension
        const outputFilePath = `${outputFileBasePath}.${outputFormat}`;
        
        // Convert WebP data to the desired format
        await sharp(webpData)
            .toFormat(outputFormat)
            .toFile(outputFilePath);

        console.log(`Decoded ${antFilePath} to ${outputFilePath}`);
    } catch (error) {
        console.error('Error decoding ANT to image:', error);
    }
}

// Example usage
const antFilePath = 'output_optimized.ant';
const outputFileBasePath = 'decoded_optimized_output'; // Base name; extension will be added based on chosen format
createImageFromAnt(antFilePath, outputFileBasePath);
