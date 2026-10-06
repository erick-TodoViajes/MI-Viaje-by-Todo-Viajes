// Genera un enlace temporal (5 min) para que el cliente abra un documento de SU viaje.
// Variables de entorno en Vercel: SUPABASE_URL y SUPABASE_SECRET_KEY (service_role / sb_secret_...).
function headers(key) {
  const h = { apikey: key, 'Content-Type': 'application/json' };
  if (/^ey/.test(key)) h.Authorization = 'Bearer ' + key; // claves antiguas tipo JWT
  return h;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  const URL = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_SECRET_KEY;
  if (!URL || !KEY) return res.status(500).json({ error: 'Falta configurar el servidor' });

  let body = req.body || {};
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const { token, id } = body;
  if (typeof token !== 'string' || !/^[0-9a-f-]{36}$/i.test(String(id || ''))) return res.status(400).json({ error: 'Solicitud inválida' });

  try {
    // 1) Validar que el documento pertenece a un viaje del cliente (la función revisa la sesión)
    const r1 = await fetch(`${URL}/rest/v1/rpc/mv_ruta_documento`, {
      method: 'POST', headers: headers(KEY), body: JSON.stringify({ p_token: token, p_documento: id })
    });
    const ruta = await r1.json();
    if (!r1.ok || !ruta || typeof ruta !== 'string') return res.status(404).json({ error: 'Documento no disponible' });

    // 2) Firmar el archivo del bucket privado
    const path = ruta.split('/').map(encodeURIComponent).join('/');
    const r2 = await fetch(`${URL}/storage/v1/object/sign/documentos/${path}`, {
      method: 'POST', headers: headers(KEY), body: JSON.stringify({ expiresIn: 300 })
    });
    const j = await r2.json();
    const signed = j.signedURL || j.signedUrl;
    if (!r2.ok || !signed) return res.status(404).json({ error: 'Documento no disponible' });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ url: `${URL}/storage/v1${signed}` });
  } catch (e) {
    return res.status(500).json({ error: 'No se pudo abrir el documento' });
  }
};
