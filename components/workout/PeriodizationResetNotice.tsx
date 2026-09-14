"use client";

import { RefreshCw } from 'lucide-react';
import { INACTIVITY_RESET_DAYS } from '@/lib/periodization';

/**
 * Aviso de que a periodização recomeçou por inatividade.
 *
 * Existe porque, sem ele, o aluno que volta depois de semanas parado vê MENOS séries que da
 * última vez e conclui que o app perdeu os dados dele. A explicação é a parte que importa.
 */
export function PeriodizationResetNotice({
  diasParado,
  onFechar,
}: {
  diasParado: number | null;
  onFechar: () => void;
}) {
  if (diasParado === null) return null;

  return (
    <div className="mb-6 p-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 text-amber-100 flex items-start gap-3">
      <RefreshCw className="w-5 h-5 mt-0.5 shrink-0 text-amber-400" aria-hidden="true" />
      <div className="flex-1 text-sm leading-relaxed">
        <p className="font-semibold text-amber-300 mb-1">Periodização reiniciada</p>
        <p>
          Você ficou <strong>{diasParado} dias</strong> sem treinar. Para voltar com segurança, recomeçamos na <strong>semana 1</strong> —
          as séries de hoje estão mais leves de propósito. Em {INACTIVITY_RESET_DAYS} dias de constância você retoma o ritmo.
        </p>
      </div>
      <button
        onClick={onFechar}
        className="text-amber-300/70 hover:text-amber-200 text-xs font-medium shrink-0"
        aria-label="Fechar aviso"
      >
        OK
      </button>
    </div>
  );
}
