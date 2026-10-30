# OtimizaCV — migração Next.js + Supabase

## O que esta versão entrega

- Upload de PDF e DOCX com limite de 10 MB, aceite LGPD e armazenamento privado.
- Extração com Gemini e fallback Anthropic (`AI_MODEL_ANTHROPIC`, padrão `claude-haiku-4-5-20251001`).
- Auditoria do PDF original com anexo visual para Gemini/Anthropic nas etapas de diagnóstico e segundo revisor.
- Checagens determinísticas do `Checagens.gs`.
- Regras de conteúdo portadas de `Conteudo.gs`: experiências sem métricas, siglas sem expansão e cursos com 10 anos ou mais.
- Perguntas automáticas para métricas, contato, promoções e distribuição de atividades entre cargos; perguntas adicionais da IA e itens de revisão.
- Normalização das respostas, aplicação de distribuição/promoções/contato ao perfil e preservação da origem dos bullets.
- Perfil mestre consolidado com empresa, cargo e datas bloqueados aos dados extraídos; trava contra números sem origem e marcadores `[PREENCHER]`.
- Expansão determinística de siglas conhecidas e histórico de versões do perfil em `analises.perfil_versoes`.
- Auditoria do perfil com aplicação das correções automáticas suportadas e geração de pendências para o candidato.
- Editor estruturado do perfil mestre (dados pessoais, resumo, experiências, bullets, competências, formação, cursos e idiomas), sem exigir edição manual de JSON.
- Geração de PDF e DOCX nos dois estilos com parâmetros visuais portados de `MODELOS_CV` e da montagem de `Gerador.gs`; fontes PDF usam Helvetica como substituta métrica por não haver fontes Arial/Roboto embutidas no projeto.
- Log de uso de IA e persistência no Supabase.
- Diagnóstico inicial exibido antes do segundo revisor e da preparação de perguntas, que continuam em segundo plano na interface.
- O segundo revisor usa a visão textual e o diagnóstico já produzido, sem baixar e reenviar o PDF; o anexo visual fica restrito à auditoria inicial, conforme o próprio prompt do revisor.
- Tentativas de IA com orçamento total de tempo limitado por etapa, evitando esperar em sequência por todos os modelos.

## O que ainda NÃO é paridade 100%

Esta entrega ainda não deve ser tratada como produto final ou publicada para usuários reais. Ainda faltam, entre outros pontos:

- Reproduzir fielmente a interface original: visualização alternável do PDF e visão do robô, marcações clicáveis, folha de revisão do perfil em campos próprios e comparativo antes/depois.
- Migrar todas as regras e rotinas auxiliares de `Diagnostico.gs`, `Perguntas.gs`, `Perfil.gs`, `Conteudo.gs` e `Gerador.gs`, incluindo casos de borda e validações completas.
- Validar visualmente os dois modelos de documento contra os arquivos gerados pelo Apps Script. Os parâmetros e a hierarquia foram portados, mas a substituição de fontes e diferenças de paginação ainda impedem afirmar equivalência pixel a pixel.
- Conferência final com releitura do PDF efetivamente gerado e comparação com a visão do robô, incluindo contagem de páginas e linhas grudadas.
- Autenticação, autorização por proprietário, políticas RLS por usuário e proteção contra acesso cruzado. As rotas atuais usam service role no servidor e não possuem autenticação pública.
- Política automatizada de retenção/exclusão de arquivos e dados pessoais.
- Testes integrados com currículos anonimizados, releitura de PDFs gerados e validação de build em ambiente com dependências instaladas.

## Configuração local

1. Copie `.env.example` para `.env.local`.
2. Você pode manter as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` que já possui. O backend reconhece `VITE_SUPABASE_URL`; a chave anon não é usada nas rotas administrativas atuais. A convenção recomendada no Next.js é `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Mantenha `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_PASSWORD`, `GEMINI_API_KEY` e `ANTHROPIC_API_KEY` somente no ambiente local/servidor. Nunca use prefixo `NEXT_PUBLIC_` nessas chaves.
4. No Supabase, abra SQL Editor e execute `supabase/schema.sql`. O script inclui a coluna `perfil_versoes`; pode ser executado novamente para aplicar a alteração incremental.
5. Confirme que o bucket privado `curriculos` foi criado.
6. Rode `npm install` e `npm run dev`.

## Variáveis relevantes

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_PROJECT_REF=
SUPABASE_DB_PASSWORD=
GEMINI_API_KEY=
GEMINI_MODEL=
GEMINI_MODELS=
ANTHROPIC_API_KEY=
AI_MODEL_ANTHROPIC=claude-haiku-4-5-20251001
```

## Segurança

- `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_PASSWORD`, `GEMINI_API_KEY` e `ANTHROPIC_API_KEY` nunca podem chegar ao navegador.
- Não publique antes de implementar autenticação e políticas RLS que restrinjam os registros por proprietário.
- O bucket `curriculos` é privado; os arquivos são servidos por URLs temporárias.
- A retenção de 30 dias ainda não está automatizada.

## Estrutura

- `app/api/analisar`: upload, extração e persistência inicial.
- `app/api/etapa`: checagens, diagnóstico, revisor, perguntas, respostas, perfil, auditoria e conferência.
- `app/api/gerar`: geração dos dois formatos, armazenamento privado e links temporários.
- `app/components/ProfileEditor.tsx`: editor estruturado do perfil mestre.
- `lib/checagens.ts`: regras de `Checagens.gs`.
- `lib/conteudo.ts`: regras de `Conteudo.gs` e perguntas automáticas de sistema.
- `lib/perfil.ts`: regras centrais de `Perfil.gs` e `Perguntas.gs`.
- `lib/ai.ts`: Gemini, fallback Anthropic e auditoria com PDF anexado.
- `supabase/schema.sql`: tabelas, bucket privado e histórico de versões.
- `docs/PLANO_PARIDADE.md`: inventário do que falta para a paridade integral.
