/**
 * Port das regras centrais de Perfil.gs e Perguntas.gs do Apps Script.
 * Mantém cargo, empresa e datas vindos da extração; a IA só pode reescrever conteúdo.
 */
export const SEM_ALTERACAO = 'SEM_ALTERACAO';
type Obj = Record<string, any>;

export function textoResposta(q: Obj, r: any): string {
  if (q.tipo === 'revisao') {
    if (r?.acao === 'manter') return '(manter como está)';
    if (r?.acao === 'ajustar' && r.texto) return 'AJUSTE PEDIDO: ' + r.texto;
    return '(pulou)';
  }
  if (r === SEM_ALTERACAO) return '(manter como está)';
  return r ? String(r) : '(pulou)';
}

export function todasPerguntas(d: Obj): Obj[] {
  const perguntas = Array.isArray(d.perguntas) ? d.perguntas : [];
  const ligadas = new Set<string>();
  perguntas.forEach((q: Obj) => (q.resolve || []).forEach((id: string) => ligadas.add(id)));
  const revisoes = (d.problemas || [])
    .filter((p: Obj) => resolucaoPadrao(p) === 'candidato' && !ligadas.has(p.id))
    .map((p: Obj) => {
      const o = (p.ocorrencias || [])[0] || {};
      return {
        id: 'rev-' + p.id, tipo: 'revisao', pergunta: p.titulo, motivo: p.por_que || '',
        ideal: p.como_corrigir || '', trecho: p.trecho_revisao || o.trecho || '',
        sugestao: /\[(PREENCHER|CONFIRMAR)/i.test(o.correcao || '') ? '' : (o.correcao || ''),
        gravidade: p.gravidade, resolve: [p.id]
      };
    });
  return [...perguntas, ...revisoes];
}

export function resolucaoPadrao(p: Obj): 'automatica' | 'candidato' {
  if (p.resolucao === 'automatica' || p.resolucao === 'candidato') return p.resolucao;
  if (p.origem === 'regra') return p.categoria === 'leitura' || /^Contato não encontrado/.test(p.titulo || '') ? 'candidato' : 'automatica';
  return ['layout', 'estrutura', 'datas', 'palavras-chave'].includes(p.categoria) ? 'automatica' : 'candidato';
}

export function situacaoResposta(q: Obj, r: any): '' | 'respondida' | 'mantida' {
  if (q.tipo === 'distribuicao') return r?.confirmado === true || Array.isArray(r) ? 'respondida' : '';
  if (q.tipo === 'revisao') {
    if (!r) return '';
    if (r.acao === 'manter') return 'mantida';
    const txt = String(r.texto || '').trim();
    return r.acao === 'ajustar' && txt && !/\[(PREENCHER|CONFIRMAR)/i.test(txt) ? 'respondida' : '';
  }
  if (r === SEM_ALTERACAO) return 'mantida';
  return typeof r === 'string' && r.trim() ? 'respondida' : '';
}

export function statusPontos(d: Obj): Obj[] {
  const respostas = d.respostas || {};
  const perguntas = todasPerguntas(d);
  return (d.problemas || []).map((p: Obj) => {
    const ligadas = perguntas.filter((q: Obj) => (q.resolve || []).includes(p.id));
    const resolucao = perguntas.some((q: Obj) => q.tipo !== 'revisao' && (q.resolve || []).includes(p.id)) ? 'candidato' : resolucaoPadrao(p);
    let status = resolucao === 'automatica' ? 'automatico' : 'pendente';
    if (status !== 'automatico') {
      const situacoes = ligadas.map((q: Obj) => situacaoResposta(q, respostas[q.id]));
      if (situacoes.includes('respondida')) status = 'respondido';
      else if (situacoes.includes('mantida')) status = 'mantido';
    }
    return { id: p.id, gravidade: p.gravidade, titulo: p.titulo, por_que: p.por_que || '', como_corrigir: p.como_corrigir || '', resolucao, perguntas: ligadas.map((q: Obj) => q.id), status };
  });
}

export function normalizarRespostas(d: Obj, entradas: Obj): Obj {
  const saida: Obj = {};
  todasPerguntas(d).forEach((q: Obj) => {
    const r = entradas?.[q.id];
    if (q.tipo === 'distribuicao') {
      const atividades = Array.isArray(r) ? r : (Array.isArray(r?.atividades) ? r.atividades : []);
      saida[q.id] = { confirmado: !!r?.confirmado, atividades: atividades.filter((x: Obj) => x && x.bullet && (q.opcoes || []).includes(x.cargo)).map((x: Obj) => ({ bullet: String(x.bullet), cargo: String(x.cargo) })) };
    } else if (q.tipo === 'revisao') {
      saida[q.id] = r && ['manter','ajustar'].includes(r.acao) ? { acao: r.acao, texto: String(r.texto || '').trim() } : '';
    } else {
      saida[q.id] = r === undefined || r === null ? '' : String(r).trim();
    }
  });
  return saida;
}

export function prepararDadosConfirmados(dadosOriginais: Obj, d: Obj): Obj {
  const dados = JSON.parse(JSON.stringify(dadosOriginais || {}));
  const respostas = d.respostas || {};
  (d.perguntas || []).filter((q: Obj) => q.tipo === 'distribuicao').forEach((q: Obj) => {
    const r = respostas[q.id];
    const atividades = Array.isArray(r) ? r : (r && Array.isArray(r.atividades) ? r.atividades : []);
    const daEmpresa = (dados.experiencias || []).filter((e: Obj) => e.empresa === q.empresa);
    if (atividades.length) {
      daEmpresa.forEach((e: Obj) => { e.bullets = []; });
      atividades.forEach((a: Obj) => {
        const destino = daEmpresa.find((e: Obj) => e.cargo === a.cargo);
        if (destino && a.bullet) destino.bullets.push(String(a.bullet));
      });
    }
    const confirmado = Array.isArray(r) || !!(r && r.confirmado);
    daEmpresa.forEach((e: Obj) => { e.atribuicao_incerta = !confirmado; });
  });
  (d.perguntas || []).filter((q: Obj) => q.campo === 'promocao').forEach((q: Obj) => {
    if (respostas[q.id] !== 'Sim') return;
    const daEmpresa = (dados.experiencias || []).filter((e: Obj) => e.empresa === q.empresa);
    daEmpresa.forEach((e: Obj, i: number) => { e.promocao = i < daEmpresa.length - 1; });
  });
  const contatoQ = (d.perguntas || []).find((q: Obj) => q.campo === 'contato');
  const contatoR = contatoQ ? respostas[contatoQ.id] : '';
  if (contatoR && contatoR !== SEM_ALTERACAO) {
    dados.contato = dados.contato || {};
    const r = String(contatoR);
    const email = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.exec(r);
    const telefone = /(?:\+?55\s?)?\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}/.exec(r);
    if (email && !dados.contato.email) dados.contato.email = email[0];
    if (telefone && !dados.contato.telefone) dados.contato.telefone = telefone[0].trim();
  }
  return dados;
}

function listaCampos(ia: any, fonte: any[], campos: string[]) {
  const base = Array.isArray(ia) ? ia : (fonte || []);
  return base.map((x: Obj) => {
    const out: Obj = {};
    campos.forEach(c => { out[c] = String(x?.[c] || '').trim(); });
    return out;
  }).filter((x: Obj) => !!x[campos[0]]);
}

export function consolidarPerfil(ia: Obj, dados: Obj): Obj {
  const norm = (s: any) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const expIA = Array.isArray(ia.experiencias) ? ia.experiencias : [];
  const perfil: Obj = {
    nome: dados.nome || '', contato: dados.contato || {},
    titulo: String(ia.titulo || dados.titulo || '').trim(), resumo: String(ia.resumo || dados.resumo || '').trim(),
    competencias: Array.isArray(ia.competencias) ? ia.competencias.map((g: Obj) => ({ grupo: String(g.grupo || ''), itens: (Array.isArray(g.itens) ? g.itens : []).map(String) })).filter((g: Obj) => g.grupo && g.itens.length) : [],
    experiencias: [],
    formacao: listaCampos(ia.formacao, dados.formacao, ['curso','instituicao','inicio','fim']),
    cursos: listaCampos(ia.cursos, dados.cursos, ['nome','instituicao','ano']),
    idiomas: listaCampos(ia.idiomas, dados.idiomas, ['idioma','nivel']),
    pendencias: (Array.isArray(ia.pendencias) ? ia.pendencias : []).map((x: any) => normalizarPendencia(x)).filter(Boolean)
  };
  (dados.experiencias || []).forEach((e: Obj, i: number) => {
    let x = expIA[i];
    if (!x || norm(x.empresa) !== norm(e.empresa) || norm(x.cargo) !== norm(e.cargo)) x = expIA.find((k: Obj) => norm(k.empresa) === norm(e.empresa) && norm(k.cargo) === norm(e.cargo));
    let bullets = Array.isArray(x?.bullets) ? x.bullets.map((b: any) => typeof b === 'string' ? { texto: b.trim(), origem: 'curriculo' } : { texto: String(b?.texto || '').trim(), origem: b?.origem === 'confirmado' ? 'confirmado' : 'curriculo' }).filter((b: Obj) => b.texto) : [];
    if (!bullets.length) bullets = (e.bullets || []).map((b: string) => ({ texto: String(b), origem: 'curriculo' }));
    // Empresa, cargo e datas são imutáveis e vêm exclusivamente da extração.
    perfil.experiencias.push({ empresa: e.empresa, cargo: e.cargo, inicio: e.inicio, fim: e.fim, promocao: !!e.promocao, bullets });
  });
  return perfil;
}

function normalizarPendencia(x: any): Obj | null {
  if (!x) return null;
  if (typeof x === 'string') return { texto: x, ideal: '', alvo: '' };
  const texto = String(x.texto || '').trim(); if (!texto) return null;
  const secao = ['titulo','resumo','competencias','experiencia','formacao','cursos','idiomas','contato'].includes(x.secao) ? x.secao : '';
  let alvo = secao;
  if (secao === 'experiencia') { const e = Number.parseInt(x.experiencia,10), b = Number.parseInt(x.bullet,10); alvo = Number.isNaN(e) ? '' : `exp-${e}${Number.isNaN(b) ? '' : `-b${b}`}`; }
  return { texto, ideal: String(x.ideal || '').trim(), alvo };
}

export function travarMarcadoresENumeros(perfil: Obj, fonte: string): Obj[] {
  const pendencias: Obj[] = [];
  const trocar = (texto: any, alvo: string, onde: string) => String(texto || '').replace(/\[(PREENCHER|INSERIR|X)[^\]]*\]/gi, () => {
    pendencias.push({ texto: `Falta uma informação em: ${onde}.`, ideal: 'Troque [CONFIRMAR] pela informação verdadeira ou apague o trecho.', alvo }); return '[CONFIRMAR]';
  });
  perfil.titulo = trocar(perfil.titulo,'titulo','Título');
  perfil.resumo = trocar(perfil.resumo,'resumo','Resumo');
  (perfil.competencias || []).forEach((g: Obj) => { g.itens = (g.itens || []).map((x: string) => trocar(x,'competencias','Competências')); });
  (perfil.experiencias || []).forEach((e: Obj,i: number) => (e.bullets || []).forEach((b: Obj,j: number) => { b.texto = trocar(b.texto,`exp-${i}-b${j}`,`${e.cargo} (${e.empresa})`); }));
  const conhecidos = new Set((String(fonte).match(/\d+(?:[.,]\d+)?/g) || []));
  const checar = (texto: any, onde: string, alvo: string) => String(texto || '').replace(/\d+(?:[.,]\d+)?/g, n => {
    if (conhecidos.has(n)) return n;
    pendencias.push({ texto: `O número "${n}" não aparece no currículo nem nas respostas (${onde}).`, ideal: 'Troque [CONFIRMAR] pelo número verdadeiro ou apague o trecho.', alvo });
    return '[CONFIRMAR]';
  });
  perfil.titulo = checar(perfil.titulo,'Título','titulo'); perfil.resumo = checar(perfil.resumo,'Resumo','resumo');
  (perfil.competencias || []).forEach((g: Obj) => { g.itens = (g.itens || []).map((x: string) => checar(x,`Competências — ${g.grupo}`,'competencias')); });
  (perfil.experiencias || []).forEach((e: Obj,i: number) => (e.bullets || []).forEach((b: Obj,j: number) => { b.texto = checar(b.texto,`${e.cargo} (${e.empresa})`,`exp-${i}-b${j}`); }));
  for (const sec of ['formacao','cursos','idiomas']) (perfil[sec] || []).forEach((x: Obj) => Object.keys(x).forEach(k => { x[k] = checar(x[k],sec,sec); }));
  return pendencias;
}

