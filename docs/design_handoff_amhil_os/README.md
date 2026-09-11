# Handoff: AMHIL OS — personal operating system UI

## Overview

AMHIL OS is a private, single-user web application for tracking tasks, projects, goals, habits,
learning, time, clients, finance and a full historical activity timeline. The design in this bundle
covers the full application shell and twelve screens, in both dark and light themes, plus a mobile
shell.

The product intent: a **personal command center**, not a corporate ERP and not a todo app. Every
number shown is derived from database records (aggregates), never hand-entered.

## About the design files

`AMHIL OS.dc.html` in this folder is a **design reference created in HTML** — a prototype showing
intended look, layout and behavior. It is not production code to copy.

The task is to **recreate these designs in the target codebase** (the spec calls for Next.js +
TypeScript + Tailwind + Supabase/PostgreSQL) using that project's established patterns, components
and data layer. Mock data in the prototype exists only to make the layouts legible — in the real app
every value comes from a Postgres query.

Open the file directly in a browser to explore it. All navigation, view toggles, theme/device
switches and checkboxes are live.

## Fidelity

**High fidelity.** Final colors, typography, spacing, density, badge and chart treatments. Recreate
pixel-closely, substituting the codebase's own primitives (Tailwind tokens, shadcn/ui or equivalent)
where they map cleanly to the values documented below.

Two things are deliberately *not* final and should not be copied literally:

- Charts are CSS bar/progress primitives. In production use Recharts (per the spec) with the same
  palette and axis-label style.
- Icons: the prototype uses text/geometric marks only. Use the codebase's icon set (e.g. Lucide) at
  16px, `1.5px` stroke, in `--t4` for inactive and `--text` for active.

---

## Application shell

### Sidebar (desktop)

- Width `214px`, `flex: 0 0 214px`, full height, `padding: 18px 12px 12px`.
- Background `#0A2521` (dark teal) **in both themes**, text `#E6F2F0`, right border
  `rgba(255,255,255,0.07)`.
- Brand row: `22px` rounded square (`radius 6px`, background `#2DD4BF`, mono `11px` "A" in
  `#04211F`), gap `9px`, wordmark `13px / 600 / letter-spacing 0.02em`. Bottom padding `20px`.
- Nav items: `padding: 7px 9px`, `radius 7px`, `gap 1px` between items, label `13px`, right-aligned
  count in `IBM Plex Mono 10px`.
  - inactive: label `#9FBDB8`, count `#5C7A76`, weight 400
  - hover: background `rgba(255,255,255,0.06)`, label `#FFFFFF`
  - active: background `rgba(45,212,191,0.16)`, label `#FFFFFF`, weight 600, count `#2DD4BF`
- Order and counts: Dashboard, Tasks (14), Projects (4), Learning (6), Habits (5), Goals (4), Time,
  Clients (3), Finance, Timeline, Reports, Settings.
- Footer, separated by `1px solid rgba(255,255,255,0.08)`, `margin-top: 12px`,
  `padding: 12px 8px 4px`: `24px` circular avatar (`#22403C`, mono `10px` "AM" in `#9FBDB8`), name
  `12px`, sub-line mono `10px` `#7FA39E` reading `single-user · RLS on`.

### Topbar

`height: 54px`, `flex: 0 0 54px`, `background: var(--topbar)`, bottom border `1px solid var(--line)`,
`display: flex; align-items: center; gap: 10px; padding: 0 16px; overflow: hidden`.

Left to right:

1. Screen title — `14px / 600`, `white-space: nowrap`.
2. Screen meta — mono `11px` `var(--t7)`, ellipsis, shrinks first. Per screen:
   Dashboard `Wednesday, 26 August 2026` · Tasks `14 open · 3 overdue` ·
   Projects `9 projects · 4 active` · Learning `41h 50m total · 6 topics` ·
   Habits `6 active · 86% this week` · Goals `7 goals · 1 achieved` ·
   Time `31.5h this week · 23 entries` · Clients `8 records · 3 clients` ·
   Finance `August 2026 · MAD` · Timeline `1,284 events` · Reports `August 2026` ·
   Settings `private · single user`.
