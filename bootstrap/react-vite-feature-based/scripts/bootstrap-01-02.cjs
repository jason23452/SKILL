#!/usr/bin/env node

const fs = require("fs")
const path = require("path")

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content)
}

function stripJsonc(source) {
  return source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")
}

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"))
packageJson.scripts = {
  ...(packageJson.scripts || {}),
  dev: "vite --host 0.0.0.0",
  build: "tsc -b && vite build",
  preview: "vite preview --host 0.0.0.0",
}
fs.writeFileSync("package.json", JSON.stringify(packageJson, null, 2))

writeFile(
  "vite.config.ts",
  'import { defineConfig } from "vite";\nimport react from "@vitejs/plugin-react";\nimport { fileURLToPath, URL } from "node:url";\n\nexport default defineConfig({\n  plugins: [react()],\n  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },\n});\n',
)

const tsconfigApp = JSON.parse(stripJsonc(fs.readFileSync("tsconfig.app.json", "utf8")))
tsconfigApp.compilerOptions = {
  ...(tsconfigApp.compilerOptions || {}),
  ignoreDeprecations: "6.0",
  paths: {
    ...((tsconfigApp.compilerOptions || {}).paths || {}),
    "@/*": ["./src/*"],
  },
}
fs.writeFileSync("tsconfig.app.json", JSON.stringify(tsconfigApp, null, 2))

writeFile(
  "public/__opencode_health.txt",
  "ok\n",
)

writeFile(
  "src/index.css",
  ':root {\n  color: #0f172a;\n  background: #f8fafc;\n  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;\n}\n\n* {\n  box-sizing: border-box;\n}\n\nbody {\n  margin: 0;\n  min-width: 320px;\n  background: #f8fafc;\n}\n\n.app-shell {\n  min-height: 100vh;\n}\n\n.app-page {\n  min-height: 100vh;\n  padding: 3rem 1.5rem;\n}\n\n.app-panel {\n  max-width: 48rem;\n  margin: 0 auto;\n  border: 1px solid #e2e8f0;\n  border-radius: 0.75rem;\n  background: #ffffff;\n  padding: 2rem;\n  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);\n}\n\n.app-title {\n  margin: 0;\n  color: #0f172a;\n  font-size: clamp(2rem, 5vw, 3rem);\n  line-height: 1;\n}\n',
)
writeFile(
  "src/shared/components/layout/AppShell.tsx",
  'import type { ReactNode } from "react";\n\ntype AppShellProps = {\n  children: ReactNode;\n};\n\nexport function AppShell({ children }: AppShellProps) {\n  return <div className="app-shell">{children}</div>;\n}\n',
)
writeFile(
  "src/shared/components/ui/AppPanel.tsx",
  'import type { ReactNode } from "react";\n\ntype AppPanelProps = {\n  children: ReactNode;\n};\n\nexport function AppPanel({ children }: AppPanelProps) {\n  return <section className="app-panel">{children}</section>;\n}\n',
)
writeFile(
  "src/features/home/components/HomeIntro.tsx",
  'import { AppPanel } from "@/shared/components/ui/AppPanel";\n\nexport function HomeIntro() {\n  return (\n    <AppPanel>\n      <h1 className="app-title">Greenfield App</h1>\n    </AppPanel>\n  );\n}\n',
)
writeFile(
  "src/features/home/router/index.tsx",
  'import { HomeIntro } from "@/features/home/components/HomeIntro";\n\nexport const HOME_ROUTE_PATH = "/";\n\nexport function HomeRoute() {\n  return (\n    <main className="app-page">\n      <HomeIntro />\n    </main>\n  );\n}\n',
)
writeFile(
  "src/app/AppRouter.tsx",
  'import { HomeRoute } from "@/features/home/router";\nimport { AppShell } from "@/shared/components/layout/AppShell";\n\nexport function AppRouter() {\n  return (\n    <AppShell>\n      <HomeRoute />\n    </AppShell>\n  );\n}\n',
)
writeFile(
  "src/App.tsx",
  'import { AppRouter } from "./app/AppRouter";\n\nexport default function App() {\n  return <AppRouter />;\n}\n',
)

for (const dir of [
  "src/features/home/components",
  "src/features/home/hooks",
  "src/features/home/types",
  "src/features/home/assets",
  "src/shared/components/layout",
  "src/shared/components/ui",
  "src/shared/hooks",
  "src/shared/types",
  "src/shared/assets",
]) {
  fs.mkdirSync(dir, { recursive: true })
  writeFile(path.join(dir, ".gitkeep"), "")
}
