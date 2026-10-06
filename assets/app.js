/* MI VIAJE by TODO VIAJES — app del cliente (sin dependencias) */
(function () {
  'use strict';
  const C = window.MV_CONFIG || {};
  const $root = document.getElementById('root');
  const TOKEN_KEY = 'mv_token';
  const S = { token: null, data: null, tab: 'inicio', tripId: null, day: null, login: { paso: 'id' } };
  const REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------------- utilidades ----------------
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const MES3 = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const pDate = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
  const today = () => { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); };
  const diffDays = (a, b) => Math.round((b - a) / 864e5);
  const isoDay = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  // Las horas de vuelos/hoteles se guardan como "hora local del lugar" (UTC sin conversión)
  const segDay = (iso) => iso ? new Date(iso).toISOString().slice(0, 10) : null;
  const segTime = (iso) => { if (!iso) return ''; const d = new Date(iso); let h = d.getUTCHours(); const m = String(d.getUTCMinutes()).padStart(2, '0'); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return `${h}:${m} ${ap}`; };
  const segDate = (iso) => { if (!iso) return ''; const d = new Date(iso); return d.getUTCDate() + ' ' + MES3[d.getUTCMonth()]; };
  function fmtRange(a, b) {
    const x = pDate(a), y = pDate(b);
    if (x.getFullYear() !== y.getFullYear()) return `${x.getDate()} ${MES3[x.getMonth()]} ${x.getFullYear()} – ${y.getDate()} ${MES3[y.getMonth()]} ${y.getFullYear()}`;
    if (x.getMonth() !== y.getMonth()) return `${x.getDate()} ${MES3[x.getMonth()]} – ${y.getDate()} ${MES3[y.getMonth()]} ${y.getFullYear()}`;
    return `${x.getDate()} – ${y.getDate()} de ${MESES[x.getMonth()]} ${x.getFullYear()}`;
  }
  const fmtDay = (s) => { const d = pDate(s); return d.getDate() + ' ' + MES3[d.getMonth()]; };
  function money(n, cur) {
    const v = Number(n || 0);
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: cur || 'MXN', minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 }).format(v);
  }
  const waLink = (num, text) => 'https://wa.me/' + String(num || '').replace(/\D/g, '') + (text ? '?text=' + encodeURIComponent(text) : '');
  const waNum = (n) => { const d = String(n || '').replace(/\D/g, ''); return d.length === 10 ? '52' + d : d; };
  const initial = (s) => esc(String(s || '?').trim().charAt(0).toUpperCase());
  const haptic = () => { try { navigator.vibrate && navigator.vibrate(12); } catch (e) {} };

  // ---------------- iconos (familia única, trazo 1.75) ----------------
  const P = {
    home: '<path d="M3.5 10.5 12 4l8.5 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-4v-5.5h-6v5.5H5A1.5 1.5 0 0 1 3.5 19z"/>',
    ticket: '<path d="M3 8.5V6.5A1.5 1.5 0 0 1 4.5 5h15A1.5 1.5 0 0 1 21 6.5v2a2.5 2.5 0 0 0 0 5v2a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 15.5v-2a2.5 2.5 0 0 0 0-5z"/><path d="M14.5 5v2m0 3v2m0 3v2"/>',
    gift: '<rect x="3.5" y="8.5" width="17" height="4" rx="1"/><path d="M5 12.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-6.5M12 8.5v12M12 8.5S10.8 4 8.3 4a2.2 2.2 0 0 0 0 4.5H12m0 0s1.2-4.5 3.7-4.5a2.2 2.2 0 0 1 0 4.5H12"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c1.4-3.6 4.2-5.5 7.5-5.5s6.1 1.9 7.5 5.5"/>',
    plane: '<path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" fill="currentColor" stroke="none"/>',
    planeLine: '<path d="M2.5 19.5h19M3.8 13.6l2.6 1.9 13.4-4.7a1.6 1.6 0 0 0-1-3l-4.4 1.4-6-4.4-2 .7 3.6 4.8-3.7 1.2L4.2 8.3l-1.5.6z"/>',
    bed: '<path d="M3 18.5V6M3 14h18v4.5M21 14v-2.5a3 3 0 0 0-3-3h-7V14"/><circle cx="7" cy="10.5" r="2"/>',
    van: '<path d="M2.5 16.5V8A1.5 1.5 0 0 1 4 6.5h11l4.5 4.5v5.5H18"/><path d="M2.5 11h17M8 6.5V11"/><circle cx="6.5" cy="17" r="1.8"/><circle cx="16" cy="17" r="1.8"/><path d="M8.3 17h5.9"/>',
    palm: '<path d="M12 21c0-5 .5-8.5 2-11"/><path d="M14 10c-1.5-3-4.5-4-7.5-3 2 .3 3.7 1.6 4.5 3.5M14 10c.8-3 3.5-4.8 6.5-4.2-2 .6-3.5 2.2-4 4.2M14 10c2.7-.6 5.4.7 6.5 3.3-1.7-1-3.8-1.2-5.5-.5M14 10c-2.6-.2-5.2 1.4-6 4 1.5-1 3.5-1.4 5.2-1"/><path d="M5 21h14"/>',
    pin: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
    file: '<path d="M14 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8z"/><path d="M14 3.5V8h4.5M9 13h6M9 16.5h4"/>',
    shield: '<path d="M12 3.5 5 6v5.5c0 4.3 3 7.8 7 9 4-1.2 7-4.7 7-9V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
    badge: '<circle cx="12" cy="12" r="8.5"/><path d="m8.5 12 2.3 2.3 4.7-4.6"/>',
    cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>',
    card: '<rect x="2.5" y="5.5" width="19" height="13" rx="2"/><path d="M2.5 10h19M6.5 15h3"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
    chev: '<path d="m9.5 6 6 6-6 6"/>',
    share: '<path d="M12 3.5v12M7.5 8 12 3.5 16.5 8"/><path d="M5 12.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-6.5"/>',
    copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2"/><path d="M15.5 8.5V5a1.5 1.5 0 0 0-1.5-1.5H5A1.5 1.5 0 0 0 3.5 5v9A1.5 1.5 0 0 0 5 15.5h3.5"/>',
    phone: '<path d="M5 3.5h3l1.5 4-2 1.3a11 11 0 0 0 7.7 7.7l1.3-2 4 1.5v3a1.5 1.5 0 0 1-1.6 1.5A16.5 16.5 0 0 1 3.5 5.1 1.5 1.5 0 0 1 5 3.5z"/>',
    out: '<path d="M14 4.5h4A1.5 1.5 0 0 1 19.5 6v12a1.5 1.5 0 0 1-1.5 1.5h-4M10 16.5 5.5 12 10 7.5M5.5 12H15"/>',
    install: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M12 7.5v7M9 11.5l3 3 3-3"/>',
    spark: '<path d="M12 3.5 13.8 9l5.7 1.5-5.7 1.6L12 17.5l-1.8-5.4L4.5 10.5 10.2 9z"/><path d="M19 3.5v3M17.5 5h3"/>',
    compass: '<circle cx="12" cy="12" r="8.5"/><path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8z"/>',
    users: '<circle cx="9" cy="8.5" r="3.5"/><path d="M2.5 19.5c1-3.2 3.5-5 6.5-5s5.5 1.8 6.5 5M15.5 5.2a3.5 3.5 0 0 1 0 6.6M17.5 14.7c2 .6 3.4 2.2 4 4.8"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.2"/>',
    heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>',
    suitcase: '<rect x="4" y="7" width="16" height="12.5" rx="2"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M9 7v12.5M15 7v12.5"/>'
  };
  const ic = (n, cls) => `<svg class="i ${cls || ''}" viewBox="0 0 24 24" aria-hidden="true">${P[n] || P.info}</svg>`;
  const WA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3a.5.5 0 0 0 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.4-.3z"/></svg>';
  const SEGICON = { vuelo: 'planeLine', hotel: 'bed', traslado: 'van', actividad: 'palm', otro: 'info' };
  const SEGNAME = { vuelo: 'Vuelo', hotel: 'Hospedaje', traslado: 'Traslado', actividad: 'Actividad', otro: 'Información' };
  const DOC = {
    voucher: ['Voucher', 'ticket', '#C02026'], confirmacion: ['Confirmación', 'badge', '#14804A'], boleto: ['Boleto de avión', 'planeLine', '#111214'],
    seguro: ['Seguro de viaje', 'shield', '#1B5E9A'], itinerario: ['Itinerario', 'cal', '#B26A00'], otro: ['Documento', 'file', '#5F636B']
  };

  function toast(msg, icon) {
    const t = document.getElementById('toast');
    t.innerHTML = (icon ? ic(icon, 'sm') : '') + `<span>${esc(msg)}</span>`; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2400);
  }

  async function rpc(fn, args) {
    const r = await fetch(C.SUPABASE_URL + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      headers: Object.assign({ apikey: C.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }, /^ey/.test(C.SUPABASE_ANON_KEY) ? { Authorization: 'Bearer ' + C.SUPABASE_ANON_KEY } : {}),
      body: JSON.stringify(args || {})
    });
    if (!r.ok) throw new Error('No pudimos conectar. Revisa tu internet e intenta de nuevo.');
    const txt = await r.text();
    return txt ? JSON.parse(txt) : null;
  }

  // ---------------- lógica del viaje ----------------
  function stageOf(v) {
    const t = today(), ini = pDate(v.fecha_inicio), fin = pDate(v.fecha_fin);
    const d = diffDays(t, ini), e = diffDays(t, fin);
    if (d > 7) return { k: 'futuro', d };
    if (d >= 1) return { k: 'inminente', d };
    if (d === 0) return { k: 'hoy', d };
    if (e >= 0) return { k: 'durante', dia: -d + 1, total: diffDays(ini, fin) + 1 };
    return { k: 'despues', hace: -e };
  }
  function nextPayment(v) {
    let paid = Number(v.pagado || 0), cum = 0;
    for (const p of v.plan_pagos || []) {
      cum += Number(p.monto);
      if (cum > paid + 0.01) return { fecha: p.fecha, monto: Math.min(Number(p.monto), cum - paid), descripcion: p.descripcion };
    }
    const pend = Number(v.total || 0) - paid;
    return pend > 0.01 ? { fecha: null, monto: pend } : null;
  }
  function progress(v) {
    const st = stageOf(v).k;
    const total = Number(v.total || 0), pag = Number(v.pagado || 0);
    const pagos = total > 0 ? Math.min(1, pag / total) : 1;
    const cl = v.checklist || [];
    const check = cl.length ? cl.filter((c) => c.completado).length / cl.length : 1;
    const docs = (v.documentos || []).length > 0 ? 1 : 0;
    let pct = Math.round(15 + 40 * pagos + 30 * check + 15 * docs);
    const viajando = ['hoy', 'durante', 'despues'].includes(st);
    if (viajando) pct = 100;
    return {
      pct: Math.min(100, pct),
      steps: [{ n: 'Reserva', ok: true }, { n: 'Pagos', ok: pagos >= 0.999 }, { n: 'Docs', ok: !!docs }, { n: 'Listo', ok: check >= 0.999 }, { n: 'Viaje', ok: viajando }]
    };
  }
  function currentTrip() {
    const vs = (S.data && S.data.viajes) || [];
    if (S.tripId) { const f = vs.find((v) => v.id === S.tripId); if (f) return f; }
    const t = today();
    const up = vs.filter((v) => pDate(v.fecha_fin) >= t);
    if (up.length) return up[0];
    const recent = vs.filter((v) => diffDays(pDate(v.fecha_fin), t) <= 30);
    return recent.length ? recent[recent.length - 1] : null;
  }
  const pastTrips = () => ((S.data && S.data.viajes) || []).filter((v) => pDate(v.fecha_fin) < today());
  const upcomingTrips = () => ((S.data && S.data.viajes) || []).filter((v) => pDate(v.fecha_fin) >= today());
  const flightCodes = (s) => { const m = String(s || '').toUpperCase().match(/\b([A-Z]{3})\b[^A-Z]+\b([A-Z]{3})\b/); return m ? [m[1], m[2]] : null; };
  const firstFlight = (v) => (v.segmentos || []).find((s) => s.tipo === 'vuelo');

  function contactInfo(v) {
    const ase = v && v.asesor;
    return { num: waNum((ase && ase.whatsapp) || C.AGENCIA_WHATSAPP), nombre: (ase && ase.nombre) || C.AGENCIA_NOMBRE || 'Todo Viajes', sucursal: ase && ase.sucursal };
  }
  function helpLink(extra) {
    const v = currentTrip(), c = contactInfo(v), nom = S.data ? S.data.cliente.primer_nombre : '';
    const txt = extra || `Hola ${c.nombre.split(' ')[0]}, soy ${nom}.` + (v ? ` Tengo una duda sobre mi viaje a ${v.titulo}.` : '');
    return waLink(c.num, txt);
  }
  function logEvent(ev, det) { if (S.token) rpc('mv_evento', { p_token: S.token, p_evento: ev, p_detalle: det || {} }).catch(() => {}); }

  // =====================================================================
  // LOGIN
  // =====================================================================
  function pinField(name, ac) {
    return `<div class="pin" id="pin"><input class="pin-input" name="${name}" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="${ac}" aria-label="PIN de 4 números"><b></b><b></b><b></b><b></b></div>`;
  }
  function renderLogin() {
    document.body.dataset.tema = 'tropical';
    const L = S.login;
    let card = '';
    if (L.paso === 'id') {
      card = `
        <h2 class="d-lg">Entra a tu viaje</h2>
        <p class="muted" style="margin:0">Usa el nombre y el celular que diste a Todo Viajes.</p>
        <form id="f-id" autocomplete="on" novalidate>
          <label class="field"><span>Nombre completo</span><input name="nombre" autocomplete="name" autocapitalize="words" placeholder="Ej. Erick Pérez Gómez" required value="${esc(L.nombre || '')}"></label>
          <label class="field"><span>Celular</span><input name="celular" type="tel" inputmode="numeric" autocomplete="tel-national" placeholder="10 dígitos" required value="${esc(L.celular || '')}"></label>
          <div class="msg" id="msg" role="alert"></div>
          <button class="btn" type="submit">Continuar ${ic('chev', 'sm')}</button>
        </form>`;
    } else if (L.paso === 'crear' || L.paso === 'confirmar') {
      card = `
        <h2 class="d-lg">${L.paso === 'crear' ? `¡Hola, ${esc(L.primer)}!` : 'Confírmalo'}</h2>
        <p class="muted" style="margin:0">${L.paso === 'crear' ? 'Crea un PIN de 4 números. Con él y tu celular entrarás siempre.' : 'Escribe tu PIN una vez más.'}</p>
        <form id="f-pin">${pinField('pin', 'new-password')}<div class="msg" id="msg" role="alert"></div>
          <button class="btn" type="submit">${L.paso === 'crear' ? 'Continuar' : 'Crear mi PIN'}</button></form>
        <button class="link" data-act="volver"><u>Volver</u></button>`;
    } else if (L.paso === 'pin') {
      card = `
        <h2 class="d-lg">Hola de nuevo${L.primer ? ', ' + esc(L.primer) : ''}</h2>
        <p class="muted" style="margin:0">Escribe tu PIN de 4 números.</p>
        <form id="f-entrar">${pinField('pin', 'current-password')}<div class="msg" id="msg" role="alert"></div>
          <button class="btn" type="submit">Entrar a mi viaje</button></form>
        <a class="link" href="${waLink(waNum(C.AGENCIA_WHATSAPP), `Hola, olvidé mi PIN de Mi Viaje. Mi celular es ${L.celular || ''}.`)}" target="_blank" rel="noopener"><u>Olvidé mi PIN</u></a>
        <button class="link" data-act="volver" style="margin-top:0"><u>Usar otro celular</u></button>`;
    }
    $root.innerHTML = `
      <div class="login">
        <svg class="login-arc" viewBox="0 0 420 150" preserveAspectRatio="none" aria-hidden="true"><path d="M -20 130 C 120 10, 300 10, 440 90"/></svg>
        <div class="login-plane" aria-hidden="true">${ic('plane', 'lg')}</div>
        <div class="login-top">
          <img class="login-logo" src="/assets/logo-on-red.png" alt="Todo Viajes" width="250" height="122">
          <div class="login-title">Mi Viaje</div>
          <p class="login-sub">Tu viaje. Todo en un solo lugar.</p>
        </div>
        <div class="sheet">${card}</div>
      </div>`;
    bindLogin();
  }
  function setMsg(t) { const m = document.getElementById('msg'); if (m) m.textContent = t || ''; if (t) { const p = document.getElementById('pin'); if (p) { p.classList.remove('shake'); void p.offsetWidth; p.classList.add('shake'); } } }
  function busy(form, on) { const b = form.querySelector('button[type=submit]'); if (b) { b.disabled = on; if (on) { b.dataset.t = b.innerHTML; b.textContent = 'Un momento…'; } else if (b.dataset.t) b.innerHTML = b.dataset.t; } }
  function paintPin(i) { const boxes = i.parentNode.querySelectorAll('b'); boxes.forEach((b, k) => { b.classList.toggle('on', k < i.value.length); b.classList.toggle('cur', k === Math.min(i.value.length, 3) && document.activeElement === i); }); }

  function bindLogin() {
    const L = S.login;
    $root.querySelectorAll('[data-act=volver]').forEach((b) => b.onclick = () => { S.login = { paso: 'id', nombre: L.nombre, celular: L.celular }; renderLogin(); });
    const fid = document.getElementById('f-id');
    if (fid) fid.onsubmit = async (e) => {
      e.preventDefault();
      const nombre = fid.nombre.value.trim(), celular = fid.celular.value.replace(/\D/g, '').slice(-10);
      if (nombre.split(/\s+/).length < 2) return setMsg('Escribe tu nombre y al menos un apellido.');
      if (celular.length !== 10) return setMsg('El celular debe tener 10 dígitos.');
      busy(fid, true); setMsg('');
      try {
        const r = await rpc('mv_identificar', { p_nombre: nombre, p_celular: celular });
        Object.assign(L, { nombre, celular, primer: r.nombre });
        if (r.estado === 'crear_pin') { L.paso = 'crear'; return renderLogin(); }
        if (r.estado === 'pedir_pin') { L.paso = 'pin'; return renderLogin(); }
        if (r.estado === 'bloqueado') setMsg('Demasiados intentos. Intenta de nuevo en unos minutos.');
        else setMsg('No encontramos un viaje con esos datos. Revisa tu nombre y celular, o escríbenos.');
      } catch (err) { setMsg(err.message); }
      busy(fid, false);
    };
    const fpin = document.getElementById('f-pin');
    if (fpin) fpin.onsubmit = async (e) => {
      e.preventDefault();
      const pin = fpin.pin.value;
      if (!/^\d{4}$/.test(pin)) return setMsg('El PIN debe tener 4 números.');
      if (L.paso === 'crear') { L.pin1 = pin; L.paso = 'confirmar'; return renderLogin(); }
      if (pin !== L.pin1) { L.paso = 'crear'; L.pin1 = null; renderLogin(); return setMsg('Los PIN no coinciden. Inténtalo de nuevo.'); }
      busy(fpin, true);
      try {
        const r = await rpc('mv_crear_pin', { p_nombre: L.nombre, p_celular: L.celular, p_pin: pin });
        if (r.error) { L.paso = 'crear'; renderLogin(); return setMsg(r.error); }
        startSession(r.token, true);
      } catch (err) { setMsg(err.message); busy(fpin, false); }
    };
    const fe = document.getElementById('f-entrar');
    if (fe) fe.onsubmit = async (e) => {
      e.preventDefault();
      const pin = fe.pin.value;
      if (!/^\d{4}$/.test(pin)) return setMsg('El PIN debe tener 4 números.');
      busy(fe, true);
      try {
        const r = await rpc('mv_entrar', { p_celular: L.celular, p_pin: pin });
        if (r.error) { busy(fe, false); fe.pin.value = ''; paintPin(fe.pin); setMsg(r.error); return; }
        startSession(r.token, false);
      } catch (err) { setMsg(err.message); busy(fe, false); }
    };
    $root.querySelectorAll('.pin-input').forEach((i) => {
      const upd = () => paintPin(i);
      i.addEventListener('input', () => { i.value = i.value.replace(/\D/g, '').slice(0, 4); upd(); if (i.value.length === 4) setTimeout(() => i.form.requestSubmit(), 120); });
      i.addEventListener('focus', upd); i.addEventListener('blur', upd);
      setTimeout(() => { i.focus(); upd(); }, 60);
    });
  }

  function startSession(tok, first) {
    S.token = tok; store.set(TOKEN_KEY, tok); S.login = { paso: 'id' };
    S.firstTime = first;
    load();
  }

  // =====================================================================
  // CARGA
  // =====================================================================
  const skeleton = () => `<div class="skel" aria-busy="true" aria-label="Cargando"><i style="height:44px;width:40%"></i><i style="height:300px"></i><i style="height:120px"></i><i style="height:84px"></i></div>`;
  async function load(silent) {
    if (!silent) $root.innerHTML = skeleton();
    try {
      const d = await rpc('mv_datos', { p_token: S.token });
      if (!d || d.error) { store.del(TOKEN_KEY); S.token = null; return renderLogin(); }
      S.data = d;
      const last = Number(store.get('mv_visita') || 0);
      if (Date.now() - last > 6 * 3600e3) { store.set('mv_visita', String(Date.now())); logEvent('visita'); }
      render(silent);
    } catch (err) {
      if (silent) return;
      $root.innerHTML = `<div class="empty-state view"><div class="bub">${ic('compass', 'lg')}</div><h2 class="d-lg">Sin conexión</h2><p class="muted">${esc(err.message)}</p><button class="btn ink" id="retry">Reintentar</button></div>`;
      document.getElementById('retry').onclick = () => load();
    }
  }

  // =====================================================================
  // RENDER PRINCIPAL
  // =====================================================================
  const TABS = [['inicio', 'Inicio', 'home'], ['viaje', 'Mi viaje', 'ticket'], ['beneficios', 'Beneficios', 'gift'], ['perfil', 'Perfil', 'user']];
  function render(quiet) {
    const v = currentTrip();
    document.body.dataset.tema = (v && v.tema) || 'tropical';
    const views = { inicio: viewInicio, viaje: viewViaje, beneficios: viewBeneficios, perfil: viewPerfil };
    $root.innerHTML = `
      <div class="app"><main class="${quiet ? '' : 'view'}" id="view">${views[S.tab]()}</main></div>
      ${S.tab === 'inicio' ? `<a class="help-fab tap" href="${helpLink()}" target="_blank" rel="noopener" aria-label="Escríbenos por WhatsApp">${WA}</a>` : ''}
      <nav class="tabbar" aria-label="Navegación principal">${TABS.map(([k, n, i]) => `<button class="tab ${S.tab === k ? 'on' : ''}" data-tab="${k}" ${S.tab === k ? 'aria-current="page"' : ''}>${ic(i)}<span>${n}</span></button>`).join('')}</nav>`;
    bindApp();
    afterRender(quiet);
    if (S.firstTime) { S.firstTime = false; setTimeout(() => confetti(), 500); }
  }

  // Animaciones que dependen del layout (se ejecutan después de pintar)
  function afterRender(quiet) {
    // Muesca del boleto exactamente en la línea perforada
    document.querySelectorAll('.ticket,.invite').forEach((t) => { const a = t.querySelector('.ticket-a,.invite-a'); if (a) t.style.setProperty('--cut', a.offsetHeight + 'px'); });
    // Tablero de aeropuerto
    document.querySelectorAll('.flap[data-val]').forEach((f) => {
      const val = f.dataset.val, spans = f.querySelectorAll('span');
      if (REDUCED || quiet) { spans.forEach((s, i) => s.textContent = val[i]); return; }
      spans.forEach((s, i) => {
        let n = 0; const steps = 6 + i * 3;
        const tick = () => { n++; s.classList.remove('go'); void s.offsetWidth; s.classList.add('go'); s.textContent = n >= steps ? val[i] : String(Math.floor(Math.random() * 10)); if (n < steps) setTimeout(tick, 70); };
        setTimeout(tick, 250 + i * 60);
      });
    });
    // Plan de vuelo: puntos, trazo y avión
    const fp = document.querySelector('.fp-svg');
    if (fp) {
      const path = fp.querySelector('.fp-base'), done = fp.querySelector('.fp-done'), plane = fp.querySelector('.fp-plane');
      const L = path.getTotalLength(), pct = Number(fp.dataset.pct) / 100;
      fp.querySelectorAll('.fp-dot').forEach((c, i) => { const p = path.getPointAtLength(L * i / 4); c.setAttribute('cx', p.x); c.setAttribute('cy', p.y); });
      done.style.strokeDasharray = L; done.style.strokeDashoffset = L;
      const place = (f) => {
        const d = L * f, p = path.getPointAtLength(d), p2 = path.getPointAtLength(Math.min(L, d + 1));
        const ang = Math.atan2(p2.y - p.y, p2.x - p.x) * 180 / Math.PI;
        plane.setAttribute('transform', `translate(${p.x - 12} ${p.y - 12}) rotate(${ang + 90} 12 12)`);
        done.style.strokeDashoffset = L * (1 - f);
      };
      if (REDUCED || quiet) place(pct);
      else { const t0 = performance.now(), dur = 1400; const step = (t) => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); place(pct * e); if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); }
    }
    // Anillo de pagos y barras
    requestAnimationFrame(() => {
      document.querySelectorAll('.donut .fg[data-off]').forEach((c) => c.style.strokeDashoffset = c.dataset.off);
      document.querySelectorAll('.mini-bar i[data-w]').forEach((i) => i.style.transform = `scaleX(${i.dataset.w})`);
    });
    // Sub-navegación activa al hacer scroll
    const chips = document.querySelectorAll('.subnav [data-jump]');
    if (chips.length && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver((ents) => ents.forEach((en) => { if (en.isIntersecting) chips.forEach((c) => c.classList.toggle('on', c.dataset.jump === en.target.id)); }), { rootMargin: '-35% 0px -60% 0px' });
      chips.forEach((c) => { const s = document.getElementById(c.dataset.jump); if (s) io.observe(s); });
    }
  }

  // =====================================================================
  // INICIO
  // =====================================================================
  function flap(n, big) {
    const s = String(n).padStart(2, '0');
    return `<div class="flap ${big ? 'big' : ''}" data-val="${s}" aria-label="${n}">${[...s].map((d) => `<span aria-hidden="true">${d}</span>`).join('')}</div>`;
  }
  function heroBlock(v, st) {
    const c = S.data.cliente;
    const img = v.imagen_url ? `<div class="hero-img" style="background-image:url('${esc(v.imagen_url)}')"></div>` : '';
    const chip = { futuro: `Faltan ${st.d} días`, inminente: st.d === 1 ? 'Mañana despegas' : `Faltan ${st.d} días`, hoy: 'Hoy es el día', durante: 'Viaje en curso', despues: 'De regreso a casa' }[st.k];
    return `<header class="hero ${v.imagen_url ? 'img' : ''}">${img}
      ${v.imagen_url ? '' : '<svg class="hero-arc" viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden="true"><path d="M-10 110 C 110 -10, 290 -10, 410 80"/></svg>'}
      <div class="topbar"><img src="/assets/logo-white.png" alt="Todo Viajes" width="61" height="30"><span class="avatar" aria-hidden="true">${initial(c.primer_nombre)}</span></div>
      <div class="hello">Hola, <b>${esc(c.primer_nombre)}</b></div>
      <div class="stage-chip"><i></i>${chip}</div>
    </header>`;
  }
  function ticketBlock(v, st) {
    const fl = firstFlight(v), codes = fl && flightCodes(fl.titulo);
    const kick = { futuro: 'Tu próxima aventura', inminente: 'Tu próxima aventura', hoy: 'Hoy comienza', durante: 'Estás viviendo', despues: 'Así fue tu viaje a' }[st.k];
    let a = `<div class="kicker">${kick}</div>`;
    if (codes && ['futuro', 'inminente', 'hoy'].includes(st.k)) {
      a += `<div class="route" style="margin-top:14px"><div><div class="code">${codes[0]}</div><div class="city">${segDate(fl.inicio)} · ${segTime(fl.inicio)}</div></div>
        <div class="mid">${ic('plane', 'sm')}</div>
        <div class="end"><div class="code">${codes[1]}</div><div class="city">${esc(v.titulo)}</div></div></div>
        <div class="dest-name" style="margin-top:16px"><span class="d-md">${esc(v.destino)}</span></div>`;
    } else {
      a += `<div class="dest-name"><h1 class="d-xl" style="margin:6px 0 0">${esc(v.titulo)}</h1><span class="dest-flag" aria-hidden="true">${esc(v.bandera || '')}</span></div>`;
    }
    a += `<div class="dates">${ic('cal', 'sm')} ${fmtRange(v.fecha_inicio, v.fecha_fin)}</div>`;
    let b = '';
    if (st.k === 'futuro' || st.k === 'inminente') {
      const lbl = st.d === 1 ? 'Mañana despegas' : st.d <= 7 ? 'Ya casi' : st.d <= 30 ? 'Ve preparando la maleta' : 'para despegar';
      b = `<div class="count-row">${flap(st.d)}<div class="count-label">${st.d === 1 ? 'día' : 'días'}<small>${lbl}</small></div></div>`;
    } else if (st.k === 'hoy') {
      b = `<div class="count-row"><div class="big-word">¡Hoy viajas!</div><div class="count-label" style="text-align:right">${fl ? `Sale ${segTime(fl.inicio)}<small>${fl.localizador ? 'Clave ' + esc(fl.localizador) : esc(fl.proveedor || '')}</small>` : ''}</div></div>`;
    } else if (st.k === 'durante') {
      b = `<div class="count-row"><div style="display:flex;align-items:center;gap:10px"><span class="kicker">Día</span>${flap(st.dia)}</div><div class="count-label" style="text-align:right">de ${st.total}<small>Hoy estás en ${esc(v.titulo)}</small></div></div>`;
    } else {
      b = `<div class="count-row"><div class="big-word">¡Bienvenido de vuelta!</div><span class="dest-flag" aria-hidden="true">${esc(v.bandera || '')}</span></div>`;
    }
    return `<section class="ticket" aria-label="Tu viaje"><div class="ticket-a">${a}</div><div class="ticket-b">${b}</div></section>`;
  }

  function viewInicio() {
    const v = currentTrip();
    if (!v) return viewSinViaje();
    const st = stageOf(v), pr = progress(v), np = nextPayment(v);
    let html = heroBlock(v, st) + ticketBlock(v, st);
    let k = 1;
    if (st.k === 'futuro' || st.k === 'inminente') {
      html += nextStep(v, np, k++);
      html += flightPlan(pr, k++);
      const total = Number(v.total || 0), pag = Number(v.pagado || 0), pp = total ? Math.round(Math.min(1, pag / total) * 100) : 100, nd = (v.documentos || []).length;
      html += `<div class="section reveal" style="--d:${k++}"><div class="tiles">
        <button class="tile tap" data-go="viaje" data-anchor="pagos"><div class="tile-top"><span class="bub">${ic('card', 'sm')}</span><span class="ring" style="--p:${pp}" aria-label="${pp}% pagado"></span></div><div class="k">${np ? 'Próximo pago' : 'Pagos'}</div><div class="v">${np ? money(np.monto, v.moneda) : 'Liquidado'}</div><div class="s">${np ? (np.fecha ? 'Antes del ' + fmtDay(np.fecha) : 'Pendiente') : 'Todo pagado'}</div></button>
        <button class="tile tap" data-go="viaje" data-anchor="docs"><div class="tile-top"><span class="bub">${ic('file', 'sm')}</span></div><div class="k">Documentos</div><div class="v">${nd}</div><div class="s">${nd ? (nd === 1 ? 'listo para consultar' : 'listos para consultar') : 'Te avisaremos'}</div></button>
      </div></div>`;
      html += keySegments(v, false, k++);
      if (st.k === 'inminente') html += checklistBlock(v, 'Antes de viajar', k++);
    } else if (st.k === 'hoy') {
      html += todayBlock(v, isoDay(today()), 'Tu día de viaje', k++) + keySegments(v, true, k++) + docsBlock(v, k++);
    } else if (st.k === 'durante') {
      html += todayBlock(v, isoDay(today()), 'Hoy', k++) + keySegments(v, true, k++);
    } else {
      html += despuesBlock(v, k++);
    }
    const otros = upcomingTrips().filter((x) => x.id !== v.id);
    if (otros.length) html += `<div class="section reveal" style="--d:${k++}"><div class="sec-head"><h3 class="d-md">Tus próximos viajes</h3></div><div class="card">${otros.map((x) => `<button class="list-row tap" data-trip="${x.id}"><div class="bub" aria-hidden="true">${esc(x.bandera || '')}</div><div><div class="t">${esc(x.titulo)}</div><div class="d">${fmtRange(x.fecha_inicio, x.fecha_fin)}</div></div><div class="r">${ic('chev', 'sm')}</div></button>`).join('')}</div></div>`;
    return html;
  }

  function flightPlan(pr, d) {
    return `<div class="section reveal" style="--d:${d}"><div class="card flightplan">
      <div class="fp-top"><div><div class="kicker">Tu viaje está listo al</div><div class="fp-pct">${pr.pct}<small>%</small></div></div><span class="badge ${pr.pct >= 100 ? 'ok' : 'red'}">${pr.pct >= 100 ? 'Todo listo' : pr.steps.filter((x) => x.ok).length + ' de 5 etapas'}</span></div>
      <svg class="fp-svg" viewBox="0 0 320 84" data-pct="${pr.pct}" role="img" aria-label="Avance del viaje ${pr.pct}%">
        <path class="fp-base" d="M14 70 C 90 8, 230 8, 306 70"/><path class="fp-done" d="M14 70 C 90 8, 230 8, 306 70"/>
        ${pr.steps.map((s) => `<circle class="fp-dot ${s.ok ? 'ok' : ''}" r="6"/>`).join('')}
        <g class="fp-plane"><svg width="24" height="24" viewBox="0 0 24 24">${P.plane}</svg></g>
      </svg>
      <div class="fp-steps">${pr.steps.map((s) => `<div class="${s.ok ? 'ok' : ''}">${s.n}</div>`).join('')}</div>
    </div></div>`;
  }

  function nextStep(v, np, d) {
    const t = today();
    let icon = 'spark', txt = '¡Todo listo! Solo falta disfrutar.', anchor = '', ink = false;
    const pend = (v.checklist || []).find((c) => !c.completado && !c.solo_equipo);
    if (np && np.fecha && diffDays(t, pDate(np.fecha)) <= 15) { icon = 'card'; txt = `Pago de ${money(np.monto, v.moneda)} ${diffDays(t, pDate(np.fecha)) < 0 ? 'vencido el' : 'antes del'} ${fmtDay(np.fecha)}`; anchor = 'pagos'; }
    else if (pend) { icon = 'check'; txt = pend.texto; anchor = 'check'; }
    else if (np) { icon = 'card'; txt = `Pago pendiente de ${money(np.monto, v.moneda)}`; anchor = 'pagos'; }
    else if ((v.documentos || []).length) { icon = 'file'; txt = 'Revisa tus documentos de viaje'; anchor = 'docs'; ink = true; }
    else ink = true;
    return `<div class="section reveal" style="--d:${d}"><button class="next tap ${ink ? 'ink' : ''}" data-go="viaje" data-anchor="${anchor}"><span class="ic">${ic(icon)}</span><span class="t"><small>Tu siguiente paso</small><strong>${esc(txt)}</strong></span><span class="chev">${ic('chev')}</span></button></div>`;
  }

  const mapLink = (q) => `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}" target="_blank" rel="noopener">${esc(q)}</a>`;
  function segCard(s) {
    const meta = [];
    const det = s.detalles || {};
    const codes = s.tipo === 'vuelo' && flightCodes(s.titulo);
    let head = '';
    if (codes) {
      head = `<div class="boarding"><div><div class="code">${codes[0]}</div><div class="time">${s.inicio ? segDate(s.inicio) + ' · ' + segTime(s.inicio) : ''}</div></div><div class="mid">${ic('plane', 'sm')}</div><div class="r"><div class="code">${codes[1]}</div><div class="time">${s.fin ? segTime(s.fin) : ''}</div></div></div>`;
    } else {
      head = `<div class="seg-title d-md">${esc(s.titulo)}</div>`;
      if (s.tipo === 'hotel') { if (s.inicio) meta.push(['Check-in', segDate(s.inicio) + ' · ' + segTime(s.inicio)]); if (s.fin) meta.push(['Check-out', segDate(s.fin) + ' · ' + segTime(s.fin)]); }
      else { if (s.inicio) meta.push(['Cuándo', segDate(s.inicio) + ' · ' + segTime(s.inicio)]); if (s.fin) meta.push(['Termina', segDate(s.fin) + ' · ' + segTime(s.fin)]); }
    }
    if (s.proveedor) meta.push([s.tipo === 'vuelo' ? 'Aerolínea' : 'Proveedor', s.proveedor]);
    if (s.localizador) meta.push(['Clave de reservación', s.localizador]);
    Object.keys(det).forEach((k) => { if (det[k]) meta.push([k, det[k]]); });
    return `<div class="seg">
      <div class="seg-type"><span class="bub">${ic(SEGICON[s.tipo], 'sm')}</span>${esc(SEGNAME[s.tipo])}</div>
      ${head}
      ${s.lugar ? `<div class="seg-place">${ic('pin', 'sm')}<span>${mapLink(s.lugar)}</span></div>` : ''}
      ${meta.length ? `<div class="meta">${meta.map(([a, b]) => `<div><span>${esc(a)}</span><b>${esc(b)}</b></div>`).join('')}</div>` : ''}
      ${s.descripcion ? `<div class="seg-desc">${esc(s.descripcion)}</div>` : ''}
    </div>`;
  }
  function keySegments(v, compact, d) {
    const segs = v.segmentos || [];
    const items = [segs.find((s) => s.tipo === 'vuelo'), segs.find((s) => s.tipo === 'hotel'), segs.find((s) => s.tipo === 'traslado')].filter(Boolean);
    if (!items.length) return '';
    return `<div class="section reveal" style="--d:${d}"><div class="sec-head"><h3 class="d-md">${compact ? 'Lo importante' : 'Tu viaje'}</h3><button class="more" data-go="viaje">Ver todo ${ic('chev', 'sm')}</button></div><div class="card">${items.map(segCard).join('')}</div></div>`;
  }
  function dayItems(v, day) {
    const out = [];
    (v.segmentos || []).forEach((s) => {
      if (segDay(s.inicio) === day) out.push({ t: s.inicio, s, label: s.tipo === 'hotel' ? 'Check-in · ' + s.titulo : s.titulo });
      if (s.tipo === 'hotel' && segDay(s.fin) === day) out.push({ t: s.fin, s, label: 'Check-out · ' + s.titulo });
    });
    return out.sort((a, b) => String(a.t).localeCompare(String(b.t)));
  }
  const tlItem = (it, i) => `<div class="tl-item" style="animation-delay:${i * 60}ms"><div class="tl-time">${segTime(it.t)}</div><div class="tl-rail"><i></i></div><div class="tl-body"><div class="t">${ic(SEGICON[it.s.tipo], 'sm')}${esc(it.label)}</div>${it.s.lugar ? `<div class="d">${esc(it.s.lugar)}</div>` : ''}${it.s.localizador ? `<div class="d">Clave ${esc(it.s.localizador)}</div>` : ''}</div></div>`;
  function todayBlock(v, day, title, d) {
    const items = dayItems(v, day);
    return `<div class="section reveal" style="--d:${d}"><div class="sec-head"><h3 class="d-md">${title}</h3></div><div class="card">${items.length ? `<div class="tl">${items.map(tlItem).join('')}</div>` : `<div class="empty-note"><span class="bub">${ic('sun')}</span><span>Día libre en ${esc(v.titulo)}. Si necesitas algo, estamos a un mensaje.</span></div>`}</div></div>`;
  }
  function despuesBlock(v, d) {
    const dias = diffDays(pDate(v.fecha_inicio), pDate(v.fecha_fin)) + 1;
    const hotel = (v.segmentos || []).find((s) => s.tipo === 'hotel');
    const c = contactInfo(v);
    return `
      <div class="section reveal" style="--d:${d}"><div class="card card-p">
        <div class="seg-type"><span class="bub">${ic('badge', 'sm')}</span>Nuevo sello en tu pasaporte</div>
        <div class="seg-title d-lg">${esc(v.titulo)} ${pDate(v.fecha_inicio).getFullYear()}</div>
        <div class="meta"><div><span>Días</span><b>${dias}</b></div>${hotel ? `<div><span>Hospedaje</span><b>${esc(hotel.titulo)}</b></div>` : ''}</div>
        <button class="btn" data-act="share-trip">${ic('share', 'sm')} Compartir mi viaje</button>
      </div></div>
      <div class="section reveal" style="--d:${d + 1}"><a class="next ink tap" href="${waLink(c.num, `Hola ${c.nombre.split(' ')[0]}, ya regresé de ${v.titulo}. ¡Quiero cotizar mi próximo viaje!`)}" target="_blank" rel="noopener"><span class="ic">${ic('compass')}</span><span class="t"><small>¿Listo para el siguiente?</small><strong>Cotiza tu próxima aventura</strong></span><span class="chev">${ic('chev')}</span></a></div>
      <div class="section reveal" style="--d:${d + 2}"><button class="next tap" data-go="beneficios"><span class="ic">${ic('gift')}</span><span class="t"><small>Invita y viaja</small><strong>Comparte tu código ${esc(S.data.cliente.codigo_referido)}</strong></span><span class="chev">${ic('chev')}</span></button></div>`;
  }
  function viewSinViaje() {
    const c = S.data.cliente, past = pastTrips().length;
    return `<div class="empty-state"><img src="/assets/logo.png" alt="Todo Viajes" style="width:150px;height:auto;margin:0 auto 28px">
        <div class="bub">${ic('compass', 'lg')}</div>
        <h1 class="d-lg" style="margin:0 0 8px">Hola, ${esc(c.primer_nombre)}</h1>
        <p class="muted" style="margin:0 auto;max-width:30ch">${past ? '¿Listo para tu siguiente aventura? Te ayudamos a planearla.' : 'Cuando reserves con Todo Viajes, todo tu viaje aparecerá aquí.'}</p>
        <a class="btn" href="${waLink(waNum(C.AGENCIA_WHATSAPP), `Hola, soy ${c.primer_nombre}. ¡Quiero cotizar un viaje!`)}" target="_blank" rel="noopener">${ic('compass', 'sm')} Cotizar un viaje</a></div>
      ${past ? passportBlock() : ''}`;
  }

  // =====================================================================
  // MI VIAJE
  // =====================================================================
  function viewViaje() {
    const v = currentTrip();
    if (!v) return viewSinViaje();
    const vs = (S.data.viajes || []).filter((x) => pDate(x.fecha_fin) >= today() || x.id === v.id);
    const segs = v.segmentos || [];
    const hasIt = segs.length && diffDays(pDate(v.fecha_inicio), pDate(v.fecha_fin)) < 60;
    const hasPay = Number(v.total || 0) > 0 || (v.pagos || []).length;
    const chips = [['resumen', 'Resumen'], hasIt && ['itinerario', 'Itinerario'], hasPay && ['pagos', 'Pagos'], ['docs', 'Documentos'], (v.checklist || []).length && ['check', 'Checklist']].filter(Boolean);
    const viajeros = v.viajeros || [];
    let html = `<div class="page-head">
      ${vs.length > 1 ? `<div class="trip-switch" style="padding:0 0 14px">${vs.map((x) => `<button class="tap ${x.id === v.id ? 'on' : ''}" data-trip="${x.id}"><span aria-hidden="true">${esc(x.bandera || '')}</span>${esc(x.titulo)}<span class="muted small">${fmtDay(x.fecha_inicio)}</span></button>`).join('')}</div>` : ''}
      <div class="kicker">${esc(v.bandera || '')} ${esc(v.destino)}</div>
      <h1 class="d-xl">${esc(v.titulo)}</h1>
      <div class="dates" style="margin-top:0">${ic('cal', 'sm')} ${fmtRange(v.fecha_inicio, v.fecha_fin)}</div>
      ${viajeros.length > 1 ? `<div class="travelers"><div class="faces">${viajeros.slice(0, 5).map((n) => `<b>${initial(n)}</b>`).join('')}</div><span class="small muted">${viajeros.map(esc).join(', ')}</span></div>` : ''}
    </div>
    <nav class="subnav" aria-label="Secciones">${chips.map(([id, n], i) => `<button class="tap ${i === 0 ? 'on' : ''}" data-jump="${id}">${n}</button>`).join('')}</nav>`;
    html += `<div id="resumen" style="scroll-margin-top:72px">`;
    [['vuelo', 'Vuelos'], ['hotel', 'Hospedaje'], ['traslado', 'Traslados'], ['actividad', 'Actividades'], ['otro', 'Información']].forEach(([t, n], i) => {
      const l = segs.filter((s) => s.tipo === t);
      if (l.length) html += `<div class="section reveal" style="--d:${i}"><div class="sec-head"><h3 class="d-md">${n}</h3></div><div class="card">${l.map(segCard).join('')}</div></div>`;
    });
    if (!segs.length) html += `<div class="section"><div class="card"><div class="empty-note"><span class="bub">${ic('suitcase')}</span><span>Estamos preparando los detalles de tu viaje. Aquí verás vuelos, hotel y traslados.</span></div></div></div>`;
    html += `</div>`;
    if (hasIt) html += itineraryBlock(v);
    if (hasPay) html += paymentsBlock(v);
    html += docsBlock(v, 0);
    html += checklistBlock(v, 'Checklist', 0);
    if (v.incluye) html += `<div class="section"><div class="sec-head"><h3 class="d-md">Tu viaje incluye</h3></div><div class="card text-card">${esc(v.incluye)}</div></div>`;
    if (v.notas) html += `<div class="section"><div class="sec-head"><h3 class="d-md">Importante</h3></div><div class="card text-card">${esc(v.notas)}</div></div>`;
    const c = contactInfo(v);
    html += `<div class="section"><a class="card contact tap" href="${helpLink()}" target="_blank" rel="noopener"><span class="ava">${initial(c.nombre)}</span><span><span class="t">${esc(c.nombre)}</span><span class="d" style="display:block">Tu asesor${c.sucursal ? ' · ' + esc(c.sucursal) : ''}. Estamos contigo.</span></span><span class="go">${WA.replace('<svg', '<svg width="22" height="22" fill="#fff"')}</span></a></div>`;
    return html;
  }

  function itineraryBlock(v) {
    const ini = pDate(v.fecha_inicio), n = diffDays(ini, pDate(v.fecha_fin)) + 1;
    const days = [];
    for (let i = 0; i < n; i++) { const d = new Date(ini); d.setDate(d.getDate() + i); days.push(d); }
    const tday = isoDay(today());
    if (!S.day || !days.some((d) => isoDay(d) === S.day)) S.day = days.some((d) => isoDay(d) === tday) ? tday : isoDay(days[0]);
    const it = dayItems(v, S.day);
    return `<div class="section" id="itinerario" style="scroll-margin-top:72px"><div class="sec-head"><h3 class="d-md">Itinerario</h3><span class="small muted">${n} días</span></div>
      <div class="days" role="tablist">${days.map((d, i) => `<button class="day tap ${isoDay(d) === S.day ? 'on' : ''} ${isoDay(d) === tday ? 'today' : ''}" data-day="${isoDay(d)}" role="tab" aria-selected="${isoDay(d) === S.day}"><small>Día ${i + 1}</small><b>${d.getDate()}</b><small>${DIAS[d.getDay()]}</small></button>`).join('')}</div>
      <div class="card">${it.length ? `<div class="tl">${it.map(tlItem).join('')}</div>` : `<div class="empty-note"><span class="bub">${ic('sun')}</span><span>Día libre para disfrutar a tu ritmo.</span></div>`}</div></div>`;
  }

  function docsBlock(v, d) {
    const docs = v.documentos || [];
    return `<div class="section ${d ? 'reveal' : ''}" style="--d:${d};scroll-margin-top:72px" id="docs"><div class="sec-head"><h3 class="d-md">Documentos</h3>${docs.length ? `<span class="small muted">${docs.length}</span>` : ''}</div>
      ${docs.length ? `<div class="wallet">${docs.map((x) => { const t = DOC[x.tipo] || DOC.otro; return `<button class="doc tap" data-doc="${x.id}" style="--c:${t[2]}"><span class="bub">${ic(t[1])}</span><span><span class="t" style="display:block">${esc(x.nombre)}</span><span class="d">${t[0]}</span></span><span class="open">Abrir ${ic('chev', 'sm')}</span></button>`; }).join('')}</div>`
        : `<div class="card"><div class="empty-note"><span class="bub">${ic('file')}</span><span>Aquí aparecerán tus vouchers, boletos y confirmaciones en cuanto estén listos.</span></div></div>`}</div>`;
  }

  function paymentsBlock(v) {
    const total = Number(v.total || 0), pag = Number(v.pagado || 0), pend = Math.max(0, total - pag);
    const pct = total ? Math.min(100, Math.round(pag / total * 100)) : 100;
    const R = 44, CIRC = 2 * Math.PI * R, off = CIRC * (1 - pct / 100);
    const t = today(); let cum = 0;
    const miles = (v.plan_pagos || []).map((p) => {
      cum += Number(p.monto);
      const done = cum <= pag + 0.01, dd = diffDays(t, pDate(p.fecha));
      const st = done ? ['ok', 'Pagado', 'check'] : dd < 0 ? ['late', 'Vencido', 'info'] : dd <= 15 ? ['due', 'Próximo', 'clock'] : ['', 'Pendiente', 'clock'];
      return `<div class="mile"><span class="st ${st[0]}">${ic(st[2], 'sm')}</span><div><div class="t">${money(p.monto, v.moneda)}</div><div class="d">${esc(p.descripcion || 'Pago')} · ${fmtDay(p.fecha)}</div></div><span class="badge ${st[0]}">${st[1]}</span></div>`;
    }).join('');
    return `<div class="section" id="pagos" style="scroll-margin-top:72px"><div class="sec-head"><h3 class="d-md">Pagos</h3>${pend <= 0.01 ? `<span class="badge ok">${ic('check', 'sm')} Liquidado</span>` : ''}</div>
      <div class="card">
        <div class="pay-top">
          <div class="donut"><svg viewBox="0 0 104 104"><circle class="bg" cx="52" cy="52" r="${R}"/><circle class="fg" cx="52" cy="52" r="${R}" stroke-dasharray="${CIRC}" stroke-dashoffset="${CIRC}" data-off="${off}"/></svg><div class="lbl"><div>${pct}%<small>pagado</small></div></div></div>
          <div class="amounts"><div><span>Total del viaje</span><b>${money(total, v.moneda)}</b></div><div class="paid"><span>Pagado</span><b>${money(pag, v.moneda)}</b></div><div><span>Pendiente</span><b>${money(pend, v.moneda)}</b></div></div>
        </div>
        ${miles ? `<div class="receipt"><div class="sub-title" style="padding:10px 4px 0">Calendario de pagos</div>${miles}</div>` : ''}
        ${(v.pagos || []).length ? `<div class="receipt"><div class="sub-title" style="padding:10px 4px 0">Pagos recibidos</div>${v.pagos.map((p) => `<div class="mile"><span class="st ok">${ic('check', 'sm')}</span><div><div class="t">${money(p.monto, v.moneda)}</div><div class="d">${esc(p.metodo || 'Pago recibido')}</div></div><span class="small muted">${fmtDay(p.fecha)}</span></div>`).join('')}</div>` : ''}
      </div></div>`;
  }

  function checklistBlock(v, title, d) {
    const cl = v.checklist || [];
    if (!cl.length) return '';
    const done = cl.filter((c) => c.completado).length;
    return `<div class="section ${d ? 'reveal' : ''}" id="check" style="--d:${d};scroll-margin-top:72px"><div class="sec-head"><h3 class="d-md">${title}</h3></div><div class="card">
      <div class="cl-head"><div class="mini-bar"><i data-w="${done / cl.length}" style="transform:scaleX(0)"></i></div><span class="small" style="font-weight:700">${done} de ${cl.length}</span></div>
      ${cl.map((c) => `<button class="check ${c.completado ? 'on' : ''} ${c.solo_equipo ? 'locked' : 'tap'}" data-check="${c.id}" ${c.solo_equipo ? 'disabled' : ''} role="checkbox" aria-checked="${c.completado}"><span class="box"><svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></span><span class="txt">${esc(c.texto)}</span>${c.solo_equipo ? `<span class="who">${ic('lock', 'sm')} Todo Viajes</span>` : ''}</button>`).join('')}
    </div></div>`;
  }

  // =====================================================================
  // BENEFICIOS
  // =====================================================================
  function shareText() {
    const c = S.data.cliente, p = S.data.promo || {};
    const base = (p.mensaje || '¡Viaja con Todo Viajes! Usa mi código {codigo}.').replace(/\{codigo\}/g, c.codigo_referido).replace(/\{recompensa\}/g, p.nuevo_texto || 'un beneficio especial');
    return base + '\n\nEscríbeles aquí: ' + waLink(waNum(C.AGENCIA_WHATSAPP), `Hola, vengo recomendado con el código ${c.codigo_referido}`);
  }
  function viewBeneficios() {
    const c = S.data.cliente, p = S.data.promo || {}, r = S.data.referidos || { total: 0, lista: [] }, rec = S.data.recompensas || [];
    const disp = rec.filter((x) => x.estado === 'disponible');
    let html = `<div class="page-head"><div class="kicker">${ic('gift', 'sm')} Beneficios</div><h1 class="d-xl">Invita y viaja</h1></div>`;
    if (p.activo) {
      html += `<div class="section reveal" style="margin-top:12px;--d:1"><div class="invite">
        <div class="invite-a">
          <div class="kick">${ic('users', 'sm')} Comparte Todo Viajes</div>
          <h2 class="d-lg">Tus amigos viajan con ${esc(p.nuevo_texto || 'un beneficio')}</h2>
          ${p.referidor_texto ? `<p>Y cuando reserven con tu código, tú recibes <b>${esc(p.referidor_texto)}</b>.</p>` : ''}
        </div>
        <div class="invite-b">
          <div class="code-box"><div><small>Tu código</small><b>${esc(c.codigo_referido)}</b></div><button class="tap" data-act="copy" aria-label="Copiar código">${ic('copy')}</button></div>
          <a class="btn white tap" data-act="share-wa" href="${waLink('', shareText())}" target="_blank" rel="noopener" style="margin-top:14px"><span style="width:22px;height:22px;display:inline-grid;color:#1E9E52">${WA.replace('<svg', '<svg width="22" height="22" fill="#1E9E52"')}</span>Compartir por WhatsApp</a>
          <div class="row-btns"><button class="btn light" data-act="share">${ic('share', 'sm')} Más apps</button><button class="btn light" data-act="copy">${ic('copy', 'sm')} Copiar</button></div>
        </div>
      </div></div>`;
    } else {
      html += `<div class="section"><div class="card"><div class="empty-note"><span class="bub">${ic('gift')}</span><span>El programa de referidos está en pausa. ¡Pronto volverá con nuevos beneficios!</span></div></div></div>`;
    }
    html += `<div class="section reveal" style="--d:2"><div class="stats">
      <div class="stat"><b>${r.total}</b><span>${r.total === 1 ? 'amigo reservó' : 'amigos reservaron'} con tu código</span></div>
      <div class="stat"><b>${disp.length}</b><span>${disp.length === 1 ? 'recompensa disponible' : 'recompensas disponibles'}</span></div>
    </div></div>`;
    if ((r.lista || []).length) html += `<div class="section reveal" style="--d:3"><div class="sec-head"><h3 class="d-md">Tus invitados</h3></div><div class="card">${r.lista.map((x) => `<div class="friend"><span class="ava">${initial(x.nombre)}</span><div><b>${esc(x.nombre)}</b><div class="small muted">Reservó con tu código</div></div><span class="badge ok" style="margin-left:auto">${fmtDay(x.fecha)}</span></div>`).join('')}</div></div>`;
    html += `<div class="section reveal" style="--d:4"><div class="sec-head"><h3 class="d-md">Mis recompensas</h3></div>${rec.length ? rec.map((x) => `<div class="coupon ${x.estado === 'disponible' ? '' : 'used'}"><span class="bub">${ic(x.estado === 'disponible' ? 'gift' : 'check')}</span><div><div class="t">${esc(x.descripcion)}</div><div class="d">${fmtDay(x.creado_en)}</div></div><span class="badge ${x.estado === 'disponible' ? 'ok' : ''}">${x.estado === 'disponible' ? 'Disponible' : x.estado === 'usada' ? 'Usada' : 'Cancelada'}</span></div>`).join('') : `<div class="card"><div class="empty-note"><span class="bub">${ic('gift')}</span><span>Aún no tienes recompensas. Comparte tu código y empieza a ganar.</span></div></div>`}
      ${disp.length ? '<p class="small muted" style="margin:12px 4px 0">Para usar una recompensa, menciónala a tu asesor al reservar.</p>' : ''}</div>`;
    return html;
  }

  // =====================================================================
  // PERFIL
  // =====================================================================
  function stampSvg(v, i) {
    const d = pDate(v.fecha_inicio), txt = `${v.titulo} · ${MES3[d.getMonth()]} ${d.getFullYear()} · `.toUpperCase();
    const id = 'st' + i + Math.random().toString(36).slice(2, 6);
    return `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><path id="${id}" d="M50,50 m-36,0 a36,36 0 1,1 72,0 a36,36 0 1,1 -72,0"/></defs><circle cx="50" cy="50" r="47" fill="none" stroke="currentColor" stroke-width="2.5"/><circle cx="50" cy="50" r="27" fill="none" stroke="currentColor" stroke-width="1.2" stroke-dasharray="2 3"/><text font-family="Figtree,sans-serif" font-size="8.6" font-weight="800" letter-spacing="1.2" fill="currentColor"><textPath href="#${id}">${esc(txt.repeat(txt.length < 22 ? 2 : 1))}</textPath></text></svg>`;
  }
  function passportBlock() {
    const past = pastTrips().slice().reverse();
    const rots = [-9, 6, -4, 10, -12, 3];
    const stamps = past.length ? past.map((v, i) => `<div class="stamp" style="--rot:${rots[i % rots.length]}deg;--i:${i}" title="${esc(v.titulo)}">${stampSvg(v, i)}<span class="f">${esc(v.bandera || '')}</span></div>`).join('')
      : [0, 1, 2].map((i) => `<div class="stamp empty" style="--rot:${rots[i]}deg;--i:${i}"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="4 5"/></svg><span style="position:relative;font-weight:700">${i === 0 ? 'Tu primer sello' : ''}</span></div>`).join('');
    return `<div class="section"><div class="sec-head"><h3 class="d-md">Sellos de viaje</h3><span class="small muted">${past.length} ${past.length === 1 ? 'destino' : 'destinos'}</span></div><div class="card"><div class="stamps">${stamps}</div></div></div>`;
  }
  function viewPerfil() {
    const c = S.data.cliente, past = pastTrips();
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent), standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone;
    return `<div class="page-head"><div class="kicker">${ic('user', 'sm')} Perfil</div></div>
      <div class="passport">
        <img src="/assets/logo-on-red.png" alt="Todo Viajes" width="130" height="64">
        <div class="pcount"><b>${past.length}</b><small>${past.length === 1 ? 'destino' : 'destinos'}</small></div>
        <div class="pname"><small>Pasaporte de viajero</small><b>${esc(c.nombre)}</b><div class="small" style="opacity:.85;margin-top:2px">${esc(c.celular.replace(/(\d{2})(\d{4})(\d{4})/, '$1 $2 $3'))}</div></div>
      </div>
      ${passportBlock()}
      <div class="section"><div class="sec-head"><h3 class="d-md">Mis viajes</h3></div><div class="card">${(S.data.viajes || []).length ? S.data.viajes.slice().reverse().map((v) => `<button class="list-row tap" data-trip="${v.id}" data-go="viaje"><div class="bub" aria-hidden="true">${esc(v.bandera || '')}</div><div><div class="t">${esc(v.titulo)}</div><div class="d">${fmtRange(v.fecha_inicio, v.fecha_fin)}</div></div><div class="r">${pDate(v.fecha_fin) < today() ? 'Completado' : '<span class="badge red">Próximo</span>'}${ic('chev', 'sm')}</div></button>`).join('') : '<div class="empty-note">Aún no tienes viajes.</div>'}</div></div>
      ${!standalone ? `<div class="section"><div class="card"><button class="list-row tap" data-act="install"><div class="bub">${ic('install')}</div><div><div class="t">Agrégala a tu pantalla de inicio</div><div class="d">${ios ? 'Toca Compartir y luego "Agregar a inicio"' : 'Ábrela como una app, sin descargar nada'}</div></div><div class="r">${ic('chev', 'sm')}</div></button></div></div>` : ''}
      <div class="section"><div class="sec-head"><h3 class="d-md">Todo Viajes</h3></div><div class="card">
        <a class="list-row tap" href="${waLink(waNum(C.AGENCIA_WHATSAPP), 'Hola, tengo una duda.')}" target="_blank" rel="noopener"><div class="bub" style="color:#1E9E52">${WA.replace('<svg', '<svg width="22" height="22" fill="#1E9E52"')}</div><div><div class="t">WhatsApp</div><div class="d">Estamos contigo si necesitas ayuda</div></div><div class="r">${ic('chev', 'sm')}</div></a>
        ${C.AGENCIA_TELEFONO ? `<a class="list-row tap" href="tel:${esc(C.AGENCIA_TELEFONO)}"><div class="bub">${ic('phone')}</div><div><div class="t">Llamar</div><div class="d">${esc(C.AGENCIA_TELEFONO)}</div></div><div class="r">${ic('chev', 'sm')}</div></a>` : ''}
        <button class="list-row tap" data-act="logout"><div class="bub">${ic('out')}</div><div><div class="t">Cerrar sesión</div><div class="d">Tu información queda protegida</div></div></button>
      </div></div>
      <div class="foot"><img src="/assets/logo.png" alt="" width="45" height="22">Mi Viaje · Tu viaje. Todo en un solo lugar.</div>`;
  }

  // =====================================================================
  // EVENTOS
  // =====================================================================
  let deferredInstall = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; });
  const keepScroll = (fn) => { const y = window.scrollY; fn(); window.scrollTo(0, y); };

  let lastY = 0;
  window.addEventListener('scroll', () => { const f = document.querySelector('.help-fab'); if (!f) return; const y = window.scrollY; f.classList.toggle('away', y > lastY + 4 && y > 120); if (y < lastY - 4) f.classList.remove('away'); lastY = y; }, { passive: true });

  function bindApp() {
    $root.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => { if (S.tab === b.dataset.tab) return window.scrollTo({ top: 0, behavior: 'smooth' }); S.tab = b.dataset.tab; render(); window.scrollTo(0, 0); });
    $root.querySelectorAll('[data-trip]').forEach((b) => b.addEventListener('click', () => { S.tripId = b.dataset.trip; S.day = null; if (!b.dataset.go) { render(); window.scrollTo(0, 0); } }));
    $root.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => {
      S.tab = b.dataset.go; render();
      const a = b.dataset.anchor && document.getElementById(b.dataset.anchor);
      if (a) setTimeout(() => a.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' }), 60); else window.scrollTo(0, 0);
    }));
    $root.querySelectorAll('[data-jump]').forEach((b) => b.onclick = () => { const s = document.getElementById(b.dataset.jump); $root.querySelectorAll('[data-jump]').forEach((x) => x.classList.toggle('on', x === b)); if (s) s.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' }); });
    $root.querySelectorAll('[data-day]').forEach((b) => b.onclick = () => { S.day = b.dataset.day; const sx = b.parentNode.scrollLeft; keepScroll(() => render(true)); const d = document.querySelector('.days'); if (d) d.scrollLeft = sx; });
    $root.querySelectorAll('[data-doc]').forEach((b) => b.onclick = () => openDoc(b));
    $root.querySelectorAll('[data-check]').forEach((b) => b.onclick = () => toggleCheck(b));
    const act = (n, fn) => $root.querySelectorAll(`[data-act=${n}]`).forEach((b) => b.addEventListener('click', fn));
    act('logout', async () => { try { await rpc('mv_salir', { p_token: S.token }); } catch (e) {} store.del(TOKEN_KEY); S.token = null; S.data = null; S.tab = 'inicio'; renderLogin(); });
    act('copy', async () => { try { await navigator.clipboard.writeText(S.data.cliente.codigo_referido); toast('Código copiado', 'check'); } catch (e) { toast(S.data.cliente.codigo_referido); } haptic(); logEvent('compartir_codigo', { via: 'copiar' }); });
    act('share-wa', () => logEvent('compartir_codigo', { via: 'whatsapp' }));
    act('share', async () => {
      logEvent('compartir_codigo', { via: 'apps' });
      if (navigator.share) { try { await navigator.share({ title: 'Todo Viajes', text: shareText() }); } catch (e) {} }
      else { try { await navigator.clipboard.writeText(shareText()); toast('Mensaje copiado', 'check'); } catch (e) {} }
    });
    act('share-trip', async () => {
      const v = currentTrip();
      const t = `${v.bandera || ''} ${v.titulo} ${pDate(v.fecha_inicio).getFullYear()}: un viaje increíble con Todo Viajes.\n¿Quieres viajar? Usa mi código ${S.data.cliente.codigo_referido}.`;
      logEvent('compartir_viaje');
      if (navigator.share) { try { await navigator.share({ text: t }); } catch (e) {} } else { try { await navigator.clipboard.writeText(t); toast('Texto copiado', 'check'); } catch (e) {} }
    });
    act('install', async () => { if (deferredInstall) { deferredInstall.prompt(); deferredInstall = null; } else toast('Menú del navegador → "Agregar a inicio"', 'install'); });
  }

  async function toggleCheck(b) {
    const v = currentTrip(), item = (v.checklist || []).find((c) => c.id === b.dataset.check);
    if (!item || item.solo_equipo) return;
    item.completado = !item.completado;
    b.classList.toggle('on', item.completado); b.setAttribute('aria-checked', item.completado);
    if (item.completado) haptic();
    const done = v.checklist.filter((c) => c.completado).length, bar = document.querySelector('.mini-bar i');
    if (bar) bar.style.transform = `scaleX(${done / v.checklist.length})`;
    const cnt = bar && bar.parentNode.nextElementSibling; if (cnt) cnt.textContent = `${done} de ${v.checklist.length}`;
    try {
      const r = await rpc('mv_checklist', { p_token: S.token, p_item: item.id, p_completado: item.completado });
      if (r && r.error) throw new Error();
      if (v.checklist.every((c) => c.completado) && item.completado) { confetti(); toast('¡Todo listo para tu viaje!', 'spark'); }
    } catch (e) { item.completado = !item.completado; b.classList.toggle('on', item.completado); b.setAttribute('aria-checked', item.completado); toast('No se pudo guardar, intenta de nuevo', 'info'); }
  }

  async function openDoc(btn) {
    const id = btn.dataset.doc;
    btn.classList.add('loading');
    const w = window.open('', '_blank');
    if (w) w.document.write('<p style="font-family:system-ui,sans-serif;padding:24px;color:#5F636B">Abriendo documento…</p>');
    try {
      const r = await fetch('/api/documento', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: S.token, id }) });
      const j = await r.json();
      if (!r.ok || !j.url) throw new Error(j.error || 'No disponible');
      if (w) w.location.href = j.url; else window.location.href = j.url;
    } catch (e) { if (w) w.close(); toast('No pudimos abrir el documento', 'info'); }
    btn.classList.remove('loading');
  }

  // Celebración en colores de marca (peak-end)
  function confetti() {
    if (REDUCED) return;
    const cv = document.createElement('canvas'); cv.className = 'confetti'; document.body.appendChild(cv);
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = innerWidth, H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
    const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
    const cols = ['#C02026', '#C02026', '#111214', '#FFFFFF', '#F9D6D7'];
    const Pp = Array.from({ length: 110 }, () => ({ x: W / 2 + (Math.random() - .5) * 80, y: H * .32, vx: (Math.random() - .5) * 13, vy: -Math.random() * 13 - 4, s: Math.random() * 7 + 4, r: Math.random() * 6, vr: (Math.random() - .5) * .3, c: cols[Math.floor(Math.random() * cols.length)] }));
    let f = 0;
    (function tick() {
      ctx.clearRect(0, 0, W, H);
      Pp.forEach((p) => { p.vy += .34; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.strokeStyle = 'rgba(0,0,0,.08)'; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.strokeRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore(); });
      if (++f < 120) requestAnimationFrame(tick); else cv.remove();
    })();
  }

  // =====================================================================
  // ARRANQUE
  // =====================================================================
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  S.token = store.get(TOKEN_KEY);
  if (!C.SUPABASE_URL || C.SUPABASE_URL.includes('TU-PROYECTO')) {
    $root.innerHTML = '<div class="empty-state"><h2 class="d-lg">Falta configurar</h2><p class="muted">Agrega la URL y la clave pública de Supabase en config.js</p></div>';
  } else if (S.token) load(); else renderLogin();
  document.addEventListener('visibilitychange', () => { if (!document.hidden && S.token && S.data) load(true); });
})();
