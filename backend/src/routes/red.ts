import { Router } from 'express';
import { prisma } from '../lib/prisma';

export const redRouter = Router();

// Helper: construir WHERE clause para filtro de fechas
function buildDateFilter(from?: string, to?: string): { where: string; params: any[] } {
  const conditions: string[] = [];
  const params: any[] = [];

  if (from) {
    params.push(new Date(`${from}-01T00:00:00.000Z`));
    conditions.push(`periodo >= $1`);
  }
  if (to) {
    const [year, month] = to.split('-').map(Number);
    const paramIdx = params.length + 1;
    params.push(new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)));
    conditions.push(`periodo <= $${paramIdx}`);
  }

  return {
    where: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  };
}

// ---------------------------------------------------------------------------
// GET /api/red/metricas — Metricas agregadas de toda la red
// ---------------------------------------------------------------------------

redRouter.get('/metricas', async (req, res, next) => {
  try {
    const { from, to } = req.query as Record<string, string | undefined>;
    const { where, params } = buildDateFilter(from, to);

    // --- Query 1: Metricas agregadas por mes ---
    const monthlyQuery = `
      SELECT
        periodo,
        SUM(clientes_activos)::int                    AS "totalClientes",
        SUM(facturacion_total)                         AS "totalFacturacion",
        SUM(declaraciones_total)::int                  AS "totalDeclaraciones",
        CASE
          WHEN SUM(clientes_activos) > 0
          THEN ROUND((SUM(satisfaccion_cliente * clientes_activos) / SUM(clientes_activos))::numeric, 2)
          ELSE NULL
        END                                            AS "avgSatisfaccion",
        ROUND(AVG(tasa_resolucion)::numeric, 4)        AS "avgTasaResolucion",
        COUNT(DISTINCT asesoria_id)::int               AS "numAsesorias"
      FROM metricas_mensuales
      ${where}
      GROUP BY periodo
      ORDER BY periodo ASC
    `;

    // --- Query 2: Ranking por crecimiento de facturacion ---
    const growthQuery = `
      WITH asesoria_range AS (
        SELECT
          asesoria_id,
          FIRST_VALUE(facturacion_total) OVER (PARTITION BY asesoria_id ORDER BY periodo ASC) AS first_fac,
          FIRST_VALUE(facturacion_total) OVER (PARTITION BY asesoria_id ORDER BY periodo DESC) AS last_fac
        FROM metricas_mensuales
        ${where}
      ),
      growth AS (
        SELECT DISTINCT
          asesoria_id,
          first_fac,
          last_fac,
          CASE
            WHEN first_fac > 0
            THEN ROUND(((last_fac - first_fac) / first_fac * 100)::numeric, 2)
            ELSE NULL
          END AS growth_pct
        FROM asesoria_range
      )
      SELECT
        g.asesoria_id  AS "asesoriaId",
        a.nombre,
        a.provincia,
        a.especialidad::text,
        g.first_fac    AS "firstFacturacion",
        g.last_fac     AS "lastFacturacion",
        g.growth_pct   AS "growthPct"
      FROM growth g
      JOIN asesorias a ON a.id = g.asesoria_id
      WHERE g.growth_pct IS NOT NULL
      ORDER BY g.growth_pct DESC
    `;

    // Ejecutar ambas queries en paralelo.
    // $queryRawUnsafe permite pasar SQL como string + params como spread.
    const [monthlyRaw, growthRaw] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>(monthlyQuery, ...params),
      prisma.$queryRawUnsafe<any[]>(growthQuery, ...params),
    ]);

    // Convertir Postgres Decimal/BigInt a JS number
    const monthly = monthlyRaw.map((row) => ({
      periodo: row.periodo,
      totalClientes: Number(row.totalClientes),
      totalFacturacion: Number(row.totalFacturacion),
      totalDeclaraciones: Number(row.totalDeclaraciones),
      avgSatisfaccion: row.avgSatisfaccion ? Number(row.avgSatisfaccion) : null,
      avgTasaResolucion: row.avgTasaResolucion ? Number(row.avgTasaResolucion) : null,
      numAsesorias: Number(row.numAsesorias),
    }));

    const growth = growthRaw.map((row) => ({
      asesoriaId: Number(row.asesoriaId),
      nombre: row.nombre,
      provincia: row.provincia,
      especialidad: row.especialidad,
      firstFacturacion: Number(row.firstFacturacion),
      lastFacturacion: Number(row.lastFacturacion),
      growthPct: row.growthPct ? Number(row.growthPct) : null,
    }));

    res.json({
      monthly,
      topGrowth: growth.slice(0, 5),
      bottomGrowth: growth.slice(-5).reverse(),
    });
  } catch (error) {
    next(error);
  }
});
