import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';

/**
 * Verifica se o usuário está autenticado via cookies de sessão do Supabase.
 * Use no início de qualquer API route que precise de proteção.
 * 
 * @returns { user, error } — se `error` não for null, retorne-o diretamente como response.
 */
export async function requireAuth(): Promise<
  { user: User; error: null } | { user: null; error: NextResponse }
> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      user: null,
      error: NextResponse.json(
        { error: 'Não autorizado. Faça login para continuar.' },
        { status: 401 }
      ),
    };
  }

  return { user, error: null };
}
