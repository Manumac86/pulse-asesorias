// Base URL de la API. En desarrollo: http://localhost:3001.
// NEXT_PUBLIC_ hace que la variable este disponible en el navegador.
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Wrapper de fetch que anade la base URL y parsea JSON.
// Si la respuesta no es ok (4xx, 5xx), lanza un error con el mensaje.
export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API error: ${res.status}`);
  }

  return res.json();
}

// --- Tipos ---

export interface Asesoria {
  id: number;
  nombre: string;
  cif: string;
  provincia: string;
  ciudad: string;
  fechaAlta: string;
  numEmpleados: number;
  especialidad: 'Fiscal' | 'Contable' | 'Laboral';
}

export interface AsesoriasResponse {
  data: Asesoria[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface MetricaMensual {
  id: number;
  asesoriaId: number;
  periodo: string;
  clientesActivos: number;
  clientesNuevos: number;
  clientesBaja: number;
  declaracionesRenta: number;
  declaracionesIva: number;
  declaracionesSociedades: number;
  declaracionesOtros: number;
  declaracionesTotal: number;
  facturacionAsesoriaEur: number;
  facturacionGestionEur: number;
  facturacionConsultoriaEur: number;
  facturacionTotal: number;
  horasTrabajadas: number;
  consultasRecibidas: number;
  consultasResueltas: number;
  tasaResolucion: number | null;
  incidenciasAeat: number;
  documentosProcesados: number;
  satisfaccionCliente: number;
}

export interface RedMetricas {
  monthly: {
    periodo: string;
    totalClientes: number;
    totalFacturacion: number;
    totalDeclaraciones: number;
    avgSatisfaccion: number | null;
    avgTasaResolucion: number | null;
    numAsesorias: number;
  }[];
  topGrowth: GrowthItem[];
  bottomGrowth: GrowthItem[];
}

export interface GrowthItem {
  asesoriaId: number;
  nombre: string;
  provincia: string;
  especialidad: string;
  firstFacturacion: number;
  lastFacturacion: number;
  growthPct: number | null;
}
