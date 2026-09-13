"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceArea } from 'recharts';

/**
 * Gráfico de volume do histórico. Isolado num arquivo próprio para que o `recharts` (~100 kB)
 * fique fora do bundle inicial da rota — quem carrega é o next/dynamic em app/history/page.tsx.
 *
 * O app é PWA usado no celular, muitas vezes em 4G dentro da academia: adiar 100 kB até o
 * gráfico realmente aparecer na tela vale mais aqui que numa aplicação de desktop.
 */

export interface PontoVolume {
  index: number;
  volume: number;
  date: string;
}

interface Props {
  chartData: PontoVolume[];
  fullChartData: PontoVolume[];
  refAreaLeft: number | null;
  refAreaRight: number | null;
  onRefAreaLeft: (valor: number) => void;
  onRefAreaRight: (valor: number) => void;
  onZoom: () => void;
}

export default function VolumeHistoryChart({
  chartData, fullChartData, refAreaLeft, refAreaRight,
  onRefAreaLeft, onRefAreaRight, onZoom,
}: Props) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={chartData}
        onMouseDown={(e) => {
          if (e && e.activeLabel !== undefined) onRefAreaLeft(e.activeLabel as number);
        }}
        onMouseMove={(e) => {
          if (refAreaLeft !== null && e && e.activeLabel !== undefined) onRefAreaRight(e.activeLabel as number);
        }}
        onMouseUp={onZoom}
      >
        <XAxis
          dataKey="index"
          tickFormatter={(val) => fullChartData[val]?.date || ''}
          stroke="#888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
        <Tooltip
          labelFormatter={(label) => fullChartData[label as number]?.date || ''}
          contentStyle={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', borderRadius: '12px', color: '#fff' }}
        />
        <Line type="monotone" dataKey="volume" stroke="var(--color-accent)" strokeWidth={3} dot={{ r: 4, fill: 'var(--color-primary)', strokeWidth: 0 }} activeDot={{ r: 6, fill: 'var(--color-primary)' }} />
        {refAreaLeft !== null && refAreaRight !== null && (
          <ReferenceArea x1={refAreaLeft} x2={refAreaRight} strokeOpacity={0.3} fill="var(--color-primary)" fillOpacity={0.1} />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}
