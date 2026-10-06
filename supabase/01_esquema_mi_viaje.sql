-- =====================================================================
--  MI VIAJE by TODO VIAJES — Esquema de base de datos (Fase 1)
--  Cómo usarlo: Supabase → SQL Editor → New query → pegar todo → Run.
--  Se puede ejecutar una sola vez en un proyecto nuevo.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- 1. EQUIPO (usuarios del panel; entran con correo y contraseña de Supabase Auth)
-- ---------------------------------------------------------------------
create table public.equipo (
  id          uuid primary key references auth.users(id) on delete cascade,
  nombre      text not null,
  rol         text not null default 'asesor' check (rol in ('admin','asesor')),
  sucursal    text,
  whatsapp    text,                       -- WhatsApp del asesor (10 dígitos)
  activo      boolean not null default true,
  creado_en   timestamptz not null default now()
);

create or replace function public.es_equipo() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.equipo where id = auth.uid() and activo);
$$;

create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.equipo where id = auth.uid() and activo and rol = 'admin');
$$;

-- ---------------------------------------------------------------------
-- 2. CLIENTES (entran con nombre + celular la primera vez, luego celular + PIN)
-- ---------------------------------------------------------------------
create or replace function public.normalizar_texto(t text) returns text
language sql immutable as $$
  select trim(regexp_replace(
           translate(lower(coalesce(t,'')),
                     'áàäâãéèëêíìïîóòöôõúùüûñç',
                     'aaaaaeeeeiiiiooooouuuunc'),
           '[^a-z0-9 ]', '', 'g'));
$$;

create table public.clientes (
  id                 uuid primary key default gen_random_uuid(),
  nombre_completo    text not null,
  celular            text not null unique check (celular ~ '^[0-9]{10}$'),
  email              text,
  fecha_nacimiento   date,
  pin_hash           text,
  pin_creado_en      timestamptz,
  intentos_fallidos  int not null default 0,
  bloqueado_hasta    timestamptz,
  codigo_referido    text unique,
  referido_por       uuid references public.clientes(id),
  ultima_entrada     timestamptz,
  notas_internas     text,
  creado_por         uuid references public.equipo(id),
  creado_en          timestamptz not null default now()
);

-- Código de referido automático: primer nombre (máx 6 letras) + 3 dígitos. Ej. ERICK482
create or replace function public.generar_codigo_referido() returns trigger
language plpgsql as $$
declare base text; intento text; n int := 0;
begin
  if new.codigo_referido is not null then return new; end if;
  base := upper(left(regexp_replace(split_part(public.normalizar_texto(new.nombre_completo),' ',1),'[^a-z]','','g'),6));
  if base = '' then base := 'VIAJE'; end if;
  loop
    intento := base || lpad((floor(random()*900)+100)::int::text, 3, '0');
    exit when not exists (select 1 from public.clientes where codigo_referido = intento);
    n := n + 1;
    if n > 50 then intento := base || floor(random()*900000+100000)::int::text; exit; end if;
  end loop;
  new.codigo_referido := intento;
  return new;
end $$;

create trigger trg_codigo_referido before insert on public.clientes
for each row execute function public.generar_codigo_referido();

-- Sesiones del cliente (se guarda solo el hash del token)
create table public.sesiones (
  token_hash  text primary key,
  cliente_id  uuid not null references public.clientes(id) on delete cascade,
  expira_en   timestamptz not null,
  creado_en   timestamptz not null default now()
);
create index on public.sesiones (cliente_id);

