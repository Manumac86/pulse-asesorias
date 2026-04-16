'use client';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search } from 'lucide-react';

interface FiltersProps {
  search: string;
  provincia: string;
  especialidad: string;
  provincias: string[];
  onSearchChange: (value: string) => void;
  onProvinciaChange: (value: string) => void;
  onEspecialidadChange: (value: string) => void;
}

export function Filters({
  search,
  provincia,
  especialidad,
  provincias,
  onSearchChange,
  onProvinciaChange,
  onEspecialidadChange,
}: FiltersProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      {/* Busqueda por texto */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre o ciudad..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Filtro por provincia */}
      <Select value={provincia} onValueChange={(v) => onProvinciaChange(v ?? 'all')}>
        <SelectTrigger className="w-full sm:w-48">
          <SelectValue placeholder="Provincia" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas las provincias</SelectItem>
          {provincias.map((p) => (
            <SelectItem key={p} value={p}>
              {p}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Filtro por especialidad */}
      <Select value={especialidad} onValueChange={(v) => onEspecialidadChange(v ?? 'all')}>
        <SelectTrigger className="w-full sm:w-44">
          <SelectValue placeholder="Especialidad" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas</SelectItem>
          <SelectItem value="Fiscal">Fiscal</SelectItem>
          <SelectItem value="Contable">Contable</SelectItem>
          <SelectItem value="Laboral">Laboral</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
