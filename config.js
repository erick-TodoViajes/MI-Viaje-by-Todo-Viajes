// Configuración pública de Mi Viaje (estos valores SÍ pueden ser públicos).
// La clave secreta (service_role) NUNCA va aquí: se configura en Vercel como variable de entorno.
window.MV_CONFIG = {
  SUPABASE_URL: 'https://knslzwptqxpiuchlkudk.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_PIV2IjuZiNOjUuNjoI0gqg_mDsxft6G',
  AGENCIA_NOMBRE: 'Todo Viajes',
  AGENCIA_WHATSAPP: '520000000000', // WhatsApp general con lada de país, sin espacios (ej. 523312345678)
  AGENCIA_TELEFONO: '',             // Teléfono para llamadas (opcional)
  APP_URL: ''                       // Se llena solo con la dirección actual si se deja vacío
};
