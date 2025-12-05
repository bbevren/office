# OnlyOffice Serverless Editor

Complete OnlyOffice setup running **serverless** with **x2t-wasm** converter.

✨ Create and edit Office documents (Word, Excel, PowerPoint) directly in your browser  
🚀 No backend server required - runs entirely client-side  
🔄 Built-in format conversion (DOCX, XLSX, PPTX, ODT, ODS, ODP, PDF, TXT)

## Features

- **Web Editors**: Full OnlyOffice UI from CryptPad v8.3.3.23+5 (patched)
- **File Converter**: x2t-wasm v8.3.0+0 for format conversion
- **Serverless**: No document server needed
- **Open & Edit**: Open existing DOCX/XLSX/PPTX files
- **Image Support**: Insert images from file or URL
- **Simple**: Node.js built-in HTTP server (zero dependencies)

## Quick Start

### 1. Clone with Git LFS

This repo uses Git LFS for large files. Make sure you have Git LFS installed:

```bash
git lfs install
git clone https://github.com/bbevren/onlyofficewasm.git
cd onlyofficewasm
```

### 2. Extract OnlyOffice Assets

The OnlyOffice web editors are stored as a compressed archive. Extract them:

```powershell
# Windows PowerShell
.\pack-assets.ps1 -Unpack
```

Or manually extract `onlyoffice-editor.zip` to `public/onlyoffice/`

### 3. Start the Server

```bash
npm start
```

### 4. Open in Browser

Navigate to: **http://localhost:8080**

You'll see:
- 📝 **New Document** - Create Word documents
- 📊 **New Spreadsheet** - Create Excel spreadsheets  
- 📽️ **New Presentation** - Create PowerPoint presentations
- 📂 **Open File** - Open existing documents

## Git LFS Setup

Large files are tracked with Git LFS (see `.gitattributes`):
- `*.zip` - OnlyOffice editor archive
- `*.7z` - Compressed assets
- `x2t.wasm` - Converter (32 MB)
- `x2t.js` - Converter loader (17 MB)

The `public/onlyoffice/` folder (940 MB extracted) is NOT tracked.
Instead, we track the compressed archive and extract it locally.

### For New Developers

After cloning, run the setup script:

```powershell
# Windows
.\setup.ps1

# Linux/Mac
./setup.sh
```

This will:
1. Pull Git LFS files (or download from GitHub releases)
2. Extract OnlyOffice editors to `public/onlyoffice/`
3. Install npm dependencies

### Developer Workflow

When making changes to OnlyOffice editor files:

```powershell
# 1. Edit files in public/onlyoffice/ as needed

# 2. Before committing - create new zip from your changes
.\update-assets.ps1

# 3. Commit and push (LFS handles the large zip)
git add .
git commit -m "Update OnlyOffice assets"
git push
```

### After Reverting a Commit

When you revert/restore HEAD, the zip file reverts but the extracted folder doesn't (it's gitignored). Re-extract the folder:

```powershell
.\update-assets.ps1 -Restore
```

### Asset Management Commands

| Command | Description |
|---------|-------------|
| `.\update-assets.ps1` | Create zip from `public/onlyoffice/` folder |
| `.\update-assets.ps1 -Restore` | Extract zip back to folder (after revert) |
| `.\setup.ps1` | Full setup (download/extract + npm install) |

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

