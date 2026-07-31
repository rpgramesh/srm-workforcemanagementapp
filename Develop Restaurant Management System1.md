# ShiftMaster Pro — Development Implementation Report

> **Workspace:** /Users/admin/Desktop/SRM-WorkForceManagementApp
> **Project:** Restaurant Workforce Management App
> **Stack:** Next.js 15 (App Router) · React 19 · Tailwind CSS v4 · shadcn/ui · Supabase
> **Architecture:** Clean Architecture · Repository Pattern · Server-Side Credential Validation

---

## Table of Contents

1. [Hybrid Authentication Model](#1-hybrid-authentication-model)
2. [Environment Configuration (.env.local)](#2-environment-configuration-envlocal)
3. [Supabase Database Schema — SQL Migrations](#3-supabase-database-schema--sql-migrations)
4. [Clean Architecture Layer Map](#4-clean-architecture-layer-map)
5. [Pages Implemented (Async Server Components)](#5-pages-implemented-async-server-components)
6. [Feature Components — DB-Integrated](#6-feature-components--db-integrated)
7. [End-to-End Test Credentials](#7-end-to-end-test-credentials)
8. [Build & Quality Verification](#8-build--quality-verification)
9. [Database Connectivity — IDE Connect Button Workaround](#9-database-connectivity--ide-connect-button-workaround)
10. [Helper Scripts & Utilities](#10-helper-scripts--utilities)

---

## 1. Hybrid Authentication Model

Credentials **never touch the client bundle**. All validation runs exclusively on the server via Next.js Server Actions. Environment variables act as a **fast-path fallback** so core flows work even before the database is fully seeded.

### Flow Priority (both Admin Login & Clock-In)

| Priority | Layer | Scenario |
|---|---|---|
| 1️⃣ | `.env.local` ADMIN fallback | Mobile matches `ADMIN_MOBILE` + PIN matches `ADMIN_PIN` → Super Admin, no DB hit |
| 2️⃣ | `.env.local` USER fallback | Mobile matches `USER_MOBILE` + PIN matches `USER_PIN` → Employee role (blocked from dashboard, allowed for clock-in) |
| 3️⃣ | Supabase `verify_user_pin` RPC | Any active user from the `users` table with matching bcrypt-hashed PIN |
| 4️⃣ | Supabase `verify_clock_in_pin` RPC | PIN-only lookup (no mobile required) for the Clock-In Terminal |

### Role-Based Access Control (RBAC) — 5 Roles

| Role | Can Access Admin Dashboard | Can Use Clock-In Terminal | Env Fallback |
|---|---|---|---|
| `super_admin` | ✅ Yes | ✅ Yes | ADMIN_MOBILE |
| `restaurant_admin` | ✅ Yes | ✅ Yes | DB (Ganga) |
| `manager` | ✅ Yes | ✅ Yes | DB (Ramesh) |
| `supervisor` | ❌ No (directed to Clock-In) | ✅ Yes | DB (Siddi) |
| `employee` | ❌ No (directed to Clock-In) | ✅ Yes | USER_MOBILE / DB (Anmol) |

Dashboard access guard is enforced in `UserService.adminLogin()` via `canAccessAdminDashboard()` from [types/user.ts](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/types/user.ts).

---

## 2. Environment Configuration (.env.local)

All credential and database configuration lives in `.env.local` (gitignored). No credentials are hardcoded in source files.

### Complete .env.local Reference

```dotenv
# ─────────────────────────────────────────────────────────────────────
# ADMIN ACCOUNT  (Super Admin fallback — no DB hit required)
# Mobile must be valid Australian format (+614XXXXXXXX)
# PIN must be exactly 4 digits
# ─────────────────────────────────────────────────────────────────────
ADMIN_MOBILE=+61425 071 500
ADMIN_PIN=5087

# ─────────────────────────────────────────────────────────────────────
# USER ACCOUNT  (Standard Employee fallback — Clock-In Terminal only)
# This account CANNOT log into the Admin Dashboard — it is explicitly
# redirected to use /clock-in with a helpful on-screen message.
# Matches seed row: Anmol (EMP-1004 · Senior Waiter · $28.75/hr)
# ─────────────────────────────────────────────────────────────────────
USER_MOBILE=+61435064041
USER_PIN=4041

# ─────────────────────────────────────────────────────────────────────
# SUPABASE — Project: thcayngogqgavfzsmnyo
# NEXT_PUBLIC_* vars are sent to the browser (anon key = safe to expose)
# SUPABASE_SERVICE_ROLE_KEY is SERVER-ONLY — never reaches the client
# DATABASE_URL = direct Postgres/TCP for migration runner (password URL-encoded)
# ─────────────────────────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://thcayngogqgavfzsmnyo.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoY2F5bmdvZ3FnYXZmenNtbnlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyODY3OTYsImV4cCI6MjEwMDg2Mjc5Nn0.DuoebuaaRxL_X6AO7u7i5Bxo_O-m6ZgETyxZTCbrbOY
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoY2F5bmdvZ3FnYXZmenNtbnlvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTI4Njc5NiwiZXhwIjoyMTAwODYyNzk2fQ.b7618LFgSrfLz6GLKQN7SakeGPtA8NfRV8vtHtfE6as
DATABASE_URL=postgresql://postgres:zaqwSX12%23%24%25%5E%26%2A%28%29_%2B@db.thcayngogqgavfzsmnyo.supabase.co:5432/postgres
```

### Server-Side Config Loader

Defined in [lib/auth-config.ts](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/lib/auth-config.ts):

| Export | Type | Purpose |
|---|---|---|
| `adminCredentials` | `AdminCredentials \| null` | Normalized ADMIN mobile + PIN |
| `userCredentials` | `UserCredentials \| null` | Normalized USER mobile + PIN |
| `isAdminConfigured()` | `boolean` | Guard to check env completeness |
| `isUserConfigured()` | `boolean` | Guard to check env completeness |

Mobile numbers are normalized to canonical `+614XXXXXXXX` format via the shared `normalizeAustralianMobile()` utility in [features/auth/services/au-mobile.ts](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/features/auth/services/au-mobile.ts) — used by both the client validation schema and the server action for single-source-of-truth consistency.

---

## 3. Supabase Database Schema — SQL Migrations

All migrations live in `supabase/migrations/` and are designed to be run in order (001 → 005). The `crypt()` / `gen_salt()` bcrypt functions are schema-qualified to `extensions.crypt()` because the extension lives in the `extensions` schema (Supabase hosted convention) and our SECURITY DEFINER RPCs hardcode `SET search_path = public, pg_temp`.

### Migration Index

| # | File | Purpose |
|---|---|---|
| 001 | [001_users_roles_pin_auth.sql](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/supabase/migrations/001_users_roles_pin_auth.sql) | Core `users` table · `app_role` enum · `verify_user_pin` / `verify_clock_in_pin` SECURITY DEFINER RPCs · RLS policies · 4 seed staff rows |
| 002 | [002_patch_pgcrypto_and_pin_hashes.sql](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/supabase/migrations/002_patch_pgcrypto_and_pin_hashes.sql) | Enables `pgcrypto` extension · Rebuilds both PIN RPCs · Bcrypt-hashes the 4 existing PINs (5087, 4384, 6509, 4041) |
| 003 | [003_schema_qualify_pgcrypto.sql](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/supabase/migrations/003_schema_qualify_pgcrypto.sql) | **CRITICAL FIX** — Moves `pgcrypto` into `extensions` schema · Rewrites all RPCs to use `extensions.crypt()` / `extensions.gen_salt()` · Re-hashes PINs so they verify with the schema-qualified call chain |
| 004 | [004_operational_schema.sql](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/supabase/migrations/004_operational_schema.sql) | Operational tables: `departments`, `locations`, `roster_periods`, `shifts`, `attendance_sessions`, `shift_swap_requests`, `payroll_periods`, `terminals` · Indexes · Triggers · SQL views `v_live_floor`, `v_today_active_shifts` |
| 005 | [005_seed_live_data.sql](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/supabase/migrations/005_seed_live_data.sql) | Production-like seed: 4 departments · 7 locations · 1 roster period · 40 shifts across the current week · 6 live clock-in sessions · 2 shift swap requests · 1 open payroll period · 2 terminals |

### bcrypt PIN Hashing Convention

All PIN hashing uses:
```sql
extensions.crypt('<4-digit-PIN>', extensions.gen_salt('bf', 10))
```

- Cost factor = 10 (balanced for 4-digit PINs on Supabase shared instances)
- SECURITY DEFINER RPCs never return `pin_hash` — only a boolean `matched` column
- `REVOKE ALL ON FUNCTION ... FROM PUBLIC` + `GRANT EXECUTE ... TO service_role` — the anonymous key cannot call these functions directly

### To Run Migrations (IDE Connect Button Independent)

```bash
# Option A — via the project helper (recommended, URL-encodes password automatically)
node scripts/apply-migration.mjs supabase/migrations/001_users_roles_pin_auth.sql
node scripts/apply-migration.mjs supabase/migrations/002_patch_pgcrypto_and_pin_hashes.sql
node scripts/apply-migration.mjs supabase/migrations/003_schema_qualify_pgcrypto.sql
node scripts/apply-migration.mjs supabase/migrations/004_operational_schema.sql
node scripts/apply-migration.mjs supabase/migrations/005_seed_live_data.sql

# Option B — paste SQL directly into Supabase Dashboard → SQL Editor
```

---

## 4. Clean Architecture Layer Map

```
types/                          ← Enterprise-wide types (no imports from other layers)
  app.ts                          AppRole enum, shared branded types
  user.ts                         User, VerifiedUser, ADMIN_DASHBOARD_ROLES guard
  domain.ts                       DashboardMetric, LiveFloorMember, RosterRow, etc.

lib/                            ← Cross-cutting config / infrastructure
  auth-config.ts                  ADMIN + USER env loaders
  supabase.ts                     Anon client + service_role server client
  utils.ts                        Pure utility helpers (cn, currency, etc.)

features/[module]/
  repositories/                   ← Ports (interfaces) + Adapters (Supabase)
    user-repository.ts              Interface: UserRepository (port)
    supabase-user-repository.ts     Adapter over @supabase/supabase-js
    operations-repository.ts        Adapter for shifts/attendance/payroll ops

  services/                       ← Application service layer (orchestration)
    user-service.ts                 Login + Clock-In + user queries
    operations-services.ts          DashboardService · RosterService · StaffService
                                     PayrollService · AttendanceService

  actions/                        ← Next.js Server Actions ("use server")
    login-action.ts                 adminLogin() → delegates to UserService
    clock-in-action.ts              clockInWithPin() → delegates to UserService
    dashboard-actions.ts            12 typed fetcher actions for pages

  schemas/                        ← Client-side validation (Zod)
    login-schema.ts                 AU mobile + 4-digit PIN schema

  components/                     ← Feature-scoped UI components (typed props)

components/layout/                ← Shared layout chrome
  dashboard-chrome.tsx              Standard page wrapper (title, subtitle, spacing)
  sidebar.tsx                       Side nav with role-aware items
  topbar.tsx                        Top header bar
  platform-shell.tsx                Initial scaffolding shell

app/                              ← Routes — Async Server Components by default
```

### Dependency Direction

```
Pages (Server Components)
  → features/*/actions/*.ts  (Server Actions)
    → features/*/services/*.ts   (Application Services)
      → features/*/repositories/*.ts  (Repository Ports + Adapters)
        → lib/supabase.ts  (Infrastructure)
types/ ← imported by all layers (never imports anything else)
```

---

## 5. Pages Implemented (Async Server Components)

All 6 primary pages are **async Server Components** that fetch data in parallel via `Promise.all()` directly in the page body. No Client Component data fetching.

| Route | Page File | Data Fetched |
|---|---|---|
| `/login` | [app/(auth)/login/page.tsx](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/app/(auth)/login/page.tsx) | Static brand shell. Login form calls `adminLogin()` Server Action on submit. |
| `/admin/dashboard` | [app/(dashboard)/admin/dashboard/page.tsx](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/app/(dashboard)/admin/dashboard/page.tsx) | `getDashboardMetricGrid()` · `getLiveFloorStrip()` · `getTodaysRoster()` · `getShiftSwaps()` — all in parallel. |
| `/admin/schedule` | [app/(dashboard)/admin/schedule/page.tsx](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/app/(dashboard)/admin/schedule/page.tsx) | `getRosterSummaryCards()` · `getWeeklyRoster(null, 5)` — dynamic week label from roster.weekStart/weekEnd. |
| `/admin/staff` | [app/(dashboard)/admin/staff/page.tsx](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/app/(dashboard)/admin/staff/page.tsx) | `getPayrollOverview()` · `getShiftDistribution()` · `getStaffDirectory()` — parallel fetch. |
| `/clock-in` | [app/(dashboard)/clock-in/page.tsx](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/app/(dashboard)/clock-in/page.tsx) | Picks first employee/supervisor user as demo user. `getTerminalConfig()` · `getClockStatusCards(userId)` · `getUpcomingWeekPreview(userId)`. |
| `/schedule` | [app/(dashboard)/schedule/page.tsx](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/app/(dashboard)/schedule/page.tsx) | Staff view — picks employee user → `getUpcomingWeekPreview(userId)`. |
| `/staff` | [app/(dashboard)/staff/page.tsx](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/app/(dashboard)/staff/page.tsx) | Staff directory view — `getStaffDirectory()`. |
| `/` | [app/page.tsx](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/app/page.tsx) | Redirects to `/login`. |

---

## 6. Feature Components — DB-Integrated

Each component now accepts **typed props** (no hardcoded data). Props are resolved by the pages above.

### Dashboard Modules

| Component | Props Type | Data Source |
|---|---|---|
| [MetricGrid](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/features/dashboard/components/metric-grid.tsx) | `DashboardMetric[]` | Real-time: live clock-in count, active departments, labor $ vs budget (progress bar) |
| [LiveFloorStrip](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/features/dashboard/components/live-floor-strip.tsx) | `LiveFloorMember[]` | `v_live_floor` view — currently clocked-in staff with on-shift duration |
| [TodaysRosterTable](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/features/dashboard/components/todays-roster-table.tsx) | `TodaysRosterRow[]` | Today's shifts joined with users + live clock-in status (late/on/upcoming logic) |
| [ShiftSwapsPanel](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/features/dashboard/components/shift-swaps-panel.tsx) | `ShiftSwapRequest[]` | `shift_swap_requests` table |

### Roster Modules

| Component | Props Type |
|---|---|
| [RosterSummaryCards](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/features/roster/components/roster-summary-cards.tsx) | `DashboardMetric[]` (totalHours, laborCost, staffClockedIn, openShifts) |
| [WeeklyRosterGrid](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/features/roster/components/weekly-roster-grid.tsx) | `WeeklyRosterData` (weekStart, weekEnd, dayHeaders[], employees[], totalHours, etc.) |
| [WeeklyRosterPreview](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/features/roster/components/weekly-roster-preview.tsx) | `UpcomingShiftPreview[]` |

### Employees / Staff Modules

| Component | Props Type |
|---|---|
| [StaffDirectoryGrid](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/features/employees/components/staff-directory-grid.tsx) | `StaffDirectoryCard[]` — weekly hours, status badge (clocked_in/overtime_risk/on_leave/off_duty), next shift label |
| [PayrollOverview](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/features/employees/components/payroll-overview.tsx) | `PayrollOverviewData` — period, totalGross, totalHours, overtimeCost, currencyCode |
| [ShiftDistributionPanel](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/features/employees/components/shift-distribution-panel.tsx) | `ShiftDistribution` — per-department % bars + deterministic AI warning for Friday coverage gaps |

### Attendance Modules

| Component | Props Type |
|---|---|
| [ClockInTerminal](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/features/attendance/components/clock-in-terminal.tsx) | Calls `clockInWithPin()` Server Action. Success shows authenticated staff badge. |
| [ClockStatusCards](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/features/attendance/components/clock-status-cards.tsx) | `ClockStatusCardsData` — shift status, start time, today earnings, worked hours, delta %, weekly progress vs budget |

### Auth Modules

| Component | Notes |
|---|---|
| [LoginForm](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/features/auth/components/login-form.tsx) | Calls `adminLogin()` Server Action via `useTransition()`. Header: "Admin Sign In · Restaurant & Operations Team · Australian Mobile + PIN". Wrong PIN / wrong mobile / unauthorised role → distinct error messages. |

---

## 7. End-to-End Test Credentials

### Environment-Based Fallback Accounts (No DB Required)

| Flow | Mobile | PIN | Role | Route | Result |
|---|---|---|---|---|---|
| Admin Login | `+61 425 071 500` | `5087` | super_admin | `/login` → `/admin/dashboard` | ✅ Signs in as "Super Admin" |
| Admin Login (USER account attempt) | `+61 435 064 041` | `4041` | employee | `/login` | 🚫 Denied → "This account is a staff (Employee) account. Please use the Clock-In terminal..." |
| Clock-In Terminal | (PIN only) `4041` | `4041` | employee | `/clock-in` | ✅ "Clocked in — Anmol · Senior Waiter" |
| Clock-In Terminal (admin PIN) | (PIN only) `5087` | `5087` | super_admin | `/clock-in` | ✅ "Clocked in — Super Admin" |

### Database-Seeded Accounts (Require Live Supabase)

| Name | Mobile | PIN | Role | Job Title |
|---|---|---|---|---|
| Ganga | `+61 425 071 500` | `5087` | restaurant_admin | Restaurant Director |
| Ramesh | `+61 481 904 384` | `4384` | manager | Floor Manager |
| Siddi | `+61 450 006 509` | `6509` | supervisor | Shift Supervisor |
| Anmol | `+61 435 064 041` | `4041` | employee | Senior Waiter |

> **Note:** After running Migration 003, all 4 PINs are re-hashed with schema-qualified `extensions.gen_salt('bf', 10)` so they verify correctly from both direct `postgres` superuser queries and `service_role` PostgREST RPC calls.

---

## 8. Build & Quality Verification

### Commands Executed & Passed

```bash
npm run typecheck   # tsc --noEmit  →  0 errors
npm run lint        # ESLint        →  0 warnings, 0 errors
npm run build       # Next.js build →  12/12 pages generated successfully
```

### IDE Diagnostics

VS Code language server reports **0 TypeScript / ESLint issues** across all 70+ source files.

### Postgres / Supabase E2E Auth Matrix (6/6 Green)

| # | Scenario | PIN | Expected | Result |
|---|---|---|---|---|
| 1 | Admin Login — Ganga (restaurant_admin, DB) | 5087 | matched: true · restaurant_admin | ✅ |
| 2 | Admin Login — Ramesh (manager, DB) | 4384 | matched: true · manager | ✅ |
| 3 | Admin Login — Siddi (supervisor, DB) dashboard access gate | 6509 | PIN matches, but role denied dashboard | ✅ |
| 4 | Clock-In — Anmol (employee, DB) | 4041 | matched: true · employee | ✅ |
| 5 | Wrong PIN rejection — any flow | 0000 | matched: false, no user data leaked | ✅ |
| 6 | ADMIN env fallback — no DB hit | 5087 (matches .env.local) | Super Admin signed in | ✅ |

---

## 9. Database Connectivity — IDE Connect Button Workaround

The IDE's native **Connect** button does not work for this Supabase instance (likely due to special characters in the password — `# $ % ^ & * ( ) _ +` break the standard URL parser in the UI layer).

**Resolution — direct TCP/Postgres connection via `DATABASE_URL`:**
- Password is **URL-encoded** in `DATABASE_URL` stored in `.env.local`:
  - `zaqwSX12#$%^&*()_+` → `zaqwSX12%23%24%25%5E%26%2A%28%29_%2B`
- Migrations are applied from the terminal using the helper script in [scripts/apply-migration.mjs](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/scripts/apply-migration.mjs).
- The app itself connects to Supabase exclusively through the official `@supabase/supabase-js` SDK using `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (no TCP dependency at runtime).

---

## 10. Helper Scripts & Utilities

| Script | Purpose | How to Run |
|---|---|---|
| [scripts/apply-migration.mjs](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/scripts/apply-migration.mjs) | Apply any `.sql` migration file via direct Postgres/TCP. Auto-picks `DATABASE_URL` from `.env.local`. | `node scripts/apply-migration.mjs supabase/migrations/005_seed_live_data.sql` |
| [scripts/check-supabase.mjs](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/scripts/check-supabase.mjs) | Probes connectivity, lists active users, calls both PIN RPCs as smoke test. | `node scripts/check-supabase.mjs` |
| [scripts/auth-e2e.mjs](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/scripts/auth-e2e.mjs) | Full 6-case authentication harness covering all roles + wrong-PIN + env fallback. | `node scripts/auth-e2e.mjs` |
| [scripts/probe-schema.mjs](file:///Users/admin/Desktop/SRM-WorkForceManagementApp/scripts/probe-schema.mjs) | Lists all tables, views, and functions for schema diagnostics. | `node scripts/probe-schema.mjs` |

---

## Appendix — Files Created / Modified Summary

### Created

| File | Layer |
|---|---|
| `lib/auth-config.ts` | Config loader for ADMIN + USER env credentials |
| `lib/supabase.ts` | Anon + service_role Supabase client factory |
| `features/users/repositories/user-repository.ts` | Repository port (interface) |
| `features/users/repositories/supabase-user-repository.ts` | Repository adapter (Supabase) |
| `features/users/services/user-service.ts` | Application service — Login / Clock-In / user queries |
| `features/auth/actions/login-action.ts` | Server Action — `adminLogin(mobile, pin)` |
| `features/attendance/actions/clock-in-action.ts` | Server Action — `clockInWithPin(pin)` |
| `features/data/actions/dashboard-actions.ts` | 12 Server Actions for dashboard / roster / staff / payroll / attendance |
| `features/data/repositories/operations-repository.ts` | Repository adapter for shifts/attendance/payroll/swaps/terminals |
| `features/data/services/operations-services.ts` | 5 orchestration services: Dashboard, Roster, Staff, Payroll, Attendance |
| `features/data/supabase-utils.ts` | Formatting helpers (currency, minToHuman, compactNumber, initials) |
| `types/user.ts` | User, VerifiedUser, UserPagination, canAccessAdminDashboard() guard |
| `types/domain.ts` | All feature-typed DTOs (30+ interfaces) |
| `supabase/migrations/001_users_roles_pin_auth.sql` | Migration 001 |
| `supabase/migrations/002_patch_pgcrypto_and_pin_hashes.sql` | Migration 002 |
| `supabase/migrations/003_schema_qualify_pgcrypto.sql` | Migration 003 (critical pgcrypto fix) |
| `supabase/migrations/004_operational_schema.sql` | Migration 004 |
| `supabase/migrations/005_seed_live_data.sql` | Migration 005 |
| `scripts/apply-migration.mjs` | Postgres migration runner CLI |
| `scripts/check-supabase.mjs` | Connectivity smoke test |
| `scripts/auth-e2e.mjs` | 6-case auth E2E harness |
| `scripts/probe-schema.mjs` | Schema probe utility |

### Modified

| File | Change |
|---|---|
| `.env.local` | Added `USER_MOBILE=+61435064041` · `USER_PIN=4041` alongside existing ADMIN and Supabase vars |
| `features/auth/components/login-form.tsx` | Wired to `adminLogin()` Server Action inside `useTransition()`. Distinct error messages for each failure tier. |
| `features/attendance/components/clock-in-terminal.tsx` | Wired to `clockInWithPin()` Server Action. Success panel renders the authenticated staff badge. |
| All 14 feature components | Refactored from hardcoded inline data to accept typed props resolved by pages. |
| All 6 primary page files | Converted to async Server Components fetching via Server Actions in parallel. |

---

*End of document.*
Develop a fully functional web page with complete database integration that implements the following core features and meets all technical requirements:

1. **Staff Management Module**:

- Build an "Add Staff" functionality that includes a comprehensive form to capture all necessary staff details (name, employee ID, contact information, department, role, employment date, and permissions)

- Implement form validation to ensure data integrity before database submission

- Add database storage capabilities to persist all staff records securely

- Create staff listing view with editable and deletable options for existing records

2. **Advanced Filtering System**:

- Develop multi-criteria filtering functionality to search and sort staff records by all relevant fields (department, role, employment status, name, employee ID)

- Implement real-time filtering that updates the staff list dynamically as filter criteria are modified

- Integrate filter parameters with database queries to efficiently retrieve filtered results without loading all records client-side

- Add save/load filter preset functionality for frequently used search combinations

3. **Messaging Functionality**:

- Build an internal messaging system that allows users to send communications to individual staff members or entire departments

- Store all message history in the database with read receipts, timestamps, and sender/recipient metadata

- Implement real-time message notifications for new incoming communications

- Create message threading and conversation view for organized communication tracking

4. **General Technical Requirements**:

- Ensure full database integration with proper connection pooling, error handling, and data sanitization to prevent SQL injection

- Implement user authentication and role-based access control to restrict access to staff management and messaging features based on user permissions

- Build a responsive user interface that works seamlessly across desktop and mobile devices

- Write comprehensive unit and integration tests for all database operations, form submissions, filtering logic, and messaging workflows

- Implement proper error handling for all database operations and user actions with user-friendly error messages

- Ensure all data transfers between the client and database are encrypted to maintain sensitive staff and message data security

- Add audit logging to track all modifications to staff records and message activity for compliance purposes

5. **Success Criteria**:

- All staff management operations (create, read, update, delete) function correctly with data properly persisted in the database

- Filtering returns accurate results within 2 seconds even with large volumes of staff records

- Messaging system delivers messages in real-time with 100% message delivery reliability

- All functionality passes security audits and compliance checks for sensitive employee data storage

- Page maintains 99.9% uptime under expected user load with database connections properly managed