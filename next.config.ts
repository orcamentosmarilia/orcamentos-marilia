import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fixa a raiz do projeto: há um package.json/node_modules em C:\Users\Pippa
  // que faz o Turbopack inferir a raiz errada e quebrar o resolve do tailwindcss.
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
