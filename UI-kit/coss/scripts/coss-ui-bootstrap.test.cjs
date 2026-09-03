#!/usr/bin/env node

const assert = require("assert")
const cp = require("child_process")
const fs = require("fs")
const os = require("os")
const path = require("path")
const bootstrap = require("./coss-ui-bootstrap.cjs")

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
  assert.strictEqual(config.aliases.ui, "@/shared/components/ui")
  assert.strictEqual(bootstrap.aliasToPath("@/"), "src")
  assert.ok(fs.existsSync(path.join(root, "src", "shared", "components", "ui")))
  assert.ok(fs.existsSync(path.join(root, "src", "shared", "utils", "cn.ts")))
  assert.strictEqual(fs.existsSync(path.join(root, "@")), false)
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
  assert.strictEqual(config.aliases.ui, "@/common/components/ui")
  assert.ok(fs.existsSync(path.join(root, "app", "common", "components", "ui")))
  assert.ok(fs.existsSync(path.join(root, "app", "common", "utils", "cn.ts")))
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
  assert.strictEqual(config.aliases.utils, "@ui/utils/cn")
  assert.strictEqual(config.aliases.hooks, "@ui/hooks")
  assert.strictEqual(bootstrap.aliasToPath("@ui"), "client/design/primitives")
  assert.ok(fs.existsSync(path.join(root, "client", "design", "primitives")))
  assert.strictEqual(fs.existsSync(path.join(root, "@ui")), false)

  fs.writeFileSync(path.join(root, "client", "design", "primitives", "button.tsx"), [
    'import { missing } from "@ui/missing"',
    "export { missing }",
    "",
  ].join("\n"))
  assert.deepStrictEqual(
    bootstrap.missingProjectImports("client/design/primitives", ["button"]),
    ["button: @ui/missing"],
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
  fs.writeFileSync(path.join(root, "vite.config.cjs"), "module.exports = {}\n")
  for (const packageName of ["@tailwindcss/vite", "vite-tsconfig-paths"]) {
    const packageRoot = path.join(root, "node_modules", ...packageName.split("/"))
    writeJson(packageRoot, "package.json", {
      type: "module",
      exports: "./index.js",
    })
    fs.writeFileSync(path.join(packageRoot, "index.js"), "export default () => ({ name: 'test-plugin' })\n")
  }
}, (root, config) => {
  assert.strictEqual(config.aliases.ui, "@/design-system/primitives")
  assert.strictEqual(bootstrap.viteConfigFile(), "vite.config.cjs")
  bootstrap.ensureViteTailwindPlugin()
  const viteConfig = fs.readFileSync(path.join(root, "vite.config.cjs"), "utf8")
  assert.ok(viteConfig.includes('import("@tailwindcss/vite")'))
  assert.ok(viteConfig.includes('import("vite-tsconfig-paths")'))
  assert.strictEqual(viteConfig.includes("require("), false)
  const loadResult = cp.spawnSync(process.execPath, [
    "-e",
    "Promise.resolve(require('./vite.config.cjs')()).then((config) => process.exit(config.plugins.length === 2 ? 0 : 1)).catch((error) => { console.error(error); process.exit(1) })",
  ], { cwd: root, encoding: "utf8" })
  assert.strictEqual(loadResult.status, 0, loadResult.stderr)
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

const primitivesDirectory = path.join(__dirname, "..", "references", "primitives")
for (const file of fs.readdirSync(primitivesDirectory).filter((name) => name.endsWith(".md"))) {
  const content = fs.readFileSync(path.join(primitivesDirectory, file), "utf8")
  assert.ok(content.includes("{{ui}}/"), `${file} must use the project UI placeholder`)
  assert.strictEqual(content.includes("@/components/ui"), false, `${file} contains a fixed UI alias`)
}

console.log("coss-ui-bootstrap placement tests passed")
