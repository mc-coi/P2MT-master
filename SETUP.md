# P2MT Setup Guide

Follow these steps to set up the P2MT school management system.

## Step 1: Firebase Project Setup

### 1.1 Create a Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project"
3. Enter project name: `p2mt-school`
4. Accept the terms and create the project
5. Wait for the project to be created

### 1.2 Enable Firestore Database
1. In the Firebase Console, click "Firestore Database" (or "Cloud Firestore")
2. Click "Create Database"
3. Choose location (e.g., United States)
4. Start in "Production mode"
5. Create database

### 1.3 Enable Authentication
1. Click "Authentication" in the left menu
2. Click "Get Started"
3. Select "Google" as a sign-in provider
4. Enter your app name and support email
5. Enable the provider

### 1.4 Get Firebase Config
1. Click the Settings icon (gear) → Project settings
2. Scroll to "Your apps" section
3. Look for the web app, or create one with </> icon
4. Copy the configuration object

Your config should look like:
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyDxxx...",
  authDomain: "p2mt-school.firebaseapp.com",
  projectId: "p2mt-school",
  storageBucket: "p2mt-school.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};
```

### 1.5 Update firebase-config.js
1. Open `firebase-config.js` in your text editor
2. Replace the placeholder values with your actual Firebase config
3. Save the file

## Step 2: Setup Firestore Collections

### 2.1 Create Collections and Add Sample Data

Follow these steps in the Firebase Console:

#### Staff Collection
1. In Firestore, click "Start collection"
2. Collection ID: `staff`
3. Create the first document with:
   - Document ID: (auto ID or your user UID)
   - Add fields:
     - `email`: string (your email)
     - `name`: string (your name)
     - `role`: string (set to "admin")
     - `createdAt`: timestamp (now)

#### Students Collection
1. Create collection: `students`
2. Create first document with fields:
   - `firstName`: string
   - `lastName`: string
   - `studentId`: string (unique ID like "STU001")
   - `grade`: string (e.g., "9" or "10A")
   - `email`: string (optional)
   - `phone`: string (optional)
   - `status`: string ("active", "inactive", or "withdrawn")
   - `createdAt`: timestamp (now)

#### Daily Attendance Collection
1. Create collection: `daily_attendance`
2. Document structure:
   - `date`: string (YYYY-MM-DD format)
   - `studentId`: string (reference to student)
   - `code`: string (P, T, E, U, or Q)
   - `notes`: string (optional)
   - `recordedBy`: string (staff UID)
   - `recordedAt`: timestamp

#### Additional Collections
Create these empty collections (you'll populate them as needed):
- `class_attendance`
- `tmi_reviews`
- `tmi_approvals`
- `master_schedule`
- `learning_lab`
- `school_calendar`
- `pbl_planner`

### 2.2 Set Firestore Security Rules

1. In Firebase Console, go to Firestore Database
2. Click "Rules" tab
3. Replace the default rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Check if user is authenticated
    function isAuthenticated() {
      return request.auth != null;
    }

    // Check if user is staff
    function isStaff() {
      return isAuthenticated() && 
             exists(/databases/{database}/documents/staff/{request.auth.uid});
    }

    // Check if user is admin
    function isAdmin() {
      return isStaff() && 
             get(/databases/{database}/documents/staff/{request.auth.uid}).data.role == 'admin';
    }

    // Staff collection - admins can do everything
    match /staff/{document=**} {
      allow read: if isAdmin();
      allow create, update, delete: if isAdmin();
    }

    // Students collection - staff can read, write depends on role
    match /students/{document=**} {
      allow read: if isStaff();
      allow create, update, delete: if isAdmin();
    }

    // Attendance - staff can read/write
    match /daily_attendance/{document=**} {
      allow read: if isStaff();
      allow create, update: if isStaff();
      allow delete: if isAdmin();
    }

    match /class_attendance/{document=**} {
      allow read: if isStaff();
      allow create, update: if isStaff();
      allow delete: if isAdmin();
    }

    // Interventions
    match /interventions/{document=**} {
      allow read: if isStaff();
      allow create, update: if isStaff();
      allow delete: if isAdmin();
    }

    // TMI (need review/approval flow)
    match /tmi_reviews/{document=**} {
      allow read: if isStaff();
      allow create, update: if isStaff();
      allow delete: if isAdmin();
    }

    match /tmi_approvals/{document=**} {
      allow read: if isStaff();
      allow create, update: if isAdmin();
      allow delete: if isAdmin();
    }

    // Master Schedule
    match /master_schedule/{document=**} {
      allow read: if isStaff();
      allow create, update, delete: if isAdmin();
    }

    // Learning Lab
    match /learning_lab/{document=**} {
      allow read: if isStaff();
      allow create, update: if isStaff();
      allow delete: if isAdmin();
    }

    // School Calendar
    match /school_calendar/{document=**} {
      allow read: if isStaff();
      allow create, update, delete: if isAdmin();
    }

    // PBL Planner
    match /pbl_planner/{document=**} {
      allow read: if isStaff();
      allow create, update: if isStaff();
      allow delete: if isAdmin();
    }

    // Default deny all
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

4. Click "Publish"

## Step 3: GitHub Pages Setup (Optional)

If deploying to GitHub Pages:

1. Create a GitHub repository
2. Push the `static-web-app` folder to the repository
3. Go to repository Settings → Pages
4. Select the branch and folder where the files are
5. GitHub will provide your site URL

## Step 4: Testing

### 4.1 Local Testing
1. Use a local web server (not `file://` URLs due to CORS):
```bash
# Python 3
python -m http.server 8000

# Node.js
npx http-server

# Or use VS Code Live Server extension
```
2. Open `http://localhost:8000`
3. Click "Sign in with Google"
4. Use your school Google account

