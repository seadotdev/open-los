#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const HTTP_METHOD_PATTERN = /^(get|post|put|patch|delete)$/i;

function parseArgs(argv) {
  const parsed = {
    mode: "report",
    root: process.cwd(),
    baseline: null,
    updateBaseline: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--mode") {
      parsed.mode = argv[i + 1] ?? parsed.mode;
      i += 1;
      continue;
    }
    if (arg === "--root") {
      parsed.root = argv[i + 1] ?? parsed.root;
      i += 1;
      continue;
    }
    if (arg === "--baseline") {
      parsed.baseline = argv[i + 1] ?? parsed.baseline;
      i += 1;
      continue;
    }
    if (arg === "--update-baseline") {
      parsed.updateBaseline = true;
      continue;
    }
  }

  if (!["report", "dev", "release"].includes(parsed.mode)) {
    throw new Error(`Unsupported mode '${parsed.mode}'. Use report|dev|release.`);
  }

  return parsed;
}

function listRouteFiles(routeDir) {
  if (!fs.existsSync(routeDir)) {
    throw new Error(`Route directory not found: ${routeDir}`);
  }

  return fs
    .readdirSync(routeDir)
    .filter((name) => name.endsWith(".ts"))
    .map((name) => path.join(routeDir, name));
}

function normalizeRuntimePath(routePath) {
  let normalized = routePath.replace(/\\\\:/g, ":").replace(/\\:/g, ":");
  if (!normalized.startsWith("/")) {
    normalized = `/${normalized}`;
  }
  if (!normalized.startsWith("/v1/")) {
    normalized = `/v1${normalized}`;
  }
  normalized = normalized.replace(/\/:([A-Za-z0-9_]+)(?=\/|$)/g, "/{$1}");
  normalized = normalized.replace(/\/+/g, "/");
  return normalized;
}

function toRouteKey(route) {
  return `${route.method} ${route.path}`;
}

function uniqueSortedRoutes(routes) {
  const deduped = new Map();
  for (const route of routes) {
    deduped.set(toRouteKey(route), route);
  }

  return Array.from(deduped.values()).sort((a, b) => {
    if (a.path !== b.path) {
      return a.path.localeCompare(b.path);
    }
    return a.method.localeCompare(b.method);
  });
}

function collectRuntimeRoutes(routeDir) {
  const files = listRouteFiles(routeDir);
  const routes = [];
  const routePattern = /app\.(get|post|put|patch|delete)\(\s*["'`](.+?)["'`]/g;

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, "utf8");
    let match = routePattern.exec(content);
    while (match) {
      const method = match[1].toUpperCase();
      const rawPath = match[2];
      routes.push({
        method,
        path: normalizeRuntimePath(rawPath),
        source_file: path.relative(routeDir, filePath),
      });
      match = routePattern.exec(content);
    }
  }

  return uniqueSortedRoutes(routes);
}

function collectOpenApiRoutes(openApiPath) {
  if (!fs.existsSync(openApiPath)) {
    throw new Error(`OpenAPI file not found: ${openApiPath}`);
  }

  const lines = fs.readFileSync(openApiPath, "utf8").split(/\r?\n/);
  const routes = [];
  let inPathsBlock = false;
  let currentPath = null;

  for (const line of lines) {
    if (!inPathsBlock && /^paths:\s*$/.test(line)) {
      inPathsBlock = true;
      continue;
    }

    if (!inPathsBlock) {
      continue;
    }

    if (/^[A-Za-z0-9_]/.test(line)) {
      break;
    }

    const pathMatch = line.match(/^\s{2}(\/v1\/.*):\s*$/);
    if (pathMatch) {
      currentPath = pathMatch[1];
      continue;
    }

    const methodMatch = line.match(/^\s{4}(get|post|put|patch|delete):\s*$/i);
    if (methodMatch && currentPath) {
      routes.push({
        method: methodMatch[1].toUpperCase(),
        path: currentPath,
      });
    }
  }

  return uniqueSortedRoutes(routes);
}

function buildPathToMethods(routes) {
  const pathToMethods = new Map();
  for (const route of routes) {
    const set = pathToMethods.get(route.path) ?? new Set();
    set.add(route.method);
    pathToMethods.set(route.path, set);
  }
  return pathToMethods;
}

function parseSimpleYamlAllowlist(text) {
  const entries = [];
  let current = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line === "entries:") {
      continue;
    }

    if (line.startsWith("- ")) {
      if (current) {
        entries.push(current);
      }
      current = {};
      const inline = line.slice(2).trim();
      if (inline.includes(":")) {
        const [key, ...rest] = inline.split(":");
        current[key.trim()] = rest.join(":").trim().replace(/^"|"$/g, "");
      }
      continue;
    }

    if (!current || !line.includes(":")) {
      continue;
    }

    const [key, ...rest] = line.split(":");
    current[key.trim()] = rest.join(":").trim().replace(/^"|"$/g, "");
  }

  if (current) {
    entries.push(current);
  }

  return entries;
}

