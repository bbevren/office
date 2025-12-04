const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;

// Load x2t converter
let x2t = null;
let x2tReady = false;

try {
    x2t = require('./x2t');
    x2t.onRuntimeInitialized = () => {
        x2tReady = true;
        console.log('✓ x2t-wasm converter ready');
    };
} catch (e) {
    console.log('⚠ x2t-wasm not available, download will be limited');
}

const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.wasm': 'application/wasm',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject'
};

const server = http.createServer((req, res) => {
    // Parse URL and strip query string
    const urlObj = new URL(req.url, `http://localhost:${PORT}`);
    const pathname = decodeURIComponent(urlObj.pathname);
    
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end();
        return;
    }
    
    // Handle download request (POST to /onlyoffice/v8/downloadas/*)
    if (req.method === 'POST' && pathname.startsWith('/onlyoffice/v8/downloadas/')) {
        handleDownload(req, res, urlObj);
        return;
    }
    
    // Handle direct conversion API (POST /api/convert)
    if (req.method === 'POST' && pathname === '/api/convert') {
        handleDirectConvert(req, res);
        return;
    }
    
    // Handle polling for latest download
    if (req.method === 'GET' && pathname === '/api/latest-download') {
        const latest = global.latestDownload;
        res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        });
        if (latest && Date.now() - latest.timestamp < 30000) {
            res.end(JSON.stringify(latest));
            // Clear it after returning once
            global.latestDownload = null;
        } else {
            res.end(JSON.stringify({ ready: false }));
        }
        return;
    }
    
    // Handle converted file download (GET /downloads/*)
    if (req.method === 'GET' && pathname.startsWith('/downloads/')) {
        handleFileDownload(req, res, pathname);
        return;
    }
    
    let filePath;
    
    // Handle root
    if (pathname === '/') {
        filePath = path.join(__dirname, 'public', 'index.html');
    } 
    // Handle all public files
    else {
        filePath = path.join(__dirname, 'public', pathname);
    }
    
    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    
    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                console.log(`❌ 404: ${pathname} -> ${filePath}`);
                res.writeHead(404);
                res.end('File not found: ' + pathname);
            } else {
                console.log(`❌ 500: ${pathname} -> ${err.code}`);
                res.writeHead(500);
                res.end('Server error: ' + err.code);
            }
        } else {
            res.writeHead(200, { 
                'Content-Type': contentType,
                'Access-Control-Allow-Origin': '*'
            });
            res.end(content);
        }
    });
});

