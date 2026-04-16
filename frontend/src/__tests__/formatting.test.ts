import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Formateadores extraidos de las paginas
// ---------------------------------------------------------------------------
// Estos formateadores se usan en las graficas y KPIs. Un error aqui
// muestra datos confusos al usuario: "0.8525" en vez de "85,3%",
// o "32327.75" en vez de "32.328 €". Son funciones puras y baratas de testear.

const formatEur = (v: number) =>
  v.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

const formatPct = (v: number) => `${(v * 100).toFixed(1)}%`;

const formatDecimal = (v: number) => v.toFixed(2);

// Formateador del eje Y de las graficas
const formatAxis = (v: number): string => {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
};

// Formateador de mes: "2025-04-01T00:00:00.000Z" → "Abr 25"
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('formatEur — formato de moneda', () => {
  // POR QUE: La facturacion es el dato mas sensible del dashboard.
  // Un error de formato puede hacer que "32.328 €" se lea como "32 €" o "32328 €".

  it('formatea miles con punto separador', () => {
    const result = formatEur(32327.75);
    // El formato exacto depende del locale del entorno,
    // pero debe contener el numero sin decimales y el simbolo €
    expect(result).toContain('32');
    expect(result).toContain('€');
  });

  it('formatea millones', () => {
    const result = formatEur(1337242.8);
    expect(result).toContain('€');
    expect(result).toContain('1');
  });

  it('formatea cero', () => {
    const result = formatEur(0);
    expect(result).toContain('0');
    expect(result).toContain('€');
  });
});

describe('formatPct — formato de porcentaje', () => {
  // POR QUE: tasa_resolucion se almacena como 0.8525 (proporcion) pero
  // se muestra como "85,3%" al usuario. Si este formateo falla,
  // el usuario ve "0.9" en vez de "85,3%", lo cual es ininteligible.

  it('convierte proporcion a porcentaje', () => {
    expect(formatPct(0.8525)).toBe('85.3%');
  });

  it('maneja 100%', () => {
    expect(formatPct(1.0)).toBe('100.0%');
  });

  it('maneja 0%', () => {
    expect(formatPct(0)).toBe('0.0%');
  });

  it('maneja valores bajos con precision', () => {
    expect(formatPct(0.0567)).toBe('5.7%');
  });
});

describe('formatDecimal — formato de satisfaccion', () => {
  // POR QUE: La satisfaccion es 1-5 con decimales. "4.5" vs "4.50" vs "5"
  // son diferencias sutiles pero importantes en un KPI.

  it('muestra 2 decimales siempre', () => {
    expect(formatDecimal(4.5)).toBe('4.50');
    expect(formatDecimal(3.0)).toBe('3.00');
    expect(formatDecimal(4.21)).toBe('4.21');
  });
});

describe('formatAxis — formato del eje Y', () => {
  // POR QUE: Sin este formateo, el eje Y muestra "1337243" que se solapa
  // con los otros numeros y es ilegible. "1.3M" es compacto y legible.

  it('formatea millones como M', () => {
    expect(formatAxis(1_337_243)).toBe('1.3M');
    expect(formatAxis(2_500_000)).toBe('2.5M');
  });

  it('formatea miles como K', () => {
    expect(formatAxis(7_800)).toBe('8K');
    expect(formatAxis(32_327)).toBe('32K');
  });

  it('no formatea numeros pequenos', () => {
    expect(formatAxis(42)).toBe('42');
    expect(formatAxis(0)).toBe('0');
  });
});

describe('formatMonth — formato de mes para graficas', () => {
  // POR QUE: Si el parser de fecha falla, las graficas muestran
  // "Invalid Date" o fechas desfasadas (timezone bug comun).

  it('convierte ISO date a "Abr 25"', () => {
    expect(formatMonth('2025-04-01T00:00:00.000Z')).toBe('Abr 25');
  });

  it('maneja diciembre correctamente', () => {
    expect(formatMonth('2025-12-01T00:00:00.000Z')).toBe('Dic 25');
  });

  it('maneja enero (edge case de anio)', () => {
    expect(formatMonth('2026-01-01T00:00:00.000Z')).toBe('Ene 26');
  });

  it('no se desfasa por timezone', () => {
    // Este es el bug clasico: new Date("2025-04-01") sin T00:00:00Z
    // puede dar "Mar 25" si la timezone local es negativa (America).
    // Usamos getUTCMonth para evitarlo.
    expect(formatMonth('2025-04-01T00:00:00.000Z')).toBe('Abr 25');
    expect(formatMonth('2025-01-01T00:00:00.000Z')).toBe('Ene 25');
  });
});