function loadAllowlist(allowlistPath) {
  if (!fs.existsSync(allowlistPath)) {
    return [];
  }

  const raw = fs.readFileSync(allowlistPath, "utf8").trim();
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.entries)) {
      return parsed.entries;
    }
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // Fall through to simple YAML parser.
  }

  return parseSimpleYamlAllowlist(raw);
}

function loadBaseline(baselinePath) {
  if (!baselinePath || !fs.existsSync(baselinePath)) {
    return [];
  }

  const raw = fs.readFileSync(baselinePath, "utf8").trim();
  if (!raw) {
    return [];
  }

  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed)) {
    return parsed;
  }
  if (Array.isArray(parsed.items)) {
    return parsed.items;
  }
  return [];
}

function asDate(value, fieldName) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    throw new Error(`Invalid date for '${fieldName}': ${value}`);
  }
  return parsed;
}

function validateAllowlistMetadata(entries, mode) {
  if (mode === "report") {
    return;
  }

  if (entries.length > 3) {
    throw new Error(`Allowlist exceeds dev cap: ${entries.length} entries (max 3).`);
  }

  const now = new Date();
  const maxAgeMs = 14 * 24 * 60 * 60 * 1000;

  for (const [index, entry] of entries.entries()) {
    for (const required of ["owner", "reason", "created_at", "expires_at", "path"]) {
      if (!entry[required]) {
        throw new Error(`Allowlist entry ${index} missing required field '${required}'.`);
      }
    }

    const created = asDate(entry.created_at, "created_at");
    const expires = asDate(entry.expires_at, "expires_at");
    if (expires <= created) {
      throw new Error(`Allowlist entry ${index} expires_at must be after created_at.`);
    }

    const ageMs = now.valueOf() - created.valueOf();
    if (ageMs > maxAgeMs) {
      throw new Error(`Allowlist entry ${index} is older than 14 days.`);
    }

    if (expires < now) {
      throw new Error(`Allowlist entry ${index} has expired.`);
    }

    if (entry.method && !HTTP_METHODS.includes(String(entry.method).toUpperCase())) {
      throw new Error(`Allowlist entry ${index} has invalid HTTP method '${entry.method}'.`);
    }
  }
}

function normalizeDiffItems(runtimeRoutes, openApiRoutes) {
  const runtimeSet = new Set(runtimeRoutes.map(toRouteKey));
  const specSet = new Set(openApiRoutes.map(toRouteKey));

  const runtimeOnly = runtimeRoutes
    .filter((route) => !specSet.has(toRouteKey(route)))
    .map((route) => ({ direction: "runtime_only", method: route.method, path: route.path }));

  const specOnly = openApiRoutes
    .filter((route) => !runtimeSet.has(toRouteKey(route)))
    .map((route) => ({ direction: "spec_only", method: route.method, path: route.path }));

  const runtimeByPath = buildPathToMethods(runtimeRoutes);
  const specByPath = buildPathToMethods(openApiRoutes);
  const methodMismatches = [];

  for (const [pathKey, runtimeMethods] of runtimeByPath.entries()) {
    if (!specByPath.has(pathKey)) {
      continue;
    }

    const specMethods = specByPath.get(pathKey);
    const runtimeList = Array.from(runtimeMethods).sort();
    const specList = Array.from(specMethods).sort();

    if (runtimeList.length !== specList.length || runtimeList.some((method, idx) => method !== specList[idx])) {
      methodMismatches.push({
        direction: "method_mismatch",
        path: pathKey,
        runtime_methods: runtimeList,
        spec_methods: specList,
      });
    }
  }

  methodMismatches.sort((a, b) => a.path.localeCompare(b.path));

  return { runtimeOnly, specOnly, methodMismatches };
}

function allowlistKey(item) {
  if (item.direction === "method_mismatch") {
    return `${item.direction} ${item.path}`;
  }
  return `${item.direction} ${item.method} ${item.path}`;
}

function isAllowlisted(item, allowlistEntries) {
  return allowlistEntries.some((entry) => {
    if (entry.direction && entry.direction !== item.direction) {
      return false;
    }
    if (entry.path !== item.path) {
      return false;
    }

    if (item.direction === "method_mismatch") {
      return true;
    }

    if (!entry.method) {
      return true;
    }
    return entry.method.toUpperCase() === item.method;
  });
}

