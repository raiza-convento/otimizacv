const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const TEMPO_TOTAL_MS = 55_000;
const TEMPO_GEMINI_MS = 32_000;
const TEMPO_POR_MODELO_MS = 9_000;
const TEMPO_ANTHROPIC_MS = 21_000;
const TEMPO_ETAPA_TOTAL_MS = 90_000;
const TEMPO_ETAPA_GEMINI_MS = 48_000;
const TEMPO_ETAPA_POR_MODELO_MS = 16_000;
const TEMPO_ETAPA_ANTHROPIC_MS = 34_000;
const MODELO_ANTHROPIC_PADRAO = 'claude-haiku-4-5-20251001';

// Ordem herdada do fallback do Apps Script. O modelo definido no .env sempre vem primeiro.
const MODELOS_GEMINI_PADRAO = [
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3-flash-preview'
];

const cooldowns = new Map<string, number>();
type Falha = Error & { trocarModelo?: boolean; cooldownSegundos?: number };


function modeloAnthropic(): string {
  const configurado = process.env.AI_MODEL_ANTHROPIC?.trim();
  if (!configurado || configurado === 'claude-haiku-5-5') return MODELO_ANTHROPIC_PADRAO;
  return configurado;
}

function prompts() {
  const hoje = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const sistema = `Você é especialista em recrutamento e em sistemas de triagem de currículos (ATS) usados no Brasil, como Gupy, InHire, Vagas, Sólides, Workday e Greenhouse. Seu trabalho é mostrar ao candidato, com clareza e sem jargão, o que no currículo dele pode atrapalhar a leitura automática, o ranqueamento e a leitura do recrutador.

DATA DE HOJE: ${hoje}. Qualquer data até hoje é válida e já aconteceu. Não aponte datas como "no futuro" a menos que sejam posteriores a ${hoje}.

REGRAS INVIOLÁVEIS:
1. Nunca invente informação sobre o candidato: cargos, datas, números, ferramentas, resultados ou formação. Se algo útil não está no currículo, transforme em PERGUNTA, nunca em afirmação.
2. Todo problema apontado precisa de evidência real no currículo.
3. Quando a correção precisar de um dado que você não tem, não invente nem use marcadores: deixe a correção vazia e diga que depende do candidato.
4. Escreva em português do Brasil, em linguagem simples, como quem explica para o próprio candidato.
5. Responda SOMENTE com um JSON válido, no formato pedido, sem nenhum texto fora dele.`;
  const leitura = `Você recebe o ARQUIVO ORIGINAL do currículo, anexado.
TAREFA: ler o currículo INTEIRO e extrair os dados, exatamente como estão. Não melhore nem reescreva: copie.
- Datas no formato MM/AAAA; emprego atual com fim "Atual"; data ausente fica "".
- Liste cada cargo separadamente, mesmo que seja na mesma empresa, do mais recente para o mais antigo.
- ATRIBUIÇÃO DAS ATIVIDADES: se no original as atividades aparecem em um bloco único abaixo de vários cargos da mesma empresa, você NÃO sabe a qual cargo cada uma pertence. Distribua da forma mais provável e marque "atribuicao_incerta": true em TODOS os cargos dessa empresa. Use false quando cada cargo tiver as próprias atividades.
- Cada atividade do original aparece em UM ÚNICO cargo. Nunca repita a mesma atividade em dois cargos.
- Não deixe nada de fora: todas as atividades, competências, cursos, formações e idiomas.

FORMATO DA RESPOSTA (somente este JSON):
{
  "dados_extraidos": {
    "nome": "", "titulo": "",
    "contato": { "cidade": "", "telefone": "", "email": "", "linkedin": "" },
    "resumo": "",
    "competencias": [""],
    "experiencias": [{ "empresa": "", "cargo": "", "inicio": "MM/AAAA", "fim": "MM/AAAA ou Atual", "atribuicao_incerta": false, "bullets": [""] }],
    "formacao": [{ "curso": "", "instituicao": "", "inicio": "", "fim": "" }],
    "cursos": [{ "nome": "", "instituicao": "", "ano": "" }],
    "idiomas": [{ "idioma": "", "nivel": "" }]
  }
}`;
  return { sistema, leitura };
}

