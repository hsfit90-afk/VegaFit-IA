"use client";

import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, ReferenceLine,
} from 'recharts';

/**
 * Os três gráficos da tela de progresso, num arquivo só. Mantê-los juntos é proposital: eles
 * aparecem na mesma rota, então dividi-los em três chunks só geraria três downloads do mesmo
 * recharts. O que importa é tirar a biblioteca (~100 kB) do bundle inicial da rota — quem carrega
 * é o next/dynamic em app/progress/page.tsx.
 */

interface PontoPeso { dateStr: string; weight: number }
interface PontoMusculo { name: string; series: number }
interface PontoEvolucao { dateStr: string; maxWeight: number }

/** Evolução do peso corporal. */
export function WeightChart({ data }: { data: PontoPeso[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <XAxis dataKey="dateStr" stroke="#4B5563" fontSize={12} tickMargin={10} minTickGap={20} />
        <YAxis domain={['dataMin - 2', 'dataMax + 2']} stroke="#4B5563" fontSize={12} width={40} />
        <Tooltip
          contentStyle={{ backgroundColor: '#0f0f13', borderColor: '#1f2937', borderRadius: '12px' }}
          itemStyle={{ color: '#60A5FA', fontWeight: 'bold' }}
        />
        <Line
          type="monotone"
          dataKey="weight"
          stroke="#60A5FA"
          strokeWidth={3}
          dot={{ r: 4, fill: '#60A5FA', strokeWidth: 0 }}
          activeDot={{ r: 6, fill: '#3B82F6', stroke: '#1f2937', strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Séries por grupo muscular nos últimos 7 dias. */
export function MuscleVolumeChart({ data }: { data: PontoMusculo[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 0, left: 30, bottom: 0 }}>
        <XAxis type="number" hide />
        <YAxis dataKey="name" type="category" stroke="#9CA3AF" fontSize={12} axisLine={false} tickLine={false} />
        <Tooltip
          cursor={{ fill: 'rgba(255,255,255,0.05)' }}
          contentStyle={{ backgroundColor: '#0f0f13', borderColor: '#1f2937', borderRadius: '12px' }}
        />
        <Bar dataKey="series" fill="#7C3AED" radius={[0, 4, 4, 0]} barSize={20} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Carga máxima de um exercício ao longo do tempo. */
export function ExerciseEvolutionChart({ data }: { data: PontoEvolucao[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <XAxis dataKey="dateStr" stroke="#6B7280" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis stroke="#6B7280" fontSize={11} tickLine={false} axisLine={false} domain={['dataMin - 5', 'dataMax + 5']} />
        {/* formatter: val pode vir undefined quando não há ponto sob o cursor */}
        <Tooltip
          contentStyle={{ backgroundColor: '#0f0f13', borderColor: '#1f2937', borderRadius: '12px', fontSize: '12px' }}
          formatter={(val) => [`${val ?? '—'} kg`, 'Carga Máx.']}
        />
        {data.length > 0 && (
          <ReferenceLine y={data[0].maxWeight} stroke="#374151" strokeDasharray="4 4" />
        )}
        <Line
          type="monotone"
          dataKey="maxWeight"
          stroke="var(--color-secondary)"
          strokeWidth={3}
          dot={{ r: 4, fill: 'var(--color-secondary)', strokeWidth: 0 }}
          activeDot={{ r: 6, fill: 'var(--color-secondary)', stroke: '#1f2937', strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
