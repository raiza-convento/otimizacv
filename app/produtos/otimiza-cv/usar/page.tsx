'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type CSSProperties } from 'react';
import Link from 'next/link';
import ProfileEditor from '../../../components/ProfileEditor';
import RequireAuth from '@/components/RequireAuth';
import { useAuth } from '@/components/AuthProvider';
import { fetchWithAuth } from '@/lib/supabase-browser';

type AnyObj = Record<string, any>;
type Etapa = 'envio' | 'diagnostico' | 'perguntas' | 'revisao' | 'conferencia' | 'download';
type Modelo = 'classico' | 'moderno';

const ETAPAS: { id: Etapa; label: string }[] = [
  { id: 'envio', label: 'Envio' },
  { id: 'diagnostico', label: 'Diagnóstico' },
  { id: 'perguntas', label: 'Perguntas' },
  { id: 'revisao', label: 'Revisão' },
  { id: 'conferencia', label: 'Conferência' },
  { id: 'download', label: 'Download' },
];
const SEM_ALTERACAO = 'SEM_ALTERACAO';
const ROTULO_GRAVIDADE: Record<string, string> = { critico: 'Crítico', importante: 'Importante', recrutador: 'Para o recrutador' };
const ORDEM_GRAVIDADE: Record<string, number> = { critico: 0, importante: 1, recrutador: 2 };
const CONTAGEM: Record<string, [string, string]> = {
  critico: ['crítico', 'críticos'], importante: ['importante', 'importantes'], recrutador: ['para o recrutador', 'para o recrutador'],
};

