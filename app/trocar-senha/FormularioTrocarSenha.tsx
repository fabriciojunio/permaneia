"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function FormularioTrocarSenha() {
  const router = useRouter();
  const [senhaAtual, setSenhaAtual] = useState("");
  const [senhaNova, setSenhaNova] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [problemas, setProblemas] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);

  async function trocar(evento: React.FormEvent) {
    evento.preventDefault();
    setProblemas([]);
    setEnviando(true);
    try {
      const resposta = await fetch("/api/auth/trocar-senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senhaAtual, senhaNova, confirmacao }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) {
        const campos = dados?.erro?.campos ? Object.values(dados.erro.campos as Record<string, string>) : [];
        setProblemas(campos.length > 0 ? campos : [dados?.erro?.mensagem ?? "Não foi possível trocar a senha."]);
        return;
      }
      // A troca invalida a sessão antiga; o novo cookie já veio na resposta.
      router.replace("/inicio");
      router.refresh();
    } catch {
      setProblemas(["Falha de conexão."]);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={trocar} className="folha space-y-4 p-6">
      <div>
        <label htmlFor="senha-atual" className="rotulo-campo">Senha atual</label>
        <input
          id="senha-atual"
          type="password"
          autoComplete="current-password"
          required
          value={senhaAtual}
          onChange={(e) => setSenhaAtual(e.target.value)}
          className="campo"
        />
      </div>

      <div>
        <label htmlFor="senha-nova" className="rotulo-campo">Senha nova</label>
        <input
          id="senha-nova"
          type="password"
          autoComplete="new-password"
          required
          value={senhaNova}
          onChange={(e) => setSenhaNova(e.target.value)}
          className="campo"
        />
      </div>

      <div>
        <label htmlFor="confirmacao" className="rotulo-campo">Confirme a senha nova</label>
        <input
          id="confirmacao"
          type="password"
          autoComplete="new-password"
          required
          value={confirmacao}
          onChange={(e) => setConfirmacao(e.target.value)}
          className="campo"
        />
      </div>

      {problemas.length > 0 && (
        <ul role="alert" className="aviso space-y-1">
          {problemas.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}

      <button type="submit" disabled={enviando} className="botao-primario w-full">
        {enviando ? "Trocando" : "Trocar senha"}
      </button>
    </form>
  );
}
