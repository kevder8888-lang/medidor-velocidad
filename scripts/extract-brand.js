const fs = require("fs");
const h = fs.readFileSync("public/brand/gob.html", "utf8");

const urls = [...h.matchAll(/https?:\/\/[^\s"'<>]+/g)]
  .map((m) => m[0])
  .filter((u) => /logo|favicon|osiptel|\.png|\.svg|\.jpg|webp|uploads/i.test(u));
console.log("=== URLS ===");
[...new Set(urls)].slice(0, 50).forEach((u) => console.log(u));

const colors = [...h.matchAll(/#[0-9A-Fa-f]{6}/g)].map((m) => m[0].toUpperCase());
const c = {};
colors.forEach((x) => (c[x] = (c[x] || 0) + 1));
console.log("=== COLORS ===");
Object.entries(c)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 30)
  .forEach(([k, v]) => console.log(k, v));

const srcs = [
  ...h.matchAll(/(?:src|href|content)="([^"]+\.(?:png|svg|jpg|jpeg|webp|ico))"/gi),
].map((m) => m[1]);
console.log("=== ASSETS ===");
[...new Set(srcs)].slice(0, 50).forEach((u) => console.log(u));

const rel = [...h.matchAll(/["']([^"']*logo[^"']*)["']/gi)].map((m) => m[1]);
console.log("=== LOGO-ISH ===");
[...new Set(rel)].slice(0, 40).forEach((u) => console.log(u));
