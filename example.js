const { convertFile } = require('./converter');
const fs = require('fs');
const path = require('path');

// Create sample directory if it doesn't exist
const sampleDir = path.join(__dirname, 'samples');
const outputDir = path.join(__dirname, 'output');

if (!fs.existsSync(sampleDir)) {
  fs.mkdirSync(sampleDir);
}
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

// Example usage
async function runExamples() {
  console.log('OnlyOffice x2t-wasm Converter Example\n');
  
  // Create a simple text file to convert
  const sampleTxtPath = path.join(sampleDir, 'sample.txt');
  const sampleContent = `Hello World!

This is a sample document created with OnlyOffice x2t-wasm.

Features:
- Serverless conversion
- No document server needed
- Runs entirely in Node.js
- Supports multiple formats

Convert this to DOCX, ODT, or any other format!`;

  fs.writeFileSync(sampleTxtPath, sampleContent);
  console.log('✓ Created sample.txt\n');

  // Example 1: Convert TXT to DOCX
  try {
    console.log('Example 1: Converting TXT to DOCX...');
    await convertFile(
      sampleTxtPath,
      path.join(outputDir, 'sample.docx')
    );
    console.log('✓ Created sample.docx\n');
  } catch (error) {
    console.error('Error:', error.message, '\n');
  }

  // Example 2: Convert TXT to ODT
  try {
    console.log('Example 2: Converting TXT to ODT...');
    await convertFile(
      sampleTxtPath,
      path.join(outputDir, 'sample.odt')
    );
    console.log('✓ Created sample.odt\n');
  } catch (error) {
    console.error('Error:', error.message || error, '\n');
  }

  // Example 3: If you have a DOCX file, convert it to ODT
  const docxPath = path.join(sampleDir, 'test.docx');
  if (fs.existsSync(docxPath)) {
    try {
      console.log('Example 3: Converting DOCX to ODT...');
      await convertFile(
        docxPath,
        path.join(outputDir, 'test.odt')
      );
      console.log('✓ Created test.odt\n');
    } catch (error) {
      console.error('Error:', error.message, '\n');
    }
  }

  console.log('Examples completed!');
  console.log(`Check the "${outputDir}" folder for converted files.`);
  console.log('\nTo use in your own code:');
  console.log('  const { convertFile } = require("./converter");');
  console.log('  await convertFile("input.docx", "output.odt");');
}

// Run examples
runExamples().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
