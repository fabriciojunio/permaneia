import type { MetadataRoute } from "next";

/**
 * A aplicação trata dado acadêmico e não tem por que ser rastreada. Além dos
 * buscadores, a regra bloqueia explicitamente os rastreadores de treinamento de
 * modelos de linguagem: o conteúdo aqui inclui documentos institucionais que
 * não foram publicados para esse fim.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", disallow: "/" },
      { userAgent: "GPTBot", disallow: "/" },
      { userAgent: "ChatGPT-User", disallow: "/" },
      { userAgent: "CCBot", disallow: "/" },
      { userAgent: "Google-Extended", disallow: "/" },
      { userAgent: "anthropic-ai", disallow: "/" },
      { userAgent: "ClaudeBot", disallow: "/" },
      { userAgent: "PerplexityBot", disallow: "/" },
      { userAgent: "Bytespider", disallow: "/" },
    ],
  };
}
