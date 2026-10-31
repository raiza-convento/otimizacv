import type { NextRequest } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase';

/** Valida o access token enviado pelo cliente diretamente contra o Supabase Auth. */
export async function authenticatedUser(request: NextRequest): Promise<User | null> {
  const authorization = request.headers.get('authorization') || '';
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match) return null;
  const { data, error } = await supabaseAdmin().auth.getUser(match[1]);
  return error ? null : data.user;
}

/** Retorna a análise apenas quando o candidato associado pertence ao usuário autenticado. */
export async function ownedAnalysis(sb: ReturnType<typeof supabaseAdmin>, analysisId: string, userId: string) {
  const { data: analysis, error } = await sb.from('analises')
    .select('*').eq('id', analysisId).maybeSingle();
  if (error || !analysis) return null;
  const { data: candidate, error: candidateError } = await sb.from('candidatos')
    .select('id').eq('id', analysis.candidato_id).eq('auth_user_id', userId).maybeSingle();
  if (candidateError || !candidate) return null;
  return analysis;
}
