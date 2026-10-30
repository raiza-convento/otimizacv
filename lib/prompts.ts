// @ts-nocheck
/**
 * Prompts.gs
 * Textos dos prompts. Quando mudar um prompt, suba a VERSAO_PROMPT na aba CONFIG
 * (v1 -> v2) para conseguir comparar o resultado das versões.
 *
 * A análise é feita em etapas, como um revisor humano faria:
 *   promptLeitura()                                   -> 1) ler o currículo inteiro e extrair os dados
 *   promptAuditoria(dados, textoRobo, jaApontados, modo) -> 2) auditoria completa, item por item (também na conferência)
 *   promptRevisor(dados, textoRobo, encontrados)      -> 3) segundo revisor: procura o que ficou de fora
 *   promptPerguntas(dados, problemas)                 -> 4) perguntas para o que depende do candidato
 *   promptPerfil(dados, respostas, problemas)         -> reescrita do perfil mestre (Perfil.gs)
 *   curriculoNumerado_(dados)                         -> currículo com uma referência por item ([e1b2] etc.)
 */

function sistemaBase_() {
  const hoje = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  return 'Você é especialista em recrutamento e em sistemas de triagem de currículos (ATS) usados no Brasil, ' +
    'como Gupy, InHire, Vagas, Sólides, Workday e Greenhouse. Seu trabalho é mostrar ao candidato, com clareza ' +
    'e sem jargão, o que no currículo dele pode atrapalhar a leitura automática, o ranqueamento e a leitura do recrutador.\n\n' +
    'DATA DE HOJE: ' + hoje + '. Qualquer data até hoje é válida e já aconteceu. ' +
    'Não aponte datas como "no futuro" a menos que sejam posteriores a ' + hoje + '.\n\n' +
    'REGRAS INVIOLÁVEIS:\n' +
    '1. Nunca invente informação sobre o candidato: cargos, datas, números, ferramentas, resultados ou formação. ' +
    'Se algo útil não está no currículo, transforme em PERGUNTA, nunca em afirmação.\n' +
    '2. Todo problema apontado precisa de evidência real no currículo.\n' +
    '3. Quando a correção precisar de um dado que você não tem, não invente nem use marcadores: deixe a correção vazia ' +
    'e diga que depende do candidato.\n' +
    '4. Escreva em português do Brasil, em linguagem simples, como quem explica para o próprio candidato.\n' +
    '5. Responda SOMENTE com um JSON válido, no formato pedido, sem nenhum texto fora dele.';
}

/* ================= ETAPA 1: LEITURA ================= */

/** Lê o currículo inteiro e devolve os dados estruturados. Nada de avaliar ainda. */
function promptLeitura() {
  const usuario =
    'Você recebe o ARQUIVO ORIGINAL do currículo, anexado.\n' +
    'TAREFA: ler o currículo INTEIRO e extrair os dados, exatamente como estão. Não melhore nem reescreva: copie.\n' +
    '- Datas no formato MM/AAAA; emprego atual com fim "Atual"; data ausente fica "".\n' +
    '- Liste cada cargo separadamente, mesmo que seja na mesma empresa, do mais recente para o mais antigo.\n' +
    '- ATRIBUIÇÃO DAS ATIVIDADES: se no original as atividades aparecem em um bloco único abaixo de vários cargos ' +
    'da mesma empresa, você NÃO sabe a qual cargo cada uma pertence. Distribua da forma mais provável e marque ' +
    '"atribuicao_incerta": true em TODOS os cargos dessa empresa. Use false quando cada cargo tiver as próprias atividades.\n' +
    '- Cada atividade do original aparece em UM ÚNICO cargo. Nunca repita a mesma atividade em dois cargos.\n' +
    '- Não deixe nada de fora: todas as atividades, competências, cursos, formações e idiomas.\n\n' +
    'FORMATO DA RESPOSTA (somente este JSON):\n' +
    JSON.stringify({
      dados_extraidos: {
        nome: '', titulo: '',
        contato: { cidade: '', telefone: '', email: '', linkedin: '' },
        resumo: '',
        competencias: [''],
        experiencias: [{ empresa: '', cargo: '', inicio: 'MM/AAAA', fim: 'MM/AAAA ou Atual', atribuicao_incerta: false, bullets: [''] }],
        formacao: [{ curso: '', instituicao: '', inicio: '', fim: '' }],
        cursos: [{ nome: '', instituicao: '', ano: '' }],
        idiomas: [{ idioma: '', nivel: '' }]
      }
    }, null, 2);
  return { sistema: sistemaBase_(), usuario: usuario };
}

