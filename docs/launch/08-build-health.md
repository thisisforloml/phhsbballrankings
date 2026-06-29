# LC1 — Build Health

**Audit date:** 2026-06-28  
**P0 fix:** 2026-06-28  
**Verified:** 2026-06-28 (typecheck + build re-run)  
**Environment:** Windows, Node via `npx`, repo `D:\OnCourt Rankings PH`

## Commands run (post P0)

### `npm run typecheck`

```
Status: PASS (exit 0, ~7.5s)
Script: tsc --noEmit
Scope: src/** only
```

`scripts/` excluded from root `tsconfig.json`. Optional `npm run typecheck:scripts` for CLI tools.

### `npm run build` (`prisma generate && next build`)

| Stage | Result |
|-------|--------|
| Prisma generate | PASS (stop dev server if EPERM on query engine DLL) |
| Webpack / CSS compile | PASS |
| Typecheck phase | PASS — scripts no longer in app tsconfig |
| Page data collection | PASS — env validation skips build phase (`NEXT_PHASE`) |

**Note:** First build attempt failed on stale `.next/types` (clean `.next` and retry). Env assert initially blocked page collection until build-phase skip was added to `src/lib/env.ts`.

### `npm run lint`

```
Status: FAILED (interactive)
Reason: No ESLint config present — Next.js prompts for initial setup
```

**Classification:** Tooling issue — not a launch blocker.

## Configuration changes (P0)

| File | Change |
|------|--------|
| `tsconfig.json` | `include` narrowed to `src/**`; `exclude` adds `scripts` |
| `tsconfig.scripts.json` | New — optional typecheck for `scripts/**` |
| `package.json` | Added `typecheck`, `typecheck:scripts` scripts |
| `src/lib/env.ts` | Skip `assertProductionEnv()` during `next build` (`NEXT_PHASE=phase-production-build`) |

## Differentiation

| Item | Launch blocker? | Status |
|------|-----------------|--------|
| App typecheck / build | Was **Yes** | **Fixed** |
| `scripts/*.ts` type errors | No (dev-only) | Excluded from app build |
| Prisma EPERM on generate | Environment | Stop dev server before build |
| ESLint missing | No | Deferred |

## Verify locally

```bash
npm run typecheck
npm run build
```

See `docs/launch/PRODUCTION_DEPLOYMENT.md` for deployment requirements.
