# Quick Start Guide

## What is this?

**OnlyOffice x2t-wasm** - A simple, serverless file converter that runs in Node.js.

Convert between office formats **without a server**:
- Word: DOCX ↔ DOC ↔ ODT ↔ TXT
- Excel: XLSX ↔ XLS ↔ ODS ↔ CSV
- PowerPoint: PPTX ↔ PPT ↔ ODP

Everything runs **100% offline** using WebAssembly!

## Try it now (Already Set Up!)

```bash
node example.js
```

Watch the detailed logs to see:
- WASM initialization
- File system operations
- Conversion progress
- Success/error messages

## Use in your code

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
✅ **Simple** - No dependencies to install

## Versions

- **OnlyOffice x2t**: v8.3.0.91
- **x2t-wasm build**: v8.3.0+0 (September 2024)

Based on [CryptPad's OnlyOffice x2t-wasm](https://github.com/cryptpad/onlyoffice-x2t-wasm)