function listaGemini(): string[] {
  const extras = (process.env.GEMINI_MODELS || '').split(/[,;\n]/).map(x => x.trim()).filter(Boolean);
  return [...new Set([process.env.GEMINI_MODEL?.trim(), ...extras, ...MODELOS_GEMINI_PADRAO].filter((x): x is string => !!x))];
}
function erro(message: string, trocarModelo = true, cooldownSegundos = 180): Falha {
  return Object.assign(new Error(message), { trocarModelo, cooldownSegundos });
}
function restante(modelo: string) {
  const ate = cooldowns.get(modelo) || 0;
  if (ate <= Date.now()) { cooldowns.delete(modelo); return 0; }
  return Math.ceil((ate - Date.now()) / 1000);
}
function marcarCooldown(modelo: string, segundos: number) {
  cooldowns.set(modelo, Date.now() + Math.max(60, Math.min(segundos, 86_400)) * 1000);
}
function extrairJson(texto: string): any {
  const limpo = texto.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const inicio = limpo.indexOf('{');
  const fim = limpo.lastIndexOf('}');
  if (inicio < 0 || fim <= inicio) throw erro('A IA respondeu sem um objeto JSON válido.', true, 300);
  let obj: any;
  try { obj = JSON.parse(limpo.slice(inicio, fim + 1)); }
  catch { throw erro('A IA respondeu, mas o conteúdo não veio em JSON válido.', true, 300); }
  if (!obj?.dados_extraidos || typeof obj.dados_extraidos !== 'object') throw erro('A resposta não contém o campo dados_extraidos esperado.', true, 300);
  return obj.dados_extraidos;
}

