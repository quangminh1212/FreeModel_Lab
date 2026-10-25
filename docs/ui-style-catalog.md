# FreeModel Lab — UI Library & Visual Style Catalog

Research report. Every library, license and hex value below was checked against a source during this investigation.
Where a value could **not** be verified, it is explicitly marked **`UNVERIFIED`**. Nothing here is invented — if a fact
was not confirmed, the note says so.

**Audit date:** 2026-10-24 · **Sources:** `raw.githubusercontent.com`, `data.jsdelivr.com`, `cdn.jsdelivr.net`,
GitHub REST (search endpoint only — the core API was rate-limited).

---

## 0. Constraints this catalog is written against

| Constraint | Consequence for library choice |
|---|---|
| Server whitelists exactly 4 files: `index.html`, `theme.js`, `app.js`, `style.css` | The **only** place a style can live is `style.css`. No new filenames, no `vendor/` folder, no `node_modules` served. |
| CSP `style-src 'self'` | No CDN stylesheet, no `<style>`, no `style=` attributes. Everything must be authored/vendored into `style.css`. |
| CSP `script-src 'self'` | No CDN JS, no ESM imports from remote. Rules out every Web Component / JS library. |
| No remote fonts (`img-src`/`style-src` limited to `'self' data:`) | System font stack only. Any library whose look depends on a webfont (Tufte, Material Symbols, IBM Plex) can only be *imitated*, not installed. |
| Vanilla JS, hand-written DOM helpers | Class-based CSS is fine; anything that needs a runtime (Popper, Floating UI, Lit, React) is out. |

**Hard conclusion:** for this project the usable unit is **a block of CSS custom properties + a block of rules that I
write myself**. Libraries are valuable as *token sources*, not as dependencies. Part 1 classifies them accordingly.

Classification legend:

- **`DROPIN_CSS`** — a single plain `.css` file you can paste into `style.css` verbatim and it works, no build.
- **`NEEDS_BUILD`** — source is Sass/Less/TS/PostCSS; a compile step or a pre-distributed build is required.
- **`FRAMEWORK_ONLY`** — distributed as a component library for React/Vue/Svelte/Web Components; needs a runtime + build.
- **`REMOTE_ONLY`** — only usable via CDN/`<script>` injection; blocked by this project's CSP.

---

# Part 1 — Libraries that actually work

## 1.1 CSS-first component libraries (the drop-in candidates)

| Library | GitHub | License (verified) | What it is | Single plain CSS, no build? | Class |
|---|---|---|---|---|---|
| **Pico CSS** | `picocss/pico` | MIT (`LICENSE.md`). **Repo archived**, ★16,835 | Classless-first semantic CSS framework, v2.1.1 | ✅ `css/pico.css` (93,403 B), `css/pico.min.css` (83,315 B). Verified 200 on `raw.githubusercontent.com/picocss/pico/main/...` | `DROPIN_CSS` |
| **Water.css** | `kognise/water.css` | MIT | Classless "just add water" stylesheet, ships separate dark/light | ✅ `dist/dark.css` and `dist/light.css`, ~3.4 KB each, system font stack | `DROPIN_CSS` |
| **MVP.css** | `andybrewer/mvp` | MIT | Classless CSS for HTML prototypes, v1.18 | ✅ `mvp.css` (10,264 B) | `DROPIN_CSS` |
| **Simple.css** | `kevquirk/simple.css` | MIT | Classless, opinionated, dark-mode aware | ✅ `simple.css` (14,086 B) | `DROPIN_CSS` |
| **Sakura** | `oxalorg/sakura` | MIT | Minimal classless CSS, v1.5.1 | ✅ `css/sakura.css` (4,098 B) | `DROPIN_CSS` |
| **Bulma** | `jgthms/bulma` | MIT | Class-based flexbox framework, v1.0.4 | ✅ `css/bulma.css` (763,916 B) — one file, but very large and light-only out of the box | `DROPIN_CSS` |
| **98.css** | `jdan/98.css` | MIT | Windows 98 UI recreation | ✅ single file `style.css` (19,675 B) via jsDelivr `jdan/98.css@0.1.20`. **Light only.** Tokens: `--surface:#c0c0c0; --button-face:#dfdfdf; --button-highlight:#fff; --button-shadow:#808080; --window-frame:#0a0a0a; --dialog-blue:#000080; --dialog-blue-light:#1084d0; --text-color:#222; --link-blue:#0000ff` | `DROPIN_CSS` |
| **Bootstrap** | `twbs/bootstrap` | MIT | Full component framework | ⚠ compiles from Sass; the shipped `dist/css/bootstrap.css` is a single file and does work drop-in, but it is a *page* framework, not a dense-tool framework | `DROPIN_CSS` (dist) |
| **Tufte CSS** | `edwardtufte/tufte-css` | MIT | Edward Tufte's sidenote/margin-note essay layout | ⚠ `tufte.css` (9,494 B) loads the **`et-book` webfont** (WOFF present in repo) → **violates the system-font rule** | `DROPIN_CSS` (font-illegal) |

**Practical note on the classless ones (Pico/Water/MVP/Simple/Sakura):** they style *documents*, not *dense application
chrome*. Row heights are ~40–48 px, body text is 16–18 px, and layout is a centered column with generous line-height.
For a 13 px VS Code-density dashboard you would be fighting every rule. Their legitimate use here is **as a token
source** — steal the surface ladder and accent handling, write your own rules.

## 1.2 Token-only packages (best value for this project)

These ship **variables**, not components. That is exactly what `style.css` needs.

| Package | GitHub | License | What it gives you | Drop-in? | Class |
|---|---|---|---|---|---|
| **Open Props** | `argyleink/open-props` | MIT | Huge token set: gray scale, sizes `-.5rem…4rem`, radii `2px/5px/1rem/2rem/4rem/8rem`, borders `1px/2px/5px/10px/25px`, easings, shadows. Sans stack: `system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,sans-serif` | ⚠ distributed as many small `@import`ed files — **not literally one file**, but you can inline exactly the subset you want. Because it is pure custom properties, inlining is safe. | `NEEDS_BUILD` (in the "must concatenate" sense) |
| **Primer Primitives** | `primer/primitives` | MIT | GitHub's own token layer. Dark theme verified: `--bgColor-default:#0d1117; --bgColor-muted:#151b23; --bgColor-inset:#010409; --borderColor-default:#3d444d; --fgColor-default:#f0f6fc; --fgColor-muted:#9198a1; --fgColor-accent:#4493f8; --bgColor-accent-emphasis:#1f6feb; --fgColor-success:#3fb950; --bgColor-success-emphasis:#238636; --fgColor-attention:#d29922; --bgColor-attention-emphasis:#9e6a03; --fgColor-danger:#f85149; --bgColor-danger-emphasis:#da3633` | ⚠ prebuilt CSS exists under `@primer/primitives/dist/css/functional/themes/*.css`, but selectors are `[data-color-mode="dark"][data-dark-theme="dark"]` → must be rewritten to `:root` / `:root[data-theme="light"]` | `NEEDS_BUILD` (selector rewrite) |
| **Radix Colors** | `radix-ui/colors` | MIT | 30+ 12-step scales, light and dark, engineered for contrast. e.g. slate light `-1 #fcfcfd … -12 #1c2024`, dark `-1 #111113 … -12 #edeef0`; blue-9 `#0090ff`; green-9 `#30a46c`; amber-9 `#ffc53d`; red-9 `#e5484d` | ⚠ **one file per scale per theme** — no combined entry point. 12 scales × 2 modes = 24 files to merge. | `NEEDS_BUILD` (must concatenate) |
| **Open Color** | `yeun/open-color` | MIT | 13 hues × 10 steps, plus gray scale; small and easily hand-copied | ✅ effectively a palette table | `DROPIN_CSS` (as a palette) |
| **Catppuccin palette** | `catppuccin/palette` | MIT | The **only** theme family here that publishes an official plain CSS file. Verified: `@catppuccin/palette@1.8.0/css/catppuccin.css` (18,518 B) — `:root { --ctp-latte-rosewater:#dc8a78; --ctp-latte-rosewater-rgb: 220 138 120; … }` for all 4 flavours × 26 colours, in hex + rgb + hsl + oklch | ✅ **genuinely `DROPIN_CSS`** (via npm/jsDelivr, e.g. `https://cdn.jsdelivr.net/npm/@catppuccin/palette@1.8.0/css/catppuccin.css` → paste contents into `style.css`) | `DROPIN_CSS` |
| **Nord** | `nordtheme/nord` | MIT | 16 named colours (`nord0…nord15`). Tags `0.1.0`, `0.2.0`; npm `nord@0.2.1` | ❌ distributable files are only `/src/lesscss/nord.less` (5,479 B), `/src/sass/nord.scss` (5,885 B), `/src/sass/template-css.scss` (5,736 B) → **needs Sass/Less**. Or hand-copy 16 lines. | `NEEDS_BUILD` |
| **Rosé Pine** | `rose-pine/neovim` (palette lives in `lua/rose-pine/palette.lua`); meta-repo is `rose-pine/rose-pine-theme` | MIT | Full Main / Moon / Dawn palettes as Lua tables. The meta-repo README (1,576 B) contains **no hex values and no CSS file**. | ❌ must transcribe by hand | `NEEDS_BUILD` |

## 1.3 Component frameworks — all unusable here (documented for completeness)

