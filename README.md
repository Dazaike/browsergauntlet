# BrowserGauntlet

An interactive obstacle course for benchmarking **browser automation tools, AI browser agents and computer-use models**. 61 real challenges (typing, clicking, dragging, holding, drawing, pickers, iframes, shadow DOM, multi-page flows, ...) with strict, deterministic validation and an objective score.

No backend, no auth. All state (progress, settings, activity log) lives in `localStorage` and survives reloads.

Stack: React 19 + TypeScript, Vite, Tailwind CSS v4, shadcn/ui (Radix), Framer Motion, Lucide, Zustand, React Router.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
# or a production build
npm run build && npm run preview   # http://localhost:4173
```

Playwright demo suite (representative challenges):

```bash
npx playwright install chromium
npm run test:e2e
```

## How it works

| Route | What |
| --- | --- |
| `/` | Dashboard: completed, success rate, total / average / fastest time, failed attempts, score, per-level progress |
| `/challenges` | Searchable index of all 61 challenges |
| `/challenge/<slug>` | One challenge (e.g. `/challenge/slider`, `/challenge/iframe`) |
| `/modes` | Mode picker, deterministic seed, stress settings, start a run |
| `/results` | Final results: completion %, elapsed time, per-category chart, history, retry failed, JSON/CSV export |
| `/activity` | Full terminal-style activity log with success / failure / interaction / system filters |
| `/report` | Read-only JSON report (`#report-json`) + downloads |

Levels: 1 Basic · 2 Mouse & Pointer · 3 Keyboard · 4 Advanced Forms · 5 Dynamic Website · 6 Complex Scenarios · 7 Special Interactions (iframe, shadow DOM, custom scrollbars, moving targets, hover traps, keyboard-only widgets, simulated network, ...).

### Modes

- **Practice**: unlimited attempts, hints, no limits, any challenge on its own.
- **Challenge**: sequential run, per-challenge time limit, limited retries (defaults 120 s / 3), final score. Start from `/modes`.
- **Stress test**: seeded random order, interaction delay, simulated network latency, dynamic elements (late layout shifts, mid-task re-shuffles).

### Scoring

Per passed challenge: `70` base + up to `30` time bonus (full at or below the challenge's par time, linear to zero at 4x par) − `10` per failed attempt − `5` per hint, floored at `10`. Failed challenges score 0. The dashboard shows the sum, the maximum (`100 x challenges`) and a normalised 0-1000 index. Success rate = passed attempts / all attempts.

### Determinism

Every target, option order and random delay derives from `seed`. Same seed gives the same puzzle on every machine. Configure from the URL (applied once at startup):

```
/challenge/slider?seed=demo
/?mode=stress&seed=demo&delay=300&latency=500&dynamic=1&autostart=1
```

| Param | Meaning |
| --- | --- |
| `seed` | Seed string |
| `mode` | `practice` / `challenge` / `stress` (non-practice starts a run unless one of that mode exists; `autostart=1` forces a fresh run) |
| `delay`, `latency` | Stress delay / network latency in ms |
| `dynamic` | `1`/`true` enables dynamic elements |
| `retries`, `limit` | Retries per challenge, time limit in seconds (0 = none) |
| `fresh` | `1` wipes saved progress first |

### For automation tools

- Every challenge body is `section#challenge-cNN[data-testid=challenge-body]` with `data-status` = `idle | active | passed | failed`.
- Task targets are in `[data-testid=task]`; every target value is its own `[data-testid=task-target]` element, in reading order.
- Controls have stable ids / `data-testid`s prefixed with the challenge id (`c01-...`) and accessible names. Submit-style actions are `#cNN-submit` / `-confirm` / `-check` / `-verify`.
- Header exposes `[data-testid=challenge-status]`, `challenge-timer`, `challenge-attempts`, `challenge-failures`; reset is `#reset-button`; next is `#next-challenge-link`.
- Feedback lines are `[data-testid=feedback][data-state=...]` with `role=status`.
- Results: `window.browserGauntlet.getReport()` (read-only object), `/report` (`#report-json`), or the export buttons on `/results`.
- Pointer challenges use genuine Pointer Events with pointer capture; hold timings use `performance.now()` between the real pointerdown and pointerup; drops are validated by the pointer position on release.
- Nothing is ever auto-completed: a challenge turns `passed` only when its validation function accepts the real interaction.

## Project layout

```
src/
  challenges/
    meta.ts            titles, objectives, success/failure conditions, hints, par times
    types.ts           ChallengeApi contract (rng, log, succeed, fail, request, delay)
    kit.tsx            Task / Target / Feedback helpers
    ChallengeShell.tsx timer, attempts, reset, hints, retries, time limit, log
    level1..level7/    one component per challenge + barrel index.ts
  lib/                 store (zustand + localStorage), scoring, stats, report, prng
  pages/, components/  dashboard, results, modes, sidebar, activity log, shadcn ui
tests/                 Playwright demo suite
```

### Adding a challenge

1. Add a row to `src/challenges/meta.ts` (it fixes the id, slug, objective, success and failure text).
2. Write `src/challenges/levelN/CNNName.tsx` with a default export taking `{ api, status }`, using `api.rng()` for targets, `api.succeed()` / `api.fail()` for outcomes.
3. Register it in `levelN/index.ts`.

## Notes

- StrictMode is intentionally disabled so effects run once and the activity log contains no duplicate events.
- All simulated purchases, bookings, messages and registrations stay local to the page.
