import { PrismaClient } from '@prisma/client';

// Singleton: una sola instancia de PrismaClient para toda la app.
//
// PrismaClient mantiene un pool de conexiones a PostgreSQL (por defecto,
// num_cpus * 2 + 1 conexiones). Si crearas un new PrismaClient() en cada
// request, cada uno abriria su propio pool — con 100 requests concurrentes,
// tendrias 500+ conexiones y Postgres se caeria.
//
// En desarrollo con hot reload (tsx watch), el modulo se re-importa en cada
// cambio. El truco de globalThis evita crear multiples instancias:
// guardamos la instancia en una variable global que sobrevive al hot reload.

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