3. Spacer.
4. Search field — `flex: 1 1 210px; min-width: 96px`, `1px solid var(--line3)`, `radius 8px`,
   `padding: 6px 10px`, label `12px var(--t6)` "Search everything", trailing `⌘K` key cap
   (mono `10px`, `1px solid var(--line4)`, `radius 4px`, `padding: 1px 5px`). Hover raises border to
   `var(--line5)` and text to `var(--t3)`. Opens the command palette.
5. Date-range chip — `This Month ▾`, `1px solid var(--line3)`, `radius 8px`, `padding: 6px 10px`,
   `12px var(--t2)`, `flex: 0 0 auto`.
6. Theme segmented control — Dark | Light.
7. Device segmented control — Desktop | Mobile.
   Both: `1px solid var(--line3)`, `radius 8px`, `overflow: hidden`, each option
   `padding: 6px 10px; font-size: 12px`; selected = `background: var(--a13)`, `color: var(--text)`;
   unselected = `color: var(--t4)`. These two controls are **prototype affordances**: in production,
   theme belongs in Settings and the mobile layout is a media query, not a toggle.
8. Primary CTA — `+ New`, `background: var(--accent)`, `color: var(--onAccent)`, `12px / 600`,
   `padding: 7px 13px`, `radius 8px`, `flex: 0 0 auto`, hover `var(--accentHi)`.

### Content area

`flex: 1; overflow-y: auto; padding: 20px`. Every screen's content is capped at `max-width: 1560px`
and stacks in a `display: flex; flex-direction: column; gap: 14px` column (Dashboard uses `gap: 16px`).

### Card shell (used everywhere)

```
border: 1px solid var(--line);
background: var(--surface);
border-radius: 14px;
box-shadow: var(--cardShadow);
overflow: hidden;   /* when it contains rows */
```

Card header: `padding: 13px 15px`, bottom border `1px solid var(--line)`, title `13px / 600`,
optional right-side mono `10px var(--t7)` meta. Card body padding `14–15px`.

Table header row: `padding: 9px 15px`, `background: var(--surface2)`, bottom border
`1px solid var(--line)`, labels `10.5px`, `uppercase`, `letter-spacing: 0.07em`, `var(--t5)`.
Table body row: `padding: 11px 15px`, bottom border `1px solid var(--line2)`, hover
`background: var(--surface3)`. Row text `12.5px`; numeric and date cells are
`IBM Plex Mono 11px var(--t3)`, money cells `font-variant-numeric: tabular-nums`.

Progress bar: track `height: 3px; background: var(--track); border-radius: 2px`, fill = status color,
followed by a mono `10.5px var(--t2)` percentage in a `30px` right-aligned box.

Badge/pill: `font-size: 10.5px; padding: 2px 8px; border-radius: 999px`, foreground + background from
the status palette below.

Filter chip: `1px solid var(--line3)`, `radius 8px`, `padding: 5px 10px`, `12px var(--t3)`, trailing
`▾` in `9px var(--t7)`; hover border `var(--line5)`, text `var(--text)`.

---

## Screens

### 1. Dashboard

Fixed layout, top to bottom:

1. **Quick actions** — wrapping row, `gap: 6px`. Pills: `1px solid var(--line3)`,
   `background: var(--surface)`, `radius 999px`, `padding: 5px 12px`, `12px var(--t2)`; hover border
   `var(--barMid)`, text `var(--text)`, background `var(--a09)`. Labels: `+ New Task`, `+ Log Time`,
   `+ Log Learning`, `+ Complete Habit`, `+ Add Income`, `+ Add Expense`, `+ New Note`.
2. **Week stat tiles** — `grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px`.
   Each tile: card shell, `padding: 14px`; label `11px uppercase 0.07em var(--t5) / 500`; value
   `26px / 600 / letter-spacing -0.02em` with a `11px var(--t6)` unit baseline-aligned beside it;
   delta line mono `10px` (green for positive, red for negative, `var(--t4)` for neutral).
   Content: Tasks done `23` "this week" `+5 vs last week` · Hours worked `31.5 h`
   `−2.0 vs last week` · Learning `8h 35m` `+1h 20m` · Habits `86 %` `30 / 35 completions` ·
   Income `6,400 MAD` `2 invoices paid`.