/* ================= ETAPA 2 E 3: AUDITORIA ITEM A ITEM + REVISOR ================= */

/**
 * Currículo numerado: cada item ganha uma referência ([e1b2] = 2ª atividade do 1º cargo),
 * para a IA apontar exatamente onde está cada problema.
 */
function curriculoNumerado_(dados) {
  const linhas = [];
  const junta = function (lista, sep) { return lista.filter(function (x) { return x; }).join(sep); };
  linhas.push('[titulo] ' + (dados.titulo || '(sem título)'));
  linhas.push('[resumo] ' + (dados.resumo || '(sem resumo)'));
  (dados.competencias || []).forEach(function (c, i) { linhas.push('[comp' + (i + 1) + '] ' + c); });
  (dados.experiencias || []).forEach(function (e, i) {
    linhas.push('[e' + (i + 1) + '] ' + junta([e.cargo, e.empresa, junta([e.inicio, e.fim], ' – ')], ' | ') +
      (e.promocao ? ' | Promoção interna' : ''));
    (e.bullets || []).forEach(function (b, j) { linhas.push('  [e' + (i + 1) + 'b' + (j + 1) + '] ' + b); });
  });
  (dados.formacao || []).forEach(function (f, i) {
    linhas.push('[f' + (i + 1) + '] ' + junta([f.curso, f.instituicao, junta([f.inicio, f.fim], ' – ')], ' | '));
  });
  (dados.cursos || []).forEach(function (c, i) { linhas.push('[k' + (i + 1) + '] ' + junta([c.nome, c.instituicao, c.ano], ' | ')); });
  (dados.idiomas || []).forEach(function (c, i) { linhas.push('[i' + (i + 1) + '] ' + junta([c.idioma, c.nivel], ': ')); });
  const c = dados.contato || {};
  linhas.push('[contato] ' + junta([c.cidade, c.telefone, c.email, c.linkedin], ' | '));
  return linhas.join('\n');
}

/** Critérios da auditoria. Os mesmos na análise do original, no revisor e na conferência do currículo novo. */
function criteriosAuditoria_() {
  return 'CRITÉRIOS (avalie TODOS, item por item, na ordem):\n' +
    'A. LEITURA E LAYOUT (compare o arquivo com a VISÃO DO ROBÔ): conteúdo fora de ordem, misturado ou na seção errada; ' +
    'colunas, tabelas, caixas de texto, cabeçalho/rodapé ou imagens que quebram a leitura; texto que some.\n' +
    'B. TÍTULO [titulo]: existe; curto (até 60 caracteres); uma área principal; coerente com as experiências.\n' +
    'C. RESUMO [resumo]: existe; 3 a 5 frases; específico, não genérico; traz as palavras-chave da área; coerente com o título.\n' +
    'D. COMPETÊNCIAS [comp]: seção própria; termos técnicos da área, não só qualidades genéricas ("proativo", "comunicativo"); ' +
    'sem repetição; organizadas.\n' +
    'E. CADA CARGO [e1], [e2]...: cargo, empresa e datas presentes; datas coerentes entre si.\n' +
    'F. CADA ATIVIDADE [e1b1], [e1b2]...: passe por TODAS, uma a uma. Aponte a atividade que: não começa com uma ação clara; ' +
    'é vaga ou genérica ("responsável por", "auxílio em diversas atividades", "suporte geral"); é longa demais ou junta ' +
    'várias ideias; repete outra atividade; tem erro de português.\n' +
    'G. FORMAÇÃO [f]: curso, instituição e datas (ou "cursando, conclusão prevista em...").\n' +
    'H. CURSOS [k]: nome e instituição.\n' +
    'I. IDIOMAS [i]: nível claro (básico, intermediário, avançado, fluente).\n' +
    'J. GERAL: erros de português e digitação em qualquer parte; dados pessoais desnecessários (CPF, RG, estado civil, ' +
    'idade, foto, endereço completo); informação irrelevante para a vaga; LinkedIn ausente em [contato].\n\n' +
    'O SISTEMA JÁ CONFERE SOZINHO, NÃO APONTE: falta de números ou resultados; siglas sem nome por extenso; cursos antigos; ' +
    'vários cargos na mesma empresa, promoções e a qual cargo pertence cada atividade; e-mail e telefone; tamanho e número de páginas.\n' +
    'FORMATOS CORRETOS, NUNCA SÃO PROBLEMA: marcadores de lista (●, •, ▪, -); cargos seguidos na mesma empresa, cada um com ' +
    'sua própria linha "Empresa | MM/AAAA – MM/AAAA" (com ou sem "Promoção interna"); títulos de seção padrão ' +
    '(Resumo Profissional, Competências, Experiência Profissional, Formação Acadêmica, Cursos, Idiomas); datas MM/AAAA.\n' +
    'NÃO SÃO PROBLEMA: características reais do candidato (nível de idioma, formação, tempo de experiência, ferramentas que ' +
    'ele não domina). Isso não se corrige no texto e o candidato não pode inventar o que não tem.\n';
}

