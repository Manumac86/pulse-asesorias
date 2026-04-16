import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { asesoriasRouter } from './routes/asesorias';
import { redRouter } from './routes/red';

const app = express();
const PORT = process.env.PORT || 3001;

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

// CORS: permite requests desde el frontend.
// En produccion, FRONTEND_URL seria "https://pulse.asevia.com".
// En desarrollo, es "http://localhost:3000".
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));

// Parsea el body de POST/PUT como JSON automaticamente.
// Sin esto, req.body seria undefined.
app.use(express.json());

// Logging simple: imprime metodo + path + status + tiempo.
// En produccion usarias morgan o pino.
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} ${ms}ms`);
  });
  next();
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/asesorias', asesoriasRouter);
app.use('/api/red', redRouter);

// ---------------------------------------------------------------------------
// Error handling middleware
// ---------------------------------------------------------------------------
// Express reconoce un middleware de error por tener 4 parametros (err, req, res, next).
// Cualquier error que se lance en un route handler llega aqui.
// Sin esto, Express devuelve un HTML feo con el stack trace.

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error('Unhandled error:', err.message);
    res.status(500).json({
      error: 'Error interno del servidor',
      ...(process.env.NODE_ENV !== 'production' && { detail: err.message }),
    });
  },
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`Pulse backend running on http://localhost:${PORT}`);
});

export default app;