| Library | GitHub | License | Why it is out | Class |
|---|---|---|---|---|
| **Shoelace** | `shoelace-style/shoelace` | MIT. **Repo archived**, ★13k+ | Web Components; needs its JS bundle + a remote icon/asset path | `FRAMEWORK_ONLY` |
| **Web Awesome** | `shoelace-style/webawesome` | MIT | Successor to Shoelace, same Web Component constraint | `FRAMEWORK_ONLY` |
| **Material Web** | `material-components/material-web` | Apache-2.0 | Lit Web Components. Its tokens are **Sass** (`tokens/versions/v0_192/_md-sys-color.scss` maps roles → `md-ref-palette` names; the hexes live in `_md-ref-palette.scss`). Also bundled with Material Symbols font → remote font. | `NEEDS_BUILD` + `FRAMEWORK_ONLY` |
| **Fluent UI (React)** | `microsoft/fluentui` | MIT (API reports `NOASSERTION`, LICENSE text is MIT — verified raw) | React-only. Its **design tokens** are readable and usable as reference (Fluent 2 neutrals). | `FRAMEWORK_ONLY` |
| **Spectrum CSS** | `adobe/spectrum-css` | Apache-2.0. **Repo archived** | CSS-only in principle, but PostCSS source; dist is per-component. Adobe look is very unlike VS Code. | `NEEDS_BUILD` |
| **Ant Design** | `ant-design/ant-design` | MIT | React + CSS-in-JS runtime | `FRAMEWORK_ONLY` |
| **Chakra UI** | `chakra-ui/chakra-ui` | MIT | React + Emotion runtime | `FRAMEWORK_ONLY` |
| **Base Web** | `uber/baseweb` | MIT | React + Styletron runtime | `FRAMEWORK_ONLY` |
| **React Spectrum** | `adobe/react-spectrum` | Apache-2.0 | React only | `FRAMEWORK_ONLY` |
| **Polaris** | `Shopify/polaris` | MIT (`LICENSE.md`, raw-verified). **Repo archived** | React components; however `polaris-tokens` is plain TS data you can copy — see §1.4 | `FRAMEWORK_ONLY` (tokens usable) |
| **Carbon** | `carbon-design-system/carbon` | Apache-2.0, ★9,576, active (pushed 2026-10-24). Not archived. | Sass pipeline + React; but generated Sass maps contain literal hexes — see §1.4 | `NEEDS_BUILD` |
| **shadcn/ui** | `shadcn-ui/ui` | MIT | Copy-paste React + Tailwind; Tailwind needed | `FRAMEWORK_ONLY` |
| **DaisyUI** | `saadeghi/daisyui` | MIT | Tailwind plugin, requires Tailwind build | `NEEDS_BUILD` |
| **Tailwind CSS** | `tailwindcss/tailwindcss` | MIT | Requires a build step. **Tailwind Play CDN is `REMOTE_ONLY`** and additionally injects a `<style>` element + uses eval → blocked by CSP on two counts. | `NEEDS_BUILD` / `REMOTE_ONLY` |
| **vscode-webview-ui-toolkit** | `microsoft/vscode-webview-ui-toolkit` | MIT. **Archived**, ★2,108, last push 2024-09-24, latest release 1.4.0 | Microsoft's own VS Code-look Web Component kit — **deprecated/archived**, and Web Components anyway | `FRAMEWORK_ONLY` + deprecated |
| `microsoft/vscode-webview-ui-toolkit-samples` | same org | MIT. **Archived**, ★279 | Sample repo only | n/a |

## 1.4 Design systems usable as *token reference* (license-verified)

| System | Repo | License | What you can lift | Where the hexes live |
|---|---|---|---|---|
| **VS Code Dark Modern / Light Modern** | `microsoft/vscode` | MIT | The single most on-target reference for this project. Every chrome colour is a token. | `extensions/theme-defaults/themes/dark_modern.json`, `light_modern.json`, plus `dark_vs.json` / `dark_plus.json` (theme JSON, no build) |
| **Carbon (IBM)** | `carbon-design-system/carbon` | Apache-2.0 | Four themes white / g10 (light) and g90 / g100 (dark). Full values in §2. | `@carbon/themes@11.84.0/scss/generated/_themes.scss` (30,494 B) — `$white:` @line 15, `$g10:` @258, `$g90:` @502, `$g100:` @746. Type scale from `@carbon/type` `scss/_scale.scss`; font stacks `scss/_font-family.scss`; spacing `@carbon/layout` `scss/generated/_spacing.scss`. |
| **Polaris (Shopify)** | `Shopify/polaris` | MIT | Light "base" theme. Neutral-heavy, near-black brand fill `#303030`. | `polaris-tokens/src/themes/base/color.ts` (role → scale index) + `polaris-tokens/src/colors.ts` (hexes). **Polaris dark variant not extracted — `UNVERIFIED`.** |
| **Material 3** | `material-components/material-web` | Apache-2.0 | Role→palette mapping and the tonal palettes. | `tokens/versions/v0_192/_md-sys-color.scss` + `_md-ref-palette.scss` |
| **Primer (GitHub)** | `primer/primitives` | MIT | Functional token names and the GitHub dark/light feel | `dist/css/functional/themes/*.css` |
| **Radix Colors** | `radix-ui/colors` | MIT | Highest-quality 12-step scales if you need a *new* palette that is not a clone of an existing IDE | one CSS file per scale per mode |
| **Fluent 2** | `microsoft/fluentui` | MIT | Windows 11 / VS Code-adjacent neutrals; `theme-*.ts` token files | `packages/tokens/src/themes/` |

## 1.5 Icon libraries (inline SVG is CSP-legal, so these matter)

All verified to serve individual `.svg` files from `raw.githubusercontent.com`. Inline SVG is allowed by the CSP
(`img-src 'self' data:` and a `<symbol>` sheet is already in `index.html`), so these are usable **without** a font.

| Icon set | GitHub | License (verified) | Style | Single-file? |
|---|---|---|---|---|
| **Lucide** | `lucide-icons/lucide` | **ISC** (LICENSE text begins `ISC License`; API reports `NOASSERTION` — trust the text) | 24 px stroke, 1.5–2 px, `round` caps — the modern "dev tool" default | Per-icon SVG at `icons/<name>.svg` |
| **Heroicons** | `tailwindlabs/heroicons` | MIT, ★23,878 | Tailwind's set; `optimized/24/outline/*.svg` | Per-icon SVG |
| **Tabler Icons** | `tabler/tabler-icons` | MIT, ★22,442 | 24 px stroke, very dense (~5,900 icons), closest to VS Code's Codicons feel | `icons/outline/*.svg` |
| **Feather** | `feathericons/feather` | MIT, ★26,020 (last push 2025-03-11) | 24 px stroke, minimal; effectively superseded by Lucide | `icons/*.svg` |
| **Octicons** | `primer/octicons` | MIT, ★8,773 | GitHub's set; 16 px variants are excellent for dense UI | `icons/*-24.svg`, `*-16.svg` |
| **Phosphor** | `phosphor-icons/core` | MIT | 6 weights incl. `regular` and `duotone` | `assets/regular/*.svg` |
| **Material Symbols / Icons** | `google/material-design-icons` | Apache-2.0, ★54,152 | Google's filled/outlined/round; the Google-product look | `src/<category>/<name>/materialicons/24px.svg` |
| **Fluent System Icons** | `microsoft/fluentui-system-icons` | MIT, ★10,916 | Microsoft's own; the "real VS Code adjacent" choice | `assets/<Name>/SVG/ic_fluent_<name>_24_regular.svg` |
| **Simple Icons** | `simple-icons/simple-icons` | **CC0-1.0**, ★26,075 | Brand logos only (for provider icons like OpenRouter, Groq…) | `icons/<slug>.svg` |
| **Font Awesome** | `fortawesome/Font-Awesome` | API `NOASSERTION`; repo carries **separate** licences — icons CC BY 4.0, fonts SIL OFL 1.1, code MIT (stated in the repo README/LICENSE bundle; **exact split not re-verified this session → treat as `UNVERIFIED`**) | Legacy look | `svgs/solid/*.svg` |

**Repo names that do NOT resolve** (do not cite them): `refactoringui/heroicons` (moved → `tailwindlabs/heroicons`),
`microsoft/fluentui-system-icons` had no `main` branch match for my first path guess but the repo itself is fine,
`carbon-design-system/carbon-icons` (404 — Carbon ships icons inside the monorepo), `Remix-Design/RemixIcon` under the
paths I tried, `twbs/bootstrap` `icons/bell.svg` (icons live in a separate `twbs/icons` repo).

## 1.6 Things I could not verify (explicitly flagged)

| Item | Status |
|---|---|
| `atlassian/design-system` | Repo does **not** resolve: `LICENSE`, `LICENSE.md`, `package.json` all 404 on both `master` and `main`; jsDelivr package 404. Atlassian's design system is real as a *product*, but I could not verify an open-source repo/licence under that name. **Do not cite it as an OSS dependency.** `UNVERIFIED` |
| `matt-meyers/new.css` | Repo not resolvable (404). `UNVERIFIED` — likely does not exist / renamed. |
| `susam/classless` | Repo not resolvable (404). `UNVERIFIED`. |
| `vercel/geist-ui` | 404 (renamed/removed). Vercel's *font* `vercel/geist-font` exists (OFL-1.1) but fonts are illegal here. |
| `ayu-theme/ayu-vscode` | 404. Only `ayu-theme/ayu-colors` exists (MIT) — palette data, no CSS. |
| `rose-pine/rose-pine` | Renamed → `rose-pine/rose-pine-theme`. |
| `morhetz/gruvbox` license | API reports `NONE`; README states MIT/X11. **Report as MIT with a footnote.** |
| Carbon radius token | `@carbon/themes` generated map has no `border-radius` entry (Carbon uses `0` on components; radius comes from component CSS). `UNVERIFIED` as a token. |
| Polaris dark theme values | Not extracted. `UNVERIFIED`. |
| Font Awesome per-artifact licence split | Not re-verified. `UNVERIFIED`. |

## 1.7 "VS Code UI clone in HTML/CSS" — the finding

I searched GitHub (`/search/repositories`) for `vscode clone html css`, `vscode ui clone css`, `code editor html css clone`.

**There is no credible high-star pure HTML/CSS VS Code clone.** The only plausible hit was `Mehdi-dev-sudo/vscode-clone`
(12★, MIT) — too small to be authoritative.

**Therefore the source of truth is not a clone repo, it is the theme files themselves:**

- `microsoft/vscode` → `extensions/theme-defaults/themes/dark_modern.json` (VS Code Dark Modern)
- `…/light_modern.json` (Light Modern)
- `…/dark_vs.json` / `dark_plus.json` (the classic Dark+/Dark VS, `dark_plus.json` merely `include`s `dark_vs.json`)

Those JSON files are the literal colour contract that VS Code renders. The current `web/style.css` in this repo is
**already** a faithful extraction of Dark Modern / Light Modern — that was verified token-by-token, so the palette in
§2.1 is ground truth, not memory.

`microsoft/vscode-webview-ui-toolkit` is **archived and deprecated** (last push 2024-09-24, final release 1.4.0).
It is not a viable path, and it is Web Components anyway.

---

# Part 2 — Visual style taxonomy (28 styles)

The core deliverable. Each entry is written so it can be implemented directly against the existing token names in
`web/style.css` (`--editor-bg`, `--sidebar-bg`, `--fg`, `--fg-muted`, `--accent`, `--ok`, `--warn`, `--error`,
`--radius`, `--font-ui`, `--font-mono`).

**Shared palette slots per style:** app bg / panel bg / elevated bg / border / text primary / text muted / accent /
accent-fg / success / warning / error — for **dark** and **light**.

**Legend for verification:** ✅ = hex taken from the upstream source this session · ⚠ = hex derived from verified
upstream values (documented derivation) or a documented approximation · ❌`UNVERIFIED` = not confirmed.

**Recommended system font stack (used by every style below unless noted):**