3. **Today + Active projects** — `grid-template-columns: 1.15fr 1fr; gap: 12px; align-items: start`.
   - *Today* card: header "Today" + mono `Wed 26 Aug` + right-aligned overdue count in
     `var(--red)`. Task rows: `padding: 10px 15px`, `gap: 11px`; `15px` checkbox
     (`radius 4px`, `1px solid var(--line4)`; checked = `background var(--accent)`, `✓` in
     `var(--onAccent)`, title falls to `var(--t6)` with `line-through`); title `12.5px`; sub-line
     mono `10.5px var(--t7)` = `project · n/m subtasks`; priority pill; due cell mono `10.5px`,
     `52px` wide, right-aligned, red when overdue.
   - *Habits* sub-section inside the same card: `background: var(--surface2)` strip
     (`padding: 12px 15px`) with "HABITS" label and mono summary `2 / 5 today · best streak 42d`,
     then wrapping chips (`padding: 5px 11px 5px 8px`, `radius 999px`, `13px` ring dot). Completed
     chip = border `var(--g35)`, background `var(--g08)`, dot filled `var(--green)`; each chip shows
     its streak in mono `10px`.
   - *Active projects* card: rows of `padding: 12px 15px`; `6px` status dot, name `12.5px / 500`,
     right-aligned mono percentage; progress bar; then a mono `10.5px var(--t6)` row of
     `client · due date · hours · revenue` with revenue in `var(--amber)`.
4. **Learning / Finance / Goals** — `grid-template-columns: 1fr 1fr 1fr; gap: 12px`.
   - Learning: four progress rows (name, mono time, mono percent, bar in `var(--accent)`).
   - Finance · August: 2×2 metric grid (`Revenue 12,400`, `Expenses 2,180` red, `Net 10,220` green,
     `Unpaid 6,000` amber; label `10.5px uppercase`, value `18px / 600`), then a six-month bar
     sparkline `height: 62px`, `gap: 6px`, bars `radius 3px 3px 0 0`, past months `var(--barDim)`,
     previous month `var(--barMid)`, current month `var(--accent)`, mono `9.5px` month labels.
   - Goals: four rows with mono detail and `var(--amber)` bars.

### 2. Tasks

Own toolbar: segmented **List | Kanban | Calendar** (same segmented styling as the topbar controls,
`padding: 6px 14px`), right-aligned filter chips `Project`, `Status`, `Priority`, `Due date`, `Tags`.

- **List** — grid `26px 2.4fr 1.1fr 0.9fr 0.7fr 0.8fr 0.8fr`, columns
  `(checkbox) · Task · Project · Status · Priority · Due · Time`. Task cell carries a mono `10px`
  subtask sub-line. Status is a badge; priority is plain colored text; due is mono and turns red when
  overdue.
- **Kanban** — five columns `repeat(5, minmax(210px, 1fr))`, gap `12px`, each column
  `1px solid var(--line)`, `background: var(--surface2)`, `radius 14px`, `padding: 11px`. Column head:
  `6px` dot in the status color, name `12px / 600`, mono count. Cards: `1px solid var(--line3)`,
  `background: var(--surface)`, `radius 11px`, `padding: 10px 11px`, `cursor: grab`, hover border
  `var(--a40)`; title `12.5px / line-height 1.4`, then a footer row with a mono project chip
  (`background var(--chip)`), priority text and mono due date.
  Columns: Backlog `var(--t4)` · Todo `var(--t2)` · In Progress `var(--accent)` · Waiting
  `var(--amber)` · Done `var(--green)`.
