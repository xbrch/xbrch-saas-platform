const http = require('http');
const fs = require('fs');
const path = require('path');

const port = 8000;
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.woff': 'application/font-woff',
  '.ttf': 'application/font-ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'application/font-otf',
  '.wasm': 'application/wasm'
};

const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);

  // Handle root request
  if (req.url === '/') {
    req.url = '/index.html';
  }

  const filePath = path.join(__dirname, req.url);
  const extname = String(path.extname(filePath)).toLowerCase();
  const mimeType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        // File not found
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 Not Found</h1><p>The requested file was not found.</p>', 'utf-8');
      } else {
        // Server error
        res.writeHead(500);
        res.end(`Server Error: ${error.code}`, 'utf-8');
      }
    } else {
      // Success
      res.writeHead(200, { 'Content-Type': mimeType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(port, () => {
  console.log(`🚀 XBRCH Platform Server running at:`);
  console.log(`📱 Local:   http://localhost:${port}`);
  console.log(`🌐 Network: http://0.0.0.0:${port}`);
  console.log(``);
  console.log(`🎯 Test these URLs:`);
  console.log(`   Demo: http://localhost:${port}/demo.html`);
  console.log(`   Login: http://localhost:${port}/admin-dashboard/login.html`);
  console.log(`   Register: http://localhost:${port}/admin-dashboard/register.html`);
  console.log(`   Dashboard: http://localhost:${port}/admin-dashboard/index.html`);
  console.log(`   Broadcast: http://localhost:${port}/admin-dashboard/broadcast.html`);
  console.log(`   Analytics: http://localhost:${port}/admin-dashboard/analytics.html`);
  console.log(`   Wall: http://localhost:${port}/public/broadcast-wall.html`);
  console.log(``);
  console.log(`📝 Press Ctrl+C to stop the server`);
  console.log(`🌍 Opening browser in 3 seconds...`);
});

// Open browser after 3 seconds
setTimeout(() => {
  const { exec } = require('child_process');
  const url = `http://localhost:${port}`;
  
  switch (process.platform) {
    case 'win32':
      exec(`start ${url}`);
      break;
    case 'darwin':
      exec(`open ${url}`);
      break;
    default:
      exec(`xdg-open ${url}`);
  }
}, 3000);
