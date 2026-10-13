// Configuración pública de Mi Viaje (estos valores SÍ pueden ser públicos).
// Conectado a la base del CRM de Todo Viajes (proyecto todo-viajes-crm). Ya no se usa ninguna clave secreta en Vercel.
window.MV_CONFIG = {
  SUPABASE_URL: 'https://ainayxufvdzehddfnsks.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_Ws-yxHXdUeWGKmXrPjBhjQ_Ug35j71L',
  AGENCIA_NOMBRE: 'Todo Viajes',
  AGENCIA_WHATSAPP: '523323973427', // General (sucursal Belisario). Dentro de la app se usa el WhatsApp del asesor o de la sucursal del viaje.
  AGENCIA_TELEFONO: '',             // Teléfono para llamadas (opcional)
  APP_URL: ''                       // Se llena solo con la dirección actual si se deja vacío
};
