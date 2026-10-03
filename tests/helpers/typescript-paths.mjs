// Node's native TS runner does not read the Vite/tsconfig @/ alias.
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
const sourceRoot = new URL('../../src/', import.meta.url);
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const path = new URL(specifier.slice(2), sourceRoot);
    for (const suffix of ['', '.ts', '.tsx', '.js']) {
      const candidate = new URL(path.href + suffix);
      if (existsSync(candidate)) return nextResolve(candidate.href, context);
    }
  }
  return nextResolve(specifier, context);
} });
