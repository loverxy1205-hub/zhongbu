import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const configured = loadEnv(
    mode,
    process.cwd(),
    "VITE_INTERPRETATION_API_URL",
  ).VITE_INTERPRETATION_API_URL?.trim();
  let origin = "";
  if (configured) {
    const url = new URL(configured);
    const local =
      mode !== "production" &&
      ["localhost", "127.0.0.1"].includes(url.hostname);
    if (
      (url.protocol !== "https:" && !(local && url.protocol === "http:")) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw Error(
        "解读代理必须是无凭据的 HTTPS 地址；不得将密钥配置为前端环境变量。",
      );
    origin = url.origin;
  }
  return {
    base: "./",
    plugins: [
      react(),
      {
        name: "public-proxy-csp",
        transformIndexHtml(html) {
          return html.replace("__AI_CONNECT_ORIGIN__", origin);
        },
      },
    ],
  };
});
