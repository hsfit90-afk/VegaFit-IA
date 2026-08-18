"use client";

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Dumbbell, Loader2, MailCheck } from 'lucide-react';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);
  const supabase = createClient();

  const searchParams = useSearchParams();
  const trainerId = searchParams.get('trainer');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      }
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else if (data?.session) {
      window.location.href = `/onboarding${trainerId ? `?trainer=${trainerId}` : ''}`;
    } else {
      // BUG FIX: sem sessão significa que o Supabase exige confirmação de e-mail antes do
      // login. Redirecionar para /onboarding aqui não funciona — o middleware barra o acesso
      // (sem sessão) e manda de volta pro /login sem nenhuma explicação. Mostra o aviso certo.
      setNeedsEmailConfirmation(true);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white/[0.03] backdrop-blur-md p-8 rounded-3xl border border-white/10 shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-[#00ff88] to-[#7c3aed] rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-[#7c3aed]/20">
            <Dumbbell className="w-8 h-8 text-black" />
          </div>
          <h1 className="text-3xl font-outfit font-bold text-white mb-2">Criar Conta</h1>
          <p className="text-gray-400 text-center">O primeiro passo para sua melhor versão.</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl mb-6 text-sm text-center">
            {error}
          </div>
        )}

        {needsEmailConfirmation ? (
          <div className="bg-[#00ff88]/10 border border-[#00ff88]/20 text-[#00ff88] p-5 rounded-xl mb-6 text-sm text-center flex flex-col items-center gap-2">
            <MailCheck className="w-8 h-8" />
            <p>Enviamos um link de confirmação para {email}. Abra seu e-mail e clique no link para poder fazer login.</p>
          </div>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#7c3aed] transition-colors"
                placeholder="seu@email.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Senha</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#7c3aed] transition-colors"
                placeholder="••••••••"
                minLength={6}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#00ff88] hover:bg-[#00cc6d] text-black font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Criar Conta'}
            </button>
          </form>
        )}

        <p className="text-center text-gray-400 text-sm">
          Já tem uma conta?{' '}
          <Link href="/login" className="text-[#7c3aed] hover:underline font-medium">
            Fazer login
          </Link>
        </p>
      </div>
    </div>
  );
}
