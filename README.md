# Pulse — Dashboard de Red de Asesorías

Sistema interno para monitorizar la red de asesorías fiscales y contables de Asevia. Permite ver de un vistazo cómo va cada asesoría y la red en su conjunto.

## Setup

### Prerrequisitos

- Docker y Docker Compose
- Node.js 22+ y pnpm (solo para desarrollo local)

### Con Docker (producción / evaluación)

```bash
docker compose up
```

Abre http://localhost:3000. Listo — Postgres, backend y frontend se levantan solos, las migraciones se aplican y los datos se cargan automáticamente.

### Sin Docker (desarrollo)

```bash
# 1. Levantar solo Postgres
docker compose -f docker-compose.yml up postgres

# 2. Backend (otra terminal)
cd backend
pnpm install
pnpm exec prisma generate
pnpm exec prisma migrate dev
pnpm exec prisma db seed
pnpm run dev          # http://localhost:3001

# 3. Frontend (otra terminal)
cd frontend
pnpm install
pnpm run dev          # http://localhost:3000
```

### Tests

```bash
# Backend (requiere Postgres corriendo)
cd backend && pnpm test     # 22 tests

# Frontend
cd frontend && pnpm test    # 19 tests
```

## Estructura del proyecto

```
pulse/
├── docker-compose.yml          # 3 servicios: postgres, backend, frontend
├── .github/workflows/ci.yml   # Pipeline CI: lint, test, build
│
├── backend/                    # Express 5 + TypeScript + Prisma
│   ├── prisma/
│   │   ├── schema.prisma      # Modelo de datos
│   │   ├── migrations/        # SQL versionado
│   │   ├── seed.ts            # Carga CSVs + campos computed
│   │   └── data/              # asesorias_seed.csv, metricas_seed.csv
│   └── src/
│       ├── routes/
│       │   ├── asesorias.ts   # CRUD + filtros + metricas por asesoría
│       │   └── red.ts         # Agregaciones de red + ranking
│       └── lib/prisma.ts      # Singleton PrismaClient
│
└── frontend/                   # Next.js 16 + Tailwind 4 + shadcn/ui
    └── src/
        ├── app/
        │   ├── page.tsx               # Listado con filtros
        │   ├── asesorias/[id]/page.tsx # Detalle + 6 gráficas
        │   └── red/page.tsx           # Visión de red + ranking
        ├── components/
        │   ├── metric-chart.tsx       # Gráfica reutilizable (Recharts)
        │   ├── kpi-card.tsx           # Card de KPI con tendencia
        │   └── growth-ranking.tsx     # Top/bottom 5 asesorías
        └── lib/api.ts                 # Wrapper fetch + tipos
```

## API

| Endpoint | Descripción |
|----------|-------------|
| `GET /health` | Health check |
| `GET /api/asesorias?search=&provincia=&especialidad=&page=&limit=` | Listado con filtros y paginación |
| `GET /api/asesorias/:id` | Detalle de una asesoría |
| `GET /api/asesorias/:id/metricas?from=&to=` | Métricas mensuales (rango opcional YYYY-MM) |
| `GET /api/red/metricas?from=&to=` | Métricas agregadas de red + ranking top/bottom 5 |
| `POST /api/asesorias/:id/soporte/query` | Pregunta RAG sobre documentos de soporte (Fase 2) |

En `postman/Pulse-API.postman_collection.json` hay una colección de Postman lista para importar con todos los endpoints, parámetros y ejemplos.

## Métricas elegidas y por qué

De las 16 métricas disponibles, muestro 6 agrupadas en 3 ejes:

| Eje | Métricas | Por qué |
|-----|----------|---------|
| **Salud del negocio** | Clientes activos, Facturación total | Los dos KPIs que responden "¿crece o decrece?". Si clientes suben pero facturación baja → problema de pricing. |
| **Capacidad operativa** | Declaraciones totales, Tasa de resolución | Declaraciones = carga de trabajo real. Tasa de resolución = ¿el equipo está desbordado? Más útil que consultas en bruto. |
| **Calidad** | Satisfacción cliente, Incidencias AEAT | Satisfacción = voz del cliente. Incidencias AEAT = riesgo regulatorio. Una asesoría con muchas incidencias es un problema serio. |

**Descartadas para la vista principal**: `horas_trabajadas` (sin capacidad máxima, el número no dice nada), `documentos_procesados` (correlaciona con declaraciones), desglose de facturación (ruido para la vista general).

---

## Decisiones técnicas

### 1. ¿Qué dejaste fuera por falta de tiempo?

