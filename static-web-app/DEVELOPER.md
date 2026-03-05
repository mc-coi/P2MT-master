# P2MT Developer Guide

Quick reference for developing pages and features for the P2MT application.

## Quick Start Template

Here's a template for creating new pages:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Page Title - P2MT</title>
    
    <link rel="stylesheet" href="https://www.w3schools.com/w3css/4/w3.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="./css/main.css">
</head>
<body>
    <div id="nav-container"></div>
    
    <div class="page-container">
        <div class="page-header">
            <h1>Page Title</h1>
            <p>Page description</p>
        </div>
        
        <!-- Your content here -->
    </div>

    <script type="module">
        import { initAuth } from './js/auth.js';
        import { initNav } from './js/nav.js';
        
        document.addEventListener('DOMContentLoaded', async () => {
            // Wait for auth check
            await initAuth();
            
            // Initialize navigation (replace 'page-id' with your page ID)
            initNav('page-id');
            
            // Load your page data
            loadPageData();
        });
        
        async function loadPageData() {
            // Your code here
        }
    </script>
</body>
</html>
```

## Common Tasks

### Fetching Data from Firestore

```javascript
import { getAll, getById, getWhere, getWhereMultiple } from './js/db.js';

// Get all students
const students = await getAll('students');

// Get specific student
const student = await getById('students', 'student-id');

// Query with condition
const activeStudents = await getWhere('students', 'status', '==', 'active');

// Query with multiple conditions
const filteredStudents = await getWhereMultiple('students', [
  ['status', '==', 'active'],
  ['grade', '==', '10']
]);
```

### Adding/Updating Data

```javascript
import { addDoc, setDoc, updateDoc, deleteDoc } from './js/db.js';

// Add new document (auto-ID)
const docId = await addDoc('students', {
  firstName: 'John',
  lastName: 'Doe',
  studentId: 'STU001',
  grade: '10',
  status: 'active'
});

// Set document (overwrites)
await setDoc('students', 'stu-id', {
  firstName: 'Jane',
  grade: '11'
});

// Update document (partial)
await updateDoc('students', 'stu-id', {
  status: 'inactive'
});

// Delete document
await deleteDoc('students', 'stu-id');
```

### Batch Operations

```javascript
import { batchWrite } from './js/db.js';

const operations = [
  { type: 'set', collection: 'students', id: 'stu1', data: { name: 'Alice' } },
  { type: 'update', collection: 'students', id: 'stu2', data: { status: 'active' } },
  { type: 'delete', collection: 'students', id: 'stu3' }
];

await batchWrite(operations);
```

### Showing Notifications

```javascript
import { showToast } from './js/utils.js';

showToast('Operation successful!', 'success');
showToast('Something went wrong', 'error');
showToast('Please check this', 'warning');
showToast('Information', 'info');
```

### Formatting Dates

```javascript
import { formatDate, toISODate } from './js/utils.js';

// ISO to MM/DD/YYYY
const formatted = formatDate('2025-03-04'); // "03/04/2025"

// Various formats to ISO
const iso = toISODate('03/04/2025'); // "2025-03-04"
```

### Exporting/Importing CSV

```javascript
import { exportCSV, importCSV } from './js/utils.js';

// Export array of objects to CSV
const students = [
  { firstName: 'John', lastName: 'Doe', grade: '10' },
  { firstName: 'Jane', lastName: 'Smith', grade: '11' }
];
exportCSV(students, 'students.csv');

// Import CSV file
const fileInput = document.getElementById('csv-input');
fileInput.addEventListener('change', async (e) => {
  const data = await importCSV(e.target.files[0]);
  console.log(data); // Array of objects
});
```

### Working with DataTables

```html
<!-- Add table to your page -->
<table id="students-table" class="w3-table-all display">
  <thead>
    <tr>
      <th>First Name</th>
      <th>Last Name</th>
      <th>Student ID</th>
      <th>Grade</th>
    </tr>
  </thead>
  <tbody id="table-body"></tbody>
</table>

<script src="https://cdn.datatables.net/v/se/dt-1.13.6/datatables.min.js"></script>
<link rel="stylesheet" href="https://cdn.datatables.net/v/se/dt-1.13.6/datatables.min.css">