async function chamarGemini(modelo: string, pdfBase64: string, apiKey: string, deadline: number) {
  const timeout = Math.max(1000, Math.min(TEMPO_POR_MODELO_MS, deadline - Date.now()));
  let response: Response;
  try {
    const { sistema, leitura } = prompts();
    response = await fetch(`${GEMINI_URL}${encodeURIComponent(modelo)}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: sistema }] },
        contents: [{ role: 'user', parts: [{ inline_data: { mime_type: 'application/pdf', data: pdfBase64 } }, { text: leitura }] }],
        generationConfig: { maxOutputTokens: 16384, responseMimeType: 'application/json' }
      }), cache: 'no-store', signal: AbortSignal.timeout(timeout)
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Falha de comunicação';
    throw erro(`Gemini ${modelo}: ${msg}`, true, 120);
  }
  const raw = await response.text();
  let payload: any = {};
  try { payload = raw ? JSON.parse(raw) : {}; } catch { throw erro(`Gemini ${modelo}: resposta HTTP inválida.`, true, 300); }
  if (!response.ok) {
    const detalhe = payload?.error?.message || `HTTP ${response.status}`;
    const esperaMatch = /"retryDelay"\s*:\s*"(\d+)s"/.exec(raw);
    const espera = esperaMatch ? Number(esperaMatch[1]) : (response.status === 429 ? 3600 : 300);
    throw erro(`Gemini ${modelo}: ${detalhe}`, [429, 404, 500, 503].includes(response.status), response.status === 404 ? 21_600 : espera);
  }
  const texto = payload?.candidates?.[0]?.content?.parts?.filter((p: any) => p.text && !p.thought).map((p: any) => p.text).join('') || '';
  if (!texto) throw erro(`Gemini ${modelo} retornou sem texto.`, true, 300);
  return { dados: extrairJson(texto), provedor: 'Gemini', modelo, uso: payload?.usageMetadata || null };
}

async function chamarAnthropic(pdfBase64: string, apiKey: string, deadline: number) {
  const modelo = modeloAnthropic();
  const timeout = Math.max(1000, Math.min(TEMPO_ANTHROPIC_MS, deadline - Date.now()));
  const { sistema, leitura } = prompts();
  let response: Response;
  try {
    response = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: modelo,
        max_tokens: 16000,
        system: sistema,
        messages: [{ role: 'user', content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
          { type: 'text', text: leitura }
        ] }]
      }), cache: 'no-store', signal: AbortSignal.timeout(timeout)
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Falha de comunicação';
    throw new Error(`Anthropic (${modelo}): ${msg}`);
  }
  const raw = await response.text();
  let payload: any = {};
  try { payload = raw ? JSON.parse(raw) : {}; } catch { throw new Error(`Anthropic (${modelo}) retornou resposta inválida.`); }
  if (!response.ok) {
    const detalhe = payload?.error?.message || `HTTP ${response.status}`;
    throw new Error(`Anthropic (${modelo}): ${detalhe}`);
  }
  const texto = payload?.content?.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('') || '';
  if (!texto) throw new Error(`Anthropic (${modelo}) retornou sem texto.`);
  return { dados: extrairJson(texto), provedor: 'Anthropic', modelo, uso: payload?.usage || null };
}

export async function extrairCurriculo(pdfBase64: string) {
  const inicio = Date.now();
  const deadline = inicio + TEMPO_TOTAL_MS;
  const geminiKey = process.env.GEMINI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const falhas: string[] = [];

  if (geminiKey) {
    const modelos = listaGemini();
    const disponiveis = modelos.filter(m => restante(m) === 0);
    if (!disponiveis.length) falhas.push('Todos os modelos Gemini estão em cooldown.');
    const limiteGemini = Math.min(deadline - (anthropicKey ? TEMPO_ANTHROPIC_MS : 0), inicio + TEMPO_GEMINI_MS);
    for (const modelo of disponiveis) {
      if (Date.now() + 1000 >= limiteGemini) break;
      console.log(`[OtimizaCV] Tentando Gemini: ${modelo}`);
      try {
        const resultado = await chamarGemini(modelo, pdfBase64, geminiKey, limiteGemini);
        console.log(`[OtimizaCV] Sucesso: Gemini/${modelo}`);
        return { ...resultado, duracaoMs: Date.now() - inicio };
      } catch (e) {
        const f = e as Falha;
        falhas.push(f.message);
        if (f.trocarModelo) marcarCooldown(modelo, f.cooldownSegundos || 300);
        else { console.warn(`[OtimizaCV] Erro não recuperável no Gemini; interrompendo tentativas Gemini: ${f.message}`); break; }
        console.warn(`[OtimizaCV] Gemini ${modelo} falhou: ${f.message}`);
      }
    }
  } else {
    falhas.push('GEMINI_API_KEY não configurada.');
  }

  if (anthropicKey && Date.now() + 1000 < deadline) {
    console.log('[OtimizaCV] Acionando fallback Anthropic.');
    try {
      const resultado = await chamarAnthropic(pdfBase64, anthropicKey, deadline);
      console.log(`[OtimizaCV] Sucesso: Anthropic/${resultado.modelo}`);
      return { ...resultado, duracaoMs: Date.now() - inicio };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha desconhecida na Anthropic.';
      falhas.push(msg);
      console.error(`[OtimizaCV] Anthropic falhou: ${msg}`);
    }
  } else if (!anthropicKey) {
    falhas.push('ANTHROPIC_API_KEY não configurada; fallback Anthropic desativado.');
  }

  throw new Error(`Nenhum provedor conseguiu concluir a extração. ${falhas.join(' | ')}`);
}


export async function consultarIA(prompt: string, etapa: string) {
  const inicio = Date.now();
  const deadline = inicio + TEMPO_ETAPA_TOTAL_MS;
  const geminiKey = process.env.GEMINI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const falhas: string[] = [];
  const limiteGemini = Math.min(
    deadline - (anthropicKey ? TEMPO_ETAPA_ANTHROPIC_MS : 0),
    inicio + TEMPO_ETAPA_GEMINI_MS
  );

  if (geminiKey) {
    const modelos = listaGemini().filter((modelo) => restante(modelo) === 0);
    if (!modelos.length) falhas.push('Todos os modelos Gemini estão em cooldown.');

    for (const modelo of modelos) {
      const tempoRestante = limiteGemini - Date.now();
      if (tempoRestante < 1_000) break;
      const timeout = Math.min(TEMPO_ETAPA_POR_MODELO_MS, tempoRestante);

      try {
        const response = await fetch(`${GEMINI_URL}${encodeURIComponent(modelo)}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 12000, responseMimeType: 'application/json' }
          }),
          cache: 'no-store',
          signal: AbortSignal.timeout(timeout)
        });

        const raw = await response.text();
        let payload: any = {};
        try { payload = raw ? JSON.parse(raw) : {}; } catch { /* tratado como resposta inválida */ }

        if (!response.ok) {
          const detalhe = payload?.error?.message || `HTTP ${response.status}`;
          falhas.push(`Gemini ${modelo}: ${detalhe}`);
          if ([401, 403, 400].includes(response.status)) break;
          const cooldown = response.status === 404 ? 21_600 : response.status === 429 ? 3_600 : 180;
          marcarCooldown(modelo, cooldown);
          continue;
        }

        const texto = payload?.candidates?.[0]?.content?.parts
          ?.filter((item: any) => item.text && !item.thought)
          .map((item: any) => item.text)
          .join('') || '';
        if (!texto) {
          falhas.push(`Gemini ${modelo}: resposta vazia`);
          marcarCooldown(modelo, 180);
          continue;
        }
        return { texto, provedor: 'Gemini', modelo, uso: payload.usageMetadata || {}, duracaoMs: Date.now() - inicio };
      } catch (e) {
        const mensagem = e instanceof Error ? e.message : 'erro de comunicação';
        falhas.push(`Gemini ${modelo}: ${mensagem}`);
        marcarCooldown(modelo, 120);
      }
    }
  } else {
    falhas.push('GEMINI_API_KEY não configurada.');
  }

  if (anthropicKey && Date.now() + 1_000 < deadline) {
    const modelo = modeloAnthropic();
    const timeout = Math.max(1_000, Math.min(TEMPO_ETAPA_ANTHROPIC_MS, deadline - Date.now()));
    try {
      const response = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: modelo,
          max_tokens: 12000,
          system: 'Responda somente com JSON válido, em português do Brasil. Não invente fatos.',
          messages: [{ role: 'user', content: prompt }]
        }),
        cache: 'no-store',
        signal: AbortSignal.timeout(timeout)
      });
      const raw = await response.text();
      let payload: any = {};
      try { payload = raw ? JSON.parse(raw) : {}; } catch { throw new Error('resposta inválida'); }
      if (!response.ok) throw new Error(payload?.error?.message || `HTTP ${response.status}`);
      const texto = (payload?.content || []).filter((item: any) => item.type === 'text').map((item: any) => item.text).join('');
      if (!texto) throw new Error('resposta vazia');
      return { texto, provedor: 'Anthropic', modelo, uso: payload.usage || {}, duracaoMs: Date.now() - inicio };
    } catch (e) {
      falhas.push(`Anthropic: ${e instanceof Error ? e.message : 'erro'}`);
    }
  } else if (!anthropicKey) {
    falhas.push('ANTHROPIC_API_KEY não configurada; fallback Anthropic desativado.');
  }

  throw new Error(`Nenhuma IA concluiu a etapa ${etapa}. ${falhas.join(' | ') || 'Configure GEMINI_API_KEY ou ANTHROPIC_API_KEY.'}`);
}

