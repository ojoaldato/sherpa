import { defineConfig } from "bunli";

export default defineConfig({
  name: "sherpa",
  version: "0.1.0",

  build: {
    entry: "./src/cli.ts",
    outdir: "./dist",
    minify: true,
  },

  dev: {
    watch: true,
  },
});
