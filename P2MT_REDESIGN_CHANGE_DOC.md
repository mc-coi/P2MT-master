# P2MT Efficiency Redesign — Change Doc

**Status:** Phase 1 shipped (Sept 11, 2026) · Phase 2 shipped (Sept 12, 2026) · Phase 3 next
**Author:** Claude (with Zach), September 11, 2026
**Constraints confirmed:** Firebase Spark (free) plan only — no Cloud Functions · ~150–200 students · 6–15 staff taking attendance daily · only absences/tardies matter (Present rows not needed) · everyone sees the same menu · desktop primary, phones used occasionally for Class Attendance only · start fresh each school year

---

## 1. Executive summary

P2MT is a Flask app ported to static HTML + Firestore. The port kept a server-side habit — "load the whole table, then filter in code" — that is harmless behind a server and ruinous against Firestore, where **every document returned by a query is a billed read** and the Spark plan allows **50,000 reads per day**.

The audit found the app does not have a few slow spots; it has one systemic pattern (`getAll()` on large collections) repeated 100+ times across 18 pages, applied to a collection (`classAttendanceLogs`) that grows by roughly **1,000 documents every school day** because it stores one row per student per class per day *including Present*. At today's size (~25 school days in), a **single visit to the Home dashboard costs ~50,000 reads — the entire daily quota — by itself**, and a teacher clicking Save five times costs ~140,000. This is why the console shows millions of reads.

The fix is not incremental tuning. It is three structural changes, all achievable on Spark:

1. **Store exceptions, not attendance.** Write only T/U/E/override rows. The main collection shrinks ~90% and stops being a problem to scan.
2. **Never scan; always scope.** Every read is bounded by date range, teacher, student, or period, using the composite indexes already created. Reference data (students, staff, schedules, templates) is loaded once per session and cached, validated by a single version-stamp read.
3. **Use deterministic document IDs and write-time counters.** Attendance events and TMI records get predictable IDs (`student_date_section`, `student_period`), which makes duplicates impossible by construction, removes every "find the existing record" scan, and lets TMI totals be maintained as small counters instead of recomputed from raw logs.

**Projected result:** from an estimated **1–3 million reads/day today** to roughly **10,000–15,000 reads/day**, with headroom to grow through June without approaching the limit. Saves become write-only (zero reads). Along the way, ~4,000 lines of duplicated logic, stale docs, and orphaned code come out.

---

## 2. What the audit found

### 2.1 Data model (as it exists)

23 collections. The ones that matter for cost:

| Collection | What it is | Est. size now | Growth |
|---|---|---|---|
| `classAttendanceLogs` | One doc per student per class per day, **all codes incl. Present** | ~26,000 | +~1,000/school day → ~180,000 by June |
| `classSchedules` | One doc per student per class (enrollment rows) | ~1,000 | Static after setup |
| `interventionLogs` | TMI records + other interventions | hundreds → low thousands | Grows weekly |
| `dailyAttendanceLogs` | Front-office absence/excuse entries | hundreds | Slow |
| `students` / `staff` / `parents` | Reference data | ~175 / ~30 / ~300 | Static |
| `p2mtTemplates`, `interventionTypes`, `pbls`, `pblEvents`, `pblTeams` | Reference/config | small | Static |
| `er*` (7 collections) | Extended Remediation room/period data | small, period-scoped | Per period |

**Root cause #1:** `classAttendanceLogs` is the wrong shape. It records presence, which nobody uses, at a cost of ~90% of its size, and every hot page downloads all of it.

### 2.2 Where the reads happen (hot spots ranked by daily cost)

Estimates assume ~26k attendance logs today, 10 active teachers, ~5 sections each.

