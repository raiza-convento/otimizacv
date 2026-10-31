# Login, Supabase Auth e checkout — OtimizaCV

## 1. Variáveis de ambiente

Configure localmente no `.env.local` e na Vercel:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Opcionais: links HTTPS fornecidos pelo gateway de pagamento.
NEXT_PUBLIC_CHECKOUT_OTIMIZA_CV_URL=
NEXT_PUBLIC_CHECKOUT_ANALISE_LINKEDIN_URL=
NEXT_PUBLIC_CHECKOUT_COMPARATIVO_VAGA_CV_URL=
```

`SUPABASE_SERVICE_ROLE_KEY` permanece somente no servidor. Nunca use o prefixo `NEXT_PUBLIC_` nessa chave.

## 2. Ativar login por e-mail e senha

No painel do Supabase:

1. Abra **Authentication → Providers → Email** e habilite e-mail/senha.
2. Em **Authentication → Sign In / Providers → Email**, desative **Confirm email**. Assim, o cadastro cria a conta e devolve uma sessão imediatamente, sem enviar mensagem.
3. Não é necessário configurar SMTP, domínio de e-mail ou outra plataforma para o fluxo atual de cadastro/login. Em **Authentication → URL Configuration**, defina a URL do site como a URL local durante o desenvolvimento e como a URL da Vercel em produção; Redirect URLs só serão necessárias quando voltarmos a usar links enviados por e-mail.
4. Copie a Project URL e a chave pública/anon para as variáveis `NEXT_PUBLIC_*`.

O fluxo atual não envia e-mails. A confirmação por e-mail deve ficar desativada. A recuperação automática de senha foi retirada temporariamente; o usuário deverá guardar sua senha.

## 3. Atualizar o banco

Abra **SQL Editor** no Supabase e execute o `supabase/schema.sql` atualizado. A alteração adiciona `candidatos.auth_user_id`, vinculando novos registros a um usuário autenticado.

Os dados antigos não são vinculados automaticamente a contas novas. Registros legados com `auth_user_id` vazio não podem ser acessados pelo novo fluxo até que sejam associados manualmente ao usuário correto.

As tabelas mantêm RLS habilitado e sem acesso direto do navegador. As rotas de servidor validam o token Supabase e verificam a propriedade da análise antes de acessar os dados com a chave administrativa.

## 4. Checkout

As páginas de produto já aceitam links externos de checkout. Quando o gateway for escolhido, crie um link HTTPS para cada produto e preencha a variável correspondente na Vercel. Sem link configurado, o CTA permanece desabilitado e informa que o checkout ainda não está disponível.

Esta entrega não implementa cobrança, webhook, confirmação de pagamento ou controle de entitlement. Não configure uma URL de página comum como checkout: use somente um link de pagamento real, gerado pelo gateway escolhido.

## 5. Rotas

- `/login`: entrar e criar conta.
- Recuperação automática de senha por e-mail: desativada nesta versão.
- `/`: central de produtos após login.
- `/produtos/otimiza-cv`: detalhes do Otimiza CV.
- `/produtos/otimiza-cv/usar`: ferramenta atual de análise de currículo.
- `/produtos/analise-linkedin`: detalhes do produto em desenvolvimento.
- `/produtos/comparativo-vaga-cv`: detalhes do produto em desenvolvimento.

## 6. Teste mínimo antes de publicar

1. Criar duas contas diferentes.
2. Entrar com cada uma e conferir que `/` e as páginas de produto exigem sessão.
3. Fazer upload de um currículo em cada conta.
4. Tentar chamar `/api/etapa` e `/api/gerar` usando o ID de análise da outra conta; deve retornar 404.
5. Testar recuperação de senha e logout.
6. Confirmar que a chave service role não aparece no JavaScript enviado ao navegador.
