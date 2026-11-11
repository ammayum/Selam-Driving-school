import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  base: "/build/",
  build: { outDir: "../public/build", emptyOutDir: true, manifest: true },
});
