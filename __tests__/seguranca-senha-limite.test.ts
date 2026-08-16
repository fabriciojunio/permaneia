import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CUSTO_BCRYPT, TAMANHO_MINIMO_SENHA, avaliarForca, conferirSenha, gerarHash, pontuar } from "@/lib/senha";
import {
  REGRA_ESCRITA,
  REGRA_LOGIN,
  REGRA_RAG,
  REGRA_UPLOAD,
  consumir,
  identificarCliente,
  limparExpirados,
  zerarLimites,
} from "@/lib/rate-limit";
import { DOMINIOS_PERMITIDOS, dominioPermitido } from "@/lib/cadastro";

describe("hash de senha", () => {
  it("usa custo alto o bastante para inviabilizar força bruta em massa", () => {
    expect(CUSTO_BCRYPT).toBeGreaterThanOrEqual(12);
  });

  it("gera hash diferente para a mesma senha, por causa do sal", async () => {
    const a = await gerarHash("senhaDeTeste123");
    const b = await gerarHash("senhaDeTeste123");
    expect(a).not.toBe(b);
  });

  it("o hash não contém a senha em texto", async () => {
    const hash = await gerarHash("minhaSenhaSecreta9");
    expect(hash).not.toContain("minhaSenhaSecreta9");
  });

  it("confere a senha correta", async () => {
    const hash = await gerarHash("senhaCorreta123");
    expect(await conferirSenha("senhaCorreta123", hash)).toBe(true);
  });

  it.each(["senhaErrada123", "senhacorreta123", "SENHACORRETA123", "", " senhaCorreta123"])(
    "recusa a senha %s",
    async (tentativa) => {
      const hash = await gerarHash("senhaCorreta123");
      expect(await conferirSenha(tentativa, hash)).toBe(false);
    }
  );

  it("hash corrompido devolve false em vez de lançar", async () => {
    // Um 500 aqui revelaria que aquele usuário existe e tem um registro quebrado.
    expect(await conferirSenha("qualquer", "não-é-um-hash")).toBe(false);
    expect(await conferirSenha("qualquer", "")).toBe(false);
  });
});

describe("avaliarForca", () => {
  it.each([
    "senhaBoa2026",
    "estudoIA2026ok",
    "permanencia2026",
    "aB3defghij",
  ])("aceita a senha válida %s", (senha) => {
    expect(avaliarForca(senha).valida).toBe(true);
  });

  it.each([
    ["curta1", /pelo menos/],
    ["semnumeros", /número/],
    ["1234567890123", /sequência|letra/],
    ["aaaaaaaaaaaa", /único caractere|número/],
    ["", /pelo menos/],
  ])("recusa %s", (senha, motivo) => {
    const r = avaliarForca(senha);
    expect(r.valida).toBe(false);
    expect(r.problemas.join(" ")).toMatch(motivo);
  });

  it(`exige pelo menos ${TAMANHO_MINIMO_SENHA} caracteres`, () => {
    expect(avaliarForca("aB3defghi").valida).toBe(false);
    expect(avaliarForca("aB3defghij").valida).toBe(true);
  });

  it("recusa senha longa demais, que só consumiria CPU no hash", () => {
    expect(avaliarForca(`a1${"x".repeat(250)}`).valida).toBe(false);
  });

  it.each(["senha123456", "permaneia123", "unisagrado123", "estudante123"])(
    "recusa a senha óbvia %s",
    (senha) => {
      expect(avaliarForca(senha).valida).toBe(false);
    }
  );

  it("recusa sequências previsíveis", () => {
    expect(avaliarForca("abcd1234efgh").valida).toBe(false);
    expect(avaliarForca("senhaqwerty12").valida).toBe(false);
  });

  it("prioriza comprimento sobre variedade de símbolo", () => {
    // Exigir caractere especial empurra o usuário para "Senha@123", que é
    // adivinhável. Dez caracteres com letra e número protegem mais.
    expect(avaliarForca("Senha@123").valida).toBe(false);
    expect(avaliarForca("meucachorroecinza7").valida).toBe(true);
  });

  it("acumula todos os problemas, e não apenas o primeiro", () => {
    expect(avaliarForca("abc").problemas.length).toBeGreaterThanOrEqual(2);
  });

  it("aceita letras acentuadas como letra", () => {
    expect(avaliarForca("çãoéíôûabc9").valida).toBe(true);
  });

  it("a sequência óbvia é recusada mesmo dentro de uma senha longa", () => {
    expect(avaliarForca("çãoéíôû123456").valida).toBe(false);
    expect(avaliarForca("çãoéíôû123456").problemas.join(" ")).toMatch(/sequência/);
  });
});