<script type="module">
import { getAll } from './js/db.js';

async function initTable() {
  const students = await getAll('students');
  
  const tbody = document.getElementById('table-body');
  tbody.innerHTML = students.map(s => `
    <tr>
      <td>${s.firstName}</td>
      <td>${s.lastName}</td>
      <td>${s.studentId}</td>
      <td>${s.grade}</td>
    </tr>
  `).join('');
  
  // Initialize DataTable
  $('#students-table').DataTable({
    order: [[0, 'asc']]
  });
}

initTable();
</script>
```

### Modal Dialogs

```javascript
import { showModal } from './js/utils.js';

// Show confirmation modal
showModal(
  'Delete Student',
  'Are you sure you want to delete this student?',
  () => {
    // Callback if user confirms
    deleteStudent();
  }
);
```

### School Year & Semester

```javascript
import { getCurrentSchoolYear, getCurrentSemester } from './js/utils.js';

const year = getCurrentSchoolYear(); // "2025-2026"
const semester = getCurrentSemester(); // "Fall" or "Spring"
```

## HTML Form Example

```html
<div class="w3-card w3-padding">
  <h3>Add Student</h3>
  
  <div class="form-group">
    <label for="firstName">First Name *</label>
    <input type="text" id="firstName" class="w3-input" required>
  </div>
  
  <div class="form-group">
    <label for="lastName">Last Name *</label>
    <input type="text" id="lastName" class="w3-input" required>
  </div>
  
  <div class="form-group">
    <label for="grade">Grade</label>
    <select id="grade" class="w3-input">
      <option value="">Select Grade</option>
      <option value="9">9</option>
      <option value="10">10</option>
      <option value="11">11</option>
      <option value="12">12</option>
    </select>
  </div>
  
  <div class="form-group">
    <label for="status">Status</label>
    <select id="status" class="w3-input">
      <option value="active">Active</option>
      <option value="inactive">Inactive</option>
      <option value="withdrawn">Withdrawn</option>
    </select>
  </div>
  
  <button class="w3-button w3-blue w3-margin-top" onclick="handleAddStudent()">
    <i class="fas fa-plus"></i> Add Student
  </button>
</div>

<script type="module">
import { addDoc } from './js/db.js';
import { showToast } from './js/utils.js';

window.handleAddStudent = async function() {
  const firstName = document.getElementById('firstName').value.trim();
  const lastName = document.getElementById('lastName').value.trim();
  const grade = document.getElementById('grade').value;
  const status = document.getElementById('status').value || 'active';
  
  if (!firstName || !lastName) {
    showToast('Please fill in required fields', 'error');
    return;
  }
  
  try {
    const studentId = `STU${Date.now()}`;
    await addDoc('students', {
      firstName,
      lastName,
      studentId,
      grade,
      status,
      createdAt: new Date()
    });
    
    showToast('Student added successfully', 'success');
    
    // Clear form
    document.getElementById('firstName').value = '';
    document.getElementById('lastName').value = '';
    document.getElementById('grade').value = '';
  } catch (error) {
    console.error('Error adding student:', error);
    showToast('Error adding student', 'error');
  }
};
</script>
```

## Attendance Table Example

```html
<table class="w3-table-all w3-hoverable">
  <thead>
    <tr class="w3-light-gray">
      <th>Date</th>
      <th>Student</th>
      <th>Status</th>
      <th>Notes</th>
    </tr>
  </thead>
  <tbody id="attendance-body"></tbody>
</table>

<script type="module">
import { getAll } from './js/db.js';
import { formatDate, ATTENDANCE_CODES } from './js/utils.js';

async function loadAttendance() {
  const records = await getAll('daily_attendance');
  
  const tbody = document.getElementById('attendance-body');
  tbody.innerHTML = records.map(record => {
    const code = ATTENDANCE_CODES[record.code];
    return `
      <tr>
        <td>${formatDate(record.date)}</td>
        <td>${record.studentId}</td>
        <td>
          <span class="badge" style="background-color: ${code.color}; color: white;">
            ${code.label}
          </span>
        </td>
        <td>${record.notes || '-'}</td>
      </tr>
    `;
  }).join('');
}

