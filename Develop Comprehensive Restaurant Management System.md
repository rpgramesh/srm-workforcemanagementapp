# Develop Comprehensive Restaurant Management System

> **Workspace:** /Users/admin/Desktop/SRM-WorkForceManagementApp

---

**User**

Frontend 
 
 * Next.js 15 (App Router) 
 * React 19 
 * TypeScript 
 * Tailwind CSS v4 
 * shadcn/ui 
 * Lucide Icons 
 * React Hook Form 
 Zod Validation 
 TanStack Query 
 Zustand 
 FullCalendar 
 Recharts 
 React Table 
 Framer Motion 
 
 Backend 
 Supabase 
 Use: 
 Authentication 
 PostgreSQL Database 
 Storage 
 Realtime 
 Edge Functions 
 Row Level Security (RLS) 
 
 Notifications 
 Firebase Cloud Messaging (Browser Push) 
 Email Notifications 
 In-App Notification Center 
 
 Deployment 
 Frontend: 
 Vercel 
 Backend: 
 Supabase 
 
 Architecture 
 Use: 
 Clean Architecture 
 Repository Pattern 
 Feature-based Folder Structure 
 TypeScript Strict Mode 
 SOLID Principles 
 Reusable Components 
 Server Components where appropriate 
 Client Components only when necessary 
 
 Folder Structure 
 Generate a professional enterprise folder structure. 
 Example: 
 app/ 
 components/ 
 features/ 
 hooks/ 
 services/ 
 repositories/ 
 types/ 
 lib/ 
 utils/ 
 middleware/ 
 supabase/ 
 public/ 
 styles/ 
 database/ 
 edge-functions/ 
 docs/ 
 
 Authentication 
 Implement: 
 Email Login 
 Password Login 
 Forgot Password 
 Reset Password 
 Email Verification 
 Session Persistence 
 Protected Routes 
 Middleware Authentication 
 Role-Based Access 
 Roles: 
 Super Admin 
 Restaurant Admin 
 Manager 
 Supervisor 
 Employee 
 
 Dashboard 
 Super Admin Dashboard 
 Display: 
 Total Restaurants 
 Total Branches 
 Total Employees 
 Today’s Attendance 
 Active Employees 
 Late Employees 
 Leave Requests 
 Charts 
 Notifications 
 
 Restaurant Admin Dashboard 
 Display: 
 Staff Count 
 Today’s Attendance 
 Roster Status 
 Pending Approvals 
 Departments 
 Branch Overview 
 Announcements 
 
 Employee Dashboard 
 Display: 
 Today’s Shift 
 Clock In 
 Clock Out 
 Current Working Hours 
 Upcoming Shift 
 Attendance Summary 
 Notifications 
 Leave Balance 
 
 Restaurant Module 
 Create CRUD for: 
 Restaurant 
 Branch 
 Department 
 Kitchen 
 Work Area 
 Tables (Optional) 
 Opening Hours 
 Contact Details 
 Logo Upload 
 GPS Coordinates 
 
 Employee Module 
 Employee Profile includes: 
 Employee ID 
 Profile Picture 
 First Name 
 Last Name 
 Email 
 Phone 
 Address 
 Emergency Contact 
 Position 
 Department 
 Restaurant 
 Branch 
 Salary (Admin Only) 
 Joining Date 
 Employment Type 
 TFN 
 Bank Details 
 Visa Expiry 
 Documents 
 Status 
 Allow upload of: 
 Passport 
 Visa 
 Driver Licence 
 Certificates 
 Contracts 
 Store in Supabase Storage. 
 
 Roster Management 
 Weekly Roster 
 Monthly Roster 
 Shift Types: 
 Morning 
 Afternoon 
 Night 
 Split 
 Custom 
 Features: 
 Drag and Drop Calendar 
 Copy Previous Week 
 Bulk Assignment 
 Employee Availability 
 Colour Coding 
 Publish Schedule 
 Shift Swap Request 
 Shift Approval 
 
 Clock In / Clock Out 
 Employees can: 
 Clock In 
 Clock Out 
 Start Break 
 End Break 
 Rules: 
 Clock In only within configurable time. 
 Example: 
 15 minutes before shift 
 30 minutes after shift 
 GPS Verification 
 Browser Location API 
 Restaurant Radius 
 QR Code Attendance 
 Optional Selfie Capture 
 Automatic: 
 Late Calculation 
 Early Leave 
 Overtime 
 Missed Clock Out Detection 
 Manager Approval 
 Attendance Notes 
 
 Attendance Module 
 Attendance Status: 
 Present 
 Absent 
 Late 
 Leave 
 Holiday 
 Weekend 
 Half Day 
 Display: 
 Calendar 
 Timeline 
 Daily View 
 Monthly View 
 Export: 
 PDF 
 Excel 
 CSV 
 
 Leave Management 
 Leave Types: 
 Annual 
 Sick 
 Emergency 
 Compassionate 
 Unpaid 
 Workflow: 
 Employee submits request 
 Manager approves 
 Manager rejects 
 Notification sent automatically 
 Leave Balance calculation 
 Holiday Calendar 
 
 Notification System 
 Browser Push Notifications 
 Email Notifications 
 Realtime Notifications 
 Examples: 
 Upcoming Shift 
 Shift Changed 
 Clock In Reminder 
 Clock Out Reminder 
 Leave Approved 
 Leave Rejected 
 Announcement 
 Birthday 
 Work Anniversary 
 Missed Shift 
 Late Arrival 
 Pending Approval 
 Notification Center: 
 Unread 
 Read 
 Archive 
 Delete 
 
 Announcements 
 Create Restaurant Notices 
 Upload Images 
 Attach PDF 
 Schedule Announcement 
 Pin Announcement 
 Comments (Optional) 
 
 Task Management 
 Assign Tasks 
 Kitchen 
 Cleaning 
 Cash Counter 
 Delivery 
 Inventory 
 Track: 
 Pending 
 In Progress 
 Completed 
 Priority 
 Due Date 
 
 Reports 
 Attendance Report 
 Late Report 
 Overtime Report 
 Leave Report 
 Roster Report 
 Employee Report 
 Working Hours 
 Department Report 
 Export: 
 Excel 
 CSV 
 PDF 
 
 Payroll Ready 
 Calculate: 
 Regular Hours 
 Break Hours 
 Late Minutes 
 Overtime 
 Weekend Hours 
 Public Holiday Hours 
 Generate payroll summary for export. 
 (No payroll calculations required initially.) 
 
 Settings 
 Business Settings 
 Attendance Rules 
 GPS Radius 
 Timezone 
 Public Holidays 
 Notification Settings 
 Email Templates 
 System Preferences 
 
 Audit Logs 
 Track every important action. 
 Store: 
 User 
 Action 
 IP Address 
 Timestamp 
 Module 
 Old Value 
 New Value 
 
 Admin Panel 
 Responsive Dashboard 
 Sidebar Navigation 
 Dark Mode 
 Search 
 Filters 
 Pagination 
 Sorting 
 Breadcrumbs 
 Loading Skeletons 
 Error Pages 
 Empty States 
 
 Database Design 
 Generate normalized PostgreSQL schema. 
 Tables: 
 users 
 profiles 
 restaurants 
 branches 
 departments 
 roles 
 permissions 
 employees 
 employee_documents 
 shifts 
 rosters 
 roster_assignments 
 attendance 
 attendance_breaks 
 leave_types 
 leave_requests 
 notifications 
 announcements 
 tasks 
 settings 
 holiday_calendar 
 audit_logs 
 device_tokens 
 email_templates 
 
 Generate: 
 Primary Keys 
 Foreign Keys 
 Indexes 
 Constraints 
 Views 
 Triggers 
 Functions 
 Seed Data 
 
 Supabase 
 Generate: 
 Migration SQL 
 Storage Buckets 
 Realtime subscriptions 
 Edge Functions 
 Row Level Security policies 
 Authentication setup 
 Type generation 
 
 Security 
 Implement: 
 Row Level Security 
 JWT Authentication 
 Protected API Routes 
 CSRF Protection 
 Rate Limiting 
 Server-side Validation 
 Zod Validation 
 Environment Variables 
 Audit Logging 
 
 UI 
 Use: 
 Modern SaaS Design 
 Material-inspired layout 
 Rounded Cards 
 Responsive Grid 
 Dark Mode 
 Animations 
 Professional Admin Dashboard 
 Loading Skeletons 
 Toast Notifications 
 Confirmation Dialogs 
 
 Performance 
 Use: 
 Server Components 
 Lazy Loading 
 Pagination 
 Virtual Tables 
 Image Optimization 
 Caching 
 Memoization 
 Optimistic Updates 
 
 Testing 
 Generate: 
 Unit Tests 
 Component Tests 
 Integration Tests 
 E2E Test placeholders 
 
 Documentation 
 Generate: 
 README 
 Installation Guide 
 Environment Variables 
 Deployment Guide 
 Architecture Documentation 
 API Documentation 
 Database Diagram 
 
 Development Rules 
 Generate one module at a time. 
 Sequence: 
 Folder Structure 
 UI Theme 
 Authentication 
 Database Schema 
 Supabase Setup 
 Restaurant Module 
 Employee Module 
 Roster Module 
 Attendance Module 
 Clock In / Clock Out 
 Leave Management 
 Notifications 
 Reports 
 Settings 
 Admin Dashboard 
 Testing 
 Documentation 
 Deployment 
 Before moving to the next module: 
 Ensure the current module compiles without errors. 
 Follow TypeScript strict mode. 
 Generate reusable components. 
 Avoid duplicate code. 
 Use clean naming conventions. 
 Include comments for complex logic. 
 Follow enterprise coding standards. 
 Keep commits modular and production-ready. 
 The final project should be suitable for deployment to Vercel with Supabase as the backend and should support future enhancements such as payroll integration, POS integration, inventory management, AI-powered rostering, and multi-tenant restaurant franchises.

