'use client';

import { useEffect, useState, useCallback } from 'react';
import { api, type AsesoriasResponse } from '@/lib/api';
import { Filters } from '@/components/filters';
import { AsesoriaTable } from '@/components/asesoria-table';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function HomePage() {
  // --- Estado ---
  const [data, setData] = useState<AsesoriasResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [search, setSearch] = useState('');
  const [provincia, setProvincia] = useState('all');
  const [especialidad, setEspecialidad] = useState('all');
  const [page, setPage] = useState(1);

  // Lista de provincias unicas (para el dropdown)
  const [provincias, setProvincias] = useState<string[]>([]);

  // --- Fetch de datos ---
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Construir query params dinamicamente
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (provincia !== 'all') params.set('provincia', provincia);
      if (especialidad !== 'all') params.set('especialidad', especialidad);
      params.set('page', String(page));
      params.set('limit', '20');

      const result = await api<AsesoriasResponse>(`/api/asesorias?${params}`);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, [search, provincia, especialidad, page]);

  // Cargar provincias una vez al montar
  useEffect(() => {
    api<AsesoriasResponse>('/api/asesorias?limit=100').then((res) => {
      const unique = [...new Set(res.data.map((a) => a.provincia))].sort();
      setProvincias(unique);
    });
  }, []);

  // Fetch cuando cambian los filtros (con debounce para search)
  useEffect(() => {
    const timer = setTimeout(fetchData, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchData, search]);

  // Reset pagina al cambiar filtros
  useEffect(() => {
    setPage(1);
  }, [search, provincia, especialidad]);

  // --- Render ---
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Asesorías</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {data ? `${data.pagination.total} asesorías en la red` : 'Cargando...'}
        </p>
      </div>

      {/* Filtros */}
      <Filters
        search={search}
        provincia={provincia}
        especialidad={especialidad}
        provincias={provincias}
        onSearchChange={setSearch}
        onProvinciaChange={setProvincia}
        onEspecialidadChange={setEspecialidad}
      />

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Tabla o skeleton */}
      {loading && !data ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : data ? (
        <>
          <AsesoriaTable asesorias={data.data} />

          {/* Paginacion */}
          {data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Página {data.pagination.page} de {data.pagination.totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= data.pagination.totalPages}
                >
                  Siguiente
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
