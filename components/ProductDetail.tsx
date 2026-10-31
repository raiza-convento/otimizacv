import Link from 'next/link';
import RequireAuth from '@/components/RequireAuth';
import PortalHeader from '@/components/PortalHeader';

type ProductKey = 'otimiza-cv' | 'analise-linkedin' | 'comparativo-vaga-cv';
function checkoutHttps(raw?: string) {
  if (!raw) return undefined;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'https:' ? parsed.toString() : undefined;
  } catch { return undefined; }
}

const products: Record<ProductKey, {
  number: string; name: string; eyebrow: string; title: string; accent: string; description: string; status: string;
  outcome: string; features: { title: string; text: string }[]; steps: string[]; checkout?: string; internal?: string;
}> = {
  'otimiza-cv': {
    number: '01', name: 'Otimiza CV', eyebrow: 'CURRÍCULO · POSICIONAMENTO · ATS', title: 'Seu currículo precisa mostrar o valor que você entrega.', accent: 'Mais clareza. Mais estratégia. Mais confiança.', description: 'Uma análise inteligente que lê seu currículo, identifica pontos que podem atrapalhar sua apresentação e ajuda a transformar informações soltas em um perfil profissional consistente.', status: 'Disponível', outcome: 'Saia de um currículo apenas informativo para uma apresentação mais clara, organizada e direcionada.',
    features: [
      { title: 'Leitura com olhar de ATS', text: 'Identifique problemas de estrutura, leitura, seções, datas e informações que podem se perder em sistemas de recrutamento.' },
      { title: 'Diagnóstico explicado', text: 'Entenda o que merece atenção, por que importa e quais pontos dependem de informação sua.' },
      { title: 'Perfil mestre editável', text: 'Consolide experiências, competências e formação em uma base organizada antes de gerar uma nova versão.' },
      { title: 'Currículo pronto para usar', text: 'Gere versões em PDF e Word nos modelos Clássico e Moderno.' },
    ], steps: ['Envie seu currículo em PDF ou DOCX.', 'Veja o diagnóstico e responda às perguntas necessárias.', 'Revise seu perfil mestre e confira o conteúdo.', 'Gere e baixe seu currículo em PDF e Word.'], internal: '/produtos/otimiza-cv/usar',
  },
  'analise-linkedin': {
    number: '02', name: 'Análise LinkedIn', eyebrow: 'LINKEDIN · MARCA PROFISSIONAL · VISIBILIDADE', title: 'Seu perfil profissional precisa contar a história certa.', accent: 'Um perfil coerente com o profissional que você é.', description: 'Uma análise orientada a melhorar a apresentação do seu perfil no LinkedIn, com atenção à clareza da mensagem, consistência das experiências e força do posicionamento.', status: 'Em desenvolvimento', outcome: 'Tenha recomendações práticas para deixar seu perfil mais claro, completo e alinhado ao tipo de oportunidade que procura.',
    features: [
      { title: 'Headline e apresentação', text: 'Avaliação da clareza do título profissional e da mensagem principal do perfil.' },
      { title: 'Sobre e experiências', text: 'Recomendações para organizar sua trajetória e comunicar melhor suas entregas.' },
      { title: 'Competências e palavras-chave', text: 'Identificação de termos relevantes e pontos que podem fortalecer sua apresentação.' },
      { title: 'Plano de melhoria', text: 'Uma lista priorizada de ajustes para você aplicar diretamente no LinkedIn.' },
    ], steps: ['Informe o endereço do seu perfil ou forneça o conteúdo.', 'Receba uma análise dos principais campos.', 'Revise as recomendações e escolha o que faz sentido.', 'Aplique as melhorias no seu perfil.'],
  },
  'comparativo-vaga-cv': {
    number: '03', name: 'Comparativo Vaga x CV', eyebrow: 'OPORTUNIDADE · ADERÊNCIA · PALAVRAS-CHAVE', title: 'Antes de se candidatar, entenda a aderência entre vaga e currículo.', accent: 'Menos tentativa no escuro. Mais decisão consciente.', description: 'Compare os requisitos de uma oportunidade com as informações reais do seu currículo para identificar compatibilidades, lacunas e pontos que merecem atenção.', status: 'Em desenvolvimento', outcome: 'Entenda quais requisitos estão evidenciados no seu currículo, quais não aparecem e onde vale aprofundar a análise antes de se candidatar.',
    features: [
      { title: 'Aderência por requisito', text: 'Compare requisitos da vaga com experiências, competências e formação presentes no currículo.' },
      { title: 'Lacunas identificadas', text: 'Diferencie o que está ausente do currículo do que pode apenas estar descrito de outra forma.' },
      { title: 'Palavras-chave relevantes', text: 'Encontre termos da oportunidade que podem estar faltando na apresentação profissional.' },
      { title: 'Recomendações com evidência', text: 'Receba sugestões baseadas no conteúdo fornecido, sem inventar experiências ou qualificações.' },
    ], steps: ['Envie seu currículo.', 'Cole a descrição da vaga desejada.', 'Veja a comparação organizada por requisito.', 'Decida o que ajustar e se a oportunidade faz sentido.'],
  },
};

