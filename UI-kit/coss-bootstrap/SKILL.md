---
name: coss-bootstrap
description: Bootstrap @coss/ui in an existing React Vite, Next.js, or Remix UI project. Use when installing COSS UI, adding all COSS primitives, choosing a shared UI component directory, detecting React Vite/Next/Remix project layout, or repairing COSS components.json aliases.
license: MIT
metadata:
  author: local
---

# COSS UI bootstrap

Use this companion skill to install official `@coss/ui` registry artifacts into
an existing React Vite, Next.js, or Remix UI project. It complements the official `coss` skill in the
sibling `../coss/` directory and does not replace or modify it.

## What it does

The bootstrap script:

1. Confirms the target is a React Vite, Next.js, or Remix UI project,
   and that Vite targets resolve the configured component aliases.
2. Resolves the source root and TypeScript/JavaScript aliases.
3. Chooses the reusable UI directory without creating literal alias folders.
4. Completes a compatible `components.json` and validates existing Tailwind v4
   and Vite alias readiness without rewriting Vite or framework configuration.
5. Resolves the complete official COSS registry dependency closure before
   invoking shadcn, and refuses every untracked output-file collision.
6. Installs with non-interactive shadcn commands, then verifies generated
   files, local imports, runtime dependencies, and matching `coss-ui.json`
   tracked-file and token-CSS fingerprints.

Run the script from the frontend project root, never from this skill catalog.

## OpenCode Greenfield Bootstrap Metadata

```opencode-bootstrap-json
{
  "role": "frontend",
  "category": "ui-kit",
  "uiKit": "coss",
  "frameworks": ["react-vite", "next", "nextjs", "remix"],
  "order": 15,
  "packageManager": "node",
  "scaffoldCommand": [
    "if test -f .opencode/skills/coss-bootstrap/scripts/coss-ui-bootstrap.cjs; then node .opencode/skills/coss-bootstrap/scripts/coss-ui-bootstrap.cjs; else node ${OPENCODE_PROJECT_SKILLS_PRESEEDED_DIR:-/app/.opencode/skills}/coss-bootstrap/scripts/coss-ui-bootstrap.cjs; fi"
  ],
  "verificationCommands": [
    "if test -f .opencode/skills/coss-bootstrap/scripts/coss-ui-bootstrap.cjs; then node .opencode/skills/coss-bootstrap/scripts/coss-ui-bootstrap.cjs --verify; else node ${OPENCODE_PROJECT_SKILLS_PRESEEDED_DIR:-/app/.opencode/skills}/coss-bootstrap/scripts/coss-ui-bootstrap.cjs --verify; fi"
  ],
  "runtimeSmokeCommand": "",
  "runtimeSmokeHealthUrl": ""
}
```

## Placement resolution

The script applies this precedence:

1. An existing usable `components.json` `aliases.ui` target.
2. An existing usable `components.json` `aliases.components` target, with
   `/ui` appended except for a direct shared component directory.
3. A configured TypeScript/JavaScript UI, primitive, component, or design-system alias.
4. An established reusable directory such as `shared/components`,
   `shared/components/ui`, `design-system/primitives`, or `components/ui`.
5. `<source-root>/components/ui` as the final fallback.

An existing `shared/components` directory is used directly, so COSS files go
to `src/shared/components` rather than a newly created `src/components/ui`.

Read `references/project-paths.md` for the complete resolver contract. The
script stores its full resolved registry set in `coss-ui.json`; rerun it with
`--verify` to validate without changing the target project.

## Installation

By default, the script installs all official COSS primitives plus neutral
color tokens:

```bash
node .opencode/skills/coss-bootstrap/scripts/coss-ui-bootstrap.cjs
```

Install selected primitives instead:

```bash
COSS_COMPONENTS="button dialog toast" node .opencode/skills/coss-bootstrap/scripts/coss-ui-bootstrap.cjs
```

## Rules

- Use only official `@coss/*` registry identifiers.
- Do not run the bootstrap in Vue, Nuxt, Svelte, Angular, or non-UI projects.
- Do not run it in an unconfigured plain React project; its bundler cannot be
  verified to resolve the generated aliases.
- Keep shared primitives out of feature- and route-local directories.
- Keep all generated files inside the current frontend project; external and
  symlinked alias targets are rejected, and no generated artifact, utility,
  config, or state file is read or written through a symlink.
- The bootstrap installs primitives and neutral tokens only. Use the official
  `coss` skill's style setup separately when a full theme is required.
- For React Vite projects, configure matching `resolve.alias` entries,
  `resolve.tsconfigPaths: true` on Vite 8+, or `vite-tsconfig-paths` before
  running the bootstrap.
- Use the official `coss` skill for component APIs, accessibility rules, and
  composition guidance after installation.