function regrasDeResposta_() {
  return 'COMO RESPONDER:\n' +
    '- Agrupe no MESMO ponto as ocorrências do mesmo problema (ex.: 5 atividades vagas = 1 ponto com 5 ocorrências). ' +
    'Não há limite de pontos nem de ocorrências: o objetivo é não deixar nada de fora.\n' +
    '- Em cada ocorrência, "ref" é a referência do item no CURRÍCULO NUMERADO (ex.: "e1b2", "resumo", "titulo", "comp3", ' +
    '"f1", "k2", "i1", "contato"). Para problema de leitura ou layout, use "ref": "robo" e copie em "trecho" um pedaço ' +
    'EXATO da VISÃO DO ROBÔ (até 200 caracteres).\n' +
    '- "correcao": como o item deveria ficar, pronto para usar, só com fatos que já estão no currículo. ' +
    'Se a correção depende de uma informação que só o candidato tem, deixe "" e use "resolucao": "candidato". ' +
    'Nunca use marcadores como [PREENCHER] ou [X].\n' +
    '- Gravidade: "critico" = o robô lê errado ou não encontra a informação; "importante" = prejudica o ranqueamento ' +
    'ou a estrutura; "recrutador" = não atrapalha o robô, mas enfraquece o currículo para quem lê.\n' +
    '- "resolucao": "automatica" quando o sistema resolve reescrevendo ou reorganizando o que já está no currículo; ' +
    '"candidato" quando depende de uma informação que só o candidato tem (datas faltando, foco profissional, detalhe de uma atividade vaga).\n' +
    '- Textos curtos e diretos, em linguagem simples.\n\n' +
    'FORMATO DA RESPOSTA (somente este JSON):\n' +
    JSON.stringify({
      problemas: [{
        gravidade: 'critico | importante | recrutador',
        categoria: 'layout | estrutura | palavras-chave | conteudo | datas | contato | escrita',
        resolucao: 'automatica | candidato',
        titulo: 'frase curta do problema',
        onde: 'seção ou cargo',
        por_que: 'impacto no ATS ou no recrutador, em 1 ou 2 frases',
        como_corrigir: 'ação concreta, em 1 frase',
        ocorrencias: [{ ref: 'e1b2', trecho: 'texto do item', correcao: 'como deveria ficar, ou ""' }]
      }]
    }, null, 2);
}

/**
 * Auditoria completa. modo 'original' = currículo enviado; 'novo' = currículo gerado aqui (conferência).
 * jaApontados: problemas que o sistema já encontrou (regras do código), para a IA não repetir.
 */