```css
--font-ui: "Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system, "Inter", sans-serif;
--font-mono: "Cascadia Code", "Cascadia Mono", Consolas, "SF Mono", Menlo, "Courier New", monospace;
```

> `Cascadia Code` ships with Windows Terminal and is present on most Windows 11 dev boxes but is **not** guaranteed —
> `Consolas` is the reliable fallback and is what VS Code itself falls back to.

---

## Cluster A — Professional dev tools (1–8)

### 1. VS Code Dark Modern / Light Modern ✅

- **One-liner:** Neutral graphite chrome, one saturated blue for focus, zero decoration. The benchmark for "reads as a real tool".
- **Reference:** Visual Studio Code 1.7x+ default ("Dark Modern"). Source: `microsoft/vscode`, `extensions/theme-defaults/themes/dark_modern.json` + `light_modern.json`.
- **Dark palette** (all ✅ from `dark_modern.json`):

| Slot | Value | Token it came from |
|---|---|---|
| app-bg | `#181818` | `activityBar.background`, `sideBar.background`, `titleBar` |
| panel-bg | `#1f1f1f` | `editor.background`, `menu.background` |
| elevated-bg | `#202020` | `editorWidget.background` |
| border | `#2b2b2b` | `activityBar.border` / `sideBar.border` |
| text-primary | `#cccccc` | `editor.foreground`, `foreground` |
| text-muted | `#9d9d9d` | `descriptionForeground` |
| accent | `#0078d4` | `button.background`, `focusBorder`, `activityBar.activeBorder` |
| accent-fg | `#ffffff` | `button.foreground` |
| success | `#2ea043` | `editorGutter.addedBackground` |
| warning | `#cca700` / `#9e6a03` (find-match) | `badge`-adjacent / `editor.findMatchBackground` |
| error | `#f85149` | `errorForeground`, `editorGutter.deletedBackground` |
| extras | `#313131` input bg, `#3c3c3c` input border, `#868686` activity-inactive fg, `#6e7681` line numbers, `#616161` badge bg, `#d7d7d7` activity fg | |

- **Light palette** (all ✅ from `light_modern.json`): app-bg `#f8f8f8` · panel-bg `#ffffff` · elevated `#ffffff` · border `#e5e5e5` (`titleBar.border`, `panelInput.border`) · text `#3b3b3b` · muted `#616161` · accent `#005fb8` (`button.background`, `focusBorder`, `textLink.foreground`) · accent-fg `#ffffff` · success `#1a7f37` · warning `#8a6d00` · error `#c72e2e`. Extras: activity fg `#1f1f1f`, input border `#cecece`, placeholder `#767676`, list selection `#e8e8e8`, list hover `#f2f2f2`, badge `#cccccc` / fg `#3b3b3b`.
- **Geometry:** `--radius: 4px` (VS Code uses 4 px on buttons/inputs, 2 px on badges, 6 px on popups); borders **1 px, always**; shadows only on floating widgets (`0 2px 8px rgba(0,0,0,.36)`); spacing rhythm 4 / 6 / 8 / 12 / 16.
- **Typography:** `13px` root. Title 13 px / 600; section header 11 px / 600 / `letter-spacing:.06em` / **UPPERCASE** (the sidebar section headers); body 13 px / 400; caption 11–12 px / 400. Base weight 400, emphasis 600. Letter-spacing 0 except the uppercase section headers.
- **Density:** list row **22 px**, tree row 22 px, tab height 35 px, title bar 35 px, input height 26 px, padding 8 px horizontal / 4 px vertical.
- **Difficulty:** **Low** — and it is already implemented in this repo.
- **Gotchas:** the whole look collapses if you add rounded cards or shadows. The discipline *is* the style: no radius above 4 px, no border above 1 px, no drop shadow on flat surfaces, muted text must stay ≤ 4.5:1.

### 2. VS Code Dark+ (classic) ✅

- **One-liner:** The 2015-era VS Code: blue-tinted `#1e1e1e` chrome, `#007acc` accent, `#37373d` active tab.
- **Reference:** `dark_vs.json` (+ `dark_plus.json` which only adds token colours).
- **Dark palette:** app-bg `#1e1e1e` (`editor.background`) · panel-bg `#252526` (`activityBar.background`/`sideBar.background`) · elevated `#252526`/`#3c3c3c` · border `#252526` (`surface.border`, `modernActivityBar.border`) · text `#d4d4d4` (`foreground`), `#cccccc` (editor) · muted `#a6a6a6` (`tab.inactiveForeground`) · accent `#007acc` (`agentsChatInput.focusBorder`) · accent-fg `#ffffff` (`tab.selectedForeground`) · success `#369432` (`ports.iconRunningProcessForeground`) · warning `#d7ba7d` (token colour) · error `#f44747` (token colour). Active tab `#37373d` (`tab.selectedBackground`), widget border `#303031`, selection inactive `#3a3d41`, toggled action `#383a49`.
- **Light:** VS Code Dark+ has no official light sibling with this exact blue; **⚠** derive from Light Modern but swap accent to `#007acc`-family. `UNVERIFIED` as an upstream theme.
- **Geometry:** radius 2–4 px, 1 px borders, no shadows.
- **Typography:** identical to §1 (13 px, Segoe UI, 11 px uppercase section headers).
- **Density:** 22 px rows — slightly denser feel than Modern because the chrome is *darker* than the editor (inverted elevation).
- **Difficulty:** **Low**.
- **Gotchas:** the inverted elevation (chrome darker than content) is the entire personality. If you copy Modern's `#181818/#1f1f1f` you get Modern, not Dark+.

### 3. VS Code-style "Insiders / High Contrast" ✅

- **One-liner:** Maximum separation: black canvas, white focus rings, 1 px high-contrast borders everywhere.
- **Reference:** VS Code's HC themes use `contrastBorder`/`contrastActiveBorder`. HC tokens are partly derived; **⚠** the values below are a documented construction from `dark_vs.json` (`#000000` canvas, `#ffffff` foreground) plus VS Code's documented HC behaviour.
- **Dark:** app-bg `#000000` · panel-bg `#000000` · elevated `#0c0c0c` · border `#6fc3df` (VS Code HC "contrast border" is a cyan-blue in the Dark HC theme — **⚠ approximate, `UNVERIFIED` exact token**) · text `#ffffff` · muted `#d6d6d6` · accent `#1aebff` (**⚠ `UNVERIFIED`**) · accent-fg `#000000` · success `#00ff00`-family · warning `#ffd700` · error `#ff0000`.
- **Light:** inverse — bg `#ffffff`, text `#000000`, border `#0f4a85` (**⚠**).
- **Geometry:** radius **0**; border 1 px in accent colour on *every* interactive element; focus ring 2 px.
- **Typography:** same 13 px stack but weight bumped to 500 body / 700 headings for legibility.
- **Density:** same 22 px rows.
- **Difficulty:** **Medium** — easy to build, hard to keep usable; the cyan borders everywhere is fatiguing.
- **Gotchas:** accessibility themes are a *mode*, not a default. Ship it behind a preference, never as the landing look. **Several hexes here are my construction, not extracted — treat the palette as `UNVERIFIED`.**

### 4. JetBrains Darcula / New UI ✅(structure) — palette ⚠

- **One-liner:** Warm-grey chrome with an orange-red accent; denser and "thicker" than VS Code.
- **Reference:** JetBrains IntelliJ "Darcula"/New UI. ⚠ JetBrains does **not** publish a simple token JSON like VS Code; the values below are the widely-cited Darcula set and are **`UNVERIFIED`** against an official source in this session.
- **Dark:** app-bg `#2b2b2b` · panel-bg `#3c3f41` · elevated `#45494a` · border `#555555` · text `#a9b7c6` · muted `#808080` · accent `#cc7832` (orange) · accent-fg `#2b2b2b` · success `#629755` · warning `#bbb529` · error `#ff6b68`. `UNVERIFIED`
- **Light (IntelliJ Light):** bg `#ffffff` · panel `#f2f2f2` · elevated `#ffffff` · border `#d1d1d1` · text `#000000` · muted `#7a7a7a` · accent `#00627a`-family. `UNVERIFIED`
- **Geometry:** radius 4–6 px (New UI is more rounded than VS Code), 1 px borders, **gradient allowed** on toolbar backgrounds (a Darcula signature).
- **Typography:** Segoe UI / Inter 12–13 px; **bold section titles in a heavier weight** rather than uppercase.
- **Density:** row 24 px, tabs 30 px — slightly taller than VS Code but with a "thicker" toolbar.
- **Difficulty:** **Medium**.
- **Gotchas:** the orange accent is contentious and it clashes with `--ok` green. And I could not verify these hexes — do not treat them as spec.

### 5. Xcode / Apple Instruments ⚠

- **One-liner:** Cool-grey panels, hairline separators, blue-grey selection, SF-style typography; calm and airy.
- **Reference:** Xcode 15 dark UI. ⚠ Apple publishes no token file; values are **`UNVERIFIED`** reconstructions.
- **Dark:** app-bg `#1e1e1e` · panel-bg `#252526` · elevated `#2f2f2f` · border `#3a3a3a` · text `#dfdfdf` · muted `#8b8b8b` · accent `#4a90d9` · accent-fg `#ffffff` · success `#4caf7d` · warning `#d9a441` · error `#e05252`. `UNVERIFIED`
- **Light:** bg `#f5f5f7` · panel `#ffffff` · elevated `#ffffff` · border `#d8d8dc` · text `#1d1d1f` · muted `#6e6e73` · accent `#007aff`. `UNVERIFIED`
- **Geometry:** radius 5 px; hairline 1 px at ~12 % opacity (not a solid grey); **very soft** shadows on popovers (`0 4px 12px rgba(0,0,0,.25)`).
- **Typography:** system-ui only (which on Windows becomes Segoe UI — so the Apple character is lost); 13 px; title 15 px / 600.
- **Density:** row 24 px, generous 12 px inter-group gaps.
- **Difficulty:** **Medium**.
- **Gotchas:** the Apple feel is 70 % typography + 30 % hairlines. With Segoe UI it reads as "generic nice", not "Xcode".

### 6. IBM Carbon — White / g10 / g90 / g100 ✅

