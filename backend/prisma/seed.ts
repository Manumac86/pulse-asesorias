import { PrismaClient, Especialidad } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';
import OpenAI from 'openai';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Utilidad: parsear CSV simple (sin comillas, sin multilinea)
// ---------------------------------------------------------------------------
// Devuelve un array de objetos { header1: valor1, header2: valor2, ... }
// Ejemplo: [{ id: "1", nombre: "Gestoria Martínez", ... }]
function parseCSV(filePath: string): Record<string, string>[] {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',');

  return lines.slice(1).map((line) => {
    const values = line.split(',');
    const row: Record<string, string> = {};
    headers.forEach((header, i) => {
      row[header.trim()] = values[i]?.trim() ?? '';
    });
    return row;
  });
}

// ---------------------------------------------------------------------------
// Seed: Asesorias
// ---------------------------------------------------------------------------
// Lee asesorias_seed.csv y hace upsert por CIF (campo unico).
// Upsert = si el CIF ya existe, actualiza los datos; si no, inserta.
// Esto hace el seed IDEMPOTENTE: puedes correrlo N veces sin duplicados.
async function seedAsesorias() {
  const dataPath = join(__dirname, 'data', 'asesorias_seed.csv');
  const rows = parseCSV(dataPath);

  console.log(`Seeding ${rows.length} asesorias...`);

  for (const row of rows) {
    // Validar que la especialidad es un valor valido del enum
    const especialidad = row.especialidad as Especialidad;
    if (!Object.values(Especialidad).includes(especialidad)) {
      console.warn(`Especialidad desconocida: ${row.especialidad}, saltando asesoria ${row.nombre}`);
      continue;
    }

    await prisma.asesoria.upsert({
      where: { cif: row.cif },
      update: {
        nombre: row.nombre,
        provincia: row.provincia,
        ciudad: row.ciudad,
        fechaAlta: new Date(row.fecha_alta),
        numEmpleados: parseInt(row.num_empleados, 10),
        especialidad,
      },
      create: {
        id: parseInt(row.id, 10),
        nombre: row.nombre,
        cif: row.cif,
        provincia: row.provincia,
        ciudad: row.ciudad,
        fechaAlta: new Date(row.fecha_alta),
        numEmpleados: parseInt(row.num_empleados, 10),
        especialidad,
      },
    });
  }

  console.log(`✓ ${rows.length} asesorias seeded`);
}

// ---------------------------------------------------------------------------
// Seed: Metricas Mensuales
// ---------------------------------------------------------------------------
// Lee metricas_seed.csv, calcula los 3 campos computed, y hace upsert
// por la combinacion unica (asesoria_id, periodo).
async function seedMetricas() {
  const dataPath = join(__dirname, 'data', 'metricas_seed.csv');
  const rows = parseCSV(dataPath);

  console.log(`Seeding ${rows.length} metricas mensuales...`);

  for (const row of rows) {
    const asesoriaId = parseInt(row.asesoria_id, 10);

    // Parsear el mes (formato "2025-04") a Date (primer dia del mes)
    const periodo = new Date(`${row.mes}-01T00:00:00.000Z`);

    // Campos raw del CSV
    const declaracionesRenta = parseInt(row.declaraciones_renta, 10);
    const declaracionesIva = parseInt(row.declaraciones_iva, 10);
    const declaracionesSociedades = parseInt(row.declaraciones_sociedades, 10);
    const declaracionesOtros = parseInt(row.declaraciones_otros, 10);

    const facturacionAsesoriaEur = parseFloat(row.facturacion_asesoria_eur);
    const facturacionGestionEur = parseFloat(row.facturacion_gestion_eur);
    const facturacionConsultoriaEur = parseFloat(row.facturacion_consultoria_eur);

    const consultasRecibidas = parseInt(row.consultas_recibidas, 10);
    const consultasResueltas = parseInt(row.consultas_resueltas, 10);

    // --- CAMPOS COMPUTED ---
    // Estos no existen en el CSV. Los calculamos aqui una vez
    // para evitar recalcularlos en cada query de la API.
    const declaracionesTotal =
      declaracionesRenta + declaracionesIva + declaracionesSociedades + declaracionesOtros;

    const facturacionTotal =
      facturacionAsesoriaEur + facturacionGestionEur + facturacionConsultoriaEur;

    // Tasa de resolucion: null si no hay consultas (evita division por cero)
    const tasaResolucion =
      consultasRecibidas > 0
        ? Math.round((consultasResueltas / consultasRecibidas) * 10000) / 10000
        : null;

    const data = {
      asesoriaId,
      periodo,
      clientesActivos: parseInt(row.clientes_activos, 10),
      clientesNuevos: parseInt(row.clientes_nuevos, 10),
      clientesBaja: parseInt(row.clientes_baja, 10),
      declaracionesRenta,
      declaracionesIva,
      declaracionesSociedades,
      declaracionesOtros,
      declaracionesTotal,
      facturacionAsesoriaEur,
      facturacionGestionEur,
      facturacionConsultoriaEur,
      facturacionTotal,
      horasTrabajadas: parseInt(row.horas_trabajadas, 10),
      consultasRecibidas,
      consultasResueltas,
      tasaResolucion,
      incidenciasAeat: parseInt(row.incidencias_aeat, 10),
      documentosProcesados: parseInt(row.documentos_procesados, 10),
      satisfaccionCliente: parseFloat(row.satisfaccion_cliente),
    };

    await prisma.metricaMensual.upsert({
      where: {
        // Usa el unique constraint compuesto para el upsert
        asesoriaId_periodo: { asesoriaId, periodo },
      },
      update: data,
      create: data,
    });
  }

  console.log(`✓ ${rows.length} metricas seeded`);
}

