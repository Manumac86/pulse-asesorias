import OpenAI from 'openai';
import { prisma } from '../lib/prisma';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface Fuente {
  docId: string;
  tipo: string;
  fecha: string;
  titulo: string;
}

interface RagResponse {
  respuesta: string;
  fuentes: Fuente[];
}

// ---------------------------------------------------------------------------
// RAG Service
// ---------------------------------------------------------------------------
// Flujo:
//   1. Embed la pregunta del usuario → vector 1536d
//   2. Buscar los 5 documentos mas similares WHERE asesoria_id = X
//   3. Construir prompt con los documentos como contexto
//   4. Enviar a Claude/GPT → obtener respuesta con citas
//   5. Extraer las fuentes citadas del contexto

// Instanciacion lazy: no crashea si OPENAI_API_KEY no esta al importar
function getOpenAI(): OpenAI {
  return new OpenAI();
}

// Paso 1: Generar embedding de la pregunta
async function embedQuestion(question: string): Promise<number[]> {
  const response = await getOpenAI().embeddings.create({
    model: 'text-embedding-3-small',
    input: question,
  });
  return response.data[0].embedding;
}

// Paso 2: Buscar documentos similares (vector search con aislamiento por asesoria)
// El WHERE asesoria_id = $1 se ejecuta ANTES del ordenamiento vectorial.
// Postgres no calcula similitud contra documentos de otras asesorias.
async function searchDocuments(asesoriaId: number, questionEmbedding: number[], limit = 5) {
  const vectorStr = `[${questionEmbedding.join(',')}]`;

  const results = await prisma.$queryRawUnsafe<
    {
      doc_id: string;
      tipo: string;
      fecha: Date;
      titulo: string;
      texto: string;
      categoria: string;
      similarity: number;
    }[]
  >(
    `SELECT
      doc_id,
      tipo,
      fecha,
      titulo,
      texto,
      categoria,
      1 - (embedding <=> $1::vector) AS similarity
    FROM documentos_soporte
    WHERE asesoria_id = $2
      AND embedding IS NOT NULL
    ORDER BY embedding <=> $1::vector
    LIMIT $3`,
    vectorStr,
    asesoriaId,
    limit,
  );

  return results;
}

// Paso 3-4: Construir prompt y generar respuesta
async function generateResponse(
  question: string,
  documents: Awaited<ReturnType<typeof searchDocuments>>,
): Promise<string> {
  // Construir el contexto con los documentos encontrados
  const context = documents
    .map(
      (doc, i) =>
        `[Documento ${i + 1}: ${doc.doc_id}]
Tipo: ${doc.tipo} | Categoría: ${doc.categoria} | Fecha: ${new Date(doc.fecha).toLocaleDateString('es-ES')}
Título: ${doc.titulo}
Contenido: ${doc.texto}`,
    )
    .join('\n\n---\n\n');

  const completion = await getOpenAI().chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.3,
    messages: [
      {
        role: 'system',
        content: `Eres un asistente de soporte para una red de asesorías fiscales y contables.

REGLAS ESTRICTAS:
- Responde ÚNICAMENTE con la información de los documentos proporcionados abajo.
- Cita SIEMPRE las fuentes usando el formato [DOC_ID] (ej: [SUP-0042]).
- Si los documentos no contienen información suficiente para responder, di claramente: "No dispongo de información suficiente en los documentos disponibles para responder esta pregunta."
- NO inventes información ni uses conocimiento externo.
- Responde en español.
- Sé conciso y directo.

DOCUMENTOS DISPONIBLES:
${context}`,
      },
      {
        role: 'user',
        content: question,
      },
    ],
  });

  return completion.choices[0]?.message?.content ?? 'No se pudo generar una respuesta.';
}

// ---------------------------------------------------------------------------
// Funcion principal: query RAG
// ---------------------------------------------------------------------------

export async function queryRag(asesoriaId: number, pregunta: string): Promise<RagResponse> {
  // Verificar que la asesoria existe
  const asesoria = await prisma.asesoria.findUnique({ where: { id: asesoriaId } });
  if (!asesoria) {
    throw new Error('Asesoría no encontrada');
  }

  // Verificar que hay documentos con embeddings
  const docsCount = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT COUNT(*) as count FROM documentos_soporte WHERE asesoria_id = $1 AND embedding IS NOT NULL`,
    asesoriaId,
  );

  if (Number(docsCount[0].count) === 0) {
    return {
      respuesta:
        'No hay documentos de soporte indexados para esta asesoría. Asegúrate de que se hayan generado los embeddings (se requiere OPENAI_API_KEY).',
      fuentes: [],
    };
  }

  // 1. Embed pregunta
  const questionEmbedding = await embedQuestion(pregunta);

  // 2. Buscar documentos relevantes (aislados por asesoria_id)
  const documents = await searchDocuments(asesoriaId, questionEmbedding);

  if (documents.length === 0) {
    return {
      respuesta: 'No se encontraron documentos relevantes para esta pregunta.',
      fuentes: [],
    };
  }

  // 3-4. Generar respuesta con LLM
  const respuesta = await generateResponse(pregunta, documents);

  // 5. Extraer fuentes (los documentos que le pasamos al LLM)
  const fuentes: Fuente[] = documents.map((doc) => ({
    docId: doc.doc_id,
    tipo: doc.tipo,
    fecha: new Date(doc.fecha).toISOString(),
    titulo: doc.titulo,
  }));

  return { respuesta, fuentes };
}
