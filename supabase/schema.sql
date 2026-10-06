-- =====================================================================
-- MGT Auto Elétrica · banco de dados do app de oficina
-- Rodar inteiro no Supabase: SQL Editor > New query > colar > Run
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Equipe (quem pode usar o app)
-- ---------------------------------------------------------------------
create table if not exists perfis (
  id uuid primary key references auth.users on delete cascade,
  nome text not null,
  funcao text not null default 'oficina'
    check (funcao in ('admin', 'oficina', 'compras', 'financeiro')),
  criado_em timestamptz not null default now()
);

-- Convites: cada pessoa da equipe cria a própria senha no primeiro acesso,
-- usando um código de convite de uso único.
create table if not exists convites (
  codigo text primary key,
  nome text not null,
  funcao text not null default 'oficina'
    check (funcao in ('admin', 'oficina', 'compras', 'financeiro')),
  usado_por uuid,
  usado_em timestamptz,
  criado_em timestamptz not null default now()
);
alter table convites enable row level security;

create or replace function aceitar_convite() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  c convites;
begin
  update convites set usado_por = new.id, usado_em = now()
  where upper(codigo) = upper(trim(coalesce(new.raw_user_meta_data ->> 'convite', '')))
    and usado_por is null
  returning * into c;
  if found then
    insert into perfis (id, nome, funcao) values (new.id, c.nome, c.funcao)
    on conflict (id) do update set nome = excluded.nome, funcao = excluded.funcao;
  end if;
  return new;
end $$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario after insert on auth.users
  for each row execute function aceitar_convite();

-- ---------------------------------------------------------------------
-- Clientes e veículos
-- ---------------------------------------------------------------------
create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  whatsapp text,
  criado_em timestamptz not null default now()
);