function faixa(n: number) {
  const limites = [30, 25, 20, 15, 10, 5];
  for (const limite of limites) if (n > limite) return `mais de ${limite} pontos`;
  return `${n}${n === 1 ? ' ponto' : ' pontos'}`;
}
function contagemProblemas(problemas: AnyObj[]) {
  return (problemas || []).reduce((acc: AnyObj, p: AnyObj) => {
    if (p.gravidade in acc) acc[p.gravidade] += 1;
    return acc;
  }, { critico: 0, importante: 0, recrutador: 0 });
}
function resolucaoDe(p: AnyObj) {
  if (p.resolucao === 'automatica' || p.resolucao === 'candidato') return p.resolucao;
  if (p.origem === 'regra') return p.categoria === 'leitura' || /^Contato não encontrado/.test(p.titulo || '') ? 'candidato' : 'automatica';
  return ['layout', 'estrutura', 'datas', 'palavras-chave'].includes(p.categoria) ? 'automatica' : 'candidato';
}
function situacaoPergunta(q: AnyObj, resposta: any): '' | 'respondida' | 'mantida' {
  if (q.tipo === 'distribuicao') return resposta?.confirmado === true || Array.isArray(resposta) ? 'respondida' : '';
  if (q.tipo === 'revisao') {
    if (!resposta) return '';
    if (resposta.acao === 'manter') return 'mantida';
    const texto = String(resposta.texto || '').trim();
    return resposta.acao === 'ajustar' && texto && !/\[(PREENCHER|CONFIRMAR)/i.test(texto) ? 'respondida' : '';
  }
  if (resposta === SEM_ALTERACAO) return 'mantida';
  return typeof resposta === 'string' && resposta.trim() ? 'respondida' : '';
}

function segmentosMarcados(texto: string, problemas: AnyObj[]) {
  const marcas: AnyObj[] = [];
  (problemas || []).forEach((p: AnyObj) => (p.ocorrencias || []).forEach((o: AnyObj, k: number) => {
    if (Number.isInteger(o.inicio) && o.inicio >= 0 && o.fim > o.inicio && o.inicio < texto.length) {
      marcas.push({ inicio: o.inicio, fim: Math.min(o.fim, texto.length), gravidade: p.gravidade, pid: p.id, k });
    }
  }));
  marcas.sort((a, b) => a.inicio - b.inicio || (ORDEM_GRAVIDADE[a.gravidade] ?? 9) - (ORDEM_GRAVIDADE[b.gravidade] ?? 9));
  const partes: AnyObj[] = [];
  let cursor = 0;
  marcas.forEach((m) => {
    if (m.fim <= cursor) return;
    const inicio = Math.max(cursor, m.inicio);
    if (inicio > cursor) partes.push({ texto: texto.slice(cursor, inicio) });
    partes.push({ texto: texto.slice(inicio, m.fim), ...m });
    cursor = m.fim;
  });
  if (cursor < texto.length) partes.push({ texto: texto.slice(cursor) });
  return partes;
}

function ResumePreview({ perfil, modelo, expanded = false }: { perfil: AnyObj; modelo: Modelo; expanded?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.35);
  useEffect(() => {
    if (expanded) return;
    const el = host.current;
    if (!el) return;
    const update = () => setScale(Math.max(0.1, (el.clientWidth - 2) / 794));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [expanded]);
  const c = perfil?.contato || {};
  const junta = (items: any[], separador: string) => items.map((x) => String(x || '').trim()).filter(Boolean).join(separador);
  const nome = String(perfil?.nome || '').toLowerCase().replace(/(^|\s)(\S)/g, (_m, a, b) => a + b.toUpperCase()).replace(/\s(De|Da|Do|Dos|Das|E)\s/g, (m) => m.toLowerCase());
  const cls = modelo === 'classico' ? 'm1' : 'm2';
  const cv = (
    <div className={`cv ${cls}`}>
      <p className="cv-nome">{nome}</p>
      {perfil?.titulo && <p className="cv-titulo">{perfil.titulo}</p>}
      <p className="cv-contato">{junta([c.cidade, c.telefone, c.email, c.linkedin], ' | ')}</p>
      {perfil?.resumo && <><p className="cv-secao">{modelo === 'classico' ? 'RESUMO PROFISSIONAL' : 'Resumo Profissional'}</p><p className="cv-resumo">{perfil.resumo}</p></>}
      {!!(perfil?.competencias || []).length && <><p className="cv-secao">{modelo === 'classico' ? 'COMPETÊNCIAS' : 'Competências'}</p><ul className="cv-lista-comp">{(perfil.competencias || []).map((g: AnyObj, i: number) => <li key={i}><strong>{g.grupo}:</strong> {(g.itens || []).join(', ')}</li>)}</ul></>}
      {!!(perfil?.experiencias || []).length && <><p className="cv-secao">{modelo === 'classico' ? 'EXPERIÊNCIA PROFISSIONAL' : 'Experiência Profissional'}</p>{(perfil.experiencias || []).map((e: AnyObj, i: number) => {
        const mesma = i > 0 && perfil.experiencias[i - 1]?.empresa === e.empresa;
        return <div key={i}><p className={`cv-cargo${mesma ? ' mesma-empresa' : ''}`}>{e.cargo}</p><p className="cv-empresa">{junta([e.empresa, junta([e.inicio, e.fim], ' – ')], ' | ')}{e.promocao ? ' | Promoção interna' : ''}</p><ul>{(e.bullets || []).filter((b: any) => (typeof b === 'string' ? b : b.texto)).map((b: any, j: number) => <li key={j}>{typeof b === 'string' ? b : b.texto}</li>)}</ul></div>;
      })}</>}
      {!!(perfil?.formacao || []).length && <><p className="cv-secao">{modelo === 'classico' ? 'FORMAÇÃO ACADÊMICA' : 'Formação Acadêmica'}</p>{perfil.formacao.map((f: AnyObj, i: number) => <div key={i}><p className="cv-cargo">{f.curso}</p><p className="cv-empresa">{junta([f.instituicao, junta([f.inicio, f.fim], ' – ')], ' | ')}</p></div>)}</>}
      {!!(perfil?.cursos || []).length && <><p className="cv-secao">{modelo === 'classico' ? 'CURSOS' : 'Cursos'}</p>{perfil.cursos.map((x: AnyObj, i: number) => <p className="cv-comp" key={i}>{junta([x.nome, x.instituicao, x.ano], ' | ')}</p>)}</>}
      {!!(perfil?.idiomas || []).length && <><p className="cv-secao">{modelo === 'classico' ? 'IDIOMAS' : 'Idiomas'}</p>{perfil.idiomas.map((x: AnyObj, i: number) => <p className="cv-comp" key={i}>{junta([x.idioma, x.nivel], ': ')}</p>)}</>}
    </div>
  );
  if (expanded) return cv;
  return <div ref={host} className="previa" aria-hidden="true"><div className="previa-conteudo" style={{ width: 794, height: 1123, transform: `scale(${scale})`, transformOrigin: 'top left' }}>{cv}</div></div>;
}

export default function OtimizaCvWorkspace() {
  const { user } = useAuth();
  const [etapa, setEtapa] = useState<Etapa>('envio');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [arquivoUrl, setArquivoUrl] = useState('');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [aceite, setAceite] = useState(false);
  const [id, setId] = useState('');
  const [texto, setTexto] = useState('');
  const [dados, setDados] = useState<AnyObj | null>(null);
  const [diag, setDiag] = useState<AnyObj | null>(null);
  const [perguntas, setPerguntas] = useState<any[]>([]);
  const [respostas, setRespostas] = useState<AnyObj>({});
  const [perfil, setPerfil] = useState<AnyObj | null>(null);
  const [auditoria, setAuditoria] = useState<AnyObj | null>(null);
  const [conferencia, setConferencia] = useState<AnyObj | null>(null);
  const [busy, setBusy] = useState(false);
  const [inicioOperacao, setInicioOperacao] = useState<number | null>(null);
  const [tempoDecorrido, setTempoDecorrido] = useState(0);
  const [status, setStatus] = useState('');
  const [erro, setErro] = useState('');
  const [ia, setIa] = useState('');
  const [arquivosGerados, setArquivosGerados] = useState<Record<Modelo, any>>({} as Record<Modelo, any>);
  const [complementando, setComplementando] = useState(false);
  const [complementosProntos, setComplementosProntos] = useState(false);
  const [revisorPronto, setRevisorPronto] = useState(false);
  const [erroComplemento, setErroComplemento] = useState('');
  const [visao, setVisao] = useState<'robo' | 'original'>('robo');
  const [problemaAtivo, setProblemaAtivo] = useState('');
  const [modeloSelecionado, setModeloSelecionado] = useState<Modelo>('classico');
  const [modeloModal, setModeloModal] = useState<Modelo | null>(null);
  const [aviso, setAviso] = useState('');

  const problemas = diag?.problemas || [];
  const contagem = useMemo(() => contagemProblemas(problemas), [problemas]);
  const totalProblemas = contagem.critico + contagem.importante + contagem.recrutador;
  const nomeArquivo = arquivo?.name || 'Escolha o arquivo do seu currículo';

  useEffect(() => {
    const metadataName = String(user?.user_metadata?.full_name || '').trim();
    if (metadataName && !nome) setNome(metadataName);
    if (user?.email && !email) setEmail(user.email);
  }, [user, nome, email]);
  useEffect(() => {
    if (!aviso) return;
    const timer = window.setTimeout(() => setAviso(''), 4500);
    return () => window.clearTimeout(timer);
  }, [aviso]);
  useEffect(() => {
    if (!busy || !inicioOperacao) { setTempoDecorrido(0); return; }
    const atualizar = () => setTempoDecorrido(Math.max(0, Math.floor((Date.now() - inicioOperacao) / 1000)));
    atualizar();
    const timer = window.setInterval(atualizar, 1000);
    return () => window.clearInterval(timer);
  }, [busy, inicioOperacao]);
  useEffect(() => { window.scrollTo(0, 0); }, [etapa]);
  useEffect(() => {
    if (!modeloModal) return;
    const onKeyDown = (event: KeyboardEvent | globalThis.KeyboardEvent) => { if (event.key === 'Escape') setModeloModal(null); };
    document.addEventListener('keydown', onKeyDown as EventListener);
    return () => document.removeEventListener('keydown', onKeyDown as EventListener);
  }, [modeloModal]);
  useEffect(() => () => { if (arquivoUrl) URL.revokeObjectURL(arquivoUrl); }, [arquivoUrl]);

  async function chamarEtapaComId(analysisId: string, stage: string, extra: AnyObj = {}) {
    const r = await fetchWithAuth('/api/etapa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id_analise: analysisId, etapa: stage, ...extra }) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.erro || `Falha na etapa ${stage}`);
    if (j.ia) setIa(`${j.ia.provedor} · ${j.ia.modelo}`);
    return j.resultado;
  }
  async function chamarEtapa(stage: string, extra: AnyObj = {}) { return chamarEtapaComId(id, stage, extra); }

  async function concluirComplementos(analysisId: string, diagnosticoInicial: AnyObj) {
    setComplementando(true); setComplementosProntos(false); setErroComplemento('');
    try {
      if (!revisorPronto) {
        setStatus('Segundo revisor procurando pontos que possam ter passado despercebidos...');
        const revisado = await chamarEtapaComId(analysisId, 'revisor');
        setDiag(revisado || diagnosticoInicial);
        setRevisorPronto(true);
      }
      setStatus('Preparando perguntas e decisões...');
      const q = await chamarEtapaComId(analysisId, 'perguntas');
      setPerguntas(q?.perguntas || []);
      if (q?.diagnostico) setDiag(q.diagnostico);
      setRespostas(q?.diagnostico?.respostas || {});
      setComplementosProntos(true);
      setStatus('Diagnóstico completo. Você já pode responder às perguntas.');
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : 'Não foi possível concluir a revisão complementar.';
      setErroComplemento(mensagem);
      setStatus('O diagnóstico inicial está disponível, mas a revisão complementar ficou pendente.');
    } finally { setComplementando(false); }
  }

  async function iniciar(e: FormEvent) {
    e.preventDefault(); setErro(''); setErroComplemento(''); setComplementosProntos(false); setRevisorPronto(false);
    setId(''); setDiag(null); setDados(null); setTexto(''); setPerguntas([]); setRespostas({}); setPerfil(null); setAuditoria(null); setConferencia(null);
    setArquivosGerados({} as Record<Modelo, any>); setVisao('robo'); setProblemaAtivo('');
    if (!nome.trim()) return setErro('Informe o seu nome.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setErro('Informe um e-mail válido.');
    if (!arquivo) return setErro('Escolha o arquivo do seu currículo.');
    if (!/\.(pdf|docx)$/i.test(arquivo.name)) return setErro('Envie o currículo em PDF ou Word (.docx).');
    if (arquivo.size > 10 * 1024 * 1024) return setErro('O arquivo passa de 10 MB. Envie uma versão menor.');
    if (!aceite) return setErro('Marque a autorização de uso dos dados para continuar.');
    if (arquivoUrl) URL.revokeObjectURL(arquivoUrl);
    setArquivoUrl(URL.createObjectURL(arquivo));
    setBusy(true); setInicioOperacao(Date.now());
    try {
      setStatus('Enviando e lendo o currículo...');
      const f = new FormData(); f.append('arquivo', arquivo); f.append('nome', nome.trim()); f.append('email', email.trim()); f.append('aceiteLgpd', 'true');
      const r = await fetchWithAuth('/api/analisar', { method: 'POST', body: f }); const j = await r.json();
      if (!r.ok) throw new Error(j.erro || 'Falha na análise');
      setId(j.id_analise); setDados(j.dados_extraidos); setTexto(j.texto_robo || ''); setIa(`${j.provedor_ia} · ${j.modelo_ia}`);
      setStatus('Executando checagens determinísticas...'); await chamarEtapaComId(j.id_analise, 'checagens');
      setStatus('Auditoria inicial do currículo com IA...'); const d = await chamarEtapaComId(j.id_analise, 'diagnostico');
      setDiag(d || null); setEtapa('diagnostico'); setStatus('Diagnóstico inicial pronto. O segundo revisor e as perguntas estão sendo preparados.');
      void concluirComplementos(j.id_analise, d || {});
    } catch (e) { setErro(e instanceof Error ? e.message : 'Erro inesperado'); }
    finally { setBusy(false); setInicioOperacao(null); }
  }
  async function executar(stage: string, extra: AnyObj = {}) {
    const rotulos: Record<string, string> = { respostas: 'Salvando suas respostas...', perfil: 'Montando o perfil mestre...', salvar_perfil: 'Salvando a revisão do currículo...', auditoria_perfil: 'Conferindo o perfil com a IA...', conferencia: 'Executando a conferência final de conteúdo...' };
    setStatus(rotulos[stage] || 'Processando sua solicitação...');
    setBusy(true); setInicioOperacao(Date.now()); setErro('');
    try { return await chamarEtapa(stage, extra); }
    catch (e) { setErro(e instanceof Error ? e.message : 'Erro'); return null; }
    finally { setBusy(false); setInicioOperacao(null); }
  }
  async function abrirPerguntas() {
    setBusy(true); setInicioOperacao(Date.now()); setErro(''); setStatus('Carregando perguntas e revisões...');
    try {
      const q = await chamarEtapa('perguntas');
      setPerguntas(q?.perguntas || []); if (q?.diagnostico) setDiag(q.diagnostico);
      setRespostas(q?.diagnostico?.respostas || respostas); setEtapa('perguntas');
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não consegui carregar as perguntas.'); }
    finally { setBusy(false); setInicioOperacao(null); setStatus(''); }
  }
  async function salvarRespostas() {
    const r = await executar('respostas', { respostas });
    if (r) { setStatus('Respostas salvas.'); setAviso('Respostas salvas. Agora você pode montar o perfil mestre.'); }
  }
  async function montarPerfil() {
    setBusy(true); setInicioOperacao(Date.now()); setErro('');
    let perfilMontado: AnyObj | null = null;
    try {
      setStatus('Montando o perfil mestre...');
      perfilMontado = await chamarEtapa('perfil');
      if (!perfilMontado) throw new Error('A IA não retornou o perfil mestre.');
      setPerfil(perfilMontado);

      // Na versão Apps Script, a auditoria do perfil acontece antes de abrir a revisão.
      // Mantemos essa ordem para que as correções e os alertas já apareçam nos campos amarelos.
      setStatus('Fazendo a revisão completa do perfil com IA...');
      const a = await chamarEtapa('auditoria_perfil', { perfil: perfilMontado });
      setAuditoria(a || null);
      if (a?.perfil_atualizado) {
        perfilMontado = a.perfil_atualizado;
        setPerfil(perfilMontado);
      }
      setConferencia(null);
      setEtapa('revisao');
      setStatus('Perfil montado e auditado. Revise os campos e as pendências.');
      if (a && (Number(a.aplicadas || 0) > 0 || Number(a.pendentes || 0) > 0)) {
        setAviso(`A revisão da IA aplicou ${Number(a.aplicadas || 0)} correção(ões) e deixou ${Number(a.pendentes || 0)} ponto(s) para você conferir.`);
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui montar e auditar o perfil.');
      // Se o perfil foi salvo mas a auditoria falhou, não descartamos o trabalho do candidato.
      if (perfilMontado) {
        setPerfil(perfilMontado);
        setEtapa('revisao');
        setStatus('Perfil montado. A auditoria ficou pendente e poderá ser tentada junto da conferência.');
      }
    } finally { setBusy(false); setInicioOperacao(null); }
  }
  async function salvarPerfil() {
    if (!perfil) return;
    const r = await executar('salvar_perfil', { perfil });
    if (r) { setPerfil(r); setStatus('Perfil salvo.'); setAviso('Revisão salva.'); }
  }
  async function auditar() {
    if (!perfil) return;
    if (/\[(CONFIRMAR|PREENCHER)(?:[:\]])/i.test(JSON.stringify(perfil))) {
      setErro('Ainda há [CONFIRMAR] ou [PREENCHER] no currículo. Corrija ou apague esses trechos antes de conferir.');
      return;
    }
    setBusy(true); setInicioOperacao(Date.now()); setErro('');
    let perfilAtual: AnyObj = perfil;
    try {
      // Um único clique executa o fluxo completo: salvar, completar eventual auditoria
      // pendente e rodar a conferência final. Não interrompe para pedir um segundo clique.
      setStatus('Salvando a revisão...');
      const salvo = await chamarEtapa('salvar_perfil', { perfil: perfilAtual });
      if (salvo) perfilAtual = salvo;
      setPerfil(perfilAtual);

      // Normalmente a auditoria já foi feita ao montar o perfil, como no Apps Script.
      // Se aquela etapa falhou, tentamos novamente aqui, sem obrigar o usuário a recomeçar.
      if (!auditoria) {
        setStatus('Concluindo a auditoria do perfil com IA...');
        const a = await chamarEtapa('auditoria_perfil', { perfil: perfilAtual });
        setAuditoria(a || null);
        if (a?.perfil_atualizado) {
          perfilAtual = a.perfil_atualizado;
          setPerfil(perfilAtual);
        }
      }

      setStatus('Conferindo o currículo com IA...');
      const r = await chamarEtapa('conferencia', { perfil: perfilAtual });
      setConferencia(r || null);
      setEtapa('conferencia');
      setStatus('Conferência de conteúdo concluída.');
      setAviso('Conferência de conteúdo concluída.');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui concluir a conferência do currículo.');
    } finally { setBusy(false); setInicioOperacao(null); }
  }
  async function conferir() {
    if (!perfil) return;
    const r = await executar('conferencia', { perfil });
    if (r) { setConferencia(r); setStatus('Conferência de conteúdo concluída.'); setAviso('Conferência de conteúdo concluída.'); }
  }
  async function gerar(modelo: Modelo) {
    setBusy(true); setInicioOperacao(Date.now()); setErro(''); setStatus(`Gerando modelo ${modelo === 'classico' ? 'Clássico' : 'Moderno'} em PDF e Word...`);
    try {
      const r = await fetchWithAuth('/api/gerar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id_analise: id, modelo }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.erro || 'Falha ao gerar currículo.');
      setArquivosGerados((prev) => ({ ...prev, [modelo]: j })); setStatus(`Modelo ${modelo === 'classico' ? 'Clássico' : 'Moderno'} gerado.`); setAviso('PDF e Word gerados com sucesso.');
    } catch (e) { setErro(e instanceof Error ? e.message : 'Erro ao gerar currículo.'); }
    finally { setBusy(false); setInicioOperacao(null); }
  }

  function focarProblema(problemId: string) {
    setVisao('robo'); setProblemaAtivo(problemId);
    window.setTimeout(() => document.getElementById(`p-${problemId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 40);
  }
  function focarMarca(markId: string, problemId: string) {
    setVisao('robo'); setProblemaAtivo(problemId);
    window.setTimeout(() => {
      const mark = document.getElementById(markId);
      mark?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      mark?.classList.add('foco');
      window.setTimeout(() => mark?.classList.remove('foco'), 1900);
    }, 40);
  }
  function irParaPergunta(questionId: string) {
    window.setTimeout(() => {
      const card = document.getElementById(`pq-${questionId}`);
      card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card?.classList.add('destaque');
      window.setTimeout(() => card?.classList.remove('destaque'), 1800);
      const field = card?.querySelector('textarea:not([disabled]), input:not([disabled]), select') as HTMLElement | null;
      field?.focus({ preventScroll: true });
    }, 40);
  }
  function atualizarResposta(questionId: string, value: any) { setRespostas((prev) => ({ ...prev, [questionId]: value })); }
  function statusPonto(p: AnyObj) {
    if (resolucaoDe(p) === 'automatica') return 'automatico';
    const vinculadas = perguntas.filter((q) => (q.resolve || []).includes(p.id));
    const situacoes = vinculadas.map((q) => situacaoPergunta(q, respostas[q.id]));
    if (situacoes.includes('respondida')) return 'respondido';
    if (situacoes.includes('mantida')) return 'mantido';
    return 'pendente';
  }
  const pontosResolvidos = problemas.filter((p: AnyObj) => statusPonto(p) !== 'pendente').length;
  const pontosAuto = problemas.filter((p: AnyObj) => statusPonto(p) === 'automatico');
  const pontosRespondidos = problemas.filter((p: AnyObj) => statusPonto(p) === 'respondido').length;
  const pontosMantidos = problemas.filter((p: AnyObj) => statusPonto(p) === 'mantido').length;
  const pontosPendentes = problemas.filter((p: AnyObj) => statusPonto(p) === 'pendente');
  const itensConferencia = conferencia?.itens || [];
  const itensConfOk = itensConferencia.filter((item: AnyObj) => item.ok).length;
  const itensConfAviso = itensConferencia.filter((item: AnyObj) => !item.ok && item.aviso).length;
  const itensConfPendentes = itensConferencia.filter((item: AnyObj) => !item.ok && !item.aviso).length;
  const problemasAuditoria = auditoria?.problemas || [];
  const pendenciasPerfil = (perfil?.pendencias || []).map((item: any) => ({ gravidade: 'importante', titulo: String(typeof item === 'string' ? item : item?.texto || '').trim() })).filter((item: AnyObj) => item.titulo);
  const ajustesConferencia = [...pontosPendentes.map((p: AnyObj) => ({ gravidade: p.gravidade, titulo: p.titulo })), ...pendenciasPerfil, ...itensConferencia.filter((item: AnyObj) => !item.ok && !item.aviso).map((item: AnyObj) => ({ gravidade: 'critico', titulo: item.texto }))].filter((item, index, arr) => item.titulo && arr.findIndex((x) => String(x.titulo).trim().toLowerCase() === String(item.titulo).trim().toLowerCase()) === index);
  const melhoriasConferencia = itensConferencia.filter((item: AnyObj) => !item.ok && item.aviso);
  const temBloqueiosConferencia = ajustesConferencia.length > 0;
  const prontoParaTriagens = !!conferencia?.pronto && !temBloqueiosConferencia;
  const perguntasResolvidas = perguntas.filter((q) => !!situacaoPergunta(q, respostas[q.id])).length;
  const perguntasPendentes = perguntas.length - perguntasResolvidas;

  const tituloDiag = totalProblemas ? `O robô encontrou ${faixa(totalProblemas)} que podem estar barrando o seu currículo.` : 'O robô leu o seu currículo sem tropeços.';
  const divisaoDiag = totalProblemas ? `${problemas.filter((p: AnyObj) => resolucaoDe(p) === 'automatica').length ? 'Boa parte é corrigida automaticamente no novo currículo. ' : ''}${problemas.filter((p: AnyObj) => resolucaoDe(p) === 'candidato').length ? 'O que depende de você aparece na próxima etapa, para responder ou conferir.' : ''}` : '';
  const sStatus = status.toLowerCase();
  const loader = sStatus.includes('enviando')
    ? { titulo: 'Analisando seu currículo', passos: ['Recebendo e validando o arquivo', 'Lendo o currículo e extraindo o texto', 'Executando as checagens automáticas', 'Auditando o currículo com inteligência artificial'], ativo: 0 }
    : sStatus.includes('checagens')
      ? { titulo: 'Analisando seu currículo', passos: ['Arquivo recebido e texto extraído', 'Executando as checagens automáticas', 'Preparando a auditoria com inteligência artificial'], ativo: 1 }
      : sStatus.includes('auditoria inicial')
        ? { titulo: 'Analisando seu currículo', passos: ['Arquivo recebido e texto extraído', 'Checagens automáticas concluídas', 'Auditando o currículo item por item'], ativo: 2 }
        : sStatus.includes('perguntas') || sStatus.includes('carregando perguntas')
          ? { titulo: 'Preparando as perguntas', passos: ['Buscando perguntas e revisões', 'Organizando os itens ligados ao diagnóstico'], ativo: 0 }
          : sStatus.includes('perfil mestre')
            ? { titulo: 'Montando o seu currículo', passos: ['Aplicando as respostas confirmadas', 'Consolidando experiências e competências', 'Montando o perfil mestre'], ativo: 1 }
            : sStatus.includes('salvando suas respostas')
              ? { titulo: 'Salvando suas respostas', passos: ['Registrando suas decisões', 'Atualizando os pontos do diagnóstico'], ativo: 0 }
              : sStatus.includes('salvando a revisão')
                ? { titulo: 'Salvando a revisão', passos: ['Salvando os campos editados', 'Atualizando a versão do perfil'], ativo: 0 }
                : sStatus.includes('conferindo o perfil') || sStatus.includes('revisão completa do perfil') || sStatus.includes('auditoria do perfil')
                  ? { titulo: 'Revisando o seu currículo', passos: ['Conferindo o perfil estruturado', 'Aplicando correções automáticas suportadas', 'Registrando os pontos que dependem de você'], ativo: 1 }
                  : sStatus.includes('conferência final') || sStatus.includes('conferindo o currículo')
                    ? { titulo: 'Conferindo o conteúdo', passos: ['Salvando a versão revisada', 'Verificando fatos e informações com IA', 'Preparando o resultado da conferência'], ativo: 1 }
                    : { titulo: 'Preparando os arquivos', passos: ['Montando o PDF e o Word', 'Salvando os arquivos e preparando os links'], ativo: 0 };
  const mostrarTempo = sStatus.includes('enviando') || sStatus.includes('checagens') || sStatus.includes('auditoria inicial');
  const tempoFormatado = `${Math.floor(tempoDecorrido / 60)}:${String(tempoDecorrido % 60).padStart(2, '0')}`;

  return <RequireAuth><>
    <header className="topo">
      <Link className="marca portal-tool-back" href="/" aria-label="Voltar à central de produtos">← <span>OtimizaCV</span></Link>
      <ol className="etapas" aria-label="Etapas">
        {ETAPAS.map((item, i) => <li key={item.id} className={item.id === etapa ? 'atual' : ETAPAS.findIndex((x) => x.id === etapa) > i ? 'feita' : ''} aria-current={item.id === etapa ? 'step' : undefined}>{item.label}</li>)}
      </ol>
    </header>

    <main>
      {etapa === 'envio' && <section className="envio">
        <div className="envio-texto">
          <h1>Veja seu currículo do jeito que o robô de recrutamento vê.</h1>
          <p className="lead">Gupy, InHire, Vagas e outras plataformas leem o seu arquivo antes de qualquer pessoa. Se o robô lê errado, você nem chega ao recrutador. Envie seu currículo e veja o que está atrapalhando.</p>
        </div>
        <form className="formulario" onSubmit={iniciar} noValidate>
          <label className="campo"><span>Seu nome</span><input value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" required /></label>
          <label className="campo"><span>Seu e-mail</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></label>
          <label className={`arquivo${arquivo ? ' cheio' : ''}`}><input type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(e) => setArquivo(e.target.files?.[0] || null)} /><strong>{nomeArquivo}</strong><small>PDF ou Word (.docx), até 10 MB</small></label>
          <label className="aceite"><input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} /><span>Autorizo o uso dos meus dados para esta análise. O arquivo é lido por uma inteligência artificial e fica guardado por 30 dias, depois é apagado. Posso pedir a exclusão antes, a qualquer momento.</span></label>
          <p className="erro" role="alert">{erro}</p>
          <button className="btn btn-principal" type="submit" disabled={busy || !arquivo || !nome.trim() || !email.trim() || !aceite}>{busy ? 'Analisando...' : 'Analisar meu currículo'}</button>
          <p className="nota-tempo">A análise completa leva de 3 a 5 minutos: a IA lê o currículo inteiro e avalia item por item.</p>
        </form>
      </section>}

      {etapa === 'diagnostico' && <>
        <div className="resumo-diag"><div><h2>{tituloDiag}</h2><p className="lead">{divisaoDiag}</p></div>
          <ul className="contagem">{(['critico', 'importante', 'recrutador'] as const).filter((g) => contagem[g] > 0).map((g) => <li className={g} key={g}>{contagem[g]} {CONTAGEM[g][contagem[g] === 1 ? 0 : 1]}</li>)}</ul>
        </div>
        <div className="diag-grade">
          <div className="painel-robo">
            <div className="painel-robo-barra"><div className="alternar" role="tablist" aria-label="Visualização do currículo">
              <button type="button" role="tab" className={visao === 'robo' ? 'ativo' : ''} aria-selected={visao === 'robo'} onClick={() => setVisao('robo')}>Como o robô lê</button>
              <button type="button" role="tab" className={visao === 'original' ? 'ativo' : ''} aria-selected={visao === 'original'} onClick={() => setVisao('original')}>Seu arquivo</button>
            </div></div>
            {visao === 'robo' ? <pre className="texto-robo" id="texto-robo" tabIndex={0}>{segmentosMarcados(texto, problemas).map((segmento, i) => segmento.pid ? <mark key={`${segmento.pid}-${segmento.k}-${i}`} id={`m-${segmento.pid}-${segmento.k}`} className={segmento.gravidade} data-pid={segmento.pid} onClick={() => focarProblema(segmento.pid)}>{segmento.texto}</mark> : <span key={i}>{segmento.texto}</span>)}</pre> : <div className="original">
              {arquivoUrl && /\.pdf$/i.test(arquivo?.name || '') ? <iframe title="Seu arquivo original" src={arquivoUrl} /> : <p>A pré-visualização funciona só para PDF. Para comparar, abra o seu arquivo Word ao lado.</p>}
            </div>}
          </div>
          <div><ol className="problemas">{problemas.map((p: AnyObj) => {
            const ocorrencias = (p.ocorrencias || []).map((o: AnyObj, index: number) => ({ ...o, index })).filter((o: AnyObj) => o.trecho || o.correcao);
            return <li className={`problema ${p.gravidade}${problemaAtivo === p.id ? ' ativo' : ''}`} id={`p-${p.id}`} key={p.id}>
              <span className="problema-gravidade">{ROTULO_GRAVIDADE[p.gravidade] || 'Importante'}</span>
              <span className={`resolucao ${resolucaoDe(p) === 'automatica' ? 'auto' : 'voce'}`}>{resolucaoDe(p) === 'automatica' ? 'O novo currículo corrige sozinho' : 'Depende de você'}</span>
              {p.origem === 'revisor' && <span className="selo-revisor">Segunda revisão</span>}
              <h3>{p.titulo}</h3>
              {p.por_que && <p>{p.por_que}</p>}{p.como_corrigir && <p className="como">{p.como_corrigir}</p>}
              {ocorrencias.length > 1 && <p className="qtd-ocorrencias">{ocorrencias.length} itens com este ponto</p>}
              {!!ocorrencias.length && <ul className="trocas">{ocorrencias.slice(0, 5).map((o: AnyObj) => <li key={o.index} className={`troca${o.inicio >= 0 ? ' clicavel' : ''}${!o.correcao ? ' so-trecho' : ''}`} role={o.inicio >= 0 ? 'button' : undefined} tabIndex={o.inicio >= 0 ? 0 : undefined} onClick={() => o.inicio >= 0 && focarMarca(`m-${p.id}-${o.index}`, p.id)} onKeyDown={(event: KeyboardEvent<HTMLLIElement>) => { if (o.inicio >= 0 && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); focarMarca(`m-${p.id}-${o.index}`, p.id); } }}>
                <span className="antes">{o.trecho || '—'}</span>{o.correcao && <><span className="seta" aria-hidden="true">›</span><span className="depois">{o.correcao}</span></>}
              </li>)}</ul>}
              {ocorrencias.length > 5 && <details className="mais-trocas"><summary>Ver mais {ocorrencias.length - 5}</summary><ul className="trocas">{ocorrencias.slice(5).map((o: AnyObj) => <li key={o.index} className={`troca${o.inicio >= 0 ? ' clicavel' : ''}${!o.correcao ? ' so-trecho' : ''}`} onClick={() => o.inicio >= 0 && focarMarca(`m-${p.id}-${o.index}`, p.id)}><span className="antes">{o.trecho || '—'}</span>{o.correcao && <><span className="seta">›</span><span className="depois">{o.correcao}</span></>}</li>)}</ul></details>}
            </li>;
          })}</ol></div>
        </div>
        <div className="rodape-acao"><div><p className="status-fundo" aria-live="polite">{status || (complementando ? 'Segunda revisão e perguntas em processamento. Você já pode ler o diagnóstico.' : ia ? `Última IA: ${ia}` : '')}</p>
          {erroComplemento && <><p className="erro" role="alert">A revisão complementar não terminou: {erroComplemento}</p><button type="button" className="btn-link" disabled={complementando} onClick={() => void concluirComplementos(id, diag || {})}>Tentar de novo</button></>}
        </div><button type="button" className="btn btn-principal" disabled={!complementosProntos || complementando} onClick={() => void abrirPerguntas()}>{complementando ? 'Aguardando perguntas...' : 'Responder as perguntas'}</button></div>
      </>}

      {etapa === 'perguntas' && <>
        <div className="cabeca-tela"><h2>Perguntas e revisões do seu currículo</h2><p className="lead">Cada item resolve um ponto do diagnóstico. Responda com as suas palavras: a IA ajusta o texto para o tom que o recrutador espera. Se não tiver a informação ou não quiser mudar, marque “manter como está”. Só use informações verdadeiras: o sistema não inventa nada.</p>
          {!!perguntas.length && <p className="resumo-itens"><strong>{perguntas.length} {perguntas.length === 1 ? 'item' : 'itens'} para você:</strong> {perguntas.filter((q) => q.tipo !== 'revisao').length} perguntas e {perguntas.filter((q) => q.tipo === 'revisao').length} revisões. {perguntasPendentes ? <span className="faltam">Faltam {perguntasPendentes}.</span> : <span className="ok-tudo">Tudo respondido.</span>}</p>}
        </div>
        <div className="perguntas-grade">
          <div className="perguntas">
            {perguntas.filter((q) => q.tipo !== 'revisao').length > 0 && <div className="secao-itens"><h3>Perguntas <span className="qtd">{perguntas.filter((q) => q.tipo !== 'revisao').filter((q) => !!situacaoPergunta(q, respostas[q.id])).length} de {perguntas.filter((q) => q.tipo !== 'revisao').length}</span></h3><p className="sub-secao">Responda com as suas palavras. Se não tiver a informação, marque “manter como está”.</p></div>}
            {perguntas.filter((q) => q.tipo !== 'revisao').map((q: AnyObj) => {
              const response = respostas[q.id]; const situacao = situacaoPergunta(q, response); const semInfo = response === SEM_ALTERACAO;
              const linked = (q.resolve || []).map((pid: string) => problemas.find((p: AnyObj) => p.id === pid)).filter(Boolean);
              const isDistribution = q.tipo === 'distribuicao';
              const atividadesSalvas = Array.isArray(response?.atividades) ? response.atividades : [];
              return <article className={`pergunta item-acao ${situacao === 'respondida' ? 'feita' : situacao === 'mantida' ? 'mantida' : 'pendente'}`} id={`pq-${q.id}`} key={q.id}>
                <div className="cabeca-item"><span className="estado-item">{isDistribution ? (situacao ? 'Conferido' : 'Falta conferir') : situacao === 'respondida' ? 'Respondida' : situacao === 'mantida' ? 'Concluído sem alteração' : 'Falta responder'}</span></div>
                <fieldset><legend>{q.pergunta}</legend>
                  {!!linked.length && <ul className="resolve-chips"><li className="rotulo">Ajuda a resolver:</li>{linked.map((p: AnyObj) => <li className={p.gravidade} key={p.id}>{String(p.titulo || '').slice(0, 70)}</li>)}</ul>}
                  {q.motivo && <p className="motivo">{q.motivo}</p>}{q.ideal && <div className="ideal"><strong>O ideal</strong>{q.ideal}</div>}
                  {isDistribution ? <>
                    <p>Escolha o cargo correspondente a cada atividade:</p>
                    <ul className="atividades">{(q.atividades || []).map((a: AnyObj, i: number) => {
                      const selected = atividadesSalvas.find((x: AnyObj) => x.bullet === a.bullet)?.cargo || a.cargo || '';
                      return <li className="atividade" key={i}><p>{a.bullet}</p><select value={selected} aria-label="Cargo desta atividade" onChange={(e) => {
                        const next = (q.atividades || []).map((x: AnyObj) => ({ bullet: x.bullet, cargo: atividadesSalvas.find((v: AnyObj) => v.bullet === x.bullet)?.cargo || x.cargo }));
                        const updated = next.map((x: AnyObj) => x.bullet === a.bullet ? { ...x, cargo: e.target.value } : x);
                        atualizarResposta(q.id, { ...(response || {}), atividades: updated, confirmado: !!response?.confirmado });
                      }}><option value="">Selecione o cargo</option>{(q.opcoes || []).map((op: string) => <option value={op} key={op}>{op}</option>)}</select></li>;
                    })}</ul>
                    <label className="confirmar-item"><input type="checkbox" checked={!!response?.confirmado} onChange={(e) => atualizarResposta(q.id, { ...(response || {}), confirmado: e.target.checked, atividades: atividadesSalvas.length ? atividadesSalvas : (q.atividades || []).map((a: AnyObj) => ({ bullet: a.bullet, cargo: a.cargo })) })} /><span><strong>Conferi: cada atividade está no cargo certo.</strong> O robô não consegue saber isso sozinho. Só marque depois de conferir a lista.</span></label>
                  </> : q.tipo === 'revisao' ? null : <div className={`campo-resposta${semInfo ? ' sem-info' : ''}`}>
                    {q.tipo === 'sim_nao' || q.tipo === 'escolha' ? <div className="opcoes">{(q.tipo === 'sim_nao' ? ['Sim', 'Não'] : q.opcoes || []).map((op: string) => <label key={op}><input type="radio" name={q.id} checked={response === op} disabled={semInfo} onChange={() => atualizarResposta(q.id, op)} />{op}</label>)}</div>
                      : q.tipo === 'numero' ? <input type="text" inputMode="decimal" value={typeof response === 'string' && !semInfo ? response : ''} disabled={semInfo} onChange={(e) => atualizarResposta(q.id, e.target.value)} placeholder="Responda com suas palavras" />
                        : <textarea rows={2} value={typeof response === 'string' && !semInfo ? response : ''} disabled={semInfo} onChange={(e) => atualizarResposta(q.id, e.target.value)} placeholder="Responda com suas palavras" />}
                  </div>}
                  {!isDistribution && <label className="manter-item"><input type="checkbox" checked={semInfo} onChange={(e) => atualizarResposta(q.id, e.target.checked ? SEM_ALTERACAO : '')} /><span>Não tenho essa informação: manter como está</span></label>}
                </fieldset>
              </article>;
            })}
            {perguntas.filter((q) => q.tipo === 'revisao').length > 0 && <div className="secao-itens"><h3>Revisões <span className="qtd">{perguntas.filter((q) => q.tipo === 'revisao').filter((q) => !!situacaoPergunta(q, respostas[q.id])).length} de {perguntas.filter((q) => q.tipo === 'revisao').length}</span></h3><p className="sub-secao">Pontos do diagnóstico que não precisam de pergunta, mas precisam da sua decisão: diga como quer ajustar ou marque “manter como está”.</p></div>}
            {perguntas.filter((q) => q.tipo === 'revisao').map((q: AnyObj) => {
              const response = respostas[q.id] || {}; const situacao = situacaoPergunta(q, response); const linked = (q.resolve || []).map((pid: string) => problemas.find((p: AnyObj) => p.id === pid)).filter(Boolean);
              const temSugestao = q.sugestao && !/\[(PREENCHER|CONFIRMAR)/i.test(q.sugestao);
              return <article className={`pergunta item-acao revisao-item ${situacao === 'respondida' ? 'feita' : situacao === 'mantida' ? 'mantida' : 'pendente'}`} id={`pq-${q.id}`} key={q.id}>
                <div className="cabeca-item"><span className={`grav-chip ${q.gravidade || 'importante'}`}>{ROTULO_GRAVIDADE[q.gravidade] || 'Importante'}</span><span className="estado-item">{situacao === 'respondida' ? 'Ajuste anotado' : situacao === 'mantida' ? 'Mantido como está' : 'Falta decidir'}</span></div>
                <fieldset><legend>{q.pergunta}</legend>{linked.length > 0 && <ul className="resolve-chips"><li className="rotulo">Ajuda a resolver:</li>{linked.map((p: AnyObj) => <li className={p.gravidade} key={p.id}>{p.titulo}</li>)}</ul>}
                  {q.motivo && <p className="motivo">{q.motivo}</p>}{q.trecho && <div className="hoje"><strong>Hoje está assim</strong>{q.trecho}</div>}{q.ideal && <div className="ideal"><strong>O ideal</strong>{q.ideal}</div>}
                  <div className="opcoes escolha-revisao"><label><input type="radio" name={`acao-${q.id}`} checked={response.acao === 'ajustar'} onChange={() => atualizarResposta(q.id, { acao: 'ajustar', texto: response.texto || '' })} />Ajustar</label><label><input type="radio" name={`acao-${q.id}`} checked={response.acao === 'manter'} onChange={() => atualizarResposta(q.id, { acao: 'manter', texto: '' })} />Manter como está</label></div>
                  {response.acao === 'ajustar' && <div className="campo-ajuste">{temSugestao && <div className="sugestao"><span><strong>Sugestão</strong>{q.sugestao}</span><button type="button" className="btn-link usar-sugestao" onClick={() => atualizarResposta(q.id, { ...response, texto: q.sugestao })}>Usar a sugestão</button></div>}<label className="rotulo-ajuste" htmlFor={`resp-${q.id}`}>Como você quer que fique?</label><textarea id={`resp-${q.id}`} rows={2} value={response.texto || ''} onChange={(e) => atualizarResposta(q.id, { ...response, texto: e.target.value })} placeholder="Com as suas palavras. Ex.: remover este item, atualizar o ano, trocar por..." /></div>}
                </fieldset>
              </article>;
            })}
            {!perguntas.length && <p className="lead">Não há perguntas nem revisões para este currículo. Pode montar direto.</p>}
          </div>
          <aside className="pontos" id="painel-pontos" aria-live="polite"><h3>Pontos do diagnóstico</h3>
            <p className="placar-pontos"><strong>{pontosResolvidos} de {problemas.length}</strong> resolvidos</p><div className="barra" aria-hidden="true"><span style={{ width: `${problemas.length ? Math.round(pontosResolvidos / problemas.length * 100) : 100}%` }} /></div>
            {problemas.filter((p: AnyObj) => resolucaoDe(p) !== 'automatica').length > 0 && <><h4>Dependem de você ({problemas.filter((p: AnyObj) => resolucaoDe(p) !== 'automatica').length})</h4><ul className="lista-pontos">{problemas.filter((p: AnyObj) => resolucaoDe(p) !== 'automatica').map((p: AnyObj) => {
              const linked = perguntas.find((q) => (q.resolve || []).includes(p.id)); const status = statusPonto(p);
              return <li className={`ponto ${status}`} key={p.id}><span><span className={`grav ${p.gravidade}`}>{ROTULO_GRAVIDADE[p.gravidade]}</span>{p.titulo}{status === 'respondido' && <small>Resolvido com a sua resposta.</small>}{status === 'mantido' && <small>Concluído sem alteração.</small>}{status === 'pendente' && (linked ? <button type="button" className="btn-link" onClick={() => irParaPergunta(linked.id)}>{linked.tipo === 'revisao' ? 'Ir para a revisão ›' : linked.tipo === 'distribuicao' ? 'Ir para conferir ›' : 'Ir para a pergunta ›'}</button> : <small>Ajuste na revisão, depois de montar.</small>)}</span></li>;
            })}</ul></>}
            {!!pontosAuto.length && <><h4>O novo currículo corrige sozinho ({pontosAuto.length})</h4><details><summary>Ver quais</summary><ul className="lista-pontos">{pontosAuto.map((p: AnyObj) => <li className="ponto automatico" key={p.id}><span><span className={`grav ${p.gravidade}`}>{ROTULO_GRAVIDADE[p.gravidade]}</span>{p.titulo}</span></li>)}</ul></details></>}
          </aside>
        </div>
        <div className="rodape-acao"><button type="button" className="btn btn-secundario" onClick={() => setEtapa('diagnostico')}>Voltar ao diagnóstico</button><button type="button" className="btn btn-secundario" disabled={busy} onClick={() => void salvarRespostas()}>Salvar respostas</button><button type="button" className="btn btn-principal" disabled={busy} onClick={() => void montarPerfil()}>Montar meu currículo</button></div>
      </>}

      {etapa === 'revisao' && <>
        <div className="cabeca-tela"><h2>Revise o seu currículo reescrito</h2><p className="lead">Tudo aqui é editável: contato, cargos, datas, atividades, formação, cursos e idiomas. Campos marcados em amarelo têm uma dica do que ajustar e o formato ideal. Itens com selo verde usaram uma resposta sua. Trechos com [CONFIRMAR] têm um número que o sistema não conseguiu comprovar: corrija ou apague.</p></div>
        {!perfil ? <section className="painel"><p>O perfil mestre ainda não foi montado.</p><button className="btn btn-principal" disabled={busy} onClick={() => void montarPerfil()}>Montar perfil mestre</button></section> : <div className="profile-workspace"><ProfileEditor profile={perfil} onChange={setPerfil} disabled={busy} /><div className="rodape-acao profile-actions"><p className="status-fundo">{status || `Versão ${perfil.versao || 'nova'}${perfil.editado_pelo_candidato ? ' (editada por você)' : ''}`}</p><button className="btn btn-secundario" disabled={busy} onClick={() => void salvarPerfil()}>Salvar revisão</button><button className="btn btn-principal" disabled={busy} onClick={() => void auditar()}>Conferir com a IA</button></div></div>}
      </>}

      {etapa === 'conferencia' && <>
        <div className={`selo-final ${prontoParaTriagens ? 'ok' : 'ajustar'}`}>
          <span className="icone" aria-hidden="true">{prontoParaTriagens ? '✓' : '!'}</span>
          <div className="selo-corpo">
            <h2>{prontoParaTriagens ? 'Pronto para as triagens' : !conferencia ? 'Perfil revisado. Falta a conferência final.' : ajustesConferencia.length ? `${ajustesConferencia.length} ajuste(s) antes de baixar` : melhoriasConferencia.length ? `${melhoriasConferencia.length} melhoria(s) opcional(is)` : 'Conferência concluída com pontos de atenção'}</h2>
            <p>{prontoParaTriagens ? 'A conferência de conteúdo foi concluída sem bloqueios. Você já pode escolher o modelo.' : !conferencia ? 'A auditoria do perfil terminou. Execute a conferência final para verificar as informações antes de gerar os arquivos.' : ajustesConferencia.length ? 'Há pontos que merecem atenção antes de usar o currículo. Você pode baixar assim mesmo, mas vale revisar.' : 'Não há bloqueios listados; restam apenas alertas opcionais para a leitura do recrutador.'}</p>
            {!!ajustesConferencia.length && <ul className="selo-lista">{ajustesConferencia.slice(0, 6).map((item: AnyObj, i: number) => <li key={`${item.titulo}-${i}`}><span className={`grav ${item.gravidade || 'importante'}`}>{item.gravidade === 'recrutador' ? 'Melhoria opcional' : `Ajuste · ${ROTULO_GRAVIDADE[item.gravidade] || 'Importante'}`}</span><span className="titulo-item">{item.titulo}</span><span className="links"><button type="button" className="btn-link" onClick={() => setEtapa('revisao')}>Ajustar na revisão ›</button></span></li>)}</ul>}
            {melhoriasConferencia.length > 0 && <details className="selo-melhorias"><summary>{melhoriasConferencia.length} melhoria(s) opcional(is) para o recrutador</summary><ul className="selo-lista">{melhoriasConferencia.map((p: AnyObj, i: number) => <li key={`${p.texto}-${i}`}><span className="grav recrutador">Melhoria opcional</span><span className="titulo-item">{p.texto}</span></li>)}</ul></details>}
            {pendenciasPerfil.length > 0 && <p className="nota">O perfil ainda tem {pendenciasPerfil.length} pendência(s) aberta(s). Confira a lista na revisão.</p>}
          </div>
        </div>

        <div className="painel-numeros">
          <section className="cartao-numero">
            <span className="rotulo-num">Pontos do primeiro diagnóstico</span>
            <div className={`grande ${pontosPendentes.length ? 'ambar' : 'verde'}`}>{pontosResolvidos} <small>de {problemas.length} tratados</small></div>
            <div className="barra" aria-hidden="true"><span style={{ width: `${problemas.length ? Math.round(pontosResolvidos / problemas.length * 100) : 100}%` }} /></div>
            <p className="sub">{pontosAuto.length} automaticamente, {pontosRespondidos} com suas respostas, {pontosMantidos} mantidos por sua decisão{pontosPendentes.length ? ` e ${pontosPendentes.length} pendente(s)` : ''}.</p>
          </section>
          <section className="cartao-numero">
            <span className="rotulo-num">Conferência final do conteúdo</span>
            <div className={`grande ${conferencia ? (itensConfPendentes ? 'ambar' : 'verde') : ''}`}>{conferencia ? <>{itensConfOk} <small>de {itensConferencia.length} itens conferidos</small></> : '—'}</div>
            {conferencia && <><div className="barra" aria-hidden="true"><span style={{ width: `${itensConferencia.length ? Math.round(itensConfOk / itensConferencia.length * 100) : (conferencia.pronto ? 100 : 0)}%` }} /></div><div className="gravidades"><span className={itensConfPendentes ? 'critico' : 'zero'}>Pendentes: {itensConfPendentes}</span><span className={itensConfAviso ? 'importante' : 'zero'}>Alertas: {itensConfAviso}</span><span className={!itensConfPendentes && !itensConfAviso ? 'zero' : 'recrutador'}>OK: {itensConfOk}</span></div></>}
            {!conferencia && <p className="sub">A conferência final ainda não foi executada.</p>}
          </section>
        </div>

        <section className="bloco-final bloco-analise">
          <h3>Auditoria do perfil</h3><p className="sub">Problemas encontrados na leitura do conteúdo estruturado do currículo. As correções automáticas suportadas já foram aplicadas.</p>
          <p className="gravidades"><span className="zero">{Number(auditoria?.aplicadas || 0)} correção(ões) automática(s) aplicada(s)</span><span className={(auditoria?.pendentes || 0) ? 'importante' : 'zero'}>{Number(auditoria?.pendentes || 0)} pendência(s) gerada(s)</span></p>
          {problemasAuditoria.length ? <ul className="itens-final">{problemasAuditoria.map((p: AnyObj, i: number) => <li className={`item-final ${p.gravidade || 'importante'}`} key={p.id || i}><strong>{ROTULO_GRAVIDADE[p.gravidade] || 'Ponto de atenção'}: {p.titulo}</strong>{p.por_que && <p>{p.por_que}</p>}{p.como_corrigir && <p><strong>Como corrigir:</strong> {p.como_corrigir}</p>}</li>)}</ul> : <p className="tudo-certo">Nenhum problema adicional identificado na auditoria do perfil.</p>}
          {pendenciasPerfil.length > 0 && <details className="mantidos"><summary>Pendências ainda abertas ({pendenciasPerfil.length})</summary><ul>{pendenciasPerfil.map((p: AnyObj, i: number) => <li key={i}>{p.titulo}</li>)}</ul><button type="button" className="btn-link" onClick={() => setEtapa('revisao')}>Voltar à revisão ›</button></details>}
        </section>

        <div className="fechamento">
          <section className="bloco-final"><h3>Pendências do diagnóstico</h3><p className="sub">Pontos do primeiro diagnóstico que ainda dependem de uma informação ou decisão sua.</p>
            {pontosPendentes.length ? <ul className="itens-final">{pontosPendentes.map((p: AnyObj) => <li className={`item-final ${p.gravidade || 'importante'}`} key={p.id}><strong>{ROTULO_GRAVIDADE[p.gravidade] || 'Ponto de atenção'}: {p.titulo}</strong>{p.por_que && <p>{p.por_que}</p>}{p.como_corrigir && <p>{p.como_corrigir}</p>}<div className="acoes"><button type="button" className="btn-link" onClick={() => setEtapa('perguntas')}>Voltar às perguntas ›</button></div></li>)}</ul> : <p className="tudo-certo">Nenhuma. Todos os pontos do primeiro diagnóstico foram tratados.</p>}
          </section>
          <section className="bloco-final"><h3>Conferência final de conteúdo</h3><p className="sub">Validação do perfil antes da geração dos arquivos.</p>
            {!conferencia ? <><p>A conferência ainda não foi executada.</p><button type="button" className="btn btn-principal" disabled={busy} onClick={() => void conferir()}>Conferir conteúdo com IA</button></> : <>
              <p className={conferencia.pronto && !temBloqueiosConferencia ? 'tudo-certo' : 'aviso-bloco'}>{conferencia.pronto && !temBloqueiosConferencia ? 'Conteúdo aprovado pela conferência.' : ajustesConferencia.length ? 'A conferência encontrou itens para atenção.' : 'A conferência não apontou bloqueios, mas recomenda observar os alertas.'}</p>
              {(conferencia.itens || []).length > 0 && <ul className="itens-final">{conferencia.itens.map((item: AnyObj, i: number) => <li className={`item-final ${item.ok ? 'recrutador' : item.aviso ? 'importante' : 'critico'}`} key={i}><strong>{item.ok ? 'Conferido' : item.aviso ? 'Atenção' : 'Pendente'}: {item.texto}</strong></li>)}</ul>}
              {(conferencia.observacoes || []).length > 0 && <ul>{conferencia.observacoes.map((o: string, i: number) => <li key={i}>{o}</li>)}</ul>}
              <button type="button" className="btn btn-secundario" disabled={busy} onClick={() => void conferir()}>Executar conferência novamente</button>
            </>}
          </section>
        </div>
        <p className="nota">Limitação desta migração: a conferência atual valida o conteúdo estruturado do perfil. A leitura dos PDFs finais por cada modelo, a comparação antes/depois e o seletor de leitura entre Clássico e Moderno, que existiam no Apps Script, ainda não foram migrados. Por isso, os indicadores acima não simulam essa leitura.</p>
        <div className="rodape-acao"><button type="button" className="btn btn-secundario" onClick={() => setEtapa('revisao')}>Voltar à revisão</button><button type="button" className="btn btn-principal" disabled={!conferencia || busy} onClick={() => setEtapa('download')}>Escolher modelo e baixar</button></div>
      </>}

      {etapa === 'download' && <>
        <div className="cabeca-tela"><h2>Escolha o modelo e baixe o seu currículo</h2><p className="lead">Os dois modelos mantêm uma coluna só, títulos padrão e texto selecionável. A diferença é o visual.</p></div>
        <div className="modelos" role="radiogroup" aria-label="Modelo do currículo">
          {(['classico', 'moderno'] as Modelo[]).map((modelo) => <label className="modelo" key={modelo}>
            <input type="radio" name="modelo" value={modelo} checked={modeloSelecionado === modelo} onChange={() => setModeloSelecionado(modelo)} />
            <ResumePreview perfil={perfil || {}} modelo={modelo} />
            <span className={`status-modelo ${arquivosGerados[modelo] ? 'ok' : ''}`}>{arquivosGerados[modelo] ? 'Arquivos gerados e prontos para baixar' : 'Prévia do modelo'}</span>
            <strong>{modelo === 'classico' ? 'Clássico' : 'Moderno'}</strong>
            <small>{modelo === 'classico' ? 'Títulos em caixa alta e uma linha separando as seções. Sóbrio, combina com qualquer área.' : 'Títulos em azul e mais espaço entre as seções. Leitura mais leve.'}</small>
            <button type="button" className="btn-link ver-maior" onClick={(e) => { e.preventDefault(); setModeloModal(modelo); }}>Ver em tamanho real</button>
            {arquivosGerados[modelo] && <div className="links-arquivos"><a className="btn btn-secundario" href={arquivosGerados[modelo].pdf_url} target="_blank" rel="noreferrer">Baixar PDF</a><a className="btn btn-secundario" href={arquivosGerados[modelo].docx_url} target="_blank" rel="noreferrer">Baixar Word</a></div>}
          </label>)}
        </div>
        <p className="status-fundo">{status || 'Selecione um modelo para gerar os arquivos em PDF e Word.'}</p>
        {erro && <p className="erro" role="alert">{erro}</p>}
        <div className="rodape-acao"><button type="button" className="btn btn-secundario" onClick={() => setEtapa('conferencia')}>Voltar à conferência</button><button type="button" className="btn btn-principal" disabled={busy || !perfil} onClick={() => void gerar(modeloSelecionado)}>{busy ? 'Gerando...' : `Gerar PDF e Word · ${modeloSelecionado === 'classico' ? 'Clássico' : 'Moderno'}`}</button></div>
      </>}

      {etapa !== 'diagnostico' && etapa !== 'download' && erro && etapa !== 'envio' && <p className="erro" role="alert">{erro}</p>}
    </main>

    {busy && <div className="carregando" role="status" aria-live="polite"><div className="carregando-caixa"><h3>{loader.titulo}</h3>{mostrarTempo && <p className="tempo-estimado"><strong>A primeira leitura pode levar alguns minutos.</strong> A IA está avaliando o currículo item por item. A revisão complementar continua em segundo plano assim que o diagnóstico inicial estiver pronto.<span className="decorrido">Tempo até agora: {tempoFormatado}</span></p>}<ol className="passos">{loader.passos.map((passo, i) => <li className={i < loader.ativo ? 'feito' : i === loader.ativo ? 'atual' : ''} key={`${passo}-${i}`}>{passo}</li>)}</ol></div></div>}
    {aviso && <div className="aviso" role="status" aria-live="polite">{aviso}</div>}
    {modeloModal && <div className="janela" onMouseDown={(e) => { if (e.target === e.currentTarget) setModeloModal(null); }}>
      <div className="janela-caixa" role="dialog" aria-modal="true" aria-labelledby="janela-titulo"><div className="janela-barra"><strong id="janela-titulo">Modelo {modeloModal === 'classico' ? 'Clássico' : 'Moderno'}</strong><div><button type="button" className="btn btn-principal" onClick={() => { setModeloSelecionado(modeloModal); setModeloModal(null); }}>Usar este modelo</button><button type="button" className="btn btn-secundario" onClick={() => setModeloModal(null)}>Fechar</button></div></div><div className="janela-corpo"><ResumePreview perfil={perfil || {}} modelo={modeloModal} expanded /></div></div>
    </div>}
  </></RequireAuth>;
}
