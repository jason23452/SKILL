# Project UI Path Resolution

Use this resolver before installing a coss primitive or copying a primitive-reference snippet. A local coss component belongs to the frontend's established reusable UI layer, not to a literal alias directory and not automatically to `src/components/ui`.

## Resolution Order

1. Use an explicit path requested by the user.
2. Read `components.json`. Resolve `aliases.ui` first, or append `/ui` to `aliases.components` when only that alias exists.
3. Resolve the alias through `tsconfig.app.json`, `tsconfig.json`, or `jsconfig.json`, including aliases other than `@` and aliases rooted at the repository root.
4. Inspect existing shared locations and nearby imports. Prefer an established `ui`, `primitives`, `components/ui`, `shared/components`, `common/components`, `core/components`, `lib/components`, or `design-system` location.
5. If no convention exists, use `<source-root>/components/ui`. Detect the source root from path aliases and existing `src`, `app`, or client-source directories.

Do not infer a reusable location from a feature-local or route-local component directory. Those directories indicate ownership by that feature or route.

## Reference Placeholder

Primitive guides use `{{ui}}` only as an internal documentation placeholder:

```tsx
import { Button } from "{{ui}}/button"
```

Replace it before producing or editing project code. For example, if `components.json` contains `"ui": "@/shared/components/ui"`, write:

```tsx
import { Button } from "@/shared/components/ui/button"
```

Never create a `{{ui}}`, `@`, or `~` directory. These strings represent import aliases until resolved through project configuration.

## Consistency Check

Before finishing:

- component files exist under the resolved reusable UI directory
- imports use the same alias convention as nearby frontend code
- `components.json` aliases resolve to actual filesystem locations
- generated local imports resolve without a literal alias directory
- no unresolved `{{ui}}` placeholder remains in project files