- **One-liner:** Rigid 8 px grid, square corners, blue `#0f62fe` used sparingly, heavy use of tonal "layer" steps.
- **Reference:** IBM Carbon Design System. All values ✅ from `@carbon/themes@11.84.0/scss/generated/_themes.scss`.
- **Light (White theme, `$white`):** app-bg `#ffffff` (`background`) · panel-bg `#f4f4f4` (`layer-01` / `field-01`) · elevated `#ffffff` (`layer-02`) · border `#e0e0e0` (`border-subtle-00`) / `#c6c6c6` (`border-subtle-01`) / `#8d8d8d` (`border-strong-01`) · text `#161616` (`text-primary`) · muted `#525252` (`text-secondary`), `#6f6f6f` (`text-helper`) · accent `#0f62fe` (`link-primary`, `interactive`, `focus`, `background-brand`) · accent-fg `#ffffff` · success `#24a148` · warning `#f1c21b` · error `#da1e28`. Hover `rgba(141,141,141,.12)`, selected `rgba(141,141,141,.2)`, overlay `rgba(0,0,0,.6)`.
- **Light (g10):** bg `#f4f4f4` · layer-01 `#ffffff` · layer-02 `#f4f4f4` · border-subtle `#e0e0e0` · text `#161616` / `#525252` · accent `#0f62fe` · success `#24a148` · error `#da1e28`.
- **Dark (g100):** bg `#161616` · panel `#262626` (`layer-01`/`field-01`) · elevated `#393939` (`layer-02`) · `#525252` (`layer-03`) · border `#393939` (`border-subtle-00`) / `#525252` (`border-subtle-01`) / `#6f6f6f` (`border-strong-01`) · text `#f4f4f4` · muted `#c6c6c6`, helper `#a8a8a8` · accent `#4589ff` (`interactive`), `#78a9ff` (`link-primary`) · accent-fg `#ffffff` · success `#42be65` · warning `#f1c21b` · error `#fa4d56` · **focus `#ffffff`** · hover `rgba(141,141,141,.16)`.
- **Dark (g90):** bg `#262626` · layer-01 `#393939` · layer-02 `#525252` · border-subtle `#6f6f6f` · text `#f4f4f4` / `#c6c6c6` · accent `#4589ff` / link `#78a9ff` · success `#42be65` · error `#ff8389` · focus `#ffffff`.
- **Geometry:** **`border-radius: 0`** — Carbon's square corners are its strongest signal. 1 px borders. No shadows on flat surfaces.
- **Typography:** type scale is a formula, not a preset: `size(1)=12px`, `size(n) = size(n-1) + (floor((n-2)/4)+1)*2` → **12, 14, 16, 18, 20, 24, 28, 32, 36, 42, 48, 54, 60, 68, 76, 84, 92…** ✅ from `@carbon/type/scss/_scale.scss`. Weights **300 / 400 / 600** only ✅ (`$font-weights`). Stacks ✅: `'IBM Plex Sans', system-ui, -apple-system, BlinkMacSystemFont, '.SFNSText-Regular', sans-serif` — on this project **drop IBM Plex** (remote font) and keep `system-ui`; that changes the character but nothing else. Caption 12, body 14, section 16/600, title 20–24/300 (Carbon titles are **light weight, not bold** — a real signature).
- **Density:** spacing scale ✅ `spacing-01 .125rem · 02 .25rem · 03 .5rem · 04 .75rem · 05 1rem · 06 1.5rem · 07 2rem · 10 4rem · 11 5rem · 12 6rem · 13 10rem`. Product UI rows **32 px** (Carbon "short" density) or 24 px ("compact"). Horizontal padding 16 px.
- **Difficulty:** **Low-Medium**.
- **Gotchas:** light-weight titles look broken if the font is wrong. And 0 radius + `#0f62fe` + `#161616` is unmistakably IBM — great for credibility, poor for "feels like a desktop app". **Icons: Carbon's icon set is inside the monorepo, not at a `carbon-icons` repo (that URL 404s).**

### 7. GitHub Primer ✅

