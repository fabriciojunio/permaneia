import { PrismaClient } from "@prisma/client";

// Em desenvolvimento o Next recarrega os módulos a cada alteração. Sem guardar
// a instância no escopo global, cada recarga abriria um novo pool e o Postgres
// esgotaria as conexões em poucos minutos.
const globalParaPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalParaPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalParaPrisma.prisma = prisma;
}
