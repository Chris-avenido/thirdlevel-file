# [Template] HTML Guides and PDF

Projects: STRIDE (https://app.notion.com/p/STRIDE-2bff6dd1f0c8800cb095de75087b72b5?pvs=21)
RESOURCES: NOTES (https://app.notion.com/p/NOTES-360f6dd1f0c88006a4b9c9f3b8e36ad1?pvs=21)

<aside>
🧭

This is a build standard for creating **single-file HTML guides** that look polished on screen and export cleanly to PDF. It is based on the reference implementation in [AGAP Portal Application Management Guides](https://app.notion.com/p/AGAP-Portal-Application-Management-Guides-46b99fb2cccc4b86aea606201545e8cc?pvs=21). Follow it top-to-bottom to produce a consistent guide.

</aside>

## 0. What you are building

Each guide is **one self-contained HTML document** (inline `<style>` + inline `<script>`, web-font `<link>` allowed). It has two faces:

- **Screen app** — a cover/title page, an auto-hiding left sidebar, one section shown at a time, per-step highlighting, and a scroll-spy progress ring.
- **Print/PDF** — the *entire* guide flattened into a clean, paginated document with a repeating header and footer on every page.

<aside>
⚠️

The single most important rule: **the screen layout and the print layout are two different renderings of the same DOM.** Never let interactive state (which section is active, sidebar open/closed, cover showing) leak into the PDF. The print stylesheet must force the full guide to appear regardless of on-screen state.

</aside>

---

## 1. Document skeleton

Start every guide from this shell:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Guide title here</title>

  <!-- Web fonts: preconnect first, then the stylesheet -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@700;800;900&display=swap" rel="stylesheet">

  <style> /* 2. tokens + 3. components + 6. print */ </style>
</head>
<body>
  <main class="sheet">
    <div class="print-actions">
      <button class="print-button" type="button" onclick="window.print()">Print / Save as PDF</button>
    </div>

    <header class="hero">
      <div class="eyebrow">Kicker · Guide name</div>
      <h1>Guide headline</h1>
      <p class="subtitle">One-sentence description of what this guide covers.</p>
      <div class="notice"><strong>Important:</strong> Any critical framing note.</div>
    </header>

    <section class="guide-grid">
      <!-- one <article class="section-card"> per section (see 3.3) -->
    </section>

    <div class="footer-note">A single closing operating rule.</div>
  </main>

  <script> /* 4. interactive app + 5. print frame */ </script>
</body>
</html>
```

<aside>
🧩

Keep the semantic order: **hero → guide-grid (section-cards) → footer-note**, all inside one `<main class="sheet">`. The script reads this structure to build the sidebar automatically, so you never hand-maintain a nav list.

</aside>

---

## 2. Design tokens (the InsightED system)

Define everything as CSS variables in `:root` so a guide can be re-themed by changing a few lines. Set the two print label variables here too — the print frame reads them.

```css
:root {
  --paper: #ffffff;
  --canvas: #F0F9FF;
  --ink: #0F172A;
  --muted: #64748B;
  --line: #BAE6FD;

  /* Identity accent — change per guide (e.g. blue for HRMO, green for Applicant) */
  --accent: #075985;
  --accent-soft: #E0F2FE;

  --good: #16A34A;  --good-soft: #dcfce7;
  --bad:  #B91C1C;  --bad-soft:  #fee2e2;

  --radius: 18px;
  --font-heading: "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif;
  --font-body: "DM Sans", ui-sans-serif, system-ui, sans-serif;

  /* Print header/footer labels (read by the print frame in section 5) */
  --print-header: "AGAP Portal · Guide Name";
  --print-footer: "AGAP Portal Application Guide";
}
```

**Palette reference**

| Token | Value | Use |
| --- | --- | --- |
| `--ink` | `#0F172A` | Body text, headings |
| `--muted` | `#64748B` | Secondary text |
| `--line` | `#BAE6FD` | Borders, dividers |
| `--accent` | `#075985` (blue) / `#16A34A` (green) | Section identity, links, step numbers |
| `--accent-soft` | `#E0F2FE` / `#dcfce7` | Chips, soft fills |
| `--good` / `--bad` | `#16A34A` / `#B91C1C` | Status tags |

**Typography rules**

- Headings + eyebrow/kicker → `var(--font-heading)` (Plus Jakarta Sans, weights 700–900).
- Body, lists, tables → `var(--font-body)` (DM Sans).
- Use weight and size for hierarchy; avoid underline/italic on step titles (they add clutter).

---

## 3. On-screen components

### 3.1 The sheet + hero

```css
body { margin: 0; background: var(--canvas); color: var(--ink);
  font-family: var(--font-body); font-size: 16px; line-height: 1.65; }
.sheet { width: min(1180px, calc(100% - 32px)); margin: 24px auto;
  padding: 28px; background: var(--paper); border: 1px solid var(--line);
  border-radius: 28px; }
.hero { margin-bottom: 24px; text-align: center; }
.eyebrow { display: inline-block; padding: 6px 12px; border-radius: 999px;
  background: var(--accent-soft); color: var(--accent);
  font-family: var(--font-heading); font-weight: 800; font-size: 12px;
  letter-spacing: .06em; text-transform: uppercase; }
```

### 3.2 Section card + steps

Each section is an `<article class="section-card">` with a `.section-head` (letter badge + `<h2>`) and one `.step` per substep. **Write each step heading as `Step N: Title`** — the script parses that pattern to split the number and title.

```html
<article class="section-card">
  <div class="section-head">
    <div class="letter">A</div>
    <h2>Create your account</h2>
  </div>

  <div class="step">
    <h3>Step 1: Open the portal</h3>
    <ol><li>First action.</li><li>Second action.</li></ol>
  </div>
</article>
```

<aside>
✅

Readability defaults that matter: list `line-height: 1.6–1.75`, `8–12px` spacing between list items, and generous section padding. Whitespace does more for clarity than borders — avoid nesting boxes inside boxes.

</aside>

### 3.3 Supporting blocks

- **Status/legend tables** → `<table class="status-table">` with `<span class="tag green|red|blue">`.
- **Checklists** → real inputs so they are tickable:

```html
<label class="check-item"><input type="checkbox" /> <span>Item to confirm.</span></label>
```

### 3.4 Section videos (optional, autoplay per tab)

A section can host a short walkthrough video that **plays from the start the moment its tab opens** and pauses/rewinds when you leave it. Place the `.section-video` wrapper right after the `.section-head`; simply omit it for sections that have no video (e.g. a review-only tab).

```html
<article class="section-card">
  <div class="section-head">
    <div class="letter">A</div>
    <h2>Create your account</h2>
  </div>

  <div class="section-video">
    <video class="tab-video" controls playsinline preload="metadata">
      <source src="section-a.mp4" type="video/mp4">
      Your browser does not support embedded video.
    </video>
  </div>

  <div class="step"> … </div>
</article>
```

```css
.section-video { margin: 0 0 22px; border: 1px solid var(--line);
  border-radius: 16px; overflow: hidden; background: #000;
  box-shadow: 0 12px 32px rgba(8, 49, 95, .12); }
.section-video video { display: block; width: 100%; max-height: 460px;
  aspect-ratio: 16 / 9; background: #000; object-fit: contain; }
```

<aside>
🎬

Use **relative** `<source>` paths (e.g. `section-a.mp4`) with `type="video/mp4"` and `playsinline`, and keep each file in the **same folder as the HTML** so it resolves on static hosts like GitHub Pages. Filenames are case-sensitive there — match the exact case.

</aside>

---

## 4. The interactive app (script)

The script runs once and progressively enhances the static HTML. It should:

1. Add `has-side-nav` to `<body>` and build an `<aside class="side-nav">` by iterating `document.querySelectorAll('.section-card')` — one nav item per section, plus a **Title page** item and a **Print / Save as PDF** button pinned to the sidebar footer.
2. Show one section at a time (`.section-card.is-active`); the cover/hero shows in `cover-active` state, sections in `section-active` state.
3. Mirror the selected sidebar label into a compact `.guide-header` card at the top of the section view.
4. **Auto-hide** the sidebar to a slim rail; expand on hover/toggle; collapse shortly after interaction.
5. Add a per-section step sub-nav and a scroll-spy that highlights the active step via `IntersectionObserver`, driving a conic-gradient progress ring on the sidebar letter.
6. **Auto-play each section's video from the start when its tab opens**, and pause + rewind every video when leaving a section or returning to the cover (see the snippet below).

<aside>
💡

Because the sidebar is generated from `.section-card` elements, adding or removing a section automatically updates navigation — never hand-edit the nav.

</aside>

**Section-video autoplay** — add these helpers and call them from your section switcher. It tries to play with sound (a tab click is a valid user gesture) and falls back to muted autoplay if the browser blocks it, so the clip always starts:

```jsx
function resetSectionVideos() {
  Array.prototype.slice.call(document.querySelectorAll('.section-video video')).forEach(function (v) {
    try { v.pause(); v.currentTime = 0; } catch (e) {}
  });
}

function playSectionVideo(card) {
  if (!card) return;
  var video = card.querySelector('.section-video video');
  if (!video) return;
  try {
    video.currentTime = 0;                 // always start from 0:00
    var attempt = video.play();
    if (attempt && typeof attempt.catch === 'function') {
      attempt.catch(function () {           // sound autoplay blocked -> mute + retry
        video.muted = true;
        var retry = video.play();
        if (retry && typeof retry.catch === 'function') { retry.catch(function () {}); }
      });
    }
  } catch (e) {}
}

// showSection(index): right after the active card is set
resetSectionVideos();
playSectionVideo(activeCard);

// showCover(): stop and rewind everything
resetSectionVideos();
```

---

## 5. The print / PDF function (the critical part)

### 5.1 Why naive approaches fail

<aside>
🚫

A `position: fixed` header/footer **does** repeat on every printed page, but browsers paint it *over* the content, and `body` padding only reserves space on the **first** page. Result: content is hidden under the header on pages 2, 3, 4… Chrome also ignores CSS page-margin boxes (`@top-center`, etc.). Do not use fixed positioning for print headers.

</aside>

### 5.2 The reliable pattern — table `thead` / `tfoot`

Browsers are the ones that repeat `<thead>` and `<tfoot>` on every printed page **and** reserve vertical space for them, so content can never overlap. Build a print-only table wrapper on `beforeprint` and remove it on `afterprint`, so the screen app is untouched.

```jsx
function stripQuotes(v){ return String(v||'').trim().replace(/^["']+|["']+$/g,''); }

function buildPrintFrame() {
  var main = document.querySelector('.sheet');
  if (!main || main._printFramed) return;
  var s = getComputedStyle(document.documentElement);
  var headerText = stripQuotes(s.getPropertyValue('--print-header')) || document.title;
  var footerText = stripQuotes(s.getPropertyValue('--print-footer')) || headerText;

  var table = document.createElement('table');
  table.className = 'print-wrap';

  var thead = document.createElement('thead');
  thead.innerHTML = '<tr><td><div class="print-head"></div></td></tr>';
  thead.querySelector('.print-head').textContent = headerText;

  var tfoot = document.createElement('tfoot');
  tfoot.innerHTML = '<tr><td><div class="print-foot"></div></td></tr>';
  tfoot.querySelector('.print-foot').textContent = footerText;

  var tbody = document.createElement('tbody');
  var cell = document.createElement('td');
  cell.className = 'print-body-cell';
  while (main.firstChild) cell.appendChild(main.firstChild);
  var row = document.createElement('tr'); row.appendChild(cell);
  tbody.appendChild(row);

  table.appendChild(thead);   // header group
  table.appendChild(tfoot);   // footer group (before tbody is fine)
  table.appendChild(tbody);   // the actual content
  main.appendChild(table);
  main._printFramed = true; main._printTable = table;
}

function teardownPrintFrame() {
  var main = document.querySelector('.sheet');
  if (!main || !main._printFramed) return;
  var t = main._printTable, cell = t && t.querySelector('.print-body-cell');
  while (cell && cell.firstChild) main.insertBefore(cell.firstChild, t);
  if (t && t.parentNode) t.parentNode.removeChild(t);
  main._printFramed = false; main._printTable = null;
}

window.addEventListener('beforeprint', buildPrintFrame);
window.addEventListener('afterprint', teardownPrintFrame);
if (window.matchMedia) {                       // Safari fallback
  var mql = window.matchMedia('print');
  var fn = function(e){ e.matches ? buildPrintFrame() : teardownPrintFrame(); };
  mql.addEventListener ? mql.addEventListener('change', fn) : mql.addListener(fn);
}
```

### 5.3 Print stylesheet

```css
@media print {
  @page { size: A4; margin: 12mm; }

  /* 1) Neutralize interactive-only chrome */
  .side-nav, .guide-header, .print-actions, .section-step-nav, .section-video { display: none !important; }
  body::before, body::after { content: none !important; display: none !important; }
  body { padding: 0 !important; background: #fff !important; }

  /* 2) Force the FULL guide to show regardless of on-screen state */
  .sheet { width: 100% !important; margin: 0 !important; padding: 0 !important;
    border: 0 !important; border-radius: 0 !important; }
  .guide-grid, .footer-note, .section-card { display: block !important; }
  .section-head { display: flex !important; }

  /* 3) Running header/footer via the table groups */
  .print-wrap { width: 100% !important; border-collapse: collapse !important; }
  .print-wrap thead { display: table-header-group !important; }
  .print-wrap tfoot { display: table-footer-group !important; }
  .print-wrap td { padding: 0 !important; border: 0 !important; vertical-align: top !important; }
  .print-head { margin: 0 0 6mm; padding: 0 0 3mm; border-bottom: 1px solid var(--line);
    color: var(--accent); font-family: var(--font-heading); font-size: 9pt; font-weight: 900;
    letter-spacing: .08em; text-transform: uppercase; }
  .print-foot { margin: 6mm 0 0; padding: 3mm 0 0; border-top: 1px solid var(--line);
    color: var(--muted); font-family: var(--font-body); font-size: 8.5pt; font-weight: 700; }

  /* 4) Hierarchy: section header clearly larger than step title */
  .section-head h2 { font-size: 20pt !important; font-weight: 900 !important; }
  .step h3 { font-size: 13pt !important; }
  .section-card, .step { page-break-inside: avoid; break-inside: avoid; }
  .section-head, .step h3 { page-break-after: avoid; break-after: avoid; }

  /* 5) Keep brand colors in the export */
  .tag, .doc-card, .check-item { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
```

<aside>
📄

In Chrome's print dialog, keep **More settings → Headers and footers** *unchecked* so the browser's own URL/date labels don't stack on top of your custom header/footer. Enable **Background graphics** so colors and fills export.

</aside>

---

## 6. Pre-publish checklist

- [ ]  Fonts load (preconnect + stylesheet present); text falls back gracefully.
- [ ]  `:root` tokens set, including `--accent`, `--print-header`, `--print-footer`.
- [ ]  Every step heading uses the `Step N: Title` pattern.
- [ ]  Sidebar builds automatically from `.section-card`s; no hand-written nav.
- [ ]  Cover, section paging, auto-hide sidebar, and scroll-spy all work on screen.
- [ ]  Print preview shows **all** sections (not just the active one).
- [ ]  Header/footer repeat on **every** page with **no overlap** (multi-page check).
- [ ]  Section `<h2>` is visibly larger than step `<h3>` in the PDF.
- [ ]  Sections/steps don't break awkwardly across pages.
- [ ]  Colors/tags render in the exported PDF (Background graphics on).
- [ ]  Section videos autoplay from `0:00` on tab open, pause + rewind on leave, and are hidden in the PDF.
- [ ]  Each video file sits next to the HTML with exact-case naming and loads over the host (e.g. GitHub Pages).

---

## 7. Common pitfalls

| Symptom | Cause | Fix |
| --- | --- | --- |
| Content hidden under header on later pages | `position: fixed` print header | Use the `thead`/`tfoot` table frame (5.2) |
| Only the active section prints | Interactive state leaked into print | Force `display: block` on all `.section-card` in `@media print` |
| Section title smaller than steps | Step styles override in print | Set explicit `font-size` hierarchy in print CSS (5.3 step 4) |
| Colors missing in PDF | Background graphics off | Enable it; add `print-color-adjust: exact` |
| Images load slowly / 404 on a server | Case-sensitive paths; served by app not statics | Match exact filename case; serve static files directly |
| Duplicated Print buttons in PDF | On-page buttons not hidden | Hide `.print-actions` in print |
| Section video won't autoplay / no sound | Browser autoplay policy blocks unmuted play | Call `play()` on the tab-click gesture; catch the rejection, set `muted = true`, retry |
| Video 404s on GitHub Pages | Wrong relative path or filename case mismatch | Keep the `.mp4` beside the HTML; match exact case; set `type="video/mp4"` |