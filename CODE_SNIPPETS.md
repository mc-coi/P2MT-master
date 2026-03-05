# Code Snippets from Attendance Pages

## Key Implementation Examples

### Daily Attendance: Date Range Generation (Mon-Fri Only)

```javascript
function generateDateRange(startDate, endDate) {
  const dates = [];
  let current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    const day = current.getDay();
    // Skip weekends (0 = Sunday, 6 = Saturday)
    if (day !== 0 && day !== 6) {
      dates.push(current.toISOString().split('T')[0]);
    }
    current.setDate(current.getDate() + 1);
  }

  return dates;
}
```

### Daily Attendance: Color-Coded Badge Rendering

```javascript
function initializeDataTable() {
  const tableData = getFilteredRecords().map(record => {
    const codeColor = ATTENDANCE_CODES[record.attendanceCode]?.color || '#666';
    const codeBadge = `<span class="attendance-badge" style="background-color: ${codeColor};">${record.attendanceCode}</span>`;
    
    return {
      date: formatDate(record.absenceDate),
      studentName: record.studentName || 'Unknown',
      chattStateA: record.chattStateANumber || '-',
      code: codeBadge,
      // ... other fields
    };
  });
  
  // Initialize DataTable with formatted data
}
```

### Daily Attendance: Searchable Student Dropdown

```javascript
function filterStudentDropdown() {
  const input = document.getElementById('studentName').value.toLowerCase();
  const dropdown = document.getElementById('student-dropdown');
  
  const filtered = allStudents.filter(s => 
    `${s.lastName}, ${s.firstName}`.toLowerCase().includes(input) ||
    s.chattStateANumber.includes(input)
  );

  dropdown.innerHTML = filtered.map(student => 
    `<div class="w3-hover-light-blue w3-padding" 
          onclick="selectStudent('${student.id}', '${student.chattStateANumber}', '${student.lastName}, ${student.firstName}')">
      ${student.lastName}, ${student.firstName} (${student.chattStateANumber})
    </div>`
  ).join('');
  
  dropdown.style.display = 'block';
}
```

### Class Attendance: Smart Filter Cascading

```javascript
function populateClassDropdown() {
  const selectedTeacher = document.getElementById('filter-teacher').value;
  const filterClass = document.getElementById('filter-class');
  
  // Clear existing options
  filterClass.innerHTML = '<option value="">-- Select Class --</option>';
  
  if (!selectedTeacher) return;

  const classes = [...new Set(
    allClassSchedules
      .filter(cs => cs.teacherLastName === selectedTeacher)
      .map(cs => cs.className)
  )].sort();

  classes.forEach(className => {
    const option = document.createElement('option');
    option.value = className;
    option.textContent = className;
    filterClass.appendChild(option);
  });
}
```

### Class Attendance: Load Student Attendance Form

```javascript
function displayAttendanceForm(students, existingLogs, schedule) {
  const container = document.getElementById('attendance-students-list');
  container.innerHTML = '';

  students.forEach(student => {
    const log = existingLogs.find(l => l.chattStateANumber === student.chattStateANumber);
    const currentCode = log?.attendanceCode || 'P';
    const currentComment = log?.comment || '';
    const assignTmi = log?.assignTmi || false;

    const studentRow = document.createElement('div');
    studentRow.className = 'attendance-row';
    studentRow.innerHTML = `
      <div style="padding: 8px 0;">
        <div style="margin-bottom: 8px;">
          <span class="student-name">${student.lastName}, ${student.firstName}</span>
          <span style="color: #999; font-size: 12px;">(${student.chattStateANumber})</span>
        </div>
        <div class="radio-group">
          <label><input type="radio" name="code-${student.chattStateANumber}" value="P" ${currentCode === 'P' ? 'checked' : ''} onchange="updateAttendanceCode('${student.chattStateANumber}', this.value)"> P</label>
          <label><input type="radio" name="code-${student.chattStateANumber}" value="T" ${currentCode === 'T' ? 'checked' : ''} onchange="updateAttendanceCode('${student.chattStateANumber}', this.value)"> T</label>
          <!-- More codes... -->
        </div>
        <input type="text" class="comment-input" id="comment-${student.chattStateANumber}" placeholder="Comment..." value="${currentComment}">
        <label><input type="checkbox" id="tmi-${student.chattStateANumber}" ${assignTmi ? 'checked' : ''} onchange="updateAttendanceTMI('${student.chattStateANumber}', this.checked)"> Assign TMI</label>
      </div>
    `;
    container.appendChild(studentRow);
  });
}
```

### Class Attendance: Upsert Logic

