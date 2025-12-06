// Legacy format converter - runs in isolated process to avoid WASM memory issues
// Single step conversion only - for 2-step conversions, call this twice
// Usage: node convert-legacy.js <inputFile> <inputExt> <outputFile> <outputExt>

const x2t = require('./x2t');
const fs = require('fs');
const path = require('path');

const inputFile = process.argv[2];
const inputExt = process.argv[3];
const outputFile = process.argv[4];
const outputExt = process.argv[5] || 'bin';

if (!inputFile || !inputExt || !outputFile) {
    console.error('Usage: node convert-legacy.js <inputFile> <inputExt> <outputFile> [outputExt]');
    process.exit(1);
}

x2t.onRuntimeInitialized = () => {
    try {
        // Setup directories
        try { x2t.FS.mkdir('/working'); } catch(e) {}
        try { x2t.FS.mkdir('/working/media'); } catch(e) {}
        try { x2t.FS.mkdir('/working/fonts'); } catch(e) {}
        try { x2t.FS.mkdir('/working/themes'); } catch(e) {}
        
        // Read input file
        const data = fs.readFileSync(inputFile);
        x2t.FS.writeFile('/working/input.' + inputExt, data);
        console.error('[Convert] ' + inputExt + ' -> ' + outputExt);
        
        // Conversion params
        const params = `<?xml version="1.0" encoding="utf-8"?>
<TaskQueueDataConvert xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <m_sFontDir>/working/fonts/</m_sFontDir>
  <m_sThemeDir>/working/themes/</m_sThemeDir>
  <m_sFileFrom>/working/input.${inputExt}</m_sFileFrom>
  <m_sFileTo>/working/output.${outputExt}</m_sFileTo>
  <m_bIsNoBase64>false</m_bIsNoBase64>
</TaskQueueDataConvert>`;
        
        x2t.FS.writeFile('/working/params.xml', params);
        const result = x2t.ccall('main1', 'number', ['string'], ['/working/params.xml']);
        
        if (result !== 0) {
            console.log('FAIL:' + result);
            process.exit(result);
        }
        
        // Read and save output
        const output = x2t.FS.readFile('/working/output.' + outputExt);
        fs.writeFileSync(outputFile, output);
        console.error('[Convert] Output size: ' + output.length);
        
        // Extract images from /working/media (only for bin output)
        if (outputExt === 'bin') {
            const images = {};
            try {
                const mediaPath = '/working/media';
                if (x2t.FS.analyzePath(mediaPath).exists) {
                    const files = x2t.FS.readdir(mediaPath).filter(f => f !== '.' && f !== '..');
                    for (const file of files) {
                        const imageData = x2t.FS.readFile(mediaPath + '/' + file);
                        const ext = path.extname(file).toLowerCase();
                        const mimeTypes = {
                            '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
                            '.gif': 'image/gif', '.bmp': 'image/bmp', '.emf': 'image/x-emf', '.wmf': 'image/x-wmf'
                        };
                        const mimeType = mimeTypes[ext] || 'image/png';
                        const base64 = Buffer.from(imageData).toString('base64');
                        images[file] = 'data:' + mimeType + ';base64,' + base64;
                    }
                    if (files.length > 0) {
                        console.error('[Convert] Found ' + files.length + ' images');
                        fs.writeFileSync(outputFile + '.images.json', JSON.stringify(images));
                    }
                }
            } catch (e) {
                console.error('[Convert] Image error: ' + e.message);
            }
        }
        
        console.log('SUCCESS:' + output.length);
        process.exit(0);
        
    } catch (e) {
        console.error('ERROR:' + e.message);
        console.log('FAIL:' + e.message);
        process.exit(1);
    }
};
