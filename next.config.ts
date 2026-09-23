import type { NextConfig } from "next";

const withPWA = require("next-pwa")({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
});

const nextConfig: NextConfig = {
  // M8: o app não enviava NENHUM header de segurança. Estes quatro são os que dá para ligar
  // sem risco de quebrar tela — não dependem de inventariar o que a página carrega.
  //
  // CSP ficou de fora de propósito: uma política errada quebra o app em produção de forma
  // silenciosa (script bloqueado, tela em branco), e montá-la exige levantar tudo que o app
  // carrega. Vale fazer depois, com `Content-Security-Policy-Report-Only` primeiro.
  //
  // HSTS também não está aqui: a Vercel já envia nos domínios dela.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Impede que o app seja posto em iframe (clickjacking).
          { key: 'X-Frame-Options', value: 'DENY' },
          // Impede o navegador de "adivinhar" o tipo de um arquivo servido.
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Não vaza a URL interna (ex: /anamnese) para sites de terceiros.
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // O app não usa câmera, microfone nem localização.
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default withPWA(nextConfig);