-- ---------------------------------------------------------------------
-- 3. VIAJES
-- ---------------------------------------------------------------------
create table public.viajes (
  id            uuid primary key default gen_random_uuid(),
  titulo        text not null,                 -- "Punta Cana"
  destino       text not null,                 -- "Punta Cana, República Dominicana"
  bandera       text,                          -- "🇩🇴"
  tema          text not null default 'tropical'
                check (tema in ('tropical','europa','aventura','urbano','mexico','crucero','otro')),
  imagen_url    text,
  fecha_inicio  date not null,
  fecha_fin     date not null,
  estado        text not null default 'confirmado' check (estado in ('confirmado','cancelado')),
  incluye       text,                          -- texto libre: qué incluye el viaje
  total         numeric(12,2) not null default 0,
  moneda        text not null default 'MXN',
  asesor_id     uuid references public.equipo(id),
  sucursal      text,
  notas_cliente text,                          -- notas visibles para el cliente
  creado_en     timestamptz not null default now(),
  check (fecha_fin >= fecha_inicio)
);

-- Quién viaja (viajes de grupo: cada acompañante entra con su propio celular)
create table public.viaje_viajeros (
  viaje_id    uuid not null references public.viajes(id) on delete cascade,
  cliente_id  uuid not null references public.clientes(id) on delete cascade,
  es_titular  boolean not null default false,
  primary key (viaje_id, cliente_id)
);
create index on public.viaje_viajeros (cliente_id);

-- Vuelos, hotel, traslados, actividades
create table public.segmentos (
  id           uuid primary key default gen_random_uuid(),
  viaje_id     uuid not null references public.viajes(id) on delete cascade,
  tipo         text not null check (tipo in ('vuelo','hotel','traslado','actividad','otro')),
  titulo       text not null,               -- "GDL → PUJ" / "Grand Palladium"
  descripcion  text,
  inicio       timestamptz,
  fin          timestamptz,
  lugar        text,                        -- aeropuerto, dirección del hotel, punto de encuentro
  proveedor    text,                        -- aerolínea, hotel, operador
  localizador  text,                        -- clave de reservación
  detalles     jsonb not null default '{}', -- vuelo, terminal, tipo de habitación, etc.
  orden        int not null default 0
);
create index on public.segmentos (viaje_id);

-- Documentos (archivos en el bucket privado "documentos")
create table public.documentos (
  id            uuid primary key default gen_random_uuid(),
  viaje_id      uuid not null references public.viajes(id) on delete cascade,
  tipo          text not null default 'otro'
                check (tipo in ('confirmacion','voucher','boleto','seguro','itinerario','otro')),
  nombre        text not null,
  ruta_storage  text not null,
  visible       boolean not null default true,
  creado_en     timestamptz not null default now()
);
create index on public.documentos (viaje_id);

-- Plan de pagos (fechas límite) y pagos realizados
create table public.plan_pagos (
  id            uuid primary key default gen_random_uuid(),
  viaje_id      uuid not null references public.viajes(id) on delete cascade,
  fecha_limite  date not null,
  monto         numeric(12,2) not null check (monto > 0),
  descripcion   text
);
create index on public.plan_pagos (viaje_id);

create table public.pagos (
  id          uuid primary key default gen_random_uuid(),
  viaje_id    uuid not null references public.viajes(id) on delete cascade,
  cliente_id  uuid references public.clientes(id),
  fecha       date not null default current_date,
  monto       numeric(12,2) not null check (monto > 0),
  metodo      text,
  referencia  text,
  registrado_por uuid references public.equipo(id),
  creado_en   timestamptz not null default now()
);
create index on public.pagos (viaje_id);

-- Checklist de preparación
create table public.checklist (
  id             uuid primary key default gen_random_uuid(),
  viaje_id       uuid not null references public.viajes(id) on delete cascade,
  texto          text not null,
  orden          int not null default 0,
  completado     boolean not null default false,
  completado_en  timestamptz,
  solo_equipo    boolean not null default false  -- p.ej. "Reserva confirmada": solo la marca el equipo
);
create index on public.checklist (viaje_id);

