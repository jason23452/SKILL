#!/usr/bin/env node

const assert = require("assert")
const cp = require("child_process")
const crypto = require("crypto")
const fs = require("fs")
const os = require("os")
const path = require("path")
const bootstrap = require("./coss-ui-bootstrap.cjs")

const skill = fs.readFileSync(path.join(__dirname, "..", "SKILL.md"), "utf8")
const metadataMatch = skill.match(/```opencode-bootstrap-json\s*([\s\S]*?)```/u)
assert.ok(metadataMatch, "SKILL.md must contain bootstrap metadata")
const bootstrapMetadata = JSON.parse(metadataMatch[1])
assert.strictEqual(bootstrapMetadata.role, "frontend")
assert.strictEqual(bootstrapMetadata.order, 15)
assert.strictEqual(bootstrapMetadata.runtimeSmokeCommand, "")
assert.strictEqual(bootstrapMetadata.runtimeSmokeHealthUrl, "")
assert.ok(bootstrapMetadata.scaffoldCommand[0].includes("coss-bootstrap/scripts/coss-ui-bootstrap.cjs"))
assert.ok(bootstrapMetadata.verificationCommands[0].includes("coss-bootstrap/scripts/coss-ui-bootstrap.cjs --verify"))

function writeJson(root, file, value) {
  const target = path.join(root, file)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`)
}

function readJson(root, file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"))
}

function withFixture(name, setup, verify) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `coss-${name}-`))
  const previousDirectory = process.cwd()

  try {
    setup(root)
    process.chdir(root)
    bootstrap.ensureProjectAliases()
    bootstrap.ensureComponentsConfig()
    verify(root, readJson(root, "components.json"))
  } finally {
    process.chdir(previousDirectory)
    fs.rmSync(root, { recursive: true, force: true })
  }
}

function withFixtureError(name, setup, verify) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `coss-${name}-`))
  const previousDirectory = process.cwd()

  try {
    setup(root)
    process.chdir(root)
    verify(root)
  } finally {
    process.chdir(previousDirectory)
    fs.rmSync(root, { recursive: true, force: true })
  }
}

async function withAsyncFixture(name, setup, verify) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `coss-${name}-`))
  const previousDirectory = process.cwd()

  try {
    const options = await setup(root)
    process.chdir(root)
    bootstrap.ensureProjectAliases()
    bootstrap.ensureComponentsConfig(options)
    await verify(root, readJson(root, "components.json"))
  } finally {
    process.chdir(previousDirectory)
    fs.rmSync(root, { recursive: true, force: true })
  }
}

withFixture("configured-ui", (root) => {
  writeJson(root, "tsconfig.json", {
    compilerOptions: {
      baseUrl: ".",
      paths: {
        "@/*": ["./app/*"],
        "@utils": ["./app/design-system/utils/cn.ts"],
      },
    },
  })
  writeJson(root, "components.json", {
    aliases: {
      components: "@/design-system",
      ui: "@/design-system/primitives",
      utils: "@utils",
      lib: "@/design-system/utils",
      hooks: "@/design-system/hooks",
    },
  })
}, (root, config) => {
  assert.strictEqual(config.aliases.ui, "@/design-system/primitives")
  assert.strictEqual(config.aliases.utils, "@utils")
  assert.strictEqual(config.style, "new-york")
  assert.strictEqual(config.tailwind.baseColor, "neutral")
  assert.strictEqual(config.iconLibrary, "lucide")
  assert.ok(fs.existsSync(path.join(root, "app", "design-system", "primitives")))
  assert.ok(fs.existsSync(path.join(root, "app", "design-system", "utils", "cn.ts")))
  assert.strictEqual(fs.existsSync(path.join(root, "@")), false)
})

withFixture("shared-components", (root) => {
  writeJson(root, "tsconfig.json", {
    compilerOptions: {
      baseUrl: ".",
      paths: { "@/*": ["./src/*"] },
    },
  })
  fs.mkdirSync(path.join(root, "src", "shared", "components"), { recursive: true })
}, (root, config) => {
  assert.strictEqual(config.aliases.ui, "@/shared/components")
  assert.strictEqual(config.aliases.components, "@/shared/components")
  assert.strictEqual(bootstrap.aliasToPath("@/"), "src")
  assert.ok(fs.existsSync(path.join(root, "src", "shared", "components")))
  assert.strictEqual(fs.existsSync(path.join(root, "src", "shared", "components", "ui")), false)
  assert.ok(fs.existsSync(path.join(root, "src", "shared", "lib", "utils.ts")))
  assert.strictEqual(fs.existsSync(path.join(root, "@")), false)
})

withFixture("shared-components-over-stale-default-aliases", (root) => {
  writeJson(root, "tsconfig.json", {
    compilerOptions: {
      baseUrl: ".",
      paths: { "@/*": ["./src/*"] },
    },
  })
  writeJson(root, "components.json", {
    aliases: {
      components: "@/components",
      ui: "@/components/ui",
    },
  })
  fs.mkdirSync(path.join(root, "src", "shared", "components"), { recursive: true })
  fs.mkdirSync(path.join(root, "src", "components", "ui"), { recursive: true })
  fs.writeFileSync(path.join(root, "src", "components", "ui", "legacy.tsx"), "export const Legacy = null\n")
}, (root, config) => {
  assert.strictEqual(config.aliases.components, "@/shared/components")
  assert.strictEqual(config.aliases.ui, "@/shared/components")
  assert.ok(fs.existsSync(path.join(root, "src", "components", "ui", "legacy.tsx")))
})

withFixture("nested-shared-ui-directory", (root) => {
  writeJson(root, "tsconfig.json", {
    compilerOptions: {
      baseUrl: ".",
      paths: { "@/*": ["./src/*"] },
    },
  })
  fs.mkdirSync(path.join(root, "src", "shared", "components", "ui"), { recursive: true })
}, (root, config) => {
  assert.strictEqual(config.aliases.ui, "@/shared/components/ui")
  assert.strictEqual(config.aliases.components, "@/shared/components")
  assert.ok(fs.existsSync(path.join(root, "src", "shared", "components", "ui")))
})

withFixture("bare-shared", (root) => {
  writeJson(root, "tsconfig.json", {
    compilerOptions: {
      baseUrl: ".",
      paths: { "@/*": ["./src/*"] },
    },
  })
  fs.mkdirSync(path.join(root, "src", "shared"), { recursive: true })
}, (root, config) => {
  assert.strictEqual(config.aliases.ui, "@/shared/components/ui")
  assert.ok(fs.existsSync(path.join(root, "src", "shared", "components", "ui")))
  assert.ok(fs.existsSync(path.join(root, "src", "shared", "lib", "utils.ts")))
})

withFixture("app-source-root", (root) => {
  writeJson(root, "tsconfig.json", {
    compilerOptions: {
      baseUrl: ".",
      paths: { "@/*": ["./app/*"] },
    },
  })
  fs.mkdirSync(path.join(root, "app", "common", "components"), { recursive: true })
}, (root, config) => {
  assert.strictEqual(config.aliases.ui, "@/common/components")
  assert.ok(fs.existsSync(path.join(root, "app", "common", "components")))
  assert.strictEqual(fs.existsSync(path.join(root, "app", "common", "components", "ui")), false)
  assert.ok(fs.existsSync(path.join(root, "app", "common", "lib", "utils.ts")))
  assert.strictEqual(fs.existsSync(path.join(root, "@")), false)
})

withFixture("root-alias", (root) => {
  fs.writeFileSync(path.join(root, "tsconfig.json"), [
    "{",
    '  "$schema": "https://json.schemastore.org/tsconfig",',
    "  // A root-level alias is common in Next.js projects.",
    '  "compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["./*"], }, },',
    "}",
    "",
  ].join("\n"))
  fs.mkdirSync(path.join(root, "components"), { recursive: true })
}, (root, config) => {
  assert.strictEqual(config.aliases.ui, "@/components/ui")
  assert.strictEqual(bootstrap.aliasToPath("@/"), ".")
  assert.ok(fs.existsSync(path.join(root, "components", "ui")))
  assert.ok(fs.existsSync(path.join(root, "lib", "utils.ts")))
  assert.strictEqual(fs.existsSync(path.join(root, "@")), false)
})

withFixture("custom-ui-alias", (root) => {
  writeJson(root, "tsconfig.json", {
    compilerOptions: {
      baseUrl: ".",
      paths: { "@ui/*": ["./client/design/primitives/*"] },
    },
  })
}, (root, config) => {
  assert.strictEqual(config.aliases.ui, "@ui")
  assert.strictEqual(config.aliases.components, "@ui")
  assert.strictEqual(config.aliases.utils, "@ui/lib/utils")
  assert.strictEqual(config.aliases.hooks, "@ui/hooks")
  assert.strictEqual(bootstrap.aliasToPath("@ui"), "client/design/primitives")
  assert.ok(fs.existsSync(path.join(root, "client", "design", "primitives")))
  assert.strictEqual(fs.existsSync(path.join(root, "@ui")), false)

  fs.writeFileSync(path.join(root, "client", "design", "primitives", "button.tsx"), [
    'import { missing } from "@ui/missing"',
    'import { DayPicker } from "@daypicker/react"',
    "export { missing }",
    "",
  ].join("\n"))
  assert.deepStrictEqual(
    bootstrap.missingProjectImports("client/design/primitives", ["button"]),
    ["button: @ui/missing"],
  )
  assert.deepStrictEqual(
    bootstrap.componentImportStatus("client/design/primitives", ["button"]).missingRuntimeDependencies,
    ["@daypicker/react"],
  )
})

withFixture("unresolved-alias", (root) => {
  writeJson(root, "tsconfig.json", {
    compilerOptions: {
      baseUrl: ".",
      paths: { "@/*": ["./src/*"] },
    },
  })
  writeJson(root, "components.json", {
    aliases: {
      components: "~design/components",
      ui: "~design/primitives",
    },
  })
  fs.mkdirSync(path.join(root, "src", "shared"), { recursive: true })
}, (root, config) => {
  assert.strictEqual(config.aliases.ui, "@/shared/components/ui")
  assert.strictEqual(config.aliases.components, "@/shared/components")
  assert.ok(fs.existsSync(path.join(root, "src", "shared", "components", "ui")))
  assert.strictEqual(fs.existsSync(path.join(root, "~design")), false)
})

withFixture("standalone", (root) => {
  fs.mkdirSync(path.join(root, "src", "components"), { recursive: true })
}, (root, config) => {
  const jsconfig = readJson(root, "jsconfig.json")
  assert.deepStrictEqual(jsconfig.compilerOptions.paths["@/*"], ["./src/*"])
  assert.strictEqual(config.aliases.ui, "@/components/ui")
  assert.ok(fs.existsSync(path.join(root, "src", "components", "ui")))
  assert.strictEqual(fs.existsSync(path.join(root, "@")), false)
})

withFixture("custom-root-alias", (root) => {
  writeJson(root, "tsconfig.json", {
    compilerOptions: {
      baseUrl: ".",
      paths: { "~/*": ["./frontend/*"] },
    },
  })
  fs.mkdirSync(path.join(root, "frontend", "shared"), { recursive: true })
}, (root, config) => {
  assert.strictEqual(config.aliases.ui, "~/shared/components/ui")
  assert.ok(fs.existsSync(path.join(root, "frontend", "shared", "components", "ui")))
  assert.strictEqual(fs.existsSync(path.join(root, "~")), false)
})

withFixture("existing-primitives", (root) => {
  writeJson(root, "tsconfig.json", {
    compilerOptions: {
      baseUrl: ".",
      paths: { "@/*": ["./src/*"] },
    },
  })
  fs.mkdirSync(path.join(root, "src", "design-system", "primitives"), { recursive: true })
}, (root, config) => {
  assert.strictEqual(config.aliases.ui, "@/design-system/primitives")
  assert.strictEqual(fs.existsSync(path.join(root, "src", "design-system", "components")), false)
})

withFixture("vite-project-references", (root) => {
  writeJson(root, "tsconfig.json", {
    files: [],
    references: [{ path: "./tsconfig.app.json" }],
  })
  writeJson(root, "tsconfig.app.json", {
    compilerOptions: { jsx: "react-jsx" },
    include: ["src"],
  })
  fs.mkdirSync(path.join(root, "src", "components"), { recursive: true })
}, (root) => {
  const rootConfig = readJson(root, "tsconfig.json")
  const appConfig = readJson(root, "tsconfig.app.json")
  assert.deepStrictEqual(rootConfig.compilerOptions.paths["@/*"], ["./src/*"])
  assert.deepStrictEqual(appConfig.compilerOptions.paths["@/*"], ["./src/*"])
})

withFixture("inherited-alias", (root) => {
  fs.mkdirSync(path.join(root, "configs"), { recursive: true })
  fs.writeFileSync(path.join(root, "configs", "tsconfig.paths.json"), [
    "{",
    '  "compilerOptions": {',
    '    "baseUrl": ".",',
    '    "paths": { "~/*": ["../frontend/*"], },',
    "  },",
    "}",
    "",
  ].join("\n"))
  writeJson(root, "tsconfig.json", { extends: "./configs/tsconfig.paths" })
  fs.mkdirSync(path.join(root, "frontend", "shared"), { recursive: true })
}, (root, config) => {
  assert.strictEqual(config.aliases.ui, "~/shared/components/ui")
  assert.ok(fs.existsSync(path.join(root, "frontend", "shared", "components", "ui")))
  assert.deepStrictEqual(readJson(root, "tsconfig.json"), { extends: "./configs/tsconfig.paths" })
})

withFixture("child-paths-override-parent", (root) => {
  fs.mkdirSync(path.join(root, "configs"), { recursive: true })
  fs.writeFileSync(path.join(root, "configs", "base.json"), JSON.stringify({
    compilerOptions: {
      baseUrl: ".",
      paths: { "@/*": ["../parent-src/*"] },
    },
  }, null, 2))
  writeJson(root, "tsconfig.json", {
    extends: "./configs/base.json",
    compilerOptions: {
      baseUrl: ".",
      paths: { "~/*": ["./client/*"] },
    },
  })
  fs.mkdirSync(path.join(root, "parent-src", "components"), { recursive: true })
  fs.mkdirSync(path.join(root, "client"), { recursive: true })
}, (root, config) => {
  assert.strictEqual(config.aliases.ui, "~/components/ui")
  assert.ok(fs.existsSync(path.join(root, "client", "components", "ui")))
  assert.strictEqual(fs.existsSync(path.join(root, "parent-src", "components", "ui")), false)
})

withFixture("preserve-inherited-nonroot-paths", (root) => {
  fs.mkdirSync(path.join(root, "configs"), { recursive: true })
  writeJson(root, "configs/base.json", {
    compilerOptions: {
      baseUrl: ".",
      paths: { "@components/*": ["../src/components/*"] },
    },
  })
  writeJson(root, "tsconfig.json", { extends: "./configs/base.json" })
  fs.mkdirSync(path.join(root, "src"), { recursive: true })
}, (root, config) => {
  const tsconfig = readJson(root, "tsconfig.json")
  assert.strictEqual(config.aliases.ui, "@components/ui")
  assert.strictEqual(tsconfig.compilerOptions.baseUrl, "./configs")
  assert.deepStrictEqual(tsconfig.compilerOptions.paths["@components/*"], ["../src/components/*"])
  assert.deepStrictEqual(tsconfig.compilerOptions.paths["@/*"], ["../src/*"])
})

withFixture("package-tsconfig-extends", (root) => {
  const base = path.join(root, "node_modules", "@scope", "base-config")
  fs.mkdirSync(base, { recursive: true })
  writeJson(root, "node_modules/@scope/base-config/package.json", { name: "@scope/base-config" })
  writeJson(root, "node_modules/@scope/base-config/tsconfig.json", {
    compilerOptions: {
      baseUrl: ".",
      paths: { "#/*": ["../../../frontend/*"] },
    },
  })
  writeJson(root, "tsconfig.json", { extends: "@scope/base-config/tsconfig.json" })
  fs.mkdirSync(path.join(root, "frontend"), { recursive: true })
}, (root, config) => {
  assert.strictEqual(config.aliases.ui, "#/components/ui")
  assert.ok(fs.existsSync(path.join(root, "frontend", "components", "ui")))
})

withFixture("path-fallback", (root) => {
  writeJson(root, "tsconfig.json", {
    compilerOptions: {
      baseUrl: ".",
      paths: { "@/*": ["./missing/*", "./src/*"] },
    },
  })
  fs.mkdirSync(path.join(root, "src", "shared"), { recursive: true })
}, (root, config) => {
  assert.strictEqual(config.aliases.ui, "@/shared/components/ui")
  assert.ok(fs.existsSync(path.join(root, "src", "shared", "components", "ui")))
  assert.strictEqual(fs.existsSync(path.join(root, "missing")), false)
})

withFixture("hash-ui-alias", (root) => {
  writeJson(root, "tsconfig.json", {
    compilerOptions: {
      baseUrl: ".",
      paths: { "#ui/*": ["./client/primitives/*"] },
    },
  })
}, (root, config) => {
  assert.strictEqual(config.aliases.ui, "#ui")
  assert.ok(fs.existsSync(path.join(root, "client", "primitives")))
  assert.strictEqual(fs.existsSync(path.join(root, "#ui")), false)
})

withFixture("tsconfig-ui-extension-alias", (root) => {
  writeJson(root, "tsconfig.json", {
    compilerOptions: {
      baseUrl: ".",
      paths: { "@ui/*": ["./src/shared/components/ui/*.tsx"] },
    },
  })
  fs.mkdirSync(path.join(root, "src"), { recursive: true })
}, (root, config) => {
  assert.strictEqual(config.aliases.ui, "@ui")
  assert.ok(fs.existsSync(path.join(root, "src", "shared", "components", "ui")))
  assert.deepStrictEqual(
    readJson(root, "tsconfig.json").compilerOptions.paths["@ui"],
    ["./src/shared/components/ui"],
  )
  assert.strictEqual(fs.existsSync(path.join(root, "@ui")), false)
})

withFixture("package-import-ui-alias", (root) => {
  writeJson(root, "package.json", {
    imports: { "#ui/*": "./src/shared/components/ui/*" },
  })
  fs.mkdirSync(path.join(root, "src"), { recursive: true })
}, (root, config) => {
  assert.strictEqual(config.aliases.ui, "#ui")
  assert.ok(fs.existsSync(path.join(root, "src", "shared", "components", "ui")))
  assert.strictEqual(fs.existsSync(path.join(root, "#ui")), false)
})

withFixture("package-import-ui-extension-alias", (root) => {
  writeJson(root, "package.json", {
    imports: { "#ui/*": "./src/shared/components/ui/*.tsx" },
  })
  fs.mkdirSync(path.join(root, "src"), { recursive: true })
}, (root, config) => {
  assert.strictEqual(config.aliases.ui, "#ui")
  assert.ok(fs.existsSync(path.join(root, "src", "shared", "components", "ui")))
  assert.strictEqual(fs.existsSync(path.join(root, "#ui")), false)
})

withFixture("feature-local-ui-alias", (root) => {
  writeJson(root, "tsconfig.json", {
    compilerOptions: {
      baseUrl: ".",
      paths: { "@/*": ["./src/*"] },
    },
  })
  writeJson(root, "components.json", {
    aliases: { ui: "@/features/auth/components/ui" },
  })
  fs.mkdirSync(path.join(root, "src", "features", "auth", "components", "ui"), { recursive: true })
}, (root, config) => {
  assert.strictEqual(config.aliases.ui, "@/components/ui")
  assert.ok(fs.existsSync(path.join(root, "src", "components", "ui")))
  assert.strictEqual(fs.existsSync(path.join(root, "src", "features", "auth", "components", "ui", "cn.ts")), false)
})

withFixture("next-route-local-ui-alias", (root) => {
  writeJson(root, "package.json", {
    dependencies: { next: "16.0.0", react: "19.0.0" },
  })
  writeJson(root, "tsconfig.json", {
    compilerOptions: {
      baseUrl: ".",
      paths: { "@/*": ["./src/*"] },
    },
  })
  writeJson(root, "components.json", {
    aliases: { ui: "@/app/dashboard/components/ui" },
  })
  fs.mkdirSync(path.join(root, "src", "app", "dashboard", "components", "ui"), { recursive: true })
}, (root, config) => {
  assert.strictEqual(config.aliases.ui, "@/app/components/ui")
  assert.ok(fs.existsSync(path.join(root, "src", "app", "components", "ui")))
  assert.strictEqual(fs.existsSync(path.join(root, "src", "app", "dashboard", "components", "ui", "cn.ts")), false)
})

withFixture("external-ui-alias", (root) => {
  writeJson(root, "tsconfig.json", {
    compilerOptions: {
      baseUrl: ".",
      paths: { "@/*": ["./src/*"] },
    },
  })
  writeJson(root, "components.json", {
    aliases: { ui: "@/../../outside/components/ui" },
  })
  fs.mkdirSync(path.join(root, "src"), { recursive: true })
}, (root, config) => {
  assert.strictEqual(config.aliases.ui, "@/components/ui")
  assert.ok(fs.existsSync(path.join(root, "src", "components", "ui")))
  assert.strictEqual(fs.existsSync(path.join(root, "..", "outside", "components", "ui")), false)
})

let symlinkFixtureAvailable = false
let symlinkFixtureTarget = ""
withFixtureError("symlinked-components-config", (root) => {
  writeJson(root, "package.json", { dependencies: { react: "19.0.0" } })
  writeJson(root, "tsconfig.json", {
    compilerOptions: {
      baseUrl: ".",
      paths: { "@/*": ["./src/*"] },
    },
  })
  try {
    const externalTarget = path.join(os.tmpdir(), `coss-${path.basename(root)}-components.json`)
    fs.symlinkSync(externalTarget, path.join(root, "components.json"), "file")
    symlinkFixtureAvailable = true
    symlinkFixtureTarget = externalTarget
  } catch (error) {
    if (!error || error.code !== "EPERM") throw error
  }
}, () => {
  if (!symlinkFixtureAvailable) return
  const script = path.join(__dirname, "coss-ui-bootstrap.cjs")
  const result = cp.spawnSync(process.execPath, [script], { cwd: process.cwd(), encoding: "utf8" })
  assert.strictEqual(result.status, 1)
  assert.match(result.stderr, /refuses to write components\.json through a symlink/u)
  assert.strictEqual(fs.existsSync(symlinkFixtureTarget), false)
  bootstrap.ensureProjectAliases()
  assert.throws(() => bootstrap.ensureComponentsConfig(), /refuses to write components\.json through a symlink/u)
})

withFixture("root-components-with-src", (root) => {
  fs.mkdirSync(path.join(root, "src"), { recursive: true })
  fs.mkdirSync(path.join(root, "components", "ui"), { recursive: true })
}, (root, config) => {
  assert.strictEqual(config.aliases.ui, "@/components/ui")
  assert.ok(fs.existsSync(path.join(root, "components", "ui")))
  assert.ok(fs.existsSync(path.join(root, "src", "components", "ui")))
})

let routeSymlinkFixtureAvailable = false
withFixtureError("route-symlink-ui-directory", (root) => {
  writeJson(root, "package.json", { dependencies: { next: "16.0.0", react: "19.0.0" } })
  writeJson(root, "tsconfig.json", {
    compilerOptions: {
      baseUrl: ".",
      paths: { "@/*": ["./src/*"] },
    },
  })
  const routeUi = path.join(root, "src", "app", "dashboard", "components", "ui")
  const sharedUi = path.join(root, "src", "components", "ui")
  fs.mkdirSync(routeUi, { recursive: true })
  fs.mkdirSync(path.dirname(sharedUi), { recursive: true })
  try {
    fs.symlinkSync(routeUi, sharedUi, "junction")
    routeSymlinkFixtureAvailable = true
  } catch (error) {
    if (!error || !["EACCES", "EPERM"].includes(error.code)) throw error
  }
}, () => {
  if (!routeSymlinkFixtureAvailable) return
  bootstrap.ensureProjectAliases()
  assert.throws(
    () => bootstrap.ensureComponentsConfig(),
    /could not resolve a project-local shared UI directory/u,
  )
})

withFixture("bare-primitives", (root) => {
  writeJson(root, "tsconfig.json", {
    compilerOptions: {
      baseUrl: ".",
      paths: { "@/*": ["./src/*"] },
    },
  })
  fs.mkdirSync(path.join(root, "src", "primitives"), { recursive: true })
}, (root, config) => {
  assert.strictEqual(config.aliases.ui, "@/primitives")
  assert.strictEqual(fs.existsSync(path.join(root, "src", "components")), false)
})

withFixture("root-ui-alias", (root) => {
  writeJson(root, "tsconfig.json", {
    compilerOptions: {
      baseUrl: ".",
      paths: { "@ui/*": ["./*"] },
    },
  })
  writeJson(root, "components.json", {
    aliases: {
      components: "@ui",
      ui: "@ui",
    },
  })
}, (root, config) => {
  assert.strictEqual(config.aliases.ui, "@ui")
  assert.strictEqual(bootstrap.aliasToPath("@ui"), ".")
  assert.strictEqual(fs.existsSync(path.join(root, "@ui")), false)
})

withFixture("project-types", (root) => {
  writeJson(root, "package.json", {
    dependencies: { react: "19.0.0", vite: "6.0.0" },
    devDependencies: { "@vitejs/plugin-react": "4.0.0" },
  })
  fs.writeFileSync(path.join(root, "vite.config.ts"), "export default {}\n")
  fs.mkdirSync(path.join(root, "src"), { recursive: true })
}, (_root) => {
  assert.strictEqual(bootstrap.detectUiProjectType(), "react-vite")
  const aliases = readJson(_root, "components.json").aliases
  assert.strictEqual(
    bootstrap.viteAliasesHaveRuntimeResolver({
      resolve: { alias: [{ find: "@", replacement: path.join(_root, "src") }] },
      plugins: [],
    }, aliases),
    true,
  )
  assert.strictEqual(
    bootstrap.viteAliasesHaveRuntimeResolver({ resolve: { alias: [] }, plugins: [] }, aliases),
    false,
  )
  assert.strictEqual(
    bootstrap.viteAliasesHaveRuntimeResolver({ resolve: { alias: [] }, plugins: [{ name: "vite-tsconfig-paths" }] }, aliases),
    true,
  )
  assert.strictEqual(
    bootstrap.viteAliasesHaveRuntimeResolver({
      resolve: { alias: [{ find: /^@\//u, replacement: `${path.join(_root, "src")}${path.sep}` }] },
      plugins: [],
    }, aliases),
    true,
  )
  assert.strictEqual(
    bootstrap.viteAliasesHaveRuntimeResolver({ resolve: { alias: [], tsconfigPaths: true }, plugins: [] }, aliases),
    false,
  )
})

withFixture("yarn-classic-command", (root) => {
  writeJson(root, "package.json", { packageManager: "yarn@1.22.22" })
}, (_root) => {
  assert.deepStrictEqual(
    bootstrap.shadcnCommand("yarn", ["@coss/ui"]),
    ["npx", ["--yes", "shadcn@latest", "add", "@coss/ui", "--yes"]],
  )
})

withFixture("yarn-berry-command", (root) => {
  writeJson(root, "package.json", { packageManager: "yarn@4.6.0" })
}, (_root) => {
  assert.deepStrictEqual(
    bootstrap.shadcnCommand("yarn", ["@coss/ui"]),
    ["yarn", ["dlx", "shadcn@latest", "add", "@coss/ui", "--yes"]],
  )
})

withFixture("plain-react-requires-runtime-alias", (root) => {
  writeJson(root, "package.json", { dependencies: { react: "19.0.0" } })
}, (_root) => {
  assert.throws(
    () => bootstrap.assertSupportedUiProject(),
    /requires a verified runtime alias resolver/u,
  )
})

withFixture("vite-runtime-alias-check", (root) => {
  writeJson(root, "package.json", {
    dependencies: { react: "19.0.0", tailwindcss: "4.0.0", vite: "6.0.0" },
  })
  writeJson(root, "tsconfig.json", {
    compilerOptions: {
      baseUrl: ".",
      paths: { "@/*": ["./src/*"] },
    },
  })
  fs.writeFileSync(path.join(root, "vite.config.ts"), "export default {}\n")
  fs.mkdirSync(path.join(root, "src", "components"), { recursive: true })
  fs.writeFileSync(path.join(root, "src", "index.css"), '@import "tailwindcss";\n')
}, (root) => {
  const vitePackage = path.join(root, "node_modules", "vite", "package.json")
  const viteModule = path.join(root, "node_modules", "vite", "index.js")
  fs.mkdirSync(path.dirname(viteModule), { recursive: true })
  writeJson(root, path.relative(root, vitePackage), { type: "module", exports: "./index.js" })
  fs.writeFileSync(viteModule, [
    "export async function resolveConfig() {",
    "  return { resolve: { alias: [] }, plugins: [] }",
    "}",
    "",
  ].join("\n"))

  const script = path.join(__dirname, "coss-ui-bootstrap.cjs")
  const unresolved = cp.spawnSync(process.execPath, [script, "--verify"], { cwd: root, encoding: "utf8" })
  assert.strictEqual(unresolved.status, 1)
  assert.match(unresolved.stderr, /requires Vite to resolve the configured component aliases/u)

})

withFixture("vite-8-tsconfig-paths", (root) => {
  writeJson(root, "package.json", {
    dependencies: { react: "19.0.0", vite: "8.0.0" },
  })
  writeJson(root, "tsconfig.json", {
    compilerOptions: {
      baseUrl: ".",
      paths: { "@/*": ["./src/*"] },
    },
  })
  fs.mkdirSync(path.join(root, "src"), { recursive: true })
}, (root) => {
  const aliases = readJson(root, "components.json").aliases
  assert.strictEqual(
    bootstrap.viteAliasesHaveRuntimeResolver({ resolve: { alias: [], tsconfigPaths: true }, plugins: [] }, aliases),
    true,
  )
})

withFixture("next-project", (root) => {
  writeJson(root, "package.json", {
    dependencies: { next: "16.0.0", react: "19.0.0" },
  })
  fs.mkdirSync(path.join(root, "app"), { recursive: true })
}, (_root) => {
  assert.strictEqual(bootstrap.detectUiProjectType(), "next")
})

withFixture("remix-project", (root) => {
  writeJson(root, "package.json", {
    dependencies: { "@remix-run/react": "2.0.0", react: "18.0.0" },
  })
  fs.mkdirSync(path.join(root, "app"), { recursive: true })
}, (_root) => {
  assert.strictEqual(bootstrap.detectUiProjectType(), "remix")
})

withFixture("unsupported-project", (root) => {
  writeJson(root, "package.json", {
    dependencies: { vue: "3.0.0" },
  })
  fs.mkdirSync(path.join(root, "src"), { recursive: true })
}, (_root) => {
  assert.strictEqual(bootstrap.detectUiProjectType(), "")
})

async function runAsyncTests() {
  await withAsyncFixture("registry-dependency-closure", (root) => {
    writeJson(root, "tsconfig.json", {
      compilerOptions: {
        baseUrl: ".",
        paths: { "@/*": ["./src/*"] },
      },
    })
    fs.mkdirSync(path.join(root, "src"), { recursive: true })
    fs.writeFileSync(path.join(root, "src", "index.css"), '@import "tailwindcss";\n')
    return { deferUtility: true }
  }, async (root) => {
    const registry = {
      "colors-neutral": { name: "colors-neutral", type: "registry:style", cssVars: { light: { background: "white" } } },
      button: {
        name: "button",
        type: "registry:ui",
        dependencies: ["@base-ui/react"],
        files: [{ path: "registry/default/ui/button.tsx", type: "registry:ui", content: "export const Button = null\n" }],
      },
      "scroll-area": {
        name: "scroll-area",
        type: "registry:ui",
        files: [{ path: "registry/default/ui/scroll-area.tsx", type: "registry:ui", content: "export const ScrollArea = null\n" }],
      },
      dialog: {
        name: "dialog",
        type: "registry:ui",
        registryDependencies: ["@coss/button", "@coss/scroll-area"],
        files: [{ path: "registry/default/ui/dialog.tsx", type: "registry:ui", content: "export const Dialog = null\n" }],
      },
      tabs: {
        name: "tabs",
        type: "registry:ui",
        registryDependencies: ["@coss/segmented-control"],
        files: [{ path: "registry/default/ui/tabs.tsx", type: "registry:ui", content: "export const Tabs = null\n" }],
      },
      "segmented-control": {
        name: "segmented-control",
        type: "registry:lib",
        files: [{ path: "registry/default/lib/segmented-control.ts", type: "registry:lib", content: "export const segmented = null\n" }],
      },
      utils: {
        name: "utils",
        type: "registry:lib",
        files: [{ path: "registry/default/lib/utils.ts", type: "registry:lib", content: "export const cn = null\n" }],
      },
    }
    const plan = await bootstrap.resolveCossInstallPlan(["dialog", "tabs"], async (name) => registry[name])
    assert.strictEqual(plan.changesCss, true)
    assert.deepStrictEqual(plan.registryItems, ["button", "colors-neutral", "dialog", "scroll-area", "segmented-control", "tabs", "utils"])
    assert.deepStrictEqual(
      plan.artifacts.map((artifact) => artifact.target),
      [
        "src/components/ui/button.tsx",
        "src/components/ui/dialog.tsx",
        "src/components/ui/scroll-area.tsx",
        "src/components/ui/tabs.tsx",
        "src/lib/segmented-control.ts",
        "src/lib/utils.ts",
      ],
    )

    const button = path.join(root, "src", "components", "ui", "button.tsx")
    fs.writeFileSync(button, "export const Button = 'custom'\n")
    assert.throws(
      () => bootstrap.assertNoArtifactConflicts(plan),
      /refuses to install over existing untracked registry files/u,
    )
    fs.rmSync(button)

    for (const artifact of plan.artifacts) {
      const file = path.join(root, artifact.target)
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, `export const ${artifact.item.replaceAll("-", "")} = null\n`)
    }
    writeJson(root, "coss-ui.json", {
      version: 2,
      roots: plan.roots,
      registryItems: plan.registryItems,
      files: Object.fromEntries(plan.artifacts.map((artifact) => [
        artifact.target,
        crypto.createHash("sha256").update(fs.readFileSync(path.join(root, artifact.target))).digest("hex"),
      ])),
      css: {
        path: "src/index.css",
        hash: crypto.createHash("sha256").update(fs.readFileSync(path.join(root, "src", "index.css"))).digest("hex"),
      },
    })
    assert.strictEqual(bootstrap.cossInstallStateMatches(plan), true)
    assert.doesNotThrow(() => bootstrap.assertNoArtifactConflicts(plan))

    fs.appendFileSync(path.join(root, "src", "index.css"), "\n:root { --background: white; }\n")
    assert.strictEqual(bootstrap.cossInstallStateMatches(plan), false)
    fs.writeFileSync(path.join(root, "src", "index.css"), '@import "tailwindcss";\n')
    assert.strictEqual(bootstrap.cossInstallStateMatches(plan), true)
    try {
      const linkedCss = path.join(root, "src", "linked.css")
      fs.writeFileSync(linkedCss, '@import "tailwindcss";\n')
      fs.rmSync(path.join(root, "src", "index.css"))
      fs.symlinkSync(linkedCss, path.join(root, "src", "index.css"), "file")
      assert.throws(() => bootstrap.assertPlanWritePaths(plan), /through a symlink/u)
    } catch (error) {
      if (!error || !["EACCES", "EPERM"].includes(error.code)) throw error
    }

    fs.writeFileSync(button, "export const Button = 'changed'\n")
    assert.strictEqual(bootstrap.cossInstallStateMatches(plan), false)
    assert.throws(
      () => bootstrap.assertNoArtifactConflicts(plan),
      /refuses to install over existing untracked registry files/u,
    )
  })

  await withAsyncFixture("registry-utils-owner", (root) => {
    writeJson(root, "tsconfig.json", {
      compilerOptions: {
        baseUrl: ".",
        paths: { "@/*": ["./src/*"] },
      },
    })
    return { deferUtility: true }
  }, async (root) => {
    const registry = {
      "colors-neutral": { name: "colors-neutral", type: "registry:style" },
      ui: { name: "ui", type: "registry:ui", registryDependencies: ["@coss/sidebar"] },
      sidebar: {
        name: "sidebar",
        type: "registry:ui",
        registryDependencies: ["@coss/utils"],
        files: [{ path: "registry/default/ui/sidebar.tsx", type: "registry:ui", content: "export const Sidebar = null\n" }],
      },
      utils: {
        name: "utils",
        type: "registry:lib",
        files: [{ path: "registry/default/lib/utils.ts", type: "registry:lib", content: "export const cn = null\n" }],
      },
    }
    const plan = await bootstrap.resolveCossInstallPlan([], async (name) => registry[name])
    const utilsFile = path.join(root, "src", "lib", "utils.ts")
    assert.ok(plan.artifacts.some((artifact) => artifact.target === "src/lib/utils.ts"))
    assert.strictEqual(fs.existsSync(utilsFile), false)
    bootstrap.ensureUtilityModule(plan)
    assert.strictEqual(fs.existsSync(utilsFile), false)
    assert.doesNotThrow(() => bootstrap.assertNoArtifactConflicts(plan))
  })

  await withAsyncFixture("shared-components-registry-plan", (root) => {
    writeJson(root, "tsconfig.json", {
      compilerOptions: {
        baseUrl: ".",
        paths: { "@/*": ["./src/*"] },
      },
    })
    fs.mkdirSync(path.join(root, "src", "shared", "components"), { recursive: true })
    return { deferUtility: true }
  }, async (root, config) => {
    const registry = {
      "colors-neutral": { name: "colors-neutral", type: "registry:style" },
      button: {
        name: "button",
        type: "registry:ui",
        files: [{ path: "registry/default/ui/button.tsx", type: "registry:ui", content: "export const Button = null\n" }],
      },
      utils: {
        name: "utils",
        type: "registry:lib",
        files: [{ path: "registry/default/lib/utils.ts", type: "registry:lib", content: "export const cn = null\n" }],
      },
    }
    const plan = await bootstrap.resolveCossInstallPlan(["button"], async (name) => registry[name])
    assert.strictEqual(config.aliases.ui, "@/shared/components")
    assert.strictEqual(config.aliases.utils, "@/shared/lib/utils")
    assert.deepStrictEqual(
      plan.artifacts.map((artifact) => artifact.target),
      ["src/shared/components/button.tsx", "src/shared/lib/utils.ts"],
    )
    bootstrap.ensureUtilityModule(plan)
    assert.strictEqual(fs.existsSync(path.join(root, "src", "shared", "lib", "utils.ts")), false)
  })

  await withAsyncFixture("registry-errors", (root) => {
    writeJson(root, "tsconfig.json", {
      compilerOptions: {
        baseUrl: ".",
        paths: { "@/*": ["./src/*"] },
      },
    })
  }, async () => {
    const registryForErrors = {
      "colors-neutral": { name: "colors-neutral", type: "registry:style" },
      utils: { name: "utils", type: "registry:lib", files: [] },
      block: { name: "block", type: "registry:block" },
      case: {
        name: "case",
        type: "registry:lib",
        files: [
          { path: "registry/default/lib/Foo.ts", type: "registry:lib", content: "export const Foo = null\n" },
          { path: "registry/default/lib/foo.ts", type: "registry:lib", content: "export const foo = null\n" },
        ],
      },
    }
    await assert.rejects(
      () => bootstrap.resolveCossInstallPlan(["block"], async (name) => registryForErrors[name]),
      /is a registry block/u,
    )
    if (process.platform === "win32") {
      await assert.rejects(
        () => bootstrap.resolveCossInstallPlan(["case"], async (name) => registryForErrors[name]),
        /registry items conflict/u,
      )
    }
  })

  await withAsyncFixture("symlinked-artifact-parent", (root) => {
    writeJson(root, "tsconfig.json", {
      compilerOptions: {
        baseUrl: ".",
        paths: { "@/*": ["./src/*"] },
      },
    })
    return { deferUtility: true }
  }, async (root) => {
    const ui = path.join(root, "src", "components", "ui")
    const target = path.join(root, "src", "shared-ui")
    fs.rmSync(ui, { recursive: true, force: true })
    fs.mkdirSync(target, { recursive: true })
    try {
      fs.symlinkSync(target, ui, "junction")
    } catch (error) {
      if (!error || !["EACCES", "EPERM"].includes(error.code)) throw error
      return
    }

    await assert.rejects(
      () => bootstrap.resolveCossInstallPlan(["button"], async (name) => ({
        "colors-neutral": { name: "colors-neutral", type: "registry:style" },
        utils: { name: "utils", type: "registry:lib", files: [] },
        button: {
          name: "button",
          type: "registry:ui",
          files: [{ path: "registry/default/ui/button.tsx", type: "registry:ui", content: "export const Button = null\n" }],
        },
      }[name])),
      /through a symlink/u,
    )
  })

  const previousMode = process.env.COSS_BOOTSTRAP_MODE
  try {
    process.env.COSS_BOOTSTRAP_MODE = "full-style"
    await assert.rejects(
      () => bootstrap.resolveCossInstallPlan([], async () => ({ name: "ui" })),
      /installs primitives and neutral tokens only/u,
    )
  } finally {
    if (previousMode === undefined) delete process.env.COSS_BOOTSTRAP_MODE
    else process.env.COSS_BOOTSTRAP_MODE = previousMode
  }

  console.log("coss-ui-bootstrap placement tests passed")
}

runAsyncTests().catch((error) => {
  console.error(error)
  process.exit(1)
})
