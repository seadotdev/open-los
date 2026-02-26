#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';

const contractPath = process.env.RISK_POLICY_CONTRACT ?? '.harness-risk-policy.json';
const contract = JSON.parse(readFileSync(contractPath, 'utf8'));
const manifestPath = process.env.BROWSER_EVIDENCE_MANIFEST ?? contract.evidenceRules.requiredManifest;

if (!existsSync(manifestPath)) {
  throw new Error(`Browser evidence manifest missing: ${manifestPath}`);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const flows = new Set((manifest.flows ?? []).map((flow) => flow.id));

for (const flowId of contract.evidenceRules.requiredFlows) {
  if (!flows.has(flowId)) {
    throw new Error(`Missing required browser evidence flow: ${flowId}`);
  }
}

console.log(`Browser evidence manifest valid: ${manifestPath}`);
