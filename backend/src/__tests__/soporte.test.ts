import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { asesoriasRouter } from '../routes/asesorias';

// ---------------------------------------------------------------------------
// Test del endpoint RAG
// ---------------------------------------------------------------------------
// POR QUE testear esto:
// - El aislamiento multitenancy es CRITICO: una consulta sobre asesoria 1
//   nunca debe devolver datos de la asesoria 2.
// - La degradacion graceful es importante: si no hay API key, el endpoint
//   debe devolver 503 con un mensaje util, no crashear.
// - La validacion de input evita queries vacias que desperdician tokens.

const app = express();
app.use(express.json());
app.use('/api/asesorias', asesoriasRouter);
app.use(
  (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: err.message });
  },
);

describe('POST /api/asesorias/:id/soporte/query', () => {
  it('devuelve 400 si no se envia pregunta', async () => {
    // POR QUE: Enviar una pregunta vacia al LLM desperdicia tokens (~$0.001)
    // y devuelve una respuesta sin sentido. Mejor validar antes.
    const res = await request(app)
      .post('/api/asesorias/1/soporte/query')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('obligatoria');
  });

  it('devuelve 400 si la pregunta esta vacia', async () => {
    const res = await request(app)
      .post('/api/asesorias/1/soporte/query')
      .send({ pregunta: '   ' });

    expect(res.status).toBe(400);
  });

  it('devuelve 400 si el ID no es numerico', async () => {
    const res = await request(app)
      .post('/api/asesorias/abc/soporte/query')
      .send({ pregunta: '¿Qué problemas tiene?' });

    expect(res.status).toBe(400);
  });

  it('devuelve 503 si OPENAI_API_KEY no esta configurada', async () => {
    // POR QUE: Sin API key, el servicio no puede generar embeddings ni
    // llamar al LLM. Debe indicar el problema claramente, no fallar con
    // un error generico de "fetch failed" o similar.
    const originalKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const res = await request(app)
      .post('/api/asesorias/1/soporte/query')
      .send({ pregunta: '¿Qué incidencias tiene?' });

    expect(res.status).toBe(503);
    expect(res.body.error).toContain('no disponible');

    // Restaurar
    if (originalKey) process.env.OPENAI_API_KEY = originalKey;
  });
});
