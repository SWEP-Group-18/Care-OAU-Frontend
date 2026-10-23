const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
const pages = ['index.html', ...walk('student'), ...walk('admin')].filter(p => p.endsWith('.html'));
const scripts = walk('assets/js').filter(p => p.endsWith('.js'));
for (const file of pages) {
  const source = fs.readFileSync(file, 'utf8');
  const ids = [...source.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set(ids).size, ids.length, `${file}: duplicate IDs`);
  for (const [, target] of source.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (/^(?:https?:|mailto:|tel:|#)/.test(target)) continue;
    assert.ok(fs.existsSync(path.resolve(path.dirname(file), target.split(/[?#]/)[0])), `${file}: broken link ${target}`);
  }
}
for (const file of scripts) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  for (const [, target] of fs.readFileSync(file, 'utf8').matchAll(/(?:from\s+|import\s*)['"](\.[^'"]+)['"]/g)) {
    assert.ok(fs.existsSync(path.resolve(path.dirname(file), target)), `${file}: missing module ${target}`);
  }
}
console.log(`PASS: ${pages.length} HTML pages, ${scripts.length} JavaScript modules, local links and unique IDs`);
