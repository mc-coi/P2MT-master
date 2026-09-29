# P2MT — working notes

A static HTML/JS school administration app on Firebase/Firestore. No build
step, no framework, no server: every page is hand-written HTML with a
`<script type="module">` block, deployed as-is. It began life as a Flask app
and was retrofitted to client-side JS, which explains some of the shape of it.

The user is a school administrator, not a developer. Explanations should say
what changed and what they need to do, not walk through the code.

## Before you change anything

Run the checks. They are fast and they catch the classes of bug that have
actually happened here:

```sh
./tools/sim/run.sh      # 11 simulation suites + both static checks
```

`tools/sim/` runs the real `js/` modules against a Firestore stub that counts
reads, writes and batches. `tools/extract.py` runs `node --check` over every
page's module script and every `js/*.js`, plus an argument-count check against
the real signatures in `db.js`, `attendance.js`, `tmiEngine.js` and `data.js`.
That second check exists because three call sites passed a document ID to
`addDoc(collection, data)` — valid JavaScript, silently wrong, no UI error.

The suites import copies of the `js/` modules so that `./db.js` resolves to the
stub; `run.sh` syncs them first. Never edit `tools/sim/{attendance,tmiEngine,data,utils}.js`
— they are overwritten on every run.

When a fixture fails after a deliberate behaviour change, change the fixture
deliberately and say so. Do not nudge numbers until the suite goes green.

## The hard constraint

Firestore **Spark (free) plan**: 50,000 reads/day, 20,000 writes/day, and no
Cloud Functions. Everything server-side has to happen in the browser. A page
that reads a whole collection on load will burn the day's quota before lunch —
this has happened twice.

- `js/data.js` caches reference data (students, staff, schedules) in
  **localStorage** behind a `meta/versions` stamp doc. It used `sessionStorage`
  once; every new tab re-downloaded ~880 docs and the school hit 185k reads in
  an hour.
- `js/db.js` has a read meter. `p2mtReads()` in the browser console prints
  per-collection and per-page tallies, and warns with a stack trace on any
  query over 300 docs.
- `js/readstats.js` flushes per-person/per-day tallies to `readStats`, shown in
  Diagnostics → Read Usage, so you can tell *who* is making the reads.
- Bulk repair tools each read a wide range. They live behind a collapsed
  `<details>` with a typed confirmation in Schedule Admin for that reason.

## Attendance is exceptions-only

`attendanceEvents/{date}_{sectionKey}_{studentKey}` holds only T / U / E or a
TMI-bearing record. **Present is the absence of a document.** A companion
`attendanceSessions/{date}_{sectionKey}` records that attendance was taken at
all, with roster and exception counts — that is how the UI distinguishes "all
present" from "nobody took the register".

Document IDs are deterministic:
`sectionKey = slug(teacherSurname)~slug(className)~slug(startTime)[~lab]`.
The teacher's surname is *inside the ID*, so renaming a teacher means moving
documents, not editing a field — see `renameTeacher()` in `js/attendance.js`
and the Rename a Teacher tool in Schedule Admin.

`js/attendance.js` is the only module that talks to Firestore about
attendance. Keep it that way.

## TMI (the school's detention equivalent)

Rules live in `js/tmiEngine.js`:

- U (unexcused) = 120 min; a manual override on a non-U = 120 min
- 3 tardies = 90 min, once per period
- an event can carry its own `tmiMinutes` (Dress Code Level 1 = 30)
- hard cap `MAX_TMI = 240`

The TMI week is **Wednesday–Tuesday** (`TMI_WEEK_START_DOW = 3`). A period key
of `range__start__end` is an explicit override from "Use This Range as TMI
Window" and must never be rewritten by the weekly logic. Records are
`interventionLogs/tmi_{studentKey}_{periodKey}`.

Two things about identity are easy to get wrong:

- `resolveIdentity()` fills in a missing studentId or A# from the cached
  roster, so every writer addresses the same document. Without it one student
  gets two records and the duplicates are painful to merge.
- A week's TMI can come from **several teachers** (a dress code from one, a
  missed class from another) on **one** record. The record carries a
  `teachers` array for that; `teacherLastName` holds only the commonest and is
  not sufficient for filtering.

A student's name is stored **"Last, First"**, via `studentDisplayName()` in
`js/utils.js`. Pages that render a name should resolve it from the student
record and fall back to the stored string only when the student has left.

Staff names arrive in several spellings — a Google display name uses a legal
first name ("ZACHARY MCCOY") where the staff record has the name the person
goes by ("Zach"). `resolveStaffSurname()` handles that; match on email where
one is available, because it is exact.

## DataTables

jQuery DataTables, and it has bitten this codebase repeatedly:

- `destroy()` restores the cached rows over the tbody — **destroy before
  rewriting the HTML**, never after
- `searching: false` disables custom `$.fn.dataTable.ext.search` filters
  entirely, so a page with its own filter box must leave searching on
- `show()` / `hide()` on rows breaks paging; filter through the API instead

## Firestore indexes

Composite indexes have to be created by hand in the Firebase console — there
is no deploy step here. A query that needs a missing index throws, so the
engine catches and falls back to a wider read with a one-time console warning
rather than failing a save. If a new query needs an index, tell the user which
collection and which fields, in that order.

## House style

- Comments explain *why*, especially where the code looks odd because of a bug
  that already happened. Several comments in `tmiEngine.js` are the only record
  of an incident; don't strip them.
- Reproduce a bug before fixing it. Several "obvious" diagnoses here were
  wrong, and the probe is what caught it.
- Say plainly when a problem predates the change being blamed for it.
- Commits: `git -c user.name="Zach" -c user.email="zmccoy@gmail.com" commit`.

## Deploying

Firebase Hosting, from the user's machine. They push, then check the live app.
Changes that need a bulk repair run (Schedule Admin → Attendance & TMI) should
say so explicitly, with the date range to use.
