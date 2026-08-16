"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function BotaoSair() {
  const router = useRouter();
  const [saindo, setSaindo] = useState(false);

  async function sair() {
    setSaindo(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={sair}
      disabled={saindo}
      className="font-mono text-[11px] uppercase tracking-carimbo text-tinta-fraca hover:text-sagrado"
    >
      {saindo ? "Saindo" : "Sair"}
    </button>
  );
}
