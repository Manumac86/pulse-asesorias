'use client';

import { useRouter } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { Asesoria } from '@/lib/api';

interface AsesoriaTableProps {
  asesorias: Asesoria[];
}

// Color del badge segun especialidad
const especialidadColor: Record<string, string> = {
  Fiscal: 'bg-blue-100 text-blue-800',
  Contable: 'bg-green-100 text-green-800',
  Laboral: 'bg-amber-100 text-amber-800',
};

export function AsesoriaTable({ asesorias }: AsesoriaTableProps) {
  const router = useRouter();

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Provincia</TableHead>
            <TableHead>Ciudad</TableHead>
            <TableHead className="text-center">Empleados</TableHead>
            <TableHead>Especialidad</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {asesorias.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                No se encontraron asesorías con esos filtros
              </TableCell>
            </TableRow>
          ) : (
            asesorias.map((a) => (
              <TableRow
                key={a.id}
                onClick={() => router.push(`/asesorias/${a.id}`)}
                className="cursor-pointer hover:bg-muted/50"
              >
                <TableCell className="font-medium">{a.nombre}</TableCell>
                <TableCell>{a.provincia}</TableCell>
                <TableCell>{a.ciudad}</TableCell>
                <TableCell className="text-center">{a.numEmpleados}</TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className={especialidadColor[a.especialidad] || ''}
                  >
                    {a.especialidad}
                  </Badge>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
