import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// Alias "@" -> ./src  (comme le scaffold Softr de référence).
// Block.tsx (racine) importe @/components/ui/* et @/lib/* qui sont mockés dans src/.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
