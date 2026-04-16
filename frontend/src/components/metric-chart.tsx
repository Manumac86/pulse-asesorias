'use client';

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface MetricChartProps {
  title: string;
  description: string;
  data: { periodo: string; value: number | null }[];
  color?: string;
  // Formateador para el tooltip (ej: "32.327,75 €" o "85,25%")
  formatValue?: (value: number) => string;
}

// Formatea "2025-04-01T00:00:00.000Z" → "Abr 25"
function formatMonth(periodo: string): string {
  const date = new Date(periodo);
  const months = [
    'Ene',
    'Feb',
    'Mar',
    'Abr',
    'May',
    'Jun',
    'Jul',
    'Ago',
    'Sep',
    'Oct',
    'Nov',
    'Dic',
  ];
  return `${months[date.getUTCMonth()]} ${String(date.getUTCFullYear()).slice(2)}`;
}

// Formateador por defecto: numero con separador de miles
const defaultFormat = (v: number) => v.toLocaleString('es-ES', { maximumFractionDigits: 2 });

export function MetricChart({
  title,
  description,
  data,
  color = '#2563eb',
  formatValue = defaultFormat,
}: MetricChartProps) {
  // Transformar datos para Recharts: { name: "Abr 25", value: 32327.75 }
  const chartData = data.map((d) => ({
    name: formatMonth(d.periodo),
    value: d.value,
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <YAxis
                tick={{ fontSize: 11 }}
                width={60}
                className="text-muted-foreground"
                tickFormatter={(v) => {
                  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
                  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
                  return String(v);
                }}
              />
              <Tooltip
                formatter={(value) => [formatValue(Number(value)), title]}
                labelStyle={{ fontWeight: 600 }}
                contentStyle={{
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  fontSize: '13px',
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                dot={{ r: 3, fill: color }}
                activeDot={{ r: 5 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
