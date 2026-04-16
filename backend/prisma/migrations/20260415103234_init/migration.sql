-- CreateEnum
CREATE TYPE "Especialidad" AS ENUM ('Fiscal', 'Contable', 'Laboral');

-- CreateTable
CREATE TABLE "asesorias" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "cif" TEXT NOT NULL,
    "provincia" TEXT NOT NULL,
    "ciudad" TEXT NOT NULL,
    "fecha_alta" TIMESTAMP(3) NOT NULL,
    "num_empleados" INTEGER NOT NULL,
    "especialidad" "Especialidad" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asesorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metricas_mensuales" (
    "id" SERIAL NOT NULL,
    "asesoria_id" INTEGER NOT NULL,
    "periodo" TIMESTAMP(3) NOT NULL,
    "clientes_activos" INTEGER NOT NULL,
    "clientes_nuevos" INTEGER NOT NULL,
    "clientes_baja" INTEGER NOT NULL,
    "declaraciones_renta" INTEGER NOT NULL,
    "declaraciones_iva" INTEGER NOT NULL,
    "declaraciones_sociedades" INTEGER NOT NULL,
    "declaraciones_otros" INTEGER NOT NULL,
    "declaraciones_total" INTEGER NOT NULL,
    "facturacion_asesoria_eur" DOUBLE PRECISION NOT NULL,
    "facturacion_gestion_eur" DOUBLE PRECISION NOT NULL,
    "facturacion_consultoria_eur" DOUBLE PRECISION NOT NULL,
    "facturacion_total" DOUBLE PRECISION NOT NULL,
    "horas_trabajadas" INTEGER NOT NULL,
    "consultas_recibidas" INTEGER NOT NULL,
    "consultas_resueltas" INTEGER NOT NULL,
    "tasa_resolucion" DOUBLE PRECISION,
    "incidencias_aeat" INTEGER NOT NULL,
    "documentos_procesados" INTEGER NOT NULL,
    "satisfaccion_cliente" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "metricas_mensuales_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "asesorias_cif_key" ON "asesorias"("cif");

-- CreateIndex
CREATE INDEX "metricas_mensuales_asesoria_id_idx" ON "metricas_mensuales"("asesoria_id");

-- CreateIndex
CREATE UNIQUE INDEX "metricas_mensuales_asesoria_id_periodo_key" ON "metricas_mensuales"("asesoria_id", "periodo");

-- AddForeignKey
ALTER TABLE "metricas_mensuales" ADD CONSTRAINT "metricas_mensuales_asesoria_id_fkey" FOREIGN KEY ("asesoria_id") REFERENCES "asesorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
