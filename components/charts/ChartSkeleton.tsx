import { Skeleton } from '@/components/ui/Skeleton';

/**
 * Placeholder enquanto o recharts é baixado. Desenha barras em alturas variadas para ocupar o
 * mesmo espaço do gráfico real — sem isso o conteúdo abaixo pula quando o gráfico monta, que é
 * justamente o custo que o carregamento sob demanda costuma cobrar.
 */
export function ChartSkeleton() {
  // Classes estáticas (não interpoladas) para o Tailwind conseguir detectá-las na varredura.
  // Alturas fixas, não aleatórias, pra não divergir entre renderizações.
  const barras = [
    'h-[45%]', 'h-[70%]', 'h-[55%]', 'h-[85%]', 'h-[60%]', 'h-[75%]',
    'h-[50%]', 'h-[90%]', 'h-[65%]', 'h-[80%]', 'h-[58%]', 'h-[72%]',
  ];

  return (
    <div className="w-full h-full flex flex-col gap-3" aria-hidden="true">
      <div className="flex-1 flex items-end gap-2">
        {barras.map((altura, i) => (
          <Skeleton key={i} className={`flex-1 rounded-md ${altura}`} />
        ))}
      </div>
      <Skeleton className="h-3 w-full rounded" />
      <span className="sr-only">Carregando gráfico…</span>
    </div>
  );
}