function promptAuditoria(dados, textoRobo, jaApontados, modo) {
  const lista = (jaApontados || []).map(function (p) { return '- ' + p.titulo; }).join('\n') || '- (nenhum)';
  const novo = modo === 'novo';
  if (modo === 'perfil') {
    // currículo recém-reescrito, ainda sem arquivo: avalia só o conteúdo
    return { sistema: sistemaBase_(), usuario:
      'Você recebe o CURRÍCULO NUMERADO de um candidato, já reescrito pelo sistema. Não há arquivo nem visão do robô ' +
      'nesta etapa: avalie só o CONTEÚDO (critérios B a J; ignore o critério A, de leitura e layout).\n\n' +
      '===== CURRÍCULO NUMERADO =====\n' + curriculoNumerado_(dados) + '\n===== FIM =====\n\n' +
      'TAREFA: leia o currículo inteiro e faça a auditoria COMPLETA, item por item. Esta é a última revisão antes de o ' +
      'candidato ver o currículo: tudo o que você apontar com "correcao" será aplicado automaticamente no texto. Por isso:\n' +
      '- a "correcao" precisa ser o texto final do item inteiro, pronto para substituir o original, só com fatos que já estão no currículo;\n' +
      '- em [compN], a "correcao" mantém o formato "Grupo: item, item, item";\n' +
      '- aponte só o que um recrutador experiente consideraria um problema real, não preferências de estilo.\n' +
      'Para o que depende de uma informação do candidato, use "resolucao": "candidato" e deixe "correcao" vazia.\n\n' +
      criteriosAuditoria_() + '\n' + regrasDeResposta_() };
  }
  const usuario =
    'Você recebe:\n' +
    '(A) o ARQUIVO do currículo, anexado (como uma pessoa enxerga);\n' +
    '(B) a VISÃO DO ROBÔ: o texto extraído por uma leitura parecida com a de um ATS;\n' +
    '(C) o CURRÍCULO NUMERADO: os mesmos dados, com uma referência para cada item;\n' +
    '(D) problemas que o sistema JÁ encontrou sozinho. Não repita.\n\n' +
    '===== (B) VISÃO DO ROBÔ =====\n' + textoRobo + '\n===== FIM =====\n\n' +
    '===== (C) CURRÍCULO NUMERADO =====\n' + curriculoNumerado_(dados) + '\n===== FIM =====\n\n' +
    '===== (D) JÁ ENCONTRADOS (não repetir) =====\n' + lista + '\n\n' +
    'TAREFA: primeiro leia o currículo INTEIRO e entenda a trajetória (área, nível, foco). Depois faça uma auditoria ' +
    'COMPLETA, item por item, seguindo os critérios abaixo. Duas análises do mesmo currículo precisam chegar ao mesmo resultado: ' +
    'por isso, passe por todos os critérios e por todos os itens, sem pular nenhum.\n' +
    (novo
      ? 'ATENÇÃO: este currículo já foi reescrito e revisado. Aponte só o que um recrutador experiente consideraria um ' +
        'problema real. Não aponte preferências de estilo nem reescritas que só trocam palavras.\n'
      : '') + '\n' +
    criteriosAuditoria_() + '\n' + regrasDeResposta_();
  return { sistema: sistemaBase_(), usuario: usuario };
}

/** Segundo revisor: recebe o que já foi encontrado e procura o que ficou de fora. */
function promptRevisor(dados, textoRobo, encontrados) {
  const lista = (encontrados || []).map(function (p) {
    const refs = (p.ocorrencias || []).map(function (o) { return o.ref; }).filter(function (x) { return x; });
    return '- ' + p.titulo + (refs.length ? ' [' + refs.join(', ') + ']' : '');
  }).join('\n') || '- (nenhum)';
  const usuario =
    'Outro especialista já auditou este currículo e encontrou os pontos da lista (D). Você é o segundo revisor.\n' +
    'TAREFA: revisar o currículo INTEIRO de novo, item por item, com os MESMOS critérios, e encontrar SOMENTE o que ficou ' +
    'de fora. Não repita um problema que já está na lista para o mesmo item. Se nada ficou de fora, devolva {"problemas": []}.\n' +
    'Confira com atenção especial: cada atividade de cada cargo, erros de português, resumo, competências, formação, cursos e idiomas.\n' +
    'O arquivo não vem anexado nesta etapa: trabalhe com a VISÃO DO ROBÔ e o CURRÍCULO NUMERADO. Problemas de layout ' +
    '(colunas, caixas, imagens) já foram avaliados na primeira auditoria.\n\n' +
    '===== (B) VISÃO DO ROBÔ =====\n' + textoRobo + '\n===== FIM =====\n\n' +
    '===== (C) CURRÍCULO NUMERADO =====\n' + curriculoNumerado_(dados) + '\n===== FIM =====\n\n' +
    '===== (D) JÁ ENCONTRADOS =====\n' + lista + '\n\n' +
    criteriosAuditoria_() + '\n' + regrasDeResposta_();
  return { sistema: sistemaBase_(), usuario: usuario };
}

/* ================= ETAPA 4: PERGUNTAS ================= */

