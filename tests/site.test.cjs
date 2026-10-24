'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const zlib = require('node:zlib');
const vm = require('node:vm');
const { createMatrix, renderPng, validateUrl, generate } = require('../scripts/generate-qr.cjs');
const decode = require('./jsqr.cjs');
const root = path.resolve(__dirname, '..');
function decodePng(png) {
  let offset = 8, width, height;
  const parts = [];
  while (offset < png.length) {
    const len = png.readUInt32BE(offset), type = png.toString('ascii', offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + len);
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); }
    if (type === 'IDAT') parts.push(data);
    offset += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(parts));
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const a = y * (1 + width * 3) + 1 + x * 3, b = (y * width + x) * 4;
    rgba[b] = raw[a]; rgba[b + 1] = raw[a + 1]; rgba[b + 2] = raw[a + 2]; rgba[b + 3] = 255;
  }
  return decode(rgba, width, height);
}
test('QR decodes to the exact public URL including project subpath', () => {
  for (const url of ['https://example.github.io/alina-dmitry-wedding/', 'https://wedding.example.org/']) {
    const qr = decodePng(renderPng(createMatrix(url), 8));
    assert.ok(qr, 'QR must be readable');
    assert.equal(qr.data, url);
  }
});
test('QR generation rejects missing, credentialed and non-http URLs', () => {
  for (const value of ['', 'file:///tmp/index.html', 'javascript:alert(1)', 'https://user:secret@example.org/', 'https://example.org/?key=1']) assert.throws(() => validateUrl(value));
  assert.equal(validateUrl('https://example.org/wedding'), 'https://example.org/wedding/');
});
test('generated PNG, SVG and URL file agree', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'wedding-qr-'));
  try {
    const result = generate('https://example.org/wedding/', temp);
    assert.equal(JSON.parse(fs.readFileSync(path.join(temp, 'url.json'))).url, result.url);
    assert.equal(decodePng(fs.readFileSync(path.join(temp, 'invitation.png'))).data, result.url);
    assert.match(fs.readFileSync(path.join(temp, 'invitation.svg'), 'utf8'), /viewBox=/);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});
test('site local links, anchors and assets exist', () => {
  const html = fs.readFileSync(path.join(root, 'dist/index.html'), 'utf8');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set(ids).size, ids.length, 'No duplicate IDs');
  for (const [, link] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (link.startsWith('#') && link.length > 1) assert.ok(ids.includes(link.slice(1)), 'Anchor exists: ' + link);
    if (link.startsWith('./')) assert.ok(fs.existsSync(path.join(root, 'dist', link.slice(2))), 'Asset exists: ' + link);
  }
  assert.match(html, /07\.07\.2027/);
  assert.match(html, /8 июля 2027 · 17:00/);
});
test('palette contains five female and three male colors and valid event dates', () => {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'dist/site-config.js'), 'utf8'), context);
  const c = context.window.WEDDING;
  assert.equal(c.womenColors.length, 5); assert.equal(c.menColors.length, 3);
  for (const color of [...c.womenColors, ...c.menColors]) assert.match(color.hex, /^#[0-9A-F]{6}$/);
  assert.ok(new Date(c.familyDate) < new Date(c.celebrationDate));
  assert.equal(new Date(c.celebrationDate).toISOString(), '2027-07-08T14:00:00.000Z');
});
