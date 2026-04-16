import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { redRouter } from '../routes/red';

const app = express();
app.use(express.json());
app.use('/api/red', redRouter);
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Test error:', err.message);
  res.status(500).json({ error: err.message });
});

describe('GET /api/red/metricas', () => {
  it('devuelve metricas mensuales agregadas', async () => {
    const res = await request(app).get('/api/red/metricas');

    expect(res.status).toBe(200);
    expect(res.body.monthly).toBeDefined();
    expect(res.body.monthly.length).toBe(12);

    // Cada mes tiene las metricas agregadas
    const mes = res.body.monthly[0];
    expect(mes.periodo).toBeDefined();
    expect(mes.totalClientes).toBeGreaterThan(0);
    expect(mes.totalFacturacion).toBeGreaterThan(0);
    expect(mes.totalDeclaraciones).toBeGreaterThan(0);
    expect(mes.avgSatisfaccion).toBeGreaterThan(0);
    expect(mes.avgSatisfaccion).toBeLessThanOrEqual(5);
    expect(mes.avgTasaResolucion).toBeGreaterThan(0);
    expect(mes.avgTasaResolucion).toBeLessThanOrEqual(1);
    expect(mes.numAsesorias).toBe(50);
  });

  it('los meses estan ordenados cronologicamente', async () => {
    const res = await request(app).get('/api/red/metricas');

    for (let i = 1; i < res.body.monthly.length; i++) {
      expect(new Date(res.body.monthly[i].periodo).getTime()).toBeGreaterThan(
        new Date(res.body.monthly[i - 1].periodo).getTime(),
      );
    }
  });

  it('filtra por rango de fechas', async () => {
    const res = await request(app).get('/api/red/metricas?from=2025-06&to=2025-08');

    expect(res.status).toBe(200);
    expect(res.body.monthly.length).toBe(3);
    res.body.monthly.forEach((m: any) => {
      const date = new Date(m.periodo);
      expect(date.getTime()).toBeGreaterThanOrEqual(new Date('2025-06-01').getTime());
      expect(date.getTime()).toBeLessThanOrEqual(new Date('2025-09-01').getTime());
    });
  });

  it('totalClientes es la suma de las 50 asesorias', async () => {
    const res = await request(app).get('/api/red/metricas');
    const mes = res.body.monthly[0];

    // Con 50 asesorias de ~50-400 clientes cada una, el total deberia
    // estar en el rango de miles
    expect(mes.totalClientes).toBeGreaterThan(1000);
    expect(mes.totalClientes).toBeLessThan(50000);
  });

  it('avgSatisfaccion es un promedio ponderado razonable (1-5)', async () => {
    const res = await request(app).get('/api/red/metricas');

    res.body.monthly.forEach((m: any) => {
      expect(m.avgSatisfaccion).toBeGreaterThanOrEqual(1);
      expect(m.avgSatisfaccion).toBeLessThanOrEqual(5);
    });
  });

  it('incluye top 5 asesorias por crecimiento', async () => {
    const res = await request(app).get('/api/red/metricas');

    expect(res.body.topGrowth).toHaveLength(5);
    res.body.topGrowth.forEach((a: any) => {
      expect(a.asesoriaId).toBeDefined();
      expect(a.nombre).toBeDefined();
      expect(a.growthPct).toBeTypeOf('number');
    });

    // Top growth debe estar ordenado de mayor a menor
    for (let i = 1; i < res.body.topGrowth.length; i++) {
      expect(res.body.topGrowth[i].growthPct).toBeLessThanOrEqual(
        res.body.topGrowth[i - 1].growthPct,
      );
    }
  });

  it('incluye bottom 5 asesorias por crecimiento', async () => {
    const res = await request(app).get('/api/red/metricas');

    expect(res.body.bottomGrowth).toHaveLength(5);

    // Bottom growth debe estar ordenado de menor a mayor
    for (let i = 1; i < res.body.bottomGrowth.length; i++) {
      expect(res.body.bottomGrowth[i].growthPct).toBeGreaterThanOrEqual(
        res.body.bottomGrowth[i - 1].growthPct,
      );
    }
  });

  it('top growth tiene mayor crecimiento que bottom growth', async () => {
    const res = await request(app).get('/api/red/metricas');

    const minTop = Math.min(...res.body.topGrowth.map((a: any) => a.growthPct));
    const maxBottom = Math.max(...res.body.bottomGrowth.map((a: any) => a.growthPct));

    expect(minTop).toBeGreaterThan(maxBottom);
  });
});
