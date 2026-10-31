import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle, LevelFormat } from 'docx';
import PDFDocument from 'pdfkit';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Obj = Record<string, any>;
type Modelo = {
  nome: string; fonte: string; corpo: number; nomeTam: number; secaoTam: number;
  maiusculas: boolean; linha: boolean; tinta: string; suave: string;
  corSecao: string; margem: number; antesSecao: number;
};

// Valores copiados de MODELOS_CV em Gerador.gs.
const MODELOS: Record<string, Modelo> = {
  classico: { nome: 'Clássico', fonte: 'Arial', corpo: 10.5, nomeTam: 18, secaoTam: 11, maiusculas: true, linha: true, tinta: '#000000', suave: '#3A3A3A', corSecao: '#000000', margem: 50, antesSecao: 12 },
  moderno: { nome: 'Moderno', fonte: 'Roboto', corpo: 10.5, nomeTam: 22, secaoTam: 12, maiusculas: false, linha: false, tinta: '#1C1C1C', suave: '#4A4A4A', corSecao: '#1F3A68', margem: 56, antesSecao: 16 },
};

function txt(v: any): string { return String(v ?? '').trim(); }
function bullets(e: Obj): string[] { return (e.bullets || []).map((b: any) => typeof b === 'string' ? txt(b) : txt(b?.texto)).filter(Boolean); }
function nomeBonito(v: any): string { return txt(v).replace(/\s+/g, ' '); }

function pdfBuffer(p: Obj, modelo: string): Promise<Buffer> {
  const est = MODELOS[modelo];
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: est.margem, bottom: est.margem, left: est.margem, right: est.margem }, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // PDFKit usa Helvetica como substituta métrica compatível com Arial/Roboto quando as fontes não estão embutidas.
    const regular = 'Helvetica';
    const bold = 'Helvetica-Bold';
    const width = 595.28 - est.margem * 2;
    const section = (label: string) => {
      doc.moveDown(0.75);
      const heading = est.maiusculas ? label.toUpperCase() : label;
      doc.font(bold).fontSize(est.secaoTam).fillColor(est.corSecao).text(heading, { continued: false });
      if (est.linha) {
        const y = doc.y + 3;
        doc.moveTo(est.margem, y).lineTo(est.margem + width, y).lineWidth(0.6).strokeColor('#000000').stroke();
        doc.moveDown(0.4);
      } else {
        doc.moveDown(0.45);
      }
    };
    const para = (value: string, opts: {font?:string;size?:number;color?:string;before?:number;after?:number;lineGap?:number;indent?:number;align?:'left'|'center'} = {}) => {
      if (!value) return;
      if (opts.before) doc.moveDown(opts.before / 12);
      doc.font(opts.font || regular).fontSize(opts.size || est.corpo).fillColor(opts.color || est.tinta)
        .text(value, { width, lineGap: opts.lineGap ?? 1.5, indent: opts.indent || 0, align: opts.align || 'left' });
      if (opts.after !== 0) doc.moveDown((opts.after ?? 3) / 12);
    };
    const item = (value: string) => para(`•  ${value}`, { size: est.corpo, indent: 7, after: 3, lineGap: 1.3 });

    para(nomeBonito(p.nome) || 'Nome do candidato', { font: bold, size: est.nomeTam, align: 'left', after: 6 });
    if (txt(p.titulo)) para(txt(p.titulo), { font: bold, size: est.corpo + 1.5, color: est.corSecao, align: 'left', after: 6 });
    const c = p.contato || {};
    const contato = [c.cidade, c.telefone, c.email, c.linkedin].map(txt).filter(Boolean).join(' | ');
    if (contato) para(contato, { color: est.suave, size: 9, align: 'left', after: 10 });

    if (txt(p.resumo)) { section('Resumo Profissional'); para(txt(p.resumo), { lineGap: 2, after: 4 }); }
    if ((p.competencias || []).length) {
      section('Competências');
      (p.competencias || []).forEach((g: Obj) => { const value = `${txt(g.grupo)}: ${(g.itens || []).map(txt).filter(Boolean).join(', ')}`; if (value.trim() !== ':') item(value); });
    }
    if ((p.experiencias || []).length) {
      section('Experiência Profissional');
      (p.experiencias || []).forEach((e: Obj, i: number) => {
        const anterior = p.experiencias[i - 1];
        const before = i === 0 ? 8 : (anterior && anterior.empresa === e.empresa ? 10 : 16);
        para(txt(e.cargo), { font: bold, size: est.corpo + 0.5, before, after: 2 });
        const periodo = [txt(e.inicio), txt(e.fim)].filter(Boolean).join(' – ');
        const linha = [txt(e.empresa), periodo].filter(Boolean).join(' | ');
        if (linha || e.promocao) para(linha + (e.promocao ? `${linha ? ' | ' : ''}Promoção interna` : ''), { color: est.suave, after: 6 });
        bullets(e).forEach(item);
      });
    }
    if ((p.formacao || []).length) {
      section('Formação Acadêmica');
      (p.formacao || []).forEach((f: Obj, i: number) => {
        para(txt(f.curso), { font: bold, before: i === 0 ? 8 : 10, after: 2 });
        const periodo = [txt(f.inicio), txt(f.fim)].filter(Boolean).join(' – ');
        const linha = [txt(f.instituicao), periodo].filter(Boolean).join(' | ');
        if (linha) para(linha, { color: est.suave, after: 2 });
      });
    }
    if ((p.cursos || []).length) { section('Cursos'); (p.cursos || []).forEach((k: Obj, i: number) => para([k.nome,k.instituicao,k.ano].map(txt).filter(Boolean).join(' | '), { before: i === 0 ? 8 : 4, after: 3 })); }
    if ((p.idiomas || []).length) { section('Idiomas'); (p.idiomas || []).forEach((k: Obj, i: number) => para([k.idioma,k.nivel].map(txt).filter(Boolean).join(': '), { before: i === 0 ? 8 : 4, after: 3 })); }
    doc.end();
  });
}

