import { cp, mkdir } from "node:fs/promises";

await mkdir("dist", { recursive: true });
await cp("index.html", "dist/index.html");
await cp("src", "dist/src", { recursive: true });
await cp("public", "dist", { recursive: true });
console.log("✓ Dashboard estático en dist/. Las cotizaciones MPP necesitan el servidor Node (npm run dev).");

