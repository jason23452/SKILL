---
name: coss
description: React UI kit skill for coss UI components. Use with React frontends when building UIs with coss primitives (buttons, dialogs, selects, forms, menus, tabs, inputs, toasts, etc.), installing components into an existing shared UI directory, migrating from shadcn/Radix to coss/Base UI, composing trigger-based overlays, or troubleshooting coss behavior. Works independently of any project-layout skill, resolves project aliases and reusable-component locations, and covers Tailwind CSS v4, accessibility, styling, and common pitfalls.
license: MIT
metadata:
  author: cosscom
---

# coss ui

## OpenCode Greenfield Bootstrap Metadata

This OpenCode-only metadata installs coss UI registry artifacts in an existing React frontend. It has no dependency on a separate framework or project-layout skill. Its Greenfield order runs after the frontend framework scaffold so established directories such as `src/shared/components` exist before placement is resolved. The rest of this file remains the official coss skill guidance and references.

Bootstrap is deliberately non-interactive: never run `shadcn init @coss/style` from Greenfield automation. The bundled script prepares Tailwind, aliases, and a CLI-valid `components.json`, then uses only official `shadcn add ... --yes --overwrite` registry commands. Before it installs components, it preserves an existing `components.json` UI location or detects the frontend's shared-component directory. `@` remains an import alias, never a standalone filesystem directory. It succeeds only when the official registry, generated primitive files, their local imports, and runtime dependencies are all present. The generated `coss-ui.json` records the installed component set so `--verify` can rerun that check without changing the project.

Registry specs such as `@coss/ui`, `@coss/colors-neutral`, `@coss/style`, `coss/ui`, and `coss/colors-neutral` are remote shadcn registry identifiers. Use the shadcn CLI and diagnose the actual CLI process, `package.json`, lockfile, and generated UI files.

```opencode-bootstrap-json
{
  "role": "frontend",
  "category": "ui-kit",
  "uiKit": "coss",
  "frameworks": ["react", "react-spa", "react-vite", "next", "nextjs", "remix"],
  "order": 15,
  "packageManager": "node",
  "scaffoldCommand": [
    "if test -f .opencode/skills/coss/scripts/coss-ui-bootstrap.cjs; then node .opencode/skills/coss/scripts/coss-ui-bootstrap.cjs; else node ${OPENCODE_PROJECT_SKILLS_PRESEEDED_DIR:-/app/.opencode/skills}/coss/scripts/coss-ui-bootstrap.cjs; fi"
  ],
  "verificationCommands": [
    "if test -f .opencode/skills/coss/scripts/coss-ui-bootstrap.cjs; then node .opencode/skills/coss/scripts/coss-ui-bootstrap.cjs --verify; else node ${OPENCODE_PROJECT_SKILLS_PRESEEDED_DIR:-/app/.opencode/skills}/coss/scripts/coss-ui-bootstrap.cjs --verify; fi"
  ]
}
```

coss ui is a component library built on Base UI with a shadcn-like developer experience plus a large particle catalog.

The coss skill owns its direct React UI dependencies: Tailwind CSS v4, `@base-ui/react`, `lucide-react`, `class-variance-authority`, `clsx`, and `tailwind-merge`. When the target project has a Vite config, it also installs `@tailwindcss/vite` and `vite-tsconfig-paths` so both Tailwind and detected TypeScript aliases resolve at runtime.

## What this skill is for

Use this skill to:

- pick the right coss primitive(s) for a UI task
- write correct coss usage code (imports, composition, props)
- apply coss/Base UI migration rules from shadcn/Radix assumptions
- reference particle examples to produce practical, production-like patterns

## Global Component File Placement

When a task requires creating or updating local coss component files, resolve the destination in this order: an explicit user path, `components.json` aliases, TypeScript/JavaScript path aliases, existing reusable UI/component directories, then the source-root fallback `components/ui/`. Inspect nearby imports to confirm the convention before writing. See `./references/project-paths.md` for the resolver contract.

Treat these as valid locations for globally reusable frontend components, resolving them under the project's source root when applicable:

- `app/components/` or `src/app/components/` for app-wide composition, providers, global modal/toast hosts, and application chrome.
- `shared/components/` or `src/shared/components/` for components reused across features.
- `shared/components/ui/` or `src/shared/components/ui/` for reusable coss primitives and project-level UI wrappers.
- `shared/components/layout/` or `src/shared/components/layout/` for reusable app shell and layout components.
- Existing `common/`, `core/`, `lib/`, or `design-system/` component directories when those are the project's established shared layer.

Do not place a globally reusable component inside a feature or route directory unless it is intentionally feature-specific. Keep generated imports aligned with the selected directory and the project's configured alias. Never treat `@`, `~`, or another import prefix as a filesystem directory.

Primitive references use `{{ui}}/<component>` as a documentation placeholder. Resolve `{{ui}}` to the selected project alias, such as `@/shared/components/ui`, `~/ui`, or `@design-system/primitives`, before writing code. Never emit `{{ui}}` into a project. Set `COSS_COMPONENTS` to a space- or comma-separated component list when only selected shared primitives are needed.

