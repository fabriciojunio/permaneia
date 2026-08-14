/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  poweredByHeader: false,
  // Source map de produção expõe o código original no navegador; ficar sem ele
  // é a postura padrão do projeto (ver SECURITY.md).
  productionBrowserSourceMaps: false,
  reactStrictMode: true,

  images: {
    formats: ["image/avif", "image/webp"],
    // O app não carrega imagem de domínio externo. Manter a lista vazia impede
    // que uma mudança futura reabra o vetor de SSRF por otimizador de imagem.
    remotePatterns: [],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: false,
  },

  experimental: {
    serverActions: { bodySizeLimit: "1mb" },
  },

  compiler: {
    // Em produção sobra apenas console.error, que alimenta o log estruturado.
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error"] } : false,
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          // "0" desliga o auditor XSS legado dos navegadores, que já foi vetor de
          // vazamento. A proteção real é a CSP logo abaixo.
          { key: "X-XSS-Protection", value: "0" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // ADR 004 explica por que não há nonce nesta versão do Next.
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "font-src 'self' data:",
              "img-src 'self' data: blob:",
              // O navegador nunca fala com a API do Gemini: quem chama é o servidor.
              "connect-src 'self'",
              "frame-ancestors 'none'",
              "form-action 'self'",
              "base-uri 'self'",
              "object-src 'none'",
              "upgrade-insecure-requests",
            ].join("; "),
          },
        ],
      },
      {
        // Resposta de API nunca deve ficar em cache intermediário: carrega dado
        // de aluno e resposta personalizada.
        source: "/api/(.*)",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
