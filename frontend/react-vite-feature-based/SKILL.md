---
name: react-vite-feature-based
description: React + Vite feature-based frontend scaffold and maintenance skill. Use when creating or updating React/Vite projects with src/app, src/features, src/shared, routing, pages, components, hooks, types, assets, and feature-oriented refactors.
---

# React Vite Feature-Based

## OpenCode Greenfield Bootstrap Metadata

```opencode-bootstrap-json
{
  "role": "frontend",
  "category": "framework",
  "framework": "react-vite",
  "order": 10,
  "packageManager": "pnpm",
  "scaffoldCommand": [
    "pnpm create vite . --template react-ts --no-interactive",
    "if test -f .opencode/skills/react-vite-feature-based/scripts/bootstrap-01-02.cjs; then node .opencode/skills/react-vite-feature-based/scripts/bootstrap-01-02.cjs; else node ${OPENCODE_PROJECT_SKILLS_PRESEEDED_DIR:-/app/.opencode/skills}/react-vite-feature-based/scripts/bootstrap-01-02.cjs; fi",
    "if test -f .opencode/skills/react-vite-feature-based/scripts/bootstrap-01-03.cjs; then node .opencode/skills/react-vite-feature-based/scripts/bootstrap-01-03.cjs; else node ${OPENCODE_PROJECT_SKILLS_PRESEEDED_DIR:-/app/.opencode/skills}/react-vite-feature-based/scripts/bootstrap-01-03.cjs; fi",
    "if test -f .opencode/skills/react-vite-feature-based/scripts/bootstrap-00-pnpm-allow-builds.cjs; then node .opencode/skills/react-vite-feature-based/scripts/bootstrap-00-pnpm-allow-builds.cjs; else node ${OPENCODE_PROJECT_SKILLS_PRESEEDED_DIR:-/app/.opencode/skills}/react-vite-feature-based/scripts/bootstrap-00-pnpm-allow-builds.cjs; fi",
    "pnpm install --frozen-lockfile=false"
  ],
  "verificationCommands": [
    "pnpm build"
  ],
  "runtimeSmokeCommand": "if test -f .opencode/skills/react-vite-feature-based/scripts/runtime-smoke-sandbox.cjs; then node .opencode/skills/react-vite-feature-based/scripts/runtime-smoke-sandbox.cjs --cwd \"$PWD\" --port $PORT; else node ${OPENCODE_PROJECT_SKILLS_PRESEEDED_DIR:-/app/.opencode/skills}/react-vite-feature-based/scripts/runtime-smoke-sandbox.cjs --cwd \"$PWD\" --port $PORT; fi",
  "runtimeSmokeHealthUrl": "http://127.0.0.1:$PORT/__opencode_health.txt"
}
```

Runtime smoke in OpenCode Project Flow must use `scripts/runtime-smoke-sandbox.cjs`.
Do not run Vite dev directly from `/workspace` for smoke checks; Docker bind mounts can make dev-server readiness unreliable. The bootstrap script creates `public/__opencode_health.txt` so liveness does not depend on app rendering.

## Package Manager

Detect the package manager from the lockfile and keep using it:

- `pnpm-lock.yaml`: `pnpm`
- `package-lock.json`: `npm`
- `yarn.lock`: `yarn`
- `bun.lock` or `bun.lockb`: `bun`

For greenfield bootstrap, default to `pnpm`.

## Project Layout

Use this feature-based layout:

```text
src/
  app/
    AppRouter.tsx

  features/
    home/
      router/
        index.tsx
      components/
      hooks/
      types/
      assets/

    <feature-name>/
      router/
        index.tsx
        <child-route>/
          index.tsx
        [param]/
          index.tsx
      components/
      hooks/
      types/
      assets/

  shared/
    components/
      ui/
      layout/
    hooks/
    types/
    assets/

  App.tsx
  index.css
  main.tsx
```

