---
name: test-suite-health
description: Analyze test suite health over a rolling 7-day window using the Empirical API. Use this skill when the user asks about test health, test stability, flake rates, run times, or anything related to how their test suite is performing. Also trigger when the user mentions "test dashboard", "flaky tests", "run stability", "weekly test report", or "days since last test added".
---
You are a test suite health analyzer. You compute rolling 7-day health metrics by calling the Empirical API (https://dash.empirical.run). All endpoints require `Authorization: Bearer $EMPIRICALRUN_API_KEY`. Base URL: `$DASHBOARD_DOMAIN`.

Present results as **trend charts over the last 7 days** — grouped by environment. Do not show a single-number scorecard. Show sparklines and bar values so the user can see how each metric moved day-by-day.

> **Do not show Run Stability / green run rate.** That data is already surfaced in the app's Analytics tab.

---

## Data Fetching Strategy

### Step 1 — Get environments
```
GET /api/environments/list
```
Returns all configured environments. Use `id` for API calls and `name`/`slug` for display.

### Step 2 — Get daily analytics (per environment + all)
```
GET /api/v1/analytics/test-runs?days=7
GET /api/v1/analytics/test-runs?days=7&environment_id=<id>   (once per env)
```
Each response has `data.daily[]` — one entry per day with:
- `date` (YYYY-MM-DD)
- `total_tests`, `flaky_tests` — for computing flake rate
- `run_count`, `passed_runs`, `failed_runs`

### Step 3 — Get ended test runs (for duration)
```
GET /api/test-runs?interval_in_days=7&state=ended&per_page=100
```
Each run has `run_started_at`, `environment_slug`, `duration` (seconds), `total_count`.
Filter out partial/mini runs with `total_count < 50` before computing medians.
Group by date and environment, then compute **median** duration per day per env.

### Step 4 — Get last test added
```
GET /api/test-cases/v2?per_page=100
```
Sort by `created_at` descending. The first result is the most recently added test.
Report `name`, `first_seen_commit_sha[:7]`, and days since `created_at`.

---

## Metrics to Compute

### 1. Flake Rate per Day
For each day in each environment: `flake_pct = flaky_tests / total_tests * 100`

Thresholds (for context, not for scorecards): 🟢 ≤ 2%, 🟡 2–5%, 🔴 > 5%

### 2. Median Run Duration per Day
For each day: median of `duration` (seconds) across all full runs (total_count > 50).

### 3. Days Since Last Test Added
Single value: `(today - last_created_at).days`

Thresholds: 🟢 0–3 days, 🟡 4–7 days, 🔴 > 7 days.

---

## Presentation Rules

### Chart format
Render each metric as a **columnar trend table** with a **sparkline** column on the right.

Use Unicode block chars for sparklines: `▁▂▃▄▅▆▇█`
- Scale all bars in a chart to the same `0 → max_value` range across all environments.
- Use `·` for missing data (no runs that day).

**Example layout:**

```
──────────────────────────────────────────────────────────────────────
  📊 Flake Rate (%)  — flaky_tests / total_tests per day
──────────────────────────────────────────────────────────────────────
                04-17    04-18    04-19    04-20    04-21    04-22    04-23    04-24
            ────────────────────────────────────────────────────────────────────────
  All            3.0%     3.0%     1.8%     2.9%     2.2%     2.9%     2.6%     2.0%   ▆▆▄▅▄▅▅▄
  Prod           1.5%     1.6%     2.3%     1.9%     2.0%     2.7%     1.9%     0.9%   ▃▃▄▄▄▅▄▂
  Preview        4.1%     3.7%     0.8%     3.7%     2.3%     3.1%     3.0%     3.5%   █▇▂▇▄▆▆▆

──────────────────────────────────────────────────────────────────────
  ⏱  Median Run Duration  — full runs only (>50 tests)
──────────────────────────────────────────────────────────────────────
                04-17    04-18    04-19    04-20    04-21    04-22    04-23    04-24
            ────────────────────────────────────────────────────────────────────────
  All               –   20m54s   11m04s   16m16s   11m35s   11m21s   11m53s   11m57s   ·▆▃▅▃▃▄▄
  Prod              –   10m57s   10m57s   12m13s   10m42s   10m47s    9m41s    9m57s   ·▃▃▄▃▃▃▃
  Preview           –   22m57s   27m25s   16m43s   11m52s   11m21s   12m16s   14m05s   ·▆█▅▄▃▄▄

──────────────────────────────────────────────────────────────────────
  📅 Last Test Added
──────────────────────────────────────────────────────────────────────
  9 days ago 🔴  —  "plain text paste into new session dialog prompt input"
  commit 587eada  ·  Apr 14, 2026

──────────────────────────────────────────────────────────────────────
  📈 Trend  (days 1-3  →  days 5-7)
──────────────────────────────────────────────────────────────────────
  Env                Flake Rate             Duration
  ───                ──────────             ────────
  All          2.6% → 2.4%  ↓ 🟢   15m59s → 11m42s  ↓ 🟢
  Prod       1.8% → 1.9%  → stable   10m57s → 10m17s  ↓ 🟢
  Preview      2.9% → 3.0%  ↑ 🔴   25m11s → 12m24s  ↓ 🟢
```

### Trend summary (always shown after charts)
Compare the **mean of the first 3 days** vs the **mean of the last 3 days** for each metric. Show direction and a 🟢/🔴 mood indicator:
- For flake rate: `↑ 🔴` = getting worse, `↓ 🟢` = improving
- For duration: `↓ 🟢` = faster, `↑ 🔴` = slower
- `→ stable` if delta < 0.1%

### Last Test Added
Show once as a standalone block (it's project-wide, not per-env). Use threshold emojis.

---

## Deep Dive (optional — only when explicitly asked or a metric is clearly worsening)

If flake rate or duration shows a `↑ 🔴` trend, optionally append a brief deep dive:

**Flake rate worsening:**
```
GET /api/v1/analytics/test-cases?days=7&order_by=flaky_rate&order=desc&limit=10
```
Name the top 1–2 flaky tests and their rate. Classify as app-side (multiple tests, same run) or test-side (one test, repeated pattern).

**Duration worsening:**
- Check if run count grew (more tests = expected slower).
- Check if flake count grew (retries inflate duration).
- Find the slowest run by scanning `duration` in the runs list and note its date + env.

Keep each deep dive block to 3–5 lines. No vague statements — name the specific test, date, or error.

---

## Python script pattern

Use `python3` to compute medians and render sparklines. Pass `$DASHBOARD_DOMAIN` and `$EMPIRICALRUN_API_KEY` as `sys.argv[1]` and `sys.argv[2]` to avoid shell interpolation issues:

```bash
source .env.example 2>/dev/null || true

python3 - "$DASHBOARD_DOMAIN" "$EMPIRICALRUN_API_KEY" << 'PYEOF'
import json, sys, statistics, urllib.request
from datetime import datetime, timezone
from collections import defaultdict

BASE, KEY = sys.argv[1], sys.argv[2]

def get(path):
    req = urllib.request.Request(f"{BASE}{path}", headers={"Authorization": f"Bearer {KEY}"})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

BARS = "▁▂▃▄▅▆▇█"

def sparkline(values, lo=0, hi=None):
    vals = [v for v in values if v is not None]
    if not vals: return "─" * len(values)
    hi = hi if hi is not None else max(vals)
    span = hi - lo if hi != lo else 1
    out = []
    for v in values:
        if v is None: out.append("·")
        else:
            idx = min(int((v - lo) / span * 7), 7)
            out.append(BARS[idx])
    return "".join(out)

def fmt_dur(secs):
    if secs is None: return "–"
    return f"{int(secs//60)}m{int(secs%60):02d}s"

def med(lst):
    lst = [x for x in lst if x is not None]
    return statistics.median(lst) if lst else None

def flake_pct(day):
    t = day["total_tests"]; f = day["flaky_tests"]
    return round(f/t*100, 1) if t else None

COL = 9  # column width for each day

def render_chart(title, envs, fmt_val, dates_short):
    print(f"\n{'─'*70}")
    print(f"  {title}")
    print(f"{'─'*70}")
    print("            " + "".join(f"{d:>{COL}}" for d in dates_short))
    print("            " + "─"*(COL*len(dates_short)))
    all_vals = [v for s in envs.values() for v in s if v is not None]
    max_v = max(all_vals) if all_vals else 1
    for env_name, series in envs.items():
        spark = sparkline(series, lo=0, hi=max_v)
        row = "".join(f"{fmt_val(v):>{COL}}" if v is not None else f"{'–':>{COL}}" for v in series)
        print(f"  {env_name:<9s} {row}   {spark}")

# ... fetch data, compute series, call render_chart() ...
PYEOF
```
