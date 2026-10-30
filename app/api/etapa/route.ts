import { NextRequest, NextResponse } from 'next/server';
import { consultarIA, consultarIAComPdf, parseJsonIA } from '@/lib/ai';
import { supabaseAdmin } from '@/lib/supabase';
import { rodarChecagens } from '@/lib/checagens';
import { promptAuditoria, promptRevisor, promptPerguntas, promptPerfil, curriculoNumerado_ } from '@/lib/prompts';
import { checarConteudo, perguntasMetricas, perguntasDistribuicao, perguntasPromocao, expandirSiglasPerfil } from '@/lib/conteudo';
import { prepararDadosConfirmados, todasPerguntas, textoResposta, consolidarPerfil, travarMarcadoresENumeros, statusPontos, aplicarCorrecaoPerfil, perfilParaDados, normalizarRespostas } from '@/lib/perfil';
export const runtime='nodejs'; export const maxDuration=120;

function resumo(problemas:any[]){const r={critico:0,importante:0,recrutador:0};problemas.forEach(p=>{if(p.gravidade in r)(r as any)[p.gravidade]++});return r}

async function salvarVersaoPerfil(sb:any, analise:any, id:string, perfil:any, editado:boolean, etapaAtual:string) {
 const historico=Array.isArray(analise.perfil_versoes)?analise.perfil_versoes:[];
 const ultima=Math.max(Number(analise.perfil_mestre?.versao||0),...historico.map((v:any)=>Number(v.versao||0)),0);
 const versao=ultima+1;perfil.versao=versao;perfil.editado_pelo_candidato=editado;
 const novo=[...historico,{versao,editado_pelo_candidato:editado,perfil:JSON.parse(JSON.stringify(perfil)),criado_em:new Date().toISOString()}];
 const {error}=await sb.from('analises').update({perfil_mestre:perfil,perfil_versoes:novo,etapa_atual:etapaAtual,atualizado_em:new Date().toISOString()}).eq('id',id);
 if(error) throw error;
 return perfil;
}

