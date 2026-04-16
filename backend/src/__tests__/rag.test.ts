import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma';

// ---------------------------------------------------------------------------
// Mock de OpenAI
// ---------------------------------------------------------------------------
// Mockeamos el modulo openai para no depender de una API key real en tests.
// Esto nos permite testear TODO el flujo RAG (query SQL, aislamiento,
// construccion de prompt, formato de respuesta) sin llamadas externas.

vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      embeddings = {
        create: vi.fn().mockResolvedValue({
          data: [{ embedding: new Array(1536).fill(0.1) }],
        }),
      };
      chat = {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content:
                    'Según los documentos disponibles, se han registrado incidencias. [SUP-TEST-001]',
                },
              },
            ],
          }),
        },
      };
    },
  };
});

// Importar DESPUES del mock para que el mock aplique
import { queryRag } from '../services/rag.service';

// ---------------------------------------------------------------------------
// Setup: insertar documentos de test con embeddings falsos
// ---------------------------------------------------------------------------

const TEST_ASESORIA_ID = 1; // Existe en el seed
const OTHER_ASESORIA_ID = 2; // Existe en el seed

beforeAll(async () => {
  // Insertar documentos de test con embeddings (vector de 1536 dimensiones)
  const fakeEmbedding = `[${new Array(1536).fill(0.5).join(',')}]`;

  // Documento de asesoria 1 — deberia aparecer en resultados
  await prisma.$executeRawUnsafe(
    `INSERT INTO documentos_soporte (doc_id, asesoria_id, fecha, tipo, categoria, prioridad, estado, titulo, texto, tags, embedding)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::vector)
     ON CONFLICT (doc_id) DO UPDATE SET embedding = $11::vector`,
    'SUP-TEST-001',
    TEST_ASESORIA_ID,
    new Date('2025-06-15'),
    'ticket',
    'IVA',
    'alta',
    'resuelto',
    'Problema con modelo 303',
    'El cliente reporta discrepancias en el modelo 303 del segundo trimestre. Se revisa prorrata y facturas rectificativas.',
    ['iva', 'modelo303'],
    fakeEmbedding,
  );

  // Documento de asesoria 2 — NO deberia aparecer en resultados de asesoria 1
  await prisma.$executeRawUnsafe(
    `INSERT INTO documentos_soporte (doc_id, asesoria_id, fecha, tipo, categoria, prioridad, estado, titulo, texto, tags, embedding)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::vector)
     ON CONFLICT (doc_id) DO UPDATE SET embedding = $11::vector`,
    'SUP-TEST-002',
    OTHER_ASESORIA_ID,
    new Date('2025-07-10'),
    'nota_interna',
    'Renta',
    'media',
    'abierto',
    'Campaña de renta con retrasos',
    'Multiples clientes con documentacion incompleta para la declaracion de renta.',
    ['renta', 'retrasos'],
    fakeEmbedding,
  );
});

afterAll(async () => {
  // Limpiar documentos de test
  await prisma.$executeRawUnsafe(
    `DELETE FROM documentos_soporte WHERE doc_id IN ('SUP-TEST-001', 'SUP-TEST-002')`,
  );
  await prisma.$disconnect();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('queryRag — flujo completo con mock de OpenAI', () => {
  it('devuelve respuesta con fuentes para una asesoria valida', async () => {
    process.env.OPENAI_API_KEY = 'test-key';

    const result = await queryRag(TEST_ASESORIA_ID, '¿Qué problemas hay con el IVA?');

    expect(result.respuesta).toContain('SUP-TEST-001');
    expect(result.fuentes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          docId: 'SUP-TEST-001',
          tipo: 'ticket',
          titulo: 'Problema con modelo 303',
        }),
      ]),
    );
  });

  it('aislamiento multitenancy: no devuelve documentos de otra asesoria', async () => {
    process.env.OPENAI_API_KEY = 'test-key';

    const result = await queryRag(TEST_ASESORIA_ID, '¿Qué pasa con la renta?');

    // Las fuentes solo deben contener documentos de TEST_ASESORIA_ID
    const docIds = result.fuentes.map((f) => f.docId);
    expect(docIds).not.toContain('SUP-TEST-002');
  });

  it('devuelve fuentes con formato correcto (docId, tipo, fecha, titulo)', async () => {
    process.env.OPENAI_API_KEY = 'test-key';

    const result = await queryRag(TEST_ASESORIA_ID, '¿Qué incidencias hay?');

    for (const fuente of result.fuentes) {
      expect(fuente).toHaveProperty('docId');
      expect(fuente).toHaveProperty('tipo');
      expect(fuente).toHaveProperty('fecha');
      expect(fuente).toHaveProperty('titulo');
      // fecha debe ser ISO string
      expect(new Date(fuente.fecha).toISOString()).toBe(fuente.fecha);
    }
  });

  it('devuelve mensaje informativo si la asesoria no tiene embeddings', async () => {
    process.env.OPENAI_API_KEY = 'test-key';

    // Insertar documento SIN embedding
    await prisma.$executeRawUnsafe(
      `INSERT INTO documentos_soporte (doc_id, asesoria_id, fecha, tipo, categoria, prioridad, estado, titulo, texto, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (doc_id) DO UPDATE SET embedding = NULL`,
      'SUP-TEST-NOEMBED',
      50, // Asesoria 50 — probablemente sin otros docs con embedding
      new Date('2025-08-01'),
      'chat',
      'Cobros',
      'baja',
      'resuelto',
      'Test sin embedding',
      'Documento de prueba sin embedding generado.',
      ['test'],
    );

    // Buscar asesoria que solo tiene docs sin embedding
    // Primero verificar que no hay otros docs con embedding para asesoria 50
    const docsWithEmbedding = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*) as count FROM documentos_soporte WHERE asesoria_id = 50 AND embedding IS NOT NULL AND doc_id != 'SUP-TEST-NOEMBED'`,
    );

    if (Number(docsWithEmbedding[0].count) === 0) {
      const result = await queryRag(50, '¿Qué problemas hay?');
      expect(result.respuesta).toContain('embeddings');
      expect(result.fuentes).toHaveLength(0);
    }

    // Limpiar
    await prisma.$executeRawUnsafe(
      `DELETE FROM documentos_soporte WHERE doc_id = 'SUP-TEST-NOEMBED'`,
    );
  });

  it('lanza error si la asesoria no existe', async () => {
    process.env.OPENAI_API_KEY = 'test-key';

    await expect(queryRag(99999, '¿Hola?')).rejects.toThrow('Asesoría no encontrada');
  });
});
