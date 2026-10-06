# Mi Viaje · Todo Viajes

App para clientes (`/`) y panel del equipo (`/panel`). Funciona con Supabase y Vercel, sin paso de compilación.

## Estructura
- `index.html`, `assets/` — app del cliente (entra con nombre + celular → PIN de 4 números)
- `panel/` — panel del equipo (correo + contraseña de Supabase Auth)
- `api/documento.js` — función de Vercel que genera enlaces temporales a documentos privados
- `config.js` — URL y clave **pública** de Supabase, WhatsApp de la agencia
- `supabase/` — scripts SQL (ejecutar en orden: 01, 02)

## Variables de entorno en Vercel
| Nombre | Valor |
|---|---|
| `SUPABASE_URL` | `https://knslzwptqxpiuchlkudk.supabase.co` |
| `SUPABASE_SECRET_KEY` | clave secreta (service_role / `sb_secret_…`) — **solo en Vercel** |

## Ajustes recomendados en Supabase
- Authentication → Sign In / Providers → desactivar **"Allow new users to sign up"** (el equipo se da de alta manualmente).
