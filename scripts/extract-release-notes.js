#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function extractReleaseNotes(version) {
  const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');
  
  if (!fs.existsSync(changelogPath)) {
    console.log('Initial release');
    return;
  }

  const changelog = fs.readFileSync(changelogPath, 'utf8');
  const versionRegex = new RegExp(`^## \\[${version}\\]`, 'm');
  const nextVersionRegex = /^## \[/m;

  const versionIndex = changelog.search(versionRegex);
  if (versionIndex === -1) {
    console.log('Initial release');
    return;
  }

  // Find content after the version header
  const contentStart = changelog.indexOf('\n', versionIndex) + 1;
  const remainingContent = changelog.slice(contentStart);
  
  // Find next version or end of content
  const nextVersionIndex = remainingContent.search(nextVersionRegex);
  const releaseContent = nextVersionIndex === -1 
    ? remainingContent 
    : remainingContent.slice(0, nextVersionIndex);

  // Clean up and format the release notes
  const releaseNotes = releaseContent
    .trim()
    .split('\n')
    .filter(line => line.trim())
    .slice(0, 20) // Limit to first 20 lines
    .join('\n');

  console.log(releaseNotes || 'Initial release');
}

const version = process.argv[2];
if (!version) {
  console.error('Usage: node extract-release-notes.js <version>');
  process.exit(1);
}

extractReleaseNotes(version);