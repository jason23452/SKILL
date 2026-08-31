---
name: playwright-e2e-testing
description: "Framework-agnostic Playwright E2E testing skill for frontend web apps. Use when a project needs end-to-end tests, browser workflow tests, cross-browser checks, form/auth flows, route smoke tests, visual regression, CI E2E setup, Playwright config, or flaky E2E debugging across React, Vue, Nuxt, Next.js, SvelteKit, Astro, Angular, Vite, static sites, or any browser-rendered frontend."
---

# Playwright E2E Testing

## OpenCode Greenfield Bootstrap Metadata

This is a testing add-on for browser-rendered frontend projects. It supports every frontend framework and runs when E2E testing is selected or requested.

```opencode-bootstrap-json
{
  "role": "frontend",
  "category": "testing",
  "testing": "playwright",
  "frameworks": ["frontend", "web", "static", "vite", "react", "react-vite", "vue", "vue-vite", "nuxt", "nuxt4", "next", "nextjs", "svelte", "sveltekit", "astro", "angular"],
  "order": 40,
  "packageManager": "node",
  "scaffoldCommand": [
    "if test -f .opencode/skills/playwright-e2e-testing/scripts/bootstrap-01-01.cjs; then node .opencode/skills/playwright-e2e-testing/scripts/bootstrap-01-01.cjs; else node ${OPENCODE_PROJECT_SKILLS_PRESEEDED_DIR:-/app/.opencode/skills}/playwright-e2e-testing/scripts/bootstrap-01-01.cjs; fi",
    "if test -f .opencode/skills/playwright-e2e-testing/scripts/bootstrap-01-02.cjs; then node .opencode/skills/playwright-e2e-testing/scripts/bootstrap-01-02.cjs; else node ${OPENCODE_PROJECT_SKILLS_PRESEEDED_DIR:-/app/.opencode/skills}/playwright-e2e-testing/scripts/bootstrap-01-02.cjs; fi"
  ],
  "verificationCommands": [
    "if test -f .opencode/skills/playwright-e2e-testing/scripts/verify-list.cjs; then node .opencode/skills/playwright-e2e-testing/scripts/verify-list.cjs; else node ${OPENCODE_PROJECT_SKILLS_PRESEEDED_DIR:-/app/.opencode/skills}/playwright-e2e-testing/scripts/verify-list.cjs; fi"
  ]
}
```

## Scope

Use this skill to add or repair Playwright E2E testing only:

- install `@playwright/test` and browser binaries
- create or update `playwright.config.ts`
- add smoke, route, form, auth, API mock, visual, or regression tests
- add package scripts such as `e2e` and `e2e:list`
- debug flaky browser tests
- wire CI steps for Playwright

Keep framework setup, UI kits, API clients, backend services, database services, and Docker Compose in their own skills.

## Framework-Agnostic Rules

- Detect the target app from `package.json`, lockfiles, config files, and scripts.
- Prefer the app's existing dev/start script when it is reliable.
- For Nuxt projects in OpenCode Project Flow, prefer the `nuxt4-creater/scripts/runtime-smoke-sandbox.cjs` web server wrapper so Nuxt dev runs from a container-native temp directory instead of `/workspace`.
- Use `PLAYWRIGHT_WEB_SERVER_COMMAND` when the dev server needs custom startup.
- Use `PLAYWRIGHT_BASE_URL` when the app is already running or uses a custom URL.
- Keep tests user-observable: assert roles, labels, headings, URLs, visible text, and stable test ids.
- Keep selectors framework-neutral and assert user-visible behavior rather than React/Vue/Nuxt component internals.
- Use Playwright auto-wait, web-first assertions, `waitForURL`, and `waitForResponse` for synchronization.

## Default Project Layout

```text
playwright.config.ts
tests/
  home.spec.ts
  auth.spec.ts
  pages/
    LoginPage.ts
  fixtures/
    users.ts
```

Use the existing test folder if the project already has one.

## Config Pattern

Use a config that can run with any framework:

```ts
import { defineConfig, devices } from '@playwright/test'

const port = process.env.PLAYWRIGHT_PORT ?? '5173'
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html'], ['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: process.env.PLAYWRIGHT_WEB_SERVER_COMMAND ?? 'npm run dev',
    url: baseURL,
    timeout: 120000,
    reuseExistingServer: !process.env.CI,
  },
})
```

The bundled bootstrap script writes a richer version that detects Nuxt, Next.js, Vite, SvelteKit, Astro, Angular, and generic npm scripts.

## Test Pattern

```ts
import { expect, test } from '@playwright/test'

test('home page renders', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('body')).toBeVisible()
  await expect(page.locator('body')).not.toHaveText(/^\s*$/)
})
```

Prefer semantic locators:

```ts
await page.getByRole('button', { name: 'Submit' }).click()
await page.getByLabel('Email').fill('user@example.com')
await page.getByPlaceholder('Search').fill('invoice')
await page.getByTestId('user-menu').click()
```

## Package Manager

Use the lockfile to choose commands:

- `pnpm-lock.yaml`: `pnpm`
- `package-lock.json`: `npm`
- `yarn.lock`: `yarn`
- `bun.lock` or `bun.lockb`: `bun`

If the package manager is unclear, use the existing project scripts and lockfile convention. Default to npm only when no project signal exists.

## Verification

Run the most relevant commands:

```bash
pnpm e2e:list
pnpm e2e
npm run e2e:list
npm run e2e
yarn e2e:list
yarn e2e
bun run e2e:list
bun run e2e
```

For pnpm projects, prefer:

```bash
pnpm exec playwright test --list
pnpm exec playwright test
```

## Reporting

After applying this skill, report:

- package manager and framework detected
- Playwright config path
- test directory and created/updated specs
- base URL and web server command
- commands run and results