```javascript
async function saveAllChanges() {
  const savePromises = [];

  allStudents.forEach(studentId => {
    const code = document.querySelector(`input[name="code-${studentId}"]:checked`)?.value || 'P';
    const comment = document.getElementById(`comment-${studentId}`)?.value || '';
    const assignTmi = document.getElementById(`tmi-${studentId}`)?.checked || false;

    const existingLog = allClassAttendanceLogs.find(l =>
      l.classScheduleId === currentClassScheduleId &&
      l.classDate === currentDate &&
      l.chattStateANumber === studentId
    );

    if (existingLog) {
      // Update existing record
      savePromises.push(
        updateDoc('classAttendanceLogs', existingLog.id, {
          attendanceCode: code,
          comment,
          assignTmi,
          updatedAt: new Date().toISOString()
        })
      );
    } else {
      // Create new record
      savePromises.push(
        addDoc('classAttendanceLogs', {
          classScheduleId: currentClassScheduleId,
          classDate: currentDate,
          chattStateANumber: studentId,
          studentName: studentName,
          attendanceCode: code,
          comment,
          assignTmi,
          createdBy: currentUser.uid,
          updatedAt: new Date().toISOString()
        })
      );
    }
  });

  await Promise.all(savePromises);
  showToast('Attendance saved successfully', 'success');
}
```

### Both Pages: Error Handling Pattern

```javascript
async function init() {
  try {
    // Load students and attendance data
    await loadStudents();
    await loadAttendanceRecords();
    initializeDataTable();
    attachEventListeners();
  } catch (error) {
    console.error('Error initializing page:', error);
    showToast('Error loading attendance data', 'error');
  }
}
```

### Both Pages: Module Initialization

```javascript
import { initAuth, getCurrentUser } from './js/auth.js';
import { getAll, addDoc, updateDoc, deleteDoc } from './js/db.js';
import { initNav } from './js/nav.js';
import { formatDate, exportCSV, showToast, ATTENDANCE_CODES } from './js/utils.js';

let currentUser = null;

// Initialize page
initAuth().then(user => {
  currentUser = user;
  initNav('daily-attendance'); // or 'class-attendance'
  init();
});
```

### CSV Export Pattern

```javascript
function downloadCSV() {
  const records = getFilteredRecords();
  const csvData = records.map(record => ({
    'Date': formatDate(record.absenceDate),
    'Student Name': record.studentName,
    'ChattState A#': record.chattStateANumber,
    'Code': record.attendanceCode,
    'Comment': record.comment || '',
    'Staff': record.staffName,
    'Created Date': formatDate(record.createDate)
  }));

  if (csvData.length === 0) {
    showToast('No records to download', 'warning');
    return;
  }

  exportCSV(csvData, 'daily-attendance.csv');
}
```

### Modal Confirmation Pattern

```javascript
window.deleteAbsence = function(id) {
  showModal(
    'Confirm Delete',
    '<p>Are you sure you want to delete this absence record?</p>',
    async () => {
      try {
        await deleteDoc('dailyAttendanceLogs', id);
        showToast('Absence record deleted', 'success');
        await loadAttendanceRecords();
        initializeDataTable();
      } catch (error) {
        console.error('Error deleting record:', error);
        showToast('Error deleting absence record', 'error');
      }
    }
  );
};
```

### DataTable Initialization Pattern

```javascript
function initializeDataTable() {
  if (attendanceTable) {
    attendanceTable.destroy();
  }
  
  // Build table data
  const tableData = getFilteredRecords().map(record => ({
    // ... format data
  }));

  // Clear and populate tbody
  $('#attendanceTable tbody').html('');
  tableData.forEach(row => {
    $('#attendanceTable tbody').append(`<tr><!-- row content --></tr>`);
  });

  // Initialize DataTable
  attendanceTable = $('#attendanceTable').DataTable({
    paging: true,
    pageLength: 25,
    ordering: true,
    searching: true,
    info: true,
    lengthChange: true,
    autoWidth: false
  });
}
```

## Best Practices Used

1. **Separation of Concerns**: Data loading, UI rendering, and event handling are separate functions
2. **Error Handling**: All async operations wrapped in try/catch with user feedback
3. **Loading States**: Spinners shown during data fetches
4. **Form Validation**: Required fields checked before submission
5. **User Feedback**: Toast notifications for all operations
6. **Responsive Design**: W3.CSS grid system for mobile/tablet/desktop
7. **Local State Management**: JavaScript objects for data caching
8. **Event Delegation**: Event listeners attached to document for dynamic elements
9. **Date Handling**: ISO format (YYYY-MM-DD) internally, formatted display with formatDate()
10. **Modal Patterns**: Confirmation dialogs for destructive actions

## Testing Checklist

- [ ] Student dropdown autocomplete works with partial names
- [ ] Date range expansion skips weekends correctly
- [ ] Color-coded badges display with correct colors
- [ ] CSV export includes all filtered records
- [ ] Edit modal pre-fills with existing data
- [ ] Delete confirmation modal appears before deletion
- [ ] Teacher/Class filter cascading works correctly
- [ ] Attendance saves create or update records correctly
- [ ] Absence summary filters work properly
- [ ] Error messages display for invalid operations
- [ ] Loading spinners show during data operations
- [ ] Form validation prevents empty submissions
- [ ] Modal windows close on cancel
- [ ] Toast notifications appear and disappear
- [ ] DataTables sorting/searching/pagination works