describe("pontuar", () => {
  it.each([
    ["", 0],
    ["abc", 1],
    ["curta12", 1],
  ])("a senha %s pontua %s", (senha, esperado) => {
    expect(pontuar(senha)).toBe(esperado);
  });

  it("nunca sai de 0 a 4", () => {
    for (const s of ["", "a", "abcdefghij1", "A1" + "b".repeat(60), "aB3!" + "xyz".repeat(20)]) {
      const p = pontuar(s);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(4);
    }
  });

  it("senha mais longa não pontua menos que uma curta equivalente", () => {
    expect(pontuar("aB3defghijkl")).toBeGreaterThanOrEqual(pontuar("aB3defghij"));
  });

  it("penaliza repetição, que anula o ganho do comprimento", () => {
    expect(pontuar("a1a1a1a1a1a1a1a1a1a1")).toBeLessThan(pontuar("umaSenhaVariada2026x"));
  });

  it("nunca diz que é forte uma senha que a política recusa", () => {
    for (const s of ["curta1", "abc", "1234567890"]) {
      const r = avaliarForca(s);
      expect(r.valida).toBe(false);
      expect(r.pontuacao).toBeLessThanOrEqual(1);
    }
  });

  it("o rótulo corresponde à pontuação", () => {
    const rotulos = ["muito fraca", "fraca", "razoável", "boa", "forte"];
    for (const s of ["", "abc", "aB3defghij", "aB3defghijklmn", "aB3!defghijklmnopqrst"]) {
      expect(avaliarForca(s).rotulo).toBe(rotulos[pontuar(s)]);
    }
  });
});

describe("limitação de taxa", () => {
  beforeEach(() => zerarLimites());
  afterEach(() => zerarLimites());

  it("permite até o limite e recusa a seguinte", () => {
    const regra = { limite: 3, janelaMs: 1000 };
    expect(consumir("chave", regra, 0).permitido).toBe(true);
    expect(consumir("chave", regra, 1).permitido).toBe(true);
    expect(consumir("chave", regra, 2).permitido).toBe(true);
    expect(consumir("chave", regra, 3).permitido).toBe(false);
  });

  it("conta o que resta corretamente", () => {
    const regra = { limite: 3, janelaMs: 1000 };
    expect(consumir("k", regra, 0).restantes).toBe(2);
    expect(consumir("k", regra, 1).restantes).toBe(1);
    expect(consumir("k", regra, 2).restantes).toBe(0);
  });

  it("libera de novo quando a janela passa", () => {
    const regra = { limite: 2, janelaMs: 1000 };
    consumir("k", regra, 0);
    consumir("k", regra, 100);
    expect(consumir("k", regra, 200).permitido).toBe(false);
    expect(consumir("k", regra, 1200).permitido).toBe(true);
  });

  it("a janela é deslizante, e não fixa", () => {
    const regra = { limite: 2, janelaMs: 1000 };
    consumir("k", regra, 0);
    consumir("k", regra, 900);
    // Em 1050 a primeira marca saiu da janela, mas a segunda não.
    expect(consumir("k", regra, 1050).permitido).toBe(true);
    expect(consumir("k", regra, 1060).permitido).toBe(false);
  });

  it("informa quantos segundos esperar", () => {
    const regra = { limite: 1, janelaMs: 60_000 };
    consumir("k", regra, 0);
    const r = consumir("k", regra, 1000);
    expect(r.permitido).toBe(false);
    expect(r.esperarSegundos).toBeGreaterThan(0);
    expect(r.esperarSegundos).toBeLessThanOrEqual(60);
  });

  it("chaves diferentes têm contadores independentes", () => {
    const regra = { limite: 1, janelaMs: 1000 };
    expect(consumir("a", regra, 0).permitido).toBe(true);
    expect(consumir("b", regra, 0).permitido).toBe(true);
    expect(consumir("a", regra, 1).permitido).toBe(false);
  });

  it("limparExpirados devolve memória de chaves antigas", () => {
    consumir("antiga", { limite: 5, janelaMs: 1000 }, 0);
    expect(limparExpirados(10_000_000)).toBeGreaterThan(0);
  });

  it("limparExpirados preserva chaves recentes", () => {
    const agora = 1_000_000;
    consumir("recente", { limite: 5, janelaMs: 1000 }, agora);
    limparExpirados(agora);
    // A chave continua contando, prova de que não foi removida.
    expect(consumir("recente", { limite: 1, janelaMs: 600_000 }, agora + 1).permitido).toBe(false);
  });

  it("o login é o limite mais apertado, porque o alvo é adivinhação de senha", () => {
    expect(REGRA_LOGIN.limite).toBeLessThan(REGRA_RAG.limite);
    expect(REGRA_LOGIN.limite).toBeLessThan(REGRA_ESCRITA.limite);
  });

  it("a ingestão de documento tem janela longa, por ser operação cara e rara", () => {
    expect(REGRA_UPLOAD.janelaMs).toBeGreaterThan(REGRA_LOGIN.janelaMs);
  });

  it.each([REGRA_LOGIN, REGRA_RAG, REGRA_UPLOAD, REGRA_ESCRITA])(
    "a regra %o tem limite e janela positivos",
    (regra) => {
      expect(regra.limite).toBeGreaterThan(0);
      expect(regra.janelaMs).toBeGreaterThan(0);
    }
  );
});

