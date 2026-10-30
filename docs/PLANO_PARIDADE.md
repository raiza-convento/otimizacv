# Plano de paridade com o Apps Script original

A migração só será considerada concluída quando todos os itens abaixo estiverem implementados e testados de ponta a ponta.

| Módulo original | Situação desta entrega |
|---|---|
| Upload e leitura | Parcial: PDF/DOCX e extração Gemini/Anthropic; faltam casos de borda e fidelidade total da extração |
| Checagens.gs | Regras principais portadas; falta suíte completa de regressão |
| Conteudo.gs | Regras de métricas, siglas, cursos antigos e perguntas automáticas portadas; expansão de siglas cobre a lista conhecida original |
| Diagnostico.gs | Fluxo de diagnóstico/revisor e PDF original anexado no diagnóstico; faltam normalização e regras auxiliares completas |
| Perguntas.gs | Perguntas automáticas, IA, revisão, respostas e distribuição portadas; falta validar todos os tipos e estados com casos reais |
| Perfil.gs | Consolidação com cargo/empresa/datas preservados, distribuição, contato, promoção, pendências e trava numérica; falta paridade completa da tela e de todas as auxiliares |
| Auditoria do perfil | Aplica correções automáticas de título, resumo, competências e bullets; ainda falta cobrir todas as referências e cenários do original |
| Gerador.gs | PDF/DOCX com parâmetros dos dois modelos originais, hierarquia de seções, promoções, margens e espaçamentos portados; falta comparação visual e releitura do PDF gerado para validar paginação/linhas grudadas |
| Interface original | Identidade visual e CSS-base copiados; editor de perfil agora usa campos estruturados em vez de JSON; ainda faltam visualização alternável do PDF, marcações clicáveis, painel de prontidão e comparativo antes/depois |
| Supabase | Persistência básica, bucket privado, custos e versões; falta autenticação, RLS por proprietário e política de retenção |

## Interface original a reproduzir

O `Index.html`, `App.html` e `Estilos.html` definem telas de envio, diagnóstico com texto do robô e marcações, perguntas/revisão, perfil mestre editável, conferência comparativa e download. A identidade usa fundo `#EDF0F3`, papel branco, tinta `#172033`, azul `#2440C9`, cantos de 6px e fontes Bricolage Grotesque, Atkinson Hyperlegible e IBM Plex Mono. A tela atual ainda não é uma cópia visual fiel.

## Incremento desta versão

- Editor de perfil estruturado com edição de dados pessoais, título, resumo, contato, experiências, bullets, competências, formação, cursos, idiomas e visualização das pendências.
- Templates PDF/DOCX reestruturados a partir dos parâmetros `MODELOS_CV` do `Gerador.gs`: fonte nominal, tamanhos, margens, cores, caixa alta no Clássico, títulos azuis no Moderno, linha divisória no Clássico, promoções internas e espaçamentos por bloco.
- PDFKit utiliza Helvetica como substituta de métricas próximas para Arial/Roboto; portanto, ainda não é reprodução tipográfica exata.

## Critério de aceite

Cada etapa precisa de testes com currículos anonimizados e casos-limite. A paridade visual deve ser comparada lado a lado com o Apps Script em desktop e mobile. Não anunciar como 100% migrado antes de passar esses testes.
