'use client';

import React, { useMemo } from 'react';

type Obj = Record<string, any>;
type Props = { profile: Obj; onChange: (profile: Obj) => void; disabled?: boolean };
type Pending = { texto: string; ideal: string; alvo: string; index: number };

function nomeBonito(value: string) {
  return String(value || '').toLowerCase().replace(/(^|\s)(\S)/g, (_m, a, b) => a + b.toUpperCase()).replace(/\s(De|Da|Do|Dos|Das|E)\s/g, (m) => m.toLowerCase());
}
function guessTarget(text: string, profile: Obj) {
  if (/resumo/i.test(text)) return 'resumo';
  if (/t[íi]tulo/i.test(text)) return 'titulo';
  if (/compet[êe]nc|habilidade|ferramenta/i.test(text)) return 'competencias';
  if (/idioma|ingl[êe]s|espanhol/i.test(text)) return 'idiomas';
  if (/forma[çc][ãa]o|gradua|faculdade/i.test(text)) return 'formacao';
  if (/curso|certifica/i.test(text)) return 'cursos';
  if (/e-?mail|telefone|linkedin|contato/i.test(text)) return 'contato';
  const index = (profile.experiencias || []).findIndex((e: Obj) => (e.empresa && text.includes(e.empresa)) || (e.cargo && text.includes(e.cargo)));
  return index >= 0 ? `exp-${index}` : '';
}

function Field({ label, value, onChange, type = 'text', multiline = false, rows = 2, disabled = false }: {
  label: string; value: any; onChange: (value: string) => void; type?: string; multiline?: boolean; rows?: number; disabled?: boolean;
}) {
  return <label className="mini-campo"><span>{label}</span>{multiline
    ? <textarea rows={rows} value={String(value ?? '')} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
    : <input type={type} value={String(value ?? '')} disabled={disabled} onChange={(e) => onChange(e.target.value)} />}</label>;
}

