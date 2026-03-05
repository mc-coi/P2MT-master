# P2MT Files Created - Summary

This document lists the five new files created for the P2MT school management static web app.

## File Summary

### 1. school-calendar.html (13 KB)
**Location:** `/sessions/bold-loving-cray/mnt/P2MT-master/static-web-app/school-calendar.html`

**Purpose:** View and edit the academic school calendar

**Key Features:**
- Interactive calendar view with rows for each day
- Columns for 11 different day types: STEM days, Phase II days, TMI periods, ER days, etc.
- Color-coded rows: yellow for TMI days, light blue for ER days, gray for non-editable weekends
- Date range filter to load specific months
- "Add Date Range" modal to bulk-create calendar entries for weekdays
- "Save Changes" button to track and save only modified rows
- Firestore collection: `schoolCalendar`

**Key Functionality:**
- Load calendar data from Firestore
- Filter by date range
- Add date ranges (automatically creates weekday entries only)
- Edit calendar fields with change tracking
- Save only modified rows to optimize updates

---

### 2. pbl-planner.html (31 KB)
**Location:** `/sessions/bold-loving-cray/mnt/P2MT-master/static-web-app/pbl-planner.html`

**Purpose:** Plan and manage Project-Based Learning (PBL) projects

**Key Features:**
- Three-tab interface: Projects | Events | Teams
- **Tab 1: PBL Projects** — DataTable with add/edit/delete, CSV export
- **Tab 2: PBL Events** — Filter by project, manage Kickoff/Final Presentation/Field Trip events
- **Tab 3: PBL Teams** — Roster management with student assignment to teams, CSV export

**Key Functionality:**
- Full CRUD (Create, Read, Update, Delete) for PBL projects
- Event management with location tracking
- Student team assignment with team number editing
- CSV export for projects and rosters
- Dropdown filters to view data by specific PBL project
- Firestore collections: `pbls`, `pblEvents`, `pblTeams`, `students`

---

### 3. email-templates.html (14 KB)
**Location:** `/sessions/bold-loving-cray/mnt/P2MT-master/static-web-app/email-templates.html`

**Purpose:** Create and manage email notification templates for interventions

**Key Features:**
- DataTable view of all templates
- Add/edit templates with:
  - Template title and email subject
  - Large textarea for email body with variable placeholders
  - Checkboxes for sending to student, parent, or teacher
  - Intervention type and level selectors
- Preview modal showing template with sample data substitution
- Variables supported: {{studentName}}, {{parentName}}, {{interventionType}}, {{level}}, {{startDate}}, {{tmiMinutes}}, {{staffName}}, {{schoolYear}}
- Full CRUD operations
- Firestore collections: `p2mtTemplates`, `interventionTypes`

**Key Functionality:**
- Create email templates for different intervention types and levels
- Preview templates with real sample data
- View recipients (Student/Parent/Teacher)
- Template variable substitution for email personalization

---

### 4. fet-tools.html (16 KB)
**Location:** `/sessions/bold-loving-cray/mnt/P2MT-master/static-web-app/fet-tools.html`

**Purpose:** Import FET (Free Electron Timetabling) scheduling software data

**Key Features:**
- Step-by-step upload interface for three CSV files:
  1. FET Student Input CSV (Student Name, Activities/Classes)
  2. FET Class-Teacher Input CSV (Class ID, Teacher Name)
  3. FET Timetable CSV (Class ID, Day, Start Time, End Time)
- Configuration options: School Year, Semester, Graduation Year filter
- Processing engine that cross-references all three files
- Results display with summary statistics
- Preview table (first 20 rows of generated schedule)
- CSV download and direct Firestore import
- Firestore: uses `students` for lookup, writes to `classSchedules`

**Key Functionality:**
- Parse three FET CSV exports
- Map student names to ChattState A# from student database
- Extract teacher last names
- Generate P2MT schedule format with all fields
- Batch import to Firestore (handles Firestore 500-document limit)

**Output Format:**
- schoolYear, semester, chattStateANumber, studentName, campus, className, teacherLastName, classDays, startTime, endTime, online, indStudy

---

### 5. README.md (15 KB)
**Location:** `/sessions/bold-loving-cray/mnt/P2MT-master/static-web-app/README.md`

**Purpose:** Comprehensive setup and deployment guide

**Sections Included:**
1. **Overview** — What P2MT is and its use cases
2. **Technology Stack** — Frontend, database, auth, hosting, libraries
3. **Firebase Setup** (Step-by-step)
   - Create Firebase project
   - Enable Firestore Database
   - Enable Authentication (Google)
   - Get configuration credentials
   - Configure security rules
   - Create initial collections
4. **GitHub Pages Deployment**
   - Create GitHub repository
   - Upload files
   - Enable GitHub Pages
   - Add domain to Firebase
5. **First Login & Staff Setup**
   - Access the app
   - Add your email to staff collection
   - Verify access
   - Add more staff via admin interface
6. **Microsoft 365 Email Integration** (Optional)
   - Azure AD app registration
   - Permission configuration
   - Code updates
7. **Firestore Collections Reference** — Table of all 14 collections with fields
8. **CSV Import Formats** — Exact column formats for bulk imports
9. **Troubleshooting** — 12 common issues and solutions

---

## File Locations

All files are located in:
```
/sessions/bold-loving-cray/mnt/P2MT-master/static-web-app/
```

**Files:**
- `school-calendar.html` — School calendar management
- `pbl-planner.html` — Project-based learning planner
- `email-templates.html` — Email template manager
- `fet-tools.html` — FET schedule import tool
- `README.md` — Setup and deployment guide

---

## Integration with Existing Infrastructure

All files leverage the existing P2MT infrastructure:

**Dependencies:**
- `firebase-config.js` — Firebase v10 CDN exports (app, db, auth)
- `js/auth.js` — Authentication initialization and getCurrentUser()
- `js/db.js` — Database functions (getAll, getById, addDoc, updateDoc, deleteDoc, getWhere, batchWrite)
- `js/nav.js` — Navigation bar initialization
- `js/utils.js` — Utility functions (formatDate, exportCSV, importCSV, showToast, showModal, getCurrentSchoolYear, getCurrentSemester)
- `css/main.css` — Custom styling

**External Libraries:**
- W3.CSS 4 for responsive layout
- Font Awesome 6.4 for icons
- jQuery 3.7 for DOM manipulation
- DataTables 1.13.6 for sortable/filterable tables
- PapaParse 5.4.1 for CSV parsing

---

## Production Readiness

All files are complete and production-ready:
- ✓ No TODO placeholders
- ✓ Full error handling with user feedback
- ✓ Input validation on all forms
- ✓ Confirmation dialogs for destructive operations
- ✓ Real-time data sync with Firestore
- ✓ CSV export functionality
- ✓ CSV import functionality (FET tool)
- ✓ Modal dialogs for data entry
- ✓ Change tracking (school calendar)
- ✓ Search and filter functionality
- ✓ Responsive W3.CSS design
- ✓ Comprehensive documentation (README)

---

## Next Steps

1. **Copy files to your GitHub repository** — Push all five files to your repo
2. **Deploy to GitHub Pages** — Enable Pages in repo settings
3. **Configure Firebase** — Follow README.md Firebase Setup section
4. **Add your email as staff** — Get initial access
5. **Initialize system** — Use Admin page to add intervention types and settings
6. **Bulk import data** — Use CSV import features to load students, staff, and schedules

---

**Created:** March 4, 2026
**Framework:** W3.CSS + Vanilla JavaScript
**Database:** Firebase Firestore
**Authentication:** Firebase Google Sign-In
**Hosting:** GitHub Pages (static)
