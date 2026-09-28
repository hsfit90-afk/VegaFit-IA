"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/app/context/AppContext';

/**
 * Devolve para a home quem não é master.
 *
 * Esconder o item do menu não protege nada por si só: o endereço continua acessível por link
 * direto, favorito antigo ou histórico do navegador. Uma tela marcada como "em teste"
 * precisa recusar a visita, não só deixar de se anunciar.
 *
 * Isto é proteção de INTERFACE, para o aluno não tropeçar numa tela inacabada — não é
 * barreira de segurança. Quem quisesse mesmo chamaria a rota de API direto. As rotas de IA
 * têm as próprias defesas (sessão, assinatura e limite de uso); aqui o objetivo é que o
 * produto do aluno seja só o que está pronto.
 *
 * Espera o perfil carregar antes de decidir: enquanto `profile` é undefined ninguém é
 * expulso, senão o master seria redirecionado no primeiro instante de cada visita.
 */
export function useSomenteMaster() {
  const { profile } = useAppContext();
  const router = useRouter();

  useEffect(() => {
    if (profile && profile.role !== 'master') {
      router.replace('/');
    }
  }, [profile, router]);

  return profile?.role === 'master';
}