function docxBuffer(p: Obj, modelo: string): Promise<Buffer> {
  const est = MODELOS[modelo];
  const children: Paragraph[] = [];
  const align = AlignmentType.LEFT;
  const addPara = (text: string, options: Obj = {}) => children.push(new Paragraph({ children: [new TextRun({ text, font: est.fonte, size: Math.round((options.size || est.corpo) * 2), bold: !!options.bold, color: String(options.color || est.tinta).replace('#','') })], alignment: options.align || AlignmentType.LEFT, spacing: { before: Math.round((options.before || 0) * 20), after: Math.round((options.after ?? 3) * 20), line: 276 } }));
  const section = (label: string) => {
    const title = est.maiusculas ? label.toUpperCase() : label;
    children.push(new Paragraph({ children: [new TextRun({ text: title, font: est.fonte, size: Math.round(est.secaoTam * 2), bold: true, color: est.corSecao.replace('#','') })], spacing: { before: (est.antesSecao + 10) * 20, after: (est.linha ? 2 : 8) * 20 }, ...(est.linha ? { border: { bottom: { color: '000000', space: 1, style: BorderStyle.SINGLE, size: 4 } } } : {}) }));
  };
  const item = (value: string) => children.push(new Paragraph({ text: value, numbering: { reference: 'bullet-list', level: 0 }, spacing: { after: 60, line: 276 }, style: 'Normal' }));

  addPara(nomeBonito(p.nome) || 'Nome do candidato', { size: est.nomeTam, bold: true, align, after: 6 });
  if (txt(p.titulo)) addPara(txt(p.titulo), { size: est.corpo + 1.5, bold: true, color: est.corSecao, align, after: 6 });
  const c = p.contato || {};
  const contato = [c.cidade,c.telefone,c.email,c.linkedin].map(txt).filter(Boolean).join(' | ');
  if (contato) addPara(contato, { size: 9, color: est.suave, align, after: 10 });
  if (txt(p.resumo)) { section('Resumo Profissional'); addPara(txt(p.resumo), { after: 4 }); }
  if ((p.competencias || []).length) { section('Competências'); (p.competencias || []).forEach((g: Obj) => item(`${txt(g.grupo)}: ${(g.itens || []).map(txt).filter(Boolean).join(', ')}`)); }
  if ((p.experiencias || []).length) {
    section('Experiência Profissional');
    (p.experiencias || []).forEach((e: Obj, i: number) => {
      const prev = p.experiencias[i - 1];
      addPara(txt(e.cargo), { bold: true, size: est.corpo + 0.5, before: i === 0 ? 8 : (prev && prev.empresa === e.empresa ? 10 : 16), after: 2 });
      const periodo = [txt(e.inicio),txt(e.fim)].filter(Boolean).join(' – ');
      const linha = [txt(e.empresa),periodo].filter(Boolean).join(' | ');
      if (linha || e.promocao) addPara(linha + (e.promocao ? `${linha ? ' | ' : ''}Promoção interna` : ''), { color: est.suave, after: 6 });
      bullets(e).forEach(item);
    });
  }
  if ((p.formacao || []).length) { section('Formação Acadêmica'); (p.formacao || []).forEach((f: Obj, i: number) => { addPara(txt(f.curso), { bold: true, before: i === 0 ? 8 : 10, after: 2 }); const line=[txt(f.instituicao),[txt(f.inicio),txt(f.fim)].filter(Boolean).join(' – ')].filter(Boolean).join(' | '); if(line)addPara(line,{color:est.suave,after:2}); }); }
  if ((p.cursos || []).length) { section('Cursos'); (p.cursos || []).forEach((k: Obj, i: number) => addPara([k.nome,k.instituicao,k.ano].map(txt).filter(Boolean).join(' | '), { before: i === 0 ? 8 : 4, after: 3 })); }
  if ((p.idiomas || []).length) { section('Idiomas'); (p.idiomas || []).forEach((k: Obj, i: number) => addPara([k.idioma,k.nivel].map(txt).filter(Boolean).join(': '), { before: i === 0 ? 8 : 4, after: 3 })); }
  const document = new Document({ styles: { default: { document: { run: { font: est.fonte, size: Math.round(est.corpo * 2) } } } }, numbering: { config: [{ reference: 'bullet-list', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 320, hanging: 160 } } } }] }] }, sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: est.margem * 20, bottom: est.margem * 20, left: est.margem * 20, right: est.margem * 20 } } }, children }] });
  return Packer.toBuffer(document);
}

