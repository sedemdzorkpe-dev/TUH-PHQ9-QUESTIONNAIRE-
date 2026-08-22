import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// base: "./" makes the build use relative asset paths, so it works whether
// GitHub Pages serves it from a custom domain, a user/org site, or a project
// subpath like https://username.github.io/repo-name/ — no edits needed.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
});
