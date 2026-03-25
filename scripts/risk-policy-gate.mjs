#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

function globToRegExp(glob) {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '::DOUBLE_STAR::')
    .replace(/\*/g, '[^/]*')
    .replace(/::DOUBLE_STAR::/g, '.*');
  return new RegExp(`^${escaped}$`);
}

function matchesAny(file, patterns) {
  return patterns.some((pattern) => globToRegExp(pattern).test(file));
}

function hasRef(ref) {
  try {
    execSync(`git rev-parse --verify ${ref}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function getChangedFiles(baseRef, headRef) {
  if (!hasRef(baseRef)) {
    const tracked = execSync('git diff --name-only HEAD', { encoding: 'utf8' })
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean);
    const untracked = execSync('git ls-files --others --exclude-standard', { encoding: 'utf8' })
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean);

    return [...new Set([...tracked, ...untracked])];
  }

  const output = execSync(`git diff --name-only ${baseRef}...${headRef}`, { encoding: 'utf8' });
  return output.split('\n').map((x) => x.trim()).filter(Boolean);
}

function assertDocsDriftRules(changedFiles, docsDriftRules) {
  const changedControlPlane = changedFiles.some((file) => matchesAny(file, docsDriftRules.controlPlanePaths));
  if (!changedControlPlane) {
    return;
  }

  const touchedDocs = changedFiles.filter((file) => docsDriftRules.requiredDocs.includes(file));
  if (touchedDocs.length === 0) {
    throw new Error(
      `Control-plane files changed without docs updates. Update one of: ${docsDriftRules.requiredDocs.join(', ')}`,
    );
  }
}

function computeRiskTier(changedFiles, riskTierRules) {
  if (changedFiles.some((file) => matchesAny(file, riskTierRules.high))) {
    return 'high';
  }

  return 'low';
}

function needsBrowserEvidence(changedFiles, evidenceRules) {
  return changedFiles.some((file) => matchesAny(file, evidenceRules.uiPaths));
}

function main() {
  const baseRef = process.env.BASE_REF ?? 'origin/main';
  const headRef = process.env.HEAD_REF ?? 'HEAD';
  const contractPath = process.env.RISK_POLICY_CONTRACT ?? '.harness-risk-policy.json';
  const contract = JSON.parse(readFileSync(contractPath, 'utf8'));

  const changedFiles = getChangedFiles(baseRef, headRef);
  const riskTier = computeRiskTier(changedFiles, contract.riskTierRules);
  const requiredChecks = [...contract.mergePolicy[riskTier].requiredChecks];

  assertDocsDriftRules(changedFiles, contract.docsDriftRules);

  if (needsBrowserEvidence(changedFiles, contract.evidenceRules) && !requiredChecks.includes('Browser Evidence')) {
    requiredChecks.push('Browser Evidence');
  }

  const requiresReviewAgent = contract.reviewAgent.requiredForTiers.includes(riskTier);

  const summary = {
    changedFiles,
    riskTier,
    requiredChecks,
    requiresReviewAgent,
    reviewAgentCheckName: contract.reviewAgent.checkName,
    reviewAgentTimeoutMinutes: contract.reviewAgent.timeoutMinutes,
  };

  console.log(JSON.stringify(summary, null, 2));
}

main();
