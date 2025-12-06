const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

const PORT = 8080;

// Simple Markdown to HTML converter (no dependencies)
// Handles: headings, bold, italic, code blocks, lists, links, images, blockquotes, horizontal rules
function convertMarkdownToHtml(md) {
    let html = md;
    
    // Escape HTML entities first (except for our own conversions)
    html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    // Code blocks (fenced with ```)
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
    
    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Headers (h1-h6)
    html = html.replace(/^###### (.+)$/gm, '<h6>$1</h6>');
    html = html.replace(/^##### (.+)$/gm, '<h5>$1</h5>');
    html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    
    // Bold and italic
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');
    html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
    html = html.replace(/_(.+?)_/g, '<em>$1</em>');
    
    // Strikethrough
    html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');
    
    // Images ![alt](url)
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
    
    // Links [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    
    // Blockquotes
    html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
    
    // Horizontal rules
    html = html.replace(/^(---|\*\*\*|___)$/gm, '<hr>');
    
    // Unordered lists
    html = html.replace(/^\* (.+)$/gm, '<li>$1</li>');
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
    
    // Ordered lists
    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
    
    // Paragraphs - wrap remaining text blocks
    html = html.replace(/^(?!<[a-z]|$)(.+)$/gm, '<p>$1</p>');
    
    // Clean up empty paragraphs and fix nested issues
    html = html.replace(/<p><\/p>/g, '');
    
    return html;
}

// Load x2t converter
let x2t = null;
let x2tReady = false;

// Global image cache for document images
// Key: image filename (e.g., 'image1.jpg'), Value: { data: Buffer, mimeType: string }
global.imageCache = {};

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
    '.htm': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.wasm': 'application/wasm',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
    // Document formats for samples
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.doc': 'application/msword',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
    '.md': 'text/markdown',
    '.rtf': 'application/rtf',
    '.odt': 'application/vnd.oasis.opendocument.text',
    '.ods': 'application/vnd.oasis.opendocument.spreadsheet',
    '.odp': 'application/vnd.oasis.opendocument.presentation'
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
    
    // Handle download request (POST or GET to /onlyoffice/v8/downloadas/*)
    if ((req.method === 'POST' || req.method === 'GET') && pathname.startsWith('/onlyoffice/v8/downloadas/')) {
        handleDownload(req, res, urlObj);
        return;
    }
    
    // Handle file open conversion API (POST /api/open) - converts DOCX/XLSX/PPTX to internal binary format
    if (req.method === 'POST' && pathname === '/api/open') {
        handleOpenConvert(req, res);
        return;
    }
    
    // Handle image upload API (POST /api/upload-image)
    if (req.method === 'POST' && pathname === '/api/upload-image') {
        handleImageUpload(req, res);
        return;
    }
    
    // Handle image fetch from URL (GET /api/fetch-image?url=...)
    // This proxies external images to avoid CORS issues
    if (req.method === 'GET' && pathname === '/api/fetch-image') {
        handleFetchImage(req, res, urlObj);
        return;
    }
    
    // Handle direct conversion API (POST /api/convert)
    if (req.method === 'POST' && pathname === '/api/convert') {
        handleDirectConvert(req, res);
        return;
    }
    
    // Handle PDF generation with pdf.bin (POST /api/print-pdf)
    // This is called by APP.printPdf when OnlyOffice generates PDF
    if (req.method === 'POST' && pathname === '/api/print-pdf') {
        handlePrintPdf(req, res);
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
    
    // Handle cached images (for document images)
    // Check if this is an image request that we have in cache
    const imageMatch = pathname.match(/\/image(\d+)\.(jpg|jpeg|png|gif|bmp|emf|wmf)$/i);
    if (imageMatch && req.method === 'GET') {
        const imageName = `image${imageMatch[1]}.${imageMatch[2]}`;
        const cached = global.imageCache[imageName];
        if (cached) {
            console.log('[ImageCache] Serving cached image:', imageName, cached.data.length, 'bytes');
            res.writeHead(200, {
                'Content-Type': cached.mimeType,
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=3600'
            });
            res.end(cached.data);
            return;
        }
    }
    
    let filePath;
    
    // Handle root
    if (pathname === '/') {
        filePath = path.join(__dirname, 'public', 'index.html');
    }
    // Handle sample files (GET /samples/*)
    else if (pathname.startsWith('/samples/')) {
        filePath = path.join(__dirname, pathname);
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
    // For GET requests, OnlyOffice is just asking for a download URL
    // For POST requests, we get the document body to convert
    
    const chunks = [];
    console.log('[Download] Handler invoked, method:', req.method, 'path:', urlObj.pathname);
    
    const processRequest = async () => {
        try {
            // Parse the cmd parameter from query string
            const cmdParam = urlObj.searchParams.get('cmd');
            let cmd = {};
            try {
                cmd = cmdParam ? JSON.parse(cmdParam) : {};
            } catch (parseErr) {
                console.log('[Download] Warning: Failed to parse cmd parameter:', parseErr.message);
            }
            
            // Log the full cmd object for debugging
            console.log('[Download] Full cmd object:', JSON.stringify(cmd, null, 2));
            console.log('[Download] Request:', cmd.title || 'unknown', 'format:', cmd.outputformat, 'method:', req.method);
            
            // Get the body data (empty for GET requests)
            const body = Buffer.concat(chunks);
            console.log('[Download] Body size:', body.length, 'bytes', 'chunks count:', chunks.length);
            
            if (!x2tReady) {
                console.log('[Download] x2t not ready, returning error');
                res.writeHead(503, {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(JSON.stringify({ error: 1, message: 'Converter not ready' }));
                return;
            }
            
            // For GET requests with no body, we can't convert
            // Return an error indicating the document body is needed
            if (body.length === 0 && req.method === 'GET') {
                console.log('[Download] GET request with no body - returning empty document response');
                // Return a response that tells OnlyOffice to use the document it already has
                const response = {
                    error: 0,
                    key: cmd.id || 'doc_unknown',
                    url: '',  // No URL - OnlyOffice will handle locally
                    end: true
                };
                res.writeHead(200, {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(JSON.stringify(response));
                return;
            }
            
            // The body contains the document binary data
            // We need to convert it using x2t
            const docId = cmd.id || 'doc_unknown';
            const outputFormat = cmd.outputformat || 65; // Default to docx
            
            // Check for filename override from our client-side interceptor
            const overrideFilename = req.headers['x-override-filename'];
            let title = cmd.title || 'Untitled.docx';
            if (overrideFilename) {
                console.log('[Download] Using override filename:', overrideFilename);
                title = overrideFilename;
            }
            
            // Determine input/output extensions
            const formatMap = {
                65: 'docx',  // Word
                66: 'doc',   // Word legacy
                67: 'odt',   // OpenDocument Text
                69: 'txt',   // Plain text
                70: 'html',  // HTML
                257: 'xlsx', // Excel
                258: 'xls',  // Excel legacy
                259: 'ods',  // OpenDocument Spreadsheet
                260: 'csv',  // CSV
                129: 'pptx', // PowerPoint
                130: 'ppt',  // PowerPoint legacy
                131: 'odp',  // OpenDocument Presentation
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
                console.log('[Download] Input path:', inputPath);
                console.log('[Download] Output path:', outputPath, 'format code:', outputFormat);
                
                // Create conversion params - include encoding for TXT/CSV
                const params = `<?xml version="1.0" encoding="utf-8"?>
<TaskQueueDataConvert xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <m_sFontDir>/working/fonts/</m_sFontDir>
  <m_sThemeDir>/working/themes</m_sThemeDir>
  <m_sFileFrom>${inputPath}</m_sFileFrom>
  <m_sFileTo>${outputPath}</m_sFileTo>
  <m_bIsNoBase64>false</m_bIsNoBase64>
  <m_nCsvTxtEncoding>46</m_nCsvTxtEncoding>
  <m_nCsvDelimiter>4</m_nCsvDelimiter>
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
                
                // Debug: Log first bytes of output to understand format
                if (outputExt === 'txt' || outputExt === 'pdf') {
                    const preview = outputData.slice(0, 100);
                    console.log('[Download] First 100 bytes:', Buffer.from(preview).toString('hex'));
                    console.log('[Download] As text:', Buffer.from(preview).toString('utf8').substring(0, 100));
                }
                
                // Create a unique URL for this download
                const downloadId = Date.now().toString();
                const downloadPath = `/downloads/${downloadId}/${title}`;
                
                // Store the file temporarily
                if (!global.downloadCache) global.downloadCache = {};
                global.downloadCache[downloadId] = {
                    data: outputData,
                    title: title,
                    expires: Date.now() + 300000 // 5 minute expiry
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
                
                // IMPORTANT: OnlyOffice SDK doesn't automatically fetch the URL we return
                // So we have a choice:
                // 1. Return the URL and let client handle it (doesn't work - SDK ignores it)
                // 2. Return file data directly (breaks OnlyOffice expectations)
                // 3. Return URL but ALSO serve it from a different endpoint
                
                // For now, return the standard format that OnlyOffice expects
                // But also serve the file from a "latest" endpoint that JavaScript can poll
                const response = {
                    error: 0,
                    key: docId,
                    url: downloadUrl,
                    urls: downloadUrl,  // Some versions use urls
                    fileType: outputExt,
                    end: true
                };
                
                console.log('[Download] Sending response with URL:', downloadUrl);
                
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
    };
    
    // Collect chunks from the request body
    req.on('data', chunk => {
        console.log('[Download] Received chunk:', chunk.length, 'bytes');
        chunks.push(chunk);
    });
    
    // Process when all data is received
    req.on('end', () => {
        console.log('[Download] Request end event fired, total chunks:', chunks.length);
        processRequest();
    });
}

// Handle file open conversion - converts DOCX/XLSX/PPTX to internal binary format
// Convert legacy formats (doc, xls, ppt, rtf, csv) using child process
// Uses TWO separate child processes because x2t WASM corrupts after legacy conversion
async function convertLegacyFormat(inputBuffer, inputExt) {
    const tmpDir = os.tmpdir();
    const timestamp = Date.now() + '_' + Math.random().toString(36).substring(7);
    const inputFile = path.join(tmpDir, `input_${timestamp}.${inputExt}`);
    // Map legacy, ODF, and other formats to their OOXML equivalents for 2-step conversion
    const modernExtMap = { 
        doc: 'docx', xls: 'xlsx', ppt: 'pptx', rtf: 'docx',
        csv: 'xlsx'  // CSV needs to go through XLSX
    };
    const modernExt = modernExtMap[inputExt];
    
    const intermediateFile = path.join(tmpDir, `intermediate_${timestamp}.${modernExt}`);
    const outputFile = path.join(tmpDir, `output_${timestamp}.bin`);
    const imagesFile = outputFile + '.images.json';
    
    try {
        // Write input file
        fs.writeFileSync(inputFile, inputBuffer);
        console.log('[LegacyConvert] Input file:', inputFile);
        
        // STEP 1: Convert legacy -> OOXML format (in child process #1)
        console.log('[LegacyConvert] Step 1:', inputExt, '->', modernExt);
        let stdout1 = '', stderr1 = '';
        try {
            stdout1 = execSync(
                `node convert-legacy.js "${inputFile}" ${inputExt} "${intermediateFile}" ${modernExt}`,
                { cwd: __dirname, timeout: 120000, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
            );
        } catch (execErr) {
            stdout1 = execErr.stdout ? execErr.stdout.toString() : '';
            stderr1 = execErr.stderr ? execErr.stderr.toString() : '';
            console.log('[LegacyConvert] Step 1 child exit code:', execErr.status);
        }
        if (stderr1) console.log('[LegacyConvert] Step 1 log:', stderr1.trim());
        if (stdout1) console.log('[LegacyConvert] Step 1 result:', stdout1.trim());
        
        if (!fs.existsSync(intermediateFile)) {
            throw new Error('Step 1 failed - no intermediate file');
        }
        console.log('[LegacyConvert] Intermediate file size:', fs.statSync(intermediateFile).size);
        
        // STEP 2: Convert modern -> bin (in child process #2 - fresh x2t instance)
        console.log('[LegacyConvert] Step 2:', modernExt, '-> bin');
        let stdout2 = '', stderr2 = '';
        try {
            stdout2 = execSync(
                `node convert-legacy.js "${intermediateFile}" ${modernExt} "${outputFile}" bin`,
                { cwd: __dirname, timeout: 120000, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
            );
        } catch (execErr) {
            stdout2 = execErr.stdout ? execErr.stdout.toString() : '';
            stderr2 = execErr.stderr ? execErr.stderr.toString() : '';
            console.log('[LegacyConvert] Step 2 child exit code:', execErr.status);
        }
        if (stderr2) console.log('[LegacyConvert] Step 2 log:', stderr2.trim());
        if (stdout2) console.log('[LegacyConvert] Step 2 result:', stdout2.trim());
        
        if (!fs.existsSync(outputFile)) {
            throw new Error('Step 2 failed - no output file');
        }
        
        // Read output binary
        const outputData = fs.readFileSync(outputFile, 'utf8');
        console.log('[LegacyConvert] Output binary size:', outputData.length);
        
        // Read images if available
        let imageDataUrls = {};
        if (fs.existsSync(imagesFile)) {
            try {
                imageDataUrls = JSON.parse(fs.readFileSync(imagesFile, 'utf8'));
                console.log('[LegacyConvert] Loaded', Object.keys(imageDataUrls).length, 'images');
            } catch (e) {
                console.log('[LegacyConvert] Failed to load images:', e.message);
            }
        }
        
        console.log('[LegacyConvert] Success!');
        
        return {
            success: true,
            data: outputData,
            size: outputData.length,
            format: 'cryptpad',
            images: imageDataUrls
        };
        
    } finally {
        // Cleanup temp files
        try { fs.unlinkSync(inputFile); } catch(e) {}
        try { fs.unlinkSync(intermediateFile); } catch(e) {}
        try { fs.unlinkSync(outputFile); } catch(e) {}
        try { fs.unlinkSync(imagesFile); } catch(e) {}
    }
}

function handleOpenConvert(req, res) {
    const chunks = [];
    console.log('[OpenConvert] Handler invoked');
    
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', async () => {
        try {
            const body = Buffer.concat(chunks);
            console.log('[OpenConvert] Received file:', body.length, 'bytes');
            
            if (!x2tReady) {
                res.writeHead(503, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ error: 'Converter not ready' }));
                return;
            }
            
            // Get file extension from X-File-Extension header
            let fileExt = (req.headers['x-file-extension'] || 'docx').toLowerCase();
            console.log('[OpenConvert] File extension:', fileExt);
            
            // Define supported formats
            // OOXML formats use main x2t (most stable)
            const ooxmlFormats = ['docx', 'xlsx', 'pptx'];
            // Text-based formats use main x2t
            const textFormats = ['txt', 'html', 'md'];
            // ODS works directly
            const workingOdfFormats = ['ods'];
            // Legacy formats need 2-step child process conversion
            const legacyFormats = ['doc', 'xls', 'ppt', 'rtf'];
            // CSV needs 2-step conversion (CSV -> XLSX -> BIN)
            const csvFormats = ['csv'];
            // Formats with known x2t-wasm bugs (xmlHashFree null pointer)
            const brokenFormats = ['odt', 'odp'];
            
            const mainProcessFormats = [...ooxmlFormats, ...textFormats, ...workingOdfFormats];
            const twoStepFormats = [...legacyFormats, ...csvFormats];
            const allFormats = [...mainProcessFormats, ...twoStepFormats];
            
            // Check for broken formats first
            if (brokenFormats.includes(fileExt)) {
                console.log('[OpenConvert] Unsupported format (x2t-wasm bug):', fileExt);
                res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ 
                    error: `Cannot open .${fileExt} files - this format has a known bug in the x2t-wasm converter.\n\nPlease convert to a different format first:\n• For .odt → save as .docx\n• For .odp → save as .pptx\n\nYou can use LibreOffice or Google Docs to convert.`
                }));
                return;
            }
            
            if (!allFormats.includes(fileExt)) {
                console.log('[OpenConvert] Unsupported format:', fileExt);
                res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ error: `Unsupported format: ${fileExt}. Supported: ${allFormats.join(', ')}` }));
                return;
            }
            
            // Legacy formats need 2-step child process conversion
            if (twoStepFormats.includes(fileExt)) {
                console.log('[OpenConvert] Legacy format detected, using child process converter');
                try {
                    const result = await convertLegacyFormat(body, fileExt);
                    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                    res.end(JSON.stringify(result));
                } catch (err) {
                    console.error('[OpenConvert] Legacy conversion error:', err);
                    res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                    res.end(JSON.stringify({ error: err.message || 'Conversion failed' }));
                }
                return;
            }
            
            // Modern formats - direct conversion
            // Initialize working directory
            initWorkDir();
            
            // Clear image cache for new document
            global.imageCache = {};
            
            // Write input file
            const inputPath = `/working/input.${fileExt}`;
            const outputPath = '/working/output.bin';
            
            // Handle Markdown files - convert to HTML first since x2t doesn't support .md directly
            let actualInputPath = inputPath;
            if (fileExt === 'md') {
                const mdContent = body.toString('utf8');
                const htmlContent = convertMarkdownToHtml(mdContent);
                actualInputPath = '/working/input.html';
                x2t.FS.writeFile(actualInputPath, Buffer.from(htmlContent, 'utf8'));
                console.log('[OpenConvert] Converted Markdown to HTML:', htmlContent.length, 'chars');
            } else {
                x2t.FS.writeFile(inputPath, body);
            }
            console.log('[OpenConvert] Written input file:', body.length, 'bytes');
            
            // Create conversion params - convert to internal binary format
            // Includes encoding params for TXT and CSV files
            const params = `<?xml version="1.0" encoding="utf-8"?>
<TaskQueueDataConvert xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <m_sFontDir>/working/fonts/</m_sFontDir>
  <m_sThemeDir>/working/themes/</m_sThemeDir>
  <m_sFileFrom>${actualInputPath}</m_sFileFrom>
  <m_sFileTo>${outputPath}</m_sFileTo>
  <m_bIsNoBase64>false</m_bIsNoBase64>
  <m_nCsvTxtEncoding>46</m_nCsvTxtEncoding>
  <m_nCsvDelimiter>4</m_nCsvDelimiter>
</TaskQueueDataConvert>`;
            
            x2t.FS.writeFile('/working/params.xml', params);
            
            // Run conversion
            console.log('[OpenConvert] Running x2t conversion to binary format...');
            const result = x2t.ccall("main1", "number", ["string"], ["/working/params.xml"]);
            
            if (result !== 0) {
                throw new Error(`Conversion failed with code ${result}`);
            }
            
            // Extract images from /working/media and convert to base64 data URLs
            const imageDataUrls = {};
            try {
                const mediaPath = '/working/media';
                if (x2t.FS.analyzePath(mediaPath).exists) {
                    const files = x2t.FS.readdir(mediaPath).filter(f => f !== '.' && f !== '..');
                    console.log('[OpenConvert] Found media files:', files);
                    
                    for (const file of files) {
                        const filePath = `${mediaPath}/${file}`;
                        const imageData = x2t.FS.readFile(filePath);
                        const ext = path.extname(file).toLowerCase();
                        const mimeTypes = {
                            '.jpg': 'image/jpeg',
                            '.jpeg': 'image/jpeg',
                            '.png': 'image/png',
                            '.gif': 'image/gif',
                            '.bmp': 'image/bmp',
                            '.emf': 'image/x-emf',
                            '.wmf': 'image/x-wmf'
                        };
                        const mimeType = mimeTypes[ext] || 'image/png';
                        // Convert to base64 data URL
                        const base64 = Buffer.from(imageData).toString('base64');
                        const dataUrl = `data:${mimeType};base64,${base64}`;
                        imageDataUrls[file] = dataUrl;
                        
                        // Also keep in cache for backward compatibility
                        global.imageCache[file] = {
                            data: Buffer.from(imageData),
                            mimeType: mimeType
                        };
                        console.log('[OpenConvert] Image as data URL:', file, imageData.length, 'bytes');
                    }
                }
            } catch (mediaErr) {
                console.log('[OpenConvert] No media files or error reading media:', mediaErr.message);
            }
            
            // Read output - x2t outputs "DOCY;v5;size;base64data" string format
            // Read as UTF-8 text, not binary!
            const outputBytes = x2t.FS.readFile(outputPath);
            const outputData = new TextDecoder('utf-8').decode(outputBytes);
            console.log('[OpenConvert] Conversion success, output length:', outputData.length, 'chars');
            console.log('[OpenConvert] Output header:', outputData.substring(0, 50));
            
            // Return the string directly - it's already in CryptPad format
            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify({
                success: true,
                data: outputData,  // String in DOCY;v5;size;base64data format
                size: outputData.length,
                format: 'cryptpad',  // Mark that this is already in CryptPad format
                images: imageDataUrls  // Map of filename -> data URL for embedded images
            }));
            
        } catch (err) {
            console.error('[OpenConvert] Error:', err);
            res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ error: err.message }));
        }
    });
}

// Handle image upload for inserting images into documents
function handleImageUpload(req, res) {
    const chunks = [];
    console.log('[ImageUpload] Handler invoked');
    
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', async () => {
        try {
            const body = Buffer.concat(chunks);
            console.log('[ImageUpload] Received image:', body.length, 'bytes');
            
            // Get filename from header or generate one
            const contentType = req.headers['content-type'] || 'image/png';
            const ext = contentType.includes('jpeg') || contentType.includes('jpg') ? '.jpg' :
                       contentType.includes('gif') ? '.gif' :
                       contentType.includes('bmp') ? '.bmp' : '.png';
            
            // Generate unique filename
            const imageCount = Object.keys(global.imageCache).length + 1;
            const filename = `image${imageCount}${ext}`;
            
            // Store in cache
            global.imageCache[filename] = {
                data: body,
                mimeType: contentType
            };
            
            console.log('[ImageUpload] Cached image:', filename);
            
            // Return the URL where this image can be accessed
            const imageUrl = `/onlyoffice/v8/web-apps/apps/documenteditor/main/${filename}`;
            
            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify({
                success: true,
                filename: filename,
                url: imageUrl
            }));
            
        } catch (err) {
            console.error('[ImageUpload] Error:', err);
            res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ error: err.message }));
        }
    });
}

// Handle fetching image from external URL (proxy to avoid CORS)
function handleFetchImage(req, res, urlObj) {
    const imageUrl = urlObj.searchParams.get('url');
    console.log('[FetchImage] Fetching:', imageUrl);
    
    if (!imageUrl) {
        res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: 'Missing url parameter' }));
        return;
    }
    
    // Use https or http module based on URL
    const protocol = imageUrl.startsWith('https') ? require('https') : require('http');
    
    protocol.get(imageUrl, { 
        headers: { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    }, (response) => {
        // Handle redirects
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
            console.log('[FetchImage] Following redirect to:', response.headers.location);
            const redirectUrl = new URL(response.headers.location, imageUrl).href;
            const redirectProtocol = redirectUrl.startsWith('https') ? require('https') : require('http');
            redirectProtocol.get(redirectUrl, { 
                headers: { 'User-Agent': 'Mozilla/5.0' }
            }, handleResponse).on('error', handleError);
            return;
        }
        handleResponse(response);
    }).on('error', handleError);
    
    function handleResponse(response) {
        if (response.statusCode !== 200) {
            res.writeHead(response.statusCode, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ error: 'Failed to fetch image: ' + response.statusCode }));
            return;
        }
        
        const chunks = [];
        response.on('data', chunk => chunks.push(chunk));
        response.on('end', () => {
            const buffer = Buffer.concat(chunks);
            const contentType = response.headers['content-type'] || 'image/png';
            const base64 = buffer.toString('base64');
            const dataUrl = `data:${contentType};base64,${base64}`;
            
            console.log('[FetchImage] Success, size:', buffer.length, 'bytes');
            
            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify({
                success: true,
                dataUrl: dataUrl,
                size: buffer.length
            }));
        });
    }
    
    function handleError(err) {
        console.error('[FetchImage] Error:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: err.message }));
    }
}

// Initialize working directory in the wasm filesystem
// Also load fonts for PDF text rendering
let fontsLoaded = false;

function initWorkDir() {
    // Clean up working directory but preserve fonts
    try {
        // Remove media files
        if (x2t.FS.analyzePath('/working/media').exists) {
            removeRecursive(x2t.FS, '/working/media');
        }
        // Remove any output/input files
        const workingFiles = x2t.FS.readdir('/working').filter(f => f !== '.' && f !== '..' && f !== 'fonts' && f !== 'themes');
        for (const file of workingFiles) {
            try { x2t.FS.unlink('/working/' + file); } catch (e) {}
        }
    } catch (e) {}
    
    try { x2t.FS.mkdir('/working'); } catch (e) {}
    try { x2t.FS.mkdir('/working/media'); } catch (e) {}
    try { x2t.FS.mkdir('/working/fonts'); } catch (e) {}
    try { x2t.FS.mkdir('/working/themes'); } catch (e) {}
    
    // Load fonts if not already loaded (fonts are persistent across conversions)
    if (!fontsLoaded) {
        loadFontsToWasm();
    }
}

// Load font files into the WASM filesystem for PDF text rendering
function loadFontsToWasm() {
    const fontsDir = path.join(__dirname, 'public', 'onlyoffice', 'v8', 'fonts', 'fonts');
    
    try {
        if (!fs.existsSync(fontsDir)) {
            console.log('[Fonts] Fonts directory not found:', fontsDir);
            return;
        }
        
        const fontFiles = fs.readdirSync(fontsDir).filter(f => 
            f.endsWith('.ttf') || f.endsWith('.otf')
        );
        
        console.log('[Fonts] Loading', fontFiles.length, 'font files...');
        
        let loaded = 0;
        for (const fontFile of fontFiles) {
            try {
                const fontPath = path.join(fontsDir, fontFile);
                const fontData = fs.readFileSync(fontPath);
                x2t.FS.writeFile('/working/fonts/' + fontFile, fontData);
                loaded++;
            } catch (e) {
                // Skip individual font errors
            }
        }
        
        console.log('[Fonts] Loaded', loaded, 'fonts into WASM filesystem');
        fontsLoaded = true;
        
    } catch (err) {
        console.error('[Fonts] Error loading fonts:', err.message);
    }
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
    
    console.log('[FileDownload] Requested:', downloadId, 'cached items:', Object.keys(cache).length);
    
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
        '.pdf': 'application/pdf',
        '.txt': 'text/plain; charset=utf-8',
        '.html': 'text/html; charset=utf-8',
        '.csv': 'text/csv; charset=utf-8',
        '.odt': 'application/vnd.oasis.opendocument.text',
        '.ods': 'application/vnd.oasis.opendocument.spreadsheet',
        '.odp': 'application/vnd.oasis.opendocument.presentation'
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
// Handle PDF generation with pdf.bin from OnlyOffice
// This receives the pdf.bin (rendering buffer) and optionally document.bin
// The pdf.bin from OnlyOffice may already be PDF data or a rendering buffer for x2t
async function handlePrintPdf(req, res) {
    console.log('[PrintPdf] Handler invoked');
    
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', async () => {
        try {
            const body = Buffer.concat(chunks);
            console.log('[PrintPdf] Received', body.length, 'bytes');
            
            // Parse multipart form data
            const contentType = req.headers['content-type'] || '';
            const boundaryMatch = contentType.match(/boundary=([^;]+)/);
            if (!boundaryMatch) {
                throw new Error('No boundary in content-type');
            }
            
            const boundary = boundaryMatch[1];
            const parts = parseMultipart(body, boundary);
            
            console.log('[PrintPdf] Parsed parts:', Object.keys(parts));
            
            const docBin = parts.docbin;
            const pdfBin = parts.pdfbin;
            const filename = parts.filename || 'document';
            
            if (!pdfBin) {
                throw new Error('Missing pdfbin');
            }
            
            console.log('[PrintPdf] pdfbin:', pdfBin.length, 'bytes');
            if (docBin) {
                console.log('[PrintPdf] docbin:', docBin.length, 'bytes');
            }
            
            // Check if pdfBin is already a valid PDF (starts with %PDF)
            const pdfHeader = pdfBin.slice(0, 4).toString('utf8');
            console.log('[PrintPdf] pdfbin header:', pdfHeader);
            
            if (pdfHeader === '%PDF') {
                // The pdfBin is already a complete PDF! Just send it
                console.log('[PrintPdf] pdfbin is already a complete PDF, sending directly');
                res.writeHead(200, {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': `attachment; filename="${filename}.pdf"`,
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(pdfBin);
                return;
            }
            
            // Otherwise, we need to use x2t to convert
            if (!x2tReady) {
                throw new Error('Converter not ready');
            }
            
            if (!docBin) {
                throw new Error('Need docbin for x2t conversion (pdfbin is not a complete PDF)');
            }
            
            // Initialize working directory
            initWorkDir();
            
            // Write both files to WASM filesystem
            x2t.FS.writeFile('/working/input.bin', docBin);
            x2t.FS.writeFile('/working/pdf.bin', pdfBin);
            
            // Write cached images to WASM filesystem for PDF embedding
            // Images are stored as data URLs in global.imageCache during document open
            if (global.imageCache && Object.keys(global.imageCache).length > 0) {
                try {
                    x2t.FS.mkdir('/working/media');
                } catch (e) {}
                for (const [name, imgData] of Object.entries(global.imageCache)) {
                    try {
                        x2t.FS.writeFile(`/working/media/${name}`, imgData.data);
                        console.log('[PrintPdf] Written image:', name, imgData.data.length, 'bytes');
                    } catch (e) {
                        console.log('[PrintPdf] Failed to write image:', name, e.message);
                    }
                }
            }
            
            console.log('[PrintPdf] Written files to WASM FS');
            
            // Create conversion params for PDF output
            const params = `<?xml version="1.0" encoding="utf-8"?>
<TaskQueueDataConvert xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <m_sFontDir>/working/fonts/</m_sFontDir>
  <m_sThemeDir>/working/themes</m_sThemeDir>
  <m_sFileFrom>/working/input.bin</m_sFileFrom>
  <m_sFileTo>/working/output.pdf</m_sFileTo>
  <m_bIsNoBase64>false</m_bIsNoBase64>
</TaskQueueDataConvert>`;
            
            x2t.FS.writeFile('/working/params.xml', params);
            
            console.log('[PrintPdf] Running x2t conversion...');
            const result = x2t.ccall("main1", "number", ["string"], ["/working/params.xml"]);
            
            console.log('[PrintPdf] x2t result:', result);
            
            if (result !== 0) {
                throw new Error('PDF conversion failed with code: ' + result);
            }
            
            // Read output PDF
            const pdfData = x2t.FS.readFile('/working/output.pdf');
            console.log('[PrintPdf] Generated PDF:', pdfData.length, 'bytes');
            
            // Send PDF back
            res.writeHead(200, {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${filename}.pdf"`,
                'Access-Control-Allow-Origin': '*'
            });
            res.end(Buffer.from(pdfData));
            
        } catch (err) {
            console.error('[PrintPdf] Error:', err);
            res.writeHead(500, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify({ error: err.message }));
        }
    });
}

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
