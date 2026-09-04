# COSS Bootstrap Project Path Resolution

The COSS bootstrap resolves a reusable UI layer before it invokes the official
`@coss/*` shadcn registry. It always operates from the target frontend project
root.

## Supported project types

The bootstrap supports React Vite, Next.js, and Remix projects. It stops before
writing files when `package.json` does not identify a supported React UI
project. Plain React projects are rejected because the bootstrap cannot safely
verify their bundler aliases. React Vite projects must also resolve the
configured aliases through matching `resolve.alias` entries, Vite 8+
`resolve.tsconfigPaths`, or the `vite-tsconfig-paths` plugin.

## Resolution order

1. Use a valid `components.json` `aliases.ui` value.
2. Use a valid `components.json` `aliases.components` value with `/ui`.
3. Resolve configured TypeScript or JavaScript aliases.
   - `ui` and `primitives` aliases are used directly.
   - `components` and `design-system` aliases receive `/ui`.
4. Search existing reusable UI directories under the detected source root:
   - `shared/components/ui`, `common/components/ui`, `core/components/ui`
   - `lib/components/ui`, `design-system/components/ui`
   - `design-system/primitives`, `design-system/ui`, `components/ui`
   - `shared/primitives`, `common/primitives`, `core/primitives`
   - `lib/primitives`, `components/primitives`, `primitives`, `ui`
5. Search reusable component roots and append `/ui`.
6. If no convention exists, use `<source-root>/components/ui`.

The source root comes from an existing `@/*`, `~/*`, or `#/*` alias when
possible, then from `src`, `app`, or `client/src`.

## Safety rules

- Never create a literal `@`, `~`, or `#` folder.
- Preserve a valid existing `components.json` alias.
- Reject aliases that resolve outside the current project, including symlinked
  external targets.
- Refuse to write `tsconfig.json`, `jsconfig.json`, `components.json`, or
  `coss-ui.json` through a symlink.
- Reject any shared UI target or generated component file that traverses a
  symlink, including a symlink that remains inside the project but points at a
  route-local directory.
- Resolve aliases through `tsconfig.app.json`, `tsconfig.json`, and
  `jsconfig.json`, plus project-local `package.json#imports` mappings.
- Place reusable COSS primitives in a shared UI layer, never in a feature or
  route directory. In Next.js and Remix, nested `app`, `pages`, and `routes`
  segments are treated as route-local unless they begin with a shared-layer
  directory such as `components`, `shared`, or `design-system`.
- Verify that generated local imports resolve before reporting success.
- Expand every requested `@coss/*` item's transitive `@coss/*` registry
  dependencies before installation. Existing targets must match the tracked
  `coss-ui.json` file hashes or the bootstrap refuses to continue.
- Track the configured Tailwind CSS entry after installing neutral COSS tokens;
  verification rejects a changed, missing, external, or symlinked token CSS
  file.