## Source of truth

- coss components docs: `apps/ui/content/docs/components/*.mdx`
  - `https://github.com/cosscom/coss/tree/main/apps/ui/content/docs/components`
- coss particle examples: `apps/ui/registry/default/particles/p-*.tsx`
  - `https://github.com/cosscom/coss/tree/main/apps/ui/registry/default/particles`
- coss particles catalog: `https://coss.com/ui/particles`
- docs map for agents: `https://coss.com/ui/llms.txt`

## Out of scope

- Maintaining coss monorepo internals/build pipelines.
- Editing registry internals unless explicitly requested.

## Principles for agent output

1. Use existing primitives and particles first before inventing custom markup.
2. Prefer composition over custom behavior reimplementation.
3. Follow coss naming and APIs from docs exactly.
4. Keep examples accessible and production-realistic.
5. Prefer concise code that mirrors coss docs/particles conventions.
6. Assume Tailwind CSS v4 conventions in coss examples and setup guidance.

## Critical usage rules

Always apply before returning coss code:

- Verify coss APIs against component docs first.
- For trigger-based primitives (Dialog, Menu, Select, Popover, Tooltip), follow each primitive's documented trigger/content hierarchy and composition API for that component.
- Preserve accessibility labels and error semantics.
- Consult primitive-specific guides for component invariants and edge cases.
- For manual install guidance, include all required dependencies and local component files referenced by imports.
- Prefer styled coss exports first; use `*Primitive` exports only when custom composition/styling requires it.

Rule references (read on demand when the task touches these areas):

- `./references/rules/styling.md` - Tailwind tokens, icon conventions, data-slot selectors
- `./references/rules/forms.md` - Field composition, validation, input patterns
- `./references/rules/composition.md` - Trigger/popup hierarchies, grouped controls
- `./references/rules/migration.md` - shadcn/Radix to coss/Base UI migration patterns
- `./references/project-paths.md` - project source root, shared UI directory, and import alias resolution
- `./references/portal-props.md` - optional `portalProps` on composed popups and toast providers (`keepMounted`, `container`, which surfaces support it)

## Component discovery

All 54 primitives have dedicated reference guides at `./references/primitives/<name>.md`. To find the right one for a task, consult the component registry index:

- `./references/component-registry.md`

## Usage workflow

1. Identify user intent (single primitive, composed flow, form flow, overlay flow, feedback flow).
2. Resolve the project's shared UI directory and import alias using `references/project-paths.md`.
3. Consult `references/component-registry.md` to identify candidate primitives.
4. Select primitives from coss docs first; compose project-local components for primitive coverage gaps.
5. Check at least one particle example for practical composition patterns. Particle files live at `apps/ui/registry/default/particles/p-<name>-N.tsx`.
6. Write minimal code using documented props and resolved project imports.
7. Self-check accessibility and composition invariants.

## Installation reference

See `./references/cli.md` for full install/discovery workflow.

Quick CLI pattern:

```bash
npx shadcn@latest add @coss/<component>
```

For automated bootstrap in an existing React frontend, use the metadata launcher above instead of `shadcn init`. It detects the source root, shared UI location, aliases, package manager, and Vite-specific setup when applicable, then calls the non-interactive `add` command. The official `init` command is appropriate only for a developer deliberately setting up a new project in an interactive terminal:

```bash
pnpm dlx shadcn@latest init @coss/style
```

For an existing project configured with `components.json`, the equivalent non-interactive CLI pattern is:

```bash
pnpm dlx shadcn@latest add @coss/ui --yes --overwrite
pnpm dlx shadcn@latest add @coss/ui @coss/colors-neutral --yes --overwrite
```

Quick manual pattern:

- install dependencies listed in the component docs page
- copy required component file(s)
- update imports to match the target app alias setup

## Primitive Guidance

Every primitive has a reference guide at `./references/primitives/<name>.md` with imports, minimal patterns, inline code examples, pitfalls, and particle references. Use the component registry to find the right file.

High-risk primitives (read these guides first -- they have the most composition gotchas):

- `./references/primitives/dialog.md` - modal overlays, form-in-dialog, responsive dialog/drawer
- `./references/primitives/menu.md` - dropdown actions, checkbox/radio items, submenus
- `./references/primitives/context-menu.md` - right-click/long-press menus at the pointer
- `./references/primitives/select.md` - items-first pattern, multiple, object values, groups
- `./references/primitives/form.md` - Field composition, validation, submission
- `./references/primitives/input-group.md` - addons, DOM order invariant, textarea layouts
- `./references/primitives/toast.md` - toastManager, anchored toasts, providers

## Output Checklist

Before returning code:

- imports and props match coss docs
- composition structure is valid for selected primitive(s)
- accessibility and explicit control types (`button`, `input`, etc.) are present
- migration-sensitive flows are verified (type/lint, keyboard/a11y behavior, and SSR-sensitive primitives like Select/Command)
