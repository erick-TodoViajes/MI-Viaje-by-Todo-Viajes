/* PANEL TODO VIAJES — administración de Mi Viaje */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const C = window.MV_CONFIG;
const sb = createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);
const $root = document.getElementById('root');
const $modal = document.getElementById('modal');
const APP_URL = (C.APP_URL || location.origin).replace(/\/$/, '');
let ME = null;
const IP = {
  home: '<path d="M3.5 10.5 12 4l8.5 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-4v-5.5h-6v5.5H5A1.5 1.5 0 0 1 3.5 19z"/>',
  suitcase: '<rect x="4" y="7" width="16" height="12.5" rx="2"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M9 7v12.5M15 7v12.5"/>',
  users: '<circle cx="9" cy="8.5" r="3.5"/><path d="M2.5 19.5c1-3.2 3.5-5 6.5-5s5.5 1.8 6.5 5M15.5 5.2a3.5 3.5 0 0 1 0 6.6M17.5 14.7c2 .6 3.4 2.2 4 4.8"/>',
  gift: '<rect x="3.5" y="8.5" width="17" height="4" rx="1"/><path d="M5 12.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-6.5M12 8.5v12M12 8.5S10.8 4 8.3 4a2.2 2.2 0 0 0 0 4.5H12m0 0s1.2-4.5 3.7-4.5a2.2 2.2 0 0 1 0 4.5H12"/>',
  copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2"/><path d="M15.5 8.5V5a1.5 1.5 0 0 0-1.5-1.5H5A1.5 1.5 0 0 0 3.5 5v9A1.5 1.5 0 0 0 5 15.5h3.5"/>',
  badge: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c1.4-3.6 4.2-5.5 7.5-5.5s6.1 1.9 7.5 5.5"/>',
  plane: '<path d="M2.5 19.5h19M3.8 13.6l2.6 1.9 13.4-4.7a1.6 1.6 0 0 0-1-3l-4.4 1.4-6-4.4-2 .7 3.6 4.8-3.7 1.2L4.2 8.3l-1.5.6z"/>',
  card: '<rect x="2.5" y="5.5" width="19" height="13" rx="2"/><path d="M2.5 10h19M6.5 15h3"/>'
};
const pic = (n) => `<svg class="pi" viewBox="0 0 24 24" aria-hidden="true">${IP[n]}</svg>`;

// ---------------- utilidades ----------------
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MES3 = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const pDate = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
const fDate = (s) => { if (!s) return ''; const d = pDate(s); return `${d.getDate()} ${MES3[d.getMonth()]} ${d.getFullYear()}`; };
const fDT = (iso) => { if (!iso) return ''; const d = new Date(iso); return `${d.getDate()} ${MES3[d.getMonth()]} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const today = () => { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); };
const isoDay = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const money = (n, cur) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: cur || 'MXN' }).format(Number(n || 0));
// Horas de segmentos = "hora local del lugar", guardadas sin conversión (UTC)
const toLocalInput = (iso) => iso ? new Date(iso).toISOString().slice(0, 16) : '';
const fromLocalInput = (v) => v ? v + ':00+00:00' : null;
const segWhen = (iso) => { if (!iso) return ''; const d = new Date(iso); return `${d.getUTCDate()} ${MES3[d.getUTCMonth()]} · ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; };
const cel = (c) => String(c || '').replace(/(\d{2})(\d{4})(\d{4})/, '$1 $2 $3');
const waNum = (n) => { const d = String(n || '').replace(/\D/g, ''); return d.length === 10 ? '52' + d : d; };
const waLink = (n, t) => 'https://wa.me/' + waNum(n) + '?text=' + encodeURIComponent(t);
const ICON = { vuelo: '✈️', hotel: '🏨', traslado: '🚐', actividad: '🌴', otro: '📌' };
const TEMAS = [['tropical', 'Tropical / playa'], ['europa', 'Europa / cultural'], ['aventura', 'Aventura / naturaleza'], ['urbano', 'Urbano / ciudad'], ['mexico', 'México'], ['crucero', 'Crucero'], ['otro', 'Otro']];
const DOCTIPOS = [['voucher', 'Voucher'], ['confirmacion', 'Confirmación'], ['boleto', 'Boleto de avión'], ['seguro', 'Seguro'], ['itinerario', 'Itinerario'], ['otro', 'Otro']];
const CHECK_DEFAULT = [
  ['Reserva confirmada', true, true], ['Hotel confirmado', true, false],
  ['Revisar mis documentos de viaje', false, false], ['Identificación / pasaporte vigente', false, false],
  ['Equipaje listo', false, false], ['Hacer check-in del vuelo', false, false], ['Revisar horario del traslado', false, false]
];

function toast(m) { const t = document.getElementById('toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2400); }
function fail(e) { console.error(e); toast('Error: ' + (e.message || e)); }
async function q(p) { const { data, error } = await p; if (error) throw error; return data; }
const formData = (f) => Object.fromEntries(new FormData(f).entries());
const opt = (list, v) => list.map(([k, n]) => `<option value="${k}" ${k === v ? 'selected' : ''}>${esc(n)}</option>`).join('');

function modal(title, body, onSave, saveText = 'Guardar') {
  $modal.innerHTML = `<div class="bg"><form class="box"><h3>${esc(title)}</h3><div class="bd">${body}</div><div class="ft"><button type="button" class="btn sec" data-x>Cancelar</button>${onSave ? `<button class="btn" type="submit">${saveText}</button>` : ''}</div></form></div>`;
  const form = $modal.querySelector('form');
  $modal.querySelector('[data-x]').onclick = closeModal;
  $modal.querySelector('.bg').addEventListener('mousedown', (e) => { if (e.target.classList.contains('bg')) closeModal(); });
  form.onsubmit = async (e) => {
    e.preventDefault();
    const b = form.querySelector('[type=submit]'); b.disabled = true;
    try { const r = await onSave(form); if (r !== false) closeModal(); } catch (err) { fail(err); }
    b.disabled = false;
  };
  const first = form.querySelector('input,select,textarea'); if (first) first.focus();
  return form;
}
function closeModal() { $modal.innerHTML = ''; }

function accessMessage(cli, viaje) {
  const n = cli.nombre_completo.split(' ')[0];
  return `¡Hola ${n}! ✈️ ${viaje ? `Tu viaje a ${viaje.titulo} ya está en *Mi Viaje*` : 'Ya tienes acceso a *Mi Viaje*'}, donde encontrarás tu itinerario, pagos, documentos y más.\n\nEntra aquí: ${APP_URL}\n\nUsa tu nombre completo y este celular. La primera vez crearás un PIN de 4 números. 😊\n— ${C.AGENCIA_NOMBRE || 'Todo Viajes'}`;
}

// ---------------- auth ----------------
async function boot() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return renderLogin();
  const { data: eq } = await sb.from('equipo').select('*').eq('id', session.user.id).maybeSingle();
  if (!eq || !eq.activo) {
    $root.innerHTML = `<div class="login"><div class="box"><h1>Sin acceso</h1><p class="muted">Tu usuario (${esc(session.user.email)}) no está dado de alta en el equipo. Pide a un administrador que te agregue.</p><button class="btn sec" id="out">Salir</button></div></div>`;
    document.getElementById('out').onclick = async () => { await sb.auth.signOut(); renderLogin(); };
    return;
  }
  ME = { ...eq, email: session.user.email };
  route();
}
function renderLogin() {
  $root.innerHTML = `<div class="login"><form class="box" id="lf"><img src="/assets/logo.png" alt="Todo Viajes" class="login-logo"><h1>Panel Mi Viaje</h1><p class="muted" style="margin:0">Entra con tu correo del equipo.</p>
    <div class="form" style="margin-top:16px"><div class="f c12"><label>Correo</label><input name="email" type="email" required autocomplete="username"></div>
    <div class="f c12"><label>Contraseña</label><input name="password" type="password" required autocomplete="current-password"></div></div>
    <div class="err" id="err"></div><button class="btn" style="width:100%;justify-content:center;margin-top:8px">Entrar</button></form></div>`;
  document.getElementById('lf').onsubmit = async (e) => {
    e.preventDefault();
    const { email, password } = formData(e.target);
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) document.getElementById('err').textContent = 'Correo o contraseña incorrectos';
    else boot();
  };
}

