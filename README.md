# ANAND School Management System

A full-featured ERP-style school management system built with **React + Vite + Tailwind CSS + Firebase**.

---

## 🚀 Features

| Module | Features |
|--------|----------|
| **Authentication** | Firebase Auth, Role-based access (Admin / Employee / Student) |
| **Admin Dashboard** | Stats, Charts, Monthly collection graphs |
| **Student Management** | Add, Edit, Delete, Search, Photo upload |
| **Employee Management** | Add, Edit, Delete, Search, Photo upload |
| **Employee Attendance** | Daily marking (Present / Absent / Half Day / Leave) |
| **Salary Management** | Auto-calculate from attendance, Mark Paid |
| **Fee Management** | Add fees, Late fine auto-calculation (₹250 + ₹25/day) |
| **Online Payment** | Razorpay integration, PDF receipt generation |
| **Payment History** | Full history with receipt download |
| **Student Attendance** | Teachers mark class attendance |
| **Reports** | PDF + Excel export for all modules |
| **Settings** | School info, Late fee config, Password change |
| **Dark/Light Mode** | Full dark mode support |

---

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS
- **Database**: Cloud Firestore
- **Auth**: Firebase Authentication
- **Storage**: Firebase Storage
- **Charts**: Recharts
- **PDF**: jsPDF + jsPDF-AutoTable
- **Excel**: SheetJS (XLSX)
- **Payments**: Razorpay

---

## ⚙️ Setup Instructions

### 1. Install Node.js
Download from: https://nodejs.org (LTS version recommended)

### 2. Install Dependencies
```bash
cd "ANAND School/school-management-system"
npm install
```

### 3. Create Firebase Project
1. Go to https://console.firebase.google.com
2. Create a new project named `anand-school`
3. Enable **Authentication** → Email/Password
4. Enable **Firestore Database** (production mode)
5. Enable **Storage**
6. Go to Project Settings → Web App → Copy config

### 4. Configure Environment
Copy `.env.example` to `.env` and fill in your Firebase credentials:
```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_RAZORPAY_KEY_ID=rzp_test_your_key
```

### 5. Create Users in Firebase

**Admin User:**
- Firebase Console → Authentication → Add User
- Email: `admin@school.com`, Password: (your choice)
- Note the UID
- Firestore → `admins` collection → New doc with ID = `{uid}`
- Fields: `adminName`, `email`, `role: "admin"`

**Employee User:**
- Auth → Add User (e.g., `teacher@school.com`)
- Firestore → `employees` collection → New doc with ID = `{uid}`
- Fields: `employeeId`, `employeeName`, `designation`, `joiningDate`, `monthlySalary`, `status: "active"`, `email`

**Student User:**
- Auth → Add User (e.g., `student@school.com`)
- Firestore → `students` collection → New doc (auto ID)
- Fields: `uid: "{firebase_uid}"`, `studentName`, `className`, etc.

### 6. Configure Firestore Rules
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 7. Configure Storage Rules
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 8. Run the App
```bash
npm run dev
```
Open http://localhost:3000

---

## 💳 Razorpay Setup

1. Create account at https://razorpay.com
2. Go to Settings → API Keys → Generate Test Key
3. Add `VITE_RAZORPAY_KEY_ID` to `.env`
4. For production, implement a backend server to create Razorpay orders

---

## 📁 Project Structure

```
src/
├── components/
│   ├── auth/         # ProtectedRoute
│   └── ui/           # Modal, Pagination, StatCard, etc.
├── context/
│   ├── AuthContext   # Firebase auth state
│   └── ThemeContext  # Dark/Light mode
├── firebase/
│   ├── config.js     # Firebase init
│   ├── auth.js       # Auth functions
│   ├── firestore.js  # All CRUD operations
│   └── storage.js    # File upload
├── layouts/
│   ├── AdminLayout
│   ├── EmployeeLayout
│   └── StudentLayout
├── pages/
│   ├── auth/         # Login
│   ├── admin/        # Dashboard, Students, Employees, etc.
│   ├── employee/     # Dashboard, Attendance, Profile
│   └── student/      # Dashboard, Profile, Attendance, Fees, Payments
└── utils/
    ├── helpers.js    # Date, salary, fee calculations
    ├── pdfExport.js  # PDF generation
    └── excelExport.js # Excel export
```

---

## 🔐 Role Login Rules

| Role | Collection | Access |
|------|-----------|--------|
| Admin | `admins/{uid}` | Full system access |
| Employee | `employees/{uid}` | Own dashboard + Student attendance (Teachers only) |
| Student | `students` where `uid == auth.uid` | Own data only. Blocked if `leaveDate < today` |

---

## 📞 Support

Built for **ANAND School** — 2026
```
