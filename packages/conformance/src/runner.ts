import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { parseAllDocuments } from "yaml";
import { describe, it, expect } from "vitest";
import { createAppWithDb } from "@open-los/api";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { JSONPath } from "jsonpath-plus";
import { deals } from "@open-los/core";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../../..");

// Cache loaded schemas — create a fresh AJV per validation to avoid $id conflicts
const schemaJsonCache = new Map<string, Record<string, unknown>>();

function getValidator(schemaPath: string) {
  if (!schemaJsonCache.has(schemaPath)) {
    const fullPath = resolve(ROOT, schemaPath);
    const schemaJson = JSON.parse(readFileSync(fullPath, "utf-8"));
    schemaJsonCache.set(schemaPath, schemaJson);
  }
  const schema = { ...schemaJsonCache.get(schemaPath)! };
  // Remove $schema and $id to avoid AJV meta-schema resolution issues
  delete schema["$schema"];
  delete schema["$id"];
  const localAjv = new Ajv({ allErrors: true, strict: false });
  addFormats(localAjv);
  return localAjv.compile(schema);
}

interface TestStep {
  id: string;
  http: {
    actor?: string;
    method: string;
    path: string;
    json?: Record<string, unknown>;
    multipart?: Record<string, unknown>;
  };
  expect?: {
    status?: number;
    json_schema?: string;
    json_contains?: Record<string, unknown>;
    json_path_assertions?: Array<{
      path: string;
      eq?: unknown;
      gte?: number;
      lte?: unknown;
      exists?: boolean;
      regex?: string;
      contains?: string;
      not_contains?: string;
      approx?: { value: number; tolerance: number };
    }>;
    save?: Record<string, string>;
    json_matches_fixture?: string;
  };
}

interface SeedDeal {
  id: string;
  tenant_id: string;
  borrower_name: string;
  stage: string;
  jurisdiction?: string;
  requested_amount?: number;
  purpose?: string;
  borrower_registration_number?: string;
}

interface SeedTemplate {
  id: string;
  name?: string;
  phase: string;
  doc_type: string;
  version: string;
  body: string;
}

interface TestCase {
  test: string;
  meta: {
    name: string;
    now?: string;
  };
  arrange?: {
    reset_db?: boolean;
    seed?: {
      tenant?: { id: string };
      users?: Array<{ id: string; role: string }>;
      deals?: SeedDeal[];
      templates?: SeedTemplate[];
    };
  };
  steps?: TestStep[];
  assertions?: TestStep[];
}

function substituteVars(obj: unknown, vars: Map<string, string>): unknown {
  if (typeof obj === "string") {
    let result = obj;
    for (const [key, value] of vars) {
      result = result.replace(new RegExp(`\\$\\{${key}\\}`, "g"), value);
    }
    return result;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => substituteVars(item, vars));
  }
  if (obj && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = substituteVars(value, vars);
    }
    return result;
  }
  return obj;
}

function deepContains(actual: unknown, expected: unknown): boolean {
  if (expected === null || expected === undefined) {
    return actual === null || actual === undefined;
  }
  if (typeof expected !== "object") {
    return actual === expected;
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) return false;
    return expected.every((item, i) => deepContains(actual[i], item));
  }
  if (typeof actual !== "object" || actual === null) return false;
  for (const [key, value] of Object.entries(expected as Record<string, unknown>)) {
    if (!deepContains((actual as Record<string, unknown>)[key], value)) {
      return false;
    }
  }
  return true;
}

function extractJsonPath(data: unknown, path: string): unknown {
  const results = JSONPath({ path, json: data as object, wrap: false });
  return results;
}

// Shared state for tests using reset_db: false
let sharedApp: Awaited<ReturnType<typeof createAppWithDb>>["app"] | null = null;
let sharedCtx: Awaited<ReturnType<typeof createAppWithDb>>["ctx"] | null = null;
let sharedVars: Map<string, string> = new Map();
let sharedNow: string = "";