**Assistant**

I’m treating this as a greenfield enterprise web app build, so I’m first checking the existing project docs and the skill’s required templates before drafting the formal PRD and technical architecture.

The workspace doesn’t yet have the expected project docs, and the saved project-memory path isn’t present, so I’m checking the repo root and memory folders directly before drafting the two required documents.

I’ve confirmed this repo is essentially empty, so I’m formalizing your requirements into two foundation documents in `.trae/documents/`: a product requirements document and a technical architecture blueprint for the full platform.

I’m writing the docs now with the requested stack, normalized Supabase schema, phased delivery order, and enterprise folder structure so the implementation can proceed module by module without rework.

The foundation documents are complete and lint-clean. I’m notifying you for review now, and I’ll wait for approval before moving into implementation, as required by the project workflow.

The documents were auto-approved in the workflow, so I’m moving into implementation. I’m loading the current web-dev build guidance first, then I’ll scaffold the first delivery phase: the enterprise folder structure and base project foundations in a compile-safe way.

I’m scaffolding a real Next.js 15 app instead of hand-writing boilerplate, then I’ll reshape it into the enterprise folder structure from the architecture document so the repo stays buildable from the first module onward.

The first scaffold attempt only failed because the temp folder name began with a dot, so I’m retrying with a valid directory name and then merging the generated Next.js project into the repo root.

