#!/usr/bin/env node
const http = require('http');

const postData = 'TESTBODY';

const options = {
  hostname: 'localhost',
  port: 8080,
  path: '/onlyoffice/v8/downloadas/test',
  method: 'POST',
  headers: {
    'Content-Type': 'application/octet-stream',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('RESPONSE BODY:');
    try {
      console.log(JSON.stringify(JSON.parse(data), null, 2));
    } catch (e) {
      console.log(data);
    }
  });
});

req.on('error', (e) => {
  console.error(`NETWORK ERROR: ${e.message}`);
});

// Write data to request body
req.write(postData);
req.end();

console.log('Sending POST request to /onlyoffice/v8/downloadas/test');