// ---------------- layout y rutas ----------------
const NAV = [['#/', 'Inicio', 'home'], ['#/viajes', 'Viajes', 'suitcase'], ['#/clientes', 'Clientes', 'users'], ['#/referidos', 'Referidos', 'gift'], ['#/plantillas', 'Plantillas', 'copy'], ['#/equipo', 'Equipo', 'badge']];
function shell(content) {
  const h = location.hash || '#/';
  const on = (k) => (k === '#/' ? h === '#/' || h === '' : h.startsWith(k.replace(/s$/, ''))) ? 'on' : '';
  $root.innerHTML = `<div class="layout"><aside class="side"><div class="brand"><img src="/assets/logo-white.png" alt="Todo Viajes"><small>Panel Mi Viaje</small></div>
    <nav class="nav">${NAV.map(([k, n, i]) => `<a href="${k}" class="${on(k)}">${pic(i)}<span>${n}</span></a>`).join('')}</nav>
    <div class="me">${esc(ME.nombre)}<br><span class="muted">${esc(ME.rol)}</span><br><button id="logout">Cerrar sesión</button></div></aside>
    <main class="main" id="main">${content}</main></div>`;
  const lo = document.getElementById('logout'); if (lo) lo.onclick = async () => { await sb.auth.signOut(); renderLogin(); };
}
async function route() {
  const h = (location.hash || '#/').slice(1).split('?')[0];
  const [, a, b] = h.split('/');
  shell('<div class="center" style="min-height:50vh"><div class="spinner"></div></div>');
  try {
    if (!a) await pInicio();
    else if (a === 'viajes') await pViajes();
    else if (a === 'viaje' && b === 'nuevo') await pViajeNuevo();
    else if (a === 'viaje') await pViaje(b);
    else if (a === 'clientes') await pClientes();
    else if (a === 'cliente') await pCliente(b);
    else if (a === 'referidos') await pReferidos();
    else if (a === 'plantillas') await pPlantillas();
    else if (a === 'equipo') await pEquipo();
    else location.hash = '#/';
  } catch (e) { fail(e); document.getElementById('main').innerHTML = `<div class="card"><div class="card-b">No se pudo cargar: ${esc(e.message)}</div></div>`; }
}
window.addEventListener('hashchange', () => { closeModal(); route(); });
const setMain = (html) => { document.getElementById('main').innerHTML = html; };
const qs = () => new URLSearchParams((location.hash.split('?')[1]) || '');

// ---------------- INICIO ----------------
async function pInicio() {
  const hoy = isoDay(today());
  const [prox, nCli, act, viajesPend] = await Promise.all([
    q(sb.from('viajes').select('id,titulo,bandera,fecha_inicio,fecha_fin,viaje_viajeros(clientes(nombre_completo))').eq('estado', 'confirmado').gte('fecha_fin', hoy).order('fecha_inicio').limit(8)),
    sb.from('clientes').select('id', { count: 'exact', head: true }),
    q(sb.from('actividad').select('evento,creado_en,detalle,clientes(id,nombre_completo)').order('creado_en', { ascending: false }).limit(15)),
    q(sb.from('viajes').select('id,titulo,total,moneda,fecha_inicio,pagos(monto),plan_pagos(fecha_limite,monto)').eq('estado', 'confirmado').gte('fecha_fin', hoy))
  ]);
  const vencidos = [];
  viajesPend.forEach((v) => {
    const pag = (v.pagos || []).reduce((s, p) => s + Number(p.monto), 0);
    let cum = 0;
    (v.plan_pagos || []).sort((a, b) => a.fecha_limite.localeCompare(b.fecha_limite)).forEach((p) => { cum += Number(p.monto); if (cum > pag + 0.01 && p.fecha_limite <= isoDay(new Date(Date.now() + 7 * 864e5)) && !vencidos.find((x) => x.v.id === v.id)) vencidos.push({ v, p, falta: cum - pag }); });
  });
  const EV = { entrada: 'entró a la app', visita: 'abrió la app', ver_documento: 'vio un documento', checklist: 'actualizó su checklist', compartir_codigo: 'compartió su código', compartir_viaje: 'compartió su viaje' };
  setMain(`<div class="top"><div><h1>Hola, ${esc(ME.nombre.split(' ')[0])}</h1><div class="sub">Así va Mi Viaje hoy.</div></div><div class="btns"><a class="btn sec" href="#/clientes?nuevo=1">+ Cliente</a><a class="btn" href="#/viaje/nuevo">+ Nuevo viaje</a></div></div>
    <div class="grid3" style="margin-bottom:18px"><div class="kpi">${pic('plane')}<b>${prox.length}</b><span>viajes próximos o en curso</span></div><div class="kpi">${pic('users')}<b>${nCli.count || 0}</b><span>clientes</span></div><div class="kpi ${vencidos.length ? 'alert' : ''}">${pic('card')}<b>${vencidos.length}</b><span>pagos vencidos o por vencer (7 días)</span></div></div>
    <div class="grid2"><div>
      <div class="card"><div class="card-h"><h2>Próximos viajes</h2><a href="#/viajes">Ver todos</a></div>${prox.length ? `<table>${prox.map((v) => `<tr class="click" data-href="#/viaje/${v.id}"><td>${esc(v.bandera || '')} <b>${esc(v.titulo)}</b><div class="small muted">${esc((v.viaje_viajeros || []).map((x) => x.clientes && x.clientes.nombre_completo).filter(Boolean).join(', '))}</div></td><td class="small">${fDate(v.fecha_inicio)}</td></tr>`).join('')}</table>` : '<div class="empty">Sin viajes próximos.</div>'}</div>
      <div class="card"><div class="card-h"><h2>Pagos por atender</h2></div>${vencidos.length ? `<table>${vencidos.map(({ v, p, falta }) => `<tr class="click" data-href="#/viaje/${v.id}"><td><b>${esc(v.titulo)}</b><div class="small muted">${money(Math.min(falta, p.monto), v.moneda)}</div></td><td><span class="pill ${p.fecha_limite < isoDay(today()) ? 'bad' : 'warn'}">${p.fecha_limite < isoDay(today()) ? 'Vencido' : 'Vence'} ${fDate(p.fecha_limite)}</span></td></tr>`).join('')}</table>` : '<div class="empty">Todo al corriente ✓</div>'}</div>
    </div><div>
      <div class="card"><div class="card-h"><h2>Actividad de clientes</h2></div>${act.length ? `<table>${act.map((a) => `<tr class="click" data-href="#/cliente/${a.clientes && a.clientes.id}"><td><b>${esc(a.clientes ? a.clientes.nombre_completo : '')}</b> <span class="muted">${EV[a.evento] || a.evento}</span></td><td class="small muted" style="white-space:nowrap">${fDT(a.creado_en)}</td></tr>`).join('')}</table>` : '<div class="empty">Aún no hay actividad.</div>'}</div>
    </div></div>`);
  bindRows();
}
function bindRows() { document.querySelectorAll('tr[data-href]').forEach((r) => r.onclick = () => { location.hash = r.dataset.href; }); }