I’ve got a clean Next.js 15 scaffold. Next I’m promoting it to the repo root, then I’ll replace the starter page with a minimal enterprise shell and create the requested feature folders so this first module ends in a usable foundation rather than template leftovers.

I’m pinning the foundation packages next. Because the scaffold reported a known vulnerable Next.js patch, I’m checking the latest available 15.x version before I update `package.json` and install the rest of the requested stack.

I’m shaping the scaffold into the actual enterprise layout now: root-level feature folders, Supabase/database/edge-function directories, and shared base utilities so the next module can layer UI theme and auth without reorganizing the repo again.

I’m replacing the starter branding and generic styles now. The goal for this first module is a professional platform shell with reusable primitives, not just an empty Next app with folders.

The source files are in place. I’m installing the pinned stack now so I can run a full `check`, catch type issues from the new imports, and leave this first module in a working state.

The foundation compiles successfully. I’ve got one non-blocking Next.js workspace-root warning from another lockfile outside this repo, and I’m fixing that in `next.config.ts` so the baseline stays clean for future modules.

The code itself is fine; the lint failure is coming from generated Next.js files in `.next` and `next-env.d.ts`. I’m narrowing the lint scope to source files so the quality gate checks our code, not framework-generated internals.

The first module is functionally done and passing checks. I’m launching the dev server now so I can verify the shell in-browser and leave you with a working preview endpoint for the scaffolded platform.