function splitAllowlisted(items, allowlistEntries) {
  const allowlisted = [];
  const unresolved = [];

  for (const item of items) {
    if (isAllowlisted(item, allowlistEntries)) {
      allowlisted.push(item);
    } else {
      unresolved.push(item);
    }
  }

  return { allowlisted, unresolved };
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function reportSummary(report) {
  return [
    `mode=${report.mode}`,
    `runtime_only=${report.runtime_only_count}`,
    `spec_only=${report.spec_only_count}`,
    `method_mismatch=${report.method_mismatch_count}`,
    `allowlisted=${report.allowlisted_count}`,
    `unexpected=${report.unexpected_count ?? 0}`,
  ].join(" ");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = path.resolve(args.root);

  const parityDir = path.join(repoRoot, "integration", "parity");
  const runtimeRoutesPath = path.join(parityDir, "runtime_routes.json");
  const openApiRoutesPath = path.join(parityDir, "openapi_routes.json");
  const reportPath = path.join(parityDir, "parity_report.json");
  const allowlistPath = path.join(parityDir, "parity_allowlist.yaml");
  const baselinePath = args.baseline ?? path.join(parityDir, "parity_baseline.json");

  const runtimeRoutes = collectRuntimeRoutes(path.join(repoRoot, "packages", "api", "src", "routes"));
  const openApiRoutes = collectOpenApiRoutes(path.join(repoRoot, "openapi", "v1.yaml"));
  const allowlistEntries = loadAllowlist(allowlistPath);
  const baselineEntries = loadBaseline(baselinePath);

  validateAllowlistMetadata(allowlistEntries, args.mode === "release" ? "dev" : args.mode);

  const rawDiff = normalizeDiffItems(runtimeRoutes, openApiRoutes);
  const runtimeSplit = splitAllowlisted(rawDiff.runtimeOnly, allowlistEntries);
  const specSplit = splitAllowlisted(rawDiff.specOnly, allowlistEntries);
  const methodSplit = splitAllowlisted(rawDiff.methodMismatches, allowlistEntries);

  const allowlistedKeys = new Set([
    ...runtimeSplit.allowlisted.map(allowlistKey),
    ...specSplit.allowlisted.map(allowlistKey),
    ...methodSplit.allowlisted.map(allowlistKey),
  ]);
  const unresolvedItems = [
    ...runtimeSplit.unresolved,
    ...specSplit.unresolved,
    ...methodSplit.unresolved,
  ];
  const unresolvedKeys = new Set(unresolvedItems.map(allowlistKey));
  const baselineKeys = new Set(baselineEntries.map(allowlistKey));
  const unexpected = unresolvedItems.filter((item) => !baselineKeys.has(allowlistKey(item)));
  const resolvedSinceBaseline = baselineEntries.filter((item) => !unresolvedKeys.has(allowlistKey(item)));

  const report = {
    generated_at: new Date().toISOString(),
    mode: args.mode,
    baseline_path: baselinePath,
    baseline_count: baselineEntries.length,
    raw_runtime_only_count: rawDiff.runtimeOnly.length,
    raw_spec_only_count: rawDiff.specOnly.length,
    raw_method_mismatch_count: rawDiff.methodMismatches.length,
    runtime_only_count: runtimeSplit.unresolved.length,
    spec_only_count: specSplit.unresolved.length,
    method_mismatch_count: methodSplit.unresolved.length,
    allowlisted_count: allowlistedKeys.size,
    runtime_only: runtimeSplit.unresolved,
    spec_only: specSplit.unresolved,
    method_mismatches: methodSplit.unresolved,
    allowlisted: [...runtimeSplit.allowlisted, ...specSplit.allowlisted, ...methodSplit.allowlisted],
    unexpected_count: unexpected.length,
    unexpected,
    resolved_since_baseline_count: resolvedSinceBaseline.length,
    resolved_since_baseline: resolvedSinceBaseline,
  };

  writeJson(runtimeRoutesPath, {
    generated_at: report.generated_at,
    total_routes: runtimeRoutes.length,
    routes: runtimeRoutes,
  });
  writeJson(openApiRoutesPath, {
    generated_at: report.generated_at,
    total_routes: openApiRoutes.length,
    routes: openApiRoutes,
  });
  writeJson(reportPath, report);
  if (args.updateBaseline) {
    writeJson(baselinePath, {
      generated_at: report.generated_at,
      source_report: path.relative(repoRoot, reportPath),
      items: unresolvedItems,
    });
  }

  const unresolved = report.runtime_only_count + report.spec_only_count + report.method_mismatch_count;

  if (args.mode === "release") {
    if (report.unexpected_count > 0) {
      throw new Error(`Release parity gate failed (new drift): ${reportSummary(report)}`);
    }
    if (baselineEntries.length === 0 && unresolved > 0) {
      throw new Error(`Release parity gate failed (baseline missing): ${reportSummary(report)}`);
    }
    if (allowlistEntries.length > 0) {
      throw new Error("Release parity gate failed: allowlist must be empty.");
    }
  }

  if (args.mode === "dev" && unresolved > 0) {
    throw new Error(`Dev parity gate failed: ${reportSummary(report)}`);
  }

  console.log(`API parity report written: ${reportPath}`);
  console.log(reportSummary(report));
}

try {
  main();
} catch (error) {
  console.error(String(error instanceof Error ? error.message : error));
  process.exit(1);
}