export default function ProfileEditor({ profile, onChange, disabled = false }: Props) {
  const contato = profile.contato || {};
  const pendencias: Pending[] = useMemo(() => (profile.pendencias || []).map((item: any, index: number) => {
    const p = typeof item === 'object' && item ? item : { texto: String(item || '') };
    const texto = String(p.texto || '').trim();
    return { texto, ideal: String(p.ideal || ''), alvo: String(p.alvo || guessTarget(`${texto} ${p.ideal || ''}`, profile)), index };
  }).filter((p: Pending) => p.texto && !/^(Informações|Linhas) grudadas/i.test(p.texto)), [profile.pendencias, profile.experiencias]);

  const patch = (key: string, value: any) => onChange({ ...profile, [key]: value });
  const patchContact = (key: string, value: string) => patch('contato', { ...(profile.contato || {}), [key]: value });
  const patchExp = (i: number, key: string, value: any) => patch('experiencias', (profile.experiencias || []).map((x: Obj, k: number) => k === i ? { ...x, [key]: value } : x));
  const patchBullet = (i: number, j: number, value: string) => {
    const exps = [...(profile.experiencias || [])]; const exp = { ...exps[i] };
    exp.bullets = (exp.bullets || []).map((b: any, k: number) => k === j ? (typeof b === 'string' ? value : { ...b, texto: value }) : b);
    exps[i] = exp; patch('experiencias', exps);
  };
  const patchList = (key: string, i: number, field: string, value: any) => patch(key, (profile[key] || []).map((x: Obj, k: number) => k === i ? { ...x, [field]: value } : x));
  const remove = (key: string, i: number) => patch(key, (profile[key] || []).filter((_: any, k: number) => k !== i));
  const add = (key: string, item: Obj) => patch(key, [...(profile[key] || []), item]);
  const removePending = (index: number) => patch('pendencias', (profile.pendencias || []).filter((_: any, i: number) => i !== index));
  const getPendencias = (target: string) => pendencias.filter((p) => p.alvo === target);
  const classAlvo = (target: string) => getPendencias(target).length ? 'alvo-nota precisa-ajuste' : 'alvo-nota';
  const inlineNotes = (target: string) => getPendencias(target).map((p) => <div className="nota-ajuste" key={p.index}><span className="icone-pend" aria-hidden="true">!</span><div><p><strong>Ajuste aqui:</strong> {p.texto}</p>{p.ideal && <p className="ideal-inline"><strong>O ideal:</strong> {p.ideal}</p>}<button type="button" className="btn-link" disabled={disabled} onClick={() => removePending(p.index)}>Já resolvi</button></div></div>);
  const scrollToTarget = (target: string) => {
    if (!target) return;
    const el = document.querySelector<HTMLElement>(`[data-alvo="${target}"]`) || document.querySelector<HTMLElement>(`[data-alvo="${target.replace(/-b\d+$/, '')}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (el) { el.classList.remove('piscar'); void el.offsetWidth; el.classList.add('piscar'); window.setTimeout(() => el.classList.remove('piscar'), 2500); }
    const field = el?.querySelector('input, textarea') as HTMLElement | null;
    field?.focus({ preventScroll: true });
  };

  const SIGLAS: Record<string, string> = { NPS: 'Net Promoter Score', CRM: 'Customer Relationship Management', KPI: 'Key Performance Indicator', OKR: 'Objectives and Key Results', SLA: 'Service Level Agreement', ERP: 'Enterprise Resource Planning', BI: 'Business Intelligence', CS: 'Customer Success', CX: 'Customer Experience', RH: 'Recursos Humanos' };
  const prontidao = useMemo(() => {
    const itens: { ok: boolean; texto: string; detalhe: string; aviso?: boolean }[] = [];
    const addItem = (ok: boolean, texto: string, detalhe: string, aviso = false) => itens.push({ ok, texto, detalhe: ok ? '' : detalhe, aviso });
    const c = profile.contato || {};
    const temEmail = /[^@\s]+@[^@\s]+\.[^@\s]+/.test(c.email || '');
    const temTelefone = /\d{4}[-\s]?\d{4}/.test(c.telefone || '');
    addItem(temEmail && temTelefone, 'Contato com e-mail e telefone', `Falta ${[!temEmail ? 'e-mail' : '', !temTelefone ? 'telefone' : ''].filter(Boolean).join(' e ')}. Preencha no contato, no topo do currículo.`);
    const titulo = String(profile.titulo || '').trim();
    addItem(!!titulo && titulo.length <= 60, 'Título curto, com uma área principal', titulo ? `O título tem ${titulo.length} caracteres. Deixe em até 60.` : 'Preencha o título.');
    addItem(String(profile.resumo || '').trim().length >= 120, 'Resumo profissional preenchido', 'Escreva pelo menos 2 ou 3 frases no resumo.');
    addItem((profile.competencias || []).length > 0, 'Competências preenchidas', 'Inclua pelo menos um grupo de competências.');
    const experiencias = profile.experiencias || [];
    const semData = experiencias.filter((e: Obj) => !/^\d{2}\/\d{4}$/.test(e.inicio || '') || !(/^\d{2}\/\d{4}$/.test(e.fim || '') || /^atual$/i.test(e.fim || '')));
    addItem(!semData.length, 'Datas de todos os cargos no formato MM/AAAA', `${semData.map((e: Obj) => e.cargo).join(', ')}: preencha as datas no formato MM/AAAA, no cabeçalho do cargo.`);
    const semAtividade = experiencias.filter((e: Obj) => !(e.bullets || []).some((b: any) => String(typeof b === 'string' ? b : b.texto || '').trim()));
    addItem(!semAtividade.length, 'Todos os cargos com atividades', `Sem atividades: ${semAtividade.map((e: Obj) => e.cargo).join(', ')}.`);
    const textoTodo = [profile.titulo, profile.resumo].concat((profile.competencias || []).map((g: Obj) => `${g.grupo} ${(g.itens || []).join(' ')}`)).concat(experiencias.map((e: Obj) => (e.bullets || []).map((b: any) => typeof b === 'string' ? b : b.texto).join(' '))).join(' ');
    const semFerramentas = textoTodo.replace(/Power\s+BI|Salesforce\s+CRM|Dynamics\s+CRM|SAP\s+ERP/gi, '');
    const siglas = Object.keys(SIGLAS).filter((s) => new RegExp(`\\b${s}\\b`).test(semFerramentas) && !textoTodo.toLowerCase().includes(SIGLAS[s].toLowerCase()));
    addItem(!siglas.length, 'Siglas com o nome por extenso', `${siglas.map((s) => `${s} → ${SIGLAS[s]} (${s})`).join('; ')}. Escreva por extenso na primeira vez.`, true);
    const temConfirmar = /\[CONFIRMAR\]/i.test(textoTodo) || /\[PREENCHER\]/i.test(textoTodo);
    addItem(!temConfirmar, 'Nenhum [CONFIRMAR] ou [PREENCHER] pendente', 'Corrija ou apague os trechos destacados em amarelo.');
    return itens;
  }, [profile]);
  const prontidaoOk = prontidao.filter((i) => i.ok).length;

  const configLinhas: Record<string, { titulo: string; addLabel: string; empty: Obj; fields: [string, string, string?][] }> = {
    formacao: { titulo: 'Formação acadêmica', addLabel: 'Adicionar formação', empty: { curso: '', instituicao: '', inicio: '', fim: '' }, fields: [['curso', 'Curso'], ['instituicao', 'Instituição'], ['inicio', 'Início'], ['fim', 'Fim']] },
    cursos: { titulo: 'Cursos', addLabel: 'Adicionar curso', empty: { nome: '', instituicao: '', ano: '' }, fields: [['nome', 'Curso'], ['instituicao', 'Instituição'], ['ano', 'Ano']] },
    idiomas: { titulo: 'Idiomas', addLabel: 'Adicionar idioma', empty: { idioma: '', nivel: '' }, fields: [['idioma', 'Idioma'], ['nivel', 'Nível']] },
  };

  return <div className="revisao-grade">
    <div>
      <section className={`pendencias${pendencias.length ? '' : ' ok'}`}>
        {pendencias.length ? <><h3><span className="icone-pend" aria-hidden="true">!</span> O que ainda pode melhorar ({pendencias.length})</h3><p className="sub">Cada item também está marcado em amarelo no campo onde você ajusta. Ajustou ou decidiu não mexer? Clique em “Já resolvi”.</p><ul className="lista-pend">{pendencias.map((p) => <li key={p.index}><span className="icone-pend" aria-hidden="true">!</span><div><p>{p.texto}</p>{p.ideal && <div className="ideal"><strong>O ideal</strong>{p.ideal}</div>}<div className="acoes">{p.alvo && <button type="button" className="btn-link" onClick={() => scrollToTarget(p.alvo)}>Ir para o campo ›</button>}<button type="button" className="btn-link" disabled={disabled} onClick={() => removePending(p.index)}>Já resolvi</button></div></div></li>)}</ul></> : <><h3><span className="icone-ok" aria-hidden="true">✓</span> Nenhum ajuste pendente</h3><p className="sub">Todos os pontos do diagnóstico foram respondidos ou mantidos. Revise o texto à vontade e clique em “Conferir com a IA”.</p></>}
      </section>

      <section className="folha">
        <div className="bloco">
          <div className="nome">{nomeBonito(profile.nome)}</div>
          <div className={`${classAlvo('contato')}`} data-alvo="contato"><div className="grade-contato">
            <Field label="Cidade" value={contato.cidade} onChange={(v) => patchContact('cidade', v)} disabled={disabled} />
            <Field label="Telefone" value={contato.telefone} onChange={(v) => patchContact('telefone', v)} type="tel" disabled={disabled} />
            <Field label="E-mail" value={contato.email} onChange={(v) => patchContact('email', v)} type="email" disabled={disabled} />
            <Field label="LinkedIn" value={contato.linkedin} onChange={(v) => patchContact('linkedin', v)} disabled={disabled} />
          </div>{inlineNotes('contato')}</div>
          <div className={classAlvo('titulo')} data-alvo="titulo"><label className="campo"><span>Título</span><input className="titulo" value={String(profile.titulo || '')} disabled={disabled} onChange={(e) => patch('titulo', e.target.value)} /></label>{inlineNotes('titulo')}</div>
        </div>

        <div className={`${classAlvo('resumo')} bloco`} data-alvo="resumo"><h3>Resumo profissional</h3><Field label="" value={profile.resumo} onChange={(v) => patch('resumo', v)} multiline rows={5} disabled={disabled} />{inlineNotes('resumo')}</div>

        <div className={`${classAlvo('competencias')} bloco`} data-alvo="competencias"><h3>Competências</h3><div id="ed-competencias">{(profile.competencias || []).map((g: Obj, i: number) => <div className="grupo-comp" key={i}><input aria-label="Nome do grupo" placeholder="Grupo" value={g.grupo || ''} disabled={disabled} onChange={(e) => patchList('competencias', i, 'grupo', e.target.value)} /><input aria-label="Itens, separados por vírgula" placeholder="Itens, separados por vírgula" value={(g.itens || []).join(', ')} disabled={disabled} onChange={(e) => patchList('competencias', i, 'itens', e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))} /><button type="button" className="btn-icone remover-grupo" aria-label="Remover grupo" disabled={disabled} onClick={() => remove('competencias', i)}>×</button></div>)}</div><button type="button" className="btn-link" disabled={disabled} onClick={() => add('competencias', { grupo: '', itens: [] })}>Adicionar grupo</button>{inlineNotes('competencias')}</div>

        <div className="bloco"><h3>Experiência profissional</h3>{(profile.experiencias || []).map((e: Obj, i: number) => {
          const outrosNaEmpresa = (profile.experiencias || []).filter((x: Obj, k: number) => k !== i && x.empresa === e.empresa).length;
          return <div className="cargo" data-i={i} key={i}>
            <div className={`${classAlvo(`exp-${i}`)} cargo-cabeca`} data-alvo={`exp-${i}`}><div className="grade-cargo">
              <Field label="Cargo" value={e.cargo} onChange={(v) => patchExp(i, 'cargo', v)} disabled={disabled} />
              <Field label="Empresa" value={e.empresa} onChange={(v) => patchExp(i, 'empresa', v)} disabled={disabled} />
              <Field label="Início (MM/AAAA)" value={e.inicio} onChange={(v) => patchExp(i, 'inicio', v)} disabled={disabled} />
              <Field label="Fim (MM/AAAA ou Atual)" value={e.fim} onChange={(v) => patchExp(i, 'fim', v)} disabled={disabled} />
            </div>
            {(outrosNaEmpresa || e.promocao) ? <label className="marcar-promocao"><input type="checkbox" checked={!!e.promocao} disabled={disabled} onChange={(ev) => patchExp(i, 'promocao', ev.target.checked)} /><span>Cheguei a este cargo por <strong>promoção interna</strong> (aparece ao lado da empresa no currículo)</span></label> : null}{inlineNotes(`exp-${i}`)}</div>
            <div className="bullets">{(e.bullets || []).map((b: any, j: number) => <div className={`bullet${/\[CONFIRMAR\]/i.test(typeof b === 'string' ? b : b.texto || '') ? ' alerta' : ''}`} key={j} data-origem={typeof b === 'string' ? 'curriculo' : b.origem || 'curriculo'}><div className="alvo-nota" data-alvo={`exp-${i}-b${j}`}>{typeof b !== 'string' && b.origem === 'confirmado' && <span className="selo">Usou uma resposta sua</span>}<textarea rows={2} aria-label={`Atividade ${j + 1}`} value={typeof b === 'string' ? b : b.texto || ''} disabled={disabled} onChange={(ev) => patchBullet(i, j, ev.target.value)} />{inlineNotes(`exp-${i}-b${j}`)}</div><button type="button" className="btn-icone remover-bullet" aria-label="Remover atividade" disabled={disabled} onClick={() => patchExp(i, 'bullets', (e.bullets || []).filter((_: any, k: number) => k !== j))}>×</button></div>)}</div>
            <button type="button" className="btn-link add-bullet" disabled={disabled} onClick={() => patchExp(i, 'bullets', [...(e.bullets || []), { texto: '', origem: 'candidato' }])}>Adicionar atividade</button>
          </div>;
        })}
        {!((profile.experiencias || []).length) && <p className="mais">Nenhuma experiência identificada.</p>}
        <button type="button" className="btn-link" disabled={disabled} onClick={() => add('experiencias', { empresa: '', cargo: '', inicio: '', fim: '', promocao: false, bullets: [] })}>Adicionar experiência</button>
        </div>

        {(Object.entries(configLinhas) as [string, typeof configLinhas.formacao][]).map(([key, config]) => <div className={`${classAlvo(key)} bloco`} data-alvo={key} key={key}><h3>{config.titulo}</h3><div className="linhas" id={`ed-${key}`}>{(profile[key] || []).map((x: Obj, i: number) => <div className={`linha-ed ${key}`} key={i}>{config.fields.map(([field, label, type]) => <Field key={field} label={label} type={type || 'text'} value={x[field]} disabled={disabled} onChange={(v) => patchList(key, i, field, v)} />)}<button type="button" className="btn-icone remover-linha" aria-label="Remover" disabled={disabled} onClick={() => remove(key, i)}>×</button></div>)}</div><button type="button" className="btn-link add-linha" disabled={disabled} onClick={() => add(key, config.empty)}>{config.addLabel}</button>{inlineNotes(key)}</div>)}
      </section>
    </div>

    <aside className="prontidao" aria-live="polite"><h3>Pronto para o robô</h3><p className="placar">{prontidaoOk} de {prontidao.length} itens em ordem{prontidaoOk === prontidao.length ? '. Pode gerar.' : ''}</p><ul>{prontidao.map((item, i) => <li className={item.ok ? '' : item.aviso ? 'aviso-item' : 'falta'} key={i}><span>{item.texto}{item.detalhe && <small>{item.detalhe}</small>}</span></li>)}</ul><p className="garantido">Uma coluna, títulos padrão e texto selecionável ficam garantidos pelo modelo do currículo.</p></aside>
  </div>;
}
