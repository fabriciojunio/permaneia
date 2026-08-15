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
    <button type="button" onClick={sair} disabled={saindo} className="text-sm text-tinta-400 hover:text-tinta-100">
      {saindo ? "Saindo…" : "Sair"}
    </button>
  );
}
