import Link from 'next/link';
import RequireAuth from '@/components/RequireAuth';
import PortalHeader from '@/components/PortalHeader';

const products = [
  { number: '01', slug: '/produtos/otimiza-cv', name: 'Otimiza CV', tag: 'DISPONÍVEL', description: 'Seu currículo mais claro, estratégico e preparado para passar por sistemas ATS e chegar melhor ao recrutador.', action: 'Conhecer o produto', art: 'cv', featured: true },
  { number: '02', slug: '/produtos/analise-linkedin', name: 'Análise LinkedIn', tag: 'EM DESENVOLVIMENTO', description: 'Transforme seu perfil em uma apresentação profissional coerente, encontrável e atraente.', action: 'Explorar produto', art: 'linkedin', featured: false },
  { number: '03', slug: '/produtos/comparativo-vaga-cv', name: 'Comparativo Vaga x CV', tag: 'EM DESENVOLVIMENTO', description: 'Entenda o quanto seu currículo conversa com uma oportunidade e onde estão as lacunas.', action: 'Explorar produto', art: 'match', featured: false },
];

export default function HomePage() {
  return <RequireAuth><PortalHeader /><main className="portal-main">
    <section className="portal-welcome">
      <div className="welcome-copy"><span className="eyebrow">CENTRAL DE PRODUTOS · OTIMIZACV</span><h1>O próximo passo da sua carreira começa com <em>uma boa estratégia.</em></h1><p>Escolha uma ferramenta e tenha mais clareza para apresentar seu valor profissional e encontrar oportunidades alinhadas ao seu momento.</p><div className="welcome-meta"><span className="meta-dot"/>Seu espaço profissional, em um só lugar</div></div>
      <div className="welcome-art" aria-hidden="true"><div className="art-ring ring-one"/><div className="art-ring ring-two"/><div className="art-card card-back"><i/><i/><i/></div><div className="art-card card-front"><span className="art-check">✓</span><b>Perfil em evolução</b><span className="art-line wide"/><span className="art-line"/><span className="art-line short"/><div className="art-tags"><i>Clareza</i><i>Estratégia</i></div></div><span className="art-spark spark-one">✳</span><span className="art-spark spark-two">✦</span></div>
    </section>
    <section className="portal-section-head"><div><span className="eyebrow">FERRAMENTAS</span><h2>O que você quer melhorar hoje?</h2></div><p>Produtos independentes, pensados para cada etapa da sua jornada profissional.</p></section>
    <section className="product-grid" aria-label="Produtos disponíveis">
      {products.map((product) => <article className={`product-card ${product.featured ? 'featured' : ''}`} key={product.number}>
        <div className={`product-visual visual-${product.art}`} aria-hidden="true">
          <span className="visual-index">{product.number} / 03</span>
          {product.art === 'cv' && <div className="visual-paper"><div className="paper-heading"><b/><span/><i/></div><div className="paper-title"/><div className="paper-block"><i/><i/><i/></div><div className="paper-block small"><i/><i/></div><div className="paper-highlight">+ estratégia</div></div>}
          {product.art === 'linkedin' && <div className="social-card"><div className="social-cover"/><div className="social-avatar">in</div><b>Seu perfil</b><span/><span/><div className="social-graph"><i/><i/><i/><i/><i/></div></div>}
          {product.art === 'match' && <div className="match-visual"><div className="match-doc"><b>VAGA</b><i/><i/><i/></div><span className="match-link">↔</span><div className="match-doc second"><b>CV</b><i/><i/><i/></div><div className="match-score">78<small>%</small></div></div>}
          <span className={`product-state ${product.featured ? 'ready' : ''}`}>{product.tag}</span>
        </div>
        <div className="product-card-body"><div className="product-card-title"><h3>{product.name}</h3><span>↗</span></div><p>{product.description}</p><Link href={product.slug} className="product-link">{product.action}<span>→</span></Link></div>
      </article>)}
    </section>
    <section className="portal-note"><span className="note-symbol">✳</span><div><strong>Uma carreira não é feita de uma única etapa.</strong><p>Comece pelo que precisa agora. Você poderá voltar a esta área sempre que quiser explorar outras ferramentas.</p></div></section>
    <footer className="portal-footer"><span>OtimizaCV © {new Date().getFullYear()}</span><span>Ferramentas para decisões profissionais melhores.</span></footer>
  </main></RequireAuth>;
}