| Rank | Page / action | What it downloads | Reads per occurrence | Times per day | Est. reads/day |
|---|---|---|---|---|---|
| 1 | **Class Attendance — every Save / Save All** | `loadAllData()` re-fetches **8 full collections** incl. all attendance logs + interventions | ~28,000 | ~50 | **~1,400,000** |
| 2 | **Home dashboard — every visit** | Full attendance logs **twice** (alerts + today's summary) + students + daily logs | ~52,000 | ~20 | **~1,000,000** |
| 3 | Class Attendance — page load | Same 8 collections (+3 PBL collections nobody needs for attendance) | ~28,000 | ~15 | ~420,000 |
| 4 | TMI Review / TMI Final — page load | All interventions + all attendance logs + students (+schedules/parents/templates) | ~27,000 | ~5 | ~135,000 |
| 5 | Daily Attendance — page load | All attendance logs + all daily logs | ~26,500 | ~5 | ~130,000 |
| 6 | Reports — Run | 8 full collections | ~28,000 | ~1 | ~28,000 |
| 7 | Every other page load | `students` (+ `classSchedules`, `parents`, templates) | ~200–1,500 | ~40 | ~30,000 |
| — | Schedule Admin, Diagnostics, ER, PBL tools | Full logs on specific admin actions | ~26,000 | rare | occasional spikes |

**Total: roughly 3 million reads on a normal school day, growing ~4% per school day** as the log collection grows. The two fixes already shipped this week (scoped TMI engine queries; no per-section `interventionLogs` refetch) removed a real slice of #1 but not the `loadAllData()` reload, and nothing yet touches #2.

**Root cause #2:** no page has a notion of "what I actually need." Each page's init does `getAll` for everything it might conceivably touch.

### 2.3 Writes (for completeness — currently within limits)

- Class Attendance writes one doc per student per section per save (~150 per teacher per day, ~1,500/day total) — well under the 20k/day write limit, but 90% of them are Present rows that carry no information.
- The "find existing log" step before each write is a linear scan of the whole in-memory log array per student (O(students × logs)); at 26k logs and 30 students that is ~800k comparisons per section save and is why Save feels slow on older laptops.
- `batchWrite()` exists in `db.js` and is used by only 3 pages; Class Attendance issues 30 separate writes per section instead of one atomic batch.

**Root cause #3:** records are located by *searching* rather than by *addressing*. This is the source of the race-condition duplicates, the overlapping-window duplicates, the merge tool, the reconcile tool, and most of the TMI code written this month.

### 2.4 Dead weight inventory (code, not features)

| Item | Lines | Why it's dead weight |
|---|---|---|
| Second copy of TMI engine in `class-attendance.html` (`checkAndCreateTMIForSection`, own `getTmiPeriodWindow`, own `MAX_TMI`) | ~200 | Duplicates `js/tmiEngine.js`; already drifted once (Assigned-By bug had to be fixed in both places) |
| `sweepOrphanedTMI()` in `schedule-admin.html` | ~55 | Superseded by `recalcTMIForStudent` / merge tool |
| `mergeDuplicateTMI`, `reconcileAssignedBy`, "Recalculate All TMI" + their three Schedule Admin panels | ~350 | Repair tools for problems the deterministic-ID design makes impossible. Keep for one migration run, then delete |
| `schoolCalendar` handling in both TMI implementations | ~60 | No page ever writes `schoolCalendar`; the code path is unreachable (confirmed by grep). Either build the 10-line admin UI or remove the branch |
| `parents.html` | 527 | **Unreachable** — no link or nav entry anywhere; parents are managed from Admin → Parents tab |
| `attSetRoom`, `loadAssignments` in `er-emailer.html` | ~40 | Never referenced |
| Local re-implementations of `showToast` + `exportCSV` (`reports.html`), `getInitials` (`student-profile.html`) | ~80 | Already exported by `js/utils.js` |
| `js/theme-init.js` + `applyThemeEarly()` in `nav.js` | 15 | Same 4 lines in two places |
| Inline `<style>` blocks across 18 pages | **~2,300** | Same card/button/table/modal/dark-mode rules re-declared per page on top of `main.css` (1,952 lines) |
| 10 Markdown docs (`FILES.md`, `FILES_CREATED.md`, `PAGES_CREATED.md`, `NEW_PAGES_REFERENCE.md`, `MODERNIZATION_SUMMARY.md`, `CODE_SNIPPETS.md`, `ATTENDANCE_PAGES.md`, …) | ~3,100 | Build-log artifacts from the port; overlapping and stale. Keep `README.md` + `DEVELOPER.md` |
| `p2mt-user-guide.docx` / `.pdf` in repo root | — | Should live in `docs/` |
| Class Attendance loads `pbls`, `pblEvents`, `pblTeams`, `dailyAttendanceLogs` on every init | — | Only used for optional comment pre-fill / a banner; should be lazy |

Total removable: roughly **6,000–6,500 lines** without losing a feature.

---

## 3. Target architecture (Spark-only)

### 3.1 Principles

1. **A page may only read documents it will display or write.** No `getAll()` on any collection that grows with time. `getAll()` is allowed only for bounded reference collections, and only through the cache layer.
2. **Address, don't search.** Anything the app needs to find later gets a deterministic document ID.
3. **Count at write time, not read time.** Totals the UI shows (TMI minutes, rolling absence counts) are maintained as small counter documents by the writer, using Firestore `increment()` — atomic, no transaction needed, no Cloud Function needed.
4. **Reference data is loaded once per session.** A single `meta/versions` document tells a page whether its cached copy is stale.
5. **Every school year is a clean slate.** Growing collections are keyed by school year so year-end is an archive-and-forget, not a purge.

### 3.2 New data model

```
students/{studentId}                     (unchanged)
staff/{staffId}                          (unchanged)
classSchedules/{scheduleId}              (unchanged; queried by teacherLastName, cached)
meta/versions                            NEW  { students: ts, staff: ts, classSchedules: ts, templates: ts, ... }

attendanceEvents/{date}_{sectionKey}_{studentId}        NEW  replaces classAttendanceLogs
    { schoolYear, date, studentId, chattStateANumber, studentName,
      teacherLastName, className, startTime, sectionKey,
      code: 'T'|'U'|'E',  assignTmi: bool, comment, learningLab: bool,
      createdBy, updatedAt }
    — one doc per EXCEPTION only. Present = no document.
    — Changing a student back to Present deletes the doc.

attendanceSessions/{date}_{sectionKey}                  NEW
    { schoolYear, date, teacherLastName, className, startTime, sectionKey,
      rosterCount, exceptionCount, savedBy, savedAt }
    — "attendance was taken for this section on this day". Present count = rosterCount − exceptionCount.
    — Replaces the need to store Present rows; powers "who hasn't taken attendance" + dashboard totals.

dailyAttendanceLogs/{date}_{studentId}                  keep, add deterministic ID
    (front-office excuses, dress-code tardies, MC etc. — unchanged shape)

tmi/{studentId}_{periodKey}                             NEW  replaces TMI rows in interventionLogs
    { schoolYear, studentId, chattStateANumber, studentName,
      periodKey, periodStart, periodEnd,
      uCount, tCount, overrideCount,                    ← maintained by increment()
      minutes, minutesServed, minutesRemaining,        ← minutes = f(counts), capped 240
      status: 'Reviewed'|'Pending'|'Closed', assignedBy, reason,
      createdAt, updatedAt }
    — Exactly one doc per student per period. Duplicates are structurally impossible.

studentSummary/{studentId}                              NEW
    { schoolYear, weeks: { '2026-W36': { U: 1, T: 2, E: 0 }, ... }, lastEventDate }
    — rolling counters for dashboard alerts and student profile; updated by increment() per event.

interventionLogs/{id}                                   keep for non-TMI interventions only
studentInterventions, parents, p2mtTemplates, pbl*, er*  (unchanged)
```

`sectionKey` = `${teacherLastName}|${className}|${startTime}` normalized (lowercase, spaces → `_`). It is derived, never typed.

**Why this shape works on Spark:**
- No document is ever *located* by scanning. Save = `setDoc(deterministicId, data, {merge:true})`. Un-absent = `deleteDoc(deterministicId)`.
- Every UI number (TMI minutes, alert counts, present counts) lives in a document the page can read directly.
- `increment()` is atomic on the server; two teachers marking the same student in different classes cannot lose each other's count. No transactions, no functions.
- All growing collections carry `schoolYear`, and the deterministic IDs embed the date, so a new year never collides with the old.

### 3.3 The cache layer (`js/data.js`, new)

Replaces direct `getAll()` in pages for reference data.

```
await Data.students()        → cached array; refreshed only if meta/versions.students changed
await Data.staff()
await Data.schedulesForTeacher(lastName)   → scoped query, cached per teacher
await Data.templates()
await Data.parents()
Data.invalidate('students')  → called by any page that writes to students; bumps meta/versions
```

Mechanics: in-memory Map + `sessionStorage` (survives navigation between pages in the same tab, which is exactly the "click through 4 pages" pattern). On each page load: **1 read** (`meta/versions`) → compare stamps → re-fetch only the collections whose stamp changed. Writers call `Data.bump('students')`, which is a single `setDoc(meta/versions, {students: serverTimestamp()}, {merge:true})` — 1 write.

Cost: a normal page load that used to cost 200–1,500 reads of reference data now costs **1**.

### 3.4 Scoped-read plan per page

| Page | Today | Redesigned | Est. reads/visit |
|---|---|---|---|
| **Home** | 2× full logs + students + daily logs | `attendanceEvents` where date == today (scoped) + `attendanceSessions` today + `studentSummary` (≤175) | ~200 (or ~50 with an `alerts` roll-up doc, see §3.6) |
| **Class Attendance** | 8 full collections; again on every Save | Cached roster for this teacher (0) + `attendanceEvents` where teacher == X and date == D (~5–30) + `tmi` docs for roster students in current period (≤30) | **~40 on load; 0 on Save** |
| **Daily Attendance** | Full logs + full daily logs | Both collections scoped to the selected date range (default: this week) | ~100–300 |
| **TMI Review** | All interventions + all logs + students + schedules | `tmi` where periodKey in selected range; optional drill-down fetches that one student's events | ~50–150 |
| **TMI Final** | Same + parents + templates | Same as Review + cached parents/templates | ~50–150 |
| **Student Profile** | Already mostly scoped by student ✔ | Add `studentSummary` + `tmi` by studentId; drop `getAll('parents')`/`getAll('erRooms')` for scoped queries | ~20 |
| **Students / Admin / Master Schedule / Parents tab** | `students`, `parents`, `schedules` full | Cached via `Data.*` | ~1 |
| **Reports** | 8 full collections | Date-range-scoped queries on `attendanceEvents`, `tmi`, `dailyAttendanceLogs`; use `count()` aggregation (1 read per 1,000 docs) for totals | ~500–3,000 per run, run rarely |
| **Learning Lab, PBL Planner, Email Templates, ER Selector** | Reference data full; logs on some actions | Cached reference data; logs scoped by date/teacher | ~1–100 |
| **Schedule Admin / Diagnostics** | Full logs on tools | Tools become year/date-range scoped; most repair tools deleted (see §2.4) | occasional, bounded |

### 3.5 Write path for Class Attendance (the critical flow)

```
Save section:
  batch = writeBatch()
  for each student in roster:
      id = `${date}_${sectionKey}_${student.id}`
      if code in (T,U,E) or assignTmi:
          batch.set(attendanceEvents/id, {...}, {merge:true})
          if code/assignTmi changed from previous state:
              batch.set(tmi/`${student.id}_${periodKey}`, { uCount: increment(±1) ... }, {merge:true})
              batch.set(studentSummary/student.id, { [`weeks.${week}.${code}`]: increment(±1) }, {merge:true})
      else if previously had an event:
          batch.delete(attendanceEvents/id)  (+ matching decrements)
  batch.set(attendanceSessions/`${date}_${sectionKey}`, { rosterCount, exceptionCount, savedBy, savedAt })
  await batch.commit()          ← one round trip, atomic, ≤ 500 ops
```

- **Reads during save: 0.** The page already holds the previous state for this section (it loaded it on init and tracks edits).
- **Writes:** only for students whose state changed, typically 1–5 per section instead of 30.
- **TMI minutes** are derived from counters on read (`min(120·U + 120·overrides + 90·floor(T/3), 240)`), so the TMI doc is never "recalculated" — it is always correct. The `reason` string is generated at display time.
- Because `tmi/{student}_{period}` is addressed, the 240-cap, served-minutes preservation, and delete-when-zero rules become one small function in `tmiEngine.js` used by every caller — the duplicate in `class-attendance.html` is deleted.

### 3.6 Optional refinement — dashboard roll-up

If 200 reads per Home visit is still more than we want (20 visits/day ≈ 4,000), maintain `rollups/alerts` with just the students currently over threshold. Because updating one shared doc from many writers needs care, this would use `arrayUnion`/`arrayRemove` keyed by studentId (atomic) and would cost 1 extra write per event. Home then reads ~3 docs. Recommend deferring until measured; §3.4's version is already 250× cheaper than today.

### 3.7 TMI period window

Keep the calendar-driven window (`startTmiPeriod` → next `tmiDay`) as the definition, and **build the missing Schedule Admin calendar UI** (~40 lines: pick dates, toggle flags) so the code path is real. Remove the silent Mon–Sun fallback; if no period is defined for a date, refuse to assign TMI and show an admin notice. Silent guessing is how the 8/25-in-an-8/26-window question happened. The "Use This Range as TMI Window" tool stays as an explicit override (it just writes the two calendar flags).

### 3.8 Year rollover

Schedule Admin → "Start New School Year": exports `attendanceEvents`, `tmi`, `dailyAttendanceLogs`, `attendanceSessions`, `studentSummary` for the ending year to CSV (client-side, PapaParse already loaded), then deletes them in batches of 500 with a progress bar. Deletes count against the 20k/day write quota, so at ~20k exception rows the purge runs in one or two sessions — acceptable once a year. Reference data (students, schedules, staff) is left for the admin to update as usual.

### 3.9 Real-time listeners

Only `er-emailer.html` uses `onSnapshot`, on tightly scoped period queries — appropriate for a live room-assignment screen. Verify the four unsubscribe handles are called on tab switch/page leave (they are stored; confirm they fire). No other page should add listeners; the polling-free design above does not need them.

---

## 4. Read budget after redesign

Assumptions: 10 teachers × 5 sections, 20 Home visits, ~10 TMI/Daily visits, 40 misc page loads, 1 report run.

| Source | Reads/day |
|---|---|
| Class Attendance loads (15 × ~40) | 600 |
| Class Attendance saves | 0 |
| Home (20 × ~200) | 4,000 |
| TMI Review / Final / Daily (10 × ~150) | 1,500 |
| Reference data version checks (75 page loads × 1) + occasional refresh | ~300 |
| Reports, Student Profile, admin tools | ~2,000 |
| **Total** | **~8,500** |

That is ~17% of the quota with the current student count, and — critically — **it does not grow with the number of days in the school year**, because nothing scans the growing collections. Doubling enrollment roughly doubles it; still under 40%.

---

## 5. Code consolidation

**Shared modules (new/changed):**

| File | Role |
|---|---|
| `js/db.js` | Add `setDocMerge`, `writeBatch` helper, `increment` re-export, `count()` helper, `getWhereMultiple` with `orderBy`/`limit`. Keep API tiny. |
| `js/data.js` | NEW — reference-data cache + `meta/versions` handling (§3.3) |
| `js/attendance.js` | NEW — `sectionKey()`, `eventId()`, `saveSection()` (§3.5), `eventsFor({teacher,date})`, `eventsForStudent({studentId,from,to})` |
| `js/tmiEngine.js` | Becomes small: `periodFor(date, calendar)`, `minutesFromCounts()`, `applyDelta()`, `recalcFromEvents(studentId, periodKey)` (for the rare repair case). Delete `recalcTMIForWindow`, `mergeDuplicateTMI`, `reconcileAssignedBy` after migration. |
| `js/utils.js` | Unchanged; pages stop re-declaring its helpers |
| `js/nav.js` | New grouping (§6); absorb `theme-init.js` |
| `css/main.css` | Absorb the ~2,300 lines of per-page inline CSS into shared components (`.p2mt-card`, `.p2mt-table`, `.p2mt-modal`, badges); delete per-page `<style>` blocks. Pages keep at most a few page-specific rules. |

**Pages:** every `<script type="module">` drops its `getAll` imports for reference data in favor of `Data.*`; growing-collection reads go through `attendance.js`/`tmiEngine.js`. No page talks to Firestore directly for attendance or TMI.

**Removed outright:** `parents.html` (or link it — decision needed), `js/theme-init.js`, 8 of 10 Markdown docs, `sweepOrphanedTMI`, the three TMI repair panels (after migration), unreachable `schoolCalendar` branches (replaced by real UI), unused ER functions.

**Libraries:** jQuery + DataTables on 11 pages and PapaParse on 8 are fine to keep — they're CDN-cached and replacing them is churn without a read/write benefit. Not in scope.

---

## 6. UI / navigation proposal

### 6.1 What's there now

```
Home | Students | Attendance ▾ (Class, Daily, Master Schedule, Learning Lab, TMI Review, TMI Final)
     | Contact ▾ (PBL Planner, Email, ER Selector) | Reports | Admin ▾ (Schedule Admin, Admin, Diagnostics)
```

Problems: "Contact" contains a planning tool (PBL Planner) and a room-assignment tool (ER Selector) — the label describes one of three items. "Attendance" holds six items of three different kinds (taking attendance, reviewing consequences, and a schedule that is really setup). "Master Schedule" is configuration but sits with daily tasks. Two menus contain an item named the same as the menu ("Admin ▾ → Admin"). Parents has no entry at all. Dark-mode toggle takes prime top-bar space for a once-a-semester action.

### 6.2 Proposed structure (single menu, everyone)

```
Home
Attendance ▾      Take Class Attendance   ← primary daily task, listed first
                  Daily / Front Office
                  Learning Lab
TMI ▾             Review
                  Final Approval
Students ▾        Student List
                  Parents & Guardians      ← gives parents.html a home (or Admin → Parents tab, pick one)
Communications ▾  Email Templates
                  ER Selector
Planning ▾        Master Schedule
                  PBL Planner
Reports
Admin ▾           Data & Users             ← today's admin.html (students/staff/parents/intervention types)
                  Schedules & Year         ← today's schedule-admin.html + TMI calendar + "Start New Year"
                  Diagnostics
[user menu ▾]     Dark mode · Sign out
```

Rationale:
- Groups are by **what the user is trying to do**, and each label describes every item under it.
- TMI is its own top-level item because it is a distinct workflow (review → approve → notify) used by different people at different times than attendance-taking.
- Master Schedule moves out of daily Attendance into Planning with PBL Planner — both are "set things up for the future."
- "Admin → Admin" becomes "Admin → Data & Users"; "Schedule Admin" becomes "Schedules & Year" to reflect its actual contents once the year-rollover and TMI-calendar tools live there.
- Dark mode moves into the user dropdown next to Sign out, freeing the top bar.

### 6.3 Page-level suggestions

- **Home:** put a large "Take Attendance" button first; phone users land here and that is the only thing they do on a phone. Alerts and today's summary become cheap (§3.4) so they can stay.
- **Class Attendance on phone:** the teacher/date selectors and the roster should stack in one column with large tap targets and a sticky Save bar. Today's grid layout is desktop-first; this is the one screen worth a mobile pass.
- **Schedule Admin** already has tabs; add "TMI Calendar" and "School Year" tabs there rather than new pages.
- **Diagnostics:** keep, but demote to a tab on Admin → Data & Users; it is a maintenance screen, not a destination.
- **Consistency:** with the CSS consolidation, use one card/table/button style across pages — today the Admin, Students, Master Schedule and ER pages each look slightly different because each carries its own stylesheet.

---

## 7. Migration plan

Phased so that each step is independently shippable and verifiable in real use — same approach as this week's fixes.

| Phase | Scope | Reads impact | Risk | Effort |
|---|---|---|---|---|
| **0 — done** | Scoped TMI engine queries; no per-section `interventionLogs` refetch | −10–15% | low | shipped |
| **1 — Stop the bleeding** (no schema change) | Remove `loadAllData()` from the save path (patch in-memory); make Home read today-only + 4-week-scoped queries; make Class Attendance load only this teacher's schedules + today's logs; lazy-load PBL/daily data. Add `Data` cache for reference collections. | **−90%+** (to ~100–200k/day at today's data size, still shrinking with the following phases) | low–medium | 2–3 sessions |
| **2 — Exceptions-only + deterministic IDs** | New `attendanceEvents`/`attendanceSessions`/`tmi`/`studentSummary` collections; new save path (§3.5); one-time migration tool in Schedule Admin: copy T/U/E rows from `classAttendanceLogs` into `attendanceEvents` with new IDs, build `tmi` docs from existing TMI records, compute `studentSummary`; then delete `classAttendanceLogs` (deletes are metered — spread over 1–2 days). Cut every page over to the new collections. | to **~10k/day**, flat over the year | medium — touches the core save flow; needs the simulation-test harness extended to the batch path | 3–4 sessions |
| **3 — Consolidate** | Delete duplicate TMI engine, repair tools, orphan page/functions, stale docs; move inline CSS to `main.css`; absorb `theme-init.js` | none (cleanliness, speed) | low | 1–2 sessions |
| **4 — Navigation & UI** | New nav groups; user-menu dark mode; Home CTA; Class Attendance mobile pass; Schedule Admin tabs (TMI Calendar, School Year) | none | low | 1–2 sessions |

Phase 1 alone gets under the daily limit at current data size. Phase 2 is what keeps it there through June and every year after.

**Verification per phase:** extend the existing Node simulation harness (stub `db.js`) to cover `attendance.js` and the batch save path; add a read-counter to the stub so tests assert *how many documents a flow reads*, not just what it returns. Then watch the Firestore Usage tab for two school days before starting the next phase.

---

## 8. Decisions (resolved with Zach, Sept 11)

1. **`parents.html`:** keep it, linked under **Students → Parents & Guardians** (Admin keeps the parents tab for editing/CSV upload). *Done in Phase 1.*
2. **TMI window:** the selected Start/End dates define what TMI Review / Final Approval work on. If either date is missing, the page shows an on-screen message asking for both instead of guessing. *Done in Phase 1* (the engine's Mon–Sun fallback for *creating* records is unchanged until Phase 2's calendar UI).
3. **Learning Lab attendance:** counts toward TMI exactly like class attendance. *Confirmed; already true.*
4. **Historical data:** take a full CSV export of `classAttendanceLogs` (incl. Present rows) before the Phase 2 migration. *Confirmed.*
5. **Reports / Home:** no Present history is needed anywhere — absences only. The Home "Attendance Alerts" card is removed. *Done in Phase 1.*
6. **Order:** Phase 1 now (shipped); Phase 2 the following weekend (shipped Sept 12).

## 9. Phase 1 — what shipped

| Change | Effect |
|---|---|
| `js/data.js` reference-data cache; stamps written automatically by `js/db.js` on every write | Students/staff/schedules/parents/templates cost **1 read per page load** instead of ~1,300 |
| `js/attendance.js` scoped reads (date range × teacher / student / codes / lab), fanning out over `date`/`classDate` and `absenceDate`/`date`, with index-missing fallback | No page reads `classAttendanceLogs` or `dailyAttendanceLogs` in full any more (except rare admin tools — see below) |
| Class Attendance: teacher+date load, **0-read saves**, shared TMI engine for changed students only, duplicate engine deleted, absence tab range-scoped | From ~28,000 reads per Save to 0; page load from ~28,000 to ~40 |
| Home: alerts card removed; Today's Attendance reads today only | From ~50,000 per visit to a few dozen |
| Daily Attendance, TMI Review, TMI Final, Reports: date-range scoped, dates required with on-screen message | From ~26,000 per visit to hundreds |
| `firestore.indexes.json`: all composite indexes for the new query shapes | Create these in the console (Firestore → Indexes) — the app works without them via fallback, just less cheaply |
| Nav: Students ▾ (Student List, Parents & Guardians) | `parents.html` is reachable |

**Still reading growing collections in full (deliberately deferred — rare, admin-only actions):** Schedule Admin's log/TMI repair tools, Diagnostics scans, ER Selector's two log-based tools, PBL Planner's two attendance syncs, Admin → Clear All TMI, Reports' `interventionLogs` read. These go away or get scoped in Phase 2/3.

**Indexes to create now** (Firestore → Indexes → Composite; all on `classAttendanceLogs` unless noted; all Ascending): `teacherLastName+date`, `teacherLastName+classDate`, `attendanceCode+date`, `attendanceCode+classDate`, `teacherLastName+attendanceCode+date`, `teacherLastName+attendanceCode+classDate`, `learningLab+date`, `learningLab+classDate`, `studentId+attendanceCode+date`, `studentId+attendanceCode+classDate`, `chattStateANumber+attendanceCode+date`, `chattStateANumber+attendanceCode+classDate`; `dailyAttendanceLogs`: `studentId+absenceDate`, `studentId+date`, `chattStateANumber+absenceDate`, `chattStateANumber+date`; `interventionLogs`: `interventionType+startDate`. (The four `studentId/chattStateANumber × date/classDate` ones already exist.) Until each exists, the browser console shows one warning per query shape and the fallback read is used.


## 10. Phase 2 — what shipped (Sept 12, 2026)

### 10.1 Deploy checklist — do these in order

1. **Create the indexes** (Firestore → Indexes → Composite). `firestore.indexes.json` is the source of truth; the new ones are all on `attendanceEvents` (plus one on `attendanceSessions`), all Ascending:
   `teacherLastName+date`, `attendanceCode+date`, `teacherLastName+attendanceCode+date`, `studentId+date`, `chattStateANumber+date`, `studentId+attendanceCode+date`, `chattStateANumber+attendanceCode+date`, `learningLab+date`; `attendanceSessions`: `teacherLastName+date`.
   The 16 `classAttendanceLogs` indexes from Phase 1 are no longer used and can be deleted once the migration has run.
2. **Push the code.**
3. **Schedule Admin → Attendance & TMI → migration card**, three buttons, in order:
   1. *Export old logs to CSV* — full backup of `classAttendanceLogs` including Present rows (decision #4). One full read, ~26k.
   2. *Build attendanceEvents & sessions* — copies every T/U/E/override row into `attendanceEvents` under its new ID and builds an `attendanceSessions` record for every class-day that had attendance saved. One more full read; ~3–4k writes. Learning-Lab `?` placeholders and propagated "P"/"unmarked" rows are dropped.
   3. *Re-key TMI records* — moves every auto-calculated TMI record to `tmi_{student}_{period}`, merging overlapping duplicates on the way (served minutes summed).
   Every step is idempotent; re-run any of them if the browser tab is closed mid-way.
4. Take attendance for a class, check Daily Attendance and TMI Review show it, then watch Firestore usage for two school days.

**Until step 3.2 has run, Class Attendance will show every student as Present for past days** (it reads the new collection). Nothing is lost — the old collection is untouched — but run the migration the same day as the deploy.

### 10.2 Data model as built

Two deliberate departures from §3.2, both to shrink the blast radius:

- **Field names are unchanged.** `attendanceEvents` documents carry the same fields as `classAttendanceLogs` (`attendanceCode`, `teacherLastName`, `className`, `startTime`, `date`, `comment`, `assignTmi`, `learningLab`, `excuseType` …). Every reader that went through `js/attendance.js` in Phase 1 kept working with only the collection name changing. The date always lives in `date`; `classDate` is gone, so the fan-out over two date fields is gone with it (half the queries).
- **TMI stays in `interventionLogs`** rather than a new `tmi` collection, but every auto-calculated record now has the deterministic ID `tmi_{studentId}_{periodKey}`. Finding a student's record for a period is one `getById`. Manually assigned TMI (Students page) keeps auto IDs and no `tmiPeriodKey`, exactly as before, so TMI Review / Final Approval / Student Profile needed no changes.

What was added:

| Collection | ID | Purpose |
|---|---|---|
| `attendanceEvents` | `{date}_{teacher~class~time[~lab]}_{studentId}` | One doc per **exception** (T/U/E or TMI override). Present = no doc. |
| `attendanceSessions` | `{date}_{teacher~class~time[~lab]}` | "Attendance was taken": `rosterCount`, `exceptionCount`, `savedBy`, `savedAt`. Powers Home's Present count, the "Taken at …" note on each section, and Attendance Coverage. |

Not built: `studentSummary` (nothing needed it once Home's alerts card was removed — decision #5) and write-time counters on the TMI doc. The engine recomputes a student's minutes from their handful of exception docs each time one changes (1 + ~2 reads per changed student), which is self-healing and keeps one code path; the counter design would have been 0 reads but every writer would have had to emit exact deltas.

### 10.3 Class Attendance save path (as built)

`saveSectionAttendance()` in `js/attendance.js`: one batched write per section — a merge for each exception, a delete for each student switched back to Present who previously had a record, and the session doc. **0 reads.** It returns the students whose code or TMI flag actually changed; only those go through `recalcTMIForStudent`, which reads the TMI doc by ID plus that student's exceptions for the period. A typical save with two absences costs ~6 reads and ~5 writes. Two teachers or two tabs saving the same section write the same document IDs, so duplicates are impossible by construction.

### 10.4 Everything that wrote `classAttendanceLogs` now writes through `js/attendance.js`

| Writer | Before | Now |
|---|---|---|
| Class Attendance save / Save All / Clear | `addDoc`/`updateDoc` per student, 30 writes per section | `saveSectionAttendance` batch; Clear deletes events + sessions and recalculates TMI |
| Daily Attendance add / edit / delete / excuse | `addDoc('classAttendanceLogs')` with only an A# | `saveEvent` (resolves `studentId` from the roster when it can; a date/class edit moves the doc), `patchEvent`, `deleteEvent`; TMI recalculated for old and new period |
| Students → Dress Code L1 auto-tardy | `addDoc` | `saveEvent` (time-of-day in the ID so two in one day stay separate); delete path finds it by `sourceInterventionId` |
| ER Selector absence sync | `addDoc`/`updateDoc`/`deleteDoc` | `saveEvent` with the stored `classLogId` as `prevId`; purge tools read per student / per date range |
| PBL Planner comment sync | `getAll` + `updateDoc` | `fetchClassLogsForDate` + `patchEvent` (comments only exist on exceptions; Present rows are pre-filled at display time as before) |
| Learning Lab "save" | pre-created a `?` placeholder row per lab day (the source of the `classDate` split) | **removed** — the schedule's `classDays` + start/end dates define the roster |
| Master Schedule "Propagate Attendance Logs" | pre-created a Present row per student per class per day for a semester (was also calling `batchWrite` with the wrong signature) | **removed** |
| Schedule Admin "Propagate" / "Clear Propagated" / "Propagation Coverage" / "Scan for Unknown Logs" / "Merge Duplicate TMI" / `sweepOrphanedTMI` | full scans | **removed**; replaced by the sessions-based **Attendance Coverage**, a range-scoped **Clear Attendance** (events + sessions, TMI recalculated), range-scoped **Recalculate TMI** and **Fix Assigned By**, and the migration card |
| Diagnostics | full `classAttendanceLogs` scan for lookup, duplicate-log scan, orphan-log scan | lookup reads per student (by id and A#); duplicate scan removed (impossible now); orphan scan no longer includes attendance |

No page reads `classAttendanceLogs` any more except the migration card.

### 10.5 Read budget check

| Flow | Phase 1 | Phase 2 |
|---|---|---|
| Class Attendance load (teacher + day) | ~150 (Present rows) + 2 | ~5–30 exceptions + sessions (~5) |
| Class Attendance save | 0 + TMI (~4/student) | 0 + TMI (~3/changed student) |
| Home | ~1,000 (today's Present rows) | ~50 exceptions + ~50 sessions |
| Daily Attendance, 2 weeks | ~500 exceptions (+ ~10k if labs toggled — lab Present rows) | ~500 (labs toggle now only adds lab absences) |
| TMI Review / Final, 2 weeks | ~500 | ~500 (and the TMI doc lookup is 1 read instead of a per-period query) |

The collection that used to grow by ~1,000 documents a school day now grows by the number of absences and tardies — roughly 50–100.

### 10.6 Deferred to Phase 3

- TMI calendar UI in Schedule Admin and removal of the silent Mon–Sun fallback (§3.7). The fallback is still in `getTmiPeriodWindow`; "Use This Range as TMI Window" remains the override.
- "Start New School Year" export-and-purge (§3.8) — nothing to purge until June.
- Admin → Clear All TMI and Reports' `interventionLogs` read are still full reads of a small collection.
- Delete the 16 obsolete `classAttendanceLogs` indexes and, once comfortable, the `classAttendanceLogs` collection itself (~26k deletes, metered at 20k/day — two sessions, or just leave it; it costs nothing unread).
- Code consolidation and CSS (§5), navigation (§6).

### 10.7 Verification

- `tools/sim/phase2_test.mjs` (Firestore-accurate stub): 45 assertions — deterministic IDs normalise spelling/case and distinguish lab sections; save reads 0 and commits one batch; only exceptions are stored; re-save is idempotent; Present deletes the doc; two tabs can't duplicate; `saveEvent` moves a doc when its date changes and deletes it when the code becomes P; engine creates/updates/deletes at the deterministic ID, honours the 240 cap and served minutes, shares nothing but the student's own 3 reads per batch entry; legacy random-ID records are found again after `migrateTMIRecords` and the migration is idempotent and merges overlapping chains; `recalcTMIForWindow` relabels by moving the doc and never scans a growing collection; index-missing fallback still avoids `getAll`; the legacy-log migration keeps the newest duplicate, drops `?` placeholders and propagated rows, counts sessions correctly, and a post-migration save cleans up migrated exceptions.
- `tools/sim/phase1_test.mjs`: 16/16 still pass against the new modules.
- `tools/extract.py`: all 26 scripts pass `node --check`; onclick handlers and DOM ids verified for every edited page.

---

## Appendix A — Complete read map (current code)

Every Firestore read call, by file and enclosing function (from the audit script). `getAll` on a growing collection is marked ⚠.

```
admin.html            loadAllData: students, staff, parents, interventionTypes · clearAllTMI: interventionLogs⚠, studentInterventions
class-attendance.html loadAllData: classSchedules, classAttendanceLogs⚠, students, interventionLogs⚠, staff, schoolCalendar,
                                   dailyAttendanceLogs⚠, pblEvents, pblTeams, pbls · (×4 call sites: init, saveSection, clearDay, saveAll)
daily-attendance.html init: classAttendanceLogs⚠, dailyAttendanceLogs⚠ · modals: students ×2
dashboard.html        loadAlerts: students, classAttendanceLogs⚠ · loadTodayAttendance: classAttendanceLogs⚠, dailyAttendanceLogs⚠
diagnostics.html      4 tools: students, classAttendanceLogs⚠ ×3, dailyAttendanceLogs⚠, classSchedules ×2, erRoomStudents ×2
email-templates.html  loadData: p2mtTemplates, pbls, pblEvents, pblTeams, students
er-emailer.html       loadAll: students, erWorkshops, guardianEmails, p2mtTemplates, classSchedules, parents ·
                      period-scoped getWhere ×9 (good) · 4 listeners (scoped) · classAttendanceLogs⚠ ×2 in tools
learning-lab.html     init: classSchedules, students, p2mtTemplates · classSchedules ×2 in tools
master-schedule.html  loadSchedules: classSchedules, students
parents.html          loadData: students, parents            (page unreachable)
pbl-planner.html      loadAllData: pbls, pblEvents, pblTeams, students, classSchedules · classAttendanceLogs⚠ ×2 in tools
reports.html          runReports: classAttendanceLogs⚠, dailyAttendanceLogs⚠, interventionLogs⚠, studentInterventions,
                                  erAssignments, erWorkshops, erClearance, students
schedule-admin.html   init: classSchedules, students, staff · tools: classAttendanceLogs⚠ ×6, interventionLogs⚠ ×2, classSchedules ×5
student-profile.html  by-student getWhere ×7 (good) · getAll parents, erRooms
students.html         loadStudents: students · parents (orphan tool) · studentInterventions
tmi-approval.html     loadInitialData: interventionLogs⚠, students, parents, p2mtTemplates, classAttendanceLogs⚠ · interventionLogs⚠ on reload
tmi-review.html       init: interventionLogs⚠, classSchedules, classAttendanceLogs⚠, students · interventionLogs⚠ on reload
js/tmiEngine.js       recalcTMIForStudent: scoped ✔ · recalcTMIForWindow: interventionLogs⚠ · merge/reconcile: interventionLogs⚠, classAttendanceLogs⚠
```

## Appendix B — Firestore Spark quotas that shape this design

- 50,000 document reads / day · 20,000 writes / day · 20,000 deletes / day · 1 GiB storage.
- A query costs 1 read per document returned (minimum 1). A `count()` aggregation costs 1 read per 1,000 documents counted.
- `onSnapshot` listeners cost the initial result set, then 1 read per changed document.
- `increment()`, `arrayUnion`, `serverTimestamp` are server-side atomic and cost 1 write each — no transactions or functions required.
- Batched writes: up to 500 operations per commit, one round trip.