export function runSuite(suiteFile: string) {
  const content = readFileSync(resolve(ROOT, suiteFile), "utf-8");
  const docs = parseAllDocuments(content);
  const parsed = docs.map((d) => d.toJSON()).filter((d) => d && d.test);

  for (const testCase of parsed as TestCase[]) {
    describe(testCase.meta?.name ?? testCase.test, () => {
      it("passes", async () => {
        const now = testCase.meta?.now ?? "2026-01-15T10:00:00Z";

        // Check if we should reuse state from previous test
        const resetDb = testCase.arrange?.reset_db ?? true;

        let app: Awaited<ReturnType<typeof createAppWithDb>>["app"];
        let ctx: Awaited<ReturnType<typeof createAppWithDb>>["ctx"];
        let vars: Map<string, string>;

        if (!resetDb && sharedApp && sharedCtx) {
          // Reuse app/ctx but update the time
          app = sharedApp;
          ctx = sharedCtx;
          vars = sharedVars;
          // Update the shared time for services to use
          sharedNow = now;
        } else {
          // Create fresh app/ctx/vars with a dynamic clock
          sharedNow = now;
          const dynamicClock = () => sharedNow;
          const created = await createAppWithDb(dynamicClock);
          app = created.app;
          ctx = created.ctx;
          vars = new Map<string, string>();

          // Store for potential reuse
          sharedApp = app;
          sharedCtx = ctx;
          sharedVars = vars;
        }

        // Seed users into app context for role-based permissions
        if (testCase.arrange?.seed?.users) {
          for (const user of testCase.arrange.seed.users) {
            ctx.users!.set(user.id, { id: user.id, role: user.role });
          }
        }

        // Seed deals directly into DB
        if (testCase.arrange?.seed?.deals) {
          for (const seedDeal of testCase.arrange.seed.deals) {
            await ctx.db.insert(deals).values({
              id: seedDeal.id,
              tenant_id: seedDeal.tenant_id || "default",
              borrower_name: seedDeal.borrower_name,
              stage: seedDeal.stage || "broker",
              jurisdiction: seedDeal.jurisdiction ?? null,
              requested_amount: seedDeal.requested_amount ?? null,
              purpose: seedDeal.purpose ?? null,
              borrower_registration_number:
                seedDeal.borrower_registration_number ?? null,
              origination_outcome: null,
              assigned_to: null,
              primary_entity_id: null,
              custom_fields: null,
              created_at: now,
              updated_at: now,
            });
          }
        }

        // Seed templates into template service
        if (testCase.arrange?.seed?.templates) {
          for (const seedTemplate of testCase.arrange.seed.templates) {
            ctx.templateService.registerTemplate({
              id: seedTemplate.id,
              name: seedTemplate.name ?? seedTemplate.id,
              phase: seedTemplate.phase,
              doc_type: seedTemplate.doc_type,
              version: seedTemplate.version,
              body: seedTemplate.body,
            });
          }
        }

        const allSteps = [
          ...(testCase.steps ?? []),
          ...(testCase.assertions ?? []),
        ];

        for (const step of allSteps) {
          const httpDef = substituteVars(step.http, vars) as TestStep["http"];
          const expectDef = substituteVars(
            step.expect,
            vars
          ) as TestStep["expect"];

          const url = `http://localhost${httpDef.path}`;
          const headers: Record<string, string> = {
            "X-Actor": httpDef.actor ?? "system",
          };

          const fetchInit: RequestInit = {
            method: httpDef.method,
            headers,
          };

          if (
            httpDef.json &&
            ["POST", "PATCH", "PUT"].includes(httpDef.method)
          ) {
            headers["Content-Type"] = "application/json";
            fetchInit.body = JSON.stringify(httpDef.json);
          } else if (
            httpDef.multipart &&
            ["POST", "PATCH", "PUT"].includes(httpDef.method)
          ) {
            // Handle multipart form data
            const formData = new FormData();
            for (const [key, value] of Object.entries(httpDef.multipart)) {
              if (key === "file" && typeof value === "object" && value !== null && "fixture" in value) {
                // Load file from fixture path (object syntax)
                const fixturePath = resolve(ROOT, (value as { fixture: string }).fixture);
                const fileContent = readFileSync(fixturePath);
                const mimeType = fixturePath.endsWith(".eml") ? "message/rfc822" : "text/csv";
                const filename = fixturePath.split("/").pop() ?? "file";
                const blob = new Blob([fileContent], { type: mimeType });
                formData.append(key, blob, filename);
              } else if (key === "file" && typeof value === "string" && value.includes("/")) {
                // Load file from path (string syntax, treat as fixture path)
                const fixturePath = resolve(ROOT, value);
                const fileContent = readFileSync(fixturePath);
                const mimeType = fixturePath.endsWith(".eml") ? "message/rfc822" : "text/csv";
                const filename = fixturePath.split("/").pop() ?? "file";
                const blob = new Blob([fileContent], { type: mimeType });
                formData.append(key, blob, filename);
              } else if (typeof value === "string") {
                // Values are already substituted by substituteVars
                formData.append(key, value);
              } else {
                formData.append(key, String(value));
              }
            }
            fetchInit.body = formData;
            // Don't set Content-Type header - fetch will set it automatically with boundary
            delete headers["Content-Type"];
          }

          const res = await app.request(url, fetchInit);

          let body: unknown;
          try {
            body = await res.json();
          } catch {
            body = null;
          }

          // Check status
          if (expectDef?.status) {
            expect(
              res.status,
              `Step ${step.id}: expected status ${expectDef.status}, got ${res.status}. Body: ${JSON.stringify(body)}`
            ).toBe(expectDef.status);
          }

          // Check JSON schema
          if (expectDef?.json_schema) {
            const validate = getValidator(expectDef.json_schema);
            const valid = validate(body);
            if (!valid) {
              expect.fail(
                `Step ${step.id}: JSON schema validation failed: ${JSON.stringify(validate.errors)}`
              );
            }
          }

          // Check json_contains
          if (expectDef?.json_contains) {
            const matches = deepContains(body, expectDef.json_contains);
            if (!matches) {
              expect.fail(
                `Step ${step.id}: json_contains failed.\nExpected to contain: ${JSON.stringify(expectDef.json_contains)}\nActual: ${JSON.stringify(body)}`
              );
            }
          }

          // Check json_path_assertions
          if (expectDef?.json_path_assertions) {
            for (const assertion of expectDef.json_path_assertions) {
              const actual = extractJsonPath(body, assertion.path);
              if (assertion.eq !== undefined) {
                // Handle case where eq references a variable (string starting with $.)
                let expected: unknown = assertion.eq;
                if (
                  typeof expected === "string" &&
                  expected.startsWith("$.")
                ) {
                  expected = extractJsonPath(body, expected);
                }
                // If actual is an array with one element, unwrap it for comparison
                let actualValue = actual;
                if (Array.isArray(actual) && actual.length === 1) {
                  actualValue = actual[0];
                }
                expect(
                  actualValue,
                  `Step ${step.id}: ${assertion.path} expected ${JSON.stringify(expected)}, got ${JSON.stringify(actualValue)}`
                ).toEqual(expected);
              }
              if (assertion.approx !== undefined) {
                // If actual is an array with one element, unwrap it
                let actualValue = actual as number;
                if (Array.isArray(actual) && actual.length === 1) {
                  actualValue = actual[0] as number;
                }
                const diff = Math.abs(actualValue - assertion.approx.value);
                expect(
                  diff <= assertion.approx.tolerance,
                  `Step ${step.id}: ${assertion.path} expected ${assertion.approx.value} ± ${assertion.approx.tolerance}, got ${actualValue} (diff: ${diff})`
                ).toBe(true);
              }
              if (assertion.gte !== undefined) {
                expect(
                  actual as number,
                  `Step ${step.id}: ${assertion.path} expected >= ${assertion.gte}, got ${actual}`
                ).toBeGreaterThanOrEqual(assertion.gte);
              }
              if (assertion.lte !== undefined) {
                // lte can be a jsonpath reference or a literal
                let expected: unknown = assertion.lte;
                if (
                  typeof expected === "string" &&
                  expected.startsWith("$.")
                ) {
                  expected = extractJsonPath(body, expected);
                }
                if (typeof actual === "string" && typeof expected === "string") {
                  expect(
                    actual <= expected,
                    `Step ${step.id}: ${assertion.path} expected "${actual}" <= "${expected}"`
                  ).toBe(true);
                } else {
                  expect(
                    actual as number,
                    `Step ${step.id}: ${assertion.path} expected <= ${expected}, got ${actual}`
                  ).toBeLessThanOrEqual(expected as number);
                }
              }
              if (assertion.exists !== undefined) {
                if (assertion.exists) {
                  expect(
                    actual,
                    `Step ${step.id}: ${assertion.path} expected to exist`
                  ).not.toBeUndefined();
                } else {
                  expect(
                    actual,
                    `Step ${step.id}: ${assertion.path} expected to not exist`
                  ).toBeUndefined();
                }
              }
              if (assertion.regex !== undefined) {
                const re = new RegExp(assertion.regex);
                expect(
                  re.test(String(actual)),
                  `Step ${step.id}: ${assertion.path} expected to match ${assertion.regex}, got ${actual}`
                ).toBe(true);
              }
              if (assertion.contains !== undefined) {
                expect(
                  String(actual).includes(assertion.contains),
                  `Step ${step.id}: ${assertion.path} expected to contain "${assertion.contains}", got "${actual}"`
                ).toBe(true);
              }
              if (assertion.not_contains !== undefined) {
                expect(
                  !String(actual).includes(assertion.not_contains),
                  `Step ${step.id}: ${assertion.path} expected NOT to contain "${assertion.not_contains}", got "${actual}"`
                ).toBe(true);
              }
            }
          }

          // Check json_matches_fixture - compare ratios against expected fixture
          if (expectDef?.json_matches_fixture) {
            const fixturePath = resolve(ROOT, expectDef.json_matches_fixture);
            const fixtureJson = JSON.parse(readFileSync(fixturePath, "utf-8"));
            const expectedRatios = fixtureJson.ratios;
            const actualRatios = (body as Record<string, unknown>)?.ratios as Record<string, unknown> | undefined;

            if (actualRatios && expectedRatios) {
              for (const [ratioName, ratioData] of Object.entries(expectedRatios)) {
                const expectedValue = (ratioData as { value: number }).value;
                const actualValue = actualRatios[ratioName] as number | null;
                if (actualValue !== null && actualValue !== undefined) {
                  const diff = Math.abs(actualValue - expectedValue);
                  expect(
                    diff <= 0.001,
                    `Step ${step.id}: ratio ${ratioName} expected ${expectedValue}, got ${actualValue} (diff: ${diff})`
                  ).toBe(true);
                }
              }
            }
          }

          // Save variables
          if (expectDef?.save) {
            for (const [varName, jsonPath] of Object.entries(expectDef.save)) {
              const value = extractJsonPath(body, jsonPath);
              if (value !== undefined && value !== null) {
                vars.set(varName, String(value));
              }
            }
          }
        }
      });
    });
  }
}
