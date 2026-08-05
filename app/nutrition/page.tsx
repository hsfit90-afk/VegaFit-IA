"use client";

import { useState, useEffect } from 'react';
import { useAppContext } from '@/app/context/AppContext';
import { Apple, Loader2, Target, Flame, Activity, Info } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

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
    <div className="p-6 md:p-10 max-w-4xl mx-auto animate-fade-in pb-32">
      <header className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-lg">
            <Apple className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-3xl md:text-4xl font-outfit font-bold">Nutrição Inteligente</h1>
        </div>
        <p className="text-foreground-muted">Macronutrientes calculados pela IA especificamente para seu objetivo.</p>
      </header>

      {!data && !loading && (
        <Card className="text-center py-16 border-dashed border-2">
          <CardContent className="flex flex-col items-center">
            <Apple className="w-16 h-16 text-foreground-muted mb-6 opacity-50" />
            <h2 className="text-2xl font-bold mb-4 font-outfit">Descubra sua Dieta Ideal</h2>
            <p className="text-foreground-muted max-w-md mx-auto mb-8">
              Vamos usar IA para analisar seu peso ({profile.weight}kg), altura ({profile.height}cm), idade e calcular exatamente quanto você deve comer para atingir: <span className="font-bold text-white">{profile.goal}</span>.
            </p>
            <Button onClick={generateNutrition} size="lg" className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white border-0 shadow-[0_0_20px_rgba(249,115,22,0.3)]">
              Calcular Meus Macros
            </Button>
          </CardContent>
        </Card>
      )}

      {loading && (
        <Card className="text-center py-16 border-dashed border-2">
          <CardContent className="flex flex-col items-center">
            <Loader2 className="w-12 h-12 text-orange-500 animate-spin mb-4" />
            <p className="font-bold text-lg animate-pulse font-outfit">A IA está processando seu metabolismo...</p>
          </CardContent>
        </Card>
      )}

      {data && !loading && (
        <div className="space-y-8 animate-fade-in">
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card variant="glass" className="flex flex-col items-center text-center p-6 border-orange-500/10">
              <Activity className="w-8 h-8 text-blue-400 mb-2" />
              <p className="text-sm text-foreground-muted font-semibold uppercase tracking-wider mb-1">Basal</p>
              <p className="text-2xl font-bold font-mono">{data.tmb} <span className="text-sm font-sans font-normal text-foreground-muted">kcal</span></p>
            </Card>
            <Card variant="glass" className="flex flex-col items-center text-center p-6 border-orange-500/10">
              <Flame className="w-8 h-8 text-orange-400 mb-2" />
              <p className="text-sm text-foreground-muted font-semibold uppercase tracking-wider mb-1">Gasto Diário</p>
              <p className="text-2xl font-bold font-mono">{data.get} <span className="text-sm font-sans font-normal text-foreground-muted">kcal</span></p>
            </Card>
            <Card className="flex flex-col items-center text-center p-6 bg-gradient-to-br from-orange-500/20 to-red-500/10 border-orange-500/30">
              <Target className="w-8 h-8 text-orange-500 mb-2" />
              <p className="text-sm text-orange-200 font-semibold uppercase tracking-wider mb-1">Meta</p>
              <p className="text-3xl font-bold text-white font-mono">{data.targetCalories} <span className="text-sm font-sans font-normal text-orange-300">kcal</span></p>
            </Card>
          </div>

          <Card>
            <CardHeader className="border-b border-border pb-4 mb-6">
              <CardTitle className="text-xl">Seus Macronutrientes (Meta Diária)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="font-bold text-red-400">Proteína</span>
                    <span className="font-mono font-bold">{data.macros.protein}g</span>
                  </div>
                  <div className="w-full bg-surface h-3 rounded-full overflow-hidden border border-border">
                    <div className="bg-gradient-to-r from-red-600 to-red-400 h-full w-[40%]"></div>
                  </div>
                  <p className="text-xs text-foreground-muted mt-2">Essencial para construção muscular.</p>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <span className="font-bold text-blue-400">Carboidratos</span>
                    <span className="font-mono font-bold">{data.macros.carbs}g</span>
                  </div>
                  <div className="w-full bg-surface h-3 rounded-full overflow-hidden border border-border">
                    <div className="bg-gradient-to-r from-blue-600 to-blue-400 h-full w-[40%]"></div>
                  </div>
                  <p className="text-xs text-foreground-muted mt-2">Sua principal fonte de energia para os treinos.</p>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <span className="font-bold text-yellow-400">Gorduras</span>
                    <span className="font-mono font-bold">{data.macros.fat}g</span>
                  </div>
                  <div className="w-full bg-surface h-3 rounded-full overflow-hidden border border-border">
                    <div className="bg-gradient-to-r from-yellow-600 to-yellow-400 h-full w-[20%]"></div>
                  </div>
                  <p className="text-xs text-foreground-muted mt-2">Regulação hormonal e saúde geral.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-orange-400">Sugestão de Refeições</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {data.meals.map((meal, i) => (
                  <div key={i} className="bg-surface p-4 rounded-xl border border-border">
                    <h4 className="font-bold text-sm mb-1">{meal.name}</h4>
                    <p className="text-sm text-foreground-muted">{meal.description}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-orange-400">Dica da IA</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-300 leading-relaxed mb-6">{data.tips}</p>
                
                <Button onClick={generateNutrition} variant="outline" fullWidth>
                  Recalcular Dados
                </Button>
              </CardContent>
            </Card>
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