export default function ProductDetail({ productKey }: { productKey: ProductKey }) {
  const product = products[productKey];
  const checkout = checkoutHttps(product.checkout || (productKey === 'otimiza-cv' ? process.env.NEXT_PUBLIC_CHECKOUT_OTIMIZA_CV_URL : productKey === 'analise-linkedin' ? process.env.NEXT_PUBLIC_CHECKOUT_ANALISE_LINKEDIN_URL : process.env.NEXT_PUBLIC_CHECKOUT_COMPARATIVO_VAGA_CV_URL));
  return <RequireAuth><PortalHeader /><main className="product-detail-page">
    <Link href="/" className="back-to-products">← Voltar para todos os produtos</Link>
    <section className={`detail-hero detail-${product.number}`}>
      <div className="detail-copy"><span className="eyebrow">PRODUTO {product.number} · {product.eyebrow}</span><span className={`detail-status ${product.status === 'Disponível' ? 'online' : ''}`}><i/>{product.status}</span><h1>{product.title}</h1><p className="detail-accent">{product.accent}</p><p className="detail-description">{product.description}</p>
        <div className="detail-actions">{checkout ? <a className="detail-primary" href={checkout} target="_blank" rel="noopener noreferrer">Comprar agora <span>↗</span></a> : <button className="detail-primary disabled" type="button" disabled>Checkout em configuração <span>⌁</span></button>}{product.internal && <Link className="detail-secondary" href={product.internal}>Começar uma análise <span>→</span></Link>}</div>
        {!checkout && <small className="checkout-note">O preço e o meio de pagamento ainda serão definidos. O botão de compra será ativado quando o link seguro de checkout for configurado.</small>}
      </div>
      <div className={`detail-art detail-art-${product.number}`} aria-hidden="true"><div className="detail-orbit orbit-a"/><div className="detail-orbit orbit-b"/><div className="detail-visual-sheet"><span>{product.name.toUpperCase()}</span><b/><i/><i/><i/><div className="detail-visual-bars"><i/><i/><i/><i/></div><small>{product.number} / OTIMIZACV</small></div><span className="detail-star">✳</span><span className="detail-floating">{product.number === '01' ? 'CV + IA' : product.number === '02' ? 'LINKEDIN' : 'VAGA ↔ CV'}</span></div>
    </section>
    <section className="detail-outcome"><span className="eyebrow">O QUE VOCÊ GANHA</span><h2>{product.outcome}</h2></section>
    <section className="detail-features"><div className="section-intro"><span className="eyebrow">RECURSOS</span><h2>Uma ferramenta, várias formas de evoluir.</h2><p>Veja como o produto ajuda você em cada etapa.</p></div><div className="feature-grid">{product.features.map((feature, index) => <article className="feature-item" key={feature.title}><span className="feature-number">0{index + 1}</span><h3>{feature.title}</h3><p>{feature.text}</p></article>)}</div></section>
    <section className="detail-process"><div className="section-intro"><span className="eyebrow">COMO FUNCIONA</span><h2>Simples de começar. Claro de acompanhar.</h2></div><ol>{product.steps.map((step, index) => <li key={step}><span>0{index + 1}</span><p>{step}</p></li>)}</ol></section>
    <section className="detail-bottom-cta"><div><span className="eyebrow">SEU PRÓXIMO PASSO</span><h2>{product.status === 'Disponível' ? 'Vamos melhorar seu currículo?' : 'Estamos preparando esta ferramenta.'}</h2><p>{product.status === 'Disponível' ? 'Comece com o material que você já tem e entenda onde vale concentrar seus esforços.' : 'Esta página já apresenta a proposta do produto. A abertura comercial será liberada quando a ferramenta e o checkout estiverem prontos.'}</p></div>{product.internal ? <Link href={product.internal} className="detail-primary">Começar agora <span>→</span></Link> : <span className="coming-chip">Lançamento em breve</span>}</section>
    <footer className="portal-footer"><span>OtimizaCV © {new Date().getFullYear()}</span><Link href="/">Voltar à central de produtos</Link></footer>
  </main></RequireAuth>;
}
