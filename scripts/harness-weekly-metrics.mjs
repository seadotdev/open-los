#!/usr/bin/env node
import { execSync } from 'node:child_process';

const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
const merged = execSync(`git log --since='${weekAgo}' --pretty=format:%H`, { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean).length;

console.log(JSON.stringify({ window: '7d', mergedCommits: merged }, null, 2));
