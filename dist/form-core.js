(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.WeddingForm = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const labels = { yes: 'С удовольствием придём!', no: 'К сожалению, не сможем прийти.', maybe: 'Пока не можем подтвердить присутствие.' };
  function normalize(data) {
    const name = String(data.get('name') || '').trim().slice(0, 150);
    if (!name) throw new Error('Пожалуйста, укажите имя и фамилию.');
    const attendance = String(data.get('attendance') || '');
    if (!Object.hasOwn(labels, attendance)) throw new Error('Пожалуйста, выберите, сможете ли вы прийти.');
    const guest = { name, attendance, guests: String(data.get('guests') || '').trim().slice(0, 300) };
    if (data.has('registry')) guest.registry = data.get('registry') === 'yes';
    if (attendance !== 'no') {
      guest.overnight = String(data.get('overnight') || 'Не остаёмся');
      const drinks = [...new Set(data.getAll('drinks').map(String))];
      guest.drinks = drinks.includes('Без алкоголя') ? ['Без алкоголя'] : drinks;
      guest.notes = String(data.get('notes') || '').trim().slice(0, 1500);
    }
    return guest;
  }
  function message(guest) {
    const lines = ['Дима и Алина, наш ответ на приглашение:', '', 'Имя: ' + guest.name, 'Праздник 8 июля: ' + labels[guest.attendance]];
    if (typeof guest.registry === 'boolean') lines.push('Роспись 7 июля: ' + (guest.registry ? 'Планирую прийти' : 'Не планирую'));
    if (guest.guests) lines.push('Семья, пара и пожелания по приглашению: ' + guest.guests);
    if (guest.attendance !== 'no') {
      lines.push('Ночёвка: ' + guest.overnight);
      if (guest.drinks.length) lines.push('Напитки: ' + guest.drinks.join(', '));
      if (guest.notes) lines.push('Особенности питания и пожелания: ' + guest.notes);
    }
    return lines.join('\n');
  }
  function endpoint(value) {
    try {
      const u = new URL(value);
      return u.protocol === 'https:' && u.hostname === 'formspree.io' && /^\/f\/[a-z0-9]+\/?$/i.test(u.pathname) && !u.username && !u.password && !u.search && !u.hash ? u.href : null;
    } catch { return null; }
  }
  async function submit(url, guest, send) {
    const target = endpoint(url);
    if (!target) throw new Error('Не удалось подключиться к форме. Сообщите нам в личном сообщении.');
    const payload = new FormData();
    payload.set('name', guest.name);
    payload.set('attendance', labels[guest.attendance]);
    if (typeof guest.registry === 'boolean') payload.set('registry', guest.registry ? 'Да' : 'Нет');
    payload.set('guests', guest.guests);
    if (guest.attendance !== 'no') {
      payload.set('overnight', guest.overnight);
      payload.set('drinks', guest.drinks.join(', '));
      payload.set('notes', guest.notes);
    }
    payload.set('message', message(guest));
    payload.set('_subject', 'Ответ на свадебное приглашение: ' + guest.name);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await (send || fetch)(target, { method: 'POST', body: payload, headers: { Accept: 'application/json' }, signal: controller.signal });
      const result = await response.json();
      if (!response.ok || result.ok !== true) throw new Error('Сервис не подтвердил приём ответа.');
      return true;
    } finally { clearTimeout(timer); }
  }
  return { normalize, message, endpoint, submit };
});