// ---------------- CLIENTES ----------------
async function pClientes() {
  const list = await q(sb.from('clientes').select('id,nombre_completo,celular,codigo_referido,ultima_entrada,pin_hash,creado_en').order('creado_en', { ascending: false }).limit(500));
  setMain(`<div class="top"><div><h1>Clientes</h1><div class="sub">${list.length} registrados</div></div><div class="btns"><input class="search" id="s" placeholder="Buscar por nombre, celular o código"><button class="btn" id="nuevo">+ Nuevo cliente</button></div></div>
    <div class="card"><table><thead><tr><th>Nombre</th><th>Celular</th><th class="hide-m">Código</th><th class="hide-m">App</th></tr></thead><tbody id="tb"></tbody></table></div>`);
  const draw = (f) => {
    const t = (f || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const rows = list.filter((c) => !t || (c.nombre_completo.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') + ' ' + c.celular + ' ' + c.codigo_referido.toLowerCase()).includes(t));
    document.getElementById('tb').innerHTML = rows.length ? rows.map((c) => `<tr class="click" data-href="#/cliente/${c.id}"><td><b>${esc(c.nombre_completo)}</b></td><td>${cel(c.celular)}</td><td class="hide-m">${esc(c.codigo_referido)}</td><td class="hide-m">${c.ultima_entrada ? `<span class="pill ok">Última vez ${fDT(c.ultima_entrada)}</span>` : c.pin_hash ? '<span class="pill">Con PIN</span>' : '<span class="pill">Sin entrar</span>'}</td></tr>`).join('') : '<tr><td colspan="4" class="empty">Sin resultados</td></tr>';
    bindRows();
  };
  draw(); document.getElementById('s').oninput = (e) => draw(e.target.value);
  document.getElementById('nuevo').onclick = () => nuevoCliente();
  if (qs().get('nuevo')) nuevoCliente();
}

function nuevoCliente(after) {
  modal('Nuevo cliente', `<div class="form">
    <div class="f c12"><label>Nombre completo *</label><input name="nombre_completo" required placeholder="Nombre y apellidos"></div>
    <div class="f"><label>Celular (10 dígitos) *</label><input name="celular" required inputmode="numeric" placeholder="3312345678"></div>
    <div class="f"><label>Correo</label><input name="email" type="email"></div>
    <div class="f"><label>Código de referido (si alguien lo recomendó)</label><input name="codigo" placeholder="Ej. ERICK482" style="text-transform:uppercase"><span class="hint">Se aplica la promoción vigente.</span></div>
    <div class="f"><label>Fecha de nacimiento</label><input name="fecha_nacimiento" type="date"></div>
  </div>`, async (f) => {
    const d = formData(f);
    const celular = d.celular.replace(/\D/g, '').slice(-10);
    if (celular.length !== 10) { toast('El celular debe tener 10 dígitos'); return false; }
    if (d.nombre_completo.trim().split(/\s+/).length < 2) { toast('Escribe nombre y al menos un apellido'); return false; }
    const { data: cli, error } = await sb.from('clientes').insert({ nombre_completo: d.nombre_completo.trim().replace(/\s+/g, ' '), celular, email: d.email || null, fecha_nacimiento: d.fecha_nacimiento || null, creado_por: ME.id }).select().single();
    if (error) { toast(error.code === '23505' ? 'Ya existe un cliente con ese celular' : error.message); return false; }
    if (d.codigo.trim()) {
      const r = await q(sb.rpc('panel_aplicar_referido', { p_codigo: d.codigo, p_cliente: cli.id, p_viaje: null }));
      if (r.error) alert('Cliente creado, pero el código no se aplicó: ' + r.error);
      else alert(`✓ Referido por ${r.referidor}.\nNuevo cliente recibe: ${r.recompensa_nuevo || '—'}\nQuien refirió recibe: ${r.recompensa_referidor || '—'}`);
    }
    toast('Cliente creado');
    if (after) after(cli); else location.hash = '#/cliente/' + cli.id;
  });
}

async function pCliente(id) {
  const [c, vv, rec, act, ref] = await Promise.all([
    q(sb.from('clientes').select('*').eq('id', id).single()),
    q(sb.from('viaje_viajeros').select('es_titular,viajes(*)').eq('cliente_id', id)),
    q(sb.from('recompensas').select('*').eq('cliente_id', id).order('creado_en', { ascending: false })),
    q(sb.from('actividad').select('*').eq('cliente_id', id).order('creado_en', { ascending: false }).limit(20)),
    q(sb.from('referidos').select('*,referido:clientes!referidos_referido_id_fkey(nombre_completo),referidor:clientes!referidos_referidor_id_fkey(nombre_completo)').or(`referidor_id.eq.${id},referido_id.eq.${id}`))
  ]);
  const viajes = vv.map((x) => x.viajes).filter(Boolean).sort((a, b) => b.fecha_inicio.localeCompare(a.fecha_inicio));
  const prox = viajes.find((v) => v.fecha_fin >= isoDay(today()));
  const EV = { entrada: 'Entró a la app', visita: 'Abrió la app', ver_documento: 'Vio un documento', checklist: 'Actualizó checklist', compartir_codigo: 'Compartió su código', compartir_viaje: 'Compartió su viaje' };
  const invitados = ref.filter((r) => r.referidor_id === id), refPor = ref.find((r) => r.referido_id === id);
  setMain(`<div class="crumb"><a href="#/clientes">Clientes</a> /</div>
    <div class="top"><div><h1>${esc(c.nombre_completo)}</h1><div class="sub">📱 ${cel(c.celular)} ${c.email ? '· ' + esc(c.email) : ''}</div></div>
    <div class="btns"><a class="btn wa" target="_blank" rel="noopener" href="${waLink(c.celular, accessMessage(c, prox))}">Enviar acceso por WhatsApp</a><a class="btn" href="#/viaje/nuevo?cliente=${c.id}">+ Viaje</a></div></div>
    <div class="grid2"><div>
      <div class="card"><div class="card-h"><h2>Viajes</h2></div>${viajes.length ? `<table>${viajes.map((v) => `<tr class="click" data-href="#/viaje/${v.id}"><td>${esc(v.bandera || '')} <b>${esc(v.titulo)}</b></td><td class="small">${fDate(v.fecha_inicio)}</td><td>${v.estado === 'cancelado' ? '<span class="pill bad">Cancelado</span>' : v.fecha_fin < isoDay(today()) ? '<span class="pill">Completado</span>' : '<span class="pill acc">Próximo</span>'}</td></tr>`).join('')}</table>` : '<div class="empty">Sin viajes todavía.</div>'}</div>
      <div class="card"><div class="card-h"><h2>Recompensas</h2><button class="btn sm sec" id="addrec">+ Agregar</button></div>${rec.length ? `<table>${rec.map((r) => `<tr><td><b>${esc(r.descripcion)}</b><div class="small muted">${r.origen === 'referido' ? 'Por recomendar' : r.origen === 'bienvenida' ? 'Bienvenida por referido' : 'Manual'} · ${fDate(r.creado_en)}</div></td><td>${r.estado === 'disponible' ? `<button class="btn sm" data-usar="${r.id}">Marcar usada</button>` : `<span class="pill">${r.estado === 'usada' ? 'Usada ' + fDate(r.usada_en) : 'Cancelada'}</span>`}</td></tr>`).join('')}</table>` : '<div class="empty">Sin recompensas.</div>'}</div>
      <div class="card"><div class="card-h"><h2>Referidos</h2></div><div class="card-b">
        <div class="small muted">Su código</div><div class="codebox">${esc(c.codigo_referido)}</div>
        ${refPor ? `<p class="small">Llegó recomendado por <a href="#/cliente/${refPor.referidor_id}">${esc(refPor.referidor && refPor.referidor.nombre_completo)}</a>.</p>` : `<p class="small muted">No llegó por referido. <a href="#" id="aplicar">Aplicar un código</a></p>`}
        ${invitados.length ? `<p class="small"><b>${invitados.length}</b> ${invitados.length === 1 ? 'persona ha reservado' : 'personas han reservado'} con su código: ${invitados.map((r) => `<a href="#/cliente/${r.referido_id}">${esc(r.referido && r.referido.nombre_completo)}</a>`).join(', ')}</p>` : '<p class="small muted">Aún no ha referido a nadie.</p>'}
      </div></div>
    </div><div>
      <div class="card"><div class="card-h"><h2>Acceso a la app</h2></div><div class="card-b small">
        ${c.pin_hash ? `✓ Tiene PIN desde ${fDate(c.pin_creado_en)}` : 'Aún no crea su PIN'}<br>${c.ultima_entrada ? 'Último inicio de sesión: ' + fDT(c.ultima_entrada) : ''}
        ${c.bloqueado_hasta && new Date(c.bloqueado_hasta) > new Date() ? '<br><span class="pill bad">Bloqueado temporalmente por intentos</span>' : ''}
        <div class="btns" style="margin-top:12px"><button class="btn sm sec" id="reset">Restablecer PIN</button></div>
        <p class="muted" style="margin-bottom:0">Al restablecer, el cliente vuelve a entrar con nombre + celular y crea un PIN nuevo.</p></div></div>
      <div class="card"><div class="card-h"><h2>Datos</h2></div><div class="card-b"><form id="fd" class="form">
        <div class="f c12"><label>Nombre completo</label><input name="nombre_completo" value="${esc(c.nombre_completo)}" required></div>
        <div class="f"><label>Celular</label><input name="celular" value="${esc(c.celular)}" required></div>
        <div class="f"><label>Correo</label><input name="email" value="${esc(c.email || '')}"></div>
        <div class="f"><label>Nacimiento</label><input type="date" name="fecha_nacimiento" value="${esc(c.fecha_nacimiento || '')}"></div>
        <div class="f c12"><label>Notas internas (el cliente no las ve)</label><textarea name="notas_internas">${esc(c.notas_internas || '')}</textarea></div>
        <div class="f c12"><button class="btn" style="justify-self:start">Guardar cambios</button></div></form></div></div>
      <div class="card"><div class="card-h"><h2>Actividad reciente</h2></div>${act.length ? `<table>${act.map((a) => `<tr><td>${EV[a.evento] || esc(a.evento)}</td><td class="small muted">${fDT(a.creado_en)}</td></tr>`).join('')}</table>` : '<div class="empty">Sin actividad.</div>'}</div>
    </div></div>`);
  bindRows();
  document.getElementById('fd').onsubmit = async (e) => {
    e.preventDefault(); const d = formData(e.target);
    try { await q(sb.from('clientes').update({ nombre_completo: d.nombre_completo.trim(), celular: d.celular.replace(/\D/g, '').slice(-10), email: d.email || null, fecha_nacimiento: d.fecha_nacimiento || null, notas_internas: d.notas_internas || null }).eq('id', id)); toast('Guardado'); route(); } catch (err) { fail(err); }
  };
  document.getElementById('reset').onclick = async () => { if (!confirm('¿Restablecer el PIN de ' + c.nombre_completo + '?')) return; try { await q(sb.rpc('panel_restablecer_pin', { p_cliente: id })); toast('PIN restablecido'); route(); } catch (e) { fail(e); } };
  document.querySelectorAll('[data-usar]').forEach((b) => b.onclick = async () => { try { await q(sb.from('recompensas').update({ estado: 'usada', usada_en: new Date().toISOString() }).eq('id', b.dataset.usar)); toast('Recompensa marcada como usada'); route(); } catch (e) { fail(e); } });
  document.getElementById('addrec').onclick = () => modal('Agregar recompensa', `<div class="form"><div class="f c12"><label>Descripción</label><input name="descripcion" required placeholder="Ej. 5% de descuento en tu próximo viaje"></div><div class="f"><label>Tipo</label><select name="tipo">${opt([['texto', 'Beneficio (texto)'], ['porcentaje', 'Porcentaje'], ['monto', 'Monto']], 'texto')}</select></div><div class="f"><label>Valor (opcional)</label><input name="valor" type="number" step="0.01"></div></div>`, async (f) => { const d = formData(f); await q(sb.from('recompensas').insert({ cliente_id: id, origen: 'manual', descripcion: d.descripcion, tipo: d.tipo, valor: d.valor || null })); toast('Recompensa agregada'); route(); });
  const ap = document.getElementById('aplicar');
  if (ap) ap.onclick = (e) => { e.preventDefault(); modal('Aplicar código de referido', `<div class="form"><div class="f c12"><label>Código</label><input name="codigo" required style="text-transform:uppercase"></div></div>`, async (f) => { const r = await q(sb.rpc('panel_aplicar_referido', { p_codigo: formData(f).codigo, p_cliente: id, p_viaje: prox ? prox.id : null })); if (r.error) { toast(r.error); return false; } toast('Referido aplicado ✓'); route(); }, 'Aplicar'); };
}

// ---------------- VIAJES ----------------
async function pViajes() {
  const f = qs().get('f') || 'proximos', hoy = isoDay(today());
  let qq = sb.from('viajes').select('id,titulo,bandera,destino,fecha_inicio,fecha_fin,estado,total,moneda,pagos(monto),viaje_viajeros(es_titular,clientes(nombre_completo))');
  if (f === 'proximos') qq = qq.gte('fecha_fin', hoy).eq('estado', 'confirmado').order('fecha_inicio');
  else if (f === 'pasados') qq = qq.lt('fecha_fin', hoy).order('fecha_inicio', { ascending: false });
  else qq = qq.order('fecha_inicio', { ascending: false });
  const list = await q(qq.limit(300));
  setMain(`<div class="top"><div><h1>Viajes</h1></div><div class="btns"><a class="btn ${f === 'proximos' ? '' : 'sec'} sm" href="#/viajes?f=proximos">Próximos</a><a class="btn ${f === 'pasados' ? '' : 'sec'} sm" href="#/viajes?f=pasados">Pasados</a><a class="btn ${f === 'todos' ? '' : 'sec'} sm" href="#/viajes?f=todos">Todos</a><a class="btn" href="#/viaje/nuevo">+ Nuevo viaje</a></div></div>
    <div class="card">${list.length ? `<table><thead><tr><th>Viaje</th><th>Fechas</th><th class="hide-m">Viajeros</th><th class="hide-m">Pagado</th></tr></thead>${list.map((v) => { const pag = (v.pagos || []).reduce((s, p) => s + Number(p.monto), 0); const pct = Number(v.total) ? Math.round(pag / Number(v.total) * 100) : 100; const tit = (v.viaje_viajeros || []).sort((a, b) => b.es_titular - a.es_titular).map((x) => x.clientes && x.clientes.nombre_completo).filter(Boolean); return `<tr class="click" data-href="#/viaje/${v.id}"><td>${esc(v.bandera || '')} <b>${esc(v.titulo)}</b>${v.estado === 'cancelado' ? ' <span class="pill bad">Cancelado</span>' : ''}<div class="small muted">${esc(v.destino)}</div></td><td class="small">${fDate(v.fecha_inicio)} – ${fDate(v.fecha_fin)}</td><td class="hide-m small">${esc(tit[0] || '—')}${tit.length > 1 ? ` +${tit.length - 1}` : ''}</td><td class="hide-m"><span class="pill ${pct >= 100 ? 'ok' : 'warn'}">${pct}%</span></td></tr>`; }).join('')}</table>` : '<div class="empty">No hay viajes aquí.</div>'}</div>`);
  bindRows();
}

function viajeForm(v = {}, plantillas) {
  return `<div class="form">
    ${plantillas && plantillas.length ? `<div class="f c12"><label>Usar plantilla (opcional)</label><select name="plantilla"><option value="">— Sin plantilla —</option>${plantillas.map((p) => `<option value="${p.id}">${esc(p.nombre)}</option>`).join('')}</select><span class="hint">Copia vuelos/hotel/traslados y checklist, ajustados a las fechas.</span></div>` : ''}
    <div class="f c4"><label>Título *</label><input name="titulo" required value="${esc(v.titulo || '')}" placeholder="Punta Cana"></div>
    <div class="f c6"><label>Destino *</label><input name="destino" required value="${esc(v.destino || '')}" placeholder="Punta Cana, República Dominicana"></div>
    <div class="f c2"><label>Bandera</label><input name="bandera" value="${esc(v.bandera || '')}" placeholder="🇩🇴"></div>
    <div class="f c3"><label>Inicio *</label><input type="date" name="fecha_inicio" required value="${esc(v.fecha_inicio || '')}"></div>
    <div class="f c3"><label>Regreso *</label><input type="date" name="fecha_fin" required value="${esc(v.fecha_fin || '')}"></div>
    <div class="f c3"><label>Estilo visual</label><select name="tema">${opt(TEMAS, v.tema || 'tropical')}</select></div>
    <div class="f c3"><label>Estado</label><select name="estado">${opt([['confirmado', 'Confirmado'], ['cancelado', 'Cancelado']], v.estado || 'confirmado')}</select></div>
    <div class="f c4"><label>Total del viaje</label><input type="number" step="0.01" name="total" value="${esc(v.total ?? '')}"></div>
    <div class="f c2"><label>Moneda</label><select name="moneda">${opt([['MXN', 'MXN'], ['USD', 'USD'], ['EUR', 'EUR']], v.moneda || 'MXN')}</select></div>
    <div class="f c6"><label>Sucursal</label><input name="sucursal" value="${esc(v.sucursal || ME.sucursal || '')}"></div>
    <div class="f c12"><label>¿Qué incluye? (lo ve el cliente)</label><textarea name="incluye" placeholder="Vuelo redondo, 6 noches todo incluido, traslados, seguro de viaje…">${esc(v.incluye || '')}</textarea></div>
    <div class="f c12"><label>Notas importantes para el cliente</label><textarea name="notas_cliente" placeholder="Presentarse 3 horas antes en el aeropuerto…">${esc(v.notas_cliente || '')}</textarea></div>
  </div>`;
}
const viajeData = (d) => ({ titulo: d.titulo.trim(), destino: d.destino.trim(), bandera: d.bandera || null, fecha_inicio: d.fecha_inicio, fecha_fin: d.fecha_fin, tema: d.tema, estado: d.estado, total: Number(d.total || 0), moneda: d.moneda, sucursal: d.sucursal || null, incluye: d.incluye || null, notas_cliente: d.notas_cliente || null });

async function pViajeNuevo() {
  const cid = qs().get('cliente');
  const [plantillas, cli] = await Promise.all([q(sb.from('plantillas').select('*').order('nombre')), cid ? q(sb.from('clientes').select('*').eq('id', cid).single()) : null]);
  setMain(`<div class="crumb"><a href="#/viajes">Viajes</a> /</div><div class="top"><div><h1>Nuevo viaje</h1>${cli ? `<div class="sub">Para ${esc(cli.nombre_completo)}</div>` : ''}</div></div>
    <form class="card" id="fv"><div class="card-b">
      ${cli ? '' : `<div class="form" style="margin-bottom:14px"><div class="f c12"><label>Cliente titular *</label><input name="buscar" id="buscar" placeholder="Busca por nombre o celular" autocomplete="off"><input type="hidden" name="cliente_id" id="cliente_id"><div id="res" class="small"></div><span class="hint">¿No existe? <a href="#" id="nc">Crear cliente nuevo</a></span></div></div>`}
      ${viajeForm({}, plantillas)}
      <div style="margin-top:16px"><button class="btn">Crear viaje</button></div></div></form>`);
  const fv = document.getElementById('fv');
  let clienteId = cid;
  if (!cli) {
    const res = document.getElementById('res');
    const pick = (c) => { clienteId = c.id; document.getElementById('buscar').value = c.nombre_completo + ' · ' + cel(c.celular); res.innerHTML = ''; };
    document.getElementById('buscar').oninput = debounce(async (e) => {
      const t = e.target.value.trim(); clienteId = null; if (t.length < 2) { res.innerHTML = ''; return; }
      const digits = t.replace(/\D/g, '');
      const l = await q(sb.from('clientes').select('id,nombre_completo,celular').or(digits.length >= 3 ? `celular.ilike.%${digits}%` : `nombre_completo.ilike.%${t.replace(/[%,()]/g, '')}%`).limit(8));
      res.innerHTML = l.map((c) => `<div style="padding:6px 0;cursor:pointer" data-c='${esc(JSON.stringify(c))}'>👤 <b>${esc(c.nombre_completo)}</b> · ${cel(c.celular)}</div>`).join('') || '<div class="muted" style="padding:6px 0">Sin resultados</div>';
      res.querySelectorAll('[data-c]').forEach((d) => d.onclick = () => pick(JSON.parse(d.dataset.c)));
    }, 250);
    document.getElementById('nc').onclick = (e) => { e.preventDefault(); nuevoCliente((c) => { closeModal(); pick(c); }); };
  }
  fv.onsubmit = async (e) => {
    e.preventDefault();
    if (!clienteId) return toast('Elige el cliente titular');
    const d = formData(fv);
    if (d.fecha_fin < d.fecha_inicio) return toast('La fecha de regreso no puede ser antes del inicio');
    const b = fv.querySelector('button.btn'); b.disabled = true;
    try {
      const pl = plantillas.find((p) => p.id === d.plantilla);
      const vd = viajeData(d);
      if (pl) { ['bandera', 'tema', 'imagen_url', 'incluye'].forEach((k) => { if (!vd[k] && pl[k]) vd[k] = pl[k]; }); }
      const v = await q(sb.from('viajes').insert({ ...vd, asesor_id: ME.id }).select().single());
      await q(sb.from('viaje_viajeros').insert({ viaje_id: v.id, cliente_id: clienteId, es_titular: true }));
      const base = pDate(d.fecha_inicio);
      const at = (off, hora) => { if (off == null || off === '') return null; const x = new Date(base); x.setDate(x.getDate() + Number(off)); return fromLocalInput(isoDay(x) + 'T' + (hora || '12:00')); };
      if (pl && (pl.segmentos || []).length) await q(sb.from('segmentos').insert(pl.segmentos.map((s, i) => ({ viaje_id: v.id, tipo: s.tipo, titulo: s.titulo, descripcion: s.descripcion || null, lugar: s.lugar || null, proveedor: s.proveedor || null, detalles: s.detalles || {}, orden: i, inicio: at(s.dia_inicio, s.hora_inicio), fin: at(s.dia_fin, s.hora_fin) }))));
      const cl = pl && (pl.checklist || []).length ? pl.checklist.map((x) => [x.texto, false, !!x.solo_equipo]) : CHECK_DEFAULT;
      await q(sb.from('checklist').insert(cl.map(([texto, completado, solo], i) => ({ viaje_id: v.id, texto, completado, solo_equipo: solo, orden: i, completado_en: completado ? new Date().toISOString() : null }))));
      toast('Viaje creado ✓'); location.hash = '#/viaje/' + v.id;
    } catch (err) { fail(err); b.disabled = false; }
  };
}
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

async function pViaje(id) {
  const [v, viajeros, segs, docs, plan, pagos, cl] = await Promise.all([
    q(sb.from('viajes').select('*').eq('id', id).single()),
    q(sb.from('viaje_viajeros').select('es_titular,clientes(id,nombre_completo,celular,pin_hash,ultima_entrada)').eq('viaje_id', id)),
    q(sb.from('segmentos').select('*').eq('viaje_id', id).order('inicio', { nullsFirst: false }).order('orden')),
    q(sb.from('documentos').select('*').eq('viaje_id', id).order('creado_en')),
    q(sb.from('plan_pagos').select('*').eq('viaje_id', id).order('fecha_limite')),
    q(sb.from('pagos').select('*').eq('viaje_id', id).order('fecha')),
    q(sb.from('checklist').select('*').eq('viaje_id', id).order('orden'))
  ]);
  const pag = pagos.reduce((s, p) => s + Number(p.monto), 0), pend = Number(v.total) - pag, planTot = plan.reduce((s, p) => s + Number(p.monto), 0);
  viajeros.sort((a, b) => b.es_titular - a.es_titular);
  setMain(`<div class="crumb"><a href="#/viajes">Viajes</a> /</div>
    <div class="top"><div><h1>${esc(v.bandera || '')} ${esc(v.titulo)}</h1><div class="sub">${fDate(v.fecha_inicio)} – ${fDate(v.fecha_fin)} · ${esc(v.destino)} ${v.estado === 'cancelado' ? '<span class="pill bad">Cancelado</span>' : ''}</div></div>
      <div class="btns"><button class="btn sec" id="edit">Editar datos</button><button class="btn sec" id="tpl">Guardar como plantilla</button></div></div>
    <div class="grid2"><div>
      <div class="card"><div class="card-h"><h2>Viajeros</h2><button class="btn sm sec" id="addv">+ Agregar acompañante</button></div><table>${viajeros.map((x) => { const c = x.clientes; return `<tr><td><a href="#/cliente/${c.id}"><b>${esc(c.nombre_completo)}</b></a> ${x.es_titular ? '<span class="pill acc">Titular</span>' : ''}<div class="small muted">${cel(c.celular)} · ${c.ultima_entrada ? 'Usa la app ✓' : c.pin_hash ? 'Con PIN' : 'Aún no entra'}</div></td><td style="text-align:right;white-space:nowrap"><a class="btn sm wa" target="_blank" rel="noopener" href="${waLink(c.celular, accessMessage(c, v))}">Enviar acceso</a> ${!x.es_titular ? `<button class="btn sm danger" data-delv="${c.id}">Quitar</button>` : ''}</td></tr>`; }).join('')}</table></div>
      <div class="card"><div class="card-h"><h2>Vuelos, hotel y actividades</h2><button class="btn sm" id="addseg">+ Agregar</button></div><div class="seglist">${segs.length ? segs.map((s) => `<div class="seg"><div class="ico">${ICON[s.tipo]}</div><div><div class="t">${esc(s.titulo)}</div><div class="small muted">${s.inicio ? segWhen(s.inicio) : 'Sin fecha'}${s.fin ? ' → ' + segWhen(s.fin) : ''}${s.proveedor ? ' · ' + esc(s.proveedor) : ''}${s.localizador ? ' · Clave ' + esc(s.localizador) : ''}</div>${s.lugar ? `<div class="small muted">📍 ${esc(s.lugar)}</div>` : ''}</div><div class="act"><button class="btn sm sec" data-eseg="${s.id}">Editar</button><button class="btn sm danger" data-dseg="${s.id}">✕</button></div></div>`).join('') : '<div class="empty">Agrega el vuelo, hotel y traslados. Así se arma el itinerario del cliente.</div>'}</div></div>
      <div class="card"><div class="card-h"><h2>Checklist del cliente</h2><button class="btn sm sec" id="addck">+ Agregar</button></div><table>${cl.map((k) => `<tr><td><label class="chk"><input type="checkbox" data-ck="${k.id}" ${k.completado ? 'checked' : ''}> ${esc(k.texto)}</label></td><td class="small muted">${k.solo_equipo ? 'Lo marca Todo Viajes' : 'Lo marca el cliente'}</td><td style="text-align:right"><button class="btn sm danger" data-dck="${k.id}">✕</button></td></tr>`).join('') || '<tr><td class="empty">Sin pendientes</td></tr>'}</table></div>
    </div><div>
      <div class="card"><div class="card-h"><h2>Pagos</h2><div class="btns"><button class="btn sm sec" id="addplan">+ Fecha de pago</button><button class="btn sm" id="addpago">+ Registrar pago</button></div></div>
        <div class="card-b"><div class="tot"><div><span>Total</span><b class="money">${money(v.total, v.moneda)}</b></div><div><span>Pagado</span><b class="money" style="color:var(--ok)">${money(pag, v.moneda)}</b></div><div><span>Pendiente</span><b class="money">${money(Math.max(0, pend), v.moneda)}</b></div></div>
        ${plan.length && Math.abs(planTot - Number(v.total)) > 0.01 ? `<p class="small" style="color:var(--warn)">⚠ El calendario suma ${money(planTot, v.moneda)} y el total es ${money(v.total, v.moneda)}.</p>` : ''}</div>
        ${plan.length ? `<div class="small muted" style="padding:0 18px;font-weight:800">CALENDARIO</div><table>${plan.map((p) => `<tr><td>${fDate(p.fecha_limite)}</td><td class="money">${money(p.monto, v.moneda)}</td><td class="small muted">${esc(p.descripcion || '')}</td><td style="text-align:right"><button class="btn sm danger" data-dplan="${p.id}">✕</button></td></tr>`).join('')}</table>` : ''}
        ${pagos.length ? `<div class="small muted" style="padding:10px 18px 0;font-weight:800">PAGOS RECIBIDOS</div><table>${pagos.map((p) => `<tr><td>${fDate(p.fecha)}</td><td class="money"><b>${money(p.monto, v.moneda)}</b></td><td class="small muted">${esc(p.metodo || '')} ${esc(p.referencia || '')}</td><td style="text-align:right"><button class="btn sm danger" data-dpago="${p.id}">✕</button></td></tr>`).join('')}</table>` : ''}
      </div>
      <div class="card"><div class="card-h"><h2>Documentos</h2><button class="btn sm" id="adddoc">+ Subir documento</button></div><table>${docs.map((d) => `<tr><td><b>${esc(d.nombre)}</b><div class="small muted">${esc((DOCTIPOS.find((t) => t[0] === d.tipo) || [])[1] || d.tipo)}</div></td><td><label class="chk small"><input type="checkbox" data-vis="${d.id}" ${d.visible ? 'checked' : ''}> Visible</label></td><td style="text-align:right;white-space:nowrap"><button class="btn sm sec" data-ver="${esc(d.ruta_storage)}">Ver</button> <button class="btn sm danger" data-ddoc="${d.id}" data-ruta="${esc(d.ruta_storage)}">✕</button></td></tr>`).join('') || '<tr><td class="empty">Sube vouchers, boletos, seguro… (PDF o imagen)</td></tr>'}</table></div>
      <div class="card"><div class="card-h"><h2>Imagen del destino</h2><label class="btn sm sec" style="cursor:pointer">Subir imagen<input type="file" accept="image/*" id="img" hidden></label></div><div class="card-b">${v.imagen_url ? `<img src="${esc(v.imagen_url)}" style="width:100%;border-radius:10px;max-height:220px;object-fit:cover"><button class="btn sm danger" id="delimg" style="margin-top:8px">Quitar imagen</button>` : '<span class="small muted">Sin imagen: la app usa los colores del estilo visual. Recomendado: foto vertical, 1200px.</span>'}</div></div>
      <div class="card"><div class="card-b"><button class="btn danger" id="delviaje">Eliminar viaje</button></div></div>
    </div></div>`);

  const on = (sel, fn) => document.querySelectorAll(sel).forEach((b) => b.onclick = () => fn(b));
  const reload = () => route();
  const del = async (tabla, idd, msg) => { if (!confirm(msg || '¿Eliminar?')) return; try { await q(sb.from(tabla).delete().eq('id', idd)); toast('Eliminado'); reload(); } catch (e) { fail(e); } };

  document.getElementById('edit').onclick = () => modal('Editar viaje', viajeForm(v), async (f) => { const d = formData(f); if (d.fecha_fin < d.fecha_inicio) { toast('Fechas inválidas'); return false; } await q(sb.from('viajes').update(viajeData(d)).eq('id', id)); toast('Guardado'); reload(); });
  document.getElementById('tpl').onclick = () => modal('Guardar como plantilla', `<div class="form"><div class="f c12"><label>Nombre de la plantilla</label><input name="nombre" required value="${esc(v.titulo)} ${Math.round((pDate(v.fecha_fin) - pDate(v.fecha_inicio)) / 864e5)} noches"></div><p class="small muted f c12">Se guardan vuelos/hotel/traslados (sin claves de reservación) con sus días relativos, el checklist y el estilo.</p></div>`, async (f) => {
    const base = pDate(v.fecha_inicio);
    const rel = (iso) => { if (!iso) return [null, null]; const s = new Date(iso).toISOString(); return [Math.round((pDate(s.slice(0, 10)) - base) / 864e5), s.slice(11, 16)]; };
    await q(sb.from('plantillas').insert({ nombre: formData(f).nombre, titulo: v.titulo, destino: v.destino, bandera: v.bandera, tema: v.tema, imagen_url: v.imagen_url, incluye: v.incluye, noches: Math.round((pDate(v.fecha_fin) - base) / 864e5), segmentos: segs.map((s) => { const [di, hi] = rel(s.inicio), [df, hf] = rel(s.fin); return { tipo: s.tipo, titulo: s.titulo, descripcion: s.descripcion, lugar: s.lugar, proveedor: s.proveedor, detalles: s.detalles, dia_inicio: di, hora_inicio: hi, dia_fin: df, hora_fin: hf }; }), checklist: cl.map((k) => ({ texto: k.texto, solo_equipo: k.solo_equipo })) }));
    toast('Plantilla guardada ✓');
  });
  document.getElementById('addv').onclick = () => {
    const f = modal('Agregar acompañante', `<div class="form"><div class="f c12"><label>Buscar cliente</label><input id="bq" placeholder="Nombre o celular" autocomplete="off"><div id="bres" class="small"></div><span class="hint">Cada acompañante entra con su propio celular. ¿No existe? <a href="#" id="nc2">Crear cliente</a></span></div></div>`, null);
    const res = f.querySelector('#bres');
    const add = async (c) => { try { await q(sb.from('viaje_viajeros').insert({ viaje_id: id, cliente_id: c.id, es_titular: false })); closeModal(); toast('Acompañante agregado'); reload(); } catch (e) { fail(e.code === '23505' ? { message: 'Ya está en el viaje' } : e); } };
    f.querySelector('#bq').oninput = debounce(async (e) => {
      const t = e.target.value.trim(); if (t.length < 2) { res.innerHTML = ''; return; }
      const digits = t.replace(/\D/g, '');
      const l = await q(sb.from('clientes').select('id,nombre_completo,celular').or(digits.length >= 3 ? `celular.ilike.%${digits}%` : `nombre_completo.ilike.%${t.replace(/[%,()]/g, '')}%`).limit(8));
      res.innerHTML = l.map((c, i) => `<div style="padding:6px 0;cursor:pointer" data-i="${i}">👤 <b>${esc(c.nombre_completo)}</b> · ${cel(c.celular)}</div>`).join('') || '<div class="muted">Sin resultados</div>';
      res.querySelectorAll('[data-i]').forEach((d) => d.onclick = () => add(l[d.dataset.i]));
    }, 250);
    f.querySelector('#nc2').onclick = (e) => { e.preventDefault(); nuevoCliente((c) => { closeModal(); add(c); }); };
  };
  on('[data-delv]', (b) => { if (confirm('¿Quitar del viaje?')) q(sb.from('viaje_viajeros').delete().eq('viaje_id', id).eq('cliente_id', b.dataset.delv)).then(reload).catch(fail); });

  const segForm = (s = {}) => `<div class="form">
    <div class="f c4"><label>Tipo</label><select name="tipo">${opt([['vuelo', '✈️ Vuelo'], ['hotel', '🏨 Hotel'], ['traslado', '🚐 Traslado'], ['actividad', '🌴 Actividad / tour'], ['otro', '📌 Otro']], s.tipo || 'vuelo')}</select></div>
    <div class="f c8"><label>Título *</label><input name="titulo" required value="${esc(s.titulo || '')}" placeholder="GDL → PUJ  /  Grand Palladium  /  Aeropuerto → Hotel"></div>
    <div class="f"><label>Inicio (salida / check-in)</label><input type="datetime-local" name="inicio" value="${toLocalInput(s.inicio)}"><span class="hint">Hora local del lugar</span></div>
    <div class="f"><label>Fin (llegada / check-out)</label><input type="datetime-local" name="fin" value="${toLocalInput(s.fin)}"></div>
    <div class="f"><label>Aerolínea / proveedor</label><input name="proveedor" value="${esc(s.proveedor || '')}"></div>
    <div class="f"><label>Clave de reservación</label><input name="localizador" value="${esc(s.localizador || '')}"></div>
    <div class="f c12"><label>Lugar / dirección (abre en Google Maps)</label><input name="lugar" value="${esc(s.lugar || '')}" placeholder="Aeropuerto Internacional de Guadalajara, Terminal 1"></div>
    <div class="f"><label>Dato extra 1 (nombre)</label><input name="k1" value="${esc(Object.keys(s.detalles || {})[0] || '')}" placeholder="Vuelo / Habitación / Plan"></div>
    <div class="f"><label>Dato extra 1 (valor)</label><input name="v1" value="${esc(Object.values(s.detalles || {})[0] || '')}" placeholder="AM 456 / Junior Suite / Todo incluido"></div>
    <div class="f"><label>Dato extra 2 (nombre)</label><input name="k2" value="${esc(Object.keys(s.detalles || {})[1] || '')}" placeholder="Terminal / Equipaje"></div>
    <div class="f"><label>Dato extra 2 (valor)</label><input name="v2" value="${esc(Object.values(s.detalles || {})[1] || '')}"></div>
    <div class="f c12"><label>Descripción / indicaciones</label><textarea name="descripcion">${esc(s.descripcion || '')}</textarea></div></div>`;
  const segData = (d) => { const det = {}; if (d.k1 && d.v1) det[d.k1] = d.v1; if (d.k2 && d.v2) det[d.k2] = d.v2; return { tipo: d.tipo, titulo: d.titulo.trim(), inicio: fromLocalInput(d.inicio), fin: fromLocalInput(d.fin), proveedor: d.proveedor || null, localizador: d.localizador || null, lugar: d.lugar || null, descripcion: d.descripcion || null, detalles: det }; };
  document.getElementById('addseg').onclick = () => modal('Agregar al viaje', segForm(), async (f) => { await q(sb.from('segmentos').insert({ ...segData(formData(f)), viaje_id: id, orden: segs.length })); toast('Agregado'); reload(); });
  on('[data-eseg]', (b) => { const s = segs.find((x) => x.id === b.dataset.eseg); modal('Editar', segForm(s), async (f) => { await q(sb.from('segmentos').update(segData(formData(f))).eq('id', s.id)); toast('Guardado'); reload(); }); });
  on('[data-dseg]', (b) => del('segmentos', b.dataset.dseg));

  document.getElementById('addck').onclick = () => modal('Agregar al checklist', `<div class="form"><div class="f c12"><label>Texto</label><input name="texto" required placeholder="Ej. Tramitar visa"></div><label class="chk f c12"><input type="checkbox" name="solo_equipo"> Solo lo marca Todo Viajes</label></div>`, async (f) => { const d = formData(f); await q(sb.from('checklist').insert({ viaje_id: id, texto: d.texto, solo_equipo: !!d.solo_equipo, orden: cl.length })); reload(); });
  document.querySelectorAll('[data-ck]').forEach((b) => b.onchange = () => q(sb.from('checklist').update({ completado: b.checked, completado_en: b.checked ? new Date().toISOString() : null }).eq('id', b.dataset.ck)).then(() => toast('Actualizado')).catch(fail));
  on('[data-dck]', (b) => del('checklist', b.dataset.dck));

  document.getElementById('addplan').onclick = () => modal('Fecha de pago', `<div class="form"><div class="f"><label>Fecha límite</label><input type="date" name="fecha_limite" required></div><div class="f"><label>Monto</label><input type="number" step="0.01" name="monto" required value="${Number(v.total) - planTot > 0.01 ? (Number(v.total) - planTot).toFixed(2) : ''}"></div><div class="f c12"><label>Descripción</label><input name="descripcion" placeholder="Anticipo / Segundo pago / Liquidación"></div></div>`, async (f) => { const d = formData(f); await q(sb.from('plan_pagos').insert({ viaje_id: id, fecha_limite: d.fecha_limite, monto: d.monto, descripcion: d.descripcion || null })); reload(); });
  document.getElementById('addpago').onclick = () => modal('Registrar pago recibido', `<div class="form"><div class="f"><label>Fecha</label><input type="date" name="fecha" required value="${isoDay(today())}"></div><div class="f"><label>Monto</label><input type="number" step="0.01" name="monto" required></div><div class="f"><label>Método</label><select name="metodo">${opt([['Transferencia', 'Transferencia'], ['Efectivo', 'Efectivo'], ['Tarjeta', 'Tarjeta'], ['Depósito', 'Depósito'], ['Otro', 'Otro']], 'Transferencia')}</select></div><div class="f"><label>Referencia</label><input name="referencia"></div></div>`, async (f) => { const d = formData(f); await q(sb.from('pagos').insert({ viaje_id: id, fecha: d.fecha, monto: d.monto, metodo: d.metodo, referencia: d.referencia || null, registrado_por: ME.id })); toast('Pago registrado ✓'); reload(); });
  on('[data-dplan]', (b) => del('plan_pagos', b.dataset.dplan));
  on('[data-dpago]', (b) => del('pagos', b.dataset.dpago, '¿Eliminar este pago?'));

  document.getElementById('adddoc').onclick = () => modal('Subir documento', `<div class="form"><div class="f c12"><label>Archivo (PDF o imagen)</label><input type="file" name="file" required accept="application/pdf,image/*"></div><div class="f"><label>Tipo</label><select name="tipo">${opt(DOCTIPOS, 'voucher')}</select></div><div class="f"><label>Nombre que verá el cliente</label><input name="nombre" placeholder="Voucher hotel"></div></div>`, async (f) => {
    const file = f.file.files[0], d = formData(f);
    if (!file) return false;
    if (file.size > 20 * 1024 * 1024) { toast('Máximo 20 MB'); return false; }
    const ext = (file.name.split('.').pop() || 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '');
    const ruta = `${id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await sb.storage.from('documentos').upload(ruta, file, { contentType: file.type });
    if (error) throw error;
    await q(sb.from('documentos').insert({ viaje_id: id, tipo: d.tipo, nombre: d.nombre || (DOCTIPOS.find((t) => t[0] === d.tipo) || [])[1] || file.name, ruta_storage: ruta }));
    toast('Documento subido ✓'); reload();
  }, 'Subir');
  document.querySelectorAll('[data-vis]').forEach((b) => b.onchange = () => q(sb.from('documentos').update({ visible: b.checked }).eq('id', b.dataset.vis)).then(() => toast(b.checked ? 'Visible para el cliente' : 'Oculto')).catch(fail));
  on('[data-ver]', async (b) => { const { data, error } = await sb.storage.from('documentos').createSignedUrl(b.dataset.ver, 120); if (error) return fail(error); window.open(data.signedUrl, '_blank'); });
  on('[data-ddoc]', async (b) => { if (!confirm('¿Eliminar documento?')) return; try { await sb.storage.from('documentos').remove([b.dataset.ruta]); await q(sb.from('documentos').delete().eq('id', b.dataset.ddoc)); reload(); } catch (e) { fail(e); } });

  document.getElementById('img').onchange = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const blob = await resizeImage(file, 1400);
      const ruta = `viajes/${id}-${Date.now()}.jpg`;
      const { error } = await sb.storage.from('imagenes').upload(ruta, blob, { contentType: 'image/jpeg' });
      if (error) throw error;
      const url = sb.storage.from('imagenes').getPublicUrl(ruta).data.publicUrl;
      await q(sb.from('viajes').update({ imagen_url: url }).eq('id', id)); toast('Imagen actualizada'); reload();
    } catch (err) { fail(err); }
  };
  const di = document.getElementById('delimg'); if (di) di.onclick = () => q(sb.from('viajes').update({ imagen_url: null }).eq('id', id)).then(reload).catch(fail);
  document.getElementById('delviaje').onclick = async () => {
    if (!confirm('¿Eliminar este viaje y todo su contenido? No se puede deshacer. (Si solo se canceló, mejor cambia el estado a "Cancelado".)')) return;
    try { if (docs.length) await sb.storage.from('documentos').remove(docs.map((d) => d.ruta_storage)); await q(sb.from('viajes').delete().eq('id', id)); toast('Viaje eliminado'); location.hash = '#/viajes'; } catch (e) { fail(e); }
  };
}

function resizeImage(file, max) {
  return new Promise((res, rej) => {
    const img = new Image(); img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); c.toBlob((b) => b ? res(b) : rej(new Error('No se pudo procesar la imagen')), 'image/jpeg', 0.85);
    }; img.onerror = () => rej(new Error('Imagen inválida')); img.src = URL.createObjectURL(file);
  });
}

// ---------------- REFERIDOS ----------------
async function pReferidos() {
  const [cfg, refs] = await Promise.all([
    q(sb.from('config_referidos').select('*').eq('id', 1).single()),
    q(sb.from('referidos').select('*,referido:clientes!referidos_referido_id_fkey(id,nombre_completo),referidor:clientes!referidos_referidor_id_fkey(id,nombre_completo,codigo_referido)').order('creado_en', { ascending: false }).limit(300))
  ]);
  const rank = {};
  refs.filter((r) => r.estado === 'reservado').forEach((r) => { const k = r.referidor_id; rank[k] = rank[k] || { c: r.referidor, n: 0 }; rank[k].n++; });
  const top = Object.values(rank).sort((a, b) => b.n - a.n).slice(0, 10);
  const admin = ME.rol === 'admin';
  const TIPOS = [['porcentaje', '% de descuento'], ['monto', 'Monto fijo'], ['texto', 'Beneficio en texto'], ['ninguna', 'Sin recompensa']];
  setMain(`<div class="top"><div><h1>Invita y viaja</h1><div class="sub">${refs.length} referidos registrados</div></div></div>
    <div class="grid2"><div>
      <form class="card" id="cfg"><div class="card-h"><h2>Promoción vigente</h2>${cfg.activo ? '<span class="pill ok">Activa</span>' : '<span class="pill">Pausada</span>'}</div><div class="card-b"><fieldset ${admin ? '' : 'disabled'} style="border:0;padding:0;margin:0"><div class="form">
        <label class="chk f c12"><input type="checkbox" name="activo" ${cfg.activo ? 'checked' : ''}> Programa activo</label>
        <div class="f c12" style="font-weight:800">🆕 El nuevo cliente (quien usa el código) recibe:</div>
        <div class="f c4"><label>Tipo</label><select name="nuevo_tipo">${opt(TIPOS, cfg.nuevo_tipo)}</select></div><div class="f c3"><label>Valor</label><input type="number" step="0.01" name="nuevo_valor" value="${esc(cfg.nuevo_valor ?? '')}"></div><div class="f c12"><label>Texto que ve el cliente</label><input name="nuevo_texto" value="${esc(cfg.nuevo_texto || '')}" placeholder="10% de descuento en tu viaje"></div>
        <div class="f c12" style="font-weight:800;margin-top:6px">🎁 Quien recomendó recibe:</div>
        <div class="f c4"><label>Tipo</label><select name="referidor_tipo">${opt(TIPOS, cfg.referidor_tipo)}</select></div><div class="f c3"><label>Valor</label><input type="number" step="0.01" name="referidor_valor" value="${esc(cfg.referidor_valor ?? '')}"></div><div class="f c12"><label>Texto que ve el cliente</label><input name="referidor_texto" value="${esc(cfg.referidor_texto || '')}"></div>
        <div class="f c12"><label>Mensaje para compartir</label><textarea name="mensaje_compartir">${esc(cfg.mensaje_compartir || '')}</textarea><span class="hint">Usa {codigo} y {recompensa}; se reemplazan automáticamente.</span></div>
        ${admin ? '<div class="f c12"><button class="btn" style="justify-self:start">Guardar promoción</button><span class="hint">Los cambios aplican a nuevos referidos. Los ya registrados conservan la recompensa de su momento.</span></div>' : '<p class="small muted f c12">Solo un administrador puede cambiar la promoción.</p>'}
      </div></fieldset></div></form>
    </div><div>
      <div class="card"><div class="card-h"><h2>🏆 Top embajadores</h2></div>${top.length ? `<table>${top.map((t, i) => `<tr class="click" data-href="#/cliente/${t.c.id}"><td>${i + 1}. <b>${esc(t.c.nombre_completo)}</b> <span class="small muted">${esc(t.c.codigo_referido)}</span></td><td><b>${t.n}</b> ${t.n === 1 ? 'referido' : 'referidos'}</td></tr>`).join('')}</table>` : '<div class="empty">Aún no hay referidos.</div>'}</div>
      <div class="card"><div class="card-h"><h2>Últimos referidos</h2></div>${refs.length ? `<table>${refs.slice(0, 30).map((r) => `<tr><td><a href="#/cliente/${r.referido.id}"><b>${esc(r.referido.nombre_completo)}</b></a><div class="small muted">por ${esc(r.referidor.nombre_completo)} · ${esc((r.recompensa_nuevo || {}).texto || '')}</div></td><td class="small muted">${fDate(r.creado_en)}</td><td>${r.estado === 'reservado' ? '' : '<span class="pill bad">Cancelado</span>'}</td></tr>`).join('')}</table>` : '<div class="empty">—</div>'}</div>
    </div></div>`);
  bindRows();
  document.getElementById('cfg').onsubmit = async (e) => {
    e.preventDefault(); if (!admin) return;
    const d = formData(e.target);
    try { await q(sb.from('config_referidos').update({ activo: !!d.activo, nuevo_tipo: d.nuevo_tipo, nuevo_valor: d.nuevo_valor || null, nuevo_texto: d.nuevo_texto, referidor_tipo: d.referidor_tipo, referidor_valor: d.referidor_valor || null, referidor_texto: d.referidor_texto, mensaje_compartir: d.mensaje_compartir, actualizado_en: new Date().toISOString() }).eq('id', 1)); toast('Promoción guardada ✓'); route(); } catch (err) { fail(err); }
  };
}

// ---------------- PLANTILLAS ----------------
async function pPlantillas() {
  const list = await q(sb.from('plantillas').select('*').order('nombre'));
  setMain(`<div class="top"><div><h1>Plantillas</h1><div class="sub">Paquetes que venden seguido. Créalas desde un viaje con "Guardar como plantilla".</div></div></div>
    <div class="card">${list.length ? `<table><thead><tr><th>Nombre</th><th>Destino</th><th class="hide-m">Contenido</th><th></th></tr></thead>${list.map((p) => `<tr><td>${esc(p.bandera || '')} <b>${esc(p.nombre)}</b></td><td>${esc(p.destino || '')}</td><td class="hide-m small muted">${(p.segmentos || []).length} elementos · ${(p.checklist || []).length} pendientes${p.noches != null ? ' · ' + p.noches + ' noches' : ''}</td><td style="text-align:right"><button class="btn sm danger" data-del="${p.id}">Eliminar</button></td></tr>`).join('')}</table>` : '<div class="empty">Aún no hay plantillas.</div>'}</div>`);
  document.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => { if (!confirm('¿Eliminar plantilla?')) return; try { await q(sb.from('plantillas').delete().eq('id', b.dataset.del)); route(); } catch (e) { fail(e); } });
}

// ---------------- EQUIPO ----------------
async function pEquipo() {
  const list = await q(sb.from('equipo').select('*').order('nombre'));
  const admin = ME.rol === 'admin';
  setMain(`<div class="top"><div><h1>Equipo</h1><div class="sub">Personas con acceso al panel. Su WhatsApp aparece al cliente como contacto de su viaje.</div></div></div>
    <div class="card"><table><thead><tr><th>Nombre</th><th>Rol</th><th class="hide-m">WhatsApp</th><th class="hide-m">Sucursal</th><th></th></tr></thead>${list.map((e) => `<tr><td><b>${esc(e.nombre)}</b> ${e.activo ? '' : '<span class="pill">Inactivo</span>'}</td><td>${esc(e.rol)}</td><td class="hide-m">${cel(e.whatsapp)}</td><td class="hide-m">${esc(e.sucursal || '')}</td><td style="text-align:right">${admin || e.id === ME.id ? `<button class="btn sm sec" data-ed="${e.id}">Editar</button>` : ''}</td></tr>`).join('')}</table></div>
    <div class="card"><div class="card-h"><h2>Agregar a alguien</h2></div><div class="card-b small">1) En Supabase → Authentication → Users → <b>Add user</b> (correo y contraseña, "Auto Confirm").<br>2) En SQL Editor ejecuta:<pre style="background:#F4F2EE;padding:10px;border-radius:8px;overflow:auto">insert into public.equipo (id, nombre, rol, whatsapp, sucursal)
select id, 'Nombre Apellido', 'asesor', '3300000000', 'Sucursal'
from auth.users where email = 'correo@ejemplo.com';</pre></div></div>`);
  document.querySelectorAll('[data-ed]').forEach((b) => b.onclick = () => {
    const e = list.find((x) => x.id === b.dataset.ed);
    modal('Editar ' + e.nombre, `<div class="form"><div class="f"><label>Nombre</label><input name="nombre" value="${esc(e.nombre)}" required></div><div class="f"><label>WhatsApp (10 dígitos)</label><input name="whatsapp" value="${esc(e.whatsapp || '')}"></div><div class="f"><label>Sucursal</label><input name="sucursal" value="${esc(e.sucursal || '')}"></div>${admin ? `<div class="f"><label>Rol</label><select name="rol">${opt([['asesor', 'Asesor'], ['admin', 'Administrador']], e.rol)}</select></div><label class="chk f c12"><input type="checkbox" name="activo" ${e.activo ? 'checked' : ''}> Activo</label>` : ''}</div>`, async (f) => {
      const d = formData(f); const up = { nombre: d.nombre, whatsapp: d.whatsapp.replace(/\D/g, '') || null, sucursal: d.sucursal || null };
      if (admin) { up.rol = d.rol; up.activo = !!d.activo; }
      if (!admin) { const { error } = await sb.rpc('panel_editar_mi_perfil', { p_nombre: up.nombre, p_whatsapp: up.whatsapp, p_sucursal: up.sucursal }); if (error) throw error; }
      else await q(sb.from('equipo').update(up).eq('id', e.id));
      toast('Guardado'); if (e.id === ME.id) Object.assign(ME, up); route();
    });
  });
}

sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') renderLogin(); });
boot();