### 4.2 Verify Authorization
1. After signing in, you should be redirected to students page
2. If you see "Access Denied", your account isn't in the `staff` collection
3. Add your user UID to the staff collection in Firebase

## Step 5: Configure Microsoft Graph (Email Integration)

If you want to enable email sending via Outlook/O365:

### 5.1 Register App in Azure AD
1. Go to [Azure Portal](https://portal.azure.com/)
2. Click "Azure Active Directory" → "App registrations"
3. Click "New registration"
4. Name: "P2MT"
5. Supported account types: Select appropriate option
6. Redirect URI: Web - `https://yourdomain.com/` (your GitHub Pages URL or localhost)
7. Register

### 5.2 Add API Permissions
1. Click "API permissions"
2. Click "Add a permission"
3. Select "Microsoft Graph"
4. Select "Delegated permissions"
5. Search for and add:
   - `Mail.Send`
   - `User.Read`
6. Click "Grant admin consent"

### 5.3 Get Application ID
1. Click "Overview"
2. Copy the "Application (client) ID"
3. Add to your email module configuration

## Step 6: User Management

### 6.1 Add School Staff
1. Go to Firebase Console
2. Open Firestore Database
3. Open `staff` collection
4. Add new document for each staff member with:
   - Document ID: Their Firebase UID (found in Authentication tab)
   - Fields: email, name, role (admin/teacher/staff)

### 6.2 Import Students
You can import student data via CSV:
1. Prepare a CSV with columns: firstName, lastName, studentId, grade, email, phone, status
2. Use the Students page's import function (when built)
3. The app will batch-create records in Firestore

## Troubleshooting

### Issue: "Access Denied - contact your administrator"
- **Solution**: Ensure your user UID is in the `staff` collection

### Issue: Blank page after sign-in
- **Solution**: Check browser console (F12) for errors, verify firebase-config.js

### Issue: Firebase not loading
- **Solution**: Ensure internet connection, check CDN URLs in HTML files

### Issue: CORS errors when testing locally
- **Solution**: Use a local web server, not `file://` URLs

### Issue: Google sign-in not working
- **Solution**: Verify you're using a valid Google account for your Firebase project

## Next Steps

1. Create page templates for:
   - Students management
   - Daily attendance
   - Class attendance
   - Interventions
   - TMI review/approval
   - Master schedule
   - etc.

2. Build data import/export features

3. Set up CI/CD for automated GitHub Pages deployment

4. Customize styling to match school branding

## Support Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firebase Console](https://console.firebase.google.com/)
- [GitHub Pages Documentation](https://pages.github.com/)
- [W3.CSS Documentation](https://www.w3schools.com/w3css/)
- [DataTables Documentation](https://datatables.net/)

## Security Checklist

- [ ] Firebase config updated with real credentials
- [ ] Firestore security rules configured
- [ ] Staff collection populated with authorized users
- [ ] Authentication enabled for Google
- [ ] HTTPS enabled (automatic on GitHub Pages)
- [ ] Backups configured in Firebase
- [ ] Admin users assigned
- [ ] Test accounts created for staff

---

Once setup is complete, you can start building the application pages!