export async function POST(req: NextRequest) {
  let uploadedPdf = '';
  let uploadedDocx = '';
  try {
    const { id_analise, modelo } = await req.json();
    if (!id_analise || !MODELOS[modelo]) return NextResponse.json({ erro: 'Informe id_analise e modelo classico ou moderno.' }, { status: 400 });
    const sb = supabaseAdmin();
    const { data: a, error } = await sb.from('analises').select('*,candidatos(nome)').eq('id', id_analise).single();
    if (error || !a) return NextResponse.json({ erro: 'Análise não encontrada.' }, { status: 404 });
    const perfil = a.perfil_mestre;
    if (!perfil) return NextResponse.json({ erro: 'Perfil mestre não encontrado.' }, { status: 400 });
    if (/\[(CONFIRMAR|PREENCHER)(?:[:\]])/i.test(JSON.stringify(perfil))) return NextResponse.json({ erro: 'O perfil ainda contém campos [CONFIRMAR] ou [PREENCHER]. Revise e salve o perfil antes de gerar os arquivos.' }, { status: 409 });
    const nome = String(perfil.nome || a.candidatos?.nome || 'curriculo').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]/g, '_');
    const [pdf, docx] = await Promise.all([pdfBuffer(perfil, modelo), docxBuffer(perfil, modelo)]);
    const base = `${a.candidato_id}/${id_analise}/${modelo}-${Date.now()}`;
    uploadedPdf = `${base}.pdf`; uploadedDocx = `${base}.docx`;
    const up1 = await sb.storage.from('curriculos').upload(uploadedPdf, pdf, { contentType: 'application/pdf', upsert: false });
    if (up1.error) throw up1.error;
    const up2 = await sb.storage.from('curriculos').upload(uploadedDocx, docx, { contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', upsert: false });
    if (up2.error) throw up2.error;
    const { error: regError } = await sb.from('gerados').insert({ analise_id: id_analise, modelo_curriculo: modelo, caminho_pdf: uploadedPdf, caminho_docx: uploadedDocx, perfil_versao: Number(perfil.versao || 1) });
    if (regError) throw regError;
    const [purl, durl] = await Promise.all([sb.storage.from('curriculos').createSignedUrl(uploadedPdf, 3600), sb.storage.from('curriculos').createSignedUrl(uploadedDocx, 3600)]);
    if (purl.error || durl.error) throw new Error('Arquivos gerados, mas não foi possível criar links temporários.');
    return NextResponse.json({ ok: true, nome_base: `Curriculo_${nome}_${MODELOS[modelo].nome}`, pdf_url: purl.data.signedUrl, docx_url: durl.data.signedUrl, expira_em_segundos: 3600, modelo: MODELOS[modelo].nome, perfil_versao: Number(perfil.versao || 1) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro ao gerar currículo.';
    console.error('[OtimizaCV gerar]', e);
    try { const sb = supabaseAdmin(); if (uploadedPdf) await sb.storage.from('curriculos').remove([uploadedPdf]); if (uploadedDocx) await sb.storage.from('curriculos').remove([uploadedDocx]); } catch { /* rollback best effort */ }
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}
