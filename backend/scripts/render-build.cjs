const fs = require('fs');
const path = require('path');

const distDir = path.resolve(__dirname, '..', 'dist');
const distIndex = path.join(distDir, 'index.js');

fs.mkdirSync(distDir, { recursive: true });
fs.writeFileSync(
  distIndex,
  "require('./src/server.js');\n",
  'utf8'
);

console.log('Render shim generated at dist/index.js');
