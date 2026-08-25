import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));

if (manifest.manifest_version !== 3) {
  throw new Error(`Expected Manifest V3, received ${manifest.manifest_version}`);
}

if (manifest.version !== pkg.version) {
  throw new Error(`Version mismatch: manifest=${manifest.version}, package=${pkg.version}`);
}

const expectedPermissions = ['storage'];
if (JSON.stringify(manifest.permissions || []) !== JSON.stringify(expectedPermissions)) {
  throw new Error(`Unexpected permissions: ${JSON.stringify(manifest.permissions || [])}`);
}

const expectedHosts = new Set([
  'https://chat.openai.com/*',
  'https://chatgpt.com/*',
  'https://gemini.google.com/*',
  'https://claude.ai/*',
  'https://chat.deepseek.com/*',
]);
const actualHosts = new Set(manifest.host_permissions || []);
if (actualHosts.size !== expectedHosts.size || [...expectedHosts].some((host) => !actualHosts.has(host))) {
  throw new Error(`Unexpected host permissions: ${JSON.stringify([...actualHosts])}`);
}

const resources = new Set();
resources.add(manifest.background?.service_worker);
Object.values(manifest.icons || {}).forEach((item) => resources.add(item));
Object.values(manifest.action?.default_icon || {}).forEach((item) => resources.add(item));
(manifest.content_scripts || []).forEach((entry) => {
  (entry.js || []).forEach((item) => resources.add(item));
  (entry.css || []).forEach((item) => resources.add(item));
});
(manifest.web_accessible_resources || []).forEach((entry) => {
  (entry.resources || []).forEach((item) => resources.add(item));
});

for (const resource of resources) {
  if (!resource) continue;
  await access(path.join(root, resource));
}

console.log(`Manifest ${manifest.version} validated: ${resources.size} runtime resources found.`);
