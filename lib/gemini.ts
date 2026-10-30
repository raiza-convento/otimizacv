const URL_GEMINI = 'https://generativelanguage.googleapis.com/v1beta/models/';
const TIMEOUT_MS = 18_000;
const MAX_TENTATIVAS_TEMPORARIAS = 2;
const TEMPO_MAXIMO_FALLBACK_MS = 55_000;

// Mesma ordem de fallback do Apps Script original. O GEMINI_MODEL sempre vem primeiro.
const MODELOS_PADRAO = [
  'gemini-3.8-flash',
  'gemini-3-flash-preview',
  'gemini-3.6-flash',
  'gemini-2.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash-lite',
  'gemini-flash-lite-latest'
];

// Cache em memória por processo. No Supabase, depois, isso poderá virar um controle persistente.
const modelosEmCooldown = new Map<string, number>();

type ErroGemini = Error & {
  trocarModelo?: boolean;
  cooldownSegundos?: number;
  codigoHttp?: number;
};

function sistemaBase(): string {
  const hoje = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  return `Você é especialista em recrutamento e em sistemas de triagem de currículos (ATS) usados no Brasil, como Gupy, InHire, Vagas, Sólides, Workday e Greenhouse. Seu trabalho é mostrar ao candidato, com clareza e sem jargão, o que no currículo dele pode atrapalhar a leitura automática, o ranqueamento e a leitura do recrutador.

DATA DE HOJE: ${hoje}. Qualquer data até hoje é válida e já aconteceu. Não aponte datas como "no futuro" a menos que sejam posteriores a ${hoje}.

REGRAS INVIOLÁVEIS:
1. Nunca invente informação sobre o candidato: cargos, datas, números, ferramentas, resultados ou formação. Se algo útil não está no currículo, transforme em PERGUNTA, nunca em afirmação.
2. Todo problema apontado precisa de evidência real no currículo.
3. Quando a correção precisar de um dado que você não tem, não invente nem use marcadores: deixe a correção vazia e diga que depende do candidato.
4. Escreva em português do Brasil, em linguagem simples, como quem explica para o próprio candidato.
5. Responda SOMENTE com um JSON válido, no formato pedido, sem nenhum texto fora dele.`;
}

