# P2MT School Management System

A comprehensive web-based school management platform for tracking student interventions, attendance, projects, and academic progress.

## Table of Contents

1. [Overview](#overview)
2. [Technology Stack](#technology-stack)
3. [Firebase Setup](#firebase-setup)
4. [GitHub Pages Deployment](#github-pages-deployment)
5. [First Login & Staff Setup](#first-login--staff-setup)
6. [Microsoft 365 Email Integration](#microsoft-365-email-integration)
7. [Firestore Collections Reference](#firestore-collections-reference)
8. [CSV Import Formats](#csv-import-formats)
9. [Troubleshooting](#troubleshooting)

---

## Overview

P2MT (Phase II Management Tool) is a web application designed to help schools manage:

- **Student Interventions** — Track academic and behavioral interventions at six levels
- **Attendance** — Daily and class-level attendance tracking
- **Projects** — Manage Project-Based Learning (PBL) initiatives with teams and sponsors
- **Academic Calendar** — Maintain school calendar with special days, TMI periods, and ER days
- **Email Notifications** — Send templated emails to students, parents, and staff
- **Class Schedules** — Import and manage student class schedules

Built with modern web technologies: Firebase Firestore for real-time data, Firebase Authentication for secure user login, and vanilla JavaScript for the frontend. Deployed on GitHub Pages as a static site.

---

## Technology Stack

- **Frontend:** HTML5, CSS3 (W3.CSS framework), JavaScript (ES6 modules)
- **Database:** Firebase Firestore (real-time NoSQL)
- **Authentication:** Firebase Authentication (Google Sign-In)
- **Email:** Microsoft Graph API (optional, for Office 365 integration)
- **Hosting:** GitHub Pages (static files only)
- **Libraries:**
  - jQuery 3.7
  - DataTables 1.13.6 (for sortable, filterable tables)
  - Font Awesome 6.4 (icons)
  - PapaParse 5.4.1 (CSV parsing)

---

## Firebase Setup

### Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click **Create a project**
3. Enter project name: `P2MT` (or your preferred name)
4. Uncheck "Enable Google Analytics" (optional)
5. Click **Create project** and wait for setup to complete

### Step 2: Enable Firestore Database

1. In the Firebase Console, go to **Build** → **Firestore Database**
2. Click **Create database**
3. Select **Production mode**
4. Choose a location (US region recommended)
5. Click **Create**

### Step 3: Enable Authentication

1. Go to **Build** → **Authentication**
2. Click **Get started**
3. Under **Sign-in method**, click **Google**
4. Enable it and add a support email (your email)
5. Click **Save**
6. Go to **Settings** (gear icon) → **Authorized domains**
7. Add your GitHub Pages domain: `yourusername.github.io` (you'll add this after creating the GitHub repo)

### Step 4: Get Firebase Configuration

1. Go to **Project Settings** (gear icon → Project settings)
2. Scroll to **Your apps** section
3. Under **Web apps**, if none exist, click the `</>` icon to create one
4. Copy the Firebase config object
5. Paste it into `firebase-config.js`:

```javascript
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id"
};
```

### Step 5: Configure Firestore Security Rules

1. Go to **Firestore Database** → **Rules** tab
2. Replace the default rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow authenticated users who are in the staff collection
    match /{document=**} {
      allow read, write: if request.auth != null && 
        exists(/databases/$(database)/documents/staff/$(request.auth.uid));
    }
    
    // Special rule for staff collection (auth check)
    match /staff/{staffId} {
      allow read: if request.auth != null;
      allow write: if false; // Only modify via Firebase Console initially
    }
  }
}
```

3. Click **Publish**

### Step 6: Create Initial Collections

1. In Firestore, manually create these collections (click **+ Create collection**):
   - `staff` — for authorized users
   - `interventionTypes` — for intervention categories
   - `students` — for student records
   - `schoolCalendar` — for academic calendar
   - `pbls` — for PBL projects
   - `pblEvents` — for PBL events
   - `pblTeams` — for PBL team assignments
   - `classSchedules` — for class timetables
   - `attendance` — for attendance records
   - `p2mtTemplates` — for email templates
   - `interventions` — for student interventions
   - `adminSettings` — for system settings
   - `staff` — for staff profiles
   - `parents` — for parent contacts

Don't add documents yet—they'll be created through the app's admin interface.

---

## GitHub Pages Deployment

### Step 1: Create a GitHub Repository

1. Go to [GitHub](https://github.com) and sign in
2. Click **+ New** (top-left) → **New repository**
3. Repository name: `p2mt` (or preferred name)
4. Description: `School Management System`
5. Set to **Public** (required for GitHub Pages)
6. Do NOT initialize with README, .gitignore, or license
7. Click **Create repository**

### Step 2: Upload Files to Repository

Clone the repository locally and copy the static-web-app files:

```bash
git clone https://github.com/yourusername/p2mt.git
cd p2mt
cp -r /path/to/static-web-app/* .
git add .
git commit -m "Initial P2MT setup"
git push origin main
```

Alternatively, upload files directly in GitHub's web interface.

### Step 3: Enable GitHub Pages

1. Go to your repository → **Settings**
2. Scroll to **Pages** section
3. Under **Build and deployment**:
   - Source: select **Deploy from a branch**
   - Branch: select `main`, folder: `/` (root)
4. Click **Save**
5. Wait 1-2 minutes for the site to deploy
6. Your site will be available at: `https://yourusername.github.io/p2mt`

### Step 4: Add GitHub Pages Domain to Firebase

1. Copy your GitHub Pages URL
2. In Firebase Console → **Build** → **Authentication** → **Settings** → **Authorized domains**
3. Click **Add domain**
4. Paste: `yourusername.github.io` (without `https://`)
5. Click **Add**

---

## First Login & Staff Setup

### Step 1: Access the App

1. Open your GitHub Pages URL: `https://yourusername.github.io/p2mt`
2. Click **Sign in with Google**
3. You'll see "Access Denied" — this is expected (staff collection is empty)

### Step 2: Add Your Email as Staff

1. Open [Firebase Console](https://console.firebase.google.com)
2. Go to **Firestore Database**
3. Click **+ Create collection**
4. Name it `staff` (if not already created)
5. Click **Auto ID** to create a new document
6. Add a field: `email` (text) = your Google email address
7. Click **Save**

### Step 3: Log In

1. Go back to the app and sign out/sign back in (refresh if needed)
2. You should now have access
3. Go to the **Admin** page
4. Use the admin interface to add more staff, students, and initialize the system

### Step 4: Add More Staff

From the Admin page:
1. Click **Manage Staff**
2. Click **Add Staff**
3. Enter name, email, and role
4. Click **Save**

---

## Microsoft 365 Email Integration (Optional)

P2MT can send emails through Microsoft Office 365 using the Microsoft Graph API. This is optional—the app works fine without it.

### Register an Azure AD Application

1. Go to [Azure Portal](https://portal.azure.com)
2. Click **Azure Active Directory** → **App registrations** → **+ New registration**
3. Name: `P2MT School Management`
4. Supported account types: select **Accounts in this organizational directory only**
5. Click **Register**
6. Note your **Application (client) ID** and **Directory (tenant) ID**

### Configure Permissions

1. In your app registration, go to **API permissions**
2. Click **+ Add a permission**
3. Select **Microsoft Graph** → **Delegated permissions**
4. Search for and add: `Mail.Send`
5. Click **Add permissions**
6. Click **Grant admin consent for [Organization]** (if you have permissions)

### Update Application Code

In `js/email.js` (if creating email functionality):

```javascript
const graphConfig = {
  graphMeEndpoint: "https://graph.microsoft.com/v1.0/me",
  graphMailEndpoint: "https://graph.microsoft.com/v1.0/me/sendMail",
  clientId: "YOUR_CLIENT_ID",
  tenantId: "YOUR_TENANT_ID",
  redirectUri: "https://yourusername.github.io/p2mt"
};
```

Note: MSAL.js (Microsoft Authentication Library) should already be referenced in the page headers.

---

## Firestore Collections Reference

All 14 collections used by P2MT:

| Collection | Key Fields | Purpose |
|---|---|---|
| `staff` | email, firstName, lastName, role | Staff member authentication & profiles |
| `students` | chattStateANumber, firstName, lastName, graduationYear, email, phone | Student records |
| `parents` | firstName, lastName, email, phone, studentId | Parent contact info |
| `adminSettings` | settingKey, value | System-wide settings |
| `interventionTypes` | interventionName, description | Intervention category definitions |
| `interventions` | studentId, interventionType, level, startDate, status, notes | Individual student interventions |
| `attendance` | studentId, classDate, present, tardy, reason | Attendance records |
| `classSchedules` | schoolYear, semester, chattStateANumber, className, teacherLastName, classDays, startTime, endTime | Student class schedules |
| `schoolCalendar` | classDate, day, stemSchoolDay, tmiDay, seniorErDay, juniorErDay, dayNumber | Academic calendar events |
| `pbls` | className, schoolYear, quarter, pblName, pblSponsor, pblSponsorPersonName, pblSponsorEmail | Project-Based Learning definitions |
| `pblEvents` | pblId, eventCategory, eventDate, startTime, endTime, eventLocation | PBL event details |
| `pblTeams` | pblId, chattStateANumber, studentName, pblTeamNumber | Student PBL team assignments |
| `p2mtTemplates` | templateTitle, emailSubject, templateContent, intervention_id, interventionLevel, sendToStudent, sendToParent, sendToTeacher | Email templates for interventions |

---

## CSV Import Formats

### Students CSV

```
firstName,lastName,chattStateANumber,email,phone,graduationYear
John,Smith,A12345,john.smith@student.edu,555-1234,2025
Jane,Doe,A12346,jane.doe@student.edu,555-1235,2026
```

### Staff CSV

```
firstName,lastName,email,phone,role
Robert,Johnson,r.johnson@school.edu,555-5001,Counselor
Maria,Garcia,m.garcia@school.edu,555-5002,Teacher
```

### Class Schedule CSV

```
schoolYear,semester,chattStateANumber,studentName,campus,className,teacherLastName,classDays,startTime,endTime,online,indStudy
2025-2026,Fall,A12345,John Smith,Main,Algebra II,Johnson,MWF,08:00,09:00,false,false
2025-2026,Fall,A12345,John Smith,Main,English III,Garcia,TR,09:00,10:00,false,false
```

### School Calendar CSV

```
classDate,day,stemSchoolDay,tmiDay,seniorErDay,juniorErDay,dayNumber
2025-08-18,Monday,true,false,false,false,1
2025-08-19,Tuesday,true,false,false,false,2
```

---

## Troubleshooting

### "Access Denied" on First Login

**Problem:** You see "Access Denied" after signing in with Google.

**Solution:** Your email is not yet in the `staff` collection. See [First Login & Staff Setup](#first-login--staff-setup) → Step 2 to add your email manually to Firestore.

### Blank Page After Login

**Problem:** The app loads but shows no content after authentication.

**Solution:**
1. Check browser console (F12 → Console tab) for errors
2. Verify Firebase config in `firebase-config.js` is correct
3. Check that Firestore is enabled and accessible (try accessing Firebase Console)
4. Clear browser cache and reload

### Firebase "Permission Denied" Error

**Problem:** Actions fail with "PERMISSION_DENIED" in console.

**Solution:**
1. Ensure your email is added to the `staff` collection in Firestore
2. Verify Firestore security rules are correctly published (go to **Firestore** → **Rules** tab and check for syntax errors)
3. Try signing out and back in

### CSV Import Not Working

**Problem:** CSV files don't parse or import.

**Solution:**
1. Ensure CSV columns match the exact format shown above (case-sensitive)
2. Verify the file uses standard CSV format (comma-delimited, UTF-8 encoding)
3. Check browser console for specific parsing errors

### Email Not Sending

**Problem:** Email templates save but notifications don't send.

**Solution:**
1. Microsoft Graph API integration is optional—the app works without it
2. To enable: ensure Azure AD app is registered (see [Microsoft 365 Email Integration](#microsoft-365-email-integration))
3. Check that the user is signed in and has consented to permissions
4. Verify email addresses in `students` and `parents` collections are valid

### Changes Not Showing in Real-Time

**Problem:** You update data in one tab/browser, but it doesn't reflect in another.

**Solution:** Firestore real-time listeners should work automatically. If not:
1. Refresh the page (F5)
2. Check browser console for listener errors
3. Verify Firestore security rules allow reads

### School Calendar Not Loading

**Problem:** The School Calendar page is blank or shows no dates.

**Solution:**
1. Use "Add Date Range" button to create calendar entries
2. Date range should span weekdays only (weekends are skipped)
3. Ensure dates are in YYYY-MM-DD format

### FET Import Not Processing

**Problem:** FET Import Tools page doesn't process data or shows errors.

**Solution:**
1. Ensure all three CSV files are uploaded (Students, Classes, Timetable)
2. Check CSV column order matches FET export format
3. Verify school year is in format like "2025-2026"
4. Check browser console for specific parsing errors
5. Ensure student names in FET data match names in the `students` collection

### GitHub Pages Shows 404

**Problem:** Your GitHub Pages URL shows "404 Not Found".

**Solution:**
1. Verify GitHub Pages is enabled: **Settings** → **Pages** → check source is set to `main` branch
2. Wait 2-3 minutes after enabling; deployment can be slow
3. Check that `index.html` is in the repository root
4. Verify the domain in your browser matches the one shown in GitHub Settings

---

## Support & Feedback

For issues, questions, or feature requests, contact your system administrator or open an issue in the project repository.

---

## License & Credits

P2MT School Management System. All rights reserved.

Built with Firebase, GitHub Pages, and vanilla JavaScript.

Last updated: 2026-03-04
