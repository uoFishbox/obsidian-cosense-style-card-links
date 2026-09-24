# AGENTS.md — Cosense-style card links (Obsidian plugin)

Compact guide for agents working in this repo.

## Quick commands

| Task                 | Command                                                                                                                           |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Dev (watch)          | `bun run dev`                                                                                                                     |
| Build (production)   | `bun run build`                                                                                                                   |
| Run all tests        | `bun run test`                                                                                                                    |
| Test (unit/node)     | `bun run test:unit`                                                                                                               |
| Test (dom-all)       | `bun run test:dom-all`                                                                                                            |
| Test (dom-unit)      | `bun run test:dom-unit`                                                                                                           |
| Test (dom-svelte)    | `bun run test:dom-svelte`                                                                                                         |
| Test (performance)   | `bun run test:perf`                                                                                                               |
| Test (watch)         | `bun run test:watch`                                                                                                              |
| Test (UI)            | `bun run test:ui`                                                                                                                 |
| Test (coverage)      | `bun run test:coverage`                                                                                                           |
| Type/Svelte check    | `bun run check`                                                                                                                   |
| Check circular deps  | `bun run check:circular`                                                                                                          |
| Verify release data  | `bun run verify:release`                                                                                                          |
| Run single test file | `bun run test -- src/cards/sorting/__tests__/sortService.test.ts`                                                                 |
| Version bump         | `npm version patch` (or `minor` / `major`) — updates `manifest.json`, `package.json`, `versions.json`, and git-adds the first two |

- CI and release jobs install the pinned Bun version and use `bun install --frozen-lockfile` with the committed lockfile.
- Built artifact is `main.js`. It is **gitignored** but uploaded to GitHub releases.
- `data.json` (plugin settings at runtime) is gitignored.
- `bks/` contains backup zip files — do not delete or modify.

## Build & bundle facts

- Entry: `src/main.ts` → `main.js` (CJS, es2018 target, minified in production).
- Bundler: `esbuild` via `esbuild.config.mjs`:
    - `esbuild-svelte` (css: `'injected'`, preprocess: `sveltePreprocess()`)
    - `esbuild-plugin-inline-worker` (inlines preview text processing workers)
- `obsidian`, `electron`, all `@codemirror/*`, `@lezer/*`, and Node builtins are **external** — never bundle them.
- Dev mode emits inline sourcemaps; production does not.
- `process.env.NODE_ENV` is injected as `"development"` or `"production"`.
- `vitest.config.js` is a compiled duplicate of `vitest.config.ts` — edit only the `.ts` file.

## TypeScript & Svelte quirks

- **Svelte 5** with runes. Reactive stores live in `.svelte.ts` files (e.g. `ApplicationStore.svelte.ts`).
- `tsconfig.json` sets `verbatimModuleSyntax: true` — type-only imports **must** use `import type`.
- `strict: true`, `isolatedModules: true`, `module: ESNext`, `moduleResolution: bundler`.
- Path alias: `"*": ["./src/*"]` in tsconfig (bare imports resolve to `src/`). Vitest also maps `@/` to `./src/`.
- Types automatically available: `obsidian-typings`, `@types/bun`, `vitest/globals`.
- `lib` includes `ES2021.WeakRef` — WeakRef is used in the codebase.

## Test setup

- Framework: **Vitest** + **jsdom** + `@testing-library/svelte`
- Setup: `src/testing/setupTests.ts` (polyfills `requestIdleCallback`, `matchMedia`, `ResizeObserver`, etc.)
- Pattern: `**/__tests__/**/*.test.ts`
- DOM/jsdom tests must use the `*.dom.test.ts` suffix (e.g. `CardPreview.dom.test.ts`). Pure unit tests use `*.test.ts`.
- `obsidian` is aliased to `src/testing/__mocks__/obsidianMocks.ts` during tests.
- Pool: `threads`. Coverage provider: `v8`.

## Repo layout

```
src/
  main.ts                    # Plugin entry (Obsidian Plugin class)
  cards/                    # Card models, lists, grids, interactions, and virtualization
  indexing/                 # Vault indexing and query state
  two-hop/                  # Two-hop resolution, display state, and UI
  card-preview/             # Card preview pipeline, rendering, and scheduling
  hover-popover/            # Obsidian hover-preview integration and Shadow DOM bridging
  search/                   # Search filtering and worker boundary
  settings/                 # Settings model, persistence, effects, and UI
  obsidian-integration/     # Obsidian integration, lifecycle, workspace, and custom-view hosts
  shared/                   # Feature-independent utilities and UI foundations
  testing/                  # Test setup, mocks, and architecture checks
```

