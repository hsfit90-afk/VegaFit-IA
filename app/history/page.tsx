"use client";

import { useState, useMemo } from 'react';
import { useAppContext } from '@/app/context/AppContext';
import { Calendar, Clock, Dumbbell , Timer } from 'lucide-react';
import dynamic from 'next/dynamic';
import { ChartSkeleton } from '@/components/charts/ChartSkeleton';

// recharts (~100 kB) sai do bundle inicial: só baixa quando o gráfico entra na tela.
// ssr:false porque ele depende de medir o container, o que não existe no servidor.
const VolumeHistoryChart = dynamic(() => import('@/components/charts/VolumeHistoryChart'), {
  ssr: false,
  loading: () => <ChartSkeleton />,
});
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';

export default function History() {
  const { history } = useAppContext();

  // Prepare chart data (Volume per workout)
  // Aerobico fica FORA deste grafico: ele e registrado com totalVolume 0 (nao existe carga em kg
  // numa esteira), e um ponto zerado no meio da linha pareceria queda de desempenho.
  // O tempo do aerobico continua no historico, em durationSeconds.
  const fullChartData = useMemo(() => {
    return [...history].reverse().filter(h => h.sessionId !== 'cardio').map((h, i) => {
      const date = new Date(h.date);
      return {
        index: i,
        date: `${date.getDate()}/${date.getMonth()+1}`,
        volume: h.totalVolume,
        name: h.sessionName
      };
    });
  }, [history]);

  const [leftBounds, setLeftBounds] = useState<number | null>(null);
  const [rightBounds, setRightBounds] = useState<number | null>(null);
  const [refAreaLeft, setRefAreaLeft] = useState<number | null>(null);
  const [refAreaRight, setRefAreaRight] = useState<number | null>(null);

  const chartData = useMemo(() => {
    let start = 0;
    let end = fullChartData.length - 1;
    if (leftBounds !== null && rightBounds !== null) {
      start = leftBounds;
      end = rightBounds;
    }
    return fullChartData.slice(start, end + 1);
  }, [fullChartData, leftBounds, rightBounds]);

  const zoom = () => {
    let refLeft = refAreaLeft;
    let refRight = refAreaRight;

    if (refLeft === refRight || refLeft === null || refRight === null) {
      setRefAreaLeft(null);
      setRefAreaRight(null);
      return;
    }

    if (refLeft > refRight) {
      [refLeft, refRight] = [refRight, refLeft];
    }

    setLeftBounds(refLeft);
    setRightBounds(refRight);
    setRefAreaLeft(null);
    setRefAreaRight(null);
  };

  const zoomOut = () => {
    setLeftBounds(null);
    setRightBounds(null);
    setRefAreaLeft(null);
    setRefAreaRight(null);
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    return `${m} min`;
  };

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto animate-fade-in pb-32">
      <PageHeader
        titulo="Histórico de Treinos"
        subtitulo="Acompanhe sua evolução ao longo do tempo"
      />

      {history.length > 0 ? (
        <>
          <Card className="mb-10">
            <CardHeader className="flex flex-row justify-between items-center pb-2">
               <CardTitle className="text-primary m-0">Progressão de Volume (kg)</CardTitle>
               {(leftBounds !== null || rightBounds !== null) && (
                 <Button 
                   onClick={zoomOut}
                   variant="outline"
                   size="sm"
                 >
                   Remover Zoom
                 </Button>
               )}
            </CardHeader>
            <CardContent>
               <p className="text-sm text-foreground-muted mb-6">Clique e arraste no gráfico para focar em um período específico.</p>
               <div className="h-[300px] w-full select-none">
                 <VolumeHistoryChart
                   chartData={chartData}
                   fullChartData={fullChartData}
                   refAreaLeft={refAreaLeft}
                   refAreaRight={refAreaRight}
                   onRefAreaLeft={setRefAreaLeft}
                   onRefAreaRight={setRefAreaRight}
                   onZoom={zoom}
                 />
               </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <h2 className="font-outfit text-xl font-semibold mb-4">Treinos Realizados</h2>
            {history.map(h => (
              <details key={h.id} className="bg-surface border border-border rounded-2xl group overflow-hidden transition-all shadow-sm">
                <summary className="p-5 flex flex-col md:flex-row md:items-center justify-between cursor-pointer hover:bg-surface-light transition-all list-none">
                  <div>
                    <h3 className="font-outfit font-semibold text-lg text-white mb-1">{h.sessionName}</h3>
                    <p className="text-sm text-foreground-muted">{h.workoutPlanName}</p>
                  </div>
                  <div className="flex gap-4 mt-3 md:mt-0 text-sm font-medium text-foreground-muted">
                    <span className="flex items-center gap-1"><Calendar className="w-4 h-4 text-accent"/> {new Date(h.date).toLocaleDateString()}</span>
                    <span className="flex items-center gap-1"><Clock className="w-4 h-4 text-blue-400"/> {formatDuration(h.durationSeconds)}</span>
                    {/* Aeróbico não tem carga: mostrar "0 kg" numa esteira seria informação errada,
                        não informação neutra. O que essa sessão entregou é tempo, já na coluna ao lado. */}
                    {h.sessionId === 'cardio' ? (
                      <span className="flex items-center gap-1 text-primary"><Timer className="w-4 h-4"/> Aeróbico</span>
                    ) : (
                      <span className="flex items-center gap-1"><Dumbbell className="w-4 h-4 text-primary"/> {h.totalVolume} kg</span>
                    )}
                  </div>
                </summary>
                <div className="p-5 border-t border-border bg-black/20">
                  <div className="space-y-3">
                    {h.exercises.map(ex => {
                      const exVolume = ex.sets.reduce((sum, s) => sum + (s.completed ? s.reps * s.weight : 0), 0);
                      
                      const currentDateTime = new Date(h.date).getTime();
                      const prevWorkout = history.find(w => {
                        if (new Date(w.date).getTime() >= currentDateTime) return false;
                        return w.exercises.some(e => e.name === ex.name);
                      });
                      
                      let prevVolume: number | null = null;
                      if (prevWorkout) {
                        const prevEx = prevWorkout.exercises.find(e => e.name === ex.name);
                        if (prevEx) {
                          prevVolume = prevEx.sets.reduce((sum, s) => sum + (s.completed ? s.reps * s.weight : 0), 0);
                        }
                      }
                      
                      const diff = prevVolume !== null ? exVolume - prevVolume : 0;

                      return (
                        <div key={ex.workoutExerciseId} className="flex flex-col text-sm p-4 bg-surface rounded-xl gap-2 border border-border">
                          <div className="flex justify-between items-center">
                            <span className="text-white font-medium">{ex.name}</span>
                            <span className="text-primary font-mono font-bold">{exVolume} kg</span>
                          </div>
                          {prevVolume !== null && (
                            <div className="flex justify-between items-center text-xs mt-1 border-t border-border/50 pt-2">
                              <span className="text-foreground-muted">Variação (vs última vez):</span>
                              <span className={`font-medium ${diff > 0 ? 'text-primary' : diff < 0 ? 'text-destructive' : 'text-foreground-muted'}`}>
                                {diff > 0 ? '+' : ''}{diff} kg
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </details>
            ))}
          </div>
        </>
      ) : (
        <Card className="text-center py-20 border-dashed border-2">
          <CardContent className="flex flex-col items-center">
            <Dumbbell className="w-16 h-16 text-foreground-muted mx-auto mb-4 opacity-50" />
            <h2 className="text-xl font-outfit text-foreground-muted">Nenhum treino registrado ainda.</h2>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
