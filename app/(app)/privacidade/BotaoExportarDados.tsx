"use client";

import { useState } from "react";

export function BotaoExportarDados() {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [dados, setDados] = useState<string | null>(null);

  async function exportar() {
    setCarregando(true);
    setErro(null);
    try {
      const resposta = await fetch("/api/privacidade/meus-dados");
      const corpo = await resposta.json();
      if (!resposta.ok) {
        setErro(corpo?.erro?.mensagem ?? "Não foi possível montar a exportação.");
        return;
      }
      setDados(JSON.stringify(corpo, null, 2));
    } catch {
      setErro("Falha de conexão.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="space-y-3">
      <button type="button" onClick={exportar} disabled={carregando} className="botao-primario">
        {carregando ? "Reunindo seus dados…" : "Ver meus dados"}
      </button>

      {erro && (
        <p role="alert" className="rounded-md border border-red-900 bg-red-950/60 px-3 py-2 text-sm text-red-200">
          {erro}
        </p>
      )}

      {dados && (
        <div>
          <p className="mb-2 text-xs text-tinta-400">
            Selecione o conteúdo abaixo e copie para salvar em um arquivo.
          </p>
          <pre className="max-h-96 overflow-auto rounded-md border border-tinta-700 bg-tinta-950 p-4 font-mono text-xs leading-relaxed text-tinta-300">
            {dados}
          </pre>
        </div>
      )}
    </div>
  );
}
