import { NextRequest, NextResponse } from 'next/server';
import { extrairCurriculo, consultarIA, parseJsonIA } from '@/lib/ai';
import { supabaseAdmin } from '@/lib/supabase';
import { authenticatedUser } from '@/lib/auth-server';
import { randomUUID } from 'crypto';
import mammoth from 'mammoth';
import pdf from 'pdf-parse';

export const runtime = 'nodejs';
export const maxDuration = 120;
const LIMITE_BYTES = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
 const inicio=Date.now(); let analiseId:string|undefined;
 try {
  const user = await authenticatedUser(request);
  if (!user) return NextResponse.json({ erro: 'Entre na sua conta para analisar um currículo.' }, { status: 401 });
  const form=await request.formData(); const arquivo=form.get('arquivo');
  const nome=String(form.get('nome')||user.user_metadata?.full_name||'').trim(); const email=String(user.email||form.get('email')||'').trim().toLowerCase(); const aceite=form.get('aceiteLgpd')==='true';
  if(!(arquivo instanceof File))return NextResponse.json({erro:'Selecione um currículo em PDF ou DOCX.'},{status:400});
  if(!nome)return NextResponse.json({erro:'Informe seu nome.'},{status:400});
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))return NextResponse.json({erro:'Informe um e-mail válido.'},{status:400});
  if(!aceite)return NextResponse.json({erro:'É necessário aceitar o uso dos dados.'},{status:400});
  const ext=arquivo.name.toLowerCase().split('.').pop(); if(!['pdf','docx'].includes(ext||''))return NextResponse.json({erro:'Formato não suportado. Envie PDF ou DOCX.'},{status:400});
  if(arquivo.size>LIMITE_BYTES)return NextResponse.json({erro:'O arquivo ultrapassa 10 MB.'},{status:413});
  const bytes=Buffer.from(await arquivo.arrayBuffer()); let textoRobo=''; let dados:any; let provedor='';let modelo='';let uso:any={};
  if(ext==='pdf'){
   try { const parsed=await pdf(bytes); textoRobo=parsed.text||''; } catch { textoRobo=''; }
   const r=await extrairCurriculo(bytes.toString('base64'));dados=r.dados;provedor=r.provedor;modelo=r.modelo;uso=r.uso;
  } else {
   const raw=await mammoth.extractRawText({buffer:bytes});textoRobo=raw.value||'';
   if(textoRobo.trim().length<80)throw new Error('Não foi possível extrair texto suficiente do DOCX. Verifique se o arquivo não está protegido ou é composto apenas por imagens.');
   const prompt=`Você é especialista em leitura de currículos no Brasil. Extraia o currículo inteiro sem melhorar nem inventar. Liste cada cargo separadamente, datas MM/AAAA, emprego atual Atual. Se as atividades estiverem em bloco compartilhado entre cargos da mesma empresa, distribua da forma mais provável e marque atribuicao_incerta=true em todos esses cargos. Cada atividade aparece em apenas um cargo. Preserve todos os itens. Responda apenas JSON no formato {"dados_extraidos":{"nome":"","titulo":"","contato":{"cidade":"","telefone":"","email":"","linkedin":""},"resumo":"","competencias":[],"experiencias":[{"empresa":"","cargo":"","inicio":"","fim":"","atribuicao_incerta":false,"bullets":[]}],"formacao":[],"cursos":[],"idiomas":[]}}. CURRÍCULO:\n${textoRobo}`;
   const r=await consultarIA(prompt,'extracao DOCX');const j=parseJsonIA<any>(r.texto);dados=j.dados_extraidos||j;provedor=r.provedor;modelo=r.modelo;uso=r.uso;
  }
  if(!dados||typeof dados!=='object')throw new Error('A IA não retornou dados estruturados do currículo.');
  const sb=supabaseAdmin();
  const {data:cand,error:ec}=await sb.from('candidatos').insert({auth_user_id:user.id,nome,email,aceite_lgpd:true,data_aceite:new Date().toISOString()}).select('id').single();if(ec)throw ec;
  const candidateId=cand.id as string; const path=`${candidateId}/${randomUUID()}-${arquivo.name.replace(/[^\p{L}\p{N}._-]/gu,'_')}`;
  const {error:up}=await sb.storage.from('curriculos').upload(path,bytes,{contentType:arquivo.type|| (ext==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),upsert:false});if(up)throw new Error(`Falha ao armazenar arquivo: ${up.message}. Crie o bucket privado "curriculos" no Supabase.`);
  const {data:ana,error:ea}=await sb.from('analises').insert({candidato_id:candidateId,etapa_atual:'extracao',nome_arquivo:arquivo.name,caminho_arquivo:path,mime_type:arquivo.type,texto_robo:dados.texto_robo||textoRobo,dados_extraidos:dados,versao_prompt:'v1'}).select('id').single();if(ea)throw ea;analiseId=ana.id;
  const usageIn=Number(uso?.promptTokenCount||uso?.input_tokens||0);const usageOut=Number(uso?.candidatesTokenCount||uso?.output_tokens||0);
  await sb.from('log_custos').insert({analise_id:analiseId,etapa:'extracao',provedor,modelo,tokens_entrada:usageIn,tokens_saida:usageOut,duracao_ms:Date.now()-inicio,sucesso:true});
  return NextResponse.json({id_analise:analiseId,id_candidato:candidateId,candidato:{nome,email},dados_extraidos:dados,texto_robo:textoRobo,provedor_ia:provedor,modelo_ia:modelo,uso_ia:uso});
 } catch(e) {
  const msg=e instanceof Error?e.message:'Erro inesperado ao analisar currículo.';console.error('[OtimizaCV] análise:',e);
  if(analiseId){try{const sb=supabaseAdmin();await sb.from('analises').update({status:'erro',etapa_atual:'erro'}).eq('id',analiseId)}catch{}}
  return NextResponse.json({erro:msg},{status:/timeout|tempo limite/i.test(msg)?504:/quota|cota|limite/i.test(msg)?503:500});
 }
}
