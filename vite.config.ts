import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { VitePWA } from "vite-plugin-pwa";

// SharedArrayBuffer (needed for synchronous Python input()) requires
// cross-origin isolation. The dev/preview servers send the headers directly;
// in production the service worker injects them on navigation responses.
const coiHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

export default defineConfig({
  plugins: [
    svelte(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "autoUpdate",
      injectRegister: false,
      manifest: {
        name: "PyIDE — Python Online IDE",
        short_name: "PyIDE",
        description:
          "Offline-fähige Python-IDE im Browser: Editor, Terminal, Dateien und Plots — powered by Pyodide.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#1f1f1f",
        theme_color: "#1f1f1f",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icons/icon-maskable-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "/icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      injectManifest: {
        globPatterns: [
          "**/*.{js,mjs,css,html,svg,png,ico,wasm,zip,json,woff2,webmanifest}",
        ],
        globIgnores: ["**/*.map"],
        // pyodide.asm.wasm + python_stdlib.zip are large but required offline
        maximumFileSizeToCacheInBytes: 64 * 1024 * 1024,
      },
      devOptions: { enabled: false },
    }),
  ],
  server: { headers: coiHeaders },
  preview: { headers: coiHeaders },
  build: { target: "es2022" },
});