/** Auditoria visual do arquivo original: envia PDF junto com o prompt, como o Apps Script fazia. */
export async function consultarIAComPdf(prompt: string, pdfBase64: string, etapa: string) {
  const inicio = Date.now();
  const deadline = inicio + TEMPO_ETAPA_TOTAL_MS;
  const geminiKey = process.env.GEMINI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const falhas: string[] = [];
  const limiteGemini = Math.min(
    deadline - (anthropicKey ? TEMPO_ETAPA_ANTHROPIC_MS : 0),
    inicio + TEMPO_ETAPA_GEMINI_MS
  );

  if (geminiKey) {
    const modelos = listaGemini().filter((modelo) => restante(modelo) === 0);
    if (!modelos.length) falhas.push('Todos os modelos Gemini estão em cooldown.');

    for (const modelo of modelos) {
      const tempoRestante = limiteGemini - Date.now();
      if (tempoRestante < 1_000) break;
      const timeout = Math.min(TEMPO_ETAPA_POR_MODELO_MS, tempoRestante);
      try {
        const response = await fetch(`${GEMINI_URL}${encodeURIComponent(modelo)}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: 'Você é especialista em recrutamento e ATS no Brasil. Responda somente JSON válido. Não invente informações.' }] },
            contents: [{ role: 'user', parts: [{ inline_data: { mime_type: 'application/pdf', data: pdfBase64 } }, { text: prompt }] }],
            generationConfig: { maxOutputTokens: 16000, responseMimeType: 'application/json' }
          }),
          cache: 'no-store',
          signal: AbortSignal.timeout(timeout)
        });
        const raw = await response.text();
        let payload: any = {};
        try { payload = raw ? JSON.parse(raw) : {}; } catch { /* tratado como resposta inválida */ }
        if (!response.ok) {
          const detalhe = payload?.error?.message || `HTTP ${response.status}`;
          falhas.push(`Gemini ${modelo}: ${detalhe}`);
          if ([400, 401, 403].includes(response.status)) break;
          const cooldown = response.status === 404 ? 21_600 : response.status === 429 ? 3_600 : 180;
          marcarCooldown(modelo, cooldown);
          continue;
        }
        const texto = payload?.candidates?.[0]?.content?.parts
          ?.filter((item: any) => item.text && !item.thought)
          .map((item: any) => item.text)
          .join('') || '';
        if (!texto) {
          falhas.push(`Gemini ${modelo}: resposta vazia`);
          marcarCooldown(modelo, 180);
          continue;
        }
        return { texto, provedor: 'Gemini', modelo, uso: payload.usageMetadata || {}, duracaoMs: Date.now() - inicio };
      } catch (e) {
        const mensagem = e instanceof Error ? e.message : 'erro de comunicação';
        falhas.push(`Gemini ${modelo}: ${mensagem}`);
        marcarCooldown(modelo, 120);
      }
    }
  } else {
    falhas.push('GEMINI_API_KEY não configurada.');
  }

  if (anthropicKey && Date.now() + 1_000 < deadline) {
    const modelo = modeloAnthropic();
    const timeout = Math.max(1_000, Math.min(TEMPO_ETAPA_ANTHROPIC_MS, deadline - Date.now()));
    try {
      const response = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: modelo,
          max_tokens: 16000,
          system: 'Você é especialista em recrutamento e ATS no Brasil. Responda somente JSON válido. Não invente informações.',
          messages: [{ role: 'user', content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
            { type: 'text', text: prompt }
          ] }]
        }),
        cache: 'no-store',
        signal: AbortSignal.timeout(timeout)
      });
      const raw = await response.text();
      let payload: any = {};
      try { payload = raw ? JSON.parse(raw) : {}; } catch { throw new Error('resposta inválida'); }
      if (!response.ok) throw new Error(payload?.error?.message || `HTTP ${response.status}`);
      const texto = (payload?.content || []).filter((item: any) => item.type === 'text').map((item: any) => item.text).join('');
      if (!texto) throw new Error('resposta vazia');
      return { texto, provedor: 'Anthropic', modelo, uso: payload.usage || {}, duracaoMs: Date.now() - inicio };
    } catch (e) {
      falhas.push(`Anthropic: ${e instanceof Error ? e.message : 'erro'}`);
    }
  } else if (!anthropicKey) {
    falhas.push('ANTHROPIC_API_KEY não configurada.');
  }

  throw new Error(`Nenhuma IA conseguiu auditar o PDF na etapa ${etapa}. ${falhas.join(' | ')}`);
}

export function parseJsonIA<T = any>(texto: string): T {
  const limpo = texto.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  const ini=limpo.indexOf('{'), fim=limpo.lastIndexOf('}');
  if (ini<0 || fim<=ini) throw new Error('A IA não retornou um objeto JSON válido.');
  return JSON.parse(limpo.slice(ini,fim+1)) as T;
}