loadAttendance();
</script>
```

## Available Attendance Codes

```javascript
import { ATTENDANCE_CODES } from './js/utils.js';

// Access code info
ATTENDANCE_CODES.P // { label: 'Present', color: '#4CAF50', icon: 'fa-check' }
ATTENDANCE_CODES.T // { label: 'Tardy', color: '#FFC107', icon: 'fa-clock' }
ATTENDANCE_CODES.E // { label: 'Excused', color: '#2196F3', icon: 'fa-file-alt' }
ATTENDANCE_CODES.U // { label: 'Unexcused', color: '#F44336', icon: 'fa-times' }
ATTENDANCE_CODES.Q // { label: 'Quarantine', color: '#9C27B0', icon: 'fa-shield-alt' }
ATTENDANCE_CODES.W // { label: 'Withdrawn', color: '#757575', icon: 'fa-arrow-right' }
ATTENDANCE_CODES.H // { label: 'Homebound', color: '#FF9800', icon: 'fa-home' }
ATTENDANCE_CODES.L // { label: 'Late Start', color: '#FFEB3B', icon: 'fa-arrow-down' }

// Iterate over all codes
Object.entries(ATTENDANCE_CODES).forEach(([code, info]) => {
  console.log(`${code}: ${info.label}`);
});
```

## W3.CSS Classes Reference

```html
<!-- Colors -->
<div class="w3-blue">Blue</div>
<div class="w3-green">Green</div>
<div class="w3-red">Red</div>
<div class="w3-yellow">Yellow</div>
<div class="w3-gray">Gray</div>

<!-- Text -->
<p class="w3-large">Large text</p>
<p class="w3-xlarge">Extra large text</p>
<p class="w3-small">Small text</p>

<!-- Spacing -->
<div class="w3-margin">Margin all sides</div>
<div class="w3-padding">Padding all sides</div>
<div class="w3-margin-top">Top margin</div>

<!-- Layout -->
<div class="w3-container">Container</div>
<div class="w3-row">Row</div>
<div class="w3-col m6">Half width on medium</div>

<!-- Cards -->
<div class="w3-card w3-padding">Card with padding</div>
<div class="w3-card-4">Card with shadow</div>

<!-- Buttons -->
<button class="w3-button w3-blue">Blue Button</button>
<button class="w3-button w3-blue w3-round">Rounded Button</button>
<button class="w3-button w3-blue w3-small">Small Button</button>
```

## Testing Checklist

Before deploying a new page:
- [ ] Authentication check works
- [ ] Navigation bar displays and highlights correctly
- [ ] Data loads from Firestore
- [ ] All forms validate input
- [ ] Create/update/delete operations work
- [ ] Error messages display properly
- [ ] Page is responsive on mobile
- [ ] Console has no errors
- [ ] Forms clear after submission
- [ ] Toast notifications appear

## Performance Tips

1. **Lazy load data** - Don't fetch everything at once
2. **Debounce search** - Use `debounce()` for real-time filters
3. **Use batch operations** - For multiple writes
4. **Cache results** - Store frequently accessed data in variables
5. **Limit table rows** - Use DataTables pagination for large datasets
6. **Compress images** - Use modern formats like WebP

## Common Patterns

### Search/Filter
```javascript
const query = document.getElementById('search').value.toLowerCase();
const filtered = students.filter(s => 
  s.firstName.toLowerCase().includes(query) ||
  s.lastName.toLowerCase().includes(query)
);
```

### Sorting
```javascript
const sorted = students.sort((a, b) => 
  a.lastName.localeCompare(b.lastName)
);
```

### Filtering with Multiple Criteria
```javascript
const results = await getWhereMultiple('daily_attendance', [
  ['date', '==', selectedDate],
  ['studentId', '==', studentId]
]);
```

## Debugging Tips

```javascript
// Log to console
console.log('Value:', value);
console.table(arrayOfObjects); // Table format
console.error('Error:', error);

// Check current user
import { getCurrentUser } from './js/auth.js';
console.log(getCurrentUser());

// Test database connection
import { getAll } from './js/db.js';
const test = await getAll('students');
console.log('Connected:', test.length);
```

---

Happy coding! Questions? Check README.md or SETUP.md for more information.