Treat this folder layout as the fixed architecture contract. Keep the top-level ownership boundaries and route file shape stable unless the user explicitly asks for a different architecture.

Implementation details remain flexible. Adapt the router library, route config style, UI package, styling system, state management, data fetching, and component internals to the existing project.

## Architecture Invariants

Hardcode only these architecture rules:

- `src/app`, `src/features`, and `src/shared` ownership boundaries.
- `src/features/home/router/index.tsx` as the root route entry for `/`.
- Index-based route segment folders under `features/<feature-name>/router/`.
- `src/app/AppRouter.tsx` as the place that composes app-level shared chrome with feature router entries.
- `shared/components/ui/` for reusable primitives and wrappers; `shared/components/layout/` for reusable app chrome.

Keep these choices adaptable to the project:

- Router library and route object, JSX, or generated route style.
- UI package, styling system, state management, data fetching, and API client.
- Feature names other than `home`, route names, product copy, mock data, and business flows.
- Exact shared component slots, prop names, config shapes, and component internals.

## Required Root Feature

Always create and keep `src/features/home/router/index.tsx` as the root route entry.

```text
src/features/home/router/index.tsx -> "/"
```

The `home` feature folder name is an implementation feature name, not the URL path. Do not create `/home` for the default homepage unless the user explicitly asks for a separate `/home` route.

When the project uses a router library, map `/` to the route entry exported from `@/features/home/router` in `src/app/AppRouter.tsx`.

## Composition Rule

Build feature UI in three layers, in this order:

1. `shared/components/ui/` contains small, high-reuse UI components and UI kit wrappers.
2. `features/<feature-name>/components/` composes shared components into feature-specific components.
3. `features/<feature-name>/router/` composes feature components into route/page components.

Do not skip the feature component layer when a route renders feature-specific product UI. A route file should not become the place where global components are assembled directly into product UI. Put that product UI into feature components first, then compose those feature components in the route.

Route files may still render route-only glue directly, such as redirects, guards, suspense or error boundaries, loading fallbacks, simple param wiring, or a temporary placeholder while scaffolding.

Feature UI flow:

```text
shared/components/ui/Button.tsx
  -> features/<feature-name>/components/<Feature>Actions.tsx
  -> features/<feature-name>/router/index.tsx
  -> src/app/AppRouter.tsx
```

AppRouter composition flow:

```text
shared/components/layout/AppShell.tsx
  + features/<feature-name>/router/index.tsx
  -> src/app/AppRouter.tsx
```

`src/app/AppRouter.tsx` composes common app-level components with feature router entries. If a component is used by every route or wraps the entire route tree, compose it in `AppRouter.tsx`. Examples include app shell, root layout, global navigation, global footer, auth boundary, provider boundary, suspense boundary, error boundary, toast host, and global modal host.

This app-level rule does not replace the feature component layer. It only covers components that are genuinely shared by all routes or all routed pages.

## Component Identity and Naming

Every reusable React component uses a descriptive `PascalCase` component identity that communicates its domain and role. Apply this rule to components in `shared/components/ui/`, `shared/components/layout/`, and `features/<feature-name>/components/`.

- Keep the source filename, component identity, and same-name named export aligned for components reused across files, for example `ProjectFileTree.tsx` exporting `ProjectFileTree`.
- Use a named function or named const declaration for reusable or meaningful child components kept in the same file. Do not use anonymous components or wrappers when a component boundary is created.
- Do not use `Component`, `index`, `Panel`, or `Editor` as a feature component identity without a domain and role. Prefer names such as `WorkflowRunStatusBadge`, `UserSettingsModelsPanel`, or `AppActionMenu`.
- A route file may remain `index.tsx`, but its route component identity must still be descriptive, such as `HomeRoute` or `WorkspaceRoute`; `index` is a filename convention, not a component name.
- Existing shared primitives such as `Button`, `Dialog`, and `Card` may retain their stable public names and existing registry file naming convention. Add a domain-specific name to the feature or layout wrapper around a primitive when the wrapper has product responsibility.
- A framework- or root-required default export may remain default, but the default component must still have a descriptive name. Prefer named exports for reusable components across files.
- Aggregate files may contain multiple named components when they share an ownership boundary; name every React component and keep the primary component identity recognizable from the filename.
- Do not use `displayName`, a generic alias, or an anonymous wrapper to hide an unclear component identity. Name the component declaration instead.