describe("identificarCliente", () => {
  const original = process.env.RATE_LIMIT_CONFIA_PROXY;
  afterEach(() => {
    if (original === undefined) delete process.env.RATE_LIMIT_CONFIA_PROXY;
    else process.env.RATE_LIMIT_CONFIA_PROXY = original;
  });

  it("usa o primeiro endereço de x-forwarded-for quando confia no proxy", () => {
    process.env.RATE_LIMIT_CONFIA_PROXY = "true";
    const h = new Headers({ "x-forwarded-for": "203.0.113.5, 198.51.100.1" });
    expect(identificarCliente(h)).toBe("203.0.113.5");
  });

  it("ignora x-forwarded-for quando não confia no proxy", () => {
    // Sem proxy confiável, o cabeçalho é controlado pelo cliente e confiar
    // nele daria a qualquer um um limite infinito, bastando variar o valor.
    process.env.RATE_LIMIT_CONFIA_PROXY = "false";
    const h = new Headers({ "x-forwarded-for": "203.0.113.5" });
    expect(identificarCliente(h)).toBe("desconhecido");
  });

  it("cai para x-real-ip quando não há x-forwarded-for", () => {
    process.env.RATE_LIMIT_CONFIA_PROXY = "true";
    expect(identificarCliente(new Headers({ "x-real-ip": "198.51.100.9" }))).toBe("198.51.100.9");
  });

  it("devolve desconhecido quando não há cabeçalho algum", () => {
    expect(identificarCliente(new Headers())).toBe("desconhecido");
  });

  it("o sufixo separa os contadores por finalidade", () => {
    const h = new Headers({ "x-forwarded-for": "203.0.113.5" });
    expect(identificarCliente(h, "login")).toBe("203.0.113.5:login");
    expect(identificarCliente(h, "upload")).toBe("203.0.113.5:upload");
  });
});

describe("dominioPermitido", () => {
  it("aceita qualquer e-mail quando a lista está vazia", () => {
    // É o comportamento certo para a demonstração acadêmica: o professor e os
    // colegas precisam entrar com o endereço que tiverem.
    if (DOMINIOS_PERMITIDOS.length === 0) {
      expect(dominioPermitido("qualquer@gmail.com")).toBe(true);
      expect(dominioPermitido("pessoa@unisagrado.edu.br")).toBe(true);
    }
  });

  it.each(["sem-arroba", "", "@semlocal.com"])("rejeita o endereço malformado %s quando há lista", (email) => {
    if (DOMINIOS_PERMITIDOS.length > 0) {
      expect(dominioPermitido(email)).toBe(false);
    } else {
      expect(dominioPermitido(email)).toBe(true);
    }
  });
});
