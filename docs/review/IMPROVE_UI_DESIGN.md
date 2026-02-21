# Improvement Plan: UI & Design

**Priority:** High
**Estimated Effort:** 3-5 days
**Impact:** Transforms the app from "side project" to "polished product"

---

## Problem Summary

Chronicle's UI is functional but unpolished. It has a single dark theme, uses emoji icons, lacks a component library, has minimal animations, and is missing accessibility fundamentals. In 2026, users expect light/dark mode, crisp SVG icons, and smooth micro-interactions as baseline.

---

## 1. Add Light Mode + Theme Toggle

**Why:** Dark-only apps exclude users with visual preferences, outdoor usage, or accessibility needs. CSS custom properties are already in place — this is low-hanging fruit.

**Where:** `app/src/app.css`, `app/src/routes/+layout.svelte`

### Course of Action

1. **Define light theme variables** alongside existing dark ones:
   ```css
   :root {
     /* Current dark theme becomes [data-theme="dark"] */
     --bg-primary: #1e1e1e;
     /* ... */
   }

   [data-theme="light"] {
     --bg-primary: #ffffff;
     --bg-secondary: #f5f5f5;
     --bg-tertiary: #e8e8e8;
     --text-primary: #1e1e1e;
     --text-secondary: #444444;
     --text-muted: #666666;
     --accent-color: #0066cc;
     --border-color: #d4d4d4;
     /* ... map all existing vars */
   }
   ```

2. **Add `prefers-color-scheme` detection** in layout:
   ```typescript
   const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
   let theme = localStorage.getItem('chronicle-theme') || (prefersDark.matches ? 'dark' : 'light');
   document.documentElement.setAttribute('data-theme', theme);
   ```

3. **Add toggle button** in status bar (sun/moon icon).

4. **Update CodeMirror theme** to read from CSS variables dynamically.

5. **Update xterm.js theme** to match current mode.

---

## 2. Replace Emoji Icons with SVG Library

**Why:** Emojis render differently on Windows/macOS/Linux, can't be themed, and feel casual for a developer tool. SVG icons are crisp, scalable, and themeable.

**Recommended library:** [Lucide](https://lucide.dev/) — MIT license, 1400+ icons, tree-shakeable, Svelte bindings available.

### Course of Action

1. **Install Lucide:**
   ```bash
   cd app && npm install lucide-svelte
   ```

2. **Replace all emoji placeholders:**
   | Current | Replacement | Location |
   |---------|-------------|----------|
   | 📁 folder | `<FolderOpen />` | Explorer empty state |
   | 📝 memo | `<FileText />` | Editor empty state |
   | 🤖 robot | `<Bot />` | AI Output ready state |
   | ✨ sparkle | `<Sparkles />` | AI Output processing |
   | ▶/▼ chevrons | `<ChevronRight />` / `<ChevronDown />` | File tree |
   | × close | `<X />` | Dismiss buttons |
   | ● status dot | `<Circle />` (filled) | File status indicators |

3. **Add `aria-label`** to all icon-only buttons:
   ```svelte
   <button aria-label="Collapse explorer">
     <ChevronLeft size={14} />
   </button>
   ```

4. **Style icons via `currentColor`** so they inherit text color and work with both themes.

---

## 3. Build a Minimal Component Library

**Why:** 6+ button variants scattered across components leads to visual inconsistency and maintenance burden. A shared set of primitives ensures consistency.

### Course of Action

Create `app/src/lib/components/` with these foundational components:

1. **Button.svelte** — variants: `primary`, `secondary`, `ghost`, `danger`. Sizes: `sm`, `md`. Includes loading state.
   ```svelte
   <Button variant="primary" size="sm" loading={isProcessing}>
     Process Note
   </Button>
   ```

2. **IconButton.svelte** — icon-only button with required `aria-label`.

3. **Toast.svelte** — global notification system for success/error/warning. Replace inline error alerts.

4. **Tooltip.svelte** — styled tooltip that replaces HTML `title` attributes. Shows on hover/focus.

5. **Dropdown.svelte** — for processing style selection and future menus.

6. **Badge.svelte** — for status indicators (processed, unprocessed, error).

Replace existing ad-hoc button styling across all components to use shared `Button`.

---

## 4. Improve Animations and Micro-interactions

**Why:** Minimal transitions make the app feel static. Subtle animations communicate state changes and create a modern, responsive feel.

### Course of Action

1. **File switching**: Add 150ms fade transition when editor content changes.

2. **Pane collapse/expand**: Add 200ms slide animation instead of instant toggle.

3. **AI Output sections**: Stagger section appearance with 100ms delays (TL;DR first, then Key Points, etc.).

4. **Processing spinner**: Replace basic CSS `@keyframes spin` with a gradient ring spinner or animated dots.

5. **Button hover/active**: Add subtle scale transform (`transform: scale(0.98)` on active).

6. **File tree selection**: Add brief highlight pulse (100ms background flash) on selection.

7. **Status bar transitions**: Smooth text changes with 200ms opacity transition.

Keep all animations under 300ms and respect `prefers-reduced-motion`:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 5. Accessibility Improvements

**Why:** Current accessibility is partial — good focus styles exist, but missing live regions, ARIA labels, and keyboard navigation patterns.

### Course of Action

1. **Add live regions** for dynamic content:
   ```svelte
   <div aria-live="polite" aria-atomic="true" class="sr-only">
     {statusMessage}
   </div>
   ```
   Announce: file saved, processing started/completed, errors, session changes.

2. **File tree arrow key navigation**:
   - Up/Down: Move between visible nodes
   - Right: Expand directory or move to first child
   - Left: Collapse directory or move to parent
   - Home/End: Jump to first/last visible node
   - Implement with roving tabindex pattern.

3. **Skip links**: Add hidden skip navigation at top of layout:
   ```html
   <a href="#editor" class="sr-only focus:not-sr-only">Skip to editor</a>
   ```

4. **Screen reader labels**: Replace all `title` attributes on icon-only buttons with `aria-label`.

5. **Focus management**: When switching files, move focus to editor. When processing completes, announce via live region.

6. **Color contrast audit**: Verify all text/background combinations meet WCAG AA (4.5:1 for normal text). The warning color `#cca700` on `#1e1e1e` is borderline — darken the background or lighten the text.

---

## 6. Layout Enhancements

### Course of Action

1. **Persist pane dimensions** in localStorage so layout survives page refresh.

2. **Double-click divider** to maximize/restore the pane to the left.

3. **Keyboard pane resize**: When divider is focused, use arrow keys for fine adjustment (1px per press, 10px with Shift).

4. **Breadcrumb bar** above editor showing: `workspace / folder / filename.md` — clickable segments to navigate.

5. **Status bar enrichment**: Show current file name, session duration, git status, and word count.

---

## Success Criteria

- [ ] Light and dark mode work, respecting system preference
- [ ] All emojis replaced with themed SVG icons
- [ ] Shared Button, Toast, Tooltip components used throughout
- [ ] `prefers-reduced-motion` respected
- [ ] File tree navigable with arrow keys
- [ ] WCAG AA contrast ratios met for all text
- [ ] Pane layout persists across sessions