-- Plantillas de viaje (paquetes que se venden seguido)
create table public.plantillas (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  titulo     text, destino text, bandera text, tema text, imagen_url text, incluye text,
  noches     int,
  segmentos  jsonb not null default '[]',
  checklist  jsonb not null default '[]',
  creado_en  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 4. REFERIDOS Y RECOMPENSAS (configurables desde el panel)
-- ---------------------------------------------------------------------
create table public.config_referidos (
  id                       int primary key default 1 check (id = 1),
  activo                   boolean not null default true,
  nuevo_tipo               text not null default 'porcentaje' check (nuevo_tipo in ('porcentaje','monto','texto','ninguna')),
  nuevo_valor              numeric(12,2) default 10,
  nuevo_texto              text default '10% de descuento en tu viaje',
  referidor_tipo           text not null default 'texto' check (referidor_tipo in ('porcentaje','monto','texto','ninguna')),
  referidor_valor          numeric(12,2),
  referidor_texto          text default 'Recompensa por recomendar a Todo Viajes',
  mensaje_compartir        text default '¡Viaja con Todo Viajes! Usa mi código {codigo} y obtén {recompensa}.',
  actualizado_en           timestamptz not null default now()
);
insert into public.config_referidos (id) values (1);

create table public.referidos (
  id                    uuid primary key default gen_random_uuid(),
  referidor_id          uuid not null references public.clientes(id),
  referido_id           uuid not null references public.clientes(id) unique,  -- un cliente solo puede ser referido una vez
  viaje_id              uuid references public.viajes(id),
  estado                text not null default 'reservado' check (estado in ('reservado','cancelado')),
  recompensa_nuevo      jsonb not null,      -- copia de la promoción vigente ese día
  recompensa_referidor  jsonb not null,
  creado_en             timestamptz not null default now(),
  check (referidor_id <> referido_id)
);
create index on public.referidos (referidor_id);

create table public.recompensas (
  id           uuid primary key default gen_random_uuid(),
  cliente_id   uuid not null references public.clientes(id) on delete cascade,
  origen       text not null default 'referido' check (origen in ('referido','bienvenida','manual')),
  referido_id  uuid references public.referidos(id) on delete set null,
  descripcion  text not null,
  tipo         text not null check (tipo in ('porcentaje','monto','texto')),
  valor        numeric(12,2),
  estado       text not null default 'disponible' check (estado in ('disponible','usada','cancelada')),
  usada_en     timestamptz,
  creado_en    timestamptz not null default now()
);
create index on public.recompensas (cliente_id);

-- Actividad del cliente (para que el equipo sepa quién usa la app)
create table public.actividad (
  id          bigint generated always as identity primary key,
  cliente_id  uuid not null references public.clientes(id) on delete cascade,
  evento      text not null,     -- entrada, ver_documento, compartir_codigo, checklist...
  detalle     jsonb not null default '{}',
  creado_en   timestamptz not null default now()
);
create index on public.actividad (cliente_id, creado_en desc);

-- ---------------------------------------------------------------------
-- 5. SEGURIDAD: los clientes NO leen tablas directamente.
--    Solo el equipo (autenticado) tiene acceso a tablas; los clientes usan las funciones mv_*.
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['equipo','clientes','sesiones','viajes','viaje_viajeros','segmentos',
    'documentos','plan_pagos','pagos','checklist','plantillas','config_referidos','referidos',
    'recompensas','actividad']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on public.sesiones from authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- El equipo puede ver y editar todo (excepto sesiones)
do $$
declare t text;
begin
  foreach t in array array['clientes','viajes','viaje_viajeros','segmentos','documentos',
    'plan_pagos','pagos','checklist','plantillas','referidos','recompensas','actividad']
  loop
    execute format('create policy equipo_todo on public.%I for all to authenticated using (public.es_equipo()) with check (public.es_equipo())', t);
  end loop;
end $$;

create policy equipo_lee on public.equipo for select to authenticated using (public.es_equipo());
create policy admin_edita on public.equipo for all to authenticated using (public.es_admin()) with check (public.es_admin());
create policy equipo_lee_config on public.config_referidos for select to authenticated using (public.es_equipo());
create policy admin_edita_config on public.config_referidos for update to authenticated using (public.es_admin()) with check (public.es_admin());

-- ---------------------------------------------------------------------
-- 6. FUNCIONES PARA LA APP DEL CLIENTE
-- ---------------------------------------------------------------------

-- Helpers internos
create or replace function public._limpiar_celular(c text) returns text
language sql immutable as $$ select right(regexp_replace(coalesce(c,''),'[^0-9]','','g'), 10); $$;

create or replace function public._nombre_coincide(escrito text, guardado text) returns boolean
language plpgsql immutable as $$
declare
  e text[] := string_to_array(public.normalizar_texto(escrito), ' ');
  g text[] := string_to_array(public.normalizar_texto(guardado), ' ');
  coincidencias int;
begin
  e := array_remove(e, ''); g := array_remove(g, '');
  if array_length(e,1) is null or array_length(g,1) is null then return false; end if;
  -- Deben coincidir al menos 2 palabras del nombre (p.ej. nombre + apellido),
  -- tolera acentos, mayúsculas y segundo apellido faltante
  select count(*) into coincidencias from unnest(e) x where x = any(g);
  return coincidencias >= least(2, array_length(g,1));
end $$;

create or replace function public._nueva_sesion(p_cliente uuid) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare tok text := encode(gen_random_bytes(32), 'hex');
begin
  insert into sesiones (token_hash, cliente_id, expira_en)
  values (encode(digest(tok, 'sha256'), 'hex'), p_cliente, now() + interval '90 days');
  update clientes set ultima_entrada = now(), intentos_fallidos = 0, bloqueado_hasta = null where id = p_cliente;
  insert into actividad (cliente_id, evento) values (p_cliente, 'entrada');
  delete from sesiones where expira_en < now();
  return tok;
end $$;

create or replace function public._cliente_de_token(p_token text) returns uuid
language sql stable security definer set search_path = public, extensions as $$
  select cliente_id from sesiones
  where token_hash = encode(digest(coalesce(p_token,''), 'sha256'), 'hex') and expira_en > now();
$$;

-- Paso 1: ¿quién eres?  → 'crear_pin' | 'pedir_pin' | 'no_encontrado' | 'bloqueado'
create or replace function public.mv_identificar(p_nombre text, p_celular text) returns json
language plpgsql security definer set search_path = public as $$
declare c clientes;
begin
  select * into c from clientes where celular = _limpiar_celular(p_celular);
  if not found or not _nombre_coincide(p_nombre, c.nombre_completo) then
    perform pg_sleep(0.5);
    return json_build_object('estado','no_encontrado');
  end if;
  if c.bloqueado_hasta is not null and c.bloqueado_hasta > now() then
    return json_build_object('estado','bloqueado','hasta',c.bloqueado_hasta);
  end if;
  return json_build_object('estado', case when c.pin_hash is null then 'crear_pin' else 'pedir_pin' end,
                           'nombre', split_part(c.nombre_completo,' ',1));
end $$;

-- Paso 2a: primera vez → crea PIN y devuelve token de sesión
create or replace function public.mv_crear_pin(p_nombre text, p_celular text, p_pin text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare c clientes;
begin
  if p_pin !~ '^[0-9]{4}$' then return json_build_object('error','El PIN debe tener 4 números'); end if;
  if p_pin in ('0000','1111','2222','3333','4444','5555','6666','7777','8888','9999','1234','4321') then
    return json_build_object('error','Elige un PIN menos obvio');
  end if;
  select * into c from clientes where celular = _limpiar_celular(p_celular);
  if not found or not _nombre_coincide(p_nombre, c.nombre_completo) or c.pin_hash is not null then
    return json_build_object('error','No pudimos crear tu PIN');
  end if;
  update clientes set pin_hash = crypt(p_pin, gen_salt('bf')), pin_creado_en = now() where id = c.id;
  return json_build_object('token', _nueva_sesion(c.id));
end $$;

-- Paso 2b: ya tiene PIN → celular + PIN. 5 intentos fallidos = bloqueo 15 min
create or replace function public.mv_entrar(p_celular text, p_pin text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare c clientes;
begin
  select * into c from clientes where celular = _limpiar_celular(p_celular);
  if not found or c.pin_hash is null then
    perform pg_sleep(0.5);
    return json_build_object('error','Celular o PIN incorrecto');
  end if;
  if c.bloqueado_hasta is not null and c.bloqueado_hasta > now() then
    return json_build_object('error','Demasiados intentos. Intenta de nuevo en unos minutos.','bloqueado',true);
  end if;
  if c.pin_hash = crypt(coalesce(p_pin,''), c.pin_hash) then
    return json_build_object('token', _nueva_sesion(c.id));
  end if;
  -- si ya pasó un bloqueo anterior, el contador empieza de nuevo
  if c.bloqueado_hasta is not null then c.intentos_fallidos := 0; end if;
  update clientes set intentos_fallidos = c.intentos_fallidos + 1,
         bloqueado_hasta = case when c.intentos_fallidos + 1 >= 5 then now() + interval '15 minutes' end
  where id = c.id;
  return json_build_object('error','Celular o PIN incorrecto');
end $$;

create or replace function public.mv_salir(p_token text) returns void
language sql security definer set search_path = public, extensions as $$
  delete from sesiones where token_hash = encode(digest(coalesce(p_token,''), 'sha256'), 'hex');
$$;

-- Todo lo del cliente en una sola llamada
create or replace function public.mv_datos(p_token text) returns json
language plpgsql stable security definer set search_path = public as $$
declare cid uuid := _cliente_de_token(p_token); r json;
begin
  if cid is null then return json_build_object('error','sesion'); end if;
  select json_build_object(
    'cliente', (select json_build_object('id',c.id,'nombre',c.nombre_completo,
                 'primer_nombre',split_part(c.nombre_completo,' ',1),'celular',c.celular,
                 'email',c.email,'codigo_referido',c.codigo_referido) from clientes c where c.id = cid),
    'viajes', coalesce((
      select json_agg(json_build_object(
        'id',v.id,'titulo',v.titulo,'destino',v.destino,'bandera',v.bandera,'tema',v.tema,
        'imagen_url',v.imagen_url,'fecha_inicio',v.fecha_inicio,'fecha_fin',v.fecha_fin,
        'incluye',v.incluye,'notas',v.notas_cliente,'total',v.total,'moneda',v.moneda,
        'es_titular',vv.es_titular,
        'asesor',(select json_build_object('nombre',e.nombre,'whatsapp',e.whatsapp,'sucursal',e.sucursal)
                  from equipo e where e.id = v.asesor_id),
        'viajeros',(select json_agg(split_part(c2.nombre_completo,' ',1) order by x.es_titular desc)
                    from viaje_viajeros x join clientes c2 on c2.id = x.cliente_id where x.viaje_id = v.id),
        'segmentos',coalesce((select json_agg(s order by s.inicio nulls last, s.orden) from
                    (select id,tipo,titulo,descripcion,inicio,fin,lugar,proveedor,localizador,detalles,orden
                     from segmentos where viaje_id = v.id) s),'[]'),
        'documentos',coalesce((select json_agg(json_build_object('id',d.id,'tipo',d.tipo,'nombre',d.nombre) order by d.creado_en)
                    from documentos d where d.viaje_id = v.id and d.visible),'[]'),
        'plan_pagos',coalesce((select json_agg(json_build_object('fecha',p.fecha_limite,'monto',p.monto,'descripcion',p.descripcion) order by p.fecha_limite)
                    from plan_pagos p where p.viaje_id = v.id),'[]'),
        'pagos',coalesce((select json_agg(json_build_object('fecha',p.fecha,'monto',p.monto,'metodo',p.metodo) order by p.fecha)
                    from pagos p where p.viaje_id = v.id),'[]'),
        'pagado',(select coalesce(sum(monto),0) from pagos p where p.viaje_id = v.id),
        'checklist',coalesce((select json_agg(json_build_object('id',k.id,'texto',k.texto,'completado',k.completado,'solo_equipo',k.solo_equipo) order by k.orden)
                    from checklist k where k.viaje_id = v.id),'[]')
      ) order by v.fecha_inicio)
      from viajes v join viaje_viajeros vv on vv.viaje_id = v.id and vv.cliente_id = cid
      where v.estado = 'confirmado'), '[]'),
    'recompensas', coalesce((select json_agg(json_build_object('id',x.id,'descripcion',x.descripcion,'estado',x.estado,'creado_en',x.creado_en) order by x.creado_en desc)
                    from recompensas x where x.cliente_id = cid),'[]'),
    'referidos', json_build_object(
        'total',(select count(*) from referidos where referidor_id = cid and estado='reservado'),
        'lista',coalesce((select json_agg(json_build_object('nombre',split_part(c3.nombre_completo,' ',1),'fecha',f.creado_en) order by f.creado_en desc)
                 from referidos f join clientes c3 on c3.id = f.referido_id
                 where f.referidor_id = cid and f.estado='reservado'),'[]')),
    'promo', (select json_build_object('activo',activo,'nuevo_texto',nuevo_texto,'referidor_texto',referidor_texto,
                 'mensaje',mensaje_compartir) from config_referidos where id = 1)
  ) into r;
  return r;
end $$;

-- El cliente marca/desmarca su checklist
create or replace function public.mv_checklist(p_token text, p_item uuid, p_completado boolean) returns json
language plpgsql security definer set search_path = public as $$
declare cid uuid := _cliente_de_token(p_token);
begin
  if cid is null then return json_build_object('error','sesion'); end if;
  update checklist k set completado = p_completado, completado_en = case when p_completado then now() end
  where k.id = p_item and not k.solo_equipo
    and exists (select 1 from viaje_viajeros vv where vv.viaje_id = k.viaje_id and vv.cliente_id = cid);
  if not found then return json_build_object('error','no_permitido'); end if;
  insert into actividad (cliente_id, evento, detalle) values (cid, 'checklist', json_build_object('item',p_item,'completado',p_completado)::jsonb);
  return json_build_object('ok',true);
end $$;

-- Registrar eventos (ver documento, compartir código, etc.)
create or replace function public.mv_evento(p_token text, p_evento text, p_detalle jsonb default '{}') returns void
language plpgsql security definer set search_path = public as $$
declare cid uuid := _cliente_de_token(p_token);
begin
  if cid is null or p_evento !~ '^[a-z_]{2,40}$' then return; end if;
  insert into actividad (cliente_id, evento, detalle) values (cid, p_evento, coalesce(p_detalle,'{}'::jsonb));
end $$;

-- Ruta de un documento (la usa la función de Vercel para generar el enlace de descarga temporal)
create or replace function public.mv_ruta_documento(p_token text, p_documento uuid) returns text
language plpgsql security definer set search_path = public as $$
declare cid uuid := _cliente_de_token(p_token); ruta text;
begin
  if cid is null then return null; end if;
  select d.ruta_storage into ruta from documentos d
  join viaje_viajeros vv on vv.viaje_id = d.viaje_id and vv.cliente_id = cid
  where d.id = p_documento and d.visible;
  if ruta is not null then
    insert into actividad (cliente_id, evento, detalle) values (cid, 'ver_documento', json_build_object('documento',p_documento)::jsonb);
  end if;
  return ruta;
end $$;

-- ---------------------------------------------------------------------
-- 7. FUNCIONES PARA EL PANEL (solo equipo)
-- ---------------------------------------------------------------------

-- Restablecer PIN de un cliente (cuando lo olvida)
create or replace function public.panel_restablecer_pin(p_cliente uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not es_equipo() then raise exception 'No autorizado'; end if;
  update clientes set pin_hash = null, pin_creado_en = null, intentos_fallidos = 0, bloqueado_hasta = null where id = p_cliente;
  delete from sesiones where cliente_id = p_cliente;
end $$;

-- Aplicar un código de referido a un cliente nuevo. Guarda la promoción vigente ese día.
create or replace function public.panel_aplicar_referido(p_codigo text, p_cliente uuid, p_viaje uuid default null) returns json
language plpgsql security definer set search_path = public as $$
declare cfg config_referidos; ref clientes; rid uuid;
begin
  if not es_equipo() then raise exception 'No autorizado'; end if;
  select * into cfg from config_referidos where id = 1;
  if not cfg.activo then return json_build_object('error','El programa de referidos está pausado'); end if;
  select * into ref from clientes where codigo_referido = upper(trim(p_codigo));
  if not found then return json_build_object('error','Código no encontrado'); end if;
  if ref.id = p_cliente then return json_build_object('error','Un cliente no puede usar su propio código'); end if;
  if exists (select 1 from referidos where referido_id = p_cliente) then
    return json_build_object('error','Este cliente ya fue referido antes');
  end if;

  insert into referidos (referidor_id, referido_id, viaje_id, recompensa_nuevo, recompensa_referidor)
  values (ref.id, p_cliente, p_viaje,
          json_build_object('tipo',cfg.nuevo_tipo,'valor',cfg.nuevo_valor,'texto',cfg.nuevo_texto)::jsonb,
          json_build_object('tipo',cfg.referidor_tipo,'valor',cfg.referidor_valor,'texto',cfg.referidor_texto)::jsonb)
  returning id into rid;

  update clientes set referido_por = ref.id where id = p_cliente;

  if cfg.nuevo_tipo <> 'ninguna' then
    insert into recompensas (cliente_id, origen, referido_id, descripcion, tipo, valor)
    values (p_cliente, 'bienvenida', rid, cfg.nuevo_texto, cfg.nuevo_tipo, cfg.nuevo_valor);
  end if;
  if cfg.referidor_tipo <> 'ninguna' then
    insert into recompensas (cliente_id, origen, referido_id, descripcion, tipo, valor)
    values (ref.id, 'referido', rid, cfg.referidor_texto, cfg.referidor_tipo, cfg.referidor_valor);
  end if;

  return json_build_object('ok',true,'referidor',ref.nombre_completo,
                           'recompensa_nuevo',cfg.nuevo_texto,'recompensa_referidor',cfg.referidor_texto);
end $$;

-- Permisos de ejecución
revoke execute on all functions in schema public from public, anon;
grant execute on function public.mv_identificar(text,text)          to anon, authenticated;
grant execute on function public.mv_crear_pin(text,text,text)        to anon, authenticated;
grant execute on function public.mv_entrar(text,text)                to anon, authenticated;
grant execute on function public.mv_salir(text)                      to anon, authenticated;
grant execute on function public.mv_datos(text)                      to anon, authenticated;
grant execute on function public.mv_checklist(text,uuid,boolean)     to anon, authenticated;
grant execute on function public.mv_evento(text,text,jsonb)          to anon, authenticated;
grant execute on function public.mv_ruta_documento(text,uuid)        to anon, authenticated, service_role;
grant execute on function public.panel_restablecer_pin(uuid)         to authenticated;
grant execute on function public.panel_aplicar_referido(text,uuid,uuid) to authenticated;
grant execute on function public.es_equipo()                         to authenticated;
grant execute on function public.es_admin()                          to authenticated;

-- ---------------------------------------------------------------------
-- 8. ALMACENAMIENTO: bucket privado para documentos e imágenes de destino
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('documentos','documentos', false)
on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('imagenes','imagenes', true)
on conflict (id) do nothing;

create policy equipo_documentos on storage.objects for all to authenticated
  using (bucket_id in ('documentos','imagenes') and public.es_equipo())
  with check (bucket_id in ('documentos','imagenes') and public.es_equipo());

-- =====================================================================
-- FIN. Después de ejecutar:
--   1) Authentication → Users → Add user (tu correo y contraseña)
--   2) Ejecuta (cambiando el correo y nombre):
--      insert into public.equipo (id, nombre, rol, whatsapp)
--      select id, 'Tu Nombre', 'admin', '3300000000' from auth.users where email = 'tu@correo.com';
-- =====================================================================
