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
- Login com Supabase Auth, verificação de propriedade nas APIs e políticas RLS por proprietário estão implementados. É obrigatório executar o SQL atualizado e configurar as chaves públicas/privadas antes de habilitar o login.
- Política automatizada de retenção/exclusão de arquivos e dados pessoais.
- Testes integrados com currículos anonimizados, releitura de PDFs gerados e validação de build em ambiente com dependências instaladas.

## Configuração local

1. Copie `.env.example` para `.env.local` e preencha `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`.
2. Habilite o provedor Email no Supabase Auth e configure Site URL/Redirect URLs.
3. Em Authentication → Sign In / Providers → Email, desative Confirm email para permitir cadastro sem envio de e-mail. Execute `supabase/schema.sql` no SQL Editor. O script adiciona `perfil_versoes`, `auth_user_id` e políticas RLS.
4. Confirme que o bucket privado `curriculos` foi criado.
5. Rode `npm ci` e `npm run dev`.
6. Para habilitar compras, configure links reais de checkout nas variáveis `NEXT_PUBLIC_CHECKOUT_*`. O checkout não é processado pela aplicação nesta versão.

## Variáveis relevantes

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
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

- Cadastro/login usam Supabase Auth; Confirm email deve permanecer desativado. Recuperação automática de senha por e-mail não está habilitada nesta versão.
- As rotas `/api/analisar`, `/api/etapa` e `/api/gerar` exigem access token válido e verificam a propriedade da análise.
- As tabelas possuem RLS e o schema atualizado cria políticas de proprietário para candidatos, análises, perguntas e arquivos gerados.
- `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_PASSWORD`, `GEMINI_API_KEY` e `ANTHROPIC_API_KEY` nunca podem chegar ao navegador.
- O bucket `curriculos` é privado; os arquivos são servidos por URLs temporárias.
- Registros anteriores à coluna `auth_user_id` não são atribuídos automaticamente a contas. É necessária associação manual segura.
- A retenção de 30 dias ainda não está automatizada; o checkout depende de um gateway externo e ainda não há webhook ou controle de compra.

## Estrutura

- `app/api/analisar`: upload, extração e persistência inicial.
- `app/api/etapa`: checagens, diagnóstico, revisor, perguntas, respostas, perfil, auditoria e conferência.
- `app/api/gerar`: geração dos dois formatos, armazenamento privado e links temporários.
- `app/components/ProfileEditor.tsx`: editor estruturado do perfil mestre.
- `app/produtos/otimiza-cv/usar`: ferramenta de análise de currículo preservada.
- `components/AuthProvider.tsx`: estado global da sessão Supabase Auth.
- `components/PortalHeader.tsx` e `components/ProductDetail.tsx`: menu superior e páginas de produto.
- `docs/CONFIGURAR-LOGIN-E-CHECKOUT.md`: setup de Auth, banco, redirect URLs e links comerciais.
- `lib/checagens.ts`: regras de `Checagens.gs`.
- `lib/conteudo.ts`: regras de `Conteudo.gs` e perguntas automáticas de sistema.
- `lib/perfil.ts`: regras centrais de `Perfil.gs` e `Perguntas.gs`.
- `lib/ai.ts`: Gemini, fallback Anthropic e auditoria com PDF anexado.
- `supabase/schema.sql`: tabelas, bucket privado e histórico de versões.
- `docs/PLANO_PARIDADE.md`: inventário do que falta para a paridade integral.

## PDFKit na Vercel

A configuração do Next.js externaliza `pdfkit` via `serverExternalPackages` para manter os arquivos AFM do pacote disponíveis em tempo de execução. A rota `/api/gerar` precisa executar no runtime Node.js (não Edge).


## Portal, login e produtos

A aplicação inclui cadastro/login por e-mail e senha via Supabase Auth, central de produtos e páginas de apresentação para Otimiza CV, Análise LinkedIn e Comparativo Vaga x CV. A ferramenta atual de currículo está em `/produtos/otimiza-cv/usar`.

Antes de publicar, execute as instruções de `docs/CONFIGURAR-LOGIN-E-CHECKOUT.md` e aplique o `supabase/schema.sql` atualizado. As APIs exigem token Supabase e verificam se a análise pertence ao usuário autenticado. O checkout não processa pagamentos nesta etapa: os botões só são habilitados quando as URLs reais dos gateways forem configuradas pelas variáveis `NEXT_PUBLIC_CHECKOUT_*`.


Para configurar login e checkout, siga `docs/CONFIGURAR-LOGIN-E-CHECKOUT.md`.
