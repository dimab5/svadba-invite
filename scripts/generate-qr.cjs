'use strict';
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const qrcode = require('../dist/vendor/qrcode-generator.cjs');

function createMatrix(url) {
  const qr = qrcode(0, 'M');
  qr.addData(url, 'Byte');
  qr.make();
  const count = qr.getModuleCount();
  return Array.from({ length: count }, (_, row) => Array.from({ length: count }, (_, col) => qr.isDark(row, col)));
}
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, crc]);
}
function renderPng(matrix, scale = 20, quiet = 4) {
  const size = (matrix.length + 2 * quiet) * scale;
  const stride = 1 + size * 3;
  const raw = Buffer.alloc(stride * size, 255);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0;
    const row = Math.floor(y / scale) - quiet;
    for (let x = 0; x < size; x++) {
      const col = Math.floor(x / scale) - quiet;
      const black = row >= 0 && col >= 0 && row < matrix.length && col < matrix.length && matrix[row][col];
      if (black) raw.fill(0, y * stride + 1 + x * 3, y * stride + 4 + x * 3);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 2;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
function renderSvg(matrix, quiet = 4) {
  const size = matrix.length + quiet * 2;
  let cells = '';
  matrix.forEach((row, y) => row.forEach((black, x) => { if (black) cells += `M${x + quiet} ${y + quiet}h1v1h-1z`; }));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><title>Приглашение на свадьбу Алины и Дмитрия</title><rect width="${size}" height="${size}" fill="#fff"/><path d="${cells}" fill="#000"/></svg>\n`;
}
function validateUrl(value) {
  if (!value) throw new Error('Укажите полный адрес сайта: node scripts/generate-qr.cjs https://your-site.example/');
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Нужен адрес http(s) без логина и пароля.');
  if (url.search || url.hash) throw new Error('Используйте постоянный адрес главной страницы без параметров и якоря.');
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return url.href;
}
function generate(urlValue, outputDir = path.resolve(__dirname, '../dist/qr')) {
  const url = validateUrl(urlValue);
  const matrix = createMatrix(url);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'invitation.png'), renderPng(matrix));
  fs.writeFileSync(path.join(outputDir, 'invitation.svg'), renderSvg(matrix));
  fs.writeFileSync(path.join(outputDir, 'url.txt'), url + '\n');
  fs.writeFileSync(path.join(outputDir, 'url.json'), JSON.stringify({ url }, null, 2) + '\n');
  if (path.resolve(outputDir) === path.resolve(__dirname, '../dist/qr')) {
    const indexPath = path.resolve(__dirname, '../dist/index.html');
    let html = fs.readFileSync(indexPath, 'utf8');
    html = html.replace(/\s*<meta property="og:url"[^>]*>/g, '').replace(/\s*<link rel="canonical"[^>]*>/g, '');
    html = html.replace('</head>', `  <meta property="og:url" content="${url}">\n  <link rel="canonical" href="${url}">\n</head>`);
    fs.writeFileSync(indexPath, html);
  }
  return { url, outputDir, modules: matrix.length };
}
if (require.main === module) {
  try { console.log(JSON.stringify(generate(process.argv[2] || process.env.SITE_URL, process.argv[3]), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { createMatrix, renderPng, renderSvg, validateUrl, generate };
