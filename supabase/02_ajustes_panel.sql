-- MI VIAJE — Ajuste 02: un asesor puede editar su propio nombre, WhatsApp y sucursal.
-- Ejecutar una sola vez en Supabase → SQL Editor.
create or replace function public.panel_editar_mi_perfil(p_nombre text, p_whatsapp text, p_sucursal text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not es_equipo() then raise exception 'No autorizado'; end if;
  update equipo set nombre = coalesce(nullif(trim(p_nombre),''), nombre),
                    whatsapp = nullif(regexp_replace(coalesce(p_whatsapp,''),'[^0-9]','','g'),''),
                    sucursal = nullif(trim(coalesce(p_sucursal,'')),'')
  where id = auth.uid();
end $$;
revoke execute on function public.panel_editar_mi_perfil(text,text,text) from public, anon;
grant execute on function public.panel_editar_mi_perfil(text,text,text) to authenticated;

-- El código de referido automático se genera con permisos del sistema (no del usuario que inserta)
alter function public.generar_codigo_referido() security definer set search_path = public;

-- Seguridad extra: las funciones internas solo se usan dentro de otras funciones.
-- (En Supabase los usuarios autenticados reciben permisos por defecto; aquí se los quitamos.)
revoke execute on function public._nueva_sesion(uuid)              from public, anon, authenticated;
revoke execute on function public._cliente_de_token(text)          from public, anon, authenticated;
revoke execute on function public._nombre_coincide(text,text)      from public, anon, authenticated;
revoke execute on function public._limpiar_celular(text)           from public, anon, authenticated;
revoke execute on function public.generar_codigo_referido()        from public, anon, authenticated;