create table if not exists veiculos (
  id uuid primary key default gen_random_uuid(),
  placa text not null unique,
  marca text,
  modelo text,
  ano text,
  cliente_id uuid references clientes on delete set null,
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Ordens de serviço (OS completa, serviço rápido e socorro)
-- ---------------------------------------------------------------------
create sequence if not exists ordens_numero_seq start 1;

create table if not exists ordens (
  id uuid primary key default gen_random_uuid(),
  numero integer not null default nextval('ordens_numero_seq'),
  tipo text not null default 'os' check (tipo in ('os', 'rapido', 'socorro')),
  status text not null default 'entrada' check (status in (
    'entrada', 'aguardando_aprovacao', 'aguardando_peca',
    'em_servico', 'em_teste', 'pronto', 'entregue', 'cancelado'
  )),
  veiculo_id uuid references veiculos on delete set null,
  cliente_id uuid references clientes on delete set null,
  relato text,
  diagnostico text,
  local_socorro text,
  token text not null unique default encode(gen_random_bytes(12), 'hex'),
  aprovado_em timestamptz,
  aprovado_por text,
  forma_pagamento text,
  pago_em timestamptz,
  nota_emitida boolean not null default false,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists ordens_status_idx on ordens (status);
create index if not exists ordens_pago_idx on ordens (pago_em);

create table if not exists itens (
  id uuid primary key default gen_random_uuid(),
  ordem_id uuid not null references ordens on delete cascade,
  tipo text not null check (tipo in ('servico', 'peca')),
  descricao text not null,
  quantidade numeric not null default 1,
  valor_unit numeric not null default 0,
  custo numeric,
  status_peca text check (status_peca in ('cotando', 'comprado', 'chegou')),
  criado_em timestamptz not null default now()
);
create index if not exists itens_ordem_idx on itens (ordem_id);

create table if not exists fotos (
  id uuid primary key default gen_random_uuid(),
  ordem_id uuid not null references ordens on delete cascade,
  caminho text not null,
  publica boolean not null default true,
  criado_em timestamptz not null default now()
);

create table if not exists eventos (
  id bigserial primary key,
  ordem_id uuid not null references ordens on delete cascade,
  status text not null,
  por uuid,
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Histórico automático de etapas
-- ---------------------------------------------------------------------
create or replace function registrar_evento() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into eventos (ordem_id, status, por) values (new.id, new.status, auth.uid());
  end if;
  new.atualizado_em := now();
  return new;
end $$;

drop trigger if exists ordens_evento_ins on ordens;
create trigger ordens_evento_ins after insert on ordens
  for each row execute function registrar_evento();

drop trigger if exists ordens_evento_upd on ordens;
create trigger ordens_evento_upd before update on ordens
  for each row execute function registrar_evento();

-- ---------------------------------------------------------------------
-- Segurança: só quem está cadastrado em "perfis" usa o app
-- ---------------------------------------------------------------------
create or replace function eh_equipe() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfis where id = auth.uid());
$$;

alter table perfis enable row level security;
alter table clientes enable row level security;
alter table veiculos enable row level security;
alter table ordens enable row level security;
alter table itens enable row level security;
alter table fotos enable row level security;
alter table eventos enable row level security;

drop policy if exists equipe_le_perfis on perfis;
create policy equipe_le_perfis on perfis for select to authenticated using (eh_equipe());

do $$
declare t text;
begin
  foreach t in array array['clientes', 'veiculos', 'ordens', 'itens', 'fotos', 'eventos'] loop
    execute format('drop policy if exists equipe_tudo on %I', t);
    execute format(
      'create policy equipe_tudo on %I for all to authenticated using (eh_equipe()) with check (eh_equipe())', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Link do cliente (acesso público só pelo token da OS)
-- ---------------------------------------------------------------------
create or replace function os_publica(p_token text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'numero', o.numero,
    'tipo', o.tipo,
    'status', o.status,
    'relato', o.relato,
    'diagnostico', o.diagnostico,
    'aprovado_em', o.aprovado_em,
    'criado_em', o.criado_em,
    'cliente', (select split_part(c.nome, ' ', 1) from clientes c where c.id = o.cliente_id),
    'veiculo', (select json_build_object('placa', v.placa, 'marca', v.marca, 'modelo', v.modelo, 'ano', v.ano)
                from veiculos v where v.id = o.veiculo_id),
    'itens', coalesce((select json_agg(json_build_object(
                'tipo', i.tipo, 'descricao', i.descricao,
                'quantidade', i.quantidade, 'valor_unit', i.valor_unit) order by i.tipo desc, i.criado_em)
              from itens i where i.ordem_id = o.id), '[]'::json),
    'fotos', coalesce((select json_agg(f.caminho order by f.criado_em)
              from fotos f where f.ordem_id = o.id and f.publica), '[]'::json),
    'eventos', coalesce((select json_agg(json_build_object('status', e.status, 'em', e.criado_em) order by e.criado_em)
              from eventos e where e.ordem_id = o.id), '[]'::json)
  )
  from ordens o
  where o.token = p_token and o.status <> 'cancelado';
$$;

create or replace function aprovar_os(p_token text) returns text
language plpgsql security definer set search_path = public as $$
declare
  o ordens;
  falta_peca boolean;
  novo text;
begin
  select * into o from ordens where token = p_token for update;
  if not found then raise exception 'OS não encontrada'; end if;
  if o.status <> 'aguardando_aprovacao' then return o.status; end if;

  select exists (
    select 1 from itens where ordem_id = o.id and tipo = 'peca' and coalesce(status_peca, 'cotando') <> 'chegou'
  ) into falta_peca;
  novo := case when falta_peca then 'aguardando_peca' else 'em_servico' end;

  update ordens set status = novo, aprovado_em = now(), aprovado_por = 'cliente pelo link'
  where id = o.id;
  return novo;
end $$;

revoke all on function os_publica(text) from public;
revoke all on function aprovar_os(text) from public;
grant execute on function os_publica(text) to anon, authenticated;
grant execute on function aprovar_os(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Fotos (Storage)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', true)
on conflict (id) do nothing;

drop policy if exists equipe_envia_fotos on storage.objects;
create policy equipe_envia_fotos on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and eh_equipe());

drop policy if exists equipe_apaga_fotos on storage.objects;
create policy equipe_apaga_fotos on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and eh_equipe());

-- ---------------------------------------------------------------------
-- Atualização ao vivo do quadro
-- ---------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table ordens, itens;
exception when duplicate_object then null;
end $$;
