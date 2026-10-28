"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { Dumbbell, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Field } from '@/components/ui/Field';
import { traduzirErro } from '@/utils/mensagensDeErro';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { LARGURA_AUTH } from '@/lib/layout';
import { Button } from '@/components/ui/Button';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setHasSession(!!user);
    });
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError(traduzirErro(error));
    } else {
      setSuccess(true);
      setTimeout(() => router.push('/login'), 2500);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-background-deep)] flex flex-col items-center justify-center p-5">
      <div className={`w-full ${LARGURA_AUTH} bg-white/[0.03] backdrop-blur-md p-8 rounded-xl border border-white/10 shadow-2xl`}>
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)] rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-[var(--color-accent)]/20">
            <Dumbbell className="w-8 h-8 text-black" />
          </div>
          <h1 className="text-3xl font-outfit font-bold text-white mb-2">Nova senha</h1>
          <p className="text-foreground-muted text-center">Defina a nova senha para sua conta.</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-5 rounded-xl mb-6 text-sm text-center">
            {error}
          </div>
        )}

        {success ? (
          <div className="bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 text-[var(--color-primary)] p-5 rounded-xl text-sm text-center flex flex-col items-center gap-2">
            <CheckCircle2 className="w-8 h-8" />
            <p>Senha atualizada! Redirecionando para o login...</p>
          </div>
        ) : hasSession === false ? (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-5 rounded-xl text-sm text-center">
            Este link de redefinição expirou ou é inválido. Solicite um novo em &quot;Esqueceu sua senha?&quot; na tela de login.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Nova senha" htmlFor="reset-password-nova-senha">
              <Input id="reset-password-nova-senha" variant="auth" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </Field>
            <Field label="Confirmar nova senha" htmlFor="reset-password-confirmar-nova-senha">
              <Input id="reset-password-confirmar-nova-senha" variant="auth" type="password" required minLength={6} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" />
            </Field>
            <Button
              type="submit"
              fullWidth
              disabled={loading || hasSession === null}
              className="gap-2"
            >
              {loading ? <LoadingSpinner tamanho="sm" cor="herdada" rotulo="Salvando…" /> : 'Salvar nova senha'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