- `src/testing/architecture/__tests__/featureOwnership.test.ts` enforces this layout: it fails if `application/`, `core/`, `features/`, `infrastructure/`, `presentation/`, `types/`, or `ui/` reappear, if shared constants land in `src/appConstants.ts`, or if a local `src/obsidian/` shadows the external `obsidian` package. Add new concepts to the owning feature directory instead of recreating a generic layer.
- Custom views: `TwoHopLinksPage`, `PreCreationView`, `TagNotesView`.
- Full-text search runs on demand on the main thread with cooperative time slicing.

## Code style

- EditorConfig: **tabs**, indent size 4, LF line endings, UTF-8.

## Shadow DOM styles

- Styles inside Shadow DOM are **not** defined in `styles.css`.
- Shadow DOM card render styles are defined in `src/cards/components/cardRenderShadowStyles.ts` (exported as `CARD_RENDER_SHADOW_CSS`).
- The Shadow DOM surface is created by `ensureCardRenderShadowSurface()` in `src/cards/components/cardRenderShadowSurface.ts`, which:
    - Calls `host.attachShadow({ mode: "open" })`
    - Injects `CARD_RENDER_SHADOW_CSS` into a `<style>` element inside the shadow root
    - Registers the shadow root with `mathShadowStyles.ts`: shared Temml `adoptedStyleSheets` only on Obsidian 1.14.0 (one sheet per Document), MathJax CSS syncing on all other versions
- Shadow DOM is used for rendering card link surfaces (virtual lists, virtual grids, view-plan flow lists) to isolate styles from the host document.

## Shadow DOM hover popovers

- Implementation lives in `src/hover-popover/shadow-hover/`. See that directory's `README.md` for architecture, mechanisms, and invariants.

## Release workflow

1. Update `minAppVersion` in `manifest.json` if needed.
2. Run `npm version patch/minor/major`. This reads `npm_package_version` env var and runs `version-bump.mjs` to sync `manifest.json` and `versions.json`.
3. Push the resulting tag.
4. CI (`.github/workflows/release.yml`) validates metadata, runs checks and tests, builds with Bun, attests the assets, and creates a **draft** release attaching `main.js` + `styles.css` + `manifest.json`.

> **Note**: `version-bump.mjs` reads `minAppVersion` from `manifest.json` to populate `versions.json` and fails before writing when the metadata is invalid.

## Common gotchas

- **Lifecycle**: The plugin mounts Svelte components into MarkdownViews via `MarkdownRenderChild`. Cleanup happens through `onunload()` of those children, not just Svelte `unmount`. Check `ComponentController.ts` before changing mount/unmount logic.
- **Patching**: The plugin monkey-patches Obsidian internals (Canvas, MarkdownView, Property, Workspace, GlobalSearch, Bookmark, PagePreview). Changes to patchers can have broad side effects.
- **Store caching**: `ComponentController` maintains an LRU of `ApplicationStore` instances keyed by `leafId:filePath`. Any change to store lifetime or keying must respect ref-counting and trimming logic.
- **Search**: Full-text matching must remain unique-file based, cancellable, and cooperatively time-sliced. Do not reintroduce a resident full-content index without profiling evidence.
- **Styles**: `styles.css` is shipped with the plugin; it uses CSS custom properties prefixed with `--ccl-`.
- **Shadow hover state**: See `src/hover-popover/shadow-hover/README.md` for the invariants (pure reducers, no parallel lifecycle/interaction fields).

## Command Output

Protect context usage. **Any command with unknown or potentially large output must be byte-capped.**

Default pattern:

```bash
COMMAND 2>&1 | head -c 8000
```

Test pattern:

```bash
COMMAND 2>&1 | tail -c 8000
```

When running tests (especially DOM tests), set a generous timeout. Tests involving jsdom, Svelte rendering, or worker communication can take longer than the default. (e.g. 300s)

---

### Coding style

Before modifying code, read and follow `.agents/CODING_STYLE.md`

- Minimize the scope of changes.
- Align with the existing design.
- Do not add unnecessary abstractions.
- Do not introduce new classes; express logic using functions first.
- Do not use `any`.
- Do not introduce new exceptions; represent failures using Result, null, or empty arrays.
- Add types and JSDoc to public APIs.

When writing code, first secure the boundaries with types, then implement using small functions. If in doubt, prefer file-scoped private helpers and explicit union types over adding abstractions. Code that is safe for LLMs is also safe for humans.

Always respond to users in Japanese.
