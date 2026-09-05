const fs = require("fs")

const requiredAllowBuilds = {
  "@parcel/watcher": true,
  esbuild: true,
}

function extraAllowBuilds() {
  return [
    ...String(process.env.OPENCODE_PNPM_ALLOW_BUILDS || process.env.PNPM_ALLOW_BUILDS || "")
      .split(/[\s,]+/u),
    ...process.argv.slice(2),
  ].map((name) => name.trim()).filter(Boolean)
}

for (const name of extraAllowBuilds()) {
  requiredAllowBuilds[name] = true
}

function renderAllowBuild(name, value) {
  return `  ${name.includes("@") ? JSON.stringify(name) : name}: ${value ? "true" : "false"}`
}

function defaultAllowBuildsBlock() {
  return [
    "allowBuilds:",
    ...Object.entries(requiredAllowBuilds).map(([name, value]) => renderAllowBuild(name, value)),
    "",
  ].join("\n")
}

function writeDefaultWorkspace(filePath) {
  fs.writeFileSync(filePath, defaultAllowBuildsBlock())
}

function hasAllowBuildEntry(block, name) {
  return new RegExp(`^\\s*["']?${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']?\\s*:`, "m").test(block)
}

function findAllowBuildsBlock(lines) {
  const start = lines.findIndex((line) => /^\s*allowBuilds:\s*$/u.test(line))
  if (start === -1) return null

  let end = lines.length
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index]
    if (line.trim() && !/^\s/u.test(line) && /^[^:#][^:]*:/u.test(line)) {
      end = index
      break
    }
  }

  return { start, end }
}

function ensurePnpmAllowBuilds() {
  const filePath = "pnpm-workspace.yaml"
  if (!fs.existsSync(filePath)) {
    writeDefaultWorkspace(filePath)
    return
  }

  const current = fs.readFileSync(filePath, "utf8")
  if (!/^\s*allowBuilds:/m.test(current)) {
    fs.writeFileSync(filePath, `${current.replace(/\s*$/u, "")}\n\n${defaultAllowBuildsBlock()}`)
    return
  }

  const lines = current.split(/\r?\n/u)
  const allowBuildsBlock = findAllowBuildsBlock(lines)
  if (!allowBuildsBlock) {
    fs.writeFileSync(filePath, `${current.replace(/\s*$/u, "")}\n\n${defaultAllowBuildsBlock()}`)
    return
  }

  const block = lines.slice(allowBuildsBlock.start + 1, allowBuildsBlock.end).join("\n")
  const missing = Object.entries(requiredAllowBuilds)
    .filter(([name]) => !hasAllowBuildEntry(block, name))
    .map(([name, value]) => renderAllowBuild(name, value))

  if (missing.length) {
    let insertAt = allowBuildsBlock.end
    while (insertAt > allowBuildsBlock.start + 1 && !lines[insertAt - 1].trim()) {
      insertAt -= 1
    }
    lines.splice(insertAt, 0, ...missing)
    fs.writeFileSync(filePath, `${lines.join("\n").replace(/\s*$/u, "")}\n`)
  }
}

ensurePnpmAllowBuilds()
