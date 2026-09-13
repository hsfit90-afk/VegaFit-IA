"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Dumbbell, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Field } from '@/components/ui/Field';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  // Confirmação de exclusão de conta. Lido de window.location em vez de useSearchParams pra não
  // exigir um boundary de Suspense nesta página estática. O destino é o login (e não a home)
  // porque, sem sessão, o AppContext manda todo mundo pra cá — na home a mensagem só piscaria.
  const [contaExcluida, setContaExcluida] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('conta') === 'excluida') {
      setContaExcluida(true);
      window.history.replaceState({}, '', '/login'); // não repete o aviso se recarregar
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      // Check if user already has a profile
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('id, role').eq('id', user.id).single();
        if (profile) {
          // App é B2C: só o master tem painel próprio (biblioteca global de exercícios).
          window.location.href = profile.role === 'master' ? '/admin' : '/';
        } else {
          // New user without profile — go directly to onboarding (B2C default)
          window.location.href = '/onboarding';
        }
      } else {
        window.location.href = '/';
      }
    }
  };

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <div className="min-h-screen bg-[var(--color-background-deep)] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white/[0.03] backdrop-blur-md p-8 rounded-3xl border border-white/10 shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)] rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-[var(--color-accent)]/20">
            <Dumbbell className="w-8 h-8 text-black" />
          </div>
          <h1 className="text-3xl font-outfit font-bold text-white mb-2">Bem-vindo de volta</h1>
          <p className="text-gray-400 text-center">Entre para continuar sua evolução.</p>
        </div>

        {contaExcluida && (
          <div role="status" className="bg-primary/10 border border-primary/25 text-primary p-4 rounded-xl mb-6 text-sm flex gap-3">
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-1">Conta excluída</p>
              <p className="text-primary/80">
                Seus dados foram apagados permanentemente, incluindo os de saúde. Obrigado por ter treinado com a gente.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl mb-6 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4 mb-6">
          <Field label="Email" htmlFor="login-email">
            <Input
              id="login-email"
              variant="auth"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
            />
          </Field>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="login-senha" className="block text-sm font-medium text-foreground-muted">Senha</label>
              <Link href="/forgot-password" className="text-xs text-[var(--color-primary)] hover:underline">
                Esqueceu sua senha?
              </Link>
            </div>
            <Input
              id="login-senha"
              variant="auth"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <LoadingSpinner tamanho="sm" rotulo="Entrando…" /> : 'Entrar'}
          </button>
        </form>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-[var(--color-background-deep)] text-gray-500">Ou continue com</span>
          </div>
        </div>

        <button
          onClick={handleGoogleLogin}
          className="w-full bg-white text-black font-semibold py-3 rounded-xl transition-colors hover:bg-gray-100 flex items-center justify-center gap-2 mb-6"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Google
        </button>

        <p className="text-center text-gray-400 text-sm">
          Ainda não tem uma conta?{' '}
          <Link href="/register" className="text-[var(--color-primary)] hover:underline font-medium">
            Criar conta
          </Link>
        </p>
      </div>
    </div>
  );
}