/** Perguntas para os problemas que dependem do candidato (as do sistema são criadas pelo código). */
function promptPerguntas(dados, problemas) {
  const lista = (problemas || []).map(function (p) {
    return '- id "' + p.id + '" | ' + p.gravidade + ' | ' + p.titulo + (p.como_corrigir ? ' — ' + p.como_corrigir : '');
  }).join('\n') || '- (nenhum)';
  const usuario =
    '===== CURRÍCULO NUMERADO =====\n' + curriculoNumerado_(dados) + '\n===== FIM =====\n\n' +
    '===== PROBLEMAS QUE DEPENDEM DO CANDIDATO =====\n' + lista + '\n\n' +
    'TAREFA: crie no máximo 6 perguntas curtas que permitam resolver esses problemas. Um problema pode ficar sem pergunta ' +
    'quando não fizer sentido perguntar (o candidato decide sobre ele em outra etapa).\n' +
    'NÃO pergunte sobre: números ou resultados das experiências, promoções, a qual cargo pertence cada atividade, ' +
    'cursos antigos, e-mail ou telefone. O sistema já faz essas perguntas.\n' +
    'Cada pergunta deve ser respondível em poucos segundos; o candidato pode responder com as próprias palavras.\n' +
    'Para cada pergunta:\n' +
    '- "resolve": ids dos problemas da lista que a resposta resolve;\n' +
    '- "ideal": 1 ou 2 frases sobre o que seria uma resposta forte, com um exemplo de FORMATO entre aspas, ' +
    'sem afirmar nada sobre o candidato.\n' +
    'Tipos: "sim_nao", "numero", "texto" ou "escolha" (com "opcoes").\n' +
    'Se nenhum problema precisar de pergunta, devolva {"perguntas": []}.\n\n' +
    'FORMATO DA RESPOSTA (somente este JSON):\n' +
    JSON.stringify({
      perguntas: [{
        pergunta: '', motivo: 'por que essa resposta melhora o currículo', tipo: 'sim_nao | numero | texto | escolha',
        opcoes: [], resolve: ['id do problema'], ideal: 'o que seria uma resposta forte, com exemplo de formato'
      }]
    }, null, 2);
  return { sistema: sistemaBase_(), usuario: usuario };
}

/* ================= PERFIL MESTRE ================= */