// Handle document download/conversion
function handleDownload(req, res, urlObj) {
    const chunks = [];
    
    req.on('data', chunk => {
        chunks.push(chunk);
    });
    
    req.on('end', async () => {
        try {
            // Parse the cmd parameter from query string
            const cmdParam = urlObj.searchParams.get('cmd');
            const cmd = cmdParam ? JSON.parse(cmdParam) : {};
            
            console.log('[Download] Request:', cmd.title || 'unknown', 'format:', cmd.outputformat);
            
            // Get the body data
            const body = Buffer.concat(chunks);
            
            if (!x2tReady) {
                console.log('[Download] x2t not ready, returning error');
                res.writeHead(503, {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(JSON.stringify({ error: 1, message: 'Converter not ready' }));
                return;
            }
            
            // The body contains the document binary data
            // We need to convert it using x2t
            const docId = cmd.id || 'doc_unknown';
            const outputFormat = cmd.outputformat || 65; // Default to docx
            const title = cmd.title || 'Untitled.docx';
            
            // Determine input/output extensions
            const formatMap = {
                65: 'docx',  // Word
                257: 'xlsx', // Excel
                129: 'pptx', // PowerPoint
                513: 'pdf'   // PDF
            };
            const outputExt = formatMap[outputFormat] || 'docx';
            
            // Determine input extension based on internal format
            const inputExt = outputFormat < 200 ? 'bin' : (outputFormat < 300 ? 'bin' : 'bin');
            
            try {
                // Initialize working directory in WASM filesystem
                initWorkDir();
                
                // Write input file to WASM filesystem
                const inputPath = `/working/input.${inputExt}`;
                const outputPath = `/working/output.${outputExt}`;
                
                x2t.FS.writeFile(inputPath, body);
                console.log('[Download] Written input:', body.length, 'bytes');
                
                // Create conversion params
                const params = `<?xml version="1.0" encoding="utf-8"?>
<TaskQueueDataConvert xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <m_sFontDir>/working/fonts/</m_sFontDir>
  <m_sThemeDir>/working/themes</m_sThemeDir>
  <m_sFileFrom>${inputPath}</m_sFileFrom>
  <m_sFileTo>${outputPath}</m_sFileTo>
  <m_bIsNoBase64>true</m_bIsNoBase64>
</TaskQueueDataConvert>`;
                
                x2t.FS.writeFile('/working/params.xml', params);
                
                // Run conversion
                console.log('[Download] Running x2t conversion...');
                const result = x2t.ccall("main1", "number", ["string"], ["/working/params.xml"]);
                
                if (result !== 0) {
                    throw new Error(`Conversion failed with code ${result}`);
                }
                
                // Read output file
                const outputData = x2t.FS.readFile(outputPath);
                console.log('[Download] Conversion success, output:', outputData.length, 'bytes');
                
                // Create a unique URL for this download
                const downloadId = Date.now().toString();
                const downloadPath = `/downloads/${downloadId}/${title}`;
                
                // Store the file temporarily
                if (!global.downloadCache) global.downloadCache = {};
                global.downloadCache[downloadId] = {
                    data: outputData,
                    title: title,
                    expires: Date.now() + 60000 // 1 minute expiry
                };
                
                // Also store in a "latest download" slot that the client can poll
                global.latestDownload = {
                    id: downloadId,
                    url: `http://localhost:${PORT}${downloadPath}`,
                    title: title,
                    timestamp: Date.now()
                };
                
                // Return URL to download - match OnlyOffice expected format
                const downloadUrl = `http://localhost:${PORT}${downloadPath}`;
                const response = {
                    error: 0,
                    key: docId,
                    url: downloadUrl,
                    urls: downloadUrl,  // Some versions use urls
                    fileType: outputExt,
                    end: true
                };
                
                console.log('[Download] Sending response:', response);
                
                res.writeHead(200, {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(JSON.stringify(response));
                
            } catch (convErr) {
                console.error('[Download] Conversion error:', convErr);
                res.writeHead(200, {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(JSON.stringify({ error: 1, message: convErr.message }));
            }
            
        } catch (e) {
            console.error('[Download] Error:', e);
            res.writeHead(500, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify({ error: 1, message: e.message }));
        }
    });
}

// Initialize working directory in the wasm filesystem
function initWorkDir() {
    try {
        if (x2t.FS.analyzePath('/working').exists) {
            removeRecursive(x2t.FS, '/working');
        }
    } catch (e) {}
    
    try { x2t.FS.mkdir('/working'); } catch (e) {}
    try { x2t.FS.mkdir('/working/media'); } catch (e) {}
    try { x2t.FS.mkdir('/working/fonts'); } catch (e) {}
    try { x2t.FS.mkdir('/working/themes'); } catch (e) {}
}

// Remove directory recursively
function removeRecursive(FS, p) {
    if (!FS.analyzePath(p).exists) return;
    if (FS.isDir(FS.stat(p).mode)) {
        FS.readdir(p)
            .filter(e => e !== '.' && e !== '..')
            .forEach(e => removeRecursive(FS, path.join(p, e)));
        if (p !== '/') FS.rmdir(p);
    } else {
        FS.unlink(p);
    }
}

// Handle converted file download
function handleFileDownload(req, res, pathname) {
    // Extract download ID from path: /downloads/{id}/{filename}
    const parts = pathname.split('/').filter(p => p);
    if (parts.length < 2) {
        res.writeHead(404);
        res.end('Not found');
        return;
    }
    
    const downloadId = parts[1];
    const cache = global.downloadCache || {};
    const item = cache[downloadId];
    
    if (!item) {
        console.log('[FileDownload] Not found:', downloadId);
        res.writeHead(404);
        res.end('Download expired or not found');
        return;
    }
    
    // Check expiry
    if (Date.now() > item.expires) {
        delete cache[downloadId];
        res.writeHead(404);
        res.end('Download expired');
        return;
    }
    
    // Determine content type
    const ext = path.extname(item.title).toLowerCase();
    const contentTypes = {
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        '.pdf': 'application/pdf'
    };
    const contentType = contentTypes[ext] || 'application/octet-stream';
    
    console.log('[FileDownload] Serving:', item.title, item.data.length, 'bytes');
    
    res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${item.title}"`,
        'Content-Length': item.data.length,
        'Access-Control-Allow-Origin': '*'
    });
    res.end(item.data);
    
    // Clean up after download
    delete cache[downloadId];
}

// Handle direct conversion API - returns converted file directly (not URL)
async function handleDirectConvert(req, res) {
    const chunks = [];
    
    req.on('data', chunk => {
        chunks.push(chunk);
    });
    
    req.on('end', async () => {
        try {
            const body = Buffer.concat(chunks);
            
            // Parse multipart form data manually
            const contentType = req.headers['content-type'] || '';
            const boundaryMatch = contentType.match(/boundary=(.+)$/);
            
            if (!boundaryMatch) {
                res.writeHead(400, { 'Content-Type': 'text/plain' });
                res.end('Missing multipart boundary');
                return;
            }
            
            const boundary = boundaryMatch[1];
            const parts = parseMultipart(body, boundary);
            
            const fileData = parts.file;
            const outputFormat = parts.outputFormat || 'docx';
            const title = parts.title || `output.${outputFormat}`;
            
            if (!fileData) {
                res.writeHead(400, { 'Content-Type': 'text/plain' });
                res.end('Missing file data');
                return;
            }
            
            console.log('[DirectConvert] Converting to:', outputFormat, 'size:', fileData.length);
            
            if (!x2tReady) {
                res.writeHead(503, { 'Content-Type': 'text/plain' });
                res.end('x2t converter not ready');
                return;
            }
            
            // Detect input format from content
            const content = fileData.toString('utf8').substring(0, 100);
            let inputExt = 'bin';  // Default to internal format for DOCY/XLSY/PPTY
            
            try {
                // Initialize working directory
                initWorkDir();
                
                // Write input file
                const inputPath = `/working/input.${inputExt}`;
                const outputPath = `/working/output.${outputFormat}`;
                
                x2t.FS.writeFile(inputPath, fileData);
                console.log('[DirectConvert] Written input:', fileData.length, 'bytes');
                
                // Build conversion params (same format as handleDownload)
                const params = `<?xml version="1.0" encoding="utf-8"?>
<TaskQueueDataConvert xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <m_sFontDir>/working/fonts/</m_sFontDir>
  <m_sThemeDir>/working/themes</m_sThemeDir>
  <m_sFileFrom>${inputPath}</m_sFileFrom>
  <m_sFileTo>${outputPath}</m_sFileTo>
  <m_bIsNoBase64>true</m_bIsNoBase64>
</TaskQueueDataConvert>`;
                
                x2t.FS.writeFile('/working/params.xml', params);
                
                // Run conversion
                console.log('[DirectConvert] Running x2t...');
                const result = x2t.ccall("main1", "number", ["string"], ["/working/params.xml"]);
                console.log('[DirectConvert] x2t result:', result);
                
                if (result !== 0) {
                    throw new Error(`Conversion failed with code ${result}`);
                }
                
                // Read output file
                const outputData = x2t.FS.readFile(outputPath);
                console.log('[DirectConvert] Success, output:', outputData.length, 'bytes');
                
                // Determine content type
                const ext = '.' + outputFormat.toLowerCase();
                const contentTypes = {
                    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                    '.pdf': 'application/pdf'
                };
                
                res.writeHead(200, {
                    'Content-Type': contentTypes[ext] || 'application/octet-stream',
                    'Content-Disposition': `attachment; filename="${title}"`,
                    'Content-Length': outputData.length,
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(Buffer.from(outputData));
                
            } catch (convErr) {
                console.log('[DirectConvert] Conversion failed:', convErr.message);
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Conversion failed: ' + convErr.message);
            }
            
        } catch (err) {
            console.error('[DirectConvert] Error:', err);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Conversion error: ' + err.message);
        }
    });
}

// Simple multipart form parser
function parseMultipart(body, boundary) {
    const result = {};
    const boundaryBuffer = Buffer.from('--' + boundary);
    const parts = [];
    
    // Find all parts
    let start = 0;
    while (true) {
        const pos = body.indexOf(boundaryBuffer, start);
        if (pos === -1) break;
        if (start > 0) {
            parts.push(body.slice(start, pos - 2)); // -2 for CRLF before boundary
        }
        start = pos + boundaryBuffer.length + 2; // +2 for CRLF after boundary
    }
    
    // Parse each part
    for (const part of parts) {
        const headerEnd = part.indexOf('\r\n\r\n');
        if (headerEnd === -1) continue;
        
        const header = part.slice(0, headerEnd).toString('utf8');
        const content = part.slice(headerEnd + 4);
        
        // Extract field name
        const nameMatch = header.match(/name="([^"]+)"/);
        if (nameMatch) {
            const name = nameMatch[1];
            // Check if it's a file
            if (header.includes('filename=')) {
                result[name] = content;
            } else {
                result[name] = content.toString('utf8').trim();
            }
        }
    }
    
    return result;
}

server.listen(PORT, () => {
    console.log('');
    console.log('🚀 OnlyOffice Serverless Server');
    console.log('================================');
    console.log(`📍 http://localhost:${PORT}/`);
    console.log('');
    console.log('Ready to create office documents!');
    console.log('');
});
