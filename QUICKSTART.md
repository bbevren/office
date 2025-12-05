# Quick Start Guide

## What is this?

**OnlyOffice x2t-wasm** - A serverless OnlyOffice document editor with file conversion.

Features:
- **Web Editor**: Full OnlyOffice document editor running in your browser
- **File Converter**: Convert between office formats using WebAssembly
- **100% Offline**: Everything runs locally, no server needed

Supported formats:
- Word: DOCX ↔ DOC ↔ ODT ↔ TXT
- Excel: XLSX ↔ XLS ↔ ODS ↔ CSV
- PowerPoint: PPTX ↔ PPT ↔ ODP

## First Time Setup

### Option 1: Clone with Git LFS (Recommended)

```bash
# Install Git LFS if you don't have it
git lfs install

# Clone the repository
git clone https://github.com/bbevren/office.git
cd office

# Run setup script
# Windows (PowerShell):
./setup.ps1

# Linux/Mac:
chmod +x setup.sh && ./setup.sh
```

### Option 2: Download Without Git LFS

If you download as a ZIP or don't have Git LFS, the setup script will automatically download the required files from GitHub releases.

```bash
# Windows (PowerShell):
./setup.ps1

# Linux/Mac:
chmod +x setup.sh && ./setup.sh
```

## Start the Editor

```bash
node server.js
```

Then open **http://localhost:8080** in your browser.

## Use the File Converter

```bash
node example.js
```

Or use in your code:

```javascript
const { convertFile } = require('./converter');

// Convert text to Word document
await convertFile('myfile.txt', 'myfile.docx');

// Convert Word to LibreOffice format
await convertFile('document.docx', 'document.odt');

// Convert Excel to OpenDocument
await convertFile('data.xlsx', 'data.ods');
```

## Common conversions

### Create office documents from simple formats
```javascript
await convertFile('notes.txt', 'document.docx');    // Text → Word
await convertFile('data.csv', 'spreadsheet.xlsx');  // CSV → Excel
```

### Convert between office formats
```javascript
await convertFile('document.docx', 'document.odt'); // Word → LibreOffice
await convertFile('sheet.xlsx', 'sheet.ods');       // Excel → Calc
await convertFile('slides.pptx', 'slides.odp');     // PowerPoint → Impress
```

### Convert to legacy formats
```javascript
await convertFile('document.docx', 'document.doc'); // DOCX → DOC
await convertFile('sheet.xlsx', 'sheet.xls');       // XLSX → XLS
await convertFile('slides.pptx', 'slides.ppt');     // PPTX → PPT
```

## What makes this special?

✅ **No server** - Runs entirely in Node.js  
✅ **Offline** - Works without internet  
✅ **Private** - All processing is local  
✅ **Fast** - Native WASM performance  
✅ **Simple** - One setup script does everything

## More Documentation

- **DEVELOPER_GUIDE.txt** - Detailed technical documentation
- **README.md** - Full project overview

## Versions

- **OnlyOffice x2t**: v8.3.0.91
- **x2t-wasm build**: v8.3.0+0 (September 2024)

Based on [CryptPad's OnlyOffice x2t-wasm](https://github.com/cryptpad/onlyoffice-x2t-wasm)
