import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { asesoriasRouter } from '../routes/asesorias';

// ---------------------------------------------------------------------------
// Setup: app Express de test con el router real + BD real (datos del seed)
// ---------------------------------------------------------------------------
// supertest inyecta requests directamente en la app sin levantar un servidor.
// Esto es mas rapido y evita problemas de puertos.

const app = express();
app.use(express.json());
app.use('/api/asesorias', asesoriasRouter);

// Error handler to surface Prisma/async errors
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Test error:', err.message);
  res.status(500).json({ error: err.message });
});

// ---------------------------------------------------------------------------
// Tests: Listado
// ---------------------------------------------------------------------------

describe('GET /api/asesorias', () => {
  it('devuelve listado con paginacion', async () => {
    const res = await request(app).get('/api/asesorias?limit=5');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(5);
    expect(res.body.pagination).toMatchObject({
      page: 1,
      limit: 5,
      totalPages: expect.any(Number),
      total: expect.any(Number),
    });
    expect(res.body.pagination.total).toBeGreaterThanOrEqual(50);
  });

  it('filtra por provincia', async () => {
    const res = await request(app).get('/api/asesorias?provincia=Madrid');

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    res.body.data.forEach((a: any) => {
      expect(a.provincia).toBe('Madrid');
    });
  });

  it('filtra por especialidad', async () => {
    const res = await request(app).get('/api/asesorias?especialidad=Fiscal');

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    res.body.data.forEach((a: any) => {
      expect(a.especialidad).toBe('Fiscal');
    });
  });

  it('busca por texto (case-insensitive)', async () => {
    const res = await request(app).get('/api/asesorias?search=madrid');

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('combina filtros provincia + especialidad', async () => {
    const res = await request(app).get('/api/asesorias?provincia=Madrid&especialidad=Fiscal');

    expect(res.status).toBe(200);
    res.body.data.forEach((a: any) => {
      expect(a.provincia).toBe('Madrid');
      expect(a.especialidad).toBe('Fiscal');
    });
  });

  it('paginacion: pagina 2 tiene datos diferentes a pagina 1', async () => {
    const page1 = await request(app).get('/api/asesorias?limit=5&page=1');
    const page2 = await request(app).get('/api/asesorias?limit=5&page=2');

    expect(page1.body.data[0].id).not.toBe(page2.body.data[0].id);
  });

  it('limita el maximo de resultados a 100', async () => {
    const res = await request(app).get('/api/asesorias?limit=500');

    expect(res.body.data.length).toBeLessThanOrEqual(100);
  });
});

// ---------------------------------------------------------------------------
// Tests: Detalle
// ---------------------------------------------------------------------------

describe('GET /api/asesorias/:id', () => {
  it('devuelve una asesoria existente', async () => {
    const res = await request(app).get('/api/asesorias/1');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(1);
    expect(res.body.nombre).toBeDefined();
    expect(res.body.cif).toBeDefined();
    expect(res.body.especialidad).toMatch(/^(Fiscal|Contable|Laboral)$/);
  });

  it('devuelve 404 para id inexistente', async () => {
    const res = await request(app).get('/api/asesorias/99999');

    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  it('devuelve 400 para id no numerico', async () => {
    const res = await request(app).get('/api/asesorias/abc');

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Tests: Metricas
// ---------------------------------------------------------------------------

describe('GET /api/asesorias/:id/metricas', () => {
  it('devuelve metricas ordenadas por periodo ascendente', async () => {
    const res = await request(app).get('/api/asesorias/1/metricas');

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);

    for (let i = 1; i < res.body.length; i++) {
      expect(new Date(res.body[i].periodo).getTime()).toBeGreaterThan(
        new Date(res.body[i - 1].periodo).getTime(),
      );
    }
  });

  it('filtra por rango de fechas', async () => {
    const res = await request(app).get('/api/asesorias/1/metricas?from=2025-06&to=2025-08');

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    res.body.forEach((m: any) => {
      const date = new Date(m.periodo);
      expect(date.getTime()).toBeGreaterThanOrEqual(new Date('2025-06-01').getTime());
      expect(date.getTime()).toBeLessThanOrEqual(new Date('2025-09-01').getTime());
    });
  });

  it('los campos computed son correctos', async () => {
    const res = await request(app).get('/api/asesorias/1/metricas');
    const m = res.body[0];

    // declaracionesTotal = suma de las 4 declaraciones
    expect(m.declaracionesTotal).toBe(
      m.declaracionesRenta + m.declaracionesIva + m.declaracionesSociedades + m.declaracionesOtros,
    );

    // facturacionTotal = suma de las 3 facturaciones
    expect(m.facturacionTotal).toBeCloseTo(
      m.facturacionAsesoriaEur + m.facturacionGestionEur + m.facturacionConsultoriaEur,
      1,
    );

    // tasaResolucion = resueltas / recibidas
    if (m.consultasRecibidas > 0) {
      expect(m.tasaResolucion).toBeCloseTo(m.consultasResueltas / m.consultasRecibidas, 3);
    }
  });

  it('devuelve 404 para asesoria inexistente', async () => {
    const res = await request(app).get('/api/asesorias/99999/metricas');
    expect(res.status).toBe(404);
  });
});
