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
        {carregando ? "Reunindo seus dados" : "Ver meus dados"}
      </button>

      {erro && (
        <p role="alert" className="aviso">
          {erro}
        </p>
      )}

      {dados && (
        <div>
          <p className="carimbo mb-2">Selecione o conteúdo e copie para salvar</p>
          <pre className="max-h-96 overflow-auto border border-regua bg-papel-alto p-4 font-mono text-xs leading-relaxed text-tinta-media">
            {dados}
          </pre>
        </div>
      )}
    </div>
  );
}
