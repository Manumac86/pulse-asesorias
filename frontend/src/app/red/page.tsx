'use client';

import { useEffect, useState } from 'react';
import { api, type RedMetricas } from '@/lib/api';
import { MetricChart } from '@/components/metric-chart';
import { KpiCard } from '@/components/kpi-card';
import { GrowthRanking } from '@/components/growth-ranking';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Euro, Star, CheckCircle } from 'lucide-react';

export default function RedPage() {
  const [data, setData] = useState<RedMetricas | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<RedMetricas>('/api/red/metricas')
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        {error || 'Error al cargar datos de la red'}
      </div>
    );
  }

  // Ultimo mes disponible para los KPIs
  const latest = data.monthly[data.monthly.length - 1];
  // Penultimo mes para calcular tendencia
  const previous = data.monthly.length > 1 ? data.monthly[data.monthly.length - 2] : null;

  const trend = (current: number, prev: number | null | undefined) => {
    if (!prev || prev === 0) return '';
    const pct = ((current - prev) / prev) * 100;
    return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% vs mes anterior`;
  };

  const formatEur = (v: number) =>
    v.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

  const formatPct = (v: number) => `${(v * 100).toFixed(1)}%`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Visión de Red</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Métricas agregadas de las {latest.numAsesorias} asesorías de la red
        </p>
      </div>

      {/* KPI Cards — resumen del ultimo mes */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          title="Clientes activos"
          value={latest.totalClientes.toLocaleString('es-ES')}
          description={trend(latest.totalClientes, previous?.totalClientes)}
          icon={Users}
        />
        <KpiCard
          title="Facturación mensual"
          value={formatEur(latest.totalFacturacion)}
          description={trend(latest.totalFacturacion, previous?.totalFacturacion)}
          icon={Euro}
        />
        <KpiCard
          title="Satisfacción media"
          value={latest.avgSatisfaccion?.toFixed(2) ?? '—'}
          description="Promedio ponderado por clientes"
          icon={Star}
        />
        <KpiCard
          title="Tasa de resolución"
          value={latest.avgTasaResolucion ? formatPct(latest.avgTasaResolucion) : '—'}
          description="Media de toda la red"
          icon={CheckCircle}
        />
      </div>

      {/* Graficas de tendencia */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <MetricChart
          title="Clientes activos (red)"
          description="Total de clientes gestionados por la red"
          data={data.monthly.map((m) => ({ periodo: m.periodo, value: m.totalClientes }))}
          color="#2563eb"
        />
        <MetricChart
          title="Facturación total (red)"
          description="Ingresos mensuales agregados"
          data={data.monthly.map((m) => ({ periodo: m.periodo, value: m.totalFacturacion }))}
          color="#16a34a"
          formatValue={formatEur}
        />
        <MetricChart
          title="Satisfacción media"
          description="Promedio ponderado por número de clientes"
          data={data.monthly.map((m) => ({ periodo: m.periodo, value: m.avgSatisfaccion }))}
          color="#0891b2"
          formatValue={(v) => v.toFixed(2)}
        />
        <MetricChart
          title="Tasa de resolución media"
          description="Media de consultas resueltas / recibidas"
          data={data.monthly.map((m) => ({ periodo: m.periodo, value: m.avgTasaResolucion }))}
          color="#ea580c"
          formatValue={formatPct}
        />
      </div>

      {/* Rankings */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <GrowthRanking title="Mayor crecimiento en facturación" items={data.topGrowth} type="top" />
        <GrowthRanking
          title="Menor crecimiento en facturación"
          items={data.bottomGrowth}
          type="bottom"
        />
      </div>
    </div>
  );
}