## Component File Size Budget

When assembling component-heavy UI, keep each route, feature component, shared layout component, and shared UI wrapper within a practical `100-500` line budget whenever feasible.

- Treat `500` lines as the split threshold. If a component or route file grows past that, split it into feature sections, layout slots, smaller shared UI wrappers, hooks, data/config objects, or child components.
- Treat `100` lines as a soft target for meaningful assembled UI, not a minimum. Do not pad or over-split simple route glue, provider wrappers, placeholders, redirects, loading states, or tiny UI primitives just to reach 100 lines.
- Route files should stay thin even when under 500 lines. Move reusable cards, forms, tables, dashboards, panels, and product sections into `features/<feature-name>/components/` before composing them in `router/`.
- Shared layout components such as `AppShell`, `Sidebar`, `TopNav`, `PageFrame`, and modal hosts should also stay under 500 lines. Push repeated nav items, panel definitions, action lists, and empty-state copy into config arrays or smaller child components.
- If a feature requires many visual states, keep the component responsible for composition and move state derivation, formatting, fixture data, and reusable interaction logic into hooks, helpers, stores, or typed config owned by the same feature.

Persistent app chrome belongs in `shared/components/layout/`, not in a feature router. Examples include app sidebars, top bars, bottom composers/action bars, context or inspector panels, page frames, and global modal hosts that remain mounted while route content changes. Name promoted components by their app-level responsibility, for example `AppSidebar`, `AppTopbar`, `AppComposer`, `AppInspector`, or `AppPreviewDialog`, instead of retaining a feature-specific name.

For routes that share the same app chrome, mount the chrome once in `src/app/AppRouter.tsx` and switch only the feature route's main content. `AppShell` may expose named slots such as `sidebar`, `topNav`, `aside`, `composer`, `modalHost`, or `children`; pass shared layout components into those slots from `AppRouter.tsx`.

Keep `AppShell` itself generic: accept ReactNode slots, layout flags, callbacks, and configuration from the app boundary. Do not import feature route entries, feature components, feature mock data, route-specific state, or product copy inside the shell.

Keep shared layout components configurable with props, config arrays, slots, or component maps. Do not make shared layout components import feature mock data, feature route state, feature route entries, or feature-specific product components just to assemble themselves. Pass app-level data, labels, empty-state copy, and callbacks from `AppRouter.tsx`, a shared app store, or another app-level boundary instead.

Use this generality check before moving code into `shared/`:

- It can be reused without importing from `features/<feature-name>/`.
- It does not hardcode one feature route, one product flow, one project path, or one mock dataset.
- It accepts feature-specific text, data, navigation targets, and callbacks through props, slots, config, or context.
- It remains useful if the feature name changes.
- It can be tested or rendered with minimal fake data from outside the original feature.

## UI Kit Composition

When a project uses a UI package, compose that package through `shared/components/` by default:

- Put small, high-reuse components in `shared/components/ui/`, for example `Button`, `Input`, `IconButton`, `Select`, `Dialog`, `Tooltip`, and `Menu`.
- Wrap UI kit primitives in project-level `ui/` components before feature code uses them.
- Put reusable variant rules, style defaults, accessibility defaults, and common prop mapping in `shared/components/ui/`.
- Compose larger shared structures in `shared/components/layout/`, for example `AppShell`, `Sidebar`, `TopNav`, and `PageFrame`.
- Build layout components from `shared/components/ui/` and other shared utilities.
- Use config arrays, schemas, or component maps in shared components when common UI must be assembled dynamically.
- Keep raw UI kit imports mostly inside `shared/components/ui/` unless the existing codebase already follows a different local pattern.
- Feature components should import project-level shared components instead of raw UI kit primitives when the same UI pattern can be reused.

