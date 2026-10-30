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
-- Privacidade: acesso público bloqueado por padrão; backend usa service role. Criar políticas específicas ao implantar autenticação.
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
