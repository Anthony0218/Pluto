import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';

test('Supabase migration versions are unique so deployment history cannot collide', () => {
  const versions = new Map();
  for (const name of readdirSync(new URL('../supabase/migrations/', import.meta.url)).filter(name => name.endsWith('.sql'))) {
    const match = /^(\d{14})_.+\.sql$/.exec(name);
    assert.ok(match, `Invalid migration filename: ${name}`);
    const version = match[1];
    assert.ok(!versions.has(version), `Migration version ${version} is shared by ${versions.get(version)} and ${name}`);
    versions.set(version, name);
  }
});
