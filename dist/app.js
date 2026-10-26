(() => {
  'use strict';
  const config = window.WEDDING;
  const core = window.WeddingForm;
  if (!config || !core) return;
  const $ = id => document.getElementById(id);
  const safeLink = value => {
    try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password ? u.href : null; }
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
  for (const [id, value] of [['map-link', config.mapUrl], ['registry-map-link', config.registryMapUrl]]) {
    const url = safeLink(value);
    if (url) $(id).href = url;
  }
  const contact = safeLink(config.contactUrl);
  if (contact) { $('contact-link').href = contact; $('contact-link').textContent = config.contactLabel; $('contact-link').hidden = false; }
  const form = $('guest-form');
  const formLink = safeLink(config.rsvpFormUrl);
  const remote = core.endpoint(config.formEndpoint);
  if (formLink) {
    form.hidden = true;
    $('external-rsvp').hidden = false;
    $('external-form-link').href = formLink;
    $('external-form-link').target = '_blank';
    $('external-form-link').rel = 'noopener noreferrer';
  } else if (remote) {
    $('form-note').textContent = 'Пожалуйста, заполните анкету. Ваш ответ будет отправлен нам.';
    $('submit-reply').textContent = 'Отправить';
  } else if (config.formEndpoint) {
    $('form-note').textContent = 'Подготовьте ответ и отправьте его нам в личные сообщения.';
  }
  const countdownTarget = new Date(config.familyDate).getTime();
  function updateCountdown() {
    const total = Math.max(0, Math.floor((countdownTarget - Date.now()) / 1000));
    const parts = { days: Math.floor(total / 86400), hours: Math.floor(total / 3600) % 24, minutes: Math.floor(total / 60) % 60, seconds: total % 60 };
    for (const [name, value] of Object.entries(parts)) document.querySelector('[data-count="' + name + '"]').textContent = String(value).padStart(2, '0');
    if (!total) {
      $('countdown-caption').textContent = 'День рождения нашей семьи · 07.07.2027';
      $('countdown').setAttribute('aria-label', 'День рождения нашей семьи наступил');
    }
  }
  updateCountdown();
  setInterval(updateCountdown, 1000);
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
  function readGuest() {
    if (!form.reportValidity()) return null;
    try { return core.normalize(new FormData(form)); }
    catch (error) { $('form-status').textContent = error.message; form.elements.name.focus(); return null; }
  }
  function prepareReply(guest) {
    reply = core.message(guest);
    $('reply-text').textContent = reply;
    form.hidden = true;
    $('reply-result').hidden = false;
    $('reply-status').textContent = '';
    $('share-reply').hidden = typeof navigator.share !== 'function';
    $('reply-result').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
  }
  let submitting = false;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submitting) return;
    const guest = readGuest();
    if (!guest) return;
    $('form-status').textContent = '';
    if (!remote) { prepareReply(guest); return; }
    submitting = true;
    $('submit-reply').disabled = true;
    form.setAttribute('aria-busy', 'true');
    $('form-status').textContent = 'Отправляем ваш ответ…';
    $('fallback-reply').hidden = true;
    try {
      await core.submit(remote, guest);
      form.hidden = true;
      $('submit-success').hidden = false;
      $('submit-success').scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch {
      $('form-status').textContent = 'Не удалось подтвердить отправку. Данные остались в анкете: попробуйте снова или отправьте ответ нам в сообщении.';
      $('fallback-reply').hidden = false;
    } finally {
      submitting = false;
      $('submit-reply').disabled = false;
      form.removeAttribute('aria-busy');
    }
  });
  $('fallback-reply').addEventListener('click', () => { const guest = readGuest(); if (guest) prepareReply(guest); });
  $('edit-reply').addEventListener('click', () => { $('reply-result').hidden = true; form.hidden = false; form.elements.name.focus(); });
  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      try { await navigator.clipboard.writeText(text); return true; } catch { /* Use the selection fallback. */ }
    }
    const area = document.createElement('textarea');
    area.value = text; area.style.position = 'fixed'; area.style.left = '-9999px';
    area.setAttribute('aria-label', 'Текст ответа для копирования');
    document.body.append(area); area.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch { /* Browser restriction. */ }
    area.remove(); return ok;
  }
  $('copy-reply').addEventListener('click', async () => { $('reply-status').textContent = await copyText(reply) ? 'Ответ скопирован. Вставьте его в ваш чат с Димой или Алиной.' : 'Выделите текст ответа выше и скопируйте его.'; });
  $('share-reply').addEventListener('click', async () => {
    try { await navigator.share({ title: 'Ответ на свадебное приглашение', text: reply }); }
    catch (error) { if (error.name !== 'AbortError') $('reply-status').textContent = 'Можно скопировать ответ и отправить его в ваш чат.'; }
  });
})();
