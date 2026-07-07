import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const base = process.env.VITE_BASE ?? "/";
const isStaticPages = process.env.VITE_STATIC_PORTFOLIO === "1";

const spaPathRedirect = `
<script>
(function () {
  if (!/\\/project\\/dosmentes\\/?$/.test(location.pathname) || location.hash) return;
  var base = location.pathname.split("/project/dosmentes")[0];
  if (!base.endsWith("/")) base += "/";
  location.replace(base + "#/project/dosmentes");
})();
</script>`;

export default defineConfig({
  base,
  plugins: [
    react(),
    {
      name: "gh-pages-spa-redirect",
      transformIndexHtml(html) {
        if (!isStaticPages) return html;
        return html.replace("</head>", `${spaPathRedirect}</head>`);
      },
    },
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:3099",
    },
  },
  build: {
    outDir: "dist",
  },
});
