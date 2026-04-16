import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { Especialidad, Prisma } from '@prisma/client';
import { queryRag } from '../services/rag.service';

export const asesoriasRouter = Router();

// ---------------------------------------------------------------------------
// GET /api/asesorias — Listado con filtros
// ---------------------------------------------------------------------------
// Query params:
//   ?search=martinez       → busca en nombre y ciudad (case-insensitive)
//   ?provincia=Madrid      → filtro exacto por provincia
//   ?especialidad=Fiscal   → filtro por enum (Fiscal, Contable, Laboral)
//   ?page=1&limit=20       → paginacion (por defecto: page 1, limit 20)
//
// Ejemplo completo:
//   GET /api/asesorias?search=mar&provincia=Madrid&especialidad=Fiscal&page=1&limit=10

asesoriasRouter.get('/', async (req, res, next) => {
  try {
    const {
      search,
      provincia,
      especialidad,
      page = '1',
      limit = '20',
    } = req.query as Record<string, string | undefined>;

    // Parsear paginacion (con valores minimos para evitar abusos)
    const pageNum = Math.max(1, parseInt(page ?? '1', 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit ?? '20', 10)));
    const skip = (pageNum - 1) * limitNum;

    // Construir el WHERE de Prisma dinamicamente.
    // Solo anadimos condiciones para los filtros que el usuario envia.
    // Si no envia nada, el where queda vacio = devuelve todo.
    const where: Prisma.AsesoriaWhereInput = {};

    if (search) {
      // OR: busca "martinez" en nombre O en ciudad.
      // mode: 'insensitive' = case-insensitive (ILIKE en Postgres).
      // contains: busqueda parcial (%martinez%).
      where.OR = [
        { nombre: { contains: search, mode: 'insensitive' } },
        { ciudad: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (provincia) {
      where.provincia = provincia;
    }

    if (especialidad && Object.values(Especialidad).includes(especialidad as Especialidad)) {
      where.especialidad = especialidad as Especialidad;
    }

    // Ejecutar ambas queries en paralelo: datos + count total.
    // Promise.all las lanza simultaneamente → la respuesta es tan rapida
    // como la query mas lenta, no la suma de ambas.
    const [asesorias, total] = await Promise.all([
      prisma.asesoria.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { nombre: 'asc' },
      }),
      prisma.asesoria.count({ where }),
    ]);

    res.json({
      data: asesorias,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// GET /api/asesorias/:id — Detalle de una asesoria
// ---------------------------------------------------------------------------

asesoriasRouter.get('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      res.status(400).json({ error: 'ID debe ser un numero' });
      return;
    }

    const asesoria = await prisma.asesoria.findUnique({
      where: { id },
    });

    if (!asesoria) {
      res.status(404).json({ error: 'Asesoria no encontrada' });
      return;
    }

    res.json(asesoria);
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// GET /api/asesorias/:id/metricas — Metricas mensuales de una asesoria
// ---------------------------------------------------------------------------
// Query params:
//   ?from=2025-04   → desde este mes (inclusive)
//   ?to=2025-09     → hasta este mes (inclusive)

asesoriasRouter.get('/:id/metricas', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { from, to } = req.query as Record<string, string | undefined>;

    if (isNaN(id)) {
      res.status(400).json({ error: 'ID debe ser un numero' });
      return;
    }

    // Verificar que la asesoria existe
    const asesoria = await prisma.asesoria.findUnique({ where: { id } });
    if (!asesoria) {
      res.status(404).json({ error: 'Asesoria no encontrada' });
      return;
    }

    // Construir filtro de fechas
    const periodoFilter: { gte?: Date; lte?: Date } = {};
    if (from) {
      periodoFilter.gte = new Date(`${from}-01T00:00:00.000Z`);
    }
    if (to) {
      // Ultimo dia del mes "to": si to=2025-09, queremos hasta 2025-09-30
      // Truco: primer dia del mes siguiente - 1ms
      const [year, month] = to.split('-').map(Number);
      periodoFilter.lte = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    }

    const metricas = await prisma.metricaMensual.findMany({
      where: {
        asesoriaId: id,
        ...(Object.keys(periodoFilter).length > 0 && { periodo: periodoFilter }),
      },
      orderBy: { periodo: 'asc' },
    });

    res.json(metricas);
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// POST /api/asesorias/:id/soporte/query — Pregunta RAG (Fase 2)
// ---------------------------------------------------------------------------
// Body: { "pregunta": "¿Qué incidencias recurrentes tiene?" }
// Response: { "respuesta": "...", "fuentes": [{ docId, tipo, fecha, titulo }] }

asesoriasRouter.post('/:id/soporte/query', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      res.status(400).json({ error: 'ID debe ser un número' });
      return;
    }

    const { pregunta } = req.body as { pregunta?: string };

    if (!pregunta || pregunta.trim().length === 0) {
      res.status(400).json({ error: 'La pregunta es obligatoria' });
      return;
    }

    if (!process.env.OPENAI_API_KEY) {
      res.status(503).json({
        error: 'Servicio de soporte no disponible',
        detail: 'OPENAI_API_KEY no configurada.',
      });
      return;
    }

    const result = await queryRag(id, pregunta.trim());
    res.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'Asesoría no encontrada') {
      res.status(404).json({ error: error.message });
      return;
    }
    // Degradacion graceful: si el LLM/embedding falla, 503
    if (error instanceof Error) {
      res.status(503).json({
        error: 'Servicio de soporte temporalmente no disponible',
        detail: error.message,
      });
      return;
    }
    next(error);
  }
});