function basePrompt(){return `Você é especialista em recrutamento e ATS no Brasil. Nunca invente cargos, datas, números, ferramentas, resultados ou formação. Todo problema precisa de evidência real. Quando depender de dado do candidato, não invente: marque resolucao candidato e deixe correcao vazia. Escreva em português simples. Responda somente JSON válido. Gravidade: critico = leitura ou informação não encontrada; importante = estrutura/ranking; recrutador = qualidade para leitura humana.`}
function normalizarProblemas(lista:any[],prefixo:string, dados:any, texto:string){
 const out:any[]=[];const temasDoSistema=/(sem números|sem numeros|números ou resultados|numeros ou resultados|siglas sem|curso.{0,30}(antig|desatualiz|datad)|(antig|desatualiz|datad).{0,30}curso|promoção interna|promocao interna|vários cargos na mesma empresa|varios cargos na mesma empresa|atividades sem cargo definido)/i;const mapa:Record<string,string>={};const junta=(v:any[])=>v.filter(Boolean).join(' | ');
 if(dados.titulo)mapa.titulo=String(dados.titulo);if(dados.resumo)mapa.resumo=String(dados.resumo);
 (dados.competencias||[]).forEach((x:string,i:number)=>mapa[`comp${i+1}`]=String(x));
 (dados.experiencias||[]).forEach((e:any,i:number)=>{mapa[`e${i+1}`]=junta([e.cargo,e.empresa]);(e.bullets||[]).forEach((b:string,j:number)=>mapa[`e${i+1}b${j+1}`]=String(b))});
 (dados.formacao||[]).forEach((x:any,i:number)=>mapa[`f${i+1}`]=junta([x.curso,x.instituicao]));
 (dados.cursos||[]).forEach((x:any,i:number)=>mapa[`k${i+1}`]=junta([x.nome,x.instituicao,x.ano]));
 (dados.idiomas||[]).forEach((x:any,i:number)=>mapa[`i${i+1}`]=junta([x.idioma,x.nivel]));
 const c=dados.contato||{};mapa.contato=junta([c.cidade,c.telefone,c.email,c.linkedin]);
 (Array.isArray(lista)?lista:[]).forEach((p:any)=>{if(!p?.titulo||temasDoSistema.test(String(p.titulo)))return;const ocorrencias=(Array.isArray(p.ocorrencias)?p.ocorrencias:[]).slice(0,40).flatMap((o:any)=>{
  const ref=String(o.ref||'').replace(/[\[\]]/g,'');const trecho=String(o.trecho||'');const procurar=mapa[ref]||trecho;let achado:any=null;
  if(procurar){const ix=texto.indexOf(procurar.slice(0,160));if(ix>=0)achado={inicio:ix,trecho:texto.slice(ix,ix+Math.min(procurar.length,200))}}
  if(!mapa[ref]&&!achado)return [];
  const alvo=(ref==='titulo'||ref==='resumo'||ref==='contato')?ref:/^e(\d+)b(\d+)$/.test(ref)?ref.replace(/^e(\d+)b(\d+)$/,'exp-$1-b$2'):/^e\d+$/.test(ref)?ref.replace(/^e(\d+)$/,'exp-$1'):/^comp/.test(ref)?'competencias':/^f/.test(ref)?'formacao':/^k/.test(ref)?'cursos':/^i/.test(ref)?'idiomas':'';
  return [{ref:mapa[ref]?ref:'robo',alvo,trecho:achado?.trecho||mapa[ref]||trecho,inicio:achado?.inicio??-1,fim:achado?achado.inicio+achado.trecho.length:-1,correcao:/\[(PREENCHER|X)\b/i.test(o.correcao||'')?'':String(o.correcao||'')}];
 });if((p.ocorrencias||[]).length&&!ocorrencias.length)return;out.push({id:`${prefixo}${out.length+1}`,origem:prefixo==='rv'?'revisor':'ia',gravidade:['critico','importante','recrutador'].includes(p.gravidade)?p.gravidade:'importante',resolucao:['automatica','candidato'].includes(p.resolucao)?p.resolucao:'',categoria:p.categoria||'conteudo',titulo:String(p.titulo),onde:p.onde||'',por_que:p.por_que||'',como_corrigir:p.como_corrigir||'',ocorrencias})});return out
}

export async function POST(req:NextRequest){
 try{
  const body=await req.json();const id=String(body.id_analise||'');const etapa=String(body.etapa||'');if(!id)return NextResponse.json({erro:'id_analise obrigatório.'},{status:400});
  const sb=supabaseAdmin();const {data:a,error}=await sb.from('analises').select('*').eq('id',id).single();if(error||!a)return NextResponse.json({erro:'Análise não encontrada.'},{status:404});
  const d=a.dados_extraidos||{};const texto=a.texto_robo||'';let result:any={};let aiMeta:any=null;
  if(etapa==='checagens'){
   result=rodarChecagens(texto);await sb.from('analises').update({checagens:result,etapa_atual:'checado',atualizado_em:new Date().toISOString()}).eq('id',id);
  } else if(etapa==='diagnostico'||etapa==='revisor'){
   const regras=(a.checagens?.problemas||[]).map((x:any)=>({...x,origem:'regra'}));
   const conteudo=checarConteudo(d,texto);
   const baseProblemas=[...regras,...conteudo];
   const ja=etapa==='revisor'?(a.diagnostico?.problemas||[]):baseProblemas;
   const pr=etapa==='diagnostico'?promptAuditoria(d,texto,baseProblemas,'original'):promptRevisor(d,texto,ja);
   const prompt=`${pr.sistema}

${pr.usuario}`;
   let r:any;if(etapa==='diagnostico'&&String(a.mime_type||'').includes('pdf')&&a.caminho_arquivo){const {data:arquivoPdf,error:erroPdf}=await sb.storage.from('curriculos').download(a.caminho_arquivo);if(erroPdf||!arquivoPdf)throw new Error('Não foi possível recuperar o PDF original para a auditoria visual.');const base64=Buffer.from(await arquivoPdf.arrayBuffer()).toString('base64');r=await consultarIAComPdf(prompt,base64,etapa);}else{r=await consultarIA(prompt,etapa);}aiMeta=r;const parsed=parseJsonIA<any>(r.texto);const novos=normalizarProblemas(parsed.problemas,etapa==='revisor'?'rv':'ia',d,texto);
   let problemas=etapa==='diagnostico'?[...baseProblemas,...novos]:[...(a.diagnostico?.problemas||[]).filter((x:any)=>x.origem!=='revisor'),...novos.filter((n:any)=>!(a.diagnostico?.problemas||[]).some((x:any)=>x.titulo.toLowerCase()===n.titulo.toLowerCase()))];
   problemas.forEach((p:any)=>{if(!p.resolucao)p.resolucao=p.origem==='regra'?((p.categoria==='leitura'||p.categoria==='contato')?'candidato':'automatica'):(['layout','estrutura','datas','palavras-chave'].includes(p.categoria)?'automatica':'candidato')});
   problemas.sort((x:any,y:any)=>['critico','importante','recrutador'].indexOf(x.gravidade)-['critico','importante','recrutador'].indexOf(y.gravidade));
   result={versao:'diagnostico-v1',resumo:resumo(problemas),problemas,dados_extraidos:d,perguntas:[],respostas:a.diagnostico?.respostas||{},uso:{[etapa]:{provedor:r.provedor,modelo:r.modelo,uso:r.uso}}};
   await sb.from('analises').update({diagnostico:result,etapa_atual:etapa==='revisor'?'revisado':'diagnosticado',atualizado_em:new Date().toISOString()}).eq('id',id);
  } else if(etapa==='perguntas'){
   const diag=a.diagnostico||{};const pend=(diag.problemas||[]).filter((p:any)=>p.resolucao==='candidato'&&(p.origem==='ia'||p.origem==='revisor'));
   const pr=promptPerguntas(d,pend);const prompt=`${pr.sistema}

${pr.usuario}`;
   let perguntas:any[]=[];if(pend.length){const r=await consultarIA(prompt,'perguntas');aiMeta=r;perguntas=parseJsonIA<any>(r.texto).perguntas||[];}
   perguntas=perguntas.slice(0,6).map((q:any,i:number)=>({...q,id:`p${i+1}`,tipo:['sim_nao','numero','texto','escolha'].includes(q.tipo)?q.tipo:'texto',opcoes:Array.isArray(q.opcoes)?q.opcoes:[],resolve:Array.isArray(q.resolve)?q.resolve.filter((x:string)=>pend.some((p:any)=>p.id===x)):[]}));
   const sistemas:any[]=[...perguntasMetricas(diag.problemas||[]),...perguntasDistribuicao(d,diag.problemas||[]),...perguntasPromocao(d,diag.problemas||[],texto)];
   const contato=d.contato||{};const temEmail=/[^@\s]+@[^@\s]+\.[^@\s]+/.test(contato.email||'');const temTelefone=/\d{4}[-\s]?\d{4}/.test(contato.telefone||'');
   if(!temEmail||!temTelefone){const faltam=[!temEmail?'e-mail':'',!temTelefone?'telefone':''].filter(Boolean).join(' e ');sistemas.push({id:'contato-1',pergunta:`Qual ${faltam} você quer no currículo?`,motivo:'Sem contato, o recrutador não consegue falar com você, mesmo que o currículo seja aprovado.',ideal:'Use um e-mail com o seu nome e um celular com DDD. Exemplo: nome.sobrenome@email.com | (11) 99999-9999.',tipo:'texto',campo:'contato',resolve:(diag.problemas||[]).filter((p:any)=>p.categoria==='contato').map((p:any)=>p.id)});}
   sistemas.filter((q:any)=>q.tipo==='distribuicao').forEach((q:any)=>{q.atividades=[];(d.experiencias||[]).filter((e:any)=>e.empresa===q.empresa).forEach((e:any)=>{(e.bullets||[]).forEach((b:string)=>q.atividades.push({bullet:b,cargo:e.cargo}));});});
   const all=[...sistemas,...perguntas];diag.perguntas=all;diag.perguntas_sistema=sistemas;const contagem=resumo(diag.problemas||[]);diag.resumo=contagem;await sb.from('analises').update({diagnostico:diag,etapa_atual:'perguntas',atualizado_em:new Date().toISOString()}).eq('id',id);await sb.from('perguntas').delete().eq('analise_id',id);if(all.length)await sb.from('perguntas').insert(all.map((q:any)=>({analise_id:id,id_pergunta:q.id,pergunta:q.pergunta,motivo:q.motivo,tipo:q.tipo,opcoes:q.opcoes||[],ideal:q.ideal||'',resolve:q.resolve||[]})));result={perguntas:todasPerguntas(diag),diagnostico:diag};
  } else if(etapa==='respostas'){
   const diag=a.diagnostico||{};const respostas=normalizarRespostas(diag,body.respostas||{});diag.respostas={...(diag.respostas||{}),...respostas};await sb.from('analises').update({diagnostico:diag,respostas:diag.respostas,etapa_atual:'respondido',atualizado_em:new Date().toISOString()}).eq('id',id);for(const [qid,resp] of Object.entries(respostas))await sb.from('perguntas').update({resposta:resp}).eq('analise_id',id).eq('id_pergunta',qid);result={ok:true,respostas:diag.respostas};
  } else if(etapa==='perfil'){
   const diag=a.diagnostico||{};const dadosConfirmados=prepararDadosConfirmados(d,diag);const respostasPerguntas=todasPerguntas(diag).filter((q:any)=>q.tipo!=='distribuicao'&&q.campo!=='contato').map((q:any)=>({pergunta:q.pergunta,trecho:q.trecho||'',resposta:textoResposta(q,(diag.respostas||{})[q.id])}));const pr=promptPerfil(dadosConfirmados,respostasPerguntas,diag.problemas||[]);const prompt=`${pr.sistema}\n\n${pr.usuario}`;
   const r=await consultarIA(prompt,'perfil_mestre');aiMeta=r;const iaPerfil=parseJsonIA<any>(r.texto);result=consolidarPerfil(iaPerfil.perfil||iaPerfil,dadosConfirmados);expandirSiglasPerfil(result);const fonteNumeros=texto+' '+JSON.stringify(d)+' '+JSON.stringify(diag.respostas||{});result.pendencias=[...(result.pendencias||[]),...travarMarcadoresENumeros(result,fonteNumeros),...statusPontos({...diag,dados_extraidos:d}).filter((p:any)=>p.status==='pendente').map((p:any)=>({texto:'Ponto do diagnóstico sem resposta: '+p.titulo+(p.por_que?'. '+p.por_que:''),ideal:p.como_corrigir||'',alvo:''}))];result.uso={provedor:r.provedor,modelo:r.modelo,uso:r.uso};result=await salvarVersaoPerfil(sb,a,id,result,false,'perfil');
  } else if(etapa==='salvar_perfil'){
   const perfil=body.perfil;if(!perfil||typeof perfil!=='object'||!Array.isArray(perfil.experiencias))return NextResponse.json({erro:'Perfil inválido. Confira a estrutura das experiências.'},{status:400});expandirSiglasPerfil(perfil);result=await salvarVersaoPerfil(sb,a,id,perfil,true,'perfil_editado');
  } else if(etapa==='auditoria_perfil'){
   const perfil=JSON.parse(JSON.stringify(a.perfil_mestre||body.perfil||null));if(!perfil)return NextResponse.json({erro:'Monte o perfil mestre antes.'},{status:400});
   const dadosPerfil=perfilParaDados(perfil);const numerado=curriculoNumerado_(dadosPerfil);const pr=promptAuditoria(dadosPerfil,numerado,[],'perfil');const r=await consultarIA(`${pr.sistema}\n\n${pr.usuario}`,'auditoria_perfil');aiMeta=r;
   const auditoria=parseJsonIA<any>(r.texto);const encontrados=normalizarProblemas(auditoria.problemas||[],'ap',dadosPerfil,numerado).filter((p:any)=>p.categoria!=='layout'&&!/grudad|mistur|layout|espa[çc]amento/i.test(p.titulo));let aplicadas=0;const novas:any[]=[];
   encontrados.forEach((p:any)=>{const automatica=p.resolucao!=='candidato';if(!p.ocorrencias.length){novas.push({texto:p.titulo,ideal:p.como_corrigir,alvo:''});return;}p.ocorrencias.forEach((o:any)=>{if(automatica&&o.correcao&&aplicarCorrecaoPerfil(perfil,o.ref,o.correcao)){aplicadas++;return;}novas.push({texto:p.titulo+(o.trecho?`: \"${String(o.trecho).slice(0,90)}${o.trecho.length>90?'…':''}\"`:''),ideal:o.correcao||p.como_corrigir,alvo:o.alvo});});});
   expandirSiglasPerfil(perfil);const fonteNumeros=texto+' '+JSON.stringify(d)+' '+JSON.stringify(a.respostas||{});perfil.pendencias=[...(perfil.pendencias||[]),...novas,...travarMarcadoresENumeros(perfil,fonteNumeros)];perfil.auditoria={aplicadas,pendentes:novas.length,erro:''};
   await salvarVersaoPerfil(sb,a,id,perfil,false,'auditoria_perfil');const {error:erroAuditoria}=await sb.from('analises').update({auditoria_perfil:{...auditoria,aplicadas,pendentes:novas.length}}).eq('id',id);if(erroAuditoria)throw erroAuditoria;result={...auditoria,aplicadas,pendentes:novas.length,perfil_atualizado:perfil};
  } else if(etapa==='conferencia'){
   const perfil=body.perfil||a.perfil_mestre;if(!perfil)return NextResponse.json({erro:'Perfil mestre não encontrado.'},{status:400});const prompt=`${basePrompt()}\nFaça conferência final do perfil destinado a currículo ATS. Identifique dados ausentes/inconsistentes, fatos não sustentados pelo currículo original e itens que ainda dependem do candidato. Não invente. Retorne JSON {"itens":[{"texto":"","ok":true,"aviso":false}],"pronto":true,"observacoes":[]}. Perfil: ${JSON.stringify(perfil)}. Fonte original: ${JSON.stringify(d)}`;
   const r=await consultarIA(prompt,'conferencia');aiMeta=r;result=parseJsonIA<any>(r.texto);await sb.from('analises').update({conferencia:result,etapa_atual:'conferido',atualizado_em:new Date().toISOString()}).eq('id',id);
  } else return NextResponse.json({erro:`Etapa desconhecida: ${etapa}`},{status:400});
  if(aiMeta){const u=aiMeta.uso||{};await sb.from('log_custos').insert({analise_id:id,etapa,provedor:aiMeta.provedor,modelo:aiMeta.modelo,tokens_entrada:Number(u.promptTokenCount||u.input_tokens||0),tokens_saida:Number(u.candidatesTokenCount||u.output_tokens||0),duracao_ms:aiMeta.duracaoMs,sucesso:true});}
  return NextResponse.json({ok:true,resultado:result,ia:aiMeta?{provedor:aiMeta.provedor,modelo:aiMeta.modelo,uso:aiMeta.uso}:null});
 }catch(e){const msg=e instanceof Error?e.message:'Falha ao executar etapa.';console.error('[OtimizaCV etapa]',msg);return NextResponse.json({erro:msg},{status:500})}
}
