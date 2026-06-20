import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/pulseboard-week2/",
  plugins: [react()],
});