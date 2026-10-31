-- OtimizaCV: esquema inicial de produção. Execute no SQL Editor do Supabase.
create extension if not exists pgcrypto;
create table if not exists public.candidatos (
 id uuid primary key default gen_random_uuid(), nome text not null, email text not null,
 aceite_lgpd boolean not null default false, data_aceite timestamptz, criado_em timestamptz not null default now(), excluir_em timestamptz
);
create table if not exists public.analises (
 id uuid primary key default gen_random_uuid(), candidato_id uuid not null references public.candidatos(id) on delete cascade,
 etapa_atual text not null default 'upload', nome_arquivo text, caminho_arquivo text, mime_type text,
 texto_robo text, dados_extraidos jsonb, checagens jsonb, diagnostico jsonb, respostas jsonb not null default '{}'::jsonb,
 perfil_mestre jsonb, auditoria_perfil jsonb, conferencia jsonb, status text not null default 'em_andamento',
 versao_prompt text not null default 'v1', criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now()
);
create table if not exists public.perguntas (
 id uuid primary key default gen_random_uuid(), analise_id uuid not null references public.analises(id) on delete cascade,
 id_pergunta text not null, pergunta text not null, motivo text, tipo text not null, opcoes jsonb not null default '[]'::jsonb,
 ideal text, resolve jsonb not null default '[]'::jsonb, resposta jsonb, unique(analise_id,id_pergunta)
);
create table if not exists public.gerados (
 id uuid primary key default gen_random_uuid(), analise_id uuid not null references public.analises(id) on delete cascade,
 modelo_curriculo text not null, caminho_docx text, caminho_pdf text, perfil_versao integer, criado_em timestamptz not null default now()
);
create table if not exists public.log_custos (
 id bigserial primary key, analise_id uuid references public.analises(id) on delete set null, etapa text not null,
 provedor text, modelo text, tokens_entrada integer, tokens_saida integer, custo_usd numeric(14,8), duracao_ms integer,
 sucesso boolean not null, erro text, criado_em timestamptz not null default now()
);
create index if not exists idx_analises_candidato on public.analises(candidato_id, criado_em desc);
create index if not exists idx_perguntas_analise on public.perguntas(analise_id);
-- Privacidade: RLS habilitado; as políticas de proprietário são definidas ao final deste arquivo. O backend usa service role com verificação explícita do usuário.
alter table public.candidatos enable row level security;
alter table public.analises enable row level security;
alter table public.perguntas enable row level security;
alter table public.gerados enable row level security;
alter table public.log_custos enable row level security;

-- Bucket privado para os currículos originais e artefatos gerados.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('curriculos', 'curriculos', false, 10485760, array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do nothing;

-- Histórico de versões do perfil mestre, equivalente à aba PERFIL_MESTRE do Apps Script.
alter table public.analises add column if not exists perfil_versoes jsonb not null default '[]'::jsonb;

-- Autenticação: cada candidato criado pela aplicação fica vinculado ao usuário Supabase Auth.
-- Coluna nullable para não quebrar registros legados; novos uploads exigem auth_user_id no backend.
alter table public.candidatos
  add column if not exists auth_user_id uuid references auth.users(id) on delete cascade;
create index if not exists idx_candidatos_auth_user on public.candidatos(auth_user_id, criado_em desc);

-- As tabelas seguem sem políticas de leitura/escrita direta para anon/authenticated.
-- O acesso aos dados é feito pelas rotas server-side, que validam o token e a propriedade
-- da análise antes de usar a chave SUPABASE_SERVICE_ROLE_KEY.

-- Políticas de acesso por usuário. As rotas server-side usam service role e também
-- fazem verificação explícita de propriedade; estas políticas protegem acessos diretos
-- futuros com a chave anon/authenticated.
drop policy if exists candidatos_select_proprio on public.candidatos;
create policy candidatos_select_proprio on public.candidatos
  for select to authenticated using (auth_user_id = auth.uid());
drop policy if exists candidatos_insert_proprio on public.candidatos;
create policy candidatos_insert_proprio on public.candidatos
  for insert to authenticated with check (auth_user_id = auth.uid());
drop policy if exists candidatos_update_proprio on public.candidatos;
create policy candidatos_update_proprio on public.candidatos
  for update to authenticated using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());
drop policy if exists candidatos_delete_proprio on public.candidatos;
create policy candidatos_delete_proprio on public.candidatos
  for delete to authenticated using (auth_user_id = auth.uid());

drop policy if exists analises_acesso_proprio on public.analises;
create policy analises_acesso_proprio on public.analises
  for all to authenticated
  using (exists (
    select 1 from public.candidatos c
    where c.id = public.analises.candidato_id and c.auth_user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.candidatos c
    where c.id = public.analises.candidato_id and c.auth_user_id = auth.uid()
  ));

drop policy if exists perguntas_acesso_proprio on public.perguntas;
create policy perguntas_acesso_proprio on public.perguntas
  for all to authenticated
  using (exists (
    select 1 from public.analises a
    join public.candidatos c on c.id = a.candidato_id
    where a.id = public.perguntas.analise_id and c.auth_user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.analises a
    join public.candidatos c on c.id = a.candidato_id
    where a.id = public.perguntas.analise_id and c.auth_user_id = auth.uid()
  ));

drop policy if exists gerados_acesso_proprio on public.gerados;
create policy gerados_acesso_proprio on public.gerados
  for all to authenticated
  using (exists (
    select 1 from public.analises a
    join public.candidatos c on c.id = a.candidato_id
    where a.id = public.gerados.analise_id and c.auth_user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.analises a
    join public.candidatos c on c.id = a.candidato_id
    where a.id = public.gerados.analise_id and c.auth_user_id = auth.uid()
  ));
