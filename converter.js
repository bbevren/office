const path = require('path');
const fs = require('fs');

// Detailed logging
const DEBUG = true;
function log(message, data = null) {
  if (DEBUG) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
    if (data) console.log('  →', data);
  }
}

log('Loading x2t wasm module...');
const x2t = require('./x2t');
log('x2t module loaded');

let wasmInitialized = false;
let initPromise = null;

// Initialize wasm runtime
const initWasm = () => {
  if (initPromise) {
    log('WASM initialization already in progress');
    return initPromise;
  }
  
  initPromise = new Promise((resolve, reject) => {
    if (wasmInitialized) {
      log('WASM already initialized');
      resolve();
      return;
    }
    
    log('Starting WASM initialization...');
    x2t.onRuntimeInitialized = () => {
      wasmInitialized = true;
      log('✓ WASM runtime initialized successfully');
      resolve();
    };
    
    // Set a timeout in case initialization fails
    setTimeout(() => {
      if (!wasmInitialized) {
        log('ERROR: WASM initialization timeout', null);
        reject(new Error('WASM initialization timeout'));
      }
    }, 10000);
  });
  
  return initPromise;
};

// Format ID mappings
const getFormatId = (ext) => {
  const formats = {
    // Documents
    'docx': 65,
    'doc': 66,
    'odt': 67,
    'txt': 69,
    'html': 70,
    // Spreadsheets
    'xlsx': 257,
    'xls': 258,
    'ods': 259,
    'csv': 260,
    // Presentations
    'pptx': 129,
    'ppt': 130,
    'odp': 131,
    // PDF (output only for most conversions)
    'pdf': 513,
    // Binary intermediate format
    'bin': 8192
  };
  return formats[ext];
};

// Initialize working directory in the wasm filesystem
const initWorkDir = () => {
  log('Initializing work directory...');
  
  // Clean up /working
  try {
    if (x2t.FS.analyzePath('/working').exists) {
      log('  Cleaning /working directory');
      removeRecursive(x2t.FS, '/working');
    }
  } catch (e) {
    log('  Note: /working cleanup issue (normal on first run)', e.message);
  }
  
  // Clean up /tmp
  try {
    if (x2t.FS.analyzePath('/tmp').exists) {
      log('  Cleaning /tmp directory');
      removeRecursive(x2t.FS, '/tmp');
    }
  } catch (e) {
    log('  Note: /tmp cleanup issue (normal on first run)', e.message);
  }
  
  // Create fresh directories
  log('  Creating fresh directory structure...');
  try { x2t.FS.mkdir('/tmp'); } catch (e) {}
  try { x2t.FS.mkdir('/working'); } catch (e) {}
  try { x2t.FS.mkdir('/working/media'); } catch (e) {}
  try { x2t.FS.mkdir('/working/fonts'); } catch (e) {}
  try { x2t.FS.mkdir('/working/themes'); } catch (e) {}
  
  log('✓ Work directory initialized');
};

// Remove directory recursively
const removeRecursive = (FS, p) => {
  if (!FS.analyzePath(p).exists) {
    return;
  }
  if (FS.isDir(FS.stat(p).mode)) {
    FS.readdir(p)
      .filter(e => e !== '.' && e !== '..')
      .forEach(e => removeRecursive(FS, path.join(p, e)));
    if (p !== '/') {
      FS.rmdir(p);
    }
  } else {
    FS.unlink(p);
  }
};

// Copy file from Node.js filesystem to wasm filesystem
const copyToWasm = (nodePath, wasmPath) => {
  const data = fs.readFileSync(nodePath);
  const stream = x2t.FS.open(wasmPath, 'w');
  x2t.FS.write(stream, data, 0, data.length, 0);
  x2t.FS.close(stream);
};

// Copy file from wasm filesystem to Node.js filesystem
const copyFromWasm = (wasmPath, nodePath) => {
  const data = x2t.FS.readFile(wasmPath, { encoding: 'binary' });
  fs.writeFileSync(nodePath, data);
};

// Convert file using x2t
const convert = (inputPath, outputPath) => {
  log('=== Starting Conversion ===');
  log(`Input: ${inputPath}`);
  log(`Output: ${outputPath}`);
  
  initWorkDir();
  
  const inputName = path.basename(inputPath);
  const outputName = path.basename(outputPath);
  const inputFormat = path.extname(inputPath).substring(1);
  const outputFormat = path.extname(outputPath).substring(1);
  
  log(`Input format: ${inputFormat}`);
  log(`Output format: ${outputFormat}`);
  log(`Input filename: ${inputName}`);
  log(`Output filename: ${outputName}`);
  
  console.log(`\n🔄 Converting ${inputPath} -> ${outputPath}`);
  
  // Create x2t params XML
  const params = `<?xml version="1.0" encoding="utf-8"?>
<TaskQueueDataConvert xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <m_sFontDir>/working/fonts/</m_sFontDir>
  <m_sThemeDir>/working/themes</m_sThemeDir>
  <m_sFileFrom>/working/${inputName}</m_sFileFrom>
  <m_sFileTo>/working/${outputName}</m_sFileTo>
  <m_bIsNoBase64>false</m_bIsNoBase64>
  <m_nCsvTxtEncoding>46</m_nCsvTxtEncoding>
  <m_nCsvDelimiter>4</m_nCsvDelimiter>
</TaskQueueDataConvert>`;
  
  log('Creating params.xml in WASM filesystem');
  x2t.FS.writeFile('/working/params.xml', params);
  
  log(`Copying input file to WASM filesystem: ${inputName}`);
  copyToWasm(inputPath, '/working/' + inputName);
  
  log('Running x2t conversion...');
  const result = x2t.ccall("main1", "number", ["string"], ["/working/params.xml"]);
  
  log(`x2t exit code: ${result}`);
  
  if (result !== 0) {
    log(`ERROR: Conversion failed with exit code ${result}`, null);
    throw new Error(`Conversion failed with exit code ${result}`);
  }
  
  log(`Copying output file from WASM filesystem: ${outputName}`);
  copyFromWasm('/working/' + outputName, outputPath);
  
  log('✓ Conversion completed successfully');
  console.log('✅ Conversion successful!\n');
};

// Main conversion function with promise support
const convertFile = async (inputPath, outputPath) => {
  log('convertFile() called');
  log(`  Input: ${inputPath}`);
  log(`  Output: ${outputPath}`);
  
  await initWasm();
  log('WASM ready, starting conversion');
  convert(inputPath, outputPath);
  log('convertFile() completed');
};

module.exports = {
  convertFile,
  getFormatId
};
