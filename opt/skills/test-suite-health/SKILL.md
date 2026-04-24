---
name: test-suite-health
description: Analyze test suite health over a rolling 7-day window using the Empirical API. Use this skill when the user asks about test health, test stability, flake rates, run times, or anything related to how their test suite is performing. Also trigger when the user mentions "test dashboard", "flaky tests", "run stability", "weekly test report", or "days since last test added".
---
You are a test suite health analyzer. You compute rolling 7-day health metrics by calling the Empirical API (https://dash.empirical.run). All endpoints require `Authorization: Bearer $EMPIRICALRUN_API_KEY`. Base URL: `$DASHBOARD_DOMAIN`.

Present results as **ASCII line graphs** — one per metric, showing a trend over the last 7 days, with one line per environment. Do not show a single-number scorecard.

> **Do not show Run Stability / green run rate.** That data is already surfaced in the app's Analytics tab.

---

## Data Fetching Strategy

### Step 1 — Get environments
```
GET /api/environments/list
```
Returns all configured environments. Use `id` for API calls, `slug` for matching run data.

### Step 2 — Get daily analytics (per environment + all)
```
GET /api/v1/analytics/test-runs?days=7
GET /api/v1/analytics/test-runs?days=7&environment_id=<id>   (once per env)
```
Each response has `data.daily[]` — one entry per day with:
- `date` (YYYY-MM-DD), `total_tests`, `flaky_tests`

### Step 3 — Get ended test runs (for duration)
```
GET /api/test-runs?interval_in_days=7&state=ended&per_page=100
```
Each run: `run_started_at`, `environment_slug`, `duration` (seconds), `total_count`.
Filter out partial runs with `total_count < 50`. Group by date + env, compute **median** duration per day.

### Step 4 — Get last test added
```
GET /api/test-cases/v2?per_page=100
```
Sort by `created_at` descending. The first result is the most recently added test.

---

## Metrics to Compute

### 1. Flake Rate per Day
`flake_pct = flaky_tests / total_tests * 100`  per day, per environment.

### 2. Median Run Duration per Day
Median of `duration` (seconds) across all full runs (total_count > 50) per day, per environment.

### 3. Days Since Last Test Added
`(today - last_created_at).days`. Flags: 🟢 0–3 days, 🟡 4–7 days, 🔴 > 7 days.

---

## Presentation: ASCII Line Graphs

Render each metric as an ASCII line graph. Use:
- **Y-axis** on the left with labeled tick marks (every ~3 rows)
- **X-axis** at the bottom with date labels
- **One line per environment**, drawn with interpolated `/`, `\`, `─` characters
- **Distinct symbols** per series at each data point: `●` All, `◆` Prod, `■` Preview
- Horizontal dotted grid lines (`·`) at each Y-axis tick level
- **Legend** below each graph

Example output:
```
────────────────────────────────────────────────────────────────────────
  📊 Flake Rate (%)
────────────────────────────────────────────────────────────────────────
     4.3%┤│········································································
          │
          │         ────■                 ■\
     3.3%┤│····■────·····\···············/··\\····························────■····
          │         ────●\\             //●── \\          ──■────────■────
          │    ●────      \\           //    ───\\    ──────◆──  ────●──
     2.3%┤│·················\\·──◆────/··········─\■──────·····────·····────·······
          │                ──\─\   ///────◆────────◆──             ──◆─     ──●
          │    ◆────────◆──   \ \●/ /
     1.3%┤│····················\···/······································───······
          │                     \ /                                          ─◆
          │                      ■
     0.3%┤│········································································
          │
          └────────────────────────────────────────────────────────────────────────
             04-17    04-18    04-19    04-20    04-21    04-22    04-23    04-24

    ● All   ◆ Prod   ■ Preview
```

---

## Python Script

Use `python3` with `$DASHBOARD_DOMAIN` and `$EMPIRICALRUN_API_KEY` passed as `sys.argv` to avoid shell interpolation issues in heredocs:

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

# ─── Fetch ────────────────────────────────────────────────────────────────────
daily_all  = get("/api/v1/analytics/test-runs?days=7")["data"]["daily"]
daily_prod = get("/api/v1/analytics/test-runs?days=7&environment_id=<prod_id>")["data"]["daily"]
daily_prev = get("/api/v1/analytics/test-runs?days=7&environment_id=<preview_id>")["data"]["daily"]
runs_raw   = get("/api/test-runs?interval_in_days=7&state=ended&per_page=100")["data"]["test_runs"]["items"]
cases_raw  = get("/api/test-cases/v2?per_page=100")["data"]["test_cases"]

# ─── Duration per day per env ─────────────────────────────────────────────────
dur_by_day_env = defaultdict(lambda: defaultdict(list))
for r in runs_raw:
    date = r["run_started_at"][:10]
    env  = r.get("environment_slug", "?")
    dur  = r.get("duration", 0)
    if dur and r.get("total_count", 0) > 50:
        dur_by_day_env[date][env].append(dur)
        dur_by_day_env[date]["all"].append(dur)

def med(lst):
    lst = [x for x in lst if x is not None]
    return statistics.median(lst) if lst else None

def flake_pct(day):
    t = day["total_tests"]; f = day["flaky_tests"]
    return round(f/t*100, 1) if t else None

def fmt_dur(secs):
    if secs is None: return "–"
    return f"{int(secs//60)}m{int(secs%60):02d}s"

# ─── Series ───────────────────────────────────────────────────────────────────
dates      = [d["date"] for d in daily_all]
date_short = [d[5:] for d in dates]

flake_all  = [flake_pct(d) for d in daily_all]
flake_prod = [flake_pct(d) for d in daily_prod]
flake_prev = [flake_pct(d) for d in daily_prev]

dur_all  = [med(dur_by_day_env.get(d, {}).get("all", []))           for d in dates]
dur_prod = [med(dur_by_day_env.get(d, {}).get("production", []))    for d in dates]
dur_prev = [med(dur_by_day_env.get(d, {}).get("preview", []))       for d in dates]

# ─── Last test added ──────────────────────────────────────────────────────────
cases_sorted = sorted(cases_raw, key=lambda x: x.get("created_at",""), reverse=True)
last     = cases_sorted[0]
last_dt  = datetime.fromisoformat(last["created_at"].replace("Z","+00:00"))
days_ago = (datetime.now(timezone.utc) - last_dt).days
commit   = str(last.get("first_seen_commit_sha","?"))[:7]
flag     = "🟢" if days_ago <= 3 else ("🟡" if days_ago <= 7 else "🔴")

# ─── Line graph renderer ──────────────────────────────────────────────────────
HEIGHT   = 14
COL_W    = 9
Y_AXIS_W = 9
SYMBOLS  = ['●', '◆', '■']

def render_line_graph(title, series_data, dates_short, fmt_y):
    N = len(dates_short)
    TOTAL_W = Y_AXIS_W + COL_W * N

    all_vals = [v for s in series_data.values() for v in s if v is not None]
    if not all_vals:
        print(f"  [No data for {title}]"); return

    y_min = 0
    y_max = max(all_vals) * 1.15 + 0.01

    canvas = [[' '] * TOTAL_W for _ in range(HEIGHT)]

    def val_to_row(v):
        if v is None: return None
        v = max(y_min, min(y_max, v))
        row = HEIGHT - 1 - round((v - y_min) / (y_max - y_min) * (HEIGHT - 1))
        return max(0, min(HEIGHT - 1, int(row)))

    def col_cx(ci):
        return Y_AXIS_W + ci * COL_W + COL_W // 2

    # Horizontal dotted grid lines
    tick_rows = list(range(0, HEIGHT, HEIGHT // 4))
    for r in tick_rows:
        for x in range(Y_AXIS_W, TOTAL_W):
            canvas[r][x] = '·'

    # Draw each series
    for si, (name, series) in enumerate(series_data.items()):
        sym  = SYMBOLS[si % len(SYMBOLS)]
        rows = [val_to_row(v) for v in series]

        for ci in range(N - 1):
            r1 = rows[ci]; r2 = rows[ci + 1]
            if r1 is None or r2 is None: continue
            x1 = col_cx(ci); x2 = col_cx(ci + 1)
            for x in range(x1 + 1, x2):
                t    = (x - x1) / (x2 - x1)
                rint = int(round(r1 + (r2 - r1) * t))
                slope = (r2 - r1) / (x2 - x1)
                ch = '/' if slope < -0.35 else ('\\' if slope > 0.35 else '─')
                if 0 <= rint < HEIGHT and canvas[rint][x] in (' ', '·', '─', '/', '\\'):
                    canvas[rint][x] = ch

        for ci, v in enumerate(series):
            r = rows[ci]
            if r is not None:
                canvas[r][col_cx(ci)] = sym

    # Y-axis
    for r in range(HEIGHT):
        canvas[r][Y_AXIS_W - 1] = '│'
    for r in tick_rows:
        y_val = y_min + (y_max - y_min) * (HEIGHT - 1 - r) / (HEIGHT - 1)
        label = fmt_y(y_val).rjust(Y_AXIS_W - 2)
        for i, ch in enumerate(label[:Y_AXIS_W - 2]):
            canvas[r][i] = ch
        canvas[r][Y_AXIS_W - 2] = '┤'

    print(f"\n{'─'*72}")
    print(f"  {title}")
    print(f"{'─'*72}")
    for row in canvas:
        print("  " + "".join(row))
    print("  " + " " * (Y_AXIS_W - 1) + "└" + "─" * (COL_W * N))
    xlabels = " " * Y_AXIS_W + "".join(f"{d:^{COL_W}}" for d in dates_short)
    print("  " + xlabels)
    legend = "  ".join(f"{SYMBOLS[i]} {name}" for i, name in enumerate(series_data.keys()))
    print(f"\n  {legend}")

# ─── Render ───────────────────────────────────────────────────────────────────
print()
print("╔══════════════════════════════════════════════════════════════════════╗")
print("║              TEST SUITE HEALTH  —  last 7 days                     ║")
print("╚══════════════════════════════════════════════════════════════════════╝")

render_line_graph(
    "📊 Flake Rate (%)",
    {"All": flake_all, "Prod": flake_prod, "Preview": flake_prev},
    date_short,
    fmt_y=lambda v: f"{v:.1f}%",
)

render_line_graph(
    "⏱  Median Run Duration",
    {"All": dur_all, "Prod": dur_prod, "Preview": dur_prev},
    date_short,
    fmt_y=lambda v: f"{int(v//60)}m{int(v%60):02d}s",
)

print(f"\n{'─'*72}")
print(f"  📅 Last Test Added")
print(f"{'─'*72}")
print(f"  {days_ago} days ago {flag}  —  \"{last['name'][:65]}\"")
print(f"  commit {commit}  ·  {last_dt.strftime('%b %d, %Y')}")
print()
PYEOF
```

---

## Deep Dive (optional — only when a metric is clearly worsening)

If flake rate is trending up or duration is trending up over the 7-day window, optionally append a brief deep dive.

**Flake rate worsening:**
```
GET /api/v1/analytics/test-cases?days=7&order_by=flaky_rate&order=desc&limit=10
```
Name the top 1–2 flaky tests. Classify as app-side (multiple tests, same run day) or test-side (one test, repeated across many runs).

**Duration worsening:**
- Did run count grow? More tests = expected longer run.
- Did flake count grow? Retries inflate duration.
- Scan the `duration` field in runs list for outlier runs (date + env).

Keep each block to 3–5 lines. Name specific tests, dates, or errors — no vague statements.
