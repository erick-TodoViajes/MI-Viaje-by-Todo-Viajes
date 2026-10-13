# Mi Viaje · Todo Viajes

App para los clientes de Todo Viajes (`/`). Desde octubre de 2026 está **integrada al CRM**: usa la misma base de datos (Supabase `todo-viajes-crm`) y el equipo la administra desde el CRM, no desde un panel aparte.

## Cómo funciona
1. En el CRM, una oportunidad en **"Venta concretada"** muestra la tarjeta **Mi Viaje → Activar**.
2. El asesor confirma los datos (prellenados desde la oportunidad) y el viaje queda creado.
3. El cliente entra a esta app con su **nombre + celular** (los del CRM) y crea un PIN de 4 números.

## Estructura
- `index.html`, `assets/` — app del cliente (PWA, sin paso de compilación)
- `config.js` — URL y clave **pública** de Supabase, WhatsApp de la agencia
- `panel/` — solo un aviso que manda al CRM (el panel viejo se retiró)
- `sw.js` — service worker; subir la versión de `CACHE` cuando cambien archivos importantes

## Base de datos (vive en el CRM)
- Tablas con prefijo `mv_` (viajes, segmentos, pagos, documentos, checklist, referidos, recompensas, actividad, accesos de clientes).
- La app solo llama funciones `mv_*` (`mv_identificar`, `mv_crear_pin`, `mv_entrar`, `mv_datos`, `mv_checklist`, `mv_evento`, `mv_salir`). No puede leer ninguna tabla directamente.
- Los documentos se abren con la función `mv-documento` de Supabase (enlace temporal de 5 minutos). **Ya no hace falta ninguna variable de entorno en Vercel.**

## Pendiente de configurar
- `AGENCIA_WHATSAPP` en `config.js` con el WhatsApp real de la agencia (lada 52).
