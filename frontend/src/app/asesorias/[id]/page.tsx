'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, type Asesoria, type MetricaMensual } from '@/lib/api';
import { MetricChart } from '@/components/metric-chart';
import { ChatSoporte } from '@/components/chat-soporte';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Building2, MapPin, Users, Calendar } from 'lucide-react';

const especialidadColor: Record<string, string> = {
  Fiscal: 'bg-blue-100 text-blue-800',
  Contable: 'bg-green-100 text-green-800',
  Laboral: 'bg-amber-100 text-amber-800',
};

export default function AsesoriaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [asesoria, setAsesoria] = useState<Asesoria | null>(null);
  const [metricas, setMetricas] = useState<MetricaMensual[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [a, m] = await Promise.all([
          api<Asesoria>(`/api/asesorias/${id}`),
          api<MetricaMensual[]>(`/api/asesorias/${id}/metricas`),
        ]);
        setAsesoria(a);
        setMetricas(m);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar datos');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !asesoria) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver
        </Button>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error || 'Asesoría no encontrada'}
        </div>
      </div>
    );
  }

  // --- Preparar datos para las 6 graficas ---
  // Cada grafica recibe un array de { periodo, value }

  const formatEur = (v: number) =>
    v.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

  const formatPct = (v: number) =>
    `${(v * 100).toFixed(1)}%`;

  const formatDecimal = (v: number) =>
    v.toFixed(2);

  return (
    <div className="space-y-6">
      {/* Header con boton volver */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver
        </Button>
      </div>

      {/* Ficha de la asesoria */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl">{asesoria.nombre}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">CIF: {asesoria.cif}</p>
            </div>
            <Badge
              variant="secondary"
              className={especialidadColor[asesoria.especialidad] || ''}
            >
              {asesoria.especialidad}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{asesoria.ciudad}</p>
                <p className="text-xs text-muted-foreground">{asesoria.provincia}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{asesoria.numEmpleados}</p>
                <p className="text-xs text-muted-foreground">Empleados</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">
                  {new Date(asesoria.fechaAlta).toLocaleDateString('es-ES')}
                </p>
                <p className="text-xs text-muted-foreground">Fecha de alta</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{metricas.length}</p>
                <p className="text-xs text-muted-foreground">Meses de datos</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Titulo de seccion */}
      <div>
        <h2 className="text-lg font-semibold">Evolución mensual</h2>
        <p className="text-sm text-muted-foreground">
          6 métricas clave agrupadas en 3 ejes: salud del negocio, capacidad operativa y calidad
        </p>
      </div>

      {/* 6 graficas en grid 3x2 (desktop) o 1 columna (mobile) */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* EJE 1: Salud del negocio */}
        <MetricChart
          title="Clientes activos"
          description="Clientes que gestiona la asesoría cada mes"
          data={metricas.map((m) => ({ periodo: m.periodo, value: m.clientesActivos }))}
          color="#2563eb"
        />
        <MetricChart
          title="Facturación total"
          description="Ingresos mensuales (asesoría + gestión + consultoría)"
          data={metricas.map((m) => ({ periodo: m.periodo, value: m.facturacionTotal }))}
          color="#16a34a"
          formatValue={formatEur}
        />

        {/* EJE 2: Capacidad operativa */}
        <MetricChart
          title="Declaraciones totales"
          description="IRPF + IVA + Sociedades + Otras"
          data={metricas.map((m) => ({ periodo: m.periodo, value: m.declaracionesTotal }))}
          color="#9333ea"
        />
        <MetricChart
          title="Tasa de resolución"
          description="Consultas resueltas / consultas recibidas"
          data={metricas.map((m) => ({ periodo: m.periodo, value: m.tasaResolucion }))}
          color="#ea580c"
          formatValue={formatPct}
        />

        {/* EJE 3: Calidad */}
        <MetricChart
          title="Satisfacción cliente"
          description="Nota media de satisfacción (1-5)"
          data={metricas.map((m) => ({ periodo: m.periodo, value: m.satisfaccionCliente }))}
          color="#0891b2"
          formatValue={formatDecimal}
        />
        <MetricChart
          title="Incidencias AEAT"
          description="Incidencias con Hacienda por mes"
          data={metricas.map((m) => ({ periodo: m.periodo, value: m.incidenciasAeat }))}
          color="#dc2626"
        />
      </div>

      {/* Chat de soporte (Fase 2) */}
      <ChatSoporte asesoriaId={asesoria.id} />
    </div>
  );
}
