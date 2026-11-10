import { cp, mkdir } from "node:fs/promises";

await mkdir("dist", { recursive: true });
await cp("index.html", "dist/index.html");
await cp("src", "dist/src", { recursive: true });
await cp("public", "dist", { recursive: true });
console.log("✓ Static dashboard ready in dist/. Paid quotes require the Node server (npm run dev).");

