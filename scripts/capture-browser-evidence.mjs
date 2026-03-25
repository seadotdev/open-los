#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';

const outDir = 'artifacts/browser-evidence';
mkdirSync(outDir, { recursive: true });

const manifest = {
  generatedAt: new Date().toISOString(),
  entrypoint: 'frontend index pages',
  actor: process.env.BROWSER_EVIDENCE_ACTOR ?? 'ci-bot',
  flows: [
    { id: 'traditional-home', path: 'frontend/traditional/index.html' },
    { id: 'experimental-home', path: 'frontend/experimental/index.html' },
  ],
};

writeFileSync(`${outDir}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${outDir}/manifest.json`);