function promptPerfil(dados, perguntasRespondidas, problemas) {
  // cada problema com os itens onde aparece e a correção sugerida: a reescrita precisa aplicar todos
  const listaProblemas = (problemas || [])
    .filter(function (p) { return p.origem !== 'regra' || p.resolucao === 'automatica'; })
    .map(function (p) {
      const ocs = (p.ocorrencias || []).filter(function (o) { return o.ref || o.correcao; }).map(function (o) {
        return '    · ' + (o.ref ? '[' + o.ref + '] ' : '') + (o.correcao ? 'deve ficar: "' + o.correcao + '"' : '(ajustar)');
      });
      return '- ' + p.titulo + (p.como_corrigir ? ' — ' + p.como_corrigir : '') + (ocs.length ? '\n' + ocs.join('\n') : '');
    })
    .join('\n') || '- (nenhum)';
  const listaRespostas = (perguntasRespondidas || [])
    .map(function (q) {
      return '- ' + q.pergunta + (q.trecho ? '\n  TRECHO ATUAL: "' + q.trecho + '"' : '') + '\n  RESPOSTA: ' + q.resposta;
    })
    .join('\n') || '- (nenhuma)';

  const usuario =
    'Você recebe os DADOS do currículo (já extraídos e conferidos pelo candidato), as RESPOSTAS dele às ' +
    'perguntas de confirmação e aos itens de revisão, e os PROBLEMAS apontados no diagnóstico.\n' +
    'TAREFA: reescrever o conteúdo no formato ideal para ATS e recrutadores, sem inventar nada.\n\n' +

    'REGRAS:\n' +
    '1. Não crie nem remova experiências. Devolva as experiências na MESMA ORDEM e quantidade dos DADOS, ' +
    'com empresa e cargo exatamente iguais.\n' +
    '2. Reescreva cada bullet de forma clara e objetiva, começando com substantivo de ação ' +
    '(ex.: "Gestão de...", "Condução de...", "Criação de..."), sem acrescentar fatos, ferramentas ou resultados.\n' +
    '3. Números e resultados só podem vir dos DADOS ou das RESPOSTAS. Ao incorporar uma resposta em um bullet, ' +
    'marque esse bullet com "origem": "confirmado"; os demais ficam "curriculo".\n' +
    '4. Respostas "(pulou)": NÃO use marcadores no texto; mantenha sem a informação e adicione uma pendência. ' +
    'Respostas "(manter como está)": o candidato conferiu e decidiu não mudar; NÃO crie pendência para esse ponto.\n' +
    '5. Siglas: escreva por extenso na primeira vez que aparecem (ex.: "Net Promoter Score (NPS)").\n' +
    '5b. Nunca deixe marcadores como [PREENCHER], [X] ou colchetes no texto. Sem a informação, escreva sem ela.\n' +
    '6. Título: se houver resposta sobre foco ou cargo-alvo, use-a como base. Título curto (até 60 caracteres), ' +
    'com uma área principal. Sem resposta, use a área predominante nas experiências mais recentes.\n' +
    '7. Resumo: 3 a 5 frases, sem "eu", focado no título e com as principais palavras-chave, só com fatos dos DADOS e RESPOSTAS.\n' +
    '8. Competências: 4 a 6 grupos com nome curto e itens curtos, apenas com o que aparece nos DADOS.\n' +
    '9. Não mencione nada que não esteja nos DADOS ou RESPOSTAS (certificações, idiomas, ferramentas, setores).\n' +
    '10. Corrija os problemas de conteúdo apontados (siglas, título disperso, falta de clareza). ' +
    'Problemas de layout serão resolvidos pelo modelo de currículo, não por você.\n' +
    '11. As RESPOSTAS podem estar escritas de forma informal, curta ou com erros. Reescreva com clareza, ' +
    'no tom profissional que o recrutador espera, mantendo exatamente os fatos e números informados.\n' +
    '12. Respostas que começam com "AJUSTE PEDIDO" são instruções do candidato sobre o TRECHO ATUAL ' +
    '(ex.: remover um curso, atualizar um ano, trocar um texto). Aplique o ajuste exatamente onde ele pede.\n' +
    '13. Formação, cursos e idiomas: devolva IGUAIS aos DADOS, mudando só o que um AJUSTE PEDIDO mandar.\n' +
    '14. Pendências: cada uma diz onde ajustar ("secao": titulo, resumo, competencias, experiencia, formacao, ' +
    'cursos, idiomas ou contato; em experiencia, "experiencia" é a posição na lista começando em 0 e "bullet" ' +
    'a posição do bullet, ou null), o que falta em "texto" (curto) e um exemplo do formato ideal em "ideal", ' +
    'sem afirmar fatos sobre o candidato (ex.: "Reduzi o tempo de resposta em X% em 6 meses").\n' +
    '15. Experiências com "promocao": true foram promoções confirmadas pelo candidato. Não repita atividades entre ' +
    'esses cargos: cada um fica com o que era daquele nível. O resumo pode citar a evolução de carreira na empresa.\n\n' +

    '16. Aplique TODAS as correções da lista de PROBLEMAS, no item indicado pela referência ' +
    '([e1b2] = 2ª atividade do 1º cargo, [resumo], [titulo] etc.). Use a sugestão "deve ficar" como base, ' +
    'ajustando só o necessário para combinar com as RESPOSTAS. Não deixe nenhum problema da lista sem correção, ' +
    'a não ser que dependa de uma informação que o candidato não deu.\n\n' +
    '===== CURRÍCULO NUMERADO (referências) =====\n' + curriculoNumerado_(dados) + '\n\n' +
    '===== DADOS =====\n' + JSON.stringify(dados, null, 2) + '\n\n' +
    '===== RESPOSTAS DO CANDIDATO =====\n' + listaRespostas + '\n\n' +
    '===== PROBLEMAS APONTADOS (corrigir todos) =====\n' + listaProblemas + '\n\n' +

    'FORMATO DA RESPOSTA (somente este JSON):\n' +
    JSON.stringify({
      titulo: '',
      resumo: '',
      competencias: [{ grupo: '', itens: [''] }],
      experiencias: [{ empresa: '', cargo: '', bullets: [{ texto: '', origem: 'curriculo | confirmado' }] }],
      formacao: [{ curso: '', instituicao: '', inicio: '', fim: '' }],
      cursos: [{ nome: '', instituicao: '', ano: '' }],
      idiomas: [{ idioma: '', nivel: '' }],
      pendencias: [{ secao: 'experiencia', experiencia: 0, bullet: 1, texto: '', ideal: '' }]
    }, null, 2);

  return { sistema: sistemaBase_(), usuario: usuario };
}
export { sistemaBase_, promptLeitura, curriculoNumerado_, criteriosAuditoria_, regrasDeResposta_, promptAuditoria, promptRevisor, promptPerguntas, promptPerfil };
