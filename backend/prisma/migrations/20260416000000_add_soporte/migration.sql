-- Habilitar pgvector (la extension debe estar instalada en la imagen de Postgres)
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable
CREATE TABLE "documentos_soporte" (
    "id" SERIAL NOT NULL,
    "doc_id" TEXT NOT NULL,
    "asesoria_id" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "tipo" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "prioridad" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "tags" TEXT[],
    "embedding" vector(1536),

    CONSTRAINT "documentos_soporte_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: doc_id unico
CREATE UNIQUE INDEX "documentos_soporte_doc_id_key" ON "documentos_soporte"("doc_id");

-- CreateIndex: busqueda por asesoria (FK)
CREATE INDEX "documentos_soporte_asesoria_id_idx" ON "documentos_soporte"("asesoria_id");

-- AddForeignKey
ALTER TABLE "documentos_soporte" ADD CONSTRAINT "documentos_soporte_asesoria_id_fkey"
    FOREIGN KEY ("asesoria_id") REFERENCES "asesorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
