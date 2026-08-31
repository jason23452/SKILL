---
name: axios-token-baseurl-error
description: "Framework-aware frontend API client skill for Vite-based React SPA, Vite-based Vue SPA, and Nuxt. Use when a frontend project needs axios for Vite, Nuxt $fetch wrappers, an API client, dynamic parameter-based HTTP method calls, exported method helper functions, baseURL configuration, token or Authorization/Bearer headers, request hooks/interceptors, or normalized API error handling. Treat react-spa and vue-spa as Vite SPA aliases."
---

# Framework API Transport

## OpenCode Greenfield Bootstrap Metadata

```opencode-bootstrap-json
{
  "role": "frontend",
  "category": "api-client",
  "frameworks": ["frontend", "vite", "vite-spa", "react-spa", "react-vite", "vue-spa", "vue-vite", "nuxt", "nuxt-spa", "nuxt4"],
  "order": 20,
  "packageManager": "node",
  "scaffoldCommand": [
    "if test -f .opencode/skills/axios-token-baseurl-error/scripts/bootstrap-00-01.cjs; then node .opencode/skills/axios-token-baseurl-error/scripts/bootstrap-00-01.cjs; else node ${OPENCODE_PROJECT_SKILLS_PRESEEDED_DIR:-/app/.opencode/skills}/axios-token-baseurl-error/scripts/bootstrap-00-01.cjs; fi",
    "if test -f .opencode/skills/axios-token-baseurl-error/scripts/bootstrap-01-02.cjs; then node .opencode/skills/axios-token-baseurl-error/scripts/bootstrap-01-02.cjs; else node ${OPENCODE_PROJECT_SKILLS_PRESEEDED_DIR:-/app/.opencode/skills}/axios-token-baseurl-error/scripts/bootstrap-01-02.cjs; fi"
  ],
  "verificationCommands": []
}
```

## Purpose

Use this skill to add or repair the frontend HTTP foundation only:

- create or update one shared API transport client
- expose dynamic parameter-based HTTP methods such as `api.request({ method, url, query, body })`
- expose exported method helper functions such as `getApi(endpoint, query, body, config)`
- configure `baseURL`
- attach a token through `Authorization: Bearer <token>`
- normalize transport errors into one predictable app error shape
- keep endpoint calls inside the feature, page, store, composable, or domain module that owns the business behavior

Use Axios for Vite-based React SPA and Vue SPA projects. Use Nuxt's built-in `$fetch` for Nuxt projects. Treat `react-spa` and `vue-spa` as Vite SPA aliases.

Keep this skill focused on the transport layer. Place endpoint registries, CRUD helpers, service factories, and business-named API wrappers in the feature or domain module that owns the behavior.

## Folder-Agnostic Rule

Inspect the repository and choose the smallest API client location that matches the project:

1. Inspect the source architecture before choosing a path; do not assume `src/api`.
2. Reuse an existing custom Axios, `$fetch`, http, or request client file when it is clearly the project's transport client.
3. For shared/features based projects, use only `src/shared` + `src/features` or root `shared` + `features` as the layer signal. Put the generated transport in `src/shared/api` or `shared/api`, matching the repo root convention.
4. Keep business endpoint wrappers in `src/features/<feature-name>/api`, `features/<feature-name>/api`, service, hook, composable, or store modules owned by that feature.
5. Treat `app/` and `src/app/` as router/app composition. Do not choose app-layer folders as shared/features transport locations; use `src/shared/api` or `shared/api` instead.
6. For Nuxt with a root `app/` directory and no shared/features layout, create generated transport files in `app/utils/api` by default. For Nuxt/Nuxt-SPA projects using shared/features architecture, follow the `src/shared/api` or `shared/api` rule first.
7. For plain Vite SPA projects without shared/features layers, use the repo's existing API convention or fall back to `src/api`.

When documenting the result, report the chosen folder as "API client location".

## File Responsibilities

The chosen API client folder should contain only transport-level concerns:

- `client`: Axios instance for Vite projects, or `$fetch` wrapper for Nuxt projects; base URL, default JSON headers, and token hook.
- `token`: a replaceable token provider; safe for browser-only token storage and SSR environments.
- `errors`: Axios or `$fetch` error detection and app-level error normalization.
- `methods`: dynamic parameter-based generic HTTP methods for `request`, `response`, `get`, `post`, `put`, `patch`, and `delete`.
- `helpers`: exported method helper functions for framework scripts, hooks, composables, store modules, or feature modules.
- `types`: transport error payload and normalized error class/type.
- `index`: convenience exports for the transport modules.

The bootstrap script writes generated transport files in the selected API folder. Business-named endpoint wrappers stay in feature or domain modules.

Endpoint functions belong where the feature already lives. The dynamic method helpers handle transport calls. Examples:

- a React Vite SPA hook can call `api.request<Resource[]>({ method: 'GET', url: '/resources', query: { page: 1 } })` from the hook or feature API file
- a React Vite SPA component, hook, Zustand store, Redux thunk, or TanStack Query function can import `getApi`/`postApi` and pass dynamic arguments
- a Vue Vite SPA component, composable, or Pinia action can import `getApi`/`postApi` and pass dynamic arguments
- a Nuxt page or composable can call business-named API wrappers directly inside `useAsyncData`
- a store action can call `apiClient` from the store
- any framework script can import `getApi`, `postApi`, `putApi`, `patchApi`, or `deleteApi` and pass `endpoint`, `query`, `body`, and `config` dynamically

Keep endpoints close to the consumer. Follow the repository's existing domain API convention when it has one.

## Base URL

Prefer the project's existing runtime configuration. Common sources include:

- Vite env values such as `VITE_API_BASE_URL`
- Nuxt public runtime config values such as `runtimeConfig.public.apiBase`
- an existing app config module
- default `/api` for same-origin proxy/server routes

Resolve production hostnames and secrets from runtime configuration or environment variables.

## Token Handling

The transport client should depend on an auth-source-agnostic token provider.

Use a minimal default provider during bootstrap:

```ts
export type AccessTokenProvider = () => string | null | undefined

let accessTokenProvider: AccessTokenProvider = () => {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem('accessToken')
}

export function setAccessTokenProvider(provider: AccessTokenProvider) {
  accessTokenProvider = provider
}

export function getAccessToken() {
  return accessTokenProvider() || ''
}
```

When the project has auth state, cookies, session providers, Pinia/Zustand store modules, or framework runtime auth, wire `setAccessTokenProvider` to that source.

## Error Handling

Normalize transport errors at the boundary:

```ts
import axios from 'axios'
import { ApiError, type ApiErrorPayload } from './types'

export function normalizeApiError(error: unknown) {
  if (error instanceof ApiError) return error

  if (axios.isAxiosError<ApiErrorPayload>(error)) {
    const status = error.response?.status ?? 0
    const payload = error.response?.data

    return new ApiError({
      message: payload?.message ?? error.message ?? 'Request failed.',
      status,
      code: payload?.code ?? 'UNKNOWN_ERROR',
      details: payload ?? error.message,
    })
  }

  return new ApiError({
    message: 'Request failed.',
    details: error,
  })
}
```

For Nuxt `$fetch`, normalize the thrown fetch error shape in the same boundary. Prefer `response._data` or `data` as the API payload, and map `status`, `statusCode`, `message`, and `code` into `ApiError`.

Keep UI decisions such as toast, redirect, retry, loading state, and form error mapping in the hook, composable, store, or page layer.

## Client Shape

For Vite React/Vue projects, keep the Axios client small and composable:

```ts
import axios, { AxiosHeaders } from 'axios'
import { getAccessToken } from './token'

function resolveApiBaseUrl() {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env
  return env?.VITE_API_BASE_URL || '/api'
}

export const apiClient = axios.create({
  baseURL: resolveApiBaseUrl(),
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.request.use((config) => {
  const headers = AxiosHeaders.from(config.headers)
  const accessToken = getAccessToken()

  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)

  config.headers = headers
  return config
})
```

For Nuxt projects, wrap `$fetch`:

```ts
import { $fetch, useRuntimeConfig } from '#imports'
import { getAccessToken } from './token'

export type ApiFetchConfig = {
  headers?: HeadersInit
  signal?: AbortSignal
  timeout?: number
  credentials?: RequestCredentials
  baseURL?: string
  [key: string]: unknown
}

export function resolveApiBaseUrl() {
  const runtimeConfig = useRuntimeConfig()
  const publicConfig = runtimeConfig.public as Record<string, unknown>

  return String(publicConfig.apiBase || publicConfig.apiBaseUrl || '/api')
}

function withApiDefaults(config: ApiFetchConfig = {}) {
  const headers = new Headers(config.headers)
  const accessToken = getAccessToken()

  if (!headers.has('Accept')) headers.set('Accept', 'application/json')
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)

  return {
    ...config,
    baseURL: config.baseURL || resolveApiBaseUrl(),
    headers,
  }
}

export function apiClient<TResponse = unknown>(endpoint: string, config: ApiFetchConfig = {}) {
  return $fetch<TResponse>(endpoint, withApiDefaults(config))
}
```

## Dynamic Method Shape

Provide two transport-level call shapes.

Use parameter-object methods when the call site benefits from named fields:

```ts
import { api } from './methods'

const users = await api.request<User[]>({
  method: 'GET',
  url: '/users',
  query: { page: 1, status: 'active' },
  headers: { 'X-Request-Source': 'dashboard' },
})

const created = await api.post<User, { name: string }>('/users', undefined, {
  name: 'Ada',
})
```

Use `api.get<TResponse, TBody>(endpoint, query, body, config)` and the matching `post`, `put`, `patch`, and `delete` methods when call sites should pass arguments positionally. Use `api.response<T>({ method, url, ... })` or `api.getResponse<TResponse, TBody>(endpoint, query, body, config)` when callers need the full transport response. Use `config` for per-request options such as `signal`, `timeout`, `withCredentials`, `credentials`, or `headers`.

Use exported method helpers when a framework script, hook, composable, store, or feature API file should import a function and pass dynamic arguments:

