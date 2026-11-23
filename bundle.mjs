import { build } from "esbuild";
await build({
  entryPoints: ["server/start.mjs"],
  outfile: "server/local.mjs",
  bundle: true,
  platform: "node",
  target: "node24",
  format: "esm",
  minify: true,
  legalComments: "eof",
  external: [
    "vite",
    "bufferutil",
    "utf-8-validate",
    "pg-native",
    "cloudflare:sockets",
  ],
  banner: {
    js: "import {createRequire as __requireFrom} from 'node:module'; const require=__requireFrom(import.meta.url);",
  },
});