- **Calendar** — 7 columns Mon→Sun; header cells `padding: 9px 12px`, `10.5px uppercase var(--t5)`.
  42 day cells (6 rows) so any month fits; `min-height: 96px`, `padding: 8px`, right/bottom borders
  `1px solid var(--line2)`. Day number mono `10.5px` (`var(--t3)` in month, `var(--t9)` outside,
  `var(--accent)` for today). Today's cell background `var(--a05)`. Events: `10.5px`, `radius 5px`,
  `padding: 3px 6px`, tinted by category. **August 2026 starts on Saturday** — offset the first cell
  by 5 blanks; in production compute the offset from the month.

### 3–7. Entity pages (Projects, Habits, Goals, Time, Clients)

These five share one generic pattern. Above the content sits a **view bar**:

`display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 14px` containing
(a) the **List | Kanban** segmented control, (b) 3–4 summary chips —
`1px solid var(--line)`, `background: var(--surface)`, `radius 999px`, `padding: 5px 13px`, label
`11px var(--t5)` + value `12.5px / 600` (tabular numerals, colored when meaningful), (c) a spacer,
(d) filter chips.

The **list** is the standard table; the **board** is the standard kanban, `grid-template-columns:
repeat(<n>, minmax(210px, 1fr))`. Board cards carry: title `12.5px`, mono `10px var(--t7)` sub-line,
optional progress bar in the column color, then a footer with a badge and a mono right-hand value.
Board column heads also show a mono aggregate on the right (hours, amount, entry count).

| Screen | List columns (grid) | Summary chips | Board grouping |
|---|---|---|---|
| **Projects** | Project · Client · Status · Progress · Hours · Revenue · Target — `2fr 1.1fr 0.9fr 1.1fr 0.7fr 0.9fr 0.8fr` | active 4 · hours 137h · revenue 39,700 · avg progress 46% | Idea, Planned, Active, On Hold, Completed (column head shows summed hours) |
| **Habits** | Habit · Frequency · Streak · Best · This week · This month · Consistency — `1.6fr 0.9fr 0.7fr 0.7fr 0.8fr 0.8fr 1.1fr` | today 2 / 5 · this week 86% · best streak 42d · active 6 | Daily, 3×/week, Weekly, Paused |
| **Goals** | Goal · Category · Target · Status · Progress · Linked to — `2.1fr 0.9fr 0.9fr 0.9fr 1.1fr 1.4fr` | active 4 · achieved 1 · at risk 1 · avg progress 45% | Planned, Active, At Risk, Achieved |
| **Time** | Date · Project · Task · Category · Duration(right) — `0.6fr 1.1fr 1.9fr 1fr 0.7fr` | this week 31.5h · client 14.2h · learning 8.6h · entries 23 | Client work, Learning, AMHIL OS, Admin (head shows entry count) |
| **Clients** | Client · Company · Country · Source · Status · Projects · Revenue(right) — `1.4fr 1.2fr 0.8fr 0.9fr 1fr 0.9fr 1fr` | clients 3 · pipeline 4 · pipeline value 46,000 · conversion 38% | Lead, Contacted, Proposal, Negotiation, Client |

Consistency and progress bars switch color by value: `≥80% var(--green)`, `≥50% var(--accent)`,
below that `var(--amber)`.

### 8. Learning

**List view** (bespoke):

1. Area cards — `repeat(auto-fit, minmax(180px, 1fr))`. Each: `7px` rounded square in the area color,
   name `12.5px / 500`, hours `21px / 600` with a mono topic count beside it, then a progress bar in
   the area color. Areas and colors: Odoo `var(--accent)`, Web Development `var(--blue)`, Business
   `var(--amber)`, Marketing `var(--green)`, Languages `var(--pink)`.
2. `grid-template-columns: 1.6fr 1fr; gap: 12px`:
   - *Topics · Odoo* table — Topic · Status · Progress · Time · Confidence
     (`1.5fr 0.9fr 1fr 0.8fr 0.9fr`). Confidence renders as a mono 10-slot dot meter
     (`●●●●●●●○○○`, `letter-spacing: 0.06em`, `var(--t6)`). Header meta reads
     `progress from sessions` — progress is derived, never typed.
   - *Recent sessions* card — per row: mono `10.5px` date in a `44px` column, topic `12.5px`, mono
     duration; then a `11.5px var(--t5)` note indented `53px`; then a mono `10px var(--green)`
     confidence delta (`confidence 6 → 7`).