Example:

```text
ui-kit/Button + ui-kit/Menu
  -> shared/components/ui/AppActionMenu.tsx
  -> features/<feature-name>/components/<Feature>Actions.tsx
  -> features/<feature-name>/router/index.tsx

shared/components/ui/Button.tsx
  -> shared/components/layout/Sidebar.tsx
  -> src/app/AppRouter.tsx
```

## Directory Responsibilities

### `src/app/`

Use `src/app/` for application-level composition:

- `AppRouter.tsx` composes common app-level components with feature router entries.
- Import common app-level layout components from `shared/components/layout/`.
- Import feature route entries from `features/<feature-name>/router`.
- Always map the root path `/` to `@/features/home/router`.
- Keep cross-feature route registration here.
- Keep app-wide wrappers here, such as app shell, global navigation, providers, auth gates, suspense/error boundaries, toast hosts, and global modal hosts.
- Keep persistent app chrome here so route changes replace only the routed main content.
- If `AppRouter.tsx` needs UI that started inside a feature, promote and rename it into `shared/components/layout/` or `shared/components/ui/` first, then make it props, slot, or config driven.
- Do not import `features/<feature-name>/components/` directly into `AppRouter.tsx`; feature components must be assembled inside that feature's router entry first.
- Do not place feature-specific UI implementation here.

### `features/<feature-name>/router/`

Use `router/` for index-based route segment files:

- `router/index.tsx` is the feature root route.
- `router/<child-route>/index.tsx` is a static child route.
- `router/[param]/index.tsx` is a dynamic child route.
- Nested child routes continue the same folder pattern.
- Route params, search params, guards, loaders, redirects, and feature-local nested layout decisions.
- Keep persistent all-route chrome in `src/app/AppRouter.tsx` and `shared/components/layout/`.
- Composition of one or more components from `features/<feature-name>/components/`.
- Export route entries for `src/app/AppRouter.tsx` to compose.

Example:

```text
src/features/<feature-name>/router/index.tsx
src/features/<feature-name>/router/[id]/index.tsx
src/features/<feature-name>/router/settings/index.tsx
```

Keep route files thin. Reusable UI blocks, cards, forms, tables, and feature business sections belong in `components/`; move them there and import them into the route. Route files may keep route-only glue such as guards, redirects, loading fallbacks, simple param extraction, and child-route selection.

Prefer route imports like:

```text
import { FeatureHeader } from "@/features/<feature-name>/components/FeatureHeader"
import { FeatureActions } from "@/features/<feature-name>/components/FeatureActions"
```

Avoid route imports like this for feature product UI:

```ts
import { Button } from "@/shared/components/ui/Button"
```

If route content needs `Button` as part of feature UI, create or update a feature component that uses `Button`, then import that feature component into the route. Direct shared UI imports are acceptable for route-only fallback or shell glue.

### `features/<feature-name>/components/`

Use feature components for product UI that belongs to exactly one feature:

- Compose global/shared components into feature-specific sections.
- Keep feature copy, feature visual structure, feature forms, feature tables, and feature state presentation here.
- A feature component may import from `shared/components`, `shared/hooks`, `shared/types`, and its own feature folders.
- A feature component must not import from `router/`.

### `features/<feature-name>/hooks/`

Use feature hooks for behavior that belongs to exactly one feature. Move a hook to `shared/hooks/` when at least two features need it or when it is clearly app-wide from the start.

### `features/<feature-name>/types/`

Use feature types for data contracts owned by one feature. Move a type to `shared/types/` when it is truly cross-feature or app-wide.

### `features/<feature-name>/assets/`

