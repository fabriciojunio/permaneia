import { PrismaClient } from "@prisma/client";
import { comRastroDeConsultas } from "./rastro-do-banco";

// Em desenvolvimento o Next recarrega os módulos a cada alteração. Sem guardar
// a instância no escopo global, cada recarga abriria um novo pool e o Postgres
// esgotaria as conexões em poucos minutos.
const globalParaPrisma = globalThis as unknown as { prisma?: PrismaClient };

// A instrumentação sai do caminho nos testes unitários: eles não abrem conexão,
// e a extensão só encheria a saída de linha de trecho sem nada medido.
const instrumentar = process.env.NODE_ENV !== "test";

function novoCliente(): PrismaClient {
  const cliente = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
  return instrumentar ? comRastroDeConsultas(cliente) : cliente;
}

export const prisma = globalParaPrisma.prisma ?? novoCliente();

if (process.env.NODE_ENV !== "production") {
  globalParaPrisma.prisma = prisma;
}