**Kanban view**: topics grouped Not Started · Learning · Practicing · Reviewing · Completed, cards
showing `confidence n/10`, a progress bar and total study time.

### 9. Finance

**List view**:

1. KPI row — `repeat(auto-fit, minmax(190px, 1fr))`. Value `27px / 600`, mono `MAD` suffix, mono
   `10px` sub-line. Revenue `12,400` · Expenses `2,180` (red) · Net income `10,220` (green, "82%
   margin") · Unpaid `6,000` (amber, "1 invoice · 12d out").
2. `1.5fr 1fr`: *Revenue by month* — eight bars, `height: 168px`, `gap: 10px`, value label above each
   bar in mono `10px`; paid portion `var(--accent)`, invoiced portion stacked above in
   `var(--barMid)`; legend top-right. *Revenue by client* — four rows with mono amount, mono share and
   an amber bar.
3. `1.4fr 1fr`: *Income* table (Date · Client · Project · Status · Amount(right), grid
   `60px 1.4fr 1.2fr 0.8fr 0.9fr`) and *Expenses* list (mono date `42px`, name `12.5px` + mono
   category sub-line, amount in `var(--red)`).

**Kanban view**: income records grouped Expected · Invoiced · Paid · Cancelled; card title is the
amount, sub-line `client · project`, right value the date, column head shows the summed total.

### 10. Timeline

`max-width: 900px`. Filter pills row (All, Tasks, Projects, Learning, Habits, Finance, Goals, Notes;
selected = border `var(--a40)`, background `var(--a11)`). Then day groups as
`grid-template-columns: 92px 1fr; gap: 18px`:

- Left rail: right-aligned day label `12.5px / 600` and mono `10px var(--t7)` date.
- Right: `border-left: 1px solid var(--line); padding-left: 20px`. Each event: absolutely positioned
  `7px` dot at `left: -25px; top: 15px` with a `2px solid var(--bg)` ring; mono `10.5px` time in a
  `38px` column; title `12.5px / 1.45`; then a mono `10px` kind badge tinted by kind and an
  `11px var(--t6)` related-entity label.
- Kinds and colors: learning/project `var(--accent)`, task/habit/milestone `var(--green)`, note
  `var(--blue)`, finance/goal `var(--amber)`, time `var(--t2)`.

### 11. Reports

1. Date-filter pills: Today, Yesterday, This Week, Last Week, This Month (selected), Last Month,
   This Quarter, This Year, Last Year, Custom.
2. KPI grid `repeat(auto-fit, minmax(178px, 1fr))`, value `25px / 600`: Tasks completed 87 ·
   Completion rate 78% · Hours worked 132.5h · Learning 34h 10m · Revenue 12,400 MAD · Net margin
   82% (green).
3. `1.4fr 1fr`: *Hours worked · last 8 weeks* stacked bars (`height: 172px`; client work
   `var(--accent)` bottom, learning `var(--barMid)` top, week label above, W27–W34 below) and *Where
   the time went* (five rows: Client work 61.5h 46%, Learning 34.2h 26%, AMHIL OS 21.5h 16%, Admin
   9.3h 7%, Other 6.0h 5%, bars in accent/blue/pink/amber/`var(--t5)`).
4. `1fr 1fr`: *Habit consistency · August* — per habit, a `118px` name column, then 26 day cells
   (`flex: 1; height: 15px; radius 3px`; hit = `var(--green)` at ≥80% consistency else
   `var(--accent)`, miss = `var(--track)`), then a mono percentage. *Project profitability* table —
   Project · Hours · Revenue · Cost · /hour (`1.6fr 0.8fr 0.9fr 0.9fr 0.7fr`), cost in red, hourly
   rate in green.

### 12. Settings

`grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 12px; max-width: 1060px`. Four
cards — Account, Preferences, Data, System — each a header plus rows of
`padding: 12px 15px`: label `12.5px`, hint `11px var(--t6) / 1.45`, and a right-hand mono `11px`
pill control (`radius 999px`, `padding: 4px 11px`). Action pills use accent border/background
(`var(--a40)` / `var(--a11)`); the RLS row uses the green pair.

Rows: Account — Email, Password (Change), Row Level Security (Enabled). Preferences — Currency (MAD),
Week starts on (Monday), Theme. Data — Export CSV, Export JSON, Automatic backup (Sunday 03:00).
System — Database (Supabase), Deployment (Vercel), Version.

### Command palette (⌘K / Ctrl+K)

`position: fixed; inset: 0`, backdrop `var(--overlay)` + `backdrop-filter: blur(3px)`, panel aligned
`padding-top: 12vh`, `z-index: 50`. Panel: `width: 620px; max-width: 90vw`,
`1px solid var(--line4)`, `background: var(--modal)`, `radius 16px`,
`box-shadow: var(--modalShadow)`.

- Input row `padding: 15px 17px`, mono `>` prompt in `var(--accent)`, query `15px`, `esc` hint mono
  `10px` right.
- Results `max-height: 58vh; overflow-y: auto; padding: 7px 0`. Group label mono `10px uppercase
  letter-spacing 0.09em var(--t6)`, `padding: 9px 17px 5px`. Result row `padding: 8px 17px`, `5px`
  dot in the group color, title `13px`, right-aligned mono `10.5px var(--t7)` meta; hover / selected
  background `var(--a09)`.
- Groups, in order: Learning topics `var(--accent)`, Tasks `var(--green)`, Projects `var(--blue)`,
  Notes `var(--amber)`, Timeline `var(--t4)`.
- Footer `padding: 10px 17px`, `background: var(--surface2)`, mono `10px var(--t7)`:
  `↑↓ navigate`, `↵ open`, `⌘↵ open in new tab`.

Escape closes; clicking the backdrop closes; clicking the panel must not.

### Mobile shell

Prototype renders a `390 × 792` frame (`radius 42px`, `1px solid var(--line3)`); in production this
is simply the layout below `~720px`.

- Status row `padding: 14px 26px 6px`, `12px / 600`.
- App header `padding: 10px 18px 14px`: `30px` accent tile, title `15px / 600` (contextual: `Wed 26
  Aug`, `Tasks`, `August`, `Learning`), mono `10.5px var(--t6)` sub-line, and a `32px` circular search
  button (`1px solid var(--line3)`) that opens the palette.
- Scrolling content `padding: 0 14px 14px`, `gap: 12px`, cards at `radius 16px`.
- **Every touch row is ≥46px tall and checkboxes grow to `19px` (`radius 6px`); habit chips get
  `padding: 8px 12px`.**
- Tabs Home / Tasks / Learn / Money / More: `border-top: 1px solid var(--line)`,
  `background: var(--topbar)`, `padding: 8px 6px 20px`; each tab a `7px` rounded dot
  (`var(--accent)` active, `var(--line4)` inactive) over a `10.5px` label (`var(--text)` / `600` when
  active, else `var(--t6)`).
- Home: 2×2 stat tiles → Today card → Habits card → Active projects. Tasks: horizontally scrolling
  filter pills + task rows with status badge and project chips. Money: 2×2 KPI tiles + six-month bar
  chart + income list. Learn: topic progress list + recent sessions.

---

## Interactions & behavior

Implemented in the prototype:

- Sidebar navigation switches screens; active item is highlighted.
- **List / Kanban toggle is remembered per screen** (a map keyed by screen name), so moving between
  Projects and Clients preserves each one's chosen view. Tasks additionally has Calendar.
- Task checkboxes toggle completion optimistically: the row's status badge flips to Done, the title
  goes `var(--t6)` + `line-through`, the overdue counter in the Today header recomputes, and the card
  moves between kanban columns. Reproduce this optimism with a Supabase mutation + rollback on error.
- Habit chips toggle today's completion and the `n / m today` summary recomputes.
- `⌘K` / `Ctrl+K` opens the palette anywhere; `Escape` or a backdrop click closes it. Bind on
  `window` and `preventDefault` the browser default.
- Theme and Desktop/Mobile switches (prototype-only affordances, see above).

Not built, needed in production: real filter/sort menus behind every filter chip, drag-and-drop
between kanban columns (status write on drop), row → detail navigation (project detail page with
tasks, milestones, time, revenue, expenses, profit, notes, activity), form modals behind every quick
action and `+ New`, timer for time tracking, pagination or virtualization on long lists, skeleton
loading states matching each card's shape, empty states, and error toasts.

Transitions should stay minimal (the spec explicitly asks for few animations): color/background
transitions of `120ms ease` on hover and selection only.

## State management

- `screen` — active nav item.
- `views` — `Record<screenName, 'List' | 'Kanban'>`; Tasks also allows `'Calendar'`. Persist per user.
- `searchOpen`, plus query and highlighted-result index in production.
- `theme` — `'dark' | 'light'` (persist; default to system).
- Per-entity server state: paginated lists, aggregates for the summary chips and dashboard tiles, and
  the derived values (project progress from tasks, learning progress from sessions, habit consistency
  from completions, revenue from income records). Fetch aggregates with SQL aggregate queries or
  views — never by loading whole tables into the client.
- Optimistic local overrides for task completion and habit completion.

Date semantics: weeks start Monday; "This Month" is the default report range; every screen must
support the range list in Reports.

## Design tokens

Defined as CSS custom properties on `:root` (dark) and overridden under `[data-theme="light"]`.

| Token | Dark | Light | Use |
|---|---|---|---|
| `--bg` | `#09090b` | `#eceef0` | app background |
| `--surface` | `#101013` | `#ffffff` | cards |
| `--surface2` | `#0d0d10` | `#f6f7f8` | table headers, board columns, footers |
| `--surface3` | `#131317` | `#f2f5f4` | row hover |
| `--modal` | `#111114` | `#ffffff` | palette panel |
| `--topbar` | `#0c0c0f` | `#ffffff` | topbar, mobile tab bar |
| `--cardShadow` | `none` | `0 1px 2px rgba(16,40,36,0.06)` | card elevation |
| `--modalShadow` | `0 24px 70px rgba(0,0,0,0.6)` | `0 24px 70px rgba(16,40,36,0.22)` | palette, phone frame |
| `--line` | `#1c1c21` | `#e5e8ea` | card borders, section dividers |
| `--line2` | `#16161b` | `#eef0f1` | row dividers |
| `--line3` | `#232329` | `#dcdfe2` | control borders |
| `--line4` | `#2a2a31` | `#c8cdd0` | checkbox borders, key caps |
| `--line5` | `#34343c` | `#aab2b5` | hover borders |
| `--chip` | `#1c1c22` | `#eef0f1` | neutral badge background |
| `--track` | `#1e1e24` | `#e5e8ea` | progress track, habit miss |
| `--barDim` | `#2b2b33` | `#dfe3e5` | inactive chart bars |
| `--barMid` | `#1c4a45` | `#a7d8d1` | secondary chart series |
| `--text` | `#ededf0` | `#10201e` | primary text |
| `--t2` | `#b6b6bf` | `#3d4a48` | secondary text, numerals |
| `--t3` | `#9b9ba4` | `#566462` | tertiary text |
| `--t4` | `#8b8b95` | `#63716f` | muted labels |
| `--t5` | `#7a7a84` | `#74827f` | column headers |
| `--t6` | `#6c6c76` | `#808e8c` | hints |
| `--t7` | `#5f5f68` | `#93a09e` | mono meta |
| `--t8` | `#4f4f57` | `#aab5b3` | inactive counts |
| `--t9` | `#2e2e35` | `#d3d9d8` | out-of-month day numbers |
| `--accent` | `#2dd4bf` | `#0d9488` | primary / active / in-progress |
| `--accentHi` | `#7ff0e3` | `#0f766e` | accent hover, link hover |
| `--onAccent` | `#04211f` | `#ffffff` | text on accent |
| `--green` | `#4ade80` | `#16a34a` | done, paid, positive |
| `--amber` | `#e2a03f` | `#b45309` | waiting, invoiced, money |
| `--red` | `#f87171` | `#dc2626` | overdue, expenses, at risk |
| `--blue` | `#60a5fa` | `#2563eb` | planned, learning-practicing, notes |
| `--pink` | `#f0abfc` | `#a21caf` | Languages area, AMHIL OS time category |

Alpha tints (background washes for badges, selected states, tinted rows) — dark uses the accent
`rgba(45,212,191,α)`, light uses `rgba(13,148,136,α)`:
`--a05 .05`, `--a08 .08`, `--a09 .09`, `--a11 .10–.11`, `--a13 .12–.13`, `--a16 .14–.16`, `--a40 .4`.
Same pattern for `--g08/--g10/--g12/--g35` (green), `--am11/--am13` (amber), `--r10/--r13` (red),
`--b11/--b13` (blue). `--overlay`: `rgba(5,5,7,0.72)` dark, `rgba(16,32,30,0.38)` light.

**Status palette** (badge foreground / background):

Backlog & Not Started `--t4 / --chip` · Todo `--t2 / --line3` · In Progress, Active, Learning,
Negotiation `--accent / --a13` · Waiting, On Hold, Proposal, Reviewing, Paused `--amber / --am13` ·
Done, Completed, Paid, Won, Achieved, Client `--green / --g12` · Planned, Contacted, Practicing
`--blue / --b13` · At Risk, Lost `--red / --r13` · Expected, Idea, Archived, Inactive, Cancelled
`--t3–t6 / --chip`.

**Priority colors:** Low `--t6`, Medium `--t3`, High `--amber`, Urgent `--red` (Urgent and High also
take `--r13` / `--am13` pill backgrounds on the dashboard).

### Typography

- Sans: **Mona Sans** (Google Fonts), weights 400 / 500 / 600 / 700. Stack:
  `'Mona Sans', 'Helvetica Neue', Helvetica, sans-serif`.
- Mono: **IBM Plex Mono**, weights 400 / 500 — used for every number, date, count, key cap, ID and
  meta line. This sans/mono split is the core of the look: prose in Mona Sans, data in mono.
- Scale in use: `9.5, 10, 10.5, 11, 11.5, 12, 12.5, 13, 14, 15, 18, 21, 22, 25, 26, 27px`.
  Body/rows `12.5px`; card titles `13px`; topbar title `14px`; KPI values `21–27px` with
  `letter-spacing: -0.02em`; uppercase labels `10.5–11px` with `letter-spacing: 0.07em`; mono meta
  `10–11px`.
- Money and metric numerals use `font-variant-numeric: tabular-nums`.

### Spacing, radius, sizing

- Spacing scale: `2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 24, 26px`.
  Grid gaps `10–12px`; section gaps `14–16px`; page padding `20px`.
- Radius: `2px` bars · `3px` chart bars/habit cells · `4–6px` checkboxes · `7px` nav items ·
  `8px` controls · `11px` kanban cards · `14px` cards · `16px` mobile cards & palette · `42px` phone
  frame · `999px` pills.
- Sidebar `214px`; topbar `54px`; card border `1px`; progress bar `3px`; status dot `6–7px`;
  kanban column min `210px`; content max `1560px`.
- Scrollbars: `10px`, thumb `var(--line4)`, `radius 6px`, `3px` transparent padding-box border.

## Assets

None. No images, no icon files, no third-party illustrations. Avatars are initials on a tinted
circle. All marks are text characters or CSS shapes. Fonts load from Google Fonts (Mona Sans, IBM
Plex Mono) — self-host them in production.

## Files

- `AMHIL OS.dc.html` — the full prototype: shell, all twelve screens, both themes, mobile shell and
  command palette. Open in a browser; navigation and toggles are live.
- `support.js` — runtime for the prototype's template/logic format. Needed only to open the HTML
  locally; it is not part of the design and must not be ported.
