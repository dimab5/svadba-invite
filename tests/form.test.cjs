'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalize, message, endpoint, submit } = require('../dist/form-core.js');
function data(fields) { const d = new FormData(); for (const [key, val] of Object.entries(fields)) for (const v of Array.isArray(val) ? val : [val]) d.append(key, v); return d; }
test('the simplified family reply retains all names without inventing a registry answer', async () => {
  const guest = normalize(data({ name:'Тест', attendance:'no', guests:'  Тестовая семья  ' }));
  assert.equal(guest.guests, 'Тестовая семья');
  assert.match(message(guest), /Семья, пара и пожелания по приглашению: Тестовая семья/);
  assert.doesNotMatch(message(guest), /Роспись 7 июля|Ночёвка/);
  await submit('https://formspree.io/f/test123', guest, async (url, options) => {
    assert.equal(options.body.get('guests'), 'Тестовая семья');
    assert.equal(options.body.has('registry'), false);
    assert.equal(options.body.has('overnight'), false);
    return {ok:true,json:async()=>({ok:true})};
  });
});
test('declining the banquet can still confirm the registry ceremony without sending stale food or overnight fields', () => {
  const guest = normalize(data({ name:'  Тестовый гость  ', attendance:'no', registry:'yes', overnight:'Да, остаёмся', drinks:['Вино'], notes:'Не отправлять' }));
  assert.equal(guest.name, 'Тестовый гость');
  assert.equal(guest.registry, true);
  assert.equal(guest.overnight, undefined);
  assert.doesNotMatch(message(guest), /Ночёвка|Вино|Не отправлять/);
  assert.match(message(guest), /Роспись 7 июля: Планирую прийти/);
});
test('blank names and missing attendance are rejected; no-alcohol excludes stale alcoholic selections', () => {
  assert.throws(() => normalize(data({ name:'   ', attendance:'yes' })));
  assert.throws(() => normalize(data({ name:'Тест' })));
  const guest = normalize(data({ name:'Тест',attendance:'yes',drinks:['Вино','Без алкоголя'] }));
  assert.deepEqual(guest.drinks, ['Без алкоголя']);
});
test('only a confirmed Formspree response produces submission success', async () => {
  const guest = normalize(data({ name:'Тест',attendance:'yes' }));
  assert.equal(await submit('https://formspree.io/f/test123', guest, async (url, options) => {
    assert.equal(options.method, 'POST'); assert.equal(options.headers.Accept,'application/json');
    assert.equal(options.body.get('name'),'Тест');
    return {ok:true,json:async()=>({ok:true})};
  }), true);
  for (const response of [{ok:false,json:async()=>({ok:false})},{ok:true,json:async()=>({errors:['Not accepted']})},{ok:true,json:async()=>{throw new Error('Invalid body');}}]) {
    await assert.rejects(submit('https://formspree.io/f/test123',guest,async()=>response));
  }
  await assert.rejects(submit('https://formspree.io/f/test123',guest,async()=>{throw new Error('Offline');}));
});
test('service endpoint cannot be a credential URL, unrelated host or insecure transport', () => {
  for (const value of ['','http://formspree.io/f/test123','https://user:secret@formspree.io/f/test123','https://example.org/f/test123','https://formspree.io/f/test123?key=1','javascript:alert(1)']) assert.equal(endpoint(value),null);
  assert.equal(endpoint('https://formspree.io/f/test123'),'https://formspree.io/f/test123');
});
