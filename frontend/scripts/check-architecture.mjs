// Architecture check for the Lamma frontend (FRONTEND-ARCHITECTURE.md §Layers). Node built-ins only.
// Fails (exit 1) on: layer violations, deep cross-feature imports, feature imports inside the AppShell, import cycles.
// Usage: npm run check:architecture
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..", "src");
const EXTENSIONS = [".ts", ".tsx", ".js"];

/** Which top-level layers each layer may import from (besides itself). */
const ALLOWED = {
  assets: [],
  services: [],
  shared: ["services", "assets"],
  features: ["shared", "services", "assets"],
  app: ["features", "shared", "services", "assets"],
  root: ["app", "features", "shared", "services", "assets", "styles"], // main.tsx
};

const isTest = (file) => /\.test\.tsx?$/.test(file) || file.startsWith(join(SRC, "test") + sep);

function listFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return listFiles(full);
    return /\.(ts|tsx)$/.test(name) && !name.endsWith(".d.ts") ? [full] : [];
  });
}

function resolveImport(fromFile, spec) {
  let base;
  if (spec.startsWith("@/")) base = join(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(fromFile), spec);
  else return null; // package
  const candidates = [base, ...EXTENSIONS.map((e) => base + e), ...EXTENSIONS.map((e) => join(base, "index" + e))];
  return candidates.find((c) => existsSync(c) && statSync(c).isFile()) ?? null;
}

const layerOf = (file) => {
  const rel = relative(SRC, file).split(sep);
  return rel.length === 1 ? "root" : rel[0];
};
const featureOf = (file) => {
  const rel = relative(SRC, file).split(sep);
  return rel[0] === "features" ? rel[1] : null;
};

const IMPORT_RE = /(?:^|\n)\s*(?:import|export)\s[^;]*?from\s+["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|(?:^|\n)\s*import\s+["']([^"']+)["']/g;

const files = listFiles(SRC);
const graph = new Map();
const violations = [];

for (const file of files) {
  const text = readFileSync(file, "utf8");
  const edges = [];
  for (const m of text.matchAll(IMPORT_RE)) {
    const spec = m[1] ?? m[2] ?? m[3];
    if (spec.endsWith(".css")) continue;
    const target = resolveImport(file, spec);
    if (!target) {
      if (spec.startsWith(".") || spec.startsWith("@/")) violations.push(`${rel(file)}: cannot resolve "${spec}"`);
      continue;
    }

    edges.push(target);
    if (isTest(file)) continue; // tests may import anything

    const from = layerOf(file);
    const to = layerOf(target);
    if (from !== to && !(ALLOWED[from] ?? []).includes(to)) {
      violations.push(`${rel(file)}: layer "${from}" must not import "${to}" ("${spec}")`);
    }

    const fromFeature = featureOf(file);
    const toFeature = featureOf(target);
    if (toFeature && toFeature !== fromFeature && spec !== `@/features/${toFeature}`) {
      violations.push(`${rel(file)}: deep import into feature "${toFeature}" ("${spec}"); use "@/features/${toFeature}"`);
    }

    if (relative(SRC, file).startsWith(join("app", "layouts", "app-shell")) && toFeature) {
      violations.push(`${rel(file)}: AppShell must stay layout-only and not import features ("${spec}")`);
    }

    if (spec.startsWith("../../")) {
      violations.push(`${rel(file)}: "../../" import; use the "@/" alias across folders ("${spec}")`);
    }
  }

  graph.set(file, edges);
}

// Cycle detection over production files (tests are leaves and cannot be imported).
const state = new Map(); // 0 = visiting, 1 = done
const cycles = [];
function visit(node, stack) {
  state.set(node, 0);
  stack.push(node);
  for (const next of graph.get(node) ?? []) {
    if (!graph.has(next) || isTest(next)) continue;
    if (state.get(next) === 0) cycles.push([...stack.slice(stack.indexOf(next)), next].map(rel).join(" → "));
    else if (!state.has(next)) visit(next, stack);
  }

  stack.pop();
  state.set(node, 1);
}

for (const file of files.filter((f) => !isTest(f))) {
  if (!state.has(file)) visit(file, []);
}

function rel(file) {
  return relative(SRC, file).split(sep).join("/");
}

const productionFiles = files.filter((f) => !isTest(f)).length;
console.log(`Checked ${files.length} files (${productionFiles} production, ${files.length - productionFiles} test).`);
console.log(`Layer/public-API violations: ${violations.length}`);
violations.forEach((v) => console.log(`  ✗ ${v}`));
console.log(`Import cycles: ${cycles.length}`);
cycles.forEach((c) => console.log(`  ✗ ${c}`));
process.exit(violations.length + cycles.length > 0 ? 1 : 0);
