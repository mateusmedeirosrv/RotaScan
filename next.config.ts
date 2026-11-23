import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Import do manifesto envia todas as encomendas da planilha (até ~2.000
      // linhas com 25 campos) numa única Server Action — o padrão é 1MB.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