- **Autenticación**: Pulse es interno, pero en producción necesitaría auth (NextAuth + roles). Lo dejaría preparado con un middleware de JWT.
- **Cache**: Redis para las métricas agregadas de red (cambian 1 vez/mes). Con 50 asesorías y 600 filas no es necesario.
- **Export CSV/PDF**: Funcionalidad obvia para gestores que quieren compartir datos.
- **Observabilidad**: Logging estructurado, métricas de API (latencia, errores), tracing con OpenTelemetry.

### 2. ¿Qué parte es la más frágil o menos eficiente?

- **Query de métricas agregadas de red**: Hace SUM/AVG sobre todas las filas de `metricas_mensuales` sin cache. Con 600 filas es instantáneo (<50ms). Es la primera query que se degrada al escalar.
  - **Mejora**: Vista materializada en Postgres que se refresca con un cron mensual, o cache con invalidación.

- **Búsqueda de texto con ILIKE**: `WHERE nombre ILIKE '%termino%'` no usa índices y escanea la tabla completa. Con 50 filas es irrelevante.
  - **Mejora**: Índice GIN con `pg_trgm` o full-text search de Postgres.

### 3. ¿Qué cambiarías con 5.000 asesorías?

- **Lo primero que peta**: La tabla de asesorías en frontend (5.000 filas renderizadas). → Paginación server-side real (ya implementada en la API), virtualización con TanStack Virtual.

- **Lo segundo**: Las queries agregadas de red (5.000 × 120 meses = 600K filas). → Vista materializada `red_metricas_mensuales` que se regenera diariamente.

- **Búsqueda**: `ILIKE` no escala. → Índice GIN con `pg_trgm` o full-text search.

- **Infraestructura**: Docker Compose ya no basta. → Kubernetes o ECS, base de datos gestionada (RDS), backend con réplicas detrás de un load balancer.

---

## Fase 2 — Soporte Asistido (RAG)

### Setup

Exportar `OPENAI_API_KEY` antes de levantar Docker Compose:

```bash
export OPENAI_API_KEY=sk-...
docker compose up
```

El seed genera los embeddings automáticamente al detectar la variable. Sin API key, los documentos se insertan pero el chat devuelve 503. El dashboard de métricas funciona al 100% sin API key.

Para desarrollo local (sin Docker), añadir la variable al `.env` del backend:

```bash
echo 'OPENAI_API_KEY=sk-...' >> backend/.env
cd backend && pnpm exec prisma db seed
```

### Arquitectura RAG

```
Pregunta del usuario
    ↓
Embed pregunta (text-embedding-3-small) → vector 1536d
    ↓
SELECT documentos WHERE asesoria_id = X ORDER BY embedding <=> question LIMIT 5
    ↓
System prompt + documentos como contexto → LLM (gpt-4o-mini)
    ↓
Respuesta con citas [SUP-XXXX] + lista de fuentes
```

### Endpoint

```
POST /api/asesorias/:id/soporte/query
Body: { "pregunta": "¿Qué incidencias recurrentes tiene?" }
→ { "respuesta": "...", "fuentes": [{ docId, tipo, fecha, titulo }] }
```

### 4. ¿Cómo garantizas el aislamiento entre asesorías?

A nivel de query SQL: `WHERE asesoria_id = $1` se ejecuta **antes** del ordenamiento vectorial. Postgres no calcula similitud contra documentos de otras asesorías — ni siquiera los lee.

A nivel de prompt: el contexto que se pasa al LLM solo contiene fragmentos de la asesoría solicitada. El system prompt instruye: "Responde ÚNICAMENTE con la información proporcionada."

Con 10.000 documentos por asesoría: pgvector con índice IVFFlat seguiría funcionando. A 100K+, particionaría la tabla por `asesoria_id` y consideraría índice HNSW.

### 5. ¿Cómo gestionas la trazabilidad de las respuestas?

Cada respuesta devuelve un array `fuentes` con `{ docId, tipo, fecha, titulo }`. En frontend, cada fuente se muestra visualmente distinta con badge de tipo y fecha.

Si un documento se actualiza: se regenera su embedding. `updated_at` permite detectar si una fuente cambió después de una respuesta histórica.

Si se elimina: soft-delete (`deleted_at`). Las fuentes citadas en respuestas históricas siguen siendo verificables, pero no aparecen en nuevas búsquedas.

### 6. ¿Qué coste y complejidad tiene tu solución?

| Componente | Coste | Complejidad |
|------------|-------|-------------|
| pgvector | Gratis (extensión Postgres) | Mínima — misma BD |
| Embeddings (text-embedding-3-small) | ~$0.001 para 330 docs | Una llamada API en el seed |
| LLM (gpt-4o-mini) | ~$0.15/millón input tokens | Un servicio nuevo, aislado |
| **Total por query** | **~$0.001** | |

Dependencia externa: API de OpenAI. Si cae, el chat devuelve 503 pero Pulse (dashboard + métricas) sigue 100% operativo.
