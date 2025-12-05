#!/usr/bin/env node
const fs = require('fs');
const http = require('http');
const path = require('path');

// For testing, we'll just use a pre-generated DOCX file that we know works
// OR we can use the one from the browser download that succeeded
// Let's check if there are any cached downloads
const downloadsDir = path.join(__dirname, 'downloads');

let docxData = null;

// Try to find any existing DOCX file
if (fs.existsSync(downloadsDir)) {
    const dirs = fs.readdirSync(downloadsDir);
    for (const dir of dirs) {
        const files = fs.readdirSync(path.join(downloadsDir, dir));
        for (const file of files) {
            if (file.endsWith('.docx')) {
                const filePath = path.join(downloadsDir, dir, file);
                docxData = fs.readFileSync(filePath);
                console.log('Found cached DOCX:', filePath, docxData.length, 'bytes');
                break;
            }
        }
        if (docxData) break;
    }
}

// If no existing DOCX, create a minimal one from the actual browser session
if (!docxData) {
    console.log('No cached DOCX found. Please first download a file from the browser.');
    console.log('Then run this test again. The script will use that file.');
    process.exit(1);
}

#!/usr/bin/env node
const fs = require('fs');
const http = require('http');
const path = require('path');

// For testing, we'll just use a pre-generated DOCX file that we know works
// OR we can use the one from the browser download that succeeded
// Let's check if there are any cached downloads
const downloadsDir = path.join(__dirname, 'downloads');

let docxData = null;

// Try to find any existing DOCX file
if (fs.existsSync(downloadsDir)) {
    const dirs = fs.readdirSync(downloadsDir);
    for (const dir of dirs) {
        const files = fs.readdirSync(path.join(downloadsDir, dir));
        for (const file of files) {
            if (file.endsWith('.docx')) {
                const filePath = path.join(downloadsDir, dir, file);
                docxData = fs.readFileSync(filePath);
                console.log('Found cached DOCX:', filePath, docxData.length, 'bytes');
                break;
            }
        }
        if (docxData) break;
    }
}

// If no existing DOCX, create a minimal one from the actual browser session
if (!docxData) {
    console.log('No cached DOCX found. Please first download a file from the browser.');
    console.log('Then run this test again. The script will use that file.');
    process.exit(1);
}

console.log('\n📤 Sending POST to /onlyoffice/v8/downloadas/ with', docxData.length, 'bytes');

// 2. Send POST request to /onlyoffice/v8/downloadas/ with the document
const options = {
    hostname: 'localhost',
    port: 8080,
    path: '/onlyoffice/v8/downloadas/doc_test?cmd=' + encodeURIComponent(JSON.stringify({
        id: 'doc_test',
        outputformat: 65,  // DOCX
        title: 'TestDoc.docx'
    })),
    method: 'POST',
    headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': docxData.length
    }
};

const req = http.request(options, (res) => {

console.log('\n📤 Sending POST to /onlyoffice/v8/downloadas/');
const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });
    
    res.on('end', () => {
        console.log('✓ Response received, status:', res.statusCode);
        try {
            const response = JSON.parse(data);
            console.log('Response JSON:', JSON.stringify(response, null, 2));
            
            if (response.error === 0 && response.url) {
                console.log('\n📥 Download URL received:', response.url);
                
                // 3. Wait a moment then poll /api/latest-download
                setTimeout(() => {
                    console.log('\n⏳ Polling /api/latest-download...');
                    http.get('http://localhost:8080/api/latest-download', (pollRes) => {
                        let pollData = '';
                        pollRes.on('data', (chunk) => {
                            pollData += chunk;
                        });
                        pollRes.on('end', () => {
                            const pollResponse = JSON.parse(pollData);
                            console.log('Poll response:', JSON.stringify(pollResponse, null, 2));
                        });
                    }).on('error', e => console.error('Poll error:', e));
                }, 100);
            }
        } catch (e) {
            console.log('Raw response:', data);
        }
    });
});

req.on('error', (e) => {
    console.error('Request error:', e.message);
});

req.write(docxData);
req.end();
