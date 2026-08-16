"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ContaDemo = { papel: "aluno" | "coordenacao"; email: string; descricao: string };

export function FormularioLogin({
  modoDemo,
  contasDemo,
}: {
  modoDemo: boolean;
  contasDemo: ReadonlyArray<ContaDemo>;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const resposta = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) {
        setErro(dados?.erro?.mensagem ?? "Não foi possível entrar.");
        return;
      }
      // replace: o login não deve ficar no histórico de navegação.
      router.replace(dados.usuario?.trocarSenha ? "/trocar-senha" : "/inicio");
      router.refresh();
    } catch {
      setErro("Falha de conexão. Verifique sua internet e tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  async function entrarDemo(papel: string) {
    setErro(null);
    setEnviando(true);
    try {
      const resposta = await fetch("/api/auth/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ papel }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) {
        setErro(dados?.erro?.mensagem ?? "A demonstração não está disponível agora.");
        return;
      }
      router.replace("/inicio");
      router.refresh();
    } catch {
      setErro("Falha de conexão. Verifique sua internet e tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <form onSubmit={entrar} className="folha space-y-4 p-6">
        <div>
          <label htmlFor="email" className="rotulo-campo">
            E-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="campo"
            placeholder="voce@unisagrado.edu.br"
          />
        </div>

        <div>
          <label htmlFor="senha" className="rotulo-campo">
            Senha
          </label>
          <input
            id="senha"
            name="senha"
            type="password"
            autoComplete="current-password"
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="campo"
          />
        </div>

        {erro && (
          <p role="alert" className="border-l-2 border-risco-critico bg-sagrado-fraco px-3 py-2 text-sm text-sagrado-escuro">
            {erro}
          </p>
        )}

        <button type="submit" disabled={enviando} className="botao-primario w-full">
          {enviando ? "Entrando" : "Entrar"}
        </button>
      </form>

      {modoDemo && contasDemo.length > 0 && (
        <section className="mt-6" aria-labelledby="demo">
          <h2 id="demo" className="carimbo mb-2">
            Ou entre na demonstração
          </h2>
          <div className="space-y-2">
            {contasDemo.map((conta) => (
              <button
                key={conta.papel}
                type="button"
                onClick={() => entrarDemo(conta.papel)}
                disabled={enviando}
                className="w-full border border-regua-forte bg-papel-alto p-3 text-left transition-colors hover:border-sagrado disabled:opacity-45"
              >
                <span className="block font-mono text-[11px] uppercase tracking-carimbo text-sagrado">
                  {conta.papel}
                </span>
                <span className="mt-0.5 block text-[13px] leading-snug text-tinta-media">
                  {conta.descricao}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-tinta-fraca">
            A base da demonstração é sintética. Nenhum dado corresponde a uma pessoa real.
          </p>
        </section>
      )}
    </>
  );
}
