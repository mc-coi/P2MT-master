# P2MT Attendance Pages Documentation

This document describes the two complete HTML pages created for attendance tracking in the P2MT school management system.

## Files Created

### 1. `daily-attendance.html` (22 KB, 564 lines)
**Purpose:** Log and view daily school absences for students across the entire school.

#### Key Features:
- **Daily Attendance Log Table** with DataTables integration
  - Columns: Date, Student Name, ChattState A#, Code, Comment, Staff, Created Date, Actions
  - Color-coded attendance code badges (P=green, T=yellow, E=blue, U=red, Q=purple, W=gray, H=orange, L=yellow)
  - Edit and Delete functionality for each record

- **Advanced Filtering**
  - Date range filter (Start Date & End Date inputs)
  - Student name search
  - Attendance code filter dropdown
  - Apply/Clear buttons for filter management

- **Add/Edit Absence Modal**
  - Searchable student dropdown (displays "LastName, FirstName (A#)")
  - Absence date range selection (Start Date & End Date)
  - Automatic weekday-only date range expansion (Mon-Fri only)
  - Attendance code selection (8 codes: P/T/E/U/Q/W/H/L)
  - Comment textarea for notes
  - Assign TMI checkbox
  - Form validation for required fields

- **CSV Export**
  - Downloads filtered records with formatted dates and all relevant columns
  - File naming: `daily-attendance.csv`

- **Data Management**
  - Uses `dailyAttendanceLogs` collection
  - Stores staff information (staffId, staffName) from `getCurrentUser()`
  - Filters weekends when creating date ranges
  - Loading spinner while fetching data

#### Firestore Collections:
- **students** - For student lookup (chattStateANumber, firstName, lastName)
- **dailyAttendanceLogs** - Stores records with:
  - `chattStateANumber` - Student ID
  - `absenceDate` - Date in YYYY-MM-DD format
  - `createDate` - Date record was created
  - `attendanceCode` - Single letter code
  - `comment` - Optional notes
  - `staffId` - User ID of staff member who logged
  - `staffName` - Display name of staff member
  - `assignTmi` - Boolean for TMI assignment

---

### 2. `class-attendance.html` (28 KB, 689 lines)
**Purpose:** Take and manage class-period attendance for individual class periods, plus view class absence summaries.

#### Key Features:

**Main Tab: Take Attendance**
- **Smart Filter System**
  - Teacher dropdown (auto-populated from classSchedules)
  - Class dropdown (filters based on selected teacher)
  - Class date input (defaults to today)
  - Apply button to load students

- **Class Information Card**
  - Displays Teacher, Class, Date, Time, Campus
  - Shows only after filters are applied
  - Blue info-style card with formatted data

- **Student Attendance Form**
  - Lists all enrolled students in the selected class
  - For each student:
    - Display name and ChattState A#
    - Radio buttons for codes (P/T/E/U/?)
    - Text input for comments
    - Checkbox for "Assign TMI"
  - "Save All Changes" button (sticky at top and bottom)
  - Loading spinner while fetching class data

- **Automatic Student Loading**
  - Pulls enrolled students from `classSchedules.studentIds`
  - Loads existing attendance logs for the selected date
  - Pre-fills forms with previously entered data

- **Absence Summary Tab**
  - Filters class attendance by:
    - Teacher name
    - Date range (Start & End dates)
  - Shows only non-P (absent) and non-? (unmarked) records
  - DataTable with columns: Date, Class, Student Name, Code, Comment
  - Color-coded badges for each code
  - CSV export button for absence data

#### Data Management:
- **Upsert Logic** - Updates existing records or creates new ones
- **Batch Save** - Saves all student changes in one transaction
- **Date Validation** - Prevents attendance entry for past schedules
- **User Tracking** - Records who created attendance (createdBy field)

#### Firestore Collections:
- **classSchedules** - Source of class information:
  - `teacherLastName` - For filtering
  - `className` - Class identifier
  - `studentIds` - Array of enrolled student IDs
  - `campus`, `startTime`, `endTime` - Display info
  - Other schedule fields (schoolYear, semester, classDays, online, etc.)

- **classAttendanceLogs** - Records individual attendance:
  - `classScheduleId` - Links to classSchedules
  - `classDate` - Date in YYYY-MM-DD format
  - `chattStateANumber` - Student ID
  - `studentName` - Student name (cached)
  - `attendanceCode` - Single letter code
  - `comment` - Optional notes
  - `assignTmi` - Boolean for TMI
  - `createdBy` - Staff member ID
  - `updatedAt` - Timestamp of last update

- **students** - For name lookups when saving

---

## Technical Implementation Details

### Shared Features:
1. **Module Imports** - All files use ES6 modules:
   ```javascript
   import { initAuth, getCurrentUser } from './js/auth.js';
   import { getAll, getById, addDoc, updateDoc, deleteDoc, getWhere } from './js/db.js';
   import { initNav } from './js/nav.js';
   import { formatDate, exportCSV, showToast, showModal, ATTENDANCE_CODES } from './js/utils.js';
   ```

2. **Authentication** - Uses `initAuth()` to ensure user is logged in
3. **Navigation** - Auto-initializes nav with correct active page
4. **Error Handling** - All async operations wrapped in try/catch with toast notifications
5. **Loading States** - Spinners displayed during data fetches
6. **Responsive Design** - W3.CSS grid system for mobile/tablet/desktop
7. **DataTables Integration** - Sortable, searchable, paginated tables

### Standard Page Shell Used:
- DOCTYPE HTML5 with UTF-8 charset
- Viewport meta for responsive design
- W3.CSS 4 for layout and components
- Font Awesome 6.4.0 for icons
- DataTables 1.13.6 for table management
- PapaParse 5.4.1 for CSV handling
- Custom `main.css` for P2MT branding
- Sticky navigation bar
- Fixed toast container (bottom-right)

### Attendance Code Colors (from ATTENDANCE_CODES):
- **P** (Present) - Green (#4CAF50)
- **T** (Tardy) - Yellow (#FFC107)
- **E** (Excused) - Blue (#2196F3)
- **U** (Unexcused) - Red (#F44336)
- **Q** (Quarantine) - Purple (#9C27B0)
- **W** (Withdrawn) - Gray (#757575)
- **H** (Homebound) - Orange (#FF9800)
- **L** (Late Start) - Yellow (#FFEB3B)

---

## Usage Guide

### Daily Attendance Page:
1. Use filters to find specific absences or view all records
2. Click "Add Absence" to log a new absence
3. Select student, date range, code, and comments
4. System automatically creates records for Mon-Fri only (weekends excluded)
5. Edit or delete existing records with action buttons
6. Export filtered records to CSV

### Class Attendance Page:
1. Select teacher, class, and date
2. System loads all enrolled students
3. Mark attendance for each student using radio buttons
4. Add comments or assign TMI as needed
5. Click "Save All Changes" to persist data
6. Switch to "Absence Summary" tab to see non-present records
7. Export attendance or absence data to CSV

---

## Browser Compatibility
- Modern browsers with ES6 module support
- Tested with Firebase v10 CDN modules
- Requires JavaScript enabled
- Mobile-responsive with W3.CSS

## Notes for Developers
- Both pages use local state management with JavaScript objects
- No external state management library needed
- Firestore queries are optimized with single collection fetches
- CSV export uses PapaParse library pre-loaded in base template
- Date formatting uses ISO format (YYYY-MM-DD) internally
- Display format uses MM/DD/YYYY via formatDate() utility

