(() => {
  'use strict';
  const config = window.WEDDING;
  if (!config) return;
  const $ = id => document.getElementById(id);
  const safeLink = value => {
    try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) ? u.href : null; }
    catch { return null; }
  };
  function palette(id, colors) {
    colors.forEach(color => {
      const li = document.createElement('li');
      const swatch = document.createElement('span');
      swatch.className = 'color-swatch';
      swatch.style.backgroundColor = color.hex;
      swatch.setAttribute('aria-hidden', 'true');
      const name = document.createElement('span');
      name.className = 'color-name';
      name.textContent = color.name;
      li.append(swatch, name);
      $(id).append(li);
    });
  }
  palette('women-palette', config.womenColors);
  palette('men-palette', config.menColors);
  $('venue-address').textContent = config.address;
  const map = safeLink(config.mapUrl);
  if (map) $('map-link').href = map;
  const contact = safeLink(config.contactUrl);
  if (contact) { $('contact-link').href = contact; $('contact-link').textContent = config.contactLabel + ' ↗'; $('contact-link').hidden = false; }
  const formLink = safeLink(config.rsvpFormUrl);
  if (formLink) {
    $('guest-form').hidden = true;
    $('external-rsvp').hidden = false;
    $('external-form-link').href = formLink;
    $('external-form-link').target = '_blank';
    $('external-form-link').rel = 'noopener noreferrer';
  }
  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      try { await navigator.clipboard.writeText(text); return true; } catch { /* Try the local fallback. */ }
    }
    const area = document.createElement('textarea');
    area.value = text; area.style.position = 'fixed'; area.style.top = '0'; area.style.left = '-9999px';
    area.setAttribute('aria-label', 'Текст для копирования');
    document.body.append(area); area.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { /* The browser may prohibit copying. */ }
    area.remove(); return ok;
  }
  $('copy-address').addEventListener('click', async () => {
    $('copy-status').textContent = await copyText(config.address) ? 'Адрес скопирован' : 'Выделите и скопируйте адрес выше';
  });
  const target = new Date(config.familyDate).getTime();
  let timer;
  function updateCountdown() {
    const remaining = Math.max(0, target - Date.now());
    const total = Math.floor(remaining / 1000);
    const values = { days: Math.floor(total / 86400), hours: Math.floor(total / 3600) % 24, minutes: Math.floor(total / 60) % 60, seconds: total % 60 };
    for (const [key, value] of Object.entries(values)) document.querySelector('[data-count="' + key + '"]').textContent = String(value).padStart(2, '0');
    if (!remaining) {
      $('countdown').setAttribute('aria-label', 'Мы стали семьёй 7 июля 2027');
      $('countdown').previousElementSibling.textContent = 'Мы стали семьёй · 07.07.2027';
      if (timer) clearInterval(timer);
    }
  }
  updateCountdown();
  if (Date.now() < target) timer = setInterval(updateCountdown, 1000);
  const form = $('guest-form');
  function attendanceChanged() {
    const absent = form.elements.attendance.value === 'no';
    $('attending-fields').hidden = absent;
    $('attending-fields').querySelectorAll('input, select, textarea').forEach(el => { el.disabled = absent; });
  }
  form.querySelectorAll('[name="attendance"]').forEach(input => input.addEventListener('change', attendanceChanged));
  form.querySelectorAll('[name="drinks"]').forEach(input => input.addEventListener('change', () => {
    if (!input.checked) return;
    const sober = input.value === 'Без алкоголя';
    form.querySelectorAll('[name="drinks"]').forEach(other => { if (other !== input && (sober || other.value === 'Без алкоголя')) other.checked = false; });
  }));
  let reply = '';
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const name = String(data.get('name') || '').trim();
    if (!name) { form.elements.name.setCustomValidity('Пожалуйста, укажите имя'); form.elements.name.reportValidity(); return; }
    const labels = { yes: 'С удовольствием придём!', no: 'К сожалению, не сможем прийти.', maybe: 'Пока не можем подтвердить присутствие.' };
    const lines = ['Алина и Дима, наш ответ на приглашение на 8 июля 2027:', '', 'Имя: ' + name, labels[data.get('attendance')]];
    if (data.get('attendance') !== 'no') {
      const guests = String(data.get('guests') || '').trim();
      if (guests) lines.push('Другие приглашённые: ' + guests);
      lines.push('Ночёвка: ' + data.get('overnight'));
      const drinks = data.getAll('drinks');
      if (drinks.length) lines.push('Напитки: ' + drinks.join(', '));
      const notes = String(data.get('notes') || '').trim();
      if (notes) lines.push('Особенности питания и пожелания: ' + notes);
    }
    reply = lines.join('\n');
    $('reply-text').textContent = reply;
    form.hidden = true;
    $('reply-result').hidden = false;
    $('reply-status').textContent = '';
    $('share-reply').hidden = typeof navigator.share !== 'function';
    $('reply-result').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
  });
  form.elements.name.addEventListener('input', () => form.elements.name.setCustomValidity(''));
  $('edit-reply').addEventListener('click', () => { $('reply-result').hidden = true; form.hidden = false; form.elements.name.focus(); });
  $('copy-reply').addEventListener('click', async () => { $('reply-status').textContent = await copyText(reply) ? 'Ответ скопирован. Вставьте его в ваш чат с Алиной или Димой.' : 'Не удалось скопировать автоматически. Выделите текст ответа выше.'; });
  $('share-reply').addEventListener('click', async () => {
    try { await navigator.share({ title: 'Ответ на свадебное приглашение', text: reply }); }
    catch (error) { if (error.name !== 'AbortError') $('reply-status').textContent = 'Можно скопировать ответ и отправить его в ваш чат.'; }
  });
})();
