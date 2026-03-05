# New P2MT Pages Quick Reference

## Files Created
1. **interventions.html** - Intervention Log Management
2. **tmi-review.html** - Teacher TMI Attendance Review  
3. **tmi-approval.html** - Admin Final TMI Approval

All files are located in: `/sessions/bold-loving-cray/mnt/P2MT-master/static-web-app/`

---

## interventions.html
**URL:** `/interventions.html` or `/interventions.html?student=STUDENT_ID`

**Purpose:** Log, manage, and track academic/behavioral interventions

**Key Features:**
- Add/Edit/Delete interventions with modal forms
- Filter by student, type, status, date range
- Color-coded intervention levels (1-6)
- Email notification templates with copy-to-clipboard
- CSV export of filtered interventions
- DataTable with sortable, searchable columns
- Live calculation of TMI remaining minutes

**Firestore Collections:**
- `interventionLogs`
- `interventionTypes`
- `students`
- `p2mtTemplates`

**Main Functions:**
```javascript
loadInterventionTypes()        // Load dropdown options
loadStudents()                 // Student lookup
loadInterventions()            // Load all logs
openAddModal()                 // New intervention form
editIntervention(id)           // Edit existing
saveIntervention()             // Save to Firestore
deleteIntervention(id)         // Delete with confirmation
showNotificationTemplate(id)   // Display email preview
applyFilters()                 // Filter by criteria
downloadCSV()                  // Export data
```

---

## tmi-review.html
**URL:** `/tmi-review.html`

**Purpose:** Teachers review class attendance during TMI period and confirm student service

**Key Features:**
- Cascade filters: Teacher → Class → Load Attendance
- Dynamic date columns for each TMI period day
- Radio buttons for attendance codes (P/T/E/U) per day
- Editable TMI Served field with auto-calculated Remaining
- "In TMI Now" checkbox per student
- Save All button for batch updates
- Summary statistics card

**Firestore Collections:**
- `classSchedules`
- `classAttendanceLogs`
- `interventionLogs`
- `schoolCalendar`
- `students`

**Main Functions:**
```javascript
loadTeachers()                 // Extract from classSchedules
loadClasses()                  // Load available classes
loadStudents()                 // Student data
loadInterventions()            // TMI assignments
loadTMIPeriod()               // TMI dates from calendar
onTeacherChange()             // Cascade class filter
loadAttendance()              // Fetch class roster + attendance
renderAttendanceTable()       // Generate with date columns
saveAllAttendance()           // Batch update Firestore
```

**Attendance Codes:**
- **P** = Present
- **T** = Tardy
- **E** = Early Dismissal
- **U** = Unexcused Absence

---

## tmi-approval.html
**URL:** `/tmi-approval.html`

**Purpose:** Admin/lead approval - finalize TMI assignments and send notifications

**Key Features:**
- Date range selector (defaults to last 30 days)
- Summary cards: Total Students, Minutes Assigned/Served/Remaining
- Status badges: Complete (green), Partial (orange), Not Started (red)
- Parent/Student notification checkboxes
- Individual and bulk notification sending
- Copy-to-clipboard for notification templates
- Process All button to mark complete interventions
- Mark individual as Complete
- CSV report export

**Firestore Collections:**
- `interventionLogs`
- `students`
- `parents`
- `p2mtTemplates`
- `dailyAttendanceLogs`
- `classAttendanceLogs`

**Main Functions:**
```javascript
loadInitialData()             // Load all required collections
loadDefaultDates()            // Set date defaults
loadTMIData()                 // Filter by date range
renderTMITable()              // Create approval table
processAllTMI()               // Batch mark complete
markComplete(studentId)       // Individual completion
showStudentNotification()     // Display template
showParentNotification()      // Display template
showBulkNotifications()       // Aggregate all
copyAllNotifications()        // Copy all to clipboard
downloadReport()              // CSV export
```

**Status Calculation:**
```
if (tmiServed >= tmiMinutes) → "Complete"
else if (tmiServed > 0)      → "Partial"
else                         → "Not Started"
```

---

## Common Implementation Patterns

### Data Loading Pattern
```javascript
async function loadData() {
  try {
    $('#loadingSpinner').show();
    let data = await getAll('collectionName');
    // Process data
    $('#loadingSpinner').hide();
    showToast('Data loaded', 'success');
  } catch (error) {
    console.error('Error:', error);
    showToast('Error loading data', 'error');
  }
}
```

### Modal Pattern
```javascript
function openModal(modalId) {
  document.getElementById(modalId).style.display = 'block';
}

function closeModal(modalId) {
  document.getElementById(modalId).style.display = 'none';
}

// In form submit
form.onsubmit = async (e) => {
  e.preventDefault();
  try {
    // Save logic
    closeModal('myModal');
  } catch (error) {
    showToast('Error', 'error');
  }
}
```

### DataTable Pattern
```javascript
function initTable() {
  if (existingTable) existingTable.destroy();
  
  $('#tbody').empty();
  data.forEach(item => {
    $('#tbody').append(`<tr>...</tr>`);
  });
  
  table = $('#table').DataTable({
    paging: true,
    pageLength: 25,
    ordering: true,
    searching: true
  });
}
```

### Filter Pattern
```javascript
function applyFilters() {
  filtered = data.filter(item => {
    if (filter1 && !item.field1.includes(filter1)) return false;
    if (filter2 && item.field2 !== filter2) return false;
    // More filters...
    return true;
  });
  initTable();
}
```

---

## Navigation Integration

All three pages are integrated with the navigation system:
- `initNav('interventions')` - Intervention Log page
- `initNav('tmi-review')` - TMI Review page
- `initNav('tmi-approval')` - TMI Approval page

Navigation styling and menu items should be configured in `nav.js`

---

## Styling Classes

### Level Badges (interventions.html)
```css
.level-badge-1 { background: #4CAF50; }     /* Green */
.level-badge-2 { background: #8BC34A; }     /* Light Green */
.level-badge-3 { background: #FFEB3B; }     /* Yellow */
.level-badge-4 { background: #FF9800; }     /* Orange */
.level-badge-5 { background: #F44336; }     /* Red */
.level-badge-6 { background: #8B0000; }     /* Dark Red */
```

### Status Badges (tmi-approval.html)
```css
.status-complete   { background: #4CAF50; } /* Green */
.status-partial    { background: #FF9800; } /* Orange */
.status-notstarted { background: #F44336; } /* Red */
```

### Summary Cards
```css
.summary-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}
```

All pages use **W3.CSS** framework classes (w3-card, w3-button, w3-input, etc.)

---

## Troubleshooting

### Page doesn't load
- Check browser console for errors
- Verify Firebase config is loaded
- Ensure auth.js initiates properly
- Check that nav.js initializes with correct page ID

### Data not appearing
- Verify Firestore collections exist with correct names
- Check browser permissions/Firestore rules
- Look for errors in console during data fetch
- Verify student/teacher IDs match across collections

### Modals don't open
- Ensure z-index:10 is applied
- Check that `closeModal()` is called without errors
- Verify element IDs match in HTML and JavaScript

### Filters not working
- Ensure filter fields have correct IDs
- Check that data properties match filter logic
- Verify DataTable is refreshed after filtering

### Save fails silently
- Check Firestore collection structure
- Verify user has write permissions
- Look for validation errors in console
- Ensure all required fields have values

---

## Browser Compatibility
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Dependencies
- jQuery 3.7.0
- DataTables 1.13.6
- PapaParse 5.4.1
- Font Awesome 6.4.0
- W3.CSS 4
- Firebase SDK v10 (via CDN)

All dependencies are loaded via CDN - no build process required.
