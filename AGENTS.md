# AGENTS.md

This file gives coding agents repository-specific guidance for `/mnt/c/Users/lorin/Herd/weddinginvitation`.

## Repository overview

- Stack: Vite + Vue 3 + animejs + Sass.
- The app is primarily plain browser JavaScript plus static HTML/CSS.
- Vue is installed, but there are no Vue SFCs, composables, stores, or routing.
- Most runtime behavior lives in `script.js` and `main.js`.
- `style.scss` is the authored Sass layer and imports `style.css`.
- Many root-level image assets are referenced directly from HTML, CSS, and JS.

## Files reviewed for this guide

- `package.json`
- `.gitignore`
- `index.html`
- `main.js`
- `script.js`
- `style.scss`

## Explicit instruction files checked

The following were checked and are not present in this repo:

- `.cursorrules`
- `.cursor/rules/`
- `.github/copilot-instructions.md`

Do not assume any hidden Cursor or Copilot rules beyond this file.

## Confirmed commands

All confirmed commands come from `package.json`.

### Install

- `npm install`

The repo includes `package-lock.json`, so npm is the checked-in package manager.

### Development

- `npm run dev`
- Underlying command: `vite`

### Production build

- `npm run build`
- Underlying command: `vite build`

### Preview production build

- `npm run preview`
- Underlying command: `vite preview`

## Lint, typecheck, and tests

These are not configured in the repository as checked in.

- No `lint` script exists.
- No `test` script exists.
- No `typecheck` script exists.
- No ESLint config was found.
- No Prettier config was found.
- No TypeScript config was found.
- No Jest, Vitest, Playwright, or similar test config was found.
- No `*.test.*` or `*.spec.*` files were found.

### Single-test execution

There is no configured single-test command because no test runner is set up.

If asked to run a single test, state clearly that the repository does not currently contain a test framework or test scripts.

## Key files and responsibilities

- `index.html`: main document structure, inline startup script, inline handlers, and page content.
- `main.js`: Vite entrypoint, Vue bootstrap, animejs bridge, and startup animation hook.
- `script.js`: primary interactive behavior, scratch-card logic, reveal flow, and DOM manipulation.
- `style.css`: large inherited base stylesheet.
- `style.scss`: Sass variables, mixins, and overrides layered on top of `style.css`.
- `dist/`: generated output; treat as a build artifact.

## Architecture expectations

- Preserve the current DOM-first architecture unless the user explicitly asks for a larger refactor.
- Do not introduce Vue components just because Vue is installed.
- Prefer extending existing DOM/event logic over adding framework-heavy abstractions.
- Keep changes minimal and local.
- Do not reorganize assets or move files unless the user asks for it.

## JavaScript guidance

### Language and imports

- Use plain JavaScript, not TypeScript, unless the user explicitly requests otherwise.
- Use ESM imports at the top of module files.
- In `main.js`, package imports come before the local stylesheet import.
- Do not introduce path aliases unless the repo is reconfigured for them.

### Naming

- Use `camelCase` for variables and functions.
- Use `is*` and `has*` prefixes for booleans when it fits.
- Keep custom event names string-based and kebab-cased, such as `"invite:ready"`.
- Preserve existing DOM ids and classes unless every reference is updated.

### Runtime safety and error handling

- Follow the repo’s defensive style with guard clauses.
- Prefer patterns like `if (!el) return;` for queried DOM nodes.
- Use feature detection when needed, for example `typeof ResizeObserver`.
- Prefer graceful fallback behavior over hard failure.
- Do not add empty `catch` blocks.
- If existing code logs and continues, preserve that behavior unless the user asks otherwise.

### Browser globals

- Global bridges on `window` are intentional in this repo.
- `window.__animeAnimate` and `window.__instructionWaveAnimation` are integration points.
- Do not remove `window.__*` hooks unless you update every dependent path.

## DOM and HTML patterns

- Direct DOM access is normal here: `getElementById`, `querySelector`, `querySelectorAll`, `classList`, and inline `style` updates.
- Event-driven startup matters. Existing flow uses `DOMContentLoaded`, `load`, and the custom `invite:ready` event.
- Integrate startup-sensitive behavior with the current reveal/init sequence rather than racing it.
- `index.html` is a real part of the app, not just a shell.
- Inline `<script>`, inline styles, and inline `onclick` handlers already exist and are acceptable when matching existing patterns.
- Preserve Czech copy, accents, and content structure.
- Edit carefully: some files show mojibake signs, so preserve UTF-8 encoding.

## Styling guidance

- Prefer adding or adjusting styles in `style.scss`.
- Treat `style.css` as the large inherited base layer.
- Avoid unnecessary mass-reformatting of `style.css`.
- Keep the `@import "./style.css";` relationship intact unless the user asks for a styling architecture change.
- CSS custom properties, Sass variables, mixins, nested Sass rules, and media queries are all already in use.
- `!important` is already used for targeted overrides and is acceptable when needed to match existing behavior.
- Use kebab-case for CSS classes and ids.

## Formatting guidance

- There is no formatter configured in the repo.
- Match the surrounding file instead of imposing a new style.
- `main.js` and `style.scss` use 2-space indentation.
- `script.js` and `index.html` use 4-space indentation.
- Semicolons are used consistently in JS and should be kept.
- Quote style is mixed, so preserve the dominant style of the file you touch.
- Do not reformat unrelated lines just for stylistic consistency.

## Assets and generated files

- Root image assets are part of the application and may be referenced directly by filename.
- Check references before renaming or deleting images.
- Do not manually edit `dist/` unless the user explicitly asks.
- `.gitignore` treats `node_modules/`, `dist/`, `.vite/`, and package-manager debug logs as generated artifacts.

## Verification guidance

When you make changes, prefer this order:

1. Confirm the affected file relationships manually.
2. Run `npm run build` for a production sanity check.
3. If the change affects runtime behavior, also run `npm run dev` and verify in the browser when possible.

Because there is no test suite or linter, a successful build and targeted manual verification are the main safety checks.

## Things agents should not invent

- Do not claim linting exists when it does not.
- Do not claim tests exist when they do not.
- Do not claim single-test execution is available.
- Do not assume Vue components, composables, stores, or routing are already present.
- Do not introduce TypeScript-only patterns into this plain-JS codebase unless explicitly requested.

## Recommended default approach

- Make the smallest change that fits the request.
- Preserve the existing DOM-first architecture.
- Keep JS defensive and browser-safe.
- Keep styles in `style.scss` where possible.
- Match local formatting and naming in the file you edit.
- Verify with `npm run build`, and use manual browser testing for interactive changes.