**Completed**
- Implemented Module 1, the enterprise project foundation, on top of a real Next.js 15 / React 19 app and verified it compiles cleanly.
- Generated and kept the planning docs in [.trae/documents/restaurant-workforce-management-prd.md](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/.trae/documents/restaurant-workforce-management-prd.md) and [.trae/documents/restaurant-workforce-management-technical-architecture.md](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/.trae/documents/restaurant-workforce-management-technical-architecture.md).
- The app is running locally at [http://localhost:3000](http://localhost:3000).

**What Changed**
- Pinned the requested core stack and added project quality scripts in [package.json](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/package.json#L1-L49).
- Replaced the default Next starter metadata and font setup in [layout.tsx](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/app/layout.tsx#L1-L34).
- Replaced the template homepage with a reusable platform shell in [page.tsx](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/app/page.tsx#L1-L5) and [platform-shell.tsx](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/components/layout/platform-shell.tsx#L1-L84).
- Added typed foundation data and reusable roadmap cards in [foundation-overview.tsx](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/features/dashboard/components/foundation-overview.tsx#L1-L82), [module-card.tsx](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/components/shared/module-card.tsx#L1-L56), [app.ts](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/types/app.ts#L1-L23), and [utils.ts](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/lib/utils.ts#L1-L5).
- Established global theme tokens and base styling in [globals.css](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/app/globals.css#L1-L49).
- Fixed Next workspace-root tracing for this repo in [next.config.ts](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/next.config.ts#L1-L7).

**Structure Added**
- Created the requested enterprise directories: `app`, `components`, `features`, `hooks`, `services`, `repositories`, `types`, `lib`, `utils`, `middleware`, `supabase`, `public`, `styles`, `database`, `edge-functions`, `docs`, and `tests`.
- Added feature-scoped module folders for `auth`, `dashboard`, `restaurants`, `employees`, `roster`, `attendance`, `leave`, `notifications`, `announcements`, `tasks`, `reports`, `settings`, and `audit-logs`.

**Verification**
- Ran `npm install`
- Ran `npm run check`
- Result: lint, typecheck, and production build all pass on Next.js `15.5.22`

**Notes**
- `npm install` reports `12 high severity vulnerabilities` from transitive packages; the app still builds successfully, but this should be reviewed before production hardening.
- Current implementation intentionally stops at Module 1 so the sequence stays aligned with your rule of building one module at a time.

**Next Module**
- The next delivery step is Module 2: UI Theme foundation
- That will cover design tokens, dark mode, shadcn/ui setup, shared layout primitives, reusable cards/tables/forms, and the admin dashboard visual system

---

**User**

this web app purpose is to clock in restaurant staff daily based on roaster , admin can create, delete , modify the staff scheedule ; pl design the web site based on this screen 
 1. admin dashboard - screen 1 
 2. staff clock in - screen 2  
 3. staff schedule - screen 3 
 4. staff directory - screen 4

**Assistant**

**Designed + Implemented (Based On Your Screens)**
- Updated the product docs to focus on roster-based daily clock-in + admin schedule management: [restaurant-workforce-management-prd.md](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/.trae/documents/restaurant-workforce-management-prd.md), [restaurant-workforce-management-technical-architecture.md](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/.trae/documents/restaurant-workforce-management-technical-architecture.md)
- Implemented the UI theme (dark navy, glass panels, mint/emerald primary, Lucide icons) and built the 4 screens to match your references.

**Screens + Routes**
- Screen 1 — Admin Dashboard: `/admin/dashboard`  
  - File: [admin/dashboard/page.tsx](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/app/(dashboard)/admin/dashboard/page.tsx)
- Screen 2 — Staff Clock In (PIN Terminal): `/clock-in`  
  - File: [clock-in/page.tsx](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/app/(dashboard)/clock-in/page.tsx)
- Screen 3 — Staff Schedule (Roster Grid): `/admin/schedule`  
  - File: [admin/schedule/page.tsx](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/app/(dashboard)/admin/schedule/page.tsx)
- Screen 4 — Staff Directory: `/admin/staff`  
  - File: [admin/staff/page.tsx](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/app/(dashboard)/admin/staff/page.tsx)

Extras (read-only staff views, aligned with the architecture doc)
- Staff schedule view: `/schedule` ([schedule/page.tsx](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/app/(dashboard)/schedule/page.tsx))
- Staff directory view: `/staff` ([staff/page.tsx](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/app/(dashboard)/staff/page.tsx))

**Navigation Behavior**
- The home route now redirects to the admin dashboard: [app/page.tsx](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/app/page.tsx)

**UI Foundations Added (Reusable)**
- Dashboard chrome (sidebar + top search/user bar): [dashboard-chrome.tsx](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/components/layout/dashboard-chrome.tsx), [sidebar.tsx](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/components/layout/sidebar.tsx), [topbar.tsx](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/components/layout/topbar.tsx)
- Terminal PIN keypad + success toast: [clock-in-terminal.tsx](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/features/attendance/components/clock-in-terminal.tsx)
- Shared UI primitives: [button.tsx](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/components/ui/button.tsx), [card.tsx](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/components/ui/card.tsx), [badge.tsx](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/components/ui/badge.tsx), [table.tsx](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/components/ui/table.tsx)

**Verification**
- `npm run check` passes (lint + typecheck + build)
- Dev server is running on `http://localhost:3001` (port 3000 was already in use)

If you want the screens to be even more pixel-perfect, tell me which parts to match exactly (sidebar width, card radii, typography sizes, spacing, or colors), and I’ll iterate screen-by-screen starting with Screen 1.

---

**User**

please work on login screen; to authenticate only AU mobile phone ;

**Assistant**

I’m updating the auth requirements first, then I’ll implement a dedicated login screen that accepts only Australian mobile numbers and fits the visual direction from your reference.

I’ve confirmed there isn’t a login screen yet, so I’m tightening the auth spec to mobile-first AU login and then I’ll build the actual page with Australian mobile validation, PIN entry, and the same visual language as your mockup.

I’ve got the auth spec approved, and I’m building the actual login experience now: AU mobile formatting/validation, PIN keypad entry, success/error toasts, and the restaurant-style blurred backdrop from your mockup.

The login route and form are in place. I’m running diagnostics now because the new auth form is the first place with real client-side validation and keypad logic, so I want to catch any typing or Tailwind issues before I verify it in the browser.

The code passes project checks, so I’m spinning up a preview and testing the actual login interaction next, including AU mobile validation and the sign-in redirect.

I found one UX issue while testing: the prefilled `+61` value makes overwrite behavior clumsy. I’m cleaning that up so the field behaves like a normal phone input while still enforcing AU-only validation.

The dev preview hit a temporary Next.js cache/build-artifact conflict after running `check` and `dev` close together. I’m restarting the preview cleanly so I can verify the login flow end to end instead of leaving you with a flaky local server.

**Completed**
- Built a dedicated login page at [page.tsx](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/app/(auth)/login/page.tsx#L1-L54) based on your reference: dark restaurant backdrop, centered auth card, top brand bar, keypad PIN entry, and footer links.
- Changed the app entry route to send users to `/login` in [page.tsx](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/app/page.tsx#L1-L5).

**AU Mobile Auth**
- Added Australian mobile validation and normalization in [au-mobile.ts](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/features/auth/services/au-mobile.ts#L1-L55).
- Added Zod validation for `mobile + 4-digit PIN` in [login-schema.ts](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/features/auth/schemas/login-schema.ts#L1-L14).
- Wired the login form with `react-hook-form`, keypad input, error states, success toast, and redirect to the dashboard in [login-form.tsx](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/features/auth/components/login-form.tsx#L1-L200).

**Current Behavior**
- Accepts only Australian mobile formats:
  - `04xx xxx xxx`
  - `+61 4xx xxx xxx`
- Rejects non-AU numbers with inline validation.
- Requires a 4-digit PIN.
- On valid submit, shows success feedback and routes to `/admin/dashboard`.

**Important Note**
- This is currently UI/client-side authentication logic only.
- It enforces AU mobile format, but it does not yet authenticate against Supabase or a real admin phone whitelist.
- If you want, the next step is either:
  - exact admin allowlist, such as one or more specific AU phone numbers, or
  - real Supabase auth with SMS OTP / phone sign-in.

**Verification**
- Ran `npm run check`
- Verified in browser:
  - invalid non-AU number shows validation error
  - valid AU number + PIN signs in and redirects to dashboard
- Preview is running at [http://localhost:3002/login](http://localhost:3002/login)

**Docs Updated**
- Updated auth requirements in [restaurant-workforce-management-prd.md](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/.trae/documents/restaurant-workforce-management-prd.md)
- Updated auth route/API notes in [restaurant-workforce-management-technical-architecture.md](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/.trae/documents/restaurant-workforce-management-technical-architecture.md)

**Recommended Next Step**
- Tell me which auth path you want:
  - `single admin AU number only`
  - `multiple approved AU numbers`
  - `Supabase SMS OTP for AU mobiles`

---