// ---------------------------------------------------------------------------
// Seed: Documentos de Soporte (Fase 2)
// ---------------------------------------------------------------------------
// Lee soporte_seed.jsonl e inserta los documentos.
// Si OPENAI_API_KEY esta disponible, genera embeddings con text-embedding-3-small.
// Si no, inserta sin embedding (el RAG no funcionara pero la app no crashea).

interface SoporteDoc {
  doc_id: string;
  asesoria_id: number;
  fecha: string;
  tipo: string;
  categoria: string;
  prioridad: string;
  estado: string;
  titulo: string;
  texto: string;
  tags: string[];
}

async function seedSoporte() {
  const dataPath = join(__dirname, 'data', 'soporte_seed.jsonl');

  let lines: string[];
  try {
    lines = readFileSync(dataPath, 'utf-8').trim().split('\n');
  } catch {
    console.log('⏭ soporte_seed.jsonl not found, skipping');
    return;
  }

  const docs: SoporteDoc[] = lines.map((line) => JSON.parse(line));
  console.log(`Seeding ${docs.length} documentos de soporte...`);

  // Insertar documentos (sin embeddings primero)
  for (const doc of docs) {
    await prisma.documentoSoporte.upsert({
      where: { docId: doc.doc_id },
      update: {
        fecha: new Date(doc.fecha),
        tipo: doc.tipo,
        categoria: doc.categoria,
        prioridad: doc.prioridad,
        estado: doc.estado,
        titulo: doc.titulo,
        texto: doc.texto,
        tags: doc.tags,
      },
      create: {
        docId: doc.doc_id,
        asesoriaId: doc.asesoria_id,
        fecha: new Date(doc.fecha),
        tipo: doc.tipo,
        categoria: doc.categoria,
        prioridad: doc.prioridad,
        estado: doc.estado,
        titulo: doc.titulo,
        texto: doc.texto,
        tags: doc.tags,
      },
    });
  }

  console.log(`✓ ${docs.length} documentos insertados`);

  // --- Generar embeddings (si hay API key) ---
  if (!process.env.OPENAI_API_KEY) {
    console.log('⏭ OPENAI_API_KEY not set, skipping embedding generation');
    console.log('  El chat RAG no funcionara hasta que se generen embeddings.');
    return;
  }

  console.log('Generating embeddings with text-embedding-3-small...');
  const openai = new OpenAI();

  // Procesar en batches de 20 (la API acepta hasta 2048 inputs por request)
  const BATCH_SIZE = 20;
  let processed = 0;

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = docs.slice(i, i + BATCH_SIZE);
    const texts = batch.map((d) => `${d.titulo}\n${d.texto}`);

    try {
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: texts,
      });

      // Actualizar cada documento con su embedding via raw SQL
      // (Prisma no soporta el tipo vector nativamente)
      for (let j = 0; j < batch.length; j++) {
        const embedding = response.data[j].embedding;
        const vectorStr = `[${embedding.join(',')}]`;

        await prisma.$executeRawUnsafe(
          `UPDATE documentos_soporte SET embedding = $1::vector WHERE doc_id = $2`,
          vectorStr,
          batch[j].doc_id,
        );
      }

      processed += batch.length;
      console.log(`  ${processed}/${docs.length} embeddings generated`);
    } catch (err) {
      console.error(`  Error generating embeddings for batch ${i}:`, err);
      console.log('  Continuing with remaining batches...');
    }
  }

  console.log(`✓ Embeddings generation complete (${processed}/${docs.length})`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('Starting seed...');

  // Orden importa: primero asesorias (parent), luego metricas y soporte (children con FK)
  await seedAsesorias();
  await seedMetricas();
  await seedSoporte();

  console.log('Seed complete!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
