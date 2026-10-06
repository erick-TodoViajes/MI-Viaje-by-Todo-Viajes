/* MI VIAJE by TODO VIAJES — app del cliente (sin dependencias) */
(function () {
  'use strict';
  const C = window.MV_CONFIG || {};
  const $root = document.getElementById('root');
  const TOKEN_KEY = 'mv_token';
  const S = { token: null, data: null, tab: 'inicio', tripId: null, day: null, login: { paso: 'id' } };

  // ---------------- utilidades ----------------
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const MES3 = MESES.map((m) => m.slice(0, 3).toUpperCase());
  const DIAS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
  const pDate = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
  const today = () => { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); };
  const diffDays = (a, b) => Math.round((b - a) / 864e5);
  const isoDay = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  // Las horas de vuelos/hoteles se guardan como "hora local del lugar" (en UTC sin conversión)
  const segDay = (iso) => iso ? new Date(iso).toISOString().slice(0, 10) : null;
  const segTime = (iso) => iso ? new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'UTC' }).replace(/\s?([ap])\.?\s?m\.?/i, (m, x) => ' ' + x.toUpperCase() + 'M') : '';
  const segDate = (iso) => { if (!iso) return ''; const d = new Date(iso); return d.getUTCDate() + ' ' + MES3[d.getUTCMonth()]; };
  function fmtRange(a, b) {
    const x = pDate(a), y = pDate(b);
    if (x.getFullYear() !== y.getFullYear()) return `${x.getDate()} ${MES3[x.getMonth()]} ${x.getFullYear()} — ${y.getDate()} ${MES3[y.getMonth()]} ${y.getFullYear()}`;
    if (x.getMonth() !== y.getMonth()) return `${x.getDate()} ${MES3[x.getMonth()]} — ${y.getDate()} ${MES3[y.getMonth()]} ${y.getFullYear()}`;
    return `${x.getDate()} — ${y.getDate()} ${MESES[x.getMonth()].toUpperCase()} ${x.getFullYear()}`;
  }
  const fmtDay = (s) => { const d = pDate(s); return d.getDate() + ' ' + MES3[d.getMonth()]; };
  function money(n, cur) {
    const v = Number(n || 0);
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: cur || 'MXN', minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 }).format(v);
  }
  const waLink = (num, text) => 'https://wa.me/' + String(num || '').replace(/\D/g, '') + (text ? '?text=' + encodeURIComponent(text) : '');
  const waNum = (n) => { const d = String(n || '').replace(/\D/g, ''); return d.length === 10 ? '52' + d : d; };

  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2200);
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
    if (viajando) pct = Math.max(pct, 100);
    return {
      pct: Math.min(100, pct),
      steps: [
        { n: 'Reserva', ok: true },
        { n: 'Pagos', ok: pagos >= 0.999 },
        { n: 'Docs', ok: !!docs },
        { n: 'Listo', ok: check >= 0.999 },
        { n: 'Viaje', ok: viajando }
      ]
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
  const ICON = { vuelo: '✈️', hotel: '🏨', traslado: '🚐', actividad: '🌴', otro: '📌' };
  const DOCICON = { confirmacion: '✅', voucher: '🎟️', boleto: '✈️', seguro: '🛡️', itinerario: '🗓️', otro: '📄' };
  const DOCNAME = { confirmacion: 'Confirmación', voucher: 'Voucher', boleto: 'Boleto de avión', seguro: 'Seguro de viaje', itinerario: 'Itinerario', otro: 'Documento' };

  function contactInfo(v) {
    const ase = v && v.asesor;
    return { num: waNum((ase && ase.whatsapp) || C.AGENCIA_WHATSAPP), nombre: (ase && ase.nombre) || C.AGENCIA_NOMBRE || 'Todo Viajes' };
  }
  function helpLink(extra) {
    const v = currentTrip(), c = contactInfo(v), nom = S.data ? S.data.cliente.primer_nombre : '';
    const txt = extra || `Hola ${c.nombre.split(' ')[0]}, soy ${nom}.` + (v ? ` Tengo una duda sobre mi viaje a ${v.titulo}.` : '');
    return waLink(c.num, txt);
  }

  function logEvent(ev, det) { if (S.token) rpc('mv_evento', { p_token: S.token, p_evento: ev, p_detalle: det || {} }).catch(() => {}); }

  // ---------------- LOGIN ----------------
  function renderLogin() {
    document.body.dataset.tema = 'tropical';
    const L = S.login;
    let card = '';
    if (L.paso === 'id') {
      card = `
        <h2>Entra a tu viaje</h2>
        <p class="muted small" style="margin:0">Usa el nombre y celular que diste a Todo Viajes.</p>
        <form id="f-id" autocomplete="on">
          <label class="field"><span>Nombre completo</span><input name="nombre" autocomplete="name" placeholder="Ej. Erick Pérez Gómez" required value="${esc(L.nombre || '')}"></label>
          <label class="field"><span>Celular (10 dígitos)</span><input name="celular" type="tel" inputmode="numeric" autocomplete="tel-national" placeholder="33 1234 5678" required value="${esc(L.celular || '')}"></label>
          <div class="msg" id="msg"></div>
          <button class="btn" type="submit">Continuar</button>
        </form>`;
    } else if (L.paso === 'crear' || L.paso === 'confirmar') {
      card = `
        <h2>${L.paso === 'crear' ? `¡Hola, ${esc(L.primer)}! 👋` : 'Confírmalo'}</h2>
        <p class="muted small" style="margin:0">${L.paso === 'crear' ? 'Crea un PIN de 4 números. Lo usarás junto con tu celular para entrar.' : 'Escribe tu PIN otra vez.'}</p>
        <form id="f-pin">
          <input class="pin-input" name="pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="new-password" aria-label="PIN de 4 números" autofocus>
          <div class="msg" id="msg"></div>
          <button class="btn" type="submit">${L.paso === 'crear' ? 'Continuar' : 'Crear mi PIN'}</button>
        </form>
        <button class="link" data-act="volver">Volver</button>`;
    } else if (L.paso === 'pin') {
      card = `
        <h2>¡Hola de nuevo${L.primer ? ', ' + esc(L.primer) : ''}!</h2>
        <p class="muted small" style="margin:0">Escribe tu PIN de 4 números.</p>
        <form id="f-entrar">
          <input class="pin-input" name="pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="current-password" aria-label="PIN" autofocus>
          <div class="msg" id="msg"></div>
          <button class="btn" type="submit">Entrar</button>
        </form>
        <a class="link" href="${waLink(waNum(C.AGENCIA_WHATSAPP), `Hola, olvidé mi PIN de Mi Viaje. Mi celular es ${L.celular || ''}.`)}" target="_blank" rel="noopener">Olvidé mi PIN</a>
        <button class="link" data-act="volver">Usar otro celular</button>`;
    }
    $root.innerHTML = `
      <div class="login view">
        <div class="login-top">
          <div class="login-brand">Todo Viajes</div>
          <h1>Mi Viaje</h1>
          <p class="lead">Tu viaje. Todo en un solo lugar.</p>
        </div>
        <div class="login-card">${card}</div>
      </div>`;
    bindLogin();
  }

  function setMsg(t) { const m = document.getElementById('msg'); if (m) m.textContent = t || ''; }
  function busy(form, on) { const b = form.querySelector('button[type=submit]'); if (b) { b.disabled = on; if (on) { b.dataset.t = b.textContent; b.textContent = 'Un momento…'; } else if (b.dataset.t) b.textContent = b.dataset.t; } }

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
        if (r.estado === 'crear_pin') { L.paso = 'crear'; renderLogin(); }
        else if (r.estado === 'pedir_pin') { L.paso = 'pin'; renderLogin(); }
        else if (r.estado === 'bloqueado') setMsg('Demasiados intentos. Intenta de nuevo en unos minutos.');
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
        if (r.error) { setMsg(r.error); fe.pin.value = ''; busy(fe, false); return; }
        startSession(r.token, false);
      } catch (err) { setMsg(err.message); busy(fe, false); }
    };
    $root.querySelectorAll('.pin-input').forEach((i) => {
      i.addEventListener('input', () => { i.value = i.value.replace(/\D/g, '').slice(0, 4); if (i.value.length === 4) i.form.requestSubmit(); });
      setTimeout(() => i.focus(), 50);
    });
  }

  function startSession(tok, first) {
    S.token = tok; store.set(TOKEN_KEY, tok); S.login = { paso: 'id' };
    S.firstTime = first;
    load();
  }

  // ---------------- CARGA ----------------
  async function load(silent) {
    if (!silent) $root.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    try {
      const d = await rpc('mv_datos', { p_token: S.token });
      if (!d || d.error) { store.del(TOKEN_KEY); S.token = null; return renderLogin(); }
      S.data = d;
      const last = Number(store.get('mv_visita') || 0);
      if (Date.now() - last > 6 * 3600e3) { store.set('mv_visita', String(Date.now())); logEvent('visita'); }
      render();
    } catch (err) {
      $root.innerHTML = `<div class="empty view"><div style="font-size:2.4rem">📡</div><h2>Sin conexión</h2><p class="muted">${esc(err.message)}</p><button class="btn" id="retry">Reintentar</button></div>`;
      document.getElementById('retry').onclick = () => load();
    }
  }

  // ---------------- RENDER PRINCIPAL ----------------
  const TABS = [
    ['inicio', 'Inicio', '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>'],
    ['viaje', 'Mi viaje', '<rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7M3 12.5h18"/>'],
    ['beneficios', 'Beneficios', '<rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13M3 12h18M12 8S10.5 3.5 8 3.5 5.5 6 7 7.2 12 8 12 8s1.5-4.5 4-4.5 2.5 2.5 1 3.7S12 8 12 8"/>'],
    ['perfil', 'Perfil', '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>']
  ];
  function render() {
    const v = currentTrip();
    document.body.dataset.tema = (v && v.tema) || 'tropical';
    const views = { inicio: viewInicio, viaje: viewViaje, beneficios: viewBeneficios, perfil: viewPerfil };
    $root.innerHTML = `
      <div class="app"><div class="view" id="view">${views[S.tab]()}</div></div>
      <a class="help-fab" href="${helpLink()}" target="_blank" rel="noopener" aria-label="Ayuda por WhatsApp">${WA_SVG}</a>
      <nav class="tabbar">${TABS.map(([k, n, p]) => `<button class="tab ${S.tab === k ? 'on' : ''}" data-tab="${k}"><svg viewBox="0 0 24 24">${p}</svg>${n}</button>`).join('')}</nav>`;
    bindApp();
    requestAnimationFrame(() => document.querySelectorAll('.bar > i[data-w]').forEach((i) => i.style.width = i.dataset.w + '%'));
    if (S.firstTime) { S.firstTime = false; setTimeout(() => confetti(), 400); }
  }
  const WA_SVG = '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3a.5.5 0 0 0 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.4-.3z"/></svg>';

  // ---------- INICIO ----------
  function viewInicio() {
    const c = S.data.cliente, v = currentTrip();
    if (!v) return viewSinViaje();
    const st = stageOf(v), pr = progress(v), np = nextPayment(v);
    const img = v.imagen_url ? `<div class="hero-img" style="background-image:url('${esc(v.imagen_url)}')"></div>` : '';
    let count = '';
    if (st.k === 'futuro' || st.k === 'inminente') {
      const msg = st.d === 1 ? 'Mañana comienza tu aventura.' : st.d <= 7 ? 'Ya casi 🌴' : st.d <= 30 ? 'Ya casi. Ve preparando la maleta.' : 'para estar aquí';
      count = `<div class="count"><div><div class="count-num">${st.d}</div><div class="count-unit">${st.d === 1 ? 'día' : 'días'}</div></div><div class="count-msg">${msg}</div></div>`;
    } else if (st.k === 'hoy') count = `<div class="count"><div class="count-big">¡HOY VIAJAS! ✈️</div></div>`;
    else if (st.k === 'durante') count = `<div class="count"><div><div class="count-unit" style="margin:0 0 6px">Día</div><div class="count-num">${st.dia}<span style="font-size:1.6rem;opacity:.75">&nbsp;de ${st.total}</span></div></div><div class="count-msg">Hoy estás en ${esc(v.titulo)} ${esc(v.bandera || '')}</div></div>`;
    else count = `<div class="count"><div class="count-big">¡Bienvenido de vuelta! ❤️</div></div>`;

    const label = { futuro: 'Tu próxima aventura', inminente: 'Tu próxima aventura', hoy: 'Hoy comienza', durante: 'Estás viviendo', despues: 'Así fue tu viaje a' }[st.k];
    let html = `
      <header class="hero ${v.imagen_url ? 'has-img' : ''}">${img}
        <div class="hero-top"><span class="hero-brand">Mi Viaje · Todo Viajes</span><span class="chip">${esc(v.bandera || '🌎')} ${esc((v.viajeros || []).length > 1 ? (v.viajeros.length + ' viajeros') : 'Mi viaje')}</span></div>
        <div class="hello">Hola, ${esc(c.primer_nombre)} 👋</div>
        <div class="hero-label">${label}</div>
        <div class="hero-dest">${esc(v.titulo)}</div>
        <div class="hero-dates">${fmtRange(v.fecha_inicio, v.fecha_fin)}</div>
        ${count}
      </header>`;

    if (st.k === 'futuro' || st.k === 'inminente') {
      html += progressCard(pr);
      html += nextStep(v, np);
      html += `<div class="section"><div class="tiles">
        <button class="tile" data-go="viaje" data-anchor="pagos"><div class="ico">💳</div><div class="k">${np ? 'Próximo pago' : 'Pagos'}</div><div class="v">${np ? money(np.monto, v.moneda) : 'Liquidado'}</div><div class="s">${np ? (np.fecha ? 'antes del ' + fmtDay(np.fecha) : 'pendiente') : '¡Todo pagado! ✅'}</div></button>
        <button class="tile" data-go="viaje" data-anchor="docs"><div class="ico">📄</div><div class="k">Documentos</div><div class="v">${(v.documentos || []).length}</div><div class="s">${(v.documentos || []).length ? 'listos para consultar' : 'te avisaremos'}</div></button>
      </div></div>`;
      html += keySegments(v);
      if (st.k === 'inminente') html += checklistBlock(v, 'Antes de viajar');
    } else if (st.k === 'hoy') {
      html += `<div style="height:16px"></div>` + todayBlock(v, isoDay(today()), 'Tu día de viaje') + keySegments(v, true) + docsBlock(v);
    } else if (st.k === 'durante') {
      html += `<div style="height:16px"></div>` + todayBlock(v, isoDay(today()), 'Hoy') + keySegments(v, true);
    } else {
      html += despuesBlock(v);
    }
    const otros = upcomingTrips().filter((x) => x.id !== v.id);
    if (otros.length) html += `<div class="section"><div class="section-title"><h3>Tus próximos viajes</h3></div><div class="card">${otros.map((x) => `<button class="row" data-trip="${x.id}"><div class="ico">${esc(x.bandera || '🌎')}</div><div class="main"><div class="t">${esc(x.titulo)}</div><div class="d">${fmtRange(x.fecha_inicio, x.fecha_fin)}</div></div><div class="r">›</div></button>`).join('')}</div></div>`;
    return html + '<div style="height:20px"></div>';
  }

  function progressCard(pr) {
    const now = pr.steps.findIndex((s) => !s.ok);
    return `<div class="progress-card">
      <div class="progress-head"><span class="eyebrow">Tu viaje está</span><span class="progress-pct">${pr.pct}% listo</span></div>
      <div class="bar"><i data-w="${pr.pct}"></i></div>
      <div class="steps">${pr.steps.map((s, i) => `<div class="step ${s.ok ? 'done' : i === now ? 'now' : ''}"><b></b>${s.n}</div>`).join('')}</div>
    </div>`;
  }

  function nextStep(v, np) {
    const t = today();
    let ico = '✨', k = 'Tu siguiente paso', txt = '¡Todo listo! Solo falta disfrutar.', go = 'viaje', anchor = '';
    const pend = (v.checklist || []).find((c) => !c.completado && !c.solo_equipo);
    if (np && np.fecha && diffDays(t, pDate(np.fecha)) <= 15) { ico = '💳'; txt = `Pago de ${money(np.monto, v.moneda)} ${diffDays(t, pDate(np.fecha)) < 0 ? 'vencido el' : 'antes del'} ${fmtDay(np.fecha)}`; anchor = 'pagos'; }
    else if (pend) { ico = '☑️'; txt = pend.texto; anchor = 'check'; }
    else if (np) { ico = '💳'; txt = `Pago pendiente de ${money(np.monto, v.moneda)}`; anchor = 'pagos'; }
    else if ((v.documentos || []).length) { ico = '📄'; txt = 'Revisa tus documentos de viaje'; anchor = 'docs'; }
    return `<div class="section"><button class="next" data-go="${go}" data-anchor="${anchor}"><span class="ico">${ico}</span><span><small>${k}</small><strong>${esc(txt)}</strong></span><span class="arrow">›</span></button></div>`;
  }

  function segCard(s) {
    const meta = [];
    if (s.tipo === 'hotel') {
      if (s.inicio) meta.push(['Check-in', segDate(s.inicio) + ' · ' + segTime(s.inicio)]);
      if (s.fin) meta.push(['Check-out', segDate(s.fin) + ' · ' + segTime(s.fin)]);
    } else {
      if (s.inicio) meta.push([s.tipo === 'vuelo' ? 'Salida' : 'Fecha', segDate(s.inicio) + ' · ' + segTime(s.inicio)]);
      if (s.fin) meta.push([s.tipo === 'vuelo' ? 'Llegada' : 'Termina', segDate(s.fin) + ' · ' + segTime(s.fin)]);
    }
    if (s.proveedor) meta.push([s.tipo === 'vuelo' ? 'Aerolínea' : 'Proveedor', s.proveedor]);
    if (s.localizador) meta.push(['Clave', s.localizador]);
    const det = s.detalles || {};
    Object.keys(det).forEach((k) => { if (det[k]) meta.push([k, det[k]]); });
    return `<div class="seg">
      <div class="seg-type">${ICON[s.tipo] || '📌'} ${esc({ vuelo: 'Vuelo', hotel: 'Hotel', traslado: 'Traslado', actividad: 'Actividad', otro: 'Info' }[s.tipo])}</div>
      <div class="seg-title">${esc(s.titulo)}</div>
      ${s.lugar ? `<div class="muted small">📍 ${mapLink(s.lugar)}</div>` : ''}
      ${meta.length ? `<div class="seg-meta">${meta.map(([a, b]) => `<div><span>${esc(a)}</span><b>${esc(b)}</b></div>`).join('')}</div>` : ''}
      ${s.descripcion ? `<div class="seg-desc">${esc(s.descripcion)}</div>` : ''}
    </div>`;
  }
  const mapLink = (q) => `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}" target="_blank" rel="noopener">${esc(q)}</a>`;

  function keySegments(v, compact) {
    const segs = v.segmentos || [];
    const vuelo = segs.find((s) => s.tipo === 'vuelo'), hotel = segs.find((s) => s.tipo === 'hotel'), tras = segs.find((s) => s.tipo === 'traslado');
    const items = [vuelo, hotel, tras].filter(Boolean);
    if (!items.length) return '';
    return `<div class="section"><div class="section-title"><h3>${compact ? 'Lo importante' : 'Tu viaje'}</h3><button data-go="viaje">Ver todo</button></div><div class="card">${items.map(segCard).join('')}</div></div>`;
  }

  function dayItems(v, day) {
    const out = [];
    (v.segmentos || []).forEach((s) => {
      if (segDay(s.inicio) === day) out.push({ t: s.inicio, s, label: s.tipo === 'hotel' ? 'Check-in · ' + s.titulo : s.titulo });
      if (s.tipo === 'hotel' && segDay(s.fin) === day) out.push({ t: s.fin, s, label: 'Check-out · ' + s.titulo });
    });
    return out.sort((a, b) => String(a.t).localeCompare(String(b.t)));
  }
  function todayBlock(v, day, title) {
    const items = dayItems(v, day);
    return `<div class="section"><div class="section-title"><h3>${title}</h3></div><div class="card">${items.length ? `<div class="timeline">${items.map(tlItem).join('')}</div>` : `<div class="empty-day">Día libre. Disfruta ${esc(v.titulo)} ${esc(v.bandera || '')} — si necesitas algo, estamos a un mensaje.</div>`}</div></div>`;
  }
  const tlItem = (it) => `<div class="tl-item"><div class="tl-time">${segTime(it.t)}</div><div class="tl-dot"></div><div class="tl-body"><div class="t">${ICON[it.s.tipo] || ''} ${esc(it.label)}</div>${it.s.lugar ? `<div class="d">${esc(it.s.lugar)}</div>` : ''}${it.s.localizador ? `<div class="d">Clave: ${esc(it.s.localizador)}</div>` : ''}</div></div>`;

  function despuesBlock(v) {
    const dias = diffDays(pDate(v.fecha_inicio), pDate(v.fecha_fin)) + 1;
    const hotel = (v.segmentos || []).find((s) => s.tipo === 'hotel');
    const c = contactInfo(v);
    return `
      <div class="section" style="margin-top:20px"><div class="card" style="padding:22px">
        <div class="eyebrow">${esc(v.bandera || '')} Nuevo destino desbloqueado</div>
        <div class="seg-title" style="font-size:1.8rem">${esc(v.titulo)} ${pDate(v.fecha_inicio).getFullYear()}</div>
        <div class="seg-meta"><div><span>Días</span><b>🌴 ${dias}</b></div>${hotel ? `<div><span>Hotel</span><b>🏨 ${esc(hotel.titulo)}</b></div>` : ''}<div><span>Con</span><b>✈️ Todo Viajes</b></div></div>
        <button class="btn accent" data-act="share-trip">Compartir mi viaje</button>
      </div></div>
      <div class="section"><a class="next" href="${waLink(c.num, `Hola ${c.nombre.split(' ')[0]}, ya regresé de ${v.titulo}. ¡Quiero cotizar mi próximo viaje! ✈️`)}" target="_blank" rel="noopener"><span class="ico">🧭</span><span><small>¿Listo para el siguiente?</small><strong>Cotiza tu próxima aventura</strong></span><span class="arrow">›</span></a></div>
      <div class="section"><button class="next" style="background:var(--accent)" data-go="beneficios"><span class="ico">🎁</span><span><small>Invita y viaja</small><strong>Comparte tu código ${esc(S.data.cliente.codigo_referido)}</strong></span><span class="arrow">›</span></button></div>`;
  }

  function viewSinViaje() {
    const c = S.data.cliente;
    return `<div class="page-head"><div class="eyebrow">Mi Viaje · Todo Viajes</div><h1>Hola, ${esc(c.primer_nombre)} 👋</h1></div>
      <div class="section"><div class="card" style="padding:24px;text-align:center"><div style="font-size:2.4rem">🧭</div>
        <div class="seg-title">${pastTrips().length ? '¿Listo para el siguiente?' : 'Tu próximo viaje aparecerá aquí'}</div>
        <p class="muted">Cuando reserves con Todo Viajes, todo tu viaje estará en esta app.</p>
        <a class="btn" href="${waLink(waNum(C.AGENCIA_WHATSAPP), `Hola, soy ${c.primer_nombre}. ¡Quiero cotizar un viaje! ✈️`)}" target="_blank" rel="noopener">Cotizar un viaje</a></div></div>
      ${pastTrips().length ? passportBlock() : ''}`;
  }

  // ---------- MI VIAJE ----------
  function viewViaje() {
    const v = currentTrip();
    if (!v) return viewSinViaje();
    const vs = (S.data.viajes || []).filter((x) => pDate(x.fecha_fin) >= today() || x.id === v.id);
    const segs = v.segmentos || [];
    const by = (t) => segs.filter((s) => s.tipo === t);
    let html = `<div class="page-head">
      ${vs.length > 1 ? `<div class="days" style="padding-left:0">${vs.map((x) => `<button class="day-pill ${x.id === v.id ? 'on' : ''}" data-trip="${x.id}"><small>${fmtDay(x.fecha_inicio)}</small><b>${esc(x.bandera || '')} ${esc(x.titulo)}</b></button>`).join('')}</div>` : ''}
      <div class="eyebrow">${esc(v.bandera || '')} ${esc(v.destino)}</div>
      <h1>${esc(v.titulo)}</h1>
      <div class="muted" style="font-weight:600">${fmtRange(v.fecha_inicio, v.fecha_fin)}</div>
      ${(v.viajeros || []).length > 1 ? `<div class="muted small" style="margin-top:6px">👥 ${v.viajeros.map(esc).join(', ')}</div>` : ''}
    </div>`;
    [['vuelo', 'Vuelos'], ['hotel', 'Hospedaje'], ['traslado', 'Traslados'], ['actividad', 'Actividades'], ['otro', 'Información']].forEach(([t, n]) => {
      const l = by(t); if (l.length) html += `<div class="section"><div class="section-title"><h3>${n}</h3></div><div class="card">${l.map(segCard).join('')}</div></div>`;
    });
    html += itineraryBlock(v);
    html += docsBlock(v);
    html += paymentsBlock(v);
    html += checklistBlock(v, 'Checklist');
    if (v.incluye) html += `<div class="section"><div class="section-title"><h3>Tu viaje incluye</h3></div><div class="card seg"><div class="seg-desc" style="margin:0;color:var(--ink)">${esc(v.incluye)}</div></div></div>`;
    if (v.notas) html += `<div class="section"><div class="section-title"><h3>Importante</h3></div><div class="card seg"><div class="seg-desc" style="margin:0;color:var(--ink)">${esc(v.notas)}</div></div></div>`;
    const c = contactInfo(v);
    html += `<div class="section"><div class="card"><a class="row" href="${helpLink()}" target="_blank" rel="noopener"><div class="ico">💬</div><div class="main"><div class="t">Estamos contigo</div><div class="d">${esc(c.nombre)}${v.asesor && v.asesor.sucursal ? ' · ' + esc(v.asesor.sucursal) : ''} · WhatsApp</div></div><div class="r">›</div></a></div></div>`;
    return html + '<div style="height:20px"></div>';
  }

  function itineraryBlock(v) {
    const ini = pDate(v.fecha_inicio), n = diffDays(ini, pDate(v.fecha_fin)) + 1;
    if (n > 60 || !(v.segmentos || []).length) return '';
    const days = [];
    for (let i = 0; i < n; i++) { const d = new Date(ini); d.setDate(d.getDate() + i); days.push(d); }
    const tday = isoDay(today());
    if (!S.day || !days.some((d) => isoDay(d) === S.day)) S.day = days.some((d) => isoDay(d) === tday) ? tday : isoDay(days[0]);
    return `<div class="section" id="itinerario"><div class="section-title"><h3>Itinerario</h3></div>
      <div class="days">${days.map((d, i) => `<button class="day-pill ${isoDay(d) === S.day ? 'on' : ''}" data-day="${isoDay(d)}"><small>Día ${i + 1}</small><b>${d.getDate()}</b><small>${DIAS[d.getDay()]}</small></button>`).join('')}</div>
      <div class="card">${(() => { const it = dayItems(v, S.day); return it.length ? `<div class="timeline">${it.map(tlItem).join('')}</div>` : '<div class="empty-day">☀️ Día libre para disfrutar.</div>'; })()}</div></div>`;
  }

  function docsBlock(v) {
    const docs = v.documentos || [];
    return `<div class="section" id="docs"><div class="section-title"><h3>Documentos</h3></div><div class="card">${docs.length ? docs.map((d) => `<button class="row" data-doc="${d.id}"><div class="ico">${DOCICON[d.tipo] || '📄'}</div><div class="main"><div class="t">${esc(d.nombre)}</div><div class="d">${DOCNAME[d.tipo] || 'Documento'}</div></div><div class="r">Abrir ›</div></button>`).join('') : '<div class="empty-day">Aquí aparecerán tus vouchers, boletos y confirmaciones en cuanto estén listos.</div>'}</div></div>`;
  }

  function paymentsBlock(v) {
    const total = Number(v.total || 0), pag = Number(v.pagado || 0), pend = Math.max(0, total - pag), np = nextPayment(v);
    if (!total && !(v.pagos || []).length) return '';
    const pct = total ? Math.min(100, Math.round(pag / total * 100)) : 100;
    return `<div class="section" id="pagos"><div class="section-title"><h3>Pagos</h3>${pend <= 0.01 ? '<span class="pill ok">Liquidado</span>' : ''}</div>
      <div class="card">
        <div class="money">
          <div class="full"><div><span>Total del viaje</span><b>${money(total, v.moneda)}</b></div><div class="muted small">${pct}% pagado</div></div>
          <div><span>Pagado</span><b style="color:var(--ok)">${money(pag, v.moneda)}</b></div>
          <div><span>Pendiente</span><b>${money(pend, v.moneda)}</b></div>
          ${np && np.fecha ? `<div class="full"><div><span>Próximo pago</span><b>${money(np.monto, v.moneda)}</b></div><span class="pill ${diffDays(today(), pDate(np.fecha)) < 0 ? 'warn' : ''}">${diffDays(today(), pDate(np.fecha)) < 0 ? 'Vencido ' : 'Antes del '}${fmtDay(np.fecha)}</span></div>` : ''}
        </div>
        <div style="padding:0 18px"><div class="bar" style="margin:14px 0"><i data-w="${pct}"></i></div></div>
        ${(v.plan_pagos || []).length ? `<div class="eyebrow" style="padding:6px 18px 0">Calendario</div>${v.plan_pagos.map((p) => `<div class="row"><div class="main"><div class="t">${money(p.monto, v.moneda)}</div><div class="d">${esc(p.descripcion || 'Pago')}</div></div><div class="r">${fmtDay(p.fecha)}</div></div>`).join('')}` : ''}
        ${(v.pagos || []).length ? `<div class="eyebrow" style="padding:14px 18px 0">Pagos recibidos</div>${v.pagos.map((p) => `<div class="row"><div class="ico" style="background:rgba(31,157,99,.12)">✓</div><div class="main"><div class="t">${money(p.monto, v.moneda)}</div><div class="d">${esc(p.metodo || 'Pago recibido')}</div></div><div class="r">${fmtDay(p.fecha)}</div></div>`).join('')}` : ''}
      </div></div>`;
  }

  function checklistBlock(v, title) {
    const cl = v.checklist || [];
    if (!cl.length) return '';
    const done = cl.filter((c) => c.completado).length;
    return `<div class="section" id="check"><div class="section-title"><h3>${title}</h3><span class="muted small" style="font-weight:700">${done}/${cl.length}</span></div><div class="card">
      ${cl.map((c) => `<button class="check ${c.completado ? 'on' : ''} ${c.solo_equipo ? 'locked' : ''}" data-check="${c.id}" ${c.solo_equipo ? 'disabled' : ''}><span class="box"></span><span class="txt">${esc(c.texto)}</span>${c.solo_equipo ? '<span class="lock">Todo Viajes</span>' : ''}</button>`).join('')}
    </div></div>`;
  }

  // ---------- BENEFICIOS ----------
  function shareText() {
    const c = S.data.cliente, p = S.data.promo || {};
    const base = (p.mensaje || '¡Viaja con Todo Viajes! Usa mi código {codigo}.').replace(/\{codigo\}/g, c.codigo_referido).replace(/\{recompensa\}/g, p.nuevo_texto || 'un beneficio especial');
    return base + '\n\nEscríbeles aquí: ' + waLink(waNum(C.AGENCIA_WHATSAPP), `Hola, vengo recomendado con el código ${c.codigo_referido} ✈️`);
  }
  function viewBeneficios() {
    const c = S.data.cliente, p = S.data.promo || {}, r = S.data.referidos || { total: 0, lista: [] }, rec = S.data.recompensas || [];
    const disp = rec.filter((x) => x.estado === 'disponible');
    let html = `<div class="page-head"><div class="eyebrow">Beneficios</div><h1>Invita y viaja</h1></div>`;
    if (p.activo) {
      html += `<div class="section" style="margin-top:10px"><div class="invite">
        <div class="eyebrow" style="color:rgba(255,255,255,.7)">🎁 Comparte Todo Viajes</div>
        <h2>Tus amigos viajan con ${esc(p.nuevo_texto || 'un beneficio')}</h2>
        ${p.referidor_texto ? `<p>Y cuando reserven con tu código, tú recibes: <b>${esc(p.referidor_texto)}</b>.</p>` : ''}
        <div class="code"><small>TU CÓDIGO</small><b>${esc(c.codigo_referido)}</b></div>
        <a class="btn wa" data-act="share-wa" href="${waLink('', shareText())}" target="_blank" rel="noopener">${WA_SVG.replace('<svg', '<svg width="20" height="20" fill="#fff"')} Compartir por WhatsApp</a>
        <div class="row-btns"><button class="btn light" data-act="share">Otras apps</button><button class="btn light" data-act="copy">Copiar código</button></div>
      </div></div>`;
    } else {
      html += `<div class="section"><div class="card seg"><div class="seg-desc" style="margin:0">El programa de referidos está en pausa por ahora. ¡Pronto volverá con nuevos beneficios!</div></div></div>`;
    }
    html += `<div class="section"><div class="stats">
      <div class="stat"><b>${r.total}</b><span>${r.total === 1 ? 'amigo reservó' : 'amigos reservaron'} con tu código</span></div>
      <div class="stat"><b>${disp.length}</b><span>${disp.length === 1 ? 'recompensa disponible' : 'recompensas disponibles'}</span></div>
    </div></div>`;
    if ((r.lista || []).length) html += `<div class="section"><div class="section-title"><h3>Tus invitados</h3></div><div class="card">${r.lista.map((x) => `<div class="row"><div class="ico">🟢</div><div class="main"><div class="t">${esc(x.nombre)}</div><div class="d">Reservó con tu código</div></div><div class="r">${fmtDay(x.fecha)}</div></div>`).join('')}</div></div>`;
    html += `<div class="section"><div class="section-title"><h3>Mis recompensas</h3></div><div class="card">${rec.length ? rec.map((x) => `<div class="row"><div class="ico">${x.estado === 'disponible' ? '🎁' : '✔️'}</div><div class="main"><div class="t">${esc(x.descripcion)}</div><div class="d">${fmtDay(x.creado_en)}</div></div><div class="r"><span class="pill ${x.estado === 'disponible' ? 'ok' : ''}">${x.estado === 'disponible' ? 'Disponible' : x.estado === 'usada' ? 'Usada' : 'Cancelada'}</span></div></div>`).join('') : '<div class="empty-day">Aún no tienes recompensas. Comparte tu código y empieza a ganar 🎁</div>'}</div>
      ${disp.length ? '<p class="muted small" style="margin:10px 4px">Para usar una recompensa, menciónala a tu asesor al reservar.</p>' : ''}</div>`;
    return html + '<div style="height:20px"></div>';
  }

  // ---------- PERFIL ----------
  function passportBlock() {
    const past = pastTrips();
    return `<div class="section"><div class="section-title"><h3>Mi pasaporte</h3><span class="muted small" style="font-weight:700">${past.length} ${past.length === 1 ? 'destino' : 'destinos'}</span></div>
      ${past.length ? `<div class="stamps">${past.slice().reverse().map((v) => { const d = pDate(v.fecha_inicio); return `<div class="stamp"><div class="f">${esc(v.bandera || '🌎')}</div><b>${esc(v.titulo)}</b><small>${MES3[d.getMonth()]} ${d.getFullYear()}</small></div>`; }).join('')}</div>` : '<div class="card"><div class="empty-day">Cada viaje que termines se convertirá en un sello de tu pasaporte ✈️</div></div>'}</div>`;
  }
  function viewPerfil() {
    const c = S.data.cliente;
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent), standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    return `<div class="page-head"><div class="eyebrow">Perfil</div><h1>${esc(c.nombre)}</h1><div class="muted">📱 ${esc(c.celular.replace(/(\d{2})(\d{4})(\d{4})/, '$1 $2 $3'))}</div></div>
      ${passportBlock()}
      <div class="section"><div class="section-title"><h3>Mis viajes</h3></div><div class="card">${(S.data.viajes || []).length ? S.data.viajes.slice().reverse().map((v) => `<button class="row" data-trip="${v.id}" data-go="viaje"><div class="ico">${esc(v.bandera || '🌎')}</div><div class="main"><div class="t">${esc(v.titulo)}</div><div class="d">${fmtRange(v.fecha_inicio, v.fecha_fin)}</div></div><div class="r">${pDate(v.fecha_fin) < today() ? 'Completado' : 'Próximo'}</div></button>`).join('') : '<div class="empty-day">Aún no tienes viajes.</div>'}</div></div>
      ${!standalone ? `<div class="section"><div class="card"><button class="row" data-act="install"><div class="ico">📲</div><div class="main"><div class="t">Agrégala a tu pantalla de inicio</div><div class="d">${ios ? 'Toca Compartir ↑ y luego "Agregar a inicio"' : 'Para abrir Mi Viaje como una app'}</div></div><div class="r">›</div></button></div></div>` : ''}
      <div class="section"><div class="section-title"><h3>Todo Viajes</h3></div><div class="card">
        <a class="row" href="${waLink(waNum(C.AGENCIA_WHATSAPP), 'Hola, tengo una duda.')}" target="_blank" rel="noopener"><div class="ico">💬</div><div class="main"><div class="t">WhatsApp</div><div class="d">Estamos contigo si necesitas ayuda</div></div><div class="r">›</div></a>
        ${C.AGENCIA_TELEFONO ? `<a class="row" href="tel:${esc(C.AGENCIA_TELEFONO)}"><div class="ico">📞</div><div class="main"><div class="t">Llamar</div><div class="d">${esc(C.AGENCIA_TELEFONO)}</div></div><div class="r">›</div></a>` : ''}
        <button class="row" data-act="logout"><div class="ico">↩︎</div><div class="main"><div class="t">Cerrar sesión</div><div class="d">Tu información queda protegida</div></div></button>
      </div></div>
      <p class="muted small" style="text-align:center;margin:24px 0">Mi Viaje by Todo Viajes · Tu viaje. Todo en un solo lugar.</p>`;
  }

  // ---------------- EVENTOS ----------------
  let deferredInstall = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; });

  function bindApp() {
    $root.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => { S.tab = b.dataset.tab; render(); window.scrollTo(0, 0); });
    $root.querySelectorAll('[data-trip]').forEach((b) => b.addEventListener('click', () => { S.tripId = b.dataset.trip; S.day = null; if (!b.dataset.go) { render(); window.scrollTo(0, 0); } }));
    $root.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => {
      S.tab = b.dataset.go; render();
      const a = b.dataset.anchor && document.getElementById(b.dataset.anchor);
      if (a) a.scrollIntoView({ behavior: 'smooth', block: 'start' }); else window.scrollTo(0, 0);
    }));
    $root.querySelectorAll('[data-day]').forEach((b) => b.onclick = () => { S.day = b.dataset.day; const y = window.scrollY; render(); window.scrollTo(0, y); });
    $root.querySelectorAll('[data-doc]').forEach((b) => b.onclick = () => openDoc(b.dataset.doc));
    $root.querySelectorAll('[data-check]').forEach((b) => b.onclick = () => toggleCheck(b));
    const act = (n, fn) => $root.querySelectorAll(`[data-act=${n}]`).forEach((b) => b.addEventListener('click', fn));
    act('logout', async () => { try { await rpc('mv_salir', { p_token: S.token }); } catch (e) {} store.del(TOKEN_KEY); S.token = null; S.data = null; S.tab = 'inicio'; renderLogin(); });
    act('copy', async () => { try { await navigator.clipboard.writeText(S.data.cliente.codigo_referido); toast('Código copiado ✓'); } catch (e) { toast(S.data.cliente.codigo_referido); } logEvent('compartir_codigo', { via: 'copiar' }); });
    act('share-wa', () => logEvent('compartir_codigo', { via: 'whatsapp' }));
    act('share', async () => {
      logEvent('compartir_codigo', { via: 'apps' });
      if (navigator.share) { try { await navigator.share({ title: 'Todo Viajes', text: shareText() }); } catch (e) {} }
      else { try { await navigator.clipboard.writeText(shareText()); toast('Mensaje copiado ✓'); } catch (e) {} }
    });
    act('share-trip', async () => {
      const v = currentTrip();
      const t = `${v.bandera || '🌴'} ${v.titulo} ${pDate(v.fecha_inicio).getFullYear()} — un viaje increíble con Todo Viajes ✈️\n¿Quieres viajar? Usa mi código ${S.data.cliente.codigo_referido}.`;
      logEvent('compartir_viaje');
      if (navigator.share) { try { await navigator.share({ text: t }); } catch (e) {} } else { try { await navigator.clipboard.writeText(t); toast('Texto copiado ✓'); } catch (e) {} }
    });
    act('install', async () => { if (deferredInstall) { deferredInstall.prompt(); deferredInstall = null; } else toast('Usa el menú del navegador → "Agregar a inicio"'); });
  }

  async function toggleCheck(b) {
    const v = currentTrip(), item = (v.checklist || []).find((c) => c.id === b.dataset.check);
    if (!item || item.solo_equipo) return;
    item.completado = !item.completado;
    b.classList.toggle('on', item.completado);
    try {
      const r = await rpc('mv_checklist', { p_token: S.token, p_item: item.id, p_completado: item.completado });
      if (r && r.error) throw new Error();
      const all = v.checklist.every((c) => c.completado);
      if (all && item.completado) { confetti(); toast('¡Todo listo para tu viaje! 🎉'); }
      const y = window.scrollY; render(); window.scrollTo(0, y);
    } catch (e) { item.completado = !item.completado; b.classList.toggle('on', item.completado); toast('No se pudo guardar, intenta de nuevo'); }
  }

  async function openDoc(id) {
    const w = window.open('', '_blank');
    if (w) w.document.write('<p style="font-family:sans-serif;padding:24px">Abriendo documento…</p>');
    try {
      const r = await fetch('/api/documento', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: S.token, id }) });
      const j = await r.json();
      if (!r.ok || !j.url) throw new Error(j.error || 'No disponible');
      if (w) w.location.href = j.url; else window.location.href = j.url;
    } catch (e) { if (w) w.close(); toast('No pudimos abrir el documento'); }
  }

  // Celebración ligera (sin librerías)
  function confetti() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cv = document.createElement('canvas'); cv.className = 'confetti'; document.body.appendChild(cv);
    const ctx = cv.getContext('2d'), W = cv.width = innerWidth, H = cv.height = innerHeight;
    const cs = getComputedStyle(document.body), cols = [cs.getPropertyValue('--accent'), cs.getPropertyValue('--accent-2'), '#ffffff', '#15171B'];
    const P = Array.from({ length: 90 }, () => ({ x: W / 2, y: H * 0.35, vx: (Math.random() - .5) * 12, vy: -Math.random() * 12 - 4, s: Math.random() * 6 + 4, r: Math.random() * 6, c: cols[Math.floor(Math.random() * cols.length)] }));
    let f = 0;
    (function tick() {
      ctx.clearRect(0, 0, W, H);
      P.forEach((p) => { p.vy += .35; p.x += p.vx; p.y += p.vy; p.r += .1; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore(); });
      if (++f < 110) requestAnimationFrame(tick); else cv.remove();
    })();
  }

  // ---------------- INICIO ----------------
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  S.token = store.get(TOKEN_KEY);
  if (!C.SUPABASE_URL || C.SUPABASE_URL.includes('TU-PROYECTO')) {
    $root.innerHTML = '<div class="empty"><h2>Falta configurar</h2><p class="muted">Agrega la URL y la clave pública de Supabase en config.js</p></div>';
  } else if (S.token) load(); else renderLogin();
  document.addEventListener('visibilitychange', () => { if (!document.hidden && S.token && S.data) load(true); });
})();
