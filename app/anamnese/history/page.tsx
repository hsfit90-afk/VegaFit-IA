"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAppContext } from '@/app/context/AppContext';
import { anamneseSteps } from '@/lib/anamneseSteps';
import Link from 'next/link';
import { ArrowLeft, TrendingDown, TrendingUp, ClipboardList, ChevronDown, ChevronUp } from 'lucide-react';

interface AnamneseHistoryEntry {
  id: string;
  answers: Record<string, any>;
  summary_text: string | null;
  created_at: string;
}

const numericFieldIds = new Set(
  anamneseSteps.flatMap(step => step.fields.filter(f => f.type === 'number' || f.type === 'rcq-result').map(f => f.id))
);

function fieldLabel(id: string): string {
  for (const step of anamneseSteps) {
    const f = step.fields.find(f => f.id === id);
    if (f) return f.label;
  }
  return id;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function AnamneseHistoryPage() {
  const { userId } = useAppContext();
  const supabase = createClient();
  const [entries, setEntries] = useState<AnamneseHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from('anamnese_history')
      .select('id, answers, summary_text, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setEntries(data || []);
        setLoading(false);
      });
  }, [userId, supabase]);

  const newestFirst = [...entries].reverse();

  return (
    <div className="min-h-screen bg-background text-foreground p-5 md:p-8 max-w-2xl mx-auto pb-32">
      <Link href="/settings" className="inline-flex items-center gap-2 text-foreground-muted hover:text-white text-sm mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Voltar para Configurações
      </Link>

      <h1 className="text-2xl md:text-3xl font-outfit font-bold mb-1">Histórico de Anamnese</h1>
      <p className="text-foreground-muted text-sm mb-8">Acompanhe como suas respostas mudaram ao longo do tempo.</p>

      {loading ? (
        <div className="text-center text-foreground-muted py-12 text-sm">Carregando...</div>
      ) : entries.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-8 text-center">
          <ClipboardList className="w-10 h-10 text-foreground-muted opacity-30 mx-auto mb-3" />
          <p className="text-white font-medium mb-1">Nenhuma anamnese registrada ainda.</p>
          <p className="text-sm text-foreground-muted">Assim que você preencher a anamnese, ela aparece aqui.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {newestFirst.map((entry, i) => {
            // índice cronológico (mais antigo primeiro) para achar o registro anterior
            const chronoIndex = entries.findIndex(e => e.id === entry.id);
            const previous = chronoIndex > 0 ? entries[chronoIndex - 1] : null;

            const diffs = previous
              ? Object.keys(entry.answers)
                  .filter(id => numericFieldIds.has(id))
                  .map(id => {
                    const before = parseFloat(previous.answers[id]);
                    const after = parseFloat(entry.answers[id]);
                    if (isNaN(before) || isNaN(after) || before === after) return null;
                    return { id, before, after, delta: after - before };
                  })
                  .filter((d): d is { id: string; before: number; after: number; delta: number } => d !== null)
              : [];

            const isExpanded = expandedId === entry.id;

            return (
              <div key={entry.id} className="bg-surface border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-white">{formatDate(entry.created_at)}</span>
                  {i === 0 && <span className="text-[11px] uppercase tracking-wider text-primary font-semibold">Mais recente</span>}
                </div>

                {diffs.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2 mb-1">
                    {diffs.map(d => (
                      <span
                        key={d.id}
                        className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border ${
                          d.delta < 0 ? 'text-primary border-primary/30 bg-primary/10' : 'text-orange-400 border-orange-400/30 bg-orange-400/10'
                        }`}
                      >
                        {d.delta < 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                        {fieldLabel(d.id)}: {d.before} → {d.after}
                      </span>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  className="flex items-center gap-1 text-xs text-foreground-muted hover:text-white mt-2 transition-colors"
                >
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  {isExpanded ? 'Ocultar respostas completas' : 'Ver respostas completas'}
                </button>

                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-border space-y-3">
                    {anamneseSteps.map(step => {
                      const rows = step.fields.filter(f => {
                        const v = entry.answers[f.id];
                        return v !== undefined && v !== "" && (!Array.isArray(v) || v.length > 0);
                      });
                      if (rows.length === 0) return null;
                      return (
                        <div key={step.id}>
                          <h4 className="font-outfit text-[12px] font-semibold uppercase tracking-[0.08em] text-primary mb-1.5">{step.title}</h4>
                          {rows.map(f => {
                            const v = entry.answers[f.id];
                            return (
                              <div key={f.id} className="flex justify-between gap-3 py-1 text-sm">
                                <span className="text-foreground-muted flex-shrink-0 w-[46%]">{f.label}</span>
                                <span className="text-foreground text-right break-words">{Array.isArray(v) ? v.join(", ") : v}</span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
