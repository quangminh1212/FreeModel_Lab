const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..", "web");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const js = fs.readFileSync(path.join(root, "app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "style.css"), "utf8");

const ids = new Set(Array.from(html.matchAll(/id="([^"]+)"/g), (m) => m[1]));
const symbols = new Set(Array.from(html.matchAll(/<symbol id="i-([^"]+)"/g), (m) => m[1]));
const usedIcons = new Set(Array.from(js.matchAll(/icon\("([a-z-]+)"/g), (m) => m[1]));
const queried = new Set(Array.from(js.matchAll(/querySelector\("#([^"]+)"\)/g), (m) => m[1]));
const htmlClasses = new Set(
  Array.from(html.matchAll(/class="([^"]+)"/g), (m) => m[1].split(/\s+/)).flat()
);
const cssClasses = new Set(Array.from(css.matchAll(/\.([a-zA-Z][\w-]*)/g), (m) => m[1]));

const missingIds = Array.from(queried).filter((id) => !ids.has(id));
const missingIcons = Array.from(usedIcons).filter((name) => !symbols.has(name));
/* classes created by app.js via el(tag, "class") or classList.add */
const addedClasses = new Set(
  Array.from(js.matchAll(/el\("[a-z0-9]+", "([^"]+)"/g), (m) => m[1].split(/\s+/)).flat()
);
const unstyled = Array.from(addedClasses).filter((name) => name && !cssClasses.has(name));

console.log("queried ids:", queried.size, "| missing:", missingIds.join(",") || "none");
console.log("icons used:", usedIcons.size, "| missing:", missingIcons.join(",") || "none");
console.log("js classes:", addedClasses.size, "| unstyled:", unstyled.join(",") || "none");
console.log("inline script tags:", (html.match(/<script(?![^>]*src=)/g) || []).length);
console.log("inline style attrs:", (html.match(/\sstyle="/g) || []).length);
console.log("asset refs:", Array.from(html.matchAll(/(?:src|href)="([^"#][^"]*)"/g), (m) => m[1]).join(","));
