---
name: zustand
description: React-only Zustand state management skill for React SPA Vite and Next.js projects. Use when adding, configuring, bootstrapping, or refactoring Zustand store modules, typed selectors, vanilla store factories, client providers, persistence boundaries, or migration from ad hoc React state to Zustand. Do not use for Vue, Nuxt, Svelte, Angular, Remix, React Native, or non-React state libraries.
---

# Zustand

## Scope

Use this skill for React framework projects only. It supports two targets:

- React SPA projects built with Vite.
- Next.js projects, including App Router and Pages Router.

Do not apply this skill to Vue, Nuxt, Svelte, Angular, Remix, React Native, or generic Vite projects without React evidence. A generic Vite project is not enough evidence; confirm it is a React SPA before using Zustand.

## OpenCode Greenfield Bootstrap Metadata

This skill is a frontend state add-on. Select it only after the primary frontend framework is known to be React SPA Vite or Next.js.

```opencode-bootstrap-json
{
  "role": "frontend",
  "category": "state",
  "state": "zustand",
  "frameworks": ["react", "react-spa", "react-vite", "next", "nextjs"],
  "order": 25,
  "packageManager": "node",
  "scaffoldCommand": [
    "if test -f .opencode/skills/zustand/scripts/bootstrap-00-install.cjs; then node .opencode/skills/zustand/scripts/bootstrap-00-install.cjs; else node ${OPENCODE_PROJECT_SKILLS_PRESEEDED_DIR:-/app/.opencode/skills}/zustand/scripts/bootstrap-00-install.cjs; fi",
    "if test -f .opencode/skills/zustand/scripts/bootstrap-01-config.cjs; then node .opencode/skills/zustand/scripts/bootstrap-01-config.cjs; else node ${OPENCODE_PROJECT_SKILLS_PRESEEDED_DIR:-/app/.opencode/skills}/zustand/scripts/bootstrap-01-config.cjs; fi"
  ],
  "verificationCommands": [
    "if test -f .opencode/skills/zustand/scripts/verify-zustand.cjs; then node .opencode/skills/zustand/scripts/verify-zustand.cjs; else node ${OPENCODE_PROJECT_SKILLS_PRESEEDED_DIR:-/app/.opencode/skills}/zustand/scripts/verify-zustand.cjs; fi"
  ]
}
```

## Workflow

1. Inspect `package.json`, lockfiles, framework config, and app entry files before editing.
2. Detect the target as React SPA Vite or Next.js. If detection is ambiguous, keep reading project files until React plus the supported target is confirmed.
3. Install `zustand` with the project's existing package manager.
4. Add store modules in the smallest existing state convention in the repo.
5. For Next.js, use a client provider and per-request vanilla store when server rendering, App Router, or React Server Components are present.
6. Run `scripts/verify-zustand.cjs`, then the repo's available `typecheck`, `lint`, `test`, or `build` commands.

## Target Detection

Treat a project as Next.js when it has a `next` dependency, `next.config.*`, `app/layout.*`, `src/app/layout.*`, `pages/_app.*`, or `src/pages/_app.*`.

Treat a project as React SPA Vite when it has React plus Vite evidence such as `vite.config.*`, `src/main.tsx`, `src/main.jsx`, and `react`/`vite` dependencies.

If a project has Vite but no React evidence, stop using this skill and select a state skill for the actual framework instead. If a project is React but not Vite or Next.js, stop using this skill.

## Package Manager

Choose the package manager from the lockfile or `packageManager` field:

- `pnpm-lock.yaml` or `packageManager: "pnpm@..."` -> `pnpm`
- `package-lock.json` or `packageManager: "npm@..."` -> `npm`
- `yarn.lock` or `packageManager: "yarn@..."` -> `yarn`
- `bun.lock` / `bun.lockb` or `packageManager: "bun@..."` -> `bun`

If no lockfile exists, prefer `pnpm` for greenfield work.

## React SPA Vite Integration

Install `zustand`. Zustand does not need a root provider in a plain React SPA; create hook-based store modules and import selectors where state is consumed.

Inspect the repo's actual source architecture before choosing a store path. Use the existing singular `store/` convention only when it matches the current layout. For a plain React Vite project without shared/features folders, use `src/store/`. For shared/features based React layouts, prefer the placement rules below.

### React Vite Feature-Based Placement

When the project follows a shared/features based layout with `features` and `shared` under `src/` or the repo root, place Zustand store files by ownership:

- `src/shared/store/` or `shared/store/`: shared state used across features, such as session view state, theme preference, command palette state, global drawers, route-independent selection, or other state consumed across multiple features. Use this as the bootstrap default for a starter shared store.
- `src/features/<feature-name>/store/` or `features/<feature-name>/store/`: state owned by one feature, such as cart state inside `features/cart`, profile-edit draft state inside `features/profile`, or filters for one feature's page set. Feature components, hooks, and router pages should import from their own feature store.
- `app/` or `src/app/`: router and app composition layer only in this architecture. Do not place shared state or generated starter stores under `app/store` or `src/app/store`.
- `src/store/` or `store/`: legacy or existing-project fallback. Do not create these in a fresh `react-vite-feature-based` scaffold unless the repo already uses them.

Keep feature boundaries one-way: `src/app` can compose features, features can use `src/shared`, and `src/shared` must not import from `src/features`.