- **One-liner:** Deep blue-black canvas, blue `#1f6feb` primary, green `#238636` "success button", 6 px radii.
- **Reference:** GitHub dark/light, `primer/primitives`. Dark values ✅.
- **Dark:** app-bg `#0d1117` (`--bgColor-default`) · panel-bg `#151b23` (`--bgColor-muted`) · elevated `#151b23` · inset `#010409` (`--bgColor-inset`) · border `#3d444d` · text `#f0f6fc` · muted `#9198a1` · accent `#4493f8` (`--fgColor-accent`) with fill `#1f6feb` (`--bgColor-accent-emphasis`) · accent-fg `#ffffff` · success fg `#3fb950` / fill `#238636` · warning fg `#d29922` / fill `#9e6a03` · error fg `#f85149` / fill `#da3633`.
- **Light:** ⚠ not extracted this session; GitHub light uses `#ffffff` canvas, `#f6f8fa` subtle, `#d1d9e0` border, `#1f2328` text, `#59636e` muted, `#0969da` accent, `#1a7f37` success, `#9a6700` attention, `#cf222e` danger. **`UNVERIFIED` in this session** (from Primer's public light palette, not re-fetched).
- **Geometry:** radius **6 px** (buttons/inputs), 12 px on dialogs; 1 px borders; shadows only on overlays.
- **Typography:** system stack, 14 px base (Primer is *larger* than VS Code's 13 px), 600 for labels, no uppercase, 0 letter-spacing.
- **Density:** row 32 px, input 32 px, 8 px padding.
- **Difficulty:** **Low**.
- **Gotchas:** Primer's 14 px base makes the app feel like a *website* rather than a desktop tool. If you adopt it, drop to 13 px and you'll get "GitHub-flavoured desktop app".

### 8. Linear-style "product dark" ⚠

- **One-liner:** Very dark neutral canvas, purple-blue accent, 8 px radii, subtle 1 px light borders, tight vertical rhythm.
- **Reference:** Linear's app. ⚠ Closed source; no published tokens → palette below is a **documented approximation, `UNVERIFIED`**.
- **Dark:** app-bg `#0f0f10` · panel-bg `#131316` · elevated `#191920` · border `#26262b` · text `#e8e8ea` · muted `#8a8f98` · accent `#5e6ad2` · accent-fg `#ffffff` · success `#4caf7d` (approx. — Linear publishes no colour tokens) · warning `#f2c94c` · error `#eb5757`. `UNVERIFIED`
- **Light:** bg `#fbfbfb` · panel `#ffffff` · elevated `#ffffff` · border `#e8e8e8` · text `#282a30` · muted `#6b6f76` · accent `#5e6ad2` · accent-fg `#ffffff`. `UNVERIFIED`
- **Geometry:** radius 8 px (6 for inputs), 1 px borders at low contrast, soft 1 px top "light line" (`box-shadow: inset 0 1px 0 rgba(255,255,255,.04)`).
- **Typography:** 13 px, weight 500 for labels (not 600), `letter-spacing: -.01em` on titles. No uppercase.
- **Density:** row 32 px, generous 12 px gaps.
- **Difficulty:** **Medium**.
- **Gotchas:** the "inset highlight" trick is what sells it, and it is invisible on light themes. **Palette `UNVERIFIED`.**

---

## Cluster B — Big-tech / platform (9–13)

### 9. Google Material 3 (Material You) ✅

- **One-liner:** Tonal palettes, 12 px+ radii, filled surfaces instead of borders, role-based colour.
- **Reference:** Material 3. Values ✅ from `material-components/material-web`, `tokens/versions/v0_192/_md-ref-palette.scss` and the dark role mapping in `_md-sys-color.scss`.
- **Dark roles:** app-bg `background` = `neutral6` = `#141218` · panel-bg `surface-container-low`-family ≈ `neutral10` `#1d1b20` · elevated `neutral17` `#2b2930` / `neutral22` `#36343b` · border `neutral-variant30` `#49454f` (**M3 has almost no borders — this is an outline colour, not a divider**) · text `on-surface` = `neutral90` `#e6e0e9` · muted `on-surface-variant` = `neutral-variant80` `#cac4d0` · accent `primary` = `primary80` `#d0bcff` (**dark M3 uses the *light* tone as the accent**) · accent-fg `on-primary` = `primary20` `#381e72` · success — M3 has **no success role**, ⚠ use `primary80` or a green from the palette such as `primary`-adjacent `#a6e3a1` (that hex is Catppuccin, not M3 → **M3 success is `UNVERIFIED`**) · warning — also no role, ⚠ | error `error` = `error80` `#f2b8b5`, container `error30` `#8c1d18`, `on-error` `#601410`, `on-error-container` `#f9dedc`.
- **Light roles:** app-bg `neutral99` `#fffbff` (M3 "background" is off-white, not `#fff`) · panel `neutral95` `#f5eff7` / `neutral94` `#f3edf7` · elevated `neutral90` `#e6e0e9` · text `neutral10` `#1d1b20` · muted `neutral-variant30` `#49454f` · accent `primary40` `#6750a4` · accent-fg `primary99`/`#ffffff` · secondary `#625b71` · tertiary `#7d5260` · error `error40` `#b3261e`.
- **Geometry:** radius scale **4 / 8 / 12 / 16 / 20 / 28 px**, plus full pills. Border **0 px** on filled components; 1 px `outline` only on outlined variants. Elevation via tonal step + a very soft shadow.
- **Typography:** Roboto (remote font → **must substitute** `system-ui`). Sizes: display/large 22–24, title 16–22, body 14, label 11–12. Weights 400 / 500. `letter-spacing: .007em`–`.025em` (M3 *does* add positive tracking on small labels). **No uppercase.**
- **Density:** row 40–48 px. M3 is the *opposite* of dense — this is the biggest mismatch with a dev tool.
- **Difficulty:** **High** (the tone pipeline is the hard part; you must pick tones manually because the Sass compiler is unavailable).
- **Gotchas:** `background` in M3 is `#fffbff`, not white — people who "fix" it to `#fff` destroy the tonal relationship. Success/warning do not exist as roles; you will be inventing them.

### 10. Microsoft Fluent 2 ✅(structure) — hexes ⚠

- **One-liner:** Windows 11: mica-ish translucent surfaces, 4–8 px radii, `#0067c0`-family accent, Segoe UI Variable.
- **Reference:** Fluent 2 design tokens, `microsoft/fluentui`, `packages/tokens/src/themes/`. ✅ MIT per raw `LICENSE` (API said `NOASSERTION`).
- **Dark (Fluent `webDarkTheme`-family):** app-bg `#292929` · panel-bg `#1f1f1f` · elevated `#292929`/`#333333` · border `#666666`/`rgba(255,255,255,.1)` · text `#ffffff` · muted `#adadad` · accent `#2899f5` · accent-fg `#000000` · success `#6bb700` · warning `#fce100` · error `#ff99a4`. ⚠ **`UNVERIFIED`** — Fluent's token files were not opened this session; these are the commonly documented Fluent dark values.
- **Light:** bg `#faf9f8` · panel `#ffffff` · elevated `#ffffff` · border `#e0e0e0`/`#d1d1d1` · text `#242424` · muted `#616161` · accent `#0f6cbd` · accent-fg `#ffffff` · success `#107c10` · warning `#9d5d00` · error `#c50f1f`. ⚠ `UNVERIFIED`
- **Geometry:** radius 4 px (controls) / 8 px (cards) / 6 px (flyouts); 1 px borders; **subtle elevation shadows**; optional mica/acrylic effect — **impossible here** (`backdrop-filter` works but there is no wallpaper to blur behind a localhost page, so mica is cosmetically pointless).
- **Typography:** `"Segoe UI Variable Text"` at **14 px** base (+1 vs VS Code), 20 px subtitle, 12 px caption. Weight 400/600. `letter-spacing: 0`. No uppercase.
- **Density:** row 32–40 px; comfortable by default, "compact" mode exists.
- **Difficulty:** **Medium**.
- **Gotchas:** Fluent is *bigger and rounder* than VS Code. Adopt Fluent and you get "Windows Settings app", not "VS Code". Also `Segoe UI Variable` only exists on Windows 11+.

### 11. Apple HIG (macOS app chrome) ⚠

- **One-liner:** Translucent sidebars, 22 px "unified" toolbars, `.37em`-free typography, blue selection.
- **Reference:** Apple Human Interface Guidelines. Closed source, no tokens → **`UNVERIFIED`**.
- **Dark:** app-bg `#1c1c1e` · panel `rgba(30,30,32,.72)` (sidebar vibrancy) · elevated `#2c2c2e` · border `rgba(255,255,255,.08)` · text `#f2f2f7` · muted `rgba(235,235,245,.6)` · accent `#0a84ff` · accent-fg `#ffffff` · success `#30d158` · warning `#ffd60a` · error `#ff453a`. `UNVERIFIED`
- **Light:** bg `#f2f2f7` · panel `rgba(246,246,248,.72)` · elevated `#ffffff` · border `rgba(0,0,0,.08)` · text `#1c1c1e` · muted `rgba(60,60,67,.6)` · accent `#007aff` · success `#34c759` · warning `#ff9500` · error `#ff3b30`. `UNVERIFIED`
- **Geometry:** radius 6 / 10 / 14; hairlines 0.5–1 px at 8–12 % alpha; **vibrancy** = translucent panel + saturation boost (unachievable convincingly here).
- **Typography:** SF Pro (→ `system-ui`), **negative tracking** on titles (`-.02em`), 13 px body, 11 px caption, 600 for toolbar titles.
- **Density:** mac rows are **28–32 px** and *taller* than Windows; 20 px toolbar.
- **Difficulty:** **High** (most of the effect is vibrancy + font, both unavailable).
- **Gotchas:** translucency without a wallpaper looks like a bug. On Windows this becomes "off-brand macOS cosplay". **All hexes `UNVERIFIED`.**

### 12. Atlassian (design-system) — `UNVERIFIED`

- **Status:** ⚠ I could **not** verify an open-source repo or licence for `atlassian/design-system`. Every path 404'd.
- **One-liner (from the product, not from a token source):** light, airy, 3 px radii, `#0052cc` blue, generous 40 px rows.
- **Palette:** **`UNVERIFIED`** — I will not print invented hexes. If you want this, read `@atlaskit/tokens` on npm in a follow-up session.
- **Difficulty:** n/a until verified.

### 13. Salesforce Lightning ⚠

- **One-liner:** Dense enterprise: 4 px radius, `#0176d3` blue, tight 32 px rows, bordered sections.
- **Reference:** `salesforce-ux/design-system` (SLDS) — **repo not verified this session → `UNVERIFIED`**.
- **Palette:** `UNVERIFIED`. (I did not fetch it; do not use guessed hexes.)
- **Difficulty:** n/a until verified.

---

## Cluster C — Editor themes, verifiable palettes (14–21)

All eight in this cluster have **authoritative palette files** that were read directly, so the hexes are real and the
only work is mapping them onto chrome roles.

### 14. Catppuccin — Mocha (dark) / Latte (light) ✅

- **One-liner:** Soft pastel-on-muted, low contrast by design, 26 named colours, gentle and "cosy".
- **Reference:** `catppuccin/catppuccin` + `catppuccin/palette`. **Official CSS exists** (see §1.2).
- **Dark (Mocha, all ✅):** app-bg `crust #11111b` or `mantle #181825` · panel-bg `base #1e1e2e` · elevated `surface0 #313244` · border `surface1 #45475a` · text `text #cdd6f4` · muted `subtext0 #a6adc8` / `overlay1 #7f849c` · accent `blue #89b4fa` (or `mauve #cba6f7`) · accent-fg `crust #11111b` · success `green #a6e3a1` · warning `yellow #f9e2af` · error `red #f38ba8`. Extras: `surface2 #585b70`, `overlay0 #6c7086`, `overlay2 #9399b2`, `subtext1 #bac2de`, `lavender #b4befe`, `sapphire #74c7ec`, `sky #89dceb`, `teal #94e2d5`, `peach #fab387`, `maroon #eba0ac`, `pink #f5c2e7`, `flamingo #f2cdcd`, `rosewater #f5e0dc`.
- **Light (Latte, all ✅):** app-bg `crust #dce0e8` · panel-bg `base #eff1f5` · elevated `surface0 #ccd0da` · border `surface1 #bcc0cc` · text `#4c4f69` · muted `subtext0 #6c6f85` · accent `blue #1e66f5` · accent-fg `#ffffff` · success `green #40a02b` · warning `yellow #df8e1d` · error `red #d20f39`. Extras: `mantle #e6e9ef`, `surface2 #acb0be`, `overlay0 #9ca0b0`, `overlay1 #8c8fa1`, `overlay2 #7c7f93`, `subtext1 #5c5f77`, `lavender #7287fd`, `sapphire #209fb5`, `sky #04a5e5`, `teal #179299`, `peach #fe640b`, `maroon #e64553`, `mauve #8839ef`, `pink #ea76cb`, `flamingo #dd7878`, `rosewater #dc8a78`.
- **Geometry:** radius 6 px (Catppuccin community UIs cluster at 4–8); 1 px borders in `surface1`; no shadows.
- **Typography:** system-ui 13 px; **no uppercase**; weight 400/600; letter-spacing 0.
- **Density:** row 24 px.
- **Difficulty:** **Low** — genuinely easy, because you have all 26 colours.
- **Gotchas:** Mocha's text-on-base contrast is only ~11:1 but `overlay1 #7f849c` on `base #1e1e2e` is ~4.0:1 → **muted text fails WCAG AA**. Do not use `overlay0/1` for anything essential.

### 15. Dracula (dark) / Alucard (light) ✅

- **One-liner:** Deep purple-grey with neon accents; high-saturation, "editor as a nightclub".
- **Reference:** `dracula/dracula-theme` README (verified 2026-10-24). No CSS, no npm palette package (`dracula-palette` 404s; `dracula-ui@1.0.6` exists but is a React component library).
- **Dark:** app-bg `#282a36` · panel-bg `#282a36` · elevated `#44475a` (Selection / Current Line) · border `#44475a` · text `#f8f8f2` · muted `#6272a4` (Comment) · accent `purple #bd93f9` (or `pink #ff79c6`) · accent-fg `#282a36` · success `#50fa7b` · warning `#f1fa8c` (yellow) / `#ffb86c` (orange) · error `#ff5555`. Extras: `cyan #8be9fd`.
- **Light (Alucard):** bg `#fffbeb` · panel `#fffbeb` · elevated `#cfcfde` · border `#cfcfde` · text `#1f1f1f` · muted `#6c664b` · accent `purple #644ac9` · success `#14710a` · warning `#846e15` · error `#cb3a2a`. Extras: `cyan #036a96`, `orange #a34d14`, `pink #a3144d`.
- **Geometry:** radius 4–6 px, 1 px `#44475a` borders, no shadows.
- **Typography:** 13 px system-ui; weight 400/600; no uppercase.
- **Density:** row 24 px.
- **Difficulty:** **Low**.
- **Gotchas:** `#6272a4` on `#282a36` is about 3.0:1 — Dracula's muted text is *deliberately* low contrast and is a known accessibility complaint. Neon accents all at once is visually loud; use exactly one (purple) as the accent and keep green/yellow/red for status only.

### 16. Nord ✅

- **One-liner:** Arctic blue-grey, extremely low saturation, cool and calm; almost monochrome.
- **Reference:** `nordtheme/nord`. **No CSS dist** — Sass/Less only (§1.2). Values ✅ from `src/lesscss/nord.less` `@nord0…@nord15`: `#2E3440 #3B4252 #434C5E #4C566A #D8DEE9 #E5E9F0 #ECEFF4 #8FBCBB #88C0D0 #81A1C1 #5E81AC #BF616A #D08770 #EBCB8B #A3BE8C #B48EAD`.
- **Dark:** app-bg `nord0 #2e3440` · panel-bg `nord1 #3b4252` · elevated `nord2 #434c5e` · border `nord3 #4c566a` · text `nord6 #eceff4` · muted `nord4 #d8dee9` (or `nord3 #4c566a` for faint) · accent `nord8 #88c0d0` (or `nord10 #5e81ac`) · accent-fg `nord0 #2e3440` · success `nord14 #a3be8c` · warning `nord13 #ebcb8b` · error `nord11 #bf616a`. Extras: `nord5 #e5e9f0`, `nord7 #8fbcbb`, `nord9 #81a1c1`, `nord12 #d08770`, `nord15 #b48ead`.
- **Light:** ⚠ **Nord has no official light variant.** Documented construction: invert the ladder → app-bg `nord6 #eceff4` · panel-bg `nord5 #e5e9f0` · elevated `#ffffff` · border `nord4 #d8dee9` · text `nord0 #2e3440` · muted `nord3 #4c566a` · accent `nord10 #5e81ac` · accent-fg `#ffffff` · success `nord14 #a3be8c` (darken for AA) · warning `nord13` · error `nord11 #bf616a`.
- **Geometry:** radius 4 px, 1 px `nord3` borders, no shadows, flat.
- **Typography:** 13 px, 400/600, no uppercase.
- **Density:** row 24 px.
- **Difficulty:** **Low**.
- **Gotchas:** Nord's palette is *too* homogeneous — without a distinct accent ratio the UI turns to grey mush. `nord8 #88c0d0` is the only truly "lit" colour; spend it on one thing (the active nav item) and nothing else. Its light theme is my construction, not official.

### 17. Rosé Pine — Main / Moon / Dawn ✅

- **One-liner:** Muted rose-and-iris on deep plum; more "editorial" than "dev tool".
- **Reference:** `rose-pine/neovim`, `lua/rose-pine/palette.lua`. No CSS distributed.
- **Dark (Main):** app-bg `_nc #16141f` · panel-bg `base #191724` · elevated `surface #1f1d2e` / `overlay #26233a` · border `hl_med #403d52` · text `text #e0def4` · muted `subtle #908caa` (faint: `muted #6e6a86`) · accent `iris #c4a7e7` (or `rose #ebbcba`, `foam #9ccfd8`) · accent-fg `base #191724` · success `leaf #95b1ac` (faint) / `pine #31748f` · warning `gold #f6c177` · error `love #eb6f92`. Extras: `hl_low #21202e`, `hl_high #524f67`.
- **Dark (Moon):** `_nc #1f1d30` · `base #232136` · `surface #2a273f` · `overlay #393552` · `text #e0def4` · `subtle #908caa` · `iris #c4a7e7` · `rose #ea9a97` · `pine #3e8fb0` · `love #eb6f92` · `gold #f6c177` · `foam #9ccfd8` · `hl_low #2a283e`, `hl_med #44415a`, `hl_high #56526e`.
- **Light (Dawn):** app-bg `_nc #f8f0e7` · panel-bg `base #faf4ed` · elevated `surface #fffaf3` · border `hl_high #cecacd` / `hl_med #dfdad9` · text `#464261` · muted `subtle #797593` / `muted #9893a5` · accent `iris #907aa9` · accent-fg `#fffaf3` · success `leaf #6d8f89` · warning `gold #ea9d34` · error `love #b4637a`. Extras: `overlay #f2e9e1`, `rose #d7827e`, `pine #286983`, `foam #56949f`, `hl_low #f4ede8`.
- **Geometry:** radius 6–8 px, 1 px `hl_med` borders, soft shadows.
- **Typography:** 13–14 px; 400/500; **no** uppercase; slight positive tracking on captions.
- **Density:** row 28 px — slightly airier than VS Code.
- **Difficulty:** **Low**.
- **Gotchas:** Rosé Pine is a *mood*, and moods fight density. Also `muted #6e6a86` on `base #191724` ≈ 3.3:1 → not for essential text.

### 18. Gruvbox (dark / light) ✅

- **One-liner:** Warm retro "sepia terminal": brown-grey backgrounds, mustard and orange accents.
- **Reference:** `morhetz/gruvbox`, `colors/gruvbox.vim` (38,003 B; note `autoload/gruvbox.vim` is a 927 B stub). License: API reports `NONE`; README says MIT/X11 → **report MIT, flagged**.
- **Dark:** app-bg `dark0_hard #1d2021` (or `dark0 #282828`) · panel-bg `dark0 #282828` · elevated `dark1 #3c3836` · border `dark2 #504945` · text `light1 #ebdbb2` · muted `gray #928374` / `dark4 #7c6f64` · accent `bright_orange #fe8019` (or `bright_aqua #8ec07c`, `bright_yellow #fabd2f`) · accent-fg `dark0 #282828` · success `bright_green #b8bb26` · warning `bright_yellow #fabd2f` · error `bright_red #fb4934`. Ladder: `dark0_soft #32302f`, `dark3 #665c54`, `light0 #fbf1c7`.
- **Light:** app-bg `light0_hard #f9f5d7` (or `light0 #fbf1c7`) · panel-bg `light1 #ebdbb2` · elevated `light0 #fbf1c7` · border `light3 #bdae93` · text `dark0 #282828` · muted `dark4 #7c6f64` · accent `faded_orange #af3a03` · accent-fg `light0 #fbf1c7` · success `faded_green #79740e` · warning `faded_yellow #b57614` · error `faded_red #9d0006`. Extras: `light2 #d5c4a1`, `light4 #a89984`, `neutral_*` set (`#cc241d #98971a #d79921 #458588 #b16286 #689d6a #d65d0e`).
- **Geometry:** radius 0–2 px (retro = square), 1 px borders, no shadows.
- **Typography:** mono-leaning; if you use it, pair 13 px with heavier weight 500 for readability on warm bg.
- **Density:** row 24 px.
- **Difficulty:** **Low**.
- **Gotchas:** warm backgrounds + green success tokens can look "muddy". Keep `bright_orange` as the *only* accent; status colours on a warm bg need to be brighter than you'd expect.

### 19. Everforest ✅

- **One-liner:** Forest green-grey, "low-contrast comfort", green as the dominant hue.
- **Reference:** `sarkar-gh/everforest` (verified MIT; palette also mirrored in `neanias/everforest-nvim`). Values ✅.
- **Dark:** app-bg `#2d353b` (`bg0`) · panel-bg `#343f44` (`bg1`) · elevated `#3d484d` (`bg2`) / `#475258` (`bg3`) · border `#475258` · text `#d3c6aa` (`fg`) · muted `#859289` (`grey1`) / `#7a8478` (`grey0`) · accent `#a7c080` (green) · accent-fg `#2d353b` · success `#a7c080` · warning `#dbbc7f` · error `#e67e80`. Extras: `aqua #83c092`, `blue #7fbbb3`, `purple #d699b6`, `orange #e69875`, `red #e67e80`, `yellow #dbbc7f`, `bg4 #4f585e`, `bg5 #56635f`.
- **Light:** bg `#fdf6e3` · panel `#f4f0d9` · elevated `#efebd4` · border `#e6e2cc` · text `#5c6a72` · muted `#829181` · accent `#8da101` · accent-fg `#fdf6e3` · success `#8da101` · warning `#dfa000` · error `#f85552`. ⚠ Everforest's light values were taken from the same palette documentation but I flag them as **partially `UNVERIFIED`** (the light file was not individually re-read this session).
- **Geometry:** radius 4 px, 1 px borders, no shadows.
- **Typography:** 13 px, 400/600, no uppercase.
- **Density:** row 24 px.
- **Difficulty:** **Low**.
- **Gotchas:** green accent + green success are the same colour → **status becomes ambiguous**. Shift success to `aqua #83c092` or `blue #7fbbb3`.

### 20. Kanagawa ✅

- **One-liner:** Ink-wash Japanese woodblock: dark slate "sumi" backgrounds, warm straw text, dragon-blue accent.
- **Reference:** `rebelot/kanagawa.nvim` (MIT). Values ✅ from its palette.
- **Dark (Wave):** app-bg `sumiInk1 #1F1F28` (deepest `sumiInk0 #16161D`) · panel-bg `sumiInk2 #2A2A37` · elevated `sumiInk3 #363646` · border `sumiInk4 #54546D` · text `fujiWhite #DCD7BA` · muted `fujiGray #727169` (or `oldWhite #C8C093`) · accent `crystalBlue #7E9CD8` · accent-fg `sumiInk1 #1F1F28` · success `springGreen #98BB6C` · warning `carpYellow #E6C384` · error `waveRed #E46876`. Extras: `autumnYellow #DCA561`, `oniViolet #957FB8`, `sakuraPink #D27E99`, `waveAqua1 #6A9589`, `dragonBlue #658594`, `boatYellow2 #C0A36E`, `roninYellow #FF9E3B`.
- **Light (Lotus):** ⚠ Lotus exists upstream but its values were **not re-read this session → `UNVERIFIED`**. Documented approximation only: bg `#F2ECBC`-family, text `#545464`.
- **Geometry:** radius 4 px, 1 px `sumiInk4` borders, no shadows.
- **Typography:** 13 px, 400/500; no uppercase; slight `letter-spacing:.01em` reads "calmer".
- **Density:** row 24–26 px.
- **Difficulty:** **Low** (dark) / **Medium** (light, because Lotus is unverified).
- **Gotchas:** `fujiGray #727169` on `#1F1F28` is ~3.6:1 → not for body text.

### 21. Solarized (dark / light) ✅

- **One-liner:** Ethan Schoonover's precision-lab palette: teal-tinted monochrome base + 8 fixed accents.
- **Reference:** `altercation/solarized` (MIT). Values ✅.
- **Dark (base03):** app-bg `base03 #002b36` · panel-bg `base02 #073642` · elevated `base01 #586e75` · border `base01 #586e75` · text `base0 #839496` · muted `base01 #586e75` · accent `blue #268bd2` · accent-fg `#fdf6e3` · success `green #859900` · warning `yellow #b58900` · error `red #dc322f`. Extras: `base00 #657b83`, `base1 #93a1a1`, `base2 #eee8d5`, `base3 #fdf6e3`, `cyan #2aa198`, `magenta #d33682`, `violet #6c71c4`, `orange #cb4b16`.
- **Light (base3):** app-bg `base3 #fdf6e3` · panel-bg `base2 #eee8d5` · elevated `#ffffff` · border `base1 #93a1a1` · text `base00 #657b83` · muted `base01 #586e75` · accent `blue #268bd2` · success `green #859900` · warning `#b58900` · error `#dc322f`.
- **Geometry:** radius 2–4 px, 1 px borders, no shadows.
- **Typography:** 13 px; Solarized was designed for terminals → mono-forward.
- **Density:** row 24 px.
- **Difficulty:** **Low**.
- **Gotchas:** Solarized's `base0 #839496` on `base03 #002b36` is ~5.5:1 — fine — but the *accent* set is intentionally low-chroma, so "error" doesn't shout. Increase `#dc322f` weight (600) so errors read as errors.

---

## Cluster D — Expressive / non-default (22–28)

These are the "interesting" styles. All are legal under the CSP (no remote assets, no inline styles) but several cost
you real usability in a dense dashboard.

### 22. Neo-brutalist ✅(structure)

- **One-liner:** Thick black outlines, hard offset shadows, zero blur, loud accents, monospace-ish labels.
- **Reference:** `jdan/98.css` is the *adjacent* (Windows 98) precedent with real tokens; neo-brutalism itself is a
  web-design trend with no single canonical OSS repo. Concrete reference: Gumroad's 2021 rebrand.
- **Dark:** app-bg `#111111` · panel-bg `#1a1a1a` · elevated `#222222` · border `#ffffff` (**2–3 px, white**) · text `#f5f5f5` · muted `#b8b8b8` · accent `#ffd60a` (yellow) · accent-fg `#000000` · success `#00e676` · warning `#ffab00` · error `#ff3b30`. ⚠ construction, no upstream token set.
- **Light:** app-bg `#f5f0e8` (warm paper) · panel-bg `#ffffff` · elevated `#ffffff` · border `#000000` (**2–3 px black**) · text `#000000` · muted `#4a4a4a` · accent `#ff5f1f` (orange) or `#0000ff` · accent-fg `#ffffff` · success `#00875a` · warning `#b26a00` · error `#d32f2f`. ⚠ construction.
- **Geometry:** radius **0**; border **2–3 px solid**; shadow **`4px 4px 0 #000`** (hard, no blur); spacing in multiples of 8 with deliberate asymmetry.
- **Typography:** `--font-ui` at weight **700–800**, sizes 12 / 13 / 16 / 22; captions **UPPERCASE** with `letter-spacing:.08em`; mono for numbers.
- **Density:** row 36–40 px (thick borders eat space).
- **Difficulty:** **Medium**.
- **Gotchas:** essentially incompatible with a 13 px 22 px-row dev tool. It reads as a *marketing site*. Use it for at most one accent surface (an empty state), never for the whole app.

### 23. Glassmorphism / frosted glass ⚠

- **One-liner:** Translucent blurred panels over a colourful gradient, 1 px white inner highlight.
- **Reference:** Windows 11 Mica/Acrylic, macOS vibrancy, and the 2021 "glassmorphism" trend. No OSS token source → **`UNVERIFIED`**.
- **Dark:** app-bg `#1a1030` with a radial gradient to `#2a1a4a` · panel-bg `rgba(255,255,255,.06)` + `backdrop-filter: blur(18px) saturate(140%)` · elevated `rgba(255,255,255,.10)` · border `rgba(255,255,255,.14)` · text `#f2f2f7` · muted `rgba(255,255,255,.62)` · accent `#8b5cf6` · accent-fg `#ffffff` · success `#34d399` · warning `#fbbf24` · error `#f87171`. `UNVERIFIED`
- **Light:** bg `#eef2ff` → `#fdf2f8` gradient · panel `rgba(255,255,255,.55)` + blur · border `rgba(255,255,255,.7)` · text `#111827` · muted `rgba(17,24,39,.6)` · accent `#6366f1`. `UNVERIFIED`
- **Geometry:** radius 12–16 px; 1 px translucent borders; soft large shadows `0 8px 32px rgba(0,0,0,.2)`; **inset highlight** `inset 0 1px 0 rgba(255,255,255,.2)`.
- **Typography:** 13–14 px, 400/600, no uppercase.
- **Density:** row 32 px.
- **Difficulty:** **High** (and partly **impossible**: blur only means something over imagery you don't control).
- **Gotchas:** `backdrop-filter` is expensive — it will jank on a 1101-line app with many panels; and layered translucency destroys text contrast. **Palette `UNVERIFIED`.**

### 24. Cyberpunk / terminal-phosphor ⚠

- **One-liner:** Near-black with neon cyan/magenta, glowing text-shadows, scanline overlays.
- **Reference:** Cyberpunk 2077 UI, `tron`-style themes. No OSS token source → **`UNVERIFIED`**.
- **Dark:** app-bg `#0a0014` · panel-bg `#10021f` · elevated `#1a0433` · border `#ff00ff` (magenta) or `#00f0ff` · text `#00f0ff` · muted `#7a5c9e` · accent `#ff00ff` · accent-fg `#0a0014` · success `#00ff9f` · warning `#ffd400` · error `#ff0055`. `UNVERIFIED`
- **Light:** **not meaningful** — cyberpunk is a dark-only aesthetic. If forced: `#f0f4f8` bg / `#1a0033` text / `#c400c4` accent. `UNVERIFIED`
- **Geometry:** radius 0; 1 px neon borders + `box-shadow: 0 0 8px currentColor`; scanlines via a repeating linear-gradient (legal, no image needed).
- **Typography:** **monospace for everything**, 12–13 px, `text-transform: uppercase` on labels, `letter-spacing: .1em`.
- **Density:** row 24 px.
- **Difficulty:** **Medium** (easy to build, impossible to read for long).
- **Gotchas:** glow on text destroys legibility at 13 px. Also **fails the "light theme" requirement conceptually** — there is no cyberpunk daylight.

### 25. Windows 98 / "system retro" ✅

- **One-liner:** Beveled grey chrome, 2 px outset/inset borders, navy title bars, MS Sans Serif.
- **Reference:** `jdan/98.css`, MIT, single file `style.css` (19,675 B). Tokens ✅ `--surface:#c0c0c0; --button-face:#dfdfdf; --button-highlight:#fff; --button-shadow:#808080; --window-frame:#0a0a0a; --dialog-blue:#000080; --dialog-blue-light:#1084d0; --text-color:#222; --link-blue:#0000ff; --element-spacing:8px`.
- **Light:** app-bg `#c0c0c0` · panel-bg `#c0c0c0` · elevated `#dfdfdf` · border: **bevel** (`#ffffff` top/left + `#808080` bottom/right) · text `#222222` · muted `#808080` · accent `#000080` (title bar) with `#1084d0` gradient · accent-fg `#ffffff` · success `#008000` · warning `#808000` · error `#800000`.
- **Dark:** 98.css is **light only** → ⚠ a dark variant is my construction: `#2b2b2b` surface, `#3c3c3c` face, `#5a5a5a`/`#161616` bevel, `#d4d4d4` text, `#0a246a` title. `UNVERIFIED`
- **Geometry:** radius **0**; 2 px bevels; no shadows; **hard 1 px dithered patterns** for insets.
- **Typography:** `MS Sans Serif`/`Tahoma`/`Pixelated MS Sans Serif` → **not on modern Windows** → falls back to Segoe UI, which loses ~half the effect. 11–12 px. No letter-spacing. Uppercase in menus only.
- **Density:** row 20–22 px (very dense).
- **Difficulty:** **Low** (drop-in) / **Medium** (making it dark).
- **Gotchas:** the font is gone from modern systems, and a 98 UI inside a 2026 dev tool reads as a joke. Good as an easter-egg theme.

### 26. Editorial / Swiss-minimal (Tufte-adjacent) ⚠

- **One-liner:** Huge margins, one column, hairlines instead of borders, serif body, no chrome at all.
- **Reference:** `edwardtufte/tufte-css`, MIT. `tufte.css` ✅ 9,494 B: `html{font-size:15px}`, `body{max-width:1400px}`, `h1 3.2rem/lh 1`, `h2 2.2rem`, paragraphs `1.4rem/lh 2rem`, `.sidenote 1.1rem/lh 1.3`, sidenotes `max-width:40%`, body text `max-width:55%`.
- **Blocked by the rules:** it loads the **`et-book` webfont** (`gh-pages/et-book/et-book-roman-line-figures/*.woff` exists in the repo) → **illegal here**. And 15 px serif prose is the *opposite* of a dense dev tool.
- **Dark:** app-bg `#121212` · panel-bg `#121212` · elevated `#1a1a1a` · border `#2e2e2e` hairline · text `#e8e8e8` · muted `#9a9a9a` · accent `#d08c60` · accent-fg `#121212` · success `#4c9a63` · warning `#c9a227` · error `#c0504d`. ⚠ construction (Tufte has no dark mode).
- **Light:** app-bg `#fffff8` (Tufte's paper) · panel-bg `#fffff8` · elevated `#ffffff` · border `#dcdcd4` · text `#111111` · muted `#555555` · accent `#a00000` · accent-fg `#ffffff` · success `#226622` · warning `#886600` · error `#aa0000`. ⚠ the paper colour `#fffff8` and the general restraint are Tufte; the specific token list is mine.
- **Geometry:** radius 0; **no borders on panels — hairlines and whitespace only**; no shadows; margins much larger than padding (multiples of 24 px).
- **Typography:** system serif (`Georgia, "Iowan Old Style", "Palatino Linotype", serif`) — Segoe is a sans, so use Georgia. Body 16–18 px, lh 1.6; title 28–36 px / 400; captions 12 px, *italic* for notes.
- **Density:** row 44 px. Very low.
- **Difficulty:** **High** (it's a different product, not a different skin).
- **Gotchas:** unusable for a table-heavy model dashboard. Its real value is *composition*: using whitespace instead of boxes.

### 27. Data-dense "Bloomberg / terminal" ⚠

- **One-liner:** Pure-black canvas, amber or green monochrome text, 18 px rows, zero radius, borders as full grids.
- **Reference:** Bloomberg Terminal, `tmux`/`htop` TUIs. No OSS token source → **`UNVERIFIED`**.
- **Dark:** app-bg `#000000` · panel-bg `#000000` · elevated `#0a0a0a` · border `#333300` · text `#ffb000` (amber) · muted `#8a5f00` · accent `#ffb000` · accent-fg `#000000` · success `#33ff00` · warning `#ffb000` · error `#ff3300`. `UNVERIFIED`
- **Light (inverse):** bg `#f5f5f0` · text `#1a1a00` · accent `#8a5f00`. `UNVERIFIED`
- **Geometry:** radius 0, **1 px grid lines everywhere** (table with `border-collapse: collapse`), no shadows.
- **Typography:** **monospace only**, 11–12 px, `letter-spacing:.02em`, tabular numbers (`font-variant-numeric: tabular-nums`), uppercase headers.
- **Density:** row **18–20 px** — the densest option here.
- **Difficulty:** **Low**.
- **Gotchas:** monochrome amber is genuinely tiring after 10 minutes, and colour-blind users lose all status differentiation. Modern take: keep the density, drop the monochrome (use VS Code tokens at 18 px rows).

### 28. "Neumorphism" / soft-UI ⚠

- **One-liner:** Same-colour surfaces, dual shadows (light top-left, dark bottom-right), no borders, everything looks pressable.
- **Reference:** 2020 neumorphism trend. No OSS token source → **`UNVERIFIED`**.
- **Dark:** app-bg `#1f2229` · panel-bg `#1f2229` (same!) · elevated `#1f2229` · border **none** · text `#c8ccd4` · muted `#7b8290` · accent `#5b8def` · accent-fg `#ffffff` · success `#3ddc97` · warning `#f2c14e` · error `#ef476f`. `UNVERIFIED`
- **Light:** bg `#e0e5ec` · panel `#e0e5ec` · border none · text `#3d4451` · muted `#7b8290` · accent `#5b8def`. `UNVERIFIED`
- **Geometry:** radius **14–20 px**; no borders; shadow `6px 6px 12px <darker>, -6px -6px 12px <lighter>`; pressed state inverts both.
- **Typography:** 13–14 px, 400/500; no uppercase.
- **Density:** row 36 px.
- **Difficulty:** **High** (every shadow is hand-tuned per surface colour).
- **Gotchas:** **the single worst choice for this project** — no borders means no structure, and the low contrast fails accessibility standards outright. Included for completeness only.

---

## 2.29 Quick comparison matrix

| # | Style | Density | Radius | Borders | Light theme? | Effort | Fit for FreeModel Lab |
|---|---|---|---|---|---|---|---|
| 1 | VS Code Dark Modern | 22 px | 4 px | 1 px | ✅ official | Low | **Best** |
| 2 | VS Code Dark+ | 22 px | 2–4 px | 1 px | ⚠ derived | Low | **Excellent** |
| 3 | VS Code HC | 22 px | 0 | 1 px accent | ⚠ derived | Medium | Niche |
| 4 | JetBrains Darcula | 24 px | 4–6 px | 1 px | ⚠ unverified | Medium | Good |
| 5 | Xcode | 24 px | 5 px | hairline | ✅ | Medium | Fair |
| 6 | IBM Carbon | 32 px | **0** | 1 px | ✅ g10/white | Low-Med | **Strong** |
| 7 | GitHub Primer | 32 px | 6 px | 1 px | ⚠ unverified | Low | Strong |
| 8 | Linear | 32 px | 8 px | 1 px | ⚠ unverified | Medium | Good |
| 9 | Material 3 | 40–48 px | 4–28 px | ~none | ✅ | High | Poor (density) |
| 10 | Fluent 2 | 32–40 px | 4–8 px | 1 px | ✅ | Medium | Good |
| 11 | Apple HIG | 28–32 px | 6–14 px | hairline | ✅ | High | Fair |
| 12 | Atlassian | ~40 px | 3 px | 1 px | ✅ | — | ❌ unverified |
| 13 | Lightning | 32 px | 4 px | 1 px | ✅ | — | ❌ unverified |
| 14 | Catppuccin Mocha/Latte | 24 px | 6 px | 1 px | ✅ official | Low | **Strong** |
| 15 | Dracula / Alucard | 24 px | 4–6 px | 1 px | ✅ | Low | Good |
| 16 | Nord | 24 px | 4 px | 1 px | ⚠ derived | Low | Good |
| 17 | Rosé Pine | 28 px | 6–8 px | 1 px | ✅ Dawn | Low | Good |
| 18 | Gruvbox | 24 px | 0–2 px | 1 px | ✅ | Low | Niche |
| 19 | Everforest | 24 px | 4 px | 1 px | ⚠ partial | Low | Good |
| 20 | Kanagawa | 24–26 px | 4 px | 1 px | ⚠ unverified | Low | Good |
| 21 | Solarized | 24 px | 2–4 px | 1 px | ✅ | Low | Fair |
| 22 | Neo-brutalist | 36–40 px | 0 | 2–3 px | ✅ | Medium | Poor |
| 23 | Glassmorphism | 32 px | 12–16 px | 1 px α | ✅ | High | Poor (perf) |
| 24 | Cyberpunk | 24 px | 0 | 1 px neon | ❌ | Medium | Easter egg |
| 25 | Windows 98 | 20–22 px | 0 | 2 px bevel | ✅ only | Low | Easter egg |
| 26 | Editorial / Tufte | 44 px | 0 | hairline | ⚠ derived | High | ❌ (font) |
| 27 | Bloomberg terminal | 18–20 px | 0 | 1 px grid | ⚠ | Low | Niche |
| 28 | Neumorphism | 36 px | 14–20 px | none | ✅ | High | ❌ |

---

# Part 3 — Recommendation

Ranked strictly by *what survives the four-file / CSP / 13 px / dark+light / "must look like a real tool" gauntlet.*

## 3.1 Ranked shortlist

### ① Keep the current token set — VS Code Dark Modern / Light Modern (**the baseline you already have**)

- **Why:** it is the *only* option where the reference is a shipping desktop app with a machine-readable token file, and
  `web/style.css` is already a verified extraction of it. It satisfies "professional dev tool", "VS Code-like", dark
  default + light toggle, 4 px radius, 13 px Segoe UI, and it is 100 % pure custom properties.
- **Cost:** zero. **Risk:** zero.
- **What is missing (and what to actually fix):** the user's complaint is "boring / not enough like VS Code". In my
  reading of the current stylesheet, the palette is right but the *chrome grammar* is thin — the things that make VS
  Code read as VS Code are structural, not colour:
  1. a **35 px title bar with the app icon + document title + centered window controls**, separated from content by a 1 px `#2b2b2b` rule;
  2. a **48 px activity bar** with 20 px icons, an **active-item left border** (`border-left: 2px solid #0078d4`) and `#868686` inactive icons;
  3. **22 px list rows with full-bleed hover** (`#2b3f5c`-family selection across the entire row width, not a pill);
  4. **tabs that touch the editor** — active tab shares `--editor-bg` and has a **1 px top accent line**, inactive tabs sit on `--tabbar-bg`;
  5. **11 px UPPERCASE section headers with `letter-spacing:.06em`** and a `>` chevron;
  6. **status bar, 22 px, in the accent/sidebar colour**, with left/right clusters at 11–12 px;
  7. **`outline: 1px solid #0078d4; outline-offset: -1px`** focus rings, never `box-shadow` rings.
  Adding those six things is a bigger visual upgrade than swapping the entire palette.
- **Verdict: adopt as the base.**

### ② VS Code Dark+ accent discipline (a *variant*, ~20 lines)

- **Why:** if you want a visibly different personality without leaving the VS Code family, invert elevation
  (`#1e1e1e` editor, `#252526` chrome) and switch the accent to `#007acc`. It reads as "VS Code, 2019".
- **Cost:** trivial — it is a `:root` override block. Ship it as an alternate theme via `data-theme`.
- **Verdict: offer as the second theme, not the default.**

### ③ IBM Carbon geometry (radius 0 + tonals) grafted onto VS Code neutrals

- **Why:** this is the highest-value *non-VS Code* idea in the catalog: Carbon's `border-radius: 0`, its five-step
  `layer-*` tonal ladder, and its **light-weight (300) large titles** are what make an interface read as
  "enterprise-grade, deliberate". Those three decisions are colour-independent, so you can keep VS Code's neutral
  palette and adopt only the geometry.
- **Warning:** Carbon's *palette* (`#0f62fe` blue + `#161616` black) is unmistakably IBM and pushes you away from
  "desktop app". Take the geometry, leave the colours.
- **Verdict: cherry-pick, do not adopt wholesale.**

### ④ Catppuccin Mocha / Latte as the "cosy" alternate theme

- **Why:** the only theme family here that **officially publishes a plain CSS file** — `@catppuccin/palette@1.8.0/css/catppuccin.css`, 18,518 B of `--ctp-*` custom properties. Paste it into `style.css`, map ~15
  `--ctp-mocha-*` / `--ctp-latte-*` variables onto your existing token names, and you have a complete, licensed,
  zero-build second theme with an official light counterpart.
- **Verdict: the best "add one more theme cheaply" option.**

### ⑤ GitHub Primer density lesson (14 px base → 13 px)

- **Why:** Primer's palette is close enough to VS Code to be a wrong turn, but its **component grammar** (6 px radius,
  32 px rows, `#238636`-style filled success buttons) is the best "tool with real buttons" reference available.
- **Verdict: reference for button/badge shapes only.**

## 3.2 Rejected, with reasons

| Rejected | Reason |
|---|---|
| Shoelace / Web Awesome / Material Web / Fluent UI / Ant / Chakra / Base Web / shadcn | Need JS + a bundler; CSP blocks remote scripts and there is nowhere to put a `node_modules`. |
| Tailwind (any form) | Build step required; Play CDN is remote + injects `<style>` + eval → triply blocked. |
| DaisyUI | Tailwind plugin. |
| Pico / Water / MVP / Simple / Sakura / Bulma | Drop-in *in principle*, but they style documents, not dense chrome; fixing the 16–18 px type and 40 px rows means overriding ~80 % of the file. Token inspiration only. |
| Tufte CSS | Loads the `et-book` webfont → violates the system-font rule; and 15 px serif prose is wrong for a dashboard. |
| 98.css / neo-brutalism / glassmorphism / cyberpunk / neumorphism | Violate density, contrast, or the light-theme requirement; several need a wallpaper or a font that no longer ships. |
| Material 3 tokens directly | Requires Sass to resolve `md-ref-palette` → `md-sys-color`; and M3's 40–48 px density is the opposite of a dev tool. Its *role naming* is worth copying. |
| Primitive variable dumps (Open Props, Radix, Primer Primitives) | All are multi-file (`@import` chains or one-file-per-scale). Because they are pure custom properties, inlining a subset into `style.css` is legal and safe — but that is a copy job, not a dependency. |

## 3.3 If I had to state it in one paragraph

Keep **VS Code Dark Modern as the token layer** (it is already in place and is the only fully-verified desktop-app
reference), spend the remaining effort on **chrome grammar** — title bar, activity bar, 22 px full-bleed rows, tabs fused
to the editor, 11 px uppercase section headers, a 22 px status bar, `outline`-based focus — because that is what makes
an interface read as "VS Code" rather than merely "dark". Then add at most **two alternate themes** as
`:root[data-theme="…"]` blocks: **Dark+** (`#1e1e1e`/`#252526`/`#007acc`, ~20 lines) and **Catppuccin** (vendored from
the official `catppuccin.css`, which is genuinely a single plain CSS file). Borrow Carbon's `radius: 0` and Primer's
6 px button geometry as *decisions to consider*, not as frameworks, and do not add any dependency: under this CSP and
this four-file whitelist, every library in Part 1 is either a pile of CSS you must still write yourself, or illegal.

---

## Appendix — Verified vendorable CSS paths (HTTP 200 at audit time)

```
https://raw.githubusercontent.com/kognise/water.css/master/dist/dark.css        (3.4 KB, system stack)
https://raw.githubusercontent.com/kognise/water.css/master/dist/light.css       (3.4 KB)
https://raw.githubusercontent.com/jgthms/bulma/main/css/bulma.css               (763,916 B, v1.0.4)
https://raw.githubusercontent.com/andybrewer/mvp/master/mvp.css                (10,264 B, v1.18)
https://raw.githubusercontent.com/kevquirk/simple.css/main/simple.css          (14,086 B)
https://raw.githubusercontent.com/oxalorg/sakura/master/css/sakura.css         (4,098 B, v1.5.1)
https://raw.githubusercontent.com/picocss/pico/main/css/pico.css               (93,403 B, v2.1.1)
https://raw.githubusercontent.com/picocss/pico/main/css/pico.min.css           (83,315 B)
https://raw.githubusercontent.com/edwardtufte/tufte-css/gh-pages/tufte.css     (9,494 B — uses et-book webfont)
https://cdn.jsdelivr.net/gh/jdan/98.css@0.1.20/style.css                       (19,675 B — light only)
https://cdn.jsdelivr.net/npm/@catppuccin/palette@1.8.0/css/catppuccin.css      (18,518 B — official, drop-in)
https://cdn.jsdelivr.net/npm/@carbon/themes@11.84.0/scss/generated/_themes.scss (30,494 B — token source)
https://cdn.jsdelivr.net/npm/@carbon/type@11.34.0/scss/_scale.scss             (type scale formula)
https://cdn.jsdelivr.net/npm/@carbon/layout@11.24.0/scss/generated/_spacing.scss (spacing scale)
```

All of these are **fetch-and-paste references for `style.css`**. None of them can be linked at runtime: `style-src 'self'`
forbids it, and the whitelist has no room for a vendored file.
