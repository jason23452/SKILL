# coss CLI Reference (Focused)

Use this guide when installing, previewing, or discovering coss components via the shadcn CLI.

## CLI Safety Rules

- Always use the project's package runner:
  - `npx shadcn@latest ...`
  - `pnpm dlx shadcn@latest ...`
  - `bunx --bun shadcn@latest ...`
- Do not invent flags. Use only documented CLI flags.
- Never run `shadcn init @coss/style` in a non-interactive bootstrap. It can prompt for project choices. Use the bundled `coss-ui-bootstrap.cjs` script instead; it seeds `components.json` and uses `add --yes --overwrite`.
- Let the shadcn CLI finish normally. The official coss docs state that the CLI creates files and installs dependencies; do not kill it as soon as component files appear, because dependency installation may still be running.
- In React/Vite projects, coss owns the Tailwind prerequisite: install `tailwindcss` and `@tailwindcss/vite`, add the Vite plugin, and ensure the CSS entry imports `tailwindcss`.
- Verify runtime dependencies before declaring success. coss components commonly need `@base-ui/react`, `lucide-react`, `class-variance-authority`, `clsx`, and `tailwind-merge`.

## Core Commands for coss Usage

### Automated bootstrap path

For Greenfield and other unattended runs, invoke the bundled bootstrap script from the target frontend root. It configures Tailwind, aliases, and the coss registry before it calls only non-interactive `add` commands. When `src/shared/` exists, generated primitives are placed in `src/shared/components/ui/`.

```bash
COSS_COMPONENTS="button dialog toast" node .opencode/skills/coss/scripts/coss-ui-bootstrap.cjs
```

Omit `COSS_COMPONENTS` to add the full coss primitive set. The bootstrap metadata in `SKILL.md` provides the preseeded-skill fallback path used by OpenCode.

### Manual CLI paths

```bash
# New projects (recommended — includes Inter + Geist Mono fonts + full theme)
# Do not use this command in a bootstrap; it requires an interactive terminal.
npx shadcn@latest init @coss/style

# Existing projects - all primitives
npx shadcn@latest add @coss/ui --yes --overwrite

# Existing projects - full theme setup
npx shadcn@latest add @coss/style --yes --overwrite

# Existing projects - primitives + color tokens
npx shadcn@latest add @coss/ui @coss/colors-neutral --yes --overwrite
```

`@coss/style` automatically installs `@coss/fonts` (Inter for `--font-sans` and `--font-heading`, Geist Mono for `--font-mono`), which configures all three font variables in `layout.tsx`. No manual font wiring needed.

According to `https://coss.com/ui/docs/get-started`, the CLI installs dependencies for imported components. Manual fallback dependency installation is a recovery step for failed automation, not the primary install path.

### `add` (primary)

```bash
shadcn add @coss/<component>
```

Examples:

```bash
npx shadcn@latest add @coss/dialog
npx shadcn@latest add @coss/select
npx shadcn@latest add @coss/toast
```

### `add` preview mode (recommended)

```bash
npx shadcn@latest add @coss/dialog --dry-run
npx shadcn@latest add @coss/dialog --diff
npx shadcn@latest add @coss/dialog --view
```

Use preview mode when:

- user asks what will change
- component might already exist locally
- you need to inspect output before writing files

### Optional discovery helpers (use when available)

```bash
npx shadcn@latest search @coss -q "dialog"
npx shadcn@latest view @coss/dialog
npx shadcn@latest docs dialog
npx shadcn@latest info --json
```

If these are unsupported in the environment, use fallback sources below.

## Discovery Fallback Matrix

### Inside the coss repo (preferred)

- `apps/ui/registry/registry-particles.ts`
  - `https://github.com/cosscom/coss/blob/main/apps/ui/registry/registry-particles.ts`
- `apps/ui/registry.json`
  - `https://github.com/cosscom/coss/blob/main/apps/ui/registry.json`
- `apps/ui/content/docs/components/*.mdx`
  - `https://github.com/cosscom/coss/tree/main/apps/ui/content/docs/components`

### Outside the coss repo

- coss particles catalog: `https://coss.com/ui/particles`
- coss docs catalog: `https://coss.com/ui/`

## Manual Install Path

When users explicitly request manual setup:

1. Read the target component docs.
2. Install exactly the listed dependencies.
3. Copy all required files (including transitive local imports).
4. Adjust imports for target app aliases.
5. Validate the snippet against docs/particles patterns.

Important:

- CLI setup usually wires required theme tokens automatically.
- Manual setup must include required additional tokens (`destructive-foreground`, `info`, `success`, `warning` families) from coss styling docs when relevant.

## Quick Output Checklist

Before returning CLI guidance:

1. runner and command are valid for the user's package manager
2. flags are documented and intentional
3. fallback source is provided if CLI discovery commands are unavailable
4. resulting usage guidance matches coss docs and particles patterns
