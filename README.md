# OnlyOffice Serverless Editor

Complete OnlyOffice setup running **serverless** with **x2t-wasm** converter.

✨ Create and edit Office documents (Word, Excel, PowerPoint) directly in your browser  
🚀 No backend server required - runs entirely client-side  
🔄 Built-in format conversion (DOCX, XLSX, PPTX, ODT, ODS, ODP, PDF, TXT)

## Features

- **Web Editors**: Full OnlyOffice UI from CryptPad v8.3.3.23+5 (patched)
- **File Converter**: x2t-wasm v8.3.0+0 for format conversion
- **Serverless**: No document server needed
- **Simple**: Node.js built-in HTTP server (zero dependencies)

## Quick Start

### 1. Download OnlyOffice

Run the setup script to download CryptPad's patched OnlyOffice v8.3:

```powershell
.\setup.ps1
```

This downloads:
- OnlyOffice Web Editors v8.3.3.23+5 (~50MB)
- Verifies SHA512 checksum
- Extracts to `public/onlyoffice/v8/`

### 2. Start the Server

```bash
npm start
```

### 3. Open in Browser

Navigate to: **http://localhost:8080**

You'll see three buttons:
- 📝 **New Document** - Create Word documents
- 📊 **New Spreadsheet** - Create Excel spreadsheets  
- 📽️ **New Presentation** - Create PowerPoint presentations

## What You Get

### Web Editor UI
- Full OnlyOffice editor interface
- Word processing, spreadsheets, presentations
- Formatting tools, styles, templates
- Save files locally
- Convert between formats

### x2t-wasm Converter
Already included and working!

Convert between formats:
```bash
npm run convert
```

Supports:
- **Documents**: DOCX, ODT, TXT, HTML, PDF
- **Spreadsheets**: XLSX, ODS, CSV
- **Presentations**: PPTX, ODP

## Project Structure

```
onlyofficewasm/
├── public/
│   ├── index.html              # Web editor interface
│   └── onlyoffice/
│       └── v8/                 # OnlyOffice editors (after setup)
│           └── web-apps/
├── x2t/
│   ├── x2t.js                  # x2t-wasm v8.3.0+0
│   └── x2t.wasm                # Converter WASM (64MB)
├── converter.js                # File conversion module
├── example.js                  # Conversion examples
├── server.js                   # HTTP server
├── setup.ps1                   # OnlyOffice download script
└── package.json
```

## Why This Setup?

### CryptPad's Patched Version
- Modified to work **without** OnlyOffice Document Server
- Runs entirely in browser (serverless)
- Compatible with x2t-wasm v8.3
- Source: https://github.com/cryptpad/onlyoffice-editor

### x2t-wasm v8.3
- WebAssembly conversion engine
- Converts between Office formats
- Runs in Node.js (no dependencies)
- Source: https://github.com/cryptpad/onlyoffice-x2t-wasm

## Version Compatibility

✅ **OnlyOffice v8.3.3.23+5** (web editors)  
✅ **x2t-wasm v8.3.0+0** (converter)

Both from CryptPad - guaranteed compatible!

## How It Works

1. **Client-side editing**: OnlyOffice runs entirely in browser
2. **Local saving**: Files saved to browser's download folder
3. **Format conversion**: x2t-wasm converts between formats
4. **Zero backend**: Simple HTTP server serves static files

No databases, no document server, no complex setup!

## Examples

### Create a Document
1. Click "📝 New Document"
2. Type your content
3. Click "💾 Save" to download

### Convert a File (CLI)
```javascript
const converter = require('./converter');
await converter.convertFile('input.txt', 'output.docx');
```

Supported conversions:
- TXT → DOCX, ODT
- DOCX → PDF, ODT, TXT
- XLSX → ODS, CSV
- PPTX → ODP

## Troubleshooting

### "File not found: /onlyoffice/..."
Run `.\setup.ps1` first to download OnlyOffice

### Editor not loading
Check browser console for errors. Make sure:
- `public/onlyoffice/v8/` exists
- Contains `web-apps/apps/api/documents/api.js`

### Conversion fails
Check that `x2t/x2t.wasm` exists (64MB file)

## Tech Stack

- **OnlyOffice**: CryptPad's patched v8.3.3.23+5
- **x2t-wasm**: v8.3.0+0 converter
- **Node.js**: Built-in HTTP server
- **WebAssembly**: File conversion engine
- **Zero dependencies**: No npm packages needed!

## License

MIT

## Credits

- **OnlyOffice**: https://github.com/ONLYOFFICE
- **CryptPad**: https://github.com/cryptpad (patched versions)
- **x2t-wasm**: https://github.com/cryptpad/onlyoffice-x2t-wasm

---

**Ready to create office documents!** 🎉

Run `.\setup.ps1` → `npm start` → Open http://localhost:8080

