'use client';
import React from 'react';

type Obj = Record<string, any>;
type Props = { profile: Obj; onChange: (profile: Obj) => void; disabled?: boolean };

function Field({label,value,onChange,placeholder, multiline=false,disabled=false}: {label:string;value:any;onChange:(v:string)=>void;placeholder?:string;multiline?:boolean;disabled?:boolean}) {
  return <label className="profile-field"><span>{label}</span>{multiline
    ? <textarea disabled={disabled} value={String(value ?? '')} onChange={e=>onChange(e.target.value)} placeholder={placeholder||''} rows={4}/>
    : <input disabled={disabled} value={String(value ?? '')} onChange={e=>onChange(e.target.value)} placeholder={placeholder||''}/>}</label>;
}

export default function ProfileEditor({profile,onChange,disabled=false}:Props) {
  const F=(props:Omit<React.ComponentProps<typeof Field>,'disabled'>)=><Field {...props} disabled={disabled}/>;
  const patch=(key:string,value:any)=>onChange({...profile,[key]:value});
  const patchContact=(key:string,value:string)=>patch('contato',{...(profile.contato||{}),[key]:value});
  const patchExp=(i:number,key:string,value:any)=>patch('experiencias',(profile.experiencias||[]).map((x:Obj,k:number)=>k===i?{...x,[key]:value}:x));
  const patchBullet=(i:number,j:number,value:string)=>{
    const exps=[...(profile.experiencias||[])]; const exp={...exps[i]};
    exp.bullets=(exp.bullets||[]).map((b:any,k:number)=>k===j?(typeof b==='string'?value:{...b,texto:value}):b);
    exps[i]=exp;patch('experiencias',exps);
  };
  const patchList=(key:string,i:number,field:string,value:string)=>patch(key,(profile[key]||[]).map((x:Obj,k:number)=>k===i?{...x,[field]:value}:x));
  const remove=(key:string,i:number)=>patch(key,(profile[key]||[]).filter((_:any,k:number)=>k!==i));
  const add=(key:string,item:Obj)=>patch(key,[...(profile[key]||[]),item]);
  return <div className="profile-editor">
    <section className="profile-section">
      <div className="profile-section-head"><div><span className="eyebrow">IDENTIFICAÇÃO</span><h3>Dados principais</h3></div><span className="profile-hint">Confira os dados antes de continuar</span></div>
      <div className="profile-grid two"><F label="Nome completo" value={profile.nome} onChange={v=>patch('nome',v)}/><F label="Título profissional" value={profile.titulo} onChange={v=>patch('titulo',v)}/></div>
      <F label="Resumo profissional" value={profile.resumo} onChange={v=>patch('resumo',v)} multiline/>
    </section>
    <section className="profile-section">
      <div className="profile-section-head"><div><span className="eyebrow">CONTATO</span><h3>Como encontrar você</h3></div></div>
      <div className="profile-grid two">
        {(['email','telefone','cidade','linkedin'] as const).map(k=><F key={k} label={{email:'E-mail',telefone:'Telefone',cidade:'Cidade',linkedin:'LinkedIn'}[k]} value={profile.contato?.[k]} onChange={v=>patchContact(k,v)}/>)}
      </div>
    </section>
    <section className="profile-section">
      <div className="profile-section-head"><div><span className="eyebrow">TRAJETÓRIA</span><h3>Experiência profissional</h3></div><button type="button" className="btn btn-secundario btn-pequeno" disabled={disabled} onClick={()=>add('experiencias',{empresa:'',cargo:'',inicio:'',fim:'',promocao:false,bullets:[]})}>+ Adicionar experiência</button></div>
      {(profile.experiencias||[]).map((e:Obj,i:number)=><article className="profile-item" key={i}>
        <div className="profile-item-head"><strong>Experiência {i+1}</strong><button type="button" className="btn-link danger-link" disabled={disabled} onClick={()=>remove('experiencias',i)}>Remover</button></div>
        <div className="profile-grid two"><F label="Empresa" value={e.empresa} onChange={v=>patchExp(i,'empresa',v)}/><F label="Cargo" value={e.cargo} onChange={v=>patchExp(i,'cargo',v)}/><F label="Início (MM/AAAA)" value={e.inicio} onChange={v=>patchExp(i,'inicio',v)}/><F label="Fim (MM/AAAA ou Atual)" value={e.fim} onChange={v=>patchExp(i,'fim',v)}/></div>
        <div className="profile-bullets-head"><strong>Atividades e resultados</strong><button type="button" className="btn-link" disabled={disabled} onClick={()=>patchExp(i,'bullets',[...(e.bullets||[]),{texto:'',origem:'confirmado'}])}>+ Adicionar atividade</button></div>
        {(e.bullets||[]).map((b:any,j:number)=><div className="profile-bullet" key={j}><textarea rows={2} value={typeof b==='string'?b:(b.texto||'')} onChange={ev=>patchBullet(i,j,ev.target.value)} aria-label={`Atividade ${j+1} de ${e.cargo||'experiência'}`}/><button type="button" className="icon-remove" disabled={disabled} title="Remover atividade" onClick={()=>patchExp(i,'bullets',(e.bullets||[]).filter((_:any,k:number)=>k!==j))}>×</button></div>)}
      </article>)}
      {!(profile.experiencias||[]).length&&<p className="empty-note">Nenhuma experiência cadastrada.</p>}
    </section>
    <section className="profile-section">
      <div className="profile-section-head"><div><span className="eyebrow">CONHECIMENTOS</span><h3>Competências</h3></div><button type="button" className="btn btn-secundario btn-pequeno" disabled={disabled} onClick={()=>add('competencias',{grupo:'Nova categoria',itens:[]})}>+ Adicionar grupo</button></div>
      {(profile.competencias||[]).map((g:Obj,i:number)=><article className="profile-item" key={i}><div className="profile-item-head"><strong>Grupo {i+1}</strong><button type="button" className="btn-link danger-link" onClick={()=>remove('competencias',i)}>Remover</button></div><F label="Categoria" value={g.grupo} onChange={v=>patchList('competencias',i,'grupo',v)}/><F label="Competências (separe por vírgulas)" value={(g.itens||[]).join(', ')} onChange={v=>patch('competencias',(profile.competencias||[]).map((x:Obj,k:number)=>k===i?{...x,itens:v.split(',').map(s=>s.trim()).filter(Boolean)}:x))}/></article>)}
    </section>
    {(['formacao','cursos','idiomas'] as const).map(key=>{
      const config:any={formacao:{title:'Formação acadêmica',eyebrow:'EDUCAÇÃO',add:{curso:'',instituicao:'',inicio:'',fim:''},fields:[['curso','Curso'],['instituicao','Instituição'],['inicio','Início'],['fim','Conclusão']]},cursos:{title:'Cursos e certificações',eyebrow:'APERFEIÇOAMENTO',add:{nome:'',instituicao:'',ano:''},fields:[['nome','Curso ou certificação'],['instituicao','Instituição'],['ano','Ano']]},idiomas:{title:'Idiomas',eyebrow:'IDIOMAS',add:{idioma:'',nivel:''},fields:[['idioma','Idioma'],['nivel','Nível']]}};
      const c=config[key];return <section className="profile-section" key={key}><div className="profile-section-head"><div><span className="eyebrow">{c.eyebrow}</span><h3>{c.title}</h3></div><button type="button" className="btn btn-secundario btn-pequeno" disabled={disabled} onClick={()=>add(key,c.add)}>+ Adicionar</button></div>{(profile[key]||[]).map((x:Obj,i:number)=><article className="profile-item" key={i}><div className="profile-item-head"><strong>Item {i+1}</strong><button type="button" className="btn-link danger-link" onClick={()=>remove(key,i)}>Remover</button></div><div className="profile-grid two">{c.fields.map(([f,l]:string[])=><F key={f} label={l} value={x[f]} onChange={v=>patchList(key,i,f,v)}/>)}</div></article>)}</section>;
    })}
    {(profile.pendencias||[]).length>0&&<section className="profile-section pending-section"><span className="eyebrow">PONTOS PARA CONFERIR</span><h3>Pendências</h3><ul>{profile.pendencias.map((p:any,i:number)=><li key={i}><strong>{p.texto||p}</strong>{p.ideal&&<small>{p.ideal}</small>}</li>)}</ul></section>}
  </div>;
}