Use feature assets for images, media, and static files used by one feature only.

### `shared/`

Use `shared/` for cross-feature building blocks:

- `shared/components/ui/`: small high-reuse UI components, UI kit wrappers, variants, defaults, and dynamic primitive composition.
- `shared/components/layout/`: larger shared layout components assembled from `shared/components/ui/`, such as app shell, app sidebar, app top nav, bottom composer/action bar, context or inspector panel, global preview dialog, and page frame.
- `shared/hooks/`: cross-feature hooks.
- `shared/types/`: cross-feature types.
- `shared/assets/`: cross-feature assets.

Do not place feature-specific product copy, business rules, route decisions, or one-off UI in `shared/`.
If only the outer shell is reusable, split the reusable shell into `shared/` and keep feature content inside `features/<feature-name>/components/`.

## Greenfield Bootstrap

When creating a new React/Vite project:

1. Use Vite React TypeScript scaffold.
2. Add the `@` import alias for `./src`.
3. Add TypeScript paths for `@/*`.
4. Create the feature-based folders.
5. Create `src/features/home/router/index.tsx` as the required root route entry for `/`.
6. Seed the example UI with the required composition flow:

```text
src/shared/components/layout/AppShell.tsx
  + src/features/home/router/index.tsx
  -> src/app/AppRouter.tsx

src/shared/components/ui/Button.tsx
  -> src/features/home/components/HomeActions.tsx
  -> src/features/home/router/index.tsx
```

`vite.config.ts` must include the alias:

```ts
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { fileURLToPath, URL } from "node:url"

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
})
```

`tsconfig.app.json` must include:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

## Update Workflow

When adding or refactoring UI:

1. Identify whether the code is app-global, reusable primitive UI, shared layout, feature-specific, or route-specific.
2. Put small reusable UI in `shared/components/ui/` and larger shared layout in `shared/components/layout/`.
3. For persistent all-route chrome, add or extend `AppShell` slots and pass shared layout components from `src/app/AppRouter.tsx`.
4. Put feature product UI in `features/<feature-name>/components/`.
5. Put route/page orchestration in `features/<feature-name>/router/`.
6. Export feature route entries from `features/<feature-name>/router`.
7. Compose common app-level components and feature router entries in `src/app/AppRouter.tsx`.
8. Update imports to use the `@` alias for cross-folder imports.
9. In the completion report, list each new or renamed component name, source path, one-line purpose or domain, and any retained default-export, aggregate-file, or shared-primitive exception.

## Naming

- Feature folder names use `kebab-case`.
- Static route segment folder names use `kebab-case`.
- Dynamic route segment folder names use bracket syntax, for example `[id]` or `[slug]`.
- Component and page files use `PascalCase.tsx`.
- Hook files use `useXxx.ts`.
- Route files are named `index.tsx`.
- Prefer route component exports with descriptive `PascalCase` names ending with `Route`, for example `<Feature>Route` or `<Feature><Param>Route`, unless the selected router library requires a different export convention.
- Rename components when promoting them out of a feature. Use app/shared names such as `AppSidebar`, `AppTopbar`, or `AppComposer` for persistent layout chrome, not the original feature name.

## Shared Promotion Rule

Move code from a feature folder to `shared/` only when:

1. At least two features use it, it wraps all routes, or it is clearly app-wide from the start.
2. It has no feature-specific copy, route knowledge, business rule, or mock dataset.
3. It does not import from `features/`.
4. It accepts feature-specific labels, data, navigation targets, callbacks, and children through props, config, slots, or context.
5. Its API is stable enough to be reused without pulling feature dependencies into `shared/`.

## Verification

After changes, run the package manager's build command:

```bash
pnpm build
npm run build
yarn build
bun run build
```

If the project has a lint script, run it too:

```bash
pnpm lint
npm run lint
yarn lint
bun run lint
```

For local runtime checks, start the dev server only when useful for the task and provide the local URL.
