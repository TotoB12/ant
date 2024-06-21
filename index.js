const express = require('express');
const fileUpload = require('express-fileupload');
const fs = require('fs');
const zlib = require('zlib');
const sharp = require('sharp');
const util = require('util');
const path = require('path');

const app = express();
const port = 3000;

const brotliCompress = util.promisify(zlib.brotliCompress);
const brotliDecompress = util.promisify(zlib.brotliDecompress);

app.use(express.static('public'));
app.use(fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 },
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

async function createAntFile(filename, width, height, compressedData) {
    const signature = Buffer.from('ANT\0', 'ascii');
    const metadata = Buffer.alloc(8);

    metadata.writeUInt32BE(width, 0);
    metadata.writeUInt32BE(height, 4);

    const content = Buffer.concat([signature, metadata, compressedData]);

    await fs.promises.writeFile(filename, content);
}

async function encodeImageToAnt(inputBuffer, filename) {
    if (!inputBuffer || inputBuffer.length === 0) {
        throw new Error('Input Buffer is empty');
    }

    const image = sharp(inputBuffer);
    const metadata = await image.metadata();

    const webpBuffer = await image
        .webp({ quality: 90, lossless: false, effort: 6 })
        .toBuffer();

    const brotliCompressed = await brotliCompress(webpBuffer, {
        params: {
            [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_GENERIC,
            [zlib.constants.BROTLI_PARAM_QUALITY]: zlib.constants.BROTLI_MAX_QUALITY,
            [zlib.constants.BROTLI_PARAM_SIZE_HINT]: webpBuffer.length
        }
    });

    await createAntFile(filename, metadata.width, metadata.height, brotliCompressed);
}

async function readAntFile(buffer) {
    if (!buffer || buffer.length === 0) {
        throw new Error('ANT file buffer is empty');
    }

    const signature = buffer.slice(0, 4).toString('ascii');
    if (signature !== 'ANT\0') {
        throw new Error('Invalid file format');
    }

    const width = buffer.readUInt32BE(4);
    const height = buffer.readUInt32BE(8);
    const compressedData = buffer.slice(12);

    const decompressedData = await brotliDecompress(compressedData);

    return { width, height, webpData: decompressedData };
}

app.post('/upload', async (req, res) => {
    if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).send('No files were uploaded.');
    }

    const uploadedFile = req.files.file;
    const outputFormat = req.body.format;
    const inputExtension = path.extname(uploadedFile.name).substring(1).toLowerCase();

    console.log(`Received file: ${uploadedFile.name}, size: ${uploadedFile.size} bytes`);
    console.log(`Output format: ${outputFormat}`);

    console.log(`uploadedFile.data type: ${typeof uploadedFile.data}, length: ${uploadedFile.data.length}`);

    if (!outputFormat) {
        return res.status(400).send('Output format not specified.');
    }

    if (inputExtension === outputFormat || (inputExtension === 'png' && outputFormat === 'jpg') || (inputExtension === 'jpg' && outputFormat === 'png')) {
        return res.status(400).send(`Conversion from ${inputExtension} to ${outputFormat} is not allowed.`);
    }

    try {
        if (outputFormat === 'ant') {
            console.log('Encoding image to ANT format');
            const outputFilename = `output_${Date.now()}.ant`;
            await encodeImageToAnt(uploadedFile.data, outputFilename);
            res.download(outputFilename, outputFilename, () => fs.unlinkSync(outputFilename));
        } else if (inputExtension === 'ant') {
            console.log('Decoding ANT file');
            const { webpData } = await readAntFile(uploadedFile.data);
            const outputFilename = `output_${Date.now()}.${outputFormat}`;
            await sharp(webpData)
                .toFormat(outputFormat)
                .toFile(outputFilename);
            res.download(outputFilename, outputFilename, () => fs.unlinkSync(outputFilename));
        } else {
            res.status(400).send('Invalid conversion requested.');
        }
    } catch (error) {
        console.error('Error processing file:', error);
        res.status(500).send('Error processing file.');
    }
});

app.post('/preview', async (req, res) => {
    if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).send('No files were uploaded.');
    }

    const uploadedFile = req.files.file;

    try {
        const { webpData } = await readAntFile(uploadedFile.data);
        res.contentType('image/webp');
        res.send(webpData);
    } catch (error) {
        console.error('Error generating preview:', error);
        res.status(500).send('Error generating preview.');
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