Typed store example:

```ts
import { create } from 'zustand'

type SessionState = {
  accessToken: string
  isAuthenticated: boolean
  setAccessToken: (nextToken: string) => void
  resetSession: () => void
}

export const useSessionStore = create<SessionState>()((set) => ({
  accessToken: '',
  isAuthenticated: false,
  setAccessToken: (nextToken) =>
    set({
      accessToken: nextToken,
      isAuthenticated: nextToken.length > 0,
    }),
  resetSession: () => set({ accessToken: '', isAuthenticated: false }),
}))
```

Consume small selectors instead of subscribing to the whole store:

```tsx
const isAuthenticated = useSessionStore((state) => state.isAuthenticated)
const setAccessToken = useSessionStore((state) => state.setAccessToken)
```

## Next.js Integration

Use Zustand only from client components. Do not read or write Zustand state in React Server Components.

For Next.js projects that server-render, use a vanilla store factory plus a client provider so each request receives a fresh store instance. Do not define a mutable store as a shared module-level singleton for server-rendered Next.js state.

Store factory example:

```ts
import { createStore } from 'zustand/vanilla'

export type SessionState = {
  accessToken: string
  isAuthenticated: boolean
}

export type SessionActions = {
  setAccessToken: (nextToken: string) => void
  resetSession: () => void
}

export type SessionStore = SessionState & SessionActions

export const defaultInitState: SessionState = {
  accessToken: '',
  isAuthenticated: false,
}

export const createSessionStore = (initState: SessionState = defaultInitState) => {
  return createStore<SessionStore>()((set) => ({
    ...initState,
    setAccessToken: (nextToken) =>
      set({
        accessToken: nextToken,
        isAuthenticated: nextToken.length > 0,
      }),
    resetSession: () => set(defaultInitState),
  }))
}
```

Client provider example:

```tsx
'use client'

import { createContext, useContext, useRef } from 'react'
import type { ReactNode } from 'react'
import { useStore } from 'zustand'
import { createSessionStore } from '@/store/session-store'
import type { SessionStore } from '@/store/session-store'

type SessionStoreApi = ReturnType<typeof createSessionStore>

const SessionStoreContext = createContext<SessionStoreApi | undefined>(undefined)

export function SessionStoreProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<SessionStoreApi | null>(null)
  let store = storeRef.current

  if (store === null) {
    store = createSessionStore()
    storeRef.current = store
  }

  return (
    <SessionStoreContext.Provider value={store}>
      {children}
    </SessionStoreContext.Provider>
  )
}

export function useSessionStore<T>(selector: (store: SessionStore) => T): T {
  const store = useContext(SessionStoreContext)

  if (!store) {
    throw new Error('useSessionStore must be used within SessionStoreProvider')
  }

  return useStore(store, selector)
}
```

Wrap App Router `children` in the provider from `app/layout.*` or `src/app/layout.*`. For Pages Router, wrap `<Component {...pageProps} />` in `pages/_app.*` or `src/pages/_app.*`.

## Store Design Rules

Use Zustand for state that crosses component, route, or feature boundaries. Keep local UI state in the component when it is not shared.

Name store files by domain, not by widget: `auth-store.ts`, `session-store.ts`, `cart-store.ts`, `profile-store.ts`. Export `useXxxStore` from React SPA store files and `createXxxStore` plus a provider hook for Next.js store files.

For React Vite feature-based projects, choose the store path from the ownership rule before writing code:

- Cross-feature shared state -> `src/shared/store/<domain>-store.ts` or `shared/store/<domain>-store.ts`, matching the repo root convention.
- Single-feature state -> `src/features/<feature-name>/store/<domain>-store.ts` or `features/<feature-name>/store/<domain>-store.ts`, matching the repo root convention.
- Router/app composition state should stay local to `app` or `src/app` components unless it is shared across features; shared state still belongs in `shared/store` or `src/shared/store`.

Keep selectors small and stable. Do not destructure the whole store in components unless the component truly needs every field.

Keep derived values pure. Put asynchronous work and side effects in actions. Keep API transport details in the repo's API, hook, or service layer when such a layer exists, and call it from store actions.

Do not add `persist` middleware unless the user asks for persistence. If persistence is requested, persist only the smallest safe subset of state, avoid secrets in browser storage, and keep Next.js hydration behavior explicit.

## Scripts

- `scripts/bootstrap-00-install.cjs` installs `zustand` for React SPA Vite and Next.js projects.
- `scripts/bootstrap-01-config.cjs` creates a starter store. For Next.js, it also creates a client provider and wraps the canonical App Router layout or Pages Router app entry when found.
- `scripts/verify-zustand.cjs` verifies dependency, target support, and generated store/provider wiring.

## Reporting

After using this skill, report:

1. Detected target: React SPA Vite or Next.js.
2. Package manager and whether `zustand` was installed or already present.
3. Store directory used.
4. For Next.js, provider path and whether App Router layout or Pages Router `_app` was wrapped.
5. Verification commands and results.

Official references: `https://zustand.docs.pmnd.rs/`, `https://zustand.docs.pmnd.rs/learn/guides/nextjs`, `https://zustand.docs.pmnd.rs/learn/guides/beginner-typescript`, and `https://zustand.docs.pmnd.rs/reference/integrations/persisting-store-data`.