export function aplicarCorrecaoPerfil(perfil: Obj, ref: string, correcao: string): boolean {
  const c = String(correcao || '').trim(); if (!c || /\[(PREENCHER|CONFIRMAR|X)\b/i.test(c)) return false;
  let m = /^e(\d+)b(\d+)$/.exec(ref);
  if (m) { const e = perfil.experiencias?.[Number(m[1])-1]; const b = e?.bullets?.[Number(m[2])-1]; if (!b) return false; b.texto = c.replace(/^[•●\-–]\s*/,''); return true; }
  if (ref === 'resumo') { perfil.resumo = c; return true; }
  if (ref === 'titulo' && c.length <= 70) { perfil.titulo = c; return true; }
  m = /^comp(\d+)$/.exec(ref);
  if (m) { const g = perfil.competencias?.[Number(m[1])-1]; const k = c.indexOf(':'); if (!g || k === -1) return false; const itens = c.slice(k+1).split(',').map(x=>x.trim()).filter(Boolean); if (!itens.length) return false; g.grupo = c.slice(0,k).trim() || g.grupo; g.itens = itens; return true; }
  return false;
}

export function perfilParaDados(perfil: Obj): Obj {
  return {
    nome: perfil.nome || '', contato: perfil.contato || {}, titulo: perfil.titulo || '', resumo: perfil.resumo || '',
    competencias: (perfil.competencias || []).map((g: Obj) => `${g.grupo}: ${(g.itens || []).join(', ')}`),
    experiencias: (perfil.experiencias || []).map((e: Obj) => ({ ...e, bullets: (e.bullets || []).map((b: any) => typeof b === 'string' ? b : b.texto || '') })),
    formacao: perfil.formacao || [], cursos: perfil.cursos || [], idiomas: perfil.idiomas || []
  };
}