```ts
import { getApi, putApi } from './helpers'

const users = await getApi<User[]>('/users', { page: 1 }, undefined, {
  signal,
  headers: { 'X-Request-Source': 'dashboard' },
})

const updated = await putApi<User, Partial<User>>('/users/1', undefined, { name: 'Ada' })
```

## Business API Wrappers

Use business-named API wrappers as a thin layer over the generated transport API. Keep the same argument order across Vite React, Vite Vue, and Nuxt:

```ts
endpoint, query, body, config
```

Place wrappers in the owning feature, domain, API, service, hook, or composable module. Import `ApiRequestConfig` and `QueryParams` from the generated API transport so the wrapper stays transport-agnostic across axios and `$fetch`.

```ts
import { api, type ApiRequestConfig, type QueryParams } from '@/api'

export function getUser<TResponse = User>(
  endpoint: string,
  query?: QueryParams,
  body?: unknown,
  config?: ApiRequestConfig,
) {
  return api.get<TResponse, unknown>(endpoint, query, body, config)
}

export function createUser<TResponse = User, TBody = Partial<User>>(
  endpoint: string,
  query?: QueryParams,
  body?: TBody,
  config?: ApiRequestConfig,
) {
  return api.post<TResponse, TBody>(endpoint, query, body, config)
}

export function updateUser<TResponse = User, TBody = Partial<User>>(
  endpoint: string,
  query?: QueryParams,
  body?: TBody,
  config?: ApiRequestConfig,
) {
  return api.put<TResponse, TBody>(endpoint, query, body, config)
}
```

Use the repository's import alias for the generated transport location:

```ts
import { api, type ApiRequestConfig, type QueryParams } from '~/utils/api'
```

Call business wrappers from pages, hooks, composables, store modules, and query functions:

```ts
const users = await getUser<User[]>('/users', { page: 1 })

const created = await createUser<User, Partial<User>>(
  '/users',
  undefined,
  { name: 'Ada' },
)
```

## React And Vue Vite SPA Usage

For `react-spa`, `react-vite`, `vue-spa`, and `vue-vite`, treat the project as Vite-based. Keep the generated API client in the repository's existing architecture: `src/shared/api` or `shared/api` for shared/features based projects, or the existing plain-SPA convention such as `src/api`, `src/lib/api`, or `src/services/api` when no shared/features layer exists. Do not put generated shared transport under `app/` or `src/app/` in shared/features based projects.

React hook or query function example:

```ts
import { getUser } from '@/features/users/api'

const users = await getUser<User[]>('/users', { page: 1 })
```

Vue composable or Pinia action example:

```ts
import { getUser, updateUser } from '@/features/users/api'

export function useUsersApi() {
  return {
    getUsers: (page = 1) => getUser<User[]>('/users', { page }),
    updateUserName: (id: string, name: string) =>
      updateUser<User, Partial<User>>(`/users/${id}`, undefined, { name }),
  }
}
```

Use `config` for SPA request cancellation, timeout, credentials, and adapter-specific options. Keep loading state, retry, query cache, toast, and form error mapping in the hook/composable/store layer rather than the transport module.

## Nuxt Data Fetching Integration

When this skill runs in a Nuxt project, generate `$fetch`-backed transport files and use Nuxt's built-in runtime fetch dependency.

For Nuxt, use business-named API wrappers from the owning API, service, or composable module.

Use direct `$fetch`-backed helpers for event-driven calls:

```ts
import { postApi } from '~/utils/api'

await postApi('/users', undefined, { name: 'Ada' })
```

When Nuxt page data should be loaded through a business-named wrapper, call that wrapper from `useAsyncData` at the page or composable boundary:

```ts
import { getUser } from '~/api/user'

const query = { page: 1 }

const { data, error, status, refresh } = await useAsyncData('users', () =>
  getUser<User[]>('/users', query)
)
```

When request cancellation matters, pass Nuxt's signal through the normal `config` argument:

```ts
import { getUser } from '~/api/user'

const { data, error, status } = await useAsyncData('users', (_nuxtApp, { signal }) =>
  getUser<User[]>('/users', { page: 1 }, undefined, { signal })
)
```

Provide a stable key for route data. Keep `useAsyncData` visible at the page or composable boundary, and keep the API wrapper shape as `api.get(endpoint, query, body, config)`. This keeps Nuxt's data-loading flow visible instead of hiding page data orchestration inside the transport layer.

## Reporting

After applying this skill, report:

1. API client location.
2. How `baseURL` is resolved.
3. How the token provider can be replaced by the app's auth source.
4. How errors are normalized.
5. How to use the dynamic parameter-based HTTP methods and exported method helper functions.
6. For Nuxt projects, how pages should call `useAsyncData('key', () => apiWrapper(...))`.
7. Project verification result from the repo's existing checks when available.

Report transport-level work. Mention business endpoint wrappers when the task changed them.

## Verification

This skill owns API client integration verification. Confirm that the transport wrapper, exported method helpers, token provider, base URL handling, and error normalization are wired into the project.

Use the repo's existing lint, typecheck, test, or framework verification commands when they are already defined by the project or framework skill. Keep project-wide build ownership in the framework scaffold skill metadata.
