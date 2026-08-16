// Carrega as variáveis de ambiente antes dos testes de integração.
//
// A suíte unitária não precisa disto porque não toca em banco nem em rede. Aqui
// é o contrário: sem DATABASE_URL não há o que testar.

import "../../scripts/_carregar-env";

// Força o modo local do provedor de IA nos testes de integração. Depender da
// cota do Gemini tornaria a suíte não determinística e a faria falhar quando a
// cota diária acabasse, o que não diz nada sobre o código.
process.env.IA_EXTERNA = "off";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL não configurada. Os testes de integração precisam de um Postgres com pgvector."
  );
}
