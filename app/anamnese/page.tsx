"use client";

import React, { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/app/context/AppContext';
import { Check } from 'lucide-react';
import { anamneseSteps as steps } from '@/lib/anamneseSteps';

export default function AnamnesePage() {
  const router = useRouter();
  const supabase = createClient();
  const { profile, userId } = useAppContext();

  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [reviewMode, setReviewMode] = useState(false);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [toastMessage, setToastMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Filtra apenas os passos ativos (ex: ciclo feminino)
  const activeSteps = steps.filter(s => !s.condition || s.condition(answers));
  const currentStep = activeSteps[currentStepIndex] || activeSteps[0];

  // Configura valores default (ex: sliders)
  useEffect(() => {
    const newAnswers = { ...answers };
    let changed = false;
    activeSteps.forEach(step => {
      step.fields.forEach(f => {
        if (f.type === 'slider' && newAnswers[f.id] === undefined) {
          newAnswers[f.id] = f.defaultValue || 5;
          changed = true;
        }
      });
    });
    if (changed) setAnswers(newAnswers);
  }, [activeSteps, answers]);

  const handleChange = (fieldId: string, value: any) => {
    setAnswers(prev => {
      const next = { ...prev, [fieldId]: value };
      
      // Auto cálculo RCQ
      if (fieldId === 'cintura' || fieldId === 'quadril' || fieldId === 'sexo') {
        const c = parseFloat(next.cintura);
        const q = parseFloat(next.quadril);
        if (c && q) {
          next.rcq = (c / q).toFixed(2);
        } else {
          next.rcq = "";
        }
      }
      return next;
    });
    setErrors(prev => ({ ...prev, [fieldId]: false }));
  };

  const getRcqHint = () => {
    const rcq = parseFloat(answers.rcq);
    if (!rcq) return "Preencha cintura e quadril para calcular";
    const sexo = answers.sexo;
    if (sexo === "Masculino") return rcq >= 0.90 ? "risco aumentado (OMS: ≥0,90)" : "dentro da faixa de referência (OMS: <0,90)";
    if (sexo === "Feminino") return rcq >= 0.85 ? "risco aumentado (OMS: ≥0,85)" : "dentro da faixa de referência (OMS: <0,85)";
    return "informe o sexo biológico no passo 1 para ver a referência da OMS";
  };

  const validateStep = () => {
    let valid = true;
    const newErrors: Record<string, boolean> = {};

    currentStep.fields.forEach(f => {
      if (f.optional) return;
      const val = answers[f.id];
      const empty = val === undefined || val === "" || (Array.isArray(val) && val.length === 0);
      if (empty) {
        valid = false;
        newErrors[f.id] = true;
      }
    });

    setErrors(newErrors);
    return valid;
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3000);
  };

  const handleNext = () => {
    if (reviewMode) return handleSave();

    if (!validateStep()) return;

    if (currentStepIndex < activeSteps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
      window.scrollTo(0, 0);
    } else {
      setReviewMode(true);
      window.scrollTo(0, 0);
    }
  };

  const handleBack = () => {
    if (reviewMode) {
      setReviewMode(false);
      window.scrollTo(0, 0);
      return;
    }
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
      window.scrollTo(0, 0);
    }
  };

  const handleSave = async () => {
    if (!userId) {
      showToast("Você precisa estar logado para salvar.");
      return;
    }
    
    setIsSaving(true);
    
    // Convertendo a anamnese para uma string formatada
    let lines = ["*ANAMNESE DE TREINO*", ""];
    activeSteps.forEach(step => {
      const rows: string[] = [];
      step.fields.forEach(f => {
        const v = answers[f.id];
        const empty = v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
        if (empty) return;
        rows.push(`${f.label}: ${Array.isArray(v) ? v.join(", ") : v}`);
      });
      if (rows.length) {
        lines.push(`— ${step.title.toUpperCase()} —`);
        lines = lines.concat(rows);
        lines.push("");
      }
    });
    const anamneseText = lines.join("\n");

    try {
      // Opcional: Copiar para área de transferência também
      try {
        await navigator.clipboard.writeText(anamneseText);
      } catch (e) {
        // ignora erro de clipboard se o usuário não permitiu
      }

      // Salva no supabase no campo intent (ou um campo novo)
      const { error } = await supabase
        .from('profiles')
        .update({ 
          intent: anamneseText, // Usando o campo intent para guardar a anamnese e alimentar a IA depois
          goal: answers.objetivo?.[0] || profile?.goal,
          level: answers.nivel || profile?.level
        })
        .eq('id', userId);

      if (error) throw error;

      // Guarda um snapshot no histórico (append-only) para permitir comparar anamneses futuras
      await supabase.from('anamnese_history').insert({
        user_id: userId,
        answers,
        summary_text: anamneseText,
      });

      showToast("Respostas salvas e copiadas!");
      setTimeout(() => router.push('/'), 2000);
      
    } catch (err: any) {
      showToast("Erro ao salvar: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Renderização do formulário
  return (
    <div className="min-h-screen bg-background text-foreground font-inter flex flex-col pb-32">
      <style dangerouslySetInnerHTML={{__html: `
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 22px; height: 22px; border-radius: 50%;
          background: var(--color-primary);
          cursor: pointer;
          border: 3px solid var(--color-background);
        }
        input[type="range"]::-moz-range-thumb {
          width: 22px; height: 22px; border-radius: 50%;
          background: var(--color-primary);
          cursor: pointer;
          border: 3px solid var(--color-background);
        }
      `}} />

      {/* HEADER */}
      <header className="sticky top-0 bg-background z-10 px-5 pt-5 pb-3">
        <p className="font-outfit font-semibold text-[13px] tracking-[0.14em] uppercase text-primary mb-3">
          Anamnese de treino
        </p>
        
        {/* Progress Bar */}
        <div className="h-[6px] bg-surface-hover rounded-full overflow-hidden flex gap-[3px]">
          {reviewMode ? (
            Array.from({ length: activeSteps.length + 1 }).map((_, i) => (
              <div key={i} className="flex-1 h-full bg-primary rounded-full transition-colors duration-200" />
            ))
          ) : (
            <>
              {activeSteps.map((_, i) => (
                <div key={i} className={`flex-1 h-full rounded-full transition-colors duration-200 ${i <= currentStepIndex ? 'bg-primary' : 'bg-border'}`} />
              ))}
              <div className="flex-1 h-full bg-border rounded-full" /> {/* Etapa de revisão */}
            </>
          )}
        </div>
        
        <div className="flex justify-between mt-2 text-xs text-foreground-muted/70">
          <span>
            {reviewMode ? 'Revisão final' : `Passo ${currentStepIndex + 1} de ${activeSteps.length}`}
          </span>
          <span>
            {reviewMode ? '100%' : `${Math.round(((currentStepIndex + 1) / (activeSteps.length + 1)) * 100)}%`}
          </span>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 px-5 pt-2">
        {reviewMode ? (
          <div className="animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center mx-auto my-5 text-primary-foreground">
              <Check size={32} strokeWidth={3} />
            </div>
            <h2 className="font-outfit font-semibold text-[22px] leading-[1.2] text-center mt-3 text-white">Tudo pronto</h2>
            <p className="text-sm text-foreground-muted leading-[1.5] text-center mb-6">Confira suas respostas. Elas serão salvas no seu perfil para personalizar seus treinos.</p>

            {activeSteps.map(step => {
              const hasAny = step.fields.some(f => answers[f.id] !== undefined && answers[f.id] !== "" && (!Array.isArray(answers[f.id]) || answers[f.id].length > 0));
              if (!hasAny) return null;
              
              return (
                <div key={step.id} className="bg-surface border border-border rounded-xl p-4 mb-3.5">
                  <h4 className="font-outfit text-[13px] font-semibold uppercase tracking-[0.08em] text-primary mb-2.5">{step.title}</h4>
                  {step.fields.map(f => {
                    const v = answers[f.id];
                    const empty = v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
                    if (empty) return null;
                    return (
                      <div key={f.id} className="flex justify-between gap-3 py-1.5 border-b border-border last:border-0 text-sm">
                        <span className="text-foreground-muted flex-shrink-0 w-[46%]">{f.label}</span>
                        <span className="text-foreground text-right break-words">{Array.isArray(v) ? v.join(", ") : v}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="animate-fade-in">
            <h2 className="font-outfit font-semibold text-[22px] leading-[1.2] mt-3.5 mb-1 text-white">{currentStep?.title}</h2>
            <p className="text-sm text-foreground-muted leading-[1.5] mb-6">{currentStep?.sub}</p>

            {currentStep?.fields.map(f => (
              <div key={f.id} className="mb-6">
                <label className="block text-[15px] font-medium mb-2.5 leading-[1.4] text-white">
                  {f.label} {!f.optional && <span className="text-primary ml-1">*</span>}
                </label>

                {(f.type === 'text' || f.type === 'number') && (
                  <>
                    <input
                      type={f.type}
                      placeholder={f.placeholder}
                      value={answers[f.id] || ''}
                      onChange={e => handleChange(f.id, e.target.value)}
                      className="w-full bg-surface border border-border focus:border-primary rounded-[10px] text-foreground font-inter text-base p-3.5 outline-none transition-colors"
                    />
                    {f.hint && <div className="text-xs text-foreground-muted/70 mt-1.5">{f.hint}</div>}
                  </>
                )}

                {f.type === 'textarea' && (
                  <textarea
                    placeholder={f.placeholder}
                    value={answers[f.id] || ''}
                    onChange={e => handleChange(f.id, e.target.value)}
                    className="w-full bg-surface border border-border focus:border-primary rounded-[10px] text-foreground font-inter text-base p-3.5 outline-none transition-colors resize-y min-h-[88px] leading-[1.5]"
                  />
                )}

                {f.type === 'rcq-result' && (
                  <>
                    <div className="text-left font-outfit text-[28px] font-semibold text-primary my-1">
                      {answers.rcq || '—'}
                    </div>
                    <div className="text-xs text-foreground-muted/70 mt-1.5">{getRcqHint()}</div>
                  </>
                )}

                {(f.type === 'chips-single' || f.type === 'chips-multi') && (
                  <div className="flex flex-wrap gap-2">
                    {f.options?.map(opt => {
                      const isSelected = f.type === 'chips-multi' 
                        ? (answers[f.id] || []).includes(opt)
                        : answers[f.id] === opt;
                      
                      return (
                        <button
                          key={opt}
                          onClick={() => {
                            if (f.type === 'chips-single') {
                              handleChange(f.id, opt);
                            } else {
                              const curr = new Set(answers[f.id] || []);
                              if (curr.has(opt)) curr.delete(opt);
                              else curr.add(opt);
                              handleChange(f.id, Array.from(curr));
                            }
                          }}
                          className={`px-4 py-2.5 rounded-full border text-sm font-medium transition-all ${
                            isSelected 
                              ? 'bg-primary border-primary text-primary-foreground' 
                              : 'bg-surface border-border text-foreground'
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                )}

                {f.type === 'slider' && (
                  <>
                    <div className="text-center font-outfit text-[32px] font-semibold text-primary my-1">
                      {answers[f.id]}
                    </div>
                    <div className="pt-1.5 px-1">
                      <input
                        type="range"
                        min={f.min}
                        max={f.max}
                        step={1}
                        value={answers[f.id]}
                        onChange={e => handleChange(f.id, Number(e.target.value))}
                        className="w-full h-1 bg-border rounded-full appearance-none outline-none accent-primary"
                      />
                      <div className="flex justify-between text-xs text-foreground-muted/70 mt-2">
                        <span>{f.min_label}</span>
                        <span>{f.max_label}</span>
                      </div>
                    </div>
                  </>
                )}

                {errors[f.id] && (
                  <div className="text-destructive text-xs mt-1.5">Esse campo é obrigatório</div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background to-transparent pt-6 pb-20 md:pb-6 pointer-events-none z-20">
        <div className="max-w-[480px] mx-auto px-5 flex gap-2.5 pointer-events-auto">
          {!reviewMode && currentStepIndex > 0 && (
            <button
              onClick={handleBack}
              className="flex-none w-[88px] p-4 rounded-xl font-inter text-[15px] font-semibold border-none cursor-pointer transition-transform active:scale-95 bg-surface-hover text-foreground"
            >
              Voltar
            </button>
          )}
          {reviewMode && (
            <button
              onClick={handleBack}
              className="flex-none w-[88px] p-4 rounded-xl font-inter text-[15px] font-semibold border-none cursor-pointer transition-transform active:scale-95 bg-surface-hover text-foreground"
            >
              Voltar
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={isSaving}
            className="flex-1 p-4 rounded-xl font-inter text-[15px] font-semibold border-none cursor-pointer transition-transform active:scale-95 bg-primary text-primary-foreground disabled:opacity-50 disabled:active:scale-100"
          >
            {isSaving ? 'Salvando...' : (reviewMode ? 'Salvar Perfil' : (currentStepIndex === activeSteps.length - 1 ? 'Revisar' : 'Próximo'))}
          </button>
        </div>
      </footer>

      {/* TOAST */}
      <div className={`fixed bottom-32 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-5 py-3 rounded-full text-sm font-semibold transition-all duration-300 z-50 pointer-events-none ${toastMessage ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'}`}>
        {toastMessage}
      </div>
    </div>
  );
}
