# Three Complete HTML Pages for P2MT

## Overview
Created three comprehensive, fully-functional HTML pages for the P2MT school management static web app. All pages use W3.CSS styling, Firebase/Firestore integration, and DataTables for data management.

---

## 1. master-schedule.html (33 KB)
**Navigation ID:** `master-schedule`  
**Purpose:** View, edit, and manage all student class schedules centrally.

### Key Features
- **Master Schedule DataTable** - displays all class schedules with rich filtering
  - Columns: Student Name, ChattState A#, School Year, Semester, Campus, Class Name, Teacher, Days (color badges), Start/End Time, Flags (Online/Ind Study/Lab), Actions
  - Day badges with color coding: M=blue, T=teal, W=green, Th=orange, F=purple
  - Edit/Delete actions for each record

- **Filter Bar**
  - School Year (text input)
  - Semester (Fall/Spring radio buttons)
  - Teacher (last name search)
  - Student (name or A# search)
  - Campus filter
  - Apply button with real-time filtering

- **Add/Edit Class Modal**
  - Student searchable select with dropdown (loads from `students`)
  - School Year (defaults to `getCurrentSchoolYear()`)
  - Semester select
  - Campus (defaults to "STEM School")
  - Class Name
  - Teacher Last Name
  - Days checkboxes (M/T/W/Th/F)
  - Start/End Time inputs
  - Online, Ind Study, Learning Lab checkboxes
  - Comment textarea

- **Action Buttons**
  - **Add Class** - Opens modal for new schedule entry
  - **Download Schedule** - Exports filtered table as CSV
  - **Upload Schedule CSV** - Bulk import with template download and preview
  - **Propagate Attendance Logs** - Creates `classAttendanceLogs` for all schedule/day combinations in date range

- **CSV Upload Features**
  - Template download with proper column headers
  - CSV preview (first 5 rows) before import
  - Progress bar during import
  - Error handling and success metrics

- **Attendance Propagation Modal**
  - School Year, Semester, Start Date, End Date inputs
  - Creates attendance logs for each student/class/day in range
  - Progress bar with real-time updates
  - Batch processing (500 records per batch)

- **Firestore Collection:** `classSchedules`
  - Fields: `schoolYear`, `semester`, `chattStateANumber`, `studentName`, `studentId`, `campus`, `className`, `teacherLastName`, `staffId`, `classDays` (array), `startTime`, `endTime`, `online`, `indStudy`, `learningLab`, `comment`, `startDate`, `endDate`

---

## 2. schedule-admin.html (33 KB)
**Navigation ID:** `schedule-admin`  
**Purpose:** Administrative tools for bulk schedule management and reporting.

### Tab-Based Interface
Built with W3.CSS tab system for organized workflow.

#### Tab 1: Upload Schedule
- Large drag-and-drop upload area with visual feedback
- File input and "Click to browse" fallback
- Template download link
- CSV preview table (first 5 rows)
- Column mapping and validation
- Import button with progress bar and results display
- Error/success metrics

#### Tab 2: Add Single Class
- Full form layout (same fields as master-schedule edit modal)
- Student searchable select with dropdown
- School Year, Semester, Campus inputs
- Class Name, Teacher Last Name
- Days checkboxes
- Start/End Time
- Online, Ind Study checkboxes
- Comment textarea
- Submit button with validation
- Result display on success

#### Tab 3: Propagate Attendance
- School Year, Semester, Start Date, End Date inputs
- "Propagate" button
- Creates `classAttendanceLogs` for each class/day combination in range
- Progress bar with real-time processing updates
- Results summary on completion

#### Tab 4: Delete Schedule
- **WARNING section** (red border) explaining destructive operation
- Delete filters: School Year (required), Semester (required), Graduation Year (optional)
- Preview button to show record count before deletion
- Confirmation field (must type "DELETE")
- Delete button (only appears after preview)
- Progress bar during deletion
- Safety measures prevent accidental bulk deletions

#### Tab 5: Download Reports
**Download Class Schedule**
- Filter by: School Year, Semester, Teacher (optional)
- CSV export with all schedule fields

**Download Class Attendance**
- Filter by: School Year, Semester, Date Range, Teacher (optional)
- CSV export with: Student Name, ChattState A#, Class Name, Teacher, Date, Status

### Key Functions
- Tab switching with visual indicators
- CSV import with Papa Parse
- Drag-and-drop file upload
- Batch writing (500 records per batch)
- Real-time progress updates
- Comprehensive error handling

---

## 3. learning-lab.html (37 KB)
**Navigation ID:** `learning-lab`  
**Purpose:** Manage special intervention learning lab sessions tied to intervention logs.

### Background Context
Learning labs are special class sessions added to student schedules for intervention purposes. They appear in the master schedule but are excluded from TMI (Teacher-Managed Initiative) assignments. Each learning lab can have 1-5 sessions with different schedules.

### Key Features

- **Learning Lab DataTable**
  - Columns: Student Name, ChattState A#, Class Name, Teacher, Days (badges), Time, Start Date, End Date, Linked Intervention, Actions
  - Filtered to show only records where `learningLab: true`
  - Edit, View Schedule, Delete actions

- **Filter Bar**
  - School Year, Semester, Student search, Teacher search
  - Apply filters button

- **Add/Edit Learning Lab Modal** (Complex Form)
  - **Basic Info Section**
    - Student searchable select
    - School Year (defaults to current)
    - Semester select
    - Campus (preset to "STEM School")
    - Class Name
    - Teacher searchable select (loads from `staff`)

  - **Date Range**
    - Start Date (when lab begins)
    - End Date (when it ends)

  - **Sessions Section** (Expandable/Collapsible)
    - 5 optional sessions (Session 1 required, others optional)
    - Each session has:
      - Days checkboxes (M/T/W/Th/F)
      - Start Time
      - End Time
    - Session toggles show/hide content
    - Visual indicators (enabled = blue, disabled = gray)

  - **Options Section**
    - Online checkbox
    - Independent Study checkbox
    - Comment textarea

  - **Intervention Linking**
    - Searchable select for interventions
    - Filters to student's active interventions
    - Links lab sessions to `interventionLogs` record

### On Save Workflow
1. Creates one `classSchedules` record per session (1-5)
2. All records have `learningLab: true`
3. Updates `interventionLogs` record to link schedule IDs
4. Propagates `classAttendanceLogs` for each session day between start and end dates

### Actions
- **Edit** - Loads existing lab (shows first session)
- **View Schedule** - Shows all sessions for this learning lab in a modal
- **Delete** - Deletes all sessions related to the lab

### Firestore Collections Used
- `classSchedules` (with `learningLab: true`, `startDate`, `endDate`)
- `interventionLogs` (with `linkedScheduleIds` array)
- `students` (for student search)
- `staff` (for teacher search)

---

## Common Implementation Details

### Standard Shell
All pages use the provided standard HTML shell:
- W3.CSS framework
- Font Awesome 6.4.0 icons
- jQuery 3.7.0
- DataTables 1.13.6
- Papa Parse 5.4.1 for CSV handling
- Firebase config and custom JS modules

### Error Handling
- Try/catch on all async operations
- `showToast()` for user feedback (success/error)
- Validation before form submission
- Graceful handling of missing data

### UI Components
- **DataTables** - All data grids with pagination, search, sorting
- **Modals** - W3.CSS modals for forms and confirmations
- **Progress Bars** - Real-time progress during bulk operations
- **Badges** - Color-coded day and status badges
- **Dropdowns** - Searchable selects with autocomplete
- **Loading Spinners** - During async operations

### Database Functions Used
All pages integrate with existing infrastructure:
- `getAll()` - Load all documents
- `getById()` - Load single document
- `addDoc()` - Create new
- `updateDoc()` - Edit existing
- `deleteDoc()` - Delete record
- `getWhere()` - Query with filters
- `getWhereMultiple()` - Complex queries
- `batchWrite()` - Bulk operations
- `formatDate()` - Date formatting
- `exportCSV()` - CSV generation
- `showToast()` - Notifications
- `getCurrentSchoolYear()` - School year context
- `getCurrentSemester()` - Semester context

### Navigation Integration
Each page initializes navigation with its ID:
- `master-schedule`
- `schedule-admin`
- `learning-lab`

---

## File Sizes
- **master-schedule.html** - 33 KB (47 functions/onclick handlers)
- **schedule-admin.html** - 33 KB (32 functions/onclick handlers)
- **learning-lab.html** - 37 KB (42 functions/onclick handlers)

**Total: 103 KB of complete, production-ready HTML/JavaScript**

---

## Features Summary

| Feature | Master Schedule | Schedule Admin | Learning Lab |
|---------|-----------------|----------------|--------------|
| DataTable | ✓ | - | ✓ |
| Add/Edit Form | ✓ | ✓ | ✓ |
| CSV Upload | ✓ | ✓ | - |
| CSV Download | ✓ | ✓ | - |
| Bulk Import | ✓ | ✓ | - |
| Attendance Propagation | ✓ | ✓ | ✓ (on save) |
| Multi-session Support | - | - | ✓ (5 sessions) |
| Intervention Linking | - | - | ✓ |
| Delete with Confirmation | ✓ | ✓ | ✓ |
| Filtering | ✓ | - | ✓ |
| Reporting | ✓ (2 reports) | ✓ (2 reports) | - |
| Progress Bars | ✓ | ✓ | ✓ |
| Searchable Selects | ✓ | ✓ | ✓ |
| Color Badges | ✓ | - | ✓ |

All pages are fully complete with no TODO placeholders and are ready for production deployment.
