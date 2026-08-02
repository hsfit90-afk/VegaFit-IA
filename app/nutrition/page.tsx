"use client";

import { useState, useEffect } from 'react';
import { useAppContext } from '@/app/context/AppContext';
import { Apple, Loader2, Target, Flame, Activity, Info } from 'lucide-react';

interface NutritionData {
  tmb: number;
  get: number;
  targetCalories: number;
  macros: {
    protein: number;
    carbs: number;
    fat: number;
  };
  meals: { name: string; description: string }[];
  tips: string;
}

export default function NutritionPage() {
  const { profile } = useAppContext();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<NutritionData | null>(null);

  useEffect(() => {
    // Tenta carregar do cache local primeiro
    const cached = localStorage.getItem('fitforge_nutrition');
    if (cached) {
      setData(JSON.parse(cached));
    }
  }, []);

  const generateNutrition = async () => {
    if (!profile) return;
    setLoading(true);

    try {
      const response = await fetch('/api/nutrition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile })
      });

      const result = await response.json();
      if (!result.error) {
        setData(result);
        localStorage.setItem('fitforge_nutrition', JSON.stringify(result));
      } else {
        alert("Erro: " + result.error);
      }
    } catch (e) {
      alert("Falha na conexão com a IA.");
    } finally {
      setLoading(false);
    }
  };

  if (!profile) return null;

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto animate-fade-in pb-24">
      <header className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-lg">
            <Apple className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-3xl md:text-4xl font-outfit font-bold">Nutrição Inteligente</h1>
        </div>
        <p className="text-gray-400">Macronutrientes calculados pela IA especificamente para seu objetivo.</p>
      </header>

      {!data && !loading && (
        <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-10 text-center flex flex-col items-center">
          <Apple className="w-16 h-16 text-gray-500 mb-6 opacity-50" />
          <h2 className="text-2xl font-bold mb-4">Descubra sua Dieta Ideal</h2>
          <p className="text-gray-400 max-w-md mx-auto mb-8">
            Vamos usar IA para analisar seu peso ({profile.weight}kg), altura ({profile.height}cm), idade e calcular exatamente quanto você deve comer para atingir: <span className="font-bold text-white">{profile.goal}</span>.
          </p>
          <button onClick={generateNutrition} className="bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold py-4 px-8 rounded-xl flex items-center justify-center gap-2 hover:scale-105 transition-all">
            Calcular Meus Macros
          </button>
        </div>
      )}

      {loading && (
        <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-16 text-center flex flex-col items-center">
          <Loader2 className="w-12 h-12 text-orange-500 animate-spin mb-4" />
          <p className="font-bold text-lg animate-pulse">A IA está processando seu metabolismo...</p>
        </div>
      )}

      {data && !loading && (
        <div className="space-y-8 animate-fade-in">
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-black/40 border border-white/5 rounded-2xl p-6 flex flex-col items-center text-center">
              <Activity className="w-8 h-8 text-blue-400 mb-2" />
              <p className="text-sm text-gray-400">Taxa Metabólica Basal</p>
              <p className="text-2xl font-bold">{data.tmb} <span className="text-sm font-normal text-gray-500">kcal</span></p>
            </div>
            <div className="bg-black/40 border border-white/5 rounded-2xl p-6 flex flex-col items-center text-center">
              <Flame className="w-8 h-8 text-orange-400 mb-2" />
              <p className="text-sm text-gray-400">Gasto Est. Diário (GET)</p>
              <p className="text-2xl font-bold">{data.get} <span className="text-sm font-normal text-gray-500">kcal</span></p>
            </div>
            <div className="bg-gradient-to-br from-orange-500/20 to-red-500/10 border border-orange-500/30 rounded-2xl p-6 flex flex-col items-center text-center">
              <Target className="w-8 h-8 text-orange-500 mb-2" />
              <p className="text-sm text-orange-200">Meta Diária (Calorias)</p>
              <p className="text-3xl font-bold text-white">{data.targetCalories} <span className="text-sm font-normal text-orange-300">kcal</span></p>
            </div>
          </div>

          <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 md:p-8">
            <h3 className="text-xl font-bold mb-6 border-b border-white/10 pb-4">Seus Macronutrientes (Meta Diária)</h3>
            
            <div className="space-y-6">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="font-bold text-red-400">Proteína</span>
                  <span>{data.macros.protein}g</span>
                </div>
                <div className="w-full bg-black/50 h-3 rounded-full overflow-hidden">
                  <div className="bg-red-500 h-full w-[40%]"></div>
                </div>
                <p className="text-xs text-gray-500 mt-2">Essencial para construção muscular.</p>
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <span className="font-bold text-blue-400">Carboidratos</span>
                  <span>{data.macros.carbs}g</span>
                </div>
                <div className="w-full bg-black/50 h-3 rounded-full overflow-hidden">
                  <div className="bg-blue-500 h-full w-[40%]"></div>
                </div>
                <p className="text-xs text-gray-500 mt-2">Sua principal fonte de energia para os treinos.</p>
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <span className="font-bold text-yellow-400">Gorduras</span>
                  <span>{data.macros.fat}g</span>
                </div>
                <div className="w-full bg-black/50 h-3 rounded-full overflow-hidden">
                  <div className="bg-yellow-500 h-full w-[20%]"></div>
                </div>
                <p className="text-xs text-gray-500 mt-2">Regulação hormonal e saúde geral.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6">
              <h3 className="text-lg font-bold mb-4 text-orange-400">Sugestão de Refeições</h3>
              <div className="space-y-4">
                {data.meals.map((meal, i) => (
                  <div key={i} className="bg-black/30 p-4 rounded-xl border border-white/5">
                    <h4 className="font-bold text-sm mb-1">{meal.name}</h4>
                    <p className="text-sm text-gray-400">{meal.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6">
              <h3 className="text-lg font-bold mb-4 text-orange-400">Dica da IA</h3>
              <p className="text-gray-300 leading-relaxed">{data.tips}</p>
              
              <button onClick={generateNutrition} className="w-full mt-8 border border-white/10 hover:bg-white/5 text-gray-300 py-3 rounded-xl transition-all text-sm font-medium">
                Recalcular Dados
              </button>
            </div>
          </div>

          <div className="mt-8 bg-blue-500/10 border border-blue-500/20 rounded-2xl p-5 flex items-start gap-4">
            <Info className="w-6 h-6 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-blue-400 font-bold text-sm mb-1">Aviso Importante</h4>
              <p className="text-sm text-blue-200/70 leading-relaxed">
                As informações geradas acima são baseadas em estimativas de Inteligência Artificial para fins educativos e não substituem o acompanhamento profissional. Para um plano alimentar preciso e seguro para a sua saúde, <strong>consulte sempre um nutricionista.</strong>
              </p>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
