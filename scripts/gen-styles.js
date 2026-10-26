#!/usr/bin/env node
"use strict";

/**
 * Generates the `data-style` theme blocks appended to web/style.css.
 *
 * Source of truth: the STYLES array inside docs/ui-catalog/index.html, which
 * itself was built from the real palettes of the referenced open-source
 * projects (see docs/ui-style-catalog.md).
 *
 * Each catalog entry carries 17 tokens. The dashboard exposes 41 CSS custom
 * properties. This script expands 17 -> 41 deterministically so that no style
 * can leave a token undefined (an undefined token would fall back to the dark
 * VS Code default and visibly break a light theme).
 *
 * Usage:  node scripts/gen-styles.js            # print CSS to stdout
 *         node scripts/gen-styles.js --check    # verify style.css is current
 *         node scripts/gen-styles.js --write     # regenerate style.css in place
 *
 * Always prefer --write over shell redirection: PowerShell's `>` emits UTF-16LE,
 * which silently produces a file whose markers no longer match.
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const CATALOG = path.join(ROOT, "docs", "ui-catalog", "index.html");
const STYLE_CSS = path.join(ROOT, "web", "style.css");

const BEGIN = "/* ==== BEGIN GENERATED STYLE BLOCKS (scripts/gen-styles.js) ==== */";
const END = "/* ==== END GENERATED STYLE BLOCKS ==== */";

/* ---------- colour helpers ---------- */

function parseHex(hex) {
  let h = String(hex).trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`bad hex: ${hex}`);
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function toHex(rgb) {
  return (
    "#" +
    rgb
      .map((v) => {
        const n = Math.max(0, Math.min(255, Math.round(v)));
        return n.toString(16).padStart(2, "0");
      })
      .join("")
  );
}

/** Linear blend of two hex colours. t=0 -> a, t=1 -> b. */
function mix(a, b, t) {
  const x = parseHex(a);
  const y = parseHex(b);
  return toHex(x.map((v, i) => v + (y[i] - v) * t));
}