const PROMPT_LEITURA = `Você recebe o ARQUIVO ORIGINAL do currículo, anexado.
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

function listaModelos(): string[] {
  const configurados = (process.env.GEMINI_MODELS || '')
    .split(/[,;\n]/).map(s => s.trim()).filter(Boolean);
  const lista = [process.env.GEMINI_MODEL?.trim(), ...configurados, ...MODELOS_PADRAO]
    .filter((m): m is string => Boolean(m));
  return [...new Set(lista)];
}

function cooldownRestante(modelo: string): number {
  const ate = modelosEmCooldown.get(modelo) || 0;
  if (ate <= Date.now()) {
    modelosEmCooldown.delete(modelo);
    return 0;
  }
  return Math.ceil((ate - Date.now()) / 1000);
}

function colocarEmCooldown(modelo: string, segundos: number) {
  // Limite superior de 24h; respeita o retry informado pelo Google para cotas diárias.
  const seg = Math.max(60, Math.min(Math.ceil(segundos), 86_400));
  modelosEmCooldown.set(modelo, Date.now() + seg * 1000);
}

function segundosParaTentarNovamente(texto: string): number {
  const retryDelay = /"retryDelay"\s*:\s*"(\d+)(?:\.\d+)?s"/.exec(texto);
  if (retryDelay) return Number(retryDelay[1]);
  const retryIn = /retry in\s*(?:(\d+)h)?\s*(?:(\d+)m(?!s))?\s*(?:([\d.]+)s)?/i.exec(texto);
  if (retryIn && (retryIn[1] || retryIn[2] || retryIn[3])) {
    return (Number(retryIn[1]) || 0) * 3600 + (Number(retryIn[2]) || 0) * 60 + Math.ceil(Number(retryIn[3]) || 0);
  }
  return 3600;
}

function criarErro(message: string, extras: Partial<ErroGemini> = {}): ErroGemini {
  return Object.assign(new Error(message), extras);
}

async function chamarModelo(modelo: string, pdfBase64: string, apiKey: string, prazoFinal: number) {
  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS_TEMPORARIAS; tentativa++) {
    const tempoRestante = prazoFinal - Date.now();
    if (tempoRestante < 1_000) throw criarErro('Tempo máximo de tentativa dos modelos atingido.', { trocarModelo: true, cooldownSegundos: 60 });
    let response: Response;
    try {
      response = await fetch(`${URL_GEMINI}${encodeURIComponent(modelo)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: sistemaBase() }] },
          contents: [{ role: 'user', parts: [
            { inline_data: { mime_type: 'application/pdf', data: pdfBase64 } },
            { text: PROMPT_LEITURA }
          ] }],
          generationConfig: { maxOutputTokens: 16384, responseMimeType: 'application/json' }
        }),
        cache: 'no-store',
        signal: AbortSignal.timeout(Math.min(TIMEOUT_MS, tempoRestante))
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Falha de comunicação com o Gemini.';
      if (tentativa < MAX_TENTATIVAS_TEMPORARIAS && !/timeout|aborted/i.test(msg) && prazoFinal - Date.now() > 2_000) {
        await new Promise(resolve => setTimeout(resolve, 1000 * tentativa));
        continue;
      }
      throw criarErro(`Falha de comunicação com ${modelo}: ${msg}`, {
        trocarModelo: true, cooldownSegundos: 120
      });
    }

    const raw = await response.text();
    let payload: any = {};
    try { payload = raw ? JSON.parse(raw) : {}; }
    catch { throw criarErro(`${modelo} retornou uma resposta inválida (HTTP ${response.status}).`, { trocarModelo: true, cooldownSegundos: 300 }); }

    if (!response.ok) {
      const detalhe = payload?.error?.message || `HTTP ${response.status}`;
      console.warn(`[OtimizaCV] ${modelo} falhou: HTTP ${response.status} - ${detalhe.slice(0, 350)}`);

      if (response.status === 429) {
        const espera = segundosParaTentarNovamente(raw);
        throw criarErro(`${modelo}: cota/limite atingido.`, {
          trocarModelo: true, cooldownSegundos: espera, codigoHttp: 429
        });
      }
      if ([404, 500, 503].includes(response.status)) {
        throw criarErro(`${modelo}: ${detalhe}`, {
          trocarModelo: true,
          cooldownSegundos: response.status === 404 ? 21_600 : 300,
          codigoHttp: response.status
        });
      }
      throw criarErro(`Erro no Gemini (${modelo}): ${detalhe}`, { codigoHttp: response.status });
    }

    const texto = payload?.candidates?.[0]?.content?.parts
      ?.filter((p: { text?: string; thought?: boolean }) => p.text && !p.thought)
      .map((p: { text: string }) => p.text).join('');
    if (!texto) {
      const motivo = payload?.candidates?.[0]?.finishReason || 'não informado';
      throw criarErro(`${modelo} respondeu sem texto. Motivo: ${motivo}.`, { trocarModelo: true, cooldownSegundos: 300 });
    }

    let parsed: any;
    try { parsed = JSON.parse(texto); }
    catch { throw criarErro(`${modelo} respondeu, mas não produziu JSON válido.`, { trocarModelo: true, cooldownSegundos: 300 }); }
    if (!parsed?.dados_extraidos || typeof parsed.dados_extraidos !== 'object') {
      throw criarErro(`${modelo} não devolveu o campo dados_extraidos esperado.`, { trocarModelo: true, cooldownSegundos: 300 });
    }
    return { dados: parsed.dados_extraidos, modelo };
  }
  throw criarErro(`${modelo} não respondeu após as tentativas.`, { trocarModelo: true, cooldownSegundos: 120 });
}

export async function extrairCurriculo(pdfBase64: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Configure GEMINI_API_KEY no arquivo .env.local para habilitar a análise.');

  const todos = listaModelos();
  const disponiveis = todos.filter(m => cooldownRestante(m) === 0);
  if (!disponiveis.length) {
    const menorEspera = Math.min(...todos.map(cooldownRestante));
    throw new Error(`Todos os modelos Gemini estão temporariamente indisponíveis. Próxima tentativa em aproximadamente ${Math.ceil(menorEspera / 60)} minuto(s).`);
  }
  const pulados = todos.filter(m => !disponiveis.includes(m));
  if (pulados.length) console.log(`[OtimizaCV] Modelos em cooldown, pulando: ${pulados.join(', ')}`);

  const falhas: string[] = [];
  const prazoFinal = Date.now() + TEMPO_MAXIMO_FALLBACK_MS;
  for (const modelo of disponiveis) {
    if (Date.now() >= prazoFinal) {
      falhas.push('Tempo total reservado para fallback esgotado.');
      break;
    }
    console.log(`[OtimizaCV] Tentando modelo: ${modelo}`);
    try {
      const resultado = await chamarModelo(modelo, pdfBase64, apiKey, prazoFinal);
      console.log(`[OtimizaCV] Sucesso com modelo: ${modelo}`);
      return resultado;
    } catch (error) {
      const e = error as ErroGemini;
      if (!e.trocarModelo) throw error;
      colocarEmCooldown(modelo, e.cooldownSegundos || 300);
      falhas.push(`${modelo}: ${e.message}`);
      console.warn(`[OtimizaCV] Pulando ${modelo}; tentando o próximo da lista.`);
    }
  }

  throw new Error(`Nenhum modelo Gemini da lista conseguiu concluir a análise. ${falhas.join(' | ')}`);
}