/** Relative luminance, used to decide black vs white foreground. */
function luminance(hex) {
  const [r, g, b] = parseHex(hex).map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a, b) {
  const first = luminance(a);
  const second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function minimumContrast(hex, backgrounds) {
  return Math.min(...backgrounds.map((background) => contrastRatio(hex, background)));
}

/** Preserve a palette colour while moving it just far enough to meet contrast. */
function accessibleColor(hex, backgrounds, minimum = 4.5) {
  if (minimumContrast(hex, backgrounds) >= minimum) return hex;

  const candidates = [];
  for (const endpoint of ["#000000", "#ffffff"]) {
    let low = 0;
    let high = 1;
    let result = null;
    for (let step = 0; step < 24; step++) {
      const amount = (low + high) / 2;
      const candidate = mix(hex, endpoint, amount);
      if (minimumContrast(candidate, backgrounds) >= minimum) {
        result = { color: candidate, amount };
        high = amount;
      } else {
        low = amount;
      }
    }
    if (result) candidates.push(result);
  }

  if (candidates.length) {
    return candidates.sort((a, b) => a.amount - b.amount)[0].color;
  }

  const black = minimumContrast("#000000", backgrounds);
  const white = minimumContrast("#ffffff", backgrounds);
  return black >= white ? "#000000" : "#ffffff";
}

function isLight(hex) {
  return luminance(hex) > 0.4;
}

/** `#fff` or `#000`, whichever contrasts more with the given background. */
function onColor(hex) {
  return contrastRatio("#000000", hex) >= contrastRatio("#ffffff", hex)
    ? "#000000"
    : "#ffffff";
}

/** Keep the style's hue and shape while moving its surfaces to the other mode. */
function inPolarity(t, light) {
  if (isLight(t.appBg) === light) return t;

  const neutral = light
    ? {
        appBg: "#ffffff", sideBg: "#f5f7f3", barBg: "#edf0eb",
        input: "#ffffff", hover: "#e7ece7", sel: "#e6eee3",
        border: "#d7dfd8", fg: "#29342d", fgMuted: "#59665e", barFg: "#344039"
      }
    : {
        appBg: "#111517", sideBg: "#151a1c", barBg: "#0f1214",
        input: "#101517", hover: "#20292a", sel: "#23372a",
        border: "#30393b", fg: "#e7ece9", fgMuted: "#a0aaa5", barFg: "#c7d1cd"
      };
  const mixSource = (base, source, amount = 0.12) => mix(base, source, amount);

  return {
    ...t,
    appBg: mixSource(neutral.appBg, t.appBg, 0.08),
    sideBg: mixSource(neutral.sideBg, t.sideBg),
    barBg: mixSource(neutral.barBg, t.barBg),
    input: mixSource(neutral.input, t.input, 0.07),
    hover: mixSource(neutral.hover, t.hover, 0.12),
    sel: mixSource(neutral.sel, t.sel, 0.16),
    border: mixSource(neutral.border, t.border, 0.18),
    fg: mixSource(neutral.fg, t.fg, 0.12),
    fgMuted: mixSource(neutral.fgMuted, t.fgMuted, 0.12),
    barFg: mixSource(neutral.barFg, t.barFg, 0.12),
  };
}

/* ---------- 17 catalog tokens -> 41 dashboard tokens ---------- */

function expand(t) {
  const light = isLight(t.appBg);

  // Surface used by inline code and quoted blocks.
  const codeBg = light ? mix(t.border, t.appBg, 0.35) : mix(t.appBg, t.input, 0.75);
  const inputFocus = light ? "#ffffff" : t.input;

  // Tinted "soft" backgrounds for ok/warn/error/info badges and notices.
  // Light themes need a visible but pale tint; blend from white with a
  // touch more colour than the dark equivalent.
  const soft = (c, amount) =>
    light ? mix("#ffffff", c, Math.min(0.9, amount * 2.4)) : mix(t.appBg, c, amount);

  const badgeBg = mix(t.appBg, light ? "#000000" : "#ffffff", 0.1);
  const hoverBgSoft = mix(t.appBg, t.hover, 0.5);
  const activeBg = mix(t.accent, t.sideBg, 0.07);
  const surfaces = [
    t.barBg, t.sideBg, t.appBg, t.input, t.hover, t.sel,
    codeBg, inputFocus, badgeBg, hoverBgSoft, activeBg,
    soft(t.ok, light ? 0.1 : 0.14),
    soft(t.warn, light ? 0.12 : 0.16),
    soft(t.err, light ? 0.1 : 0.14),
    soft(t.accent, light ? 0.08 : 0.14),
  ];

  const fg = accessibleColor(t.fg, surfaces);
  const fgStrongSource = light ? mix(t.fg, "#000000", 0.45) : mix(t.fg, "#ffffff", 0.3);
  const fgStrong = accessibleColor(fgStrongSource, surfaces);
  const fgMuted = accessibleColor(t.fgMuted, surfaces);
  const fgFaintSource = light ? mix(fgMuted, t.appBg, 0.12) : mix(fgMuted, t.appBg, 0.18);
  const fgFaint = accessibleColor(fgFaintSource, surfaces);
  const accent = accessibleColor(t.accent, surfaces);
  const linkSource = light ? mix(t.accent, "#000000", 0.2) : mix(t.accent, "#ffffff", 0.3);
  const link = accessibleColor(linkSource, surfaces);
  const okSoft = soft(t.ok, light ? 0.1 : 0.14);
  const warnSoft = soft(t.warn, light ? 0.12 : 0.16);
  const errorSoft = soft(t.err, light ? 0.1 : 0.14);
  const ok = accessibleColor(t.ok, surfaces.concat(okSoft));
  const warn = accessibleColor(t.warn, surfaces.concat(warnSoft));
  const error = accessibleColor(t.err, surfaces.concat(errorSoft));
  const border = accessibleColor(t.border, [t.barBg, t.sideBg, t.appBg, t.input], 3);
  const inputBorder = accessibleColor(t.border, [t.input], 3);
  const borderStrong = accessibleColor(mix(border, fgMuted, 0.45), [t.barBg, t.sideBg, t.appBg, t.input], 3);
  const syntaxKey = accessibleColor(t.syntaxKey || t.accent, [codeBg]);
  const syntaxString = accessibleColor(t.syntaxString || t.warn, [codeBg]);
  const syntaxNumber = accessibleColor(t.syntaxNumber || t.ok, [codeBg]);

  /*
   * Georgia ships no Vietnamese precomposed glyphs, so "ĐIỀU" renders as
   * "ĐIÊ" plus a detached grave accent. Prepend a Vietnamese-capable face so it
   * wins over Georgia, and keep the rest of the stack for visual character.
   * Verified: Times New Roman, Segoe UI, Consolas and Courier New all carry the
   * full Latin Extended Additional block; Georgia does not.
   */
  const VN_SERIF = '"Times New Roman"';
  const VN_SANS = '"Segoe UI"';
  const BROKEN = /\bGeorgia\b/i;

  const withFallback = (stack, fallback, generic) => {
    if (!stack) return stack;
    const parts = stack.split(",").map((p) => p.trim());
    const tail = parts[parts.length - 1];
    const isGeneric = ["serif", "sans-serif", "monospace", "system-ui"].includes(tail);

    // A stack that names Georgia must not let Georgia resolve first.
    if (BROKEN.test(stack)) {
      // Drop Georgia itself, then put the safe serif in front.
      const kept = parts.filter((p) => !BROKEN.test(p));
      const body = isGeneric ? kept.slice(0, -1) : kept;
      const gen = isGeneric ? tail : generic;
      const seen = new Set();
      const dedup = [fallback]
        .concat(body, [gen])
        .filter((p) => {
          const k = p.replace(/["']/g, "").toLowerCase();
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
      return dedup.join(",");
    }
    if (stack.includes(fallback)) return stack;
    if (isGeneric) {
      parts.splice(parts.length - 1, 0, fallback);
      return parts.join(",");
    }
    return `${stack},${fallback},${generic}`;
  };

  const fontUi = /serif/.test(t.ui) && !/sans-serif/.test(t.ui)
    ? withFallback(t.ui, VN_SERIF, "serif")
    : /monospace/.test(t.ui)
      ? withFallback(t.ui, VN_SANS, "monospace")
      : withFallback(t.ui, VN_SANS, "sans-serif");
  const fontMono = withFallback(t.mono, VN_SANS, "monospace");

  const vars = [
    ["color-scheme", light ? "light" : "dark"],
    ["--titlebar-bg", t.barBg],
    ["--activity-bg", t.barBg],
    ["--sidebar-bg", t.sideBg],
    ["--editor-bg", t.appBg],
    ["--tabbar-bg", t.barBg],
    ["--tab-active-bg", t.appBg],
    ["--tab-inactive-bg", t.barBg],
    ["--statusbar-bg", t.barBg],
    ["--input-bg", t.input],
    ["--input-bg-focus", inputFocus],
    ["--input-border", inputBorder],
    ["--badge-bg", badgeBg],
    ["--hover-bg", t.hover],
    ["--hover-bg-soft", hoverBgSoft],
    ["--selected-bg", t.sel],
    ["--border", border],
    ["--border-strong", borderStrong],
    ["--fg", fg],
    ["--fg-strong", fgStrong],
    ["--fg-muted", fgMuted],
    ["--fg-faint", fgFaint],
    ["--accent", accent],
    ["--link", link],
    ["--focus-border", accent],
    ["--focus", accent],
    ["--ok", ok],
    ["--ok-soft", okSoft],
    ["--warn", warn],
    ["--warn-soft", warnSoft],
    ["--error", error],
    ["--error-soft", errorSoft],
    ["--info-soft", soft(t.accent, light ? 0.08 : 0.14)],
    ["--code-bg", codeBg],
    ["--syntax-key", syntaxKey],
    ["--syntax-string", syntaxString],
    ["--syntax-number", syntaxNumber],
    ["--radius", t.radius],
    ["--radius-sm", t.radiusSm || t.radius],
    ["--radius-md", t.radiusMd || t.radius],
    ["--radius-pill", "999px"],
    ["--radius-full", "50%"],
    ["--bar-fg", t.barFg],
    ["--accent-fg", onColor(accent)],
    ["--font-ui", fontUi],
    ["--font-mono", fontMono],
    ["--app-mark-bg", accent],
    ["--control-radius", t.radius],
    ["--sidebar-width", t.sidebarWidth || "288px"],
    ["--app-mark-radius", t.radius],
  ];

  return { light, vars, label: t.name, desc: t.desc };
}

/* ---------- read the catalog ---------- */

function readStyles() {
  const html = fs.readFileSync(CATALOG, "utf8");
  const start = html.indexOf("const STYLES = [");
  if (start < 0) throw new Error("STYLES array not found in catalog");
  const open = html.indexOf("[", start);
  // Walk to the matching close bracket, ignoring anything inside strings.
  let depth = 0;
  let end = -1;
  let inStr = null;
  for (let i = open; i < html.length; i++) {
    const c = html[i];
    if (inStr) {
      if (c === "\\") i++;
      else if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") inStr = c;
    else if (c === "[") depth++;
    else if (c === "]") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end < 0) throw new Error("unterminated STYLES array");
  const literal = html.slice(open, end);
  // The array is pure data; evaluating it is safe and avoids a brittle parser.
  const styles = new Function(`return ${literal};`)();
  if (!Array.isArray(styles) || styles.length === 0) {
    throw new Error("STYLES did not evaluate to a non-empty array");
  }
  return styles;
}

/* ---------- emit CSS ---------- */

function buildCss() {
  const styles = readStyles();
  const seen = new Set();
  const out = [];

  out.push(BEGIN);
  // Keep this generated CSS pure ASCII: the dashboard stylesheet has no
  // charset declaration, so non-ASCII bytes would depend on server encoding.
  out.push("/*");
  out.push(" * UI style selector (data-style) - generated, DO NOT EDIT BY HAND.");
  out.push(" * Source: docs/ui-catalog/index.html. Regenerate: node scripts/gen-styles.js");
  out.push(` * Total: ${styles.length} styles.`);
  out.push(" *");
  out.push(" * Usage: document.documentElement.dataset.style = \"<id>\";");
  out.push(" * Without data-style the built-in VS Code Dark Modern theme applies.");
  out.push(" */");
  out.push("");

  for (const s of styles) {
    if (seen.has(s.id)) throw new Error(`duplicate style id: ${s.id}`);
    seen.add(s.id);
    if (!s.t) throw new Error(`style ${s.id} has no token block`);
    const { light, vars } = expand(s.t);

        // Strip diacritics so the stylesheet stays ASCII-clean. The catalog keeps
    // the real names; this marker is only a machine/human-readable index.
    const asciiName = s.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    out.push(`/* ${asciiName} - ${light ? "light" : "dark"} */`);
    out.push(`:root[data-style="${s.id}"] {`);
    for (const [k, v] of vars) out.push(`  ${k}: ${v};`);
    out.push("}");
    out.push("");

    const oppositeLight = !light;
    const oppositeTheme = oppositeLight ? "light" : "dark";
    const opposite = expand(inPolarity(s.t, oppositeLight));
    out.push(`/* ${asciiName} - ${oppositeTheme} mode */`);
    out.push(`:root[data-style="${s.id}"][data-theme="${oppositeTheme}"] {`);
    for (const [k, v] of opposite.vars) out.push(`  ${k}: ${v};`);
    out.push("}");
    out.push("");
  }

  const ids = styles.map((s) => s.id);
  out.push(`/* Total styles: ${ids.length} */`);
  out.push(END);

  return { css: out.join("\n"), ids, styles };
}

function main() {
  const check = process.argv.includes("--check");
  const write = process.argv.includes("--write");
  const { css, ids } = buildCss();

  /*
   * --write splices the generated blocks straight back into web/style.css.
   * Doing this inside Node avoids PowerShell's `>` redirection, which emits
   * UTF-16LE and silently destroys the markers.
   */
  if (write) {
    const current = fs.readFileSync(STYLE_CSS, "utf8").replace(/\r\n/g, "\n");
    const b = current.indexOf(BEGIN);
    let base = current;
    if (b >= 0) base = current.slice(0, b);
    base = base.replace(/\n+$/, "\n");
    const next = base + "\n" + css.replace(/\n+$/, "") + "\n";
    fs.writeFileSync(STYLE_CSS, next, "utf8");
    console.log(`ok: wrote ${ids.length} styles into web/style.css`);
    return;
  }

  if (!check) {
    process.stdout.write(css + "\n");
    return;
  }

  const current = fs.readFileSync(STYLE_CSS, "utf8");
  const b = current.indexOf(BEGIN);
  if (b < 0) {
    console.error("FAIL: generated block missing from web/style.css");
    process.exit(1);
  }
  const e = current.indexOf(END, b);
  if (e < 0) {
    console.error("FAIL: END marker missing from web/style.css");
    process.exit(1);
  }
  const inFile = current.slice(b, e + END.length);
  const normalise = (s) => s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (normalise(inFile) !== normalise(css)) {
    console.error("FAIL: web/style.css style block is stale — run node scripts/gen-styles.js");
    process.exit(1);
  }
  console.log(`ok: ${ids.length} styles in sync`);
}

main();
