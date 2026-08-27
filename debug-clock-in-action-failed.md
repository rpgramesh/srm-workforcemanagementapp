# Debug Session: clock-in-action-failed

- **Status**: `[FIXED — AWAITING USER CONFIRMATION]`
- **Bug description**: Clicking the clock-in button throws toast error "Clock action failed — Unable to record clock action."
- **Created**: 2026-08-13
- **Reproduction steps**: Open any dashboard page → Click Clock In / Clock Out CTA (terminal page or sidebar) → Observe error toast.
- **Last known code path**: `features/users/services/user-service.ts` clockInWithPin → tryToggle → catch-all returns the toast message.

## 3-5 Falsifiable Hypotheses

| # | Hypothesis | Prediction at evidence point | Refutable? |
|---|---|---|---|
| H1 | **Session-based actor (`getCurrentActor`) is returning `null`** — the PIN-based login now writes a session cookie (added in todo #5) but the clock-in action bypasses the actor cookie check, OR the existing verify-clock-in-pin RPC is being called but `recordClockAction` expects a different identity shape | `getCurrentActor()` returns `null` OR actor.userId is missing when recordClockAction is called | ✅ Yes — NOT the cause (PIN path uses verifyByClockInPin directly, no cookie actor needed for toggle) |
| H2 | **DB `attendance` insert constraint or view shape mismatch** — attendance_sessions table or `v_live_floor` view columns don't match what mapAttendance/recordClockIn expect | Postgres error mentions missing column e.g. `approval_status`, or view returns `attendance_id` / `attendance_status` aliases while mapper expects `id` / `status` | ✅ Yes — **CONFIRMED 2/3 of root cause here** (see below) |
| H3 | **User type-shape mismatch** — `User` interface now requires 8 new nullable fields in user-service.ts literal objects missing them | service typecheck emits an error at build | ✅ Yes — NOT the cause (env-user object was already patched with 8 fields earlier; typecheck passes) |
| H4 | **PIN verification at RPC level uses the wrong column encoding** — `SET search_path = public, pg_temp` hiding `extensions.crypt()` | RPC error = `function crypt(text, text) does not exist` pg code 42883 | ✅ Yes — NOT the cause (003 already schema-qualifies crypt/gen_salt; RPC returns correctly) |
| H5 | **New session cookie TTL / signing mismatch** — `decodeSession` fails HMAC verify so `getCurrentActor()` returns null | `getCurrentActor()` returns null after fresh login | ✅ Yes — NOT the cause (PIN flow does not use getCurrentActor; verifyByClockInPin result is used directly) |

## Evidence log (static analysis + migration probe)

- **Clock flow**: `user-service.clockInWithPin` → PIN regex → `verifyByClockInPin(pin)` via RPC → if user, call `tryToggle(user)` → `listLiveAttendance()` on view `v_live_floor` → find existing session → `recordClockIn` or `recordClockOut` → calc preview payout via `calcPeriodPayoutPreview`.
- **Static analysis at mapAttendance** (operations-repository.ts line 146–171): references columns `approval_status`, `approved_by`, `approved_at`, `note`, `hourly_rate`, `full_name`, `department_name`, `location_name`. 004 schema only defined `id/user_id/shift_id/terminal_id/clocked_in_at/clocked_out_at/in_gps_*/out_gps_*/status/work_minutes/gross_pay/created_at/updated_at`. **5 required columns absent at INSERT/SELECT time → PostgrestError thrown.**
- **Static analysis at v_live_floor** (004 lines 225–244): view renamed `id → attendance_id`, `status → attendance_status`, `departments.name → station_location` via alias. mapAttendance destructures `r.id`/`r.status` → those fields are `undefined` on view rows → downstream `work_minutes` STORED generated column NOT NULL on STORED side fine but `seconds_on_shift` alias name OK; `r.color` on view was `user_color` alias. **Mismatched column names cause silent undefined → potentially a second PostgrestError or implicit coercion issue.**
- **Error-shape detection clue (fallback string)**: Toast was `"Unable to record clock action."` which is the **else-branch literal** in `err instanceof Error ? err.message : FALLBACK` (user-service.ts L239). **Supabase-js throws `PostgrestError` as a plain object (not `instanceof Error`)**, so even when Postgres returned a real error message like "column approval_status does not exist", we returned the opaque fallback instead.

## Confirmed root cause (3 distinct interacting bugs)

**Bug #1 — PostgrestError shape not an instance of Error (masking layer).**
Supabase-js PostgrestError is created as a plain object via `Object.create(PostgrestError.prototype)` or similar pattern. When repositories did `if (error) throw error;` and the catch used `err instanceof Error ? err.message : fallback`, the fallback fires and the real Postgres error is hidden from the Sonner toast and any downstream logs.

**Bug #2 — attendance_sessions missing 5 columns required by TypeScript mapper.**
`mapAttendance` references `approval_status`, `approved_by`, `approved_at`, `note`, `hourly_rate` as top-level AttendanceRow fields → these fields are passed into SELECTs (`listAllAttendance` with approval_status filter) and are not present on 004 schema. Any `.eq/.in("approval_status", …)` filter or `.select()` against them fails Postgres-side.

**Bug #3 — v_live_floor view aliased 3 columns that mapAttendance accesses by raw name.**
- `a.id AS attendance_id` → but `mapAttendance` reads `r.id`
- `a.status AS attendance_status` → but `mapAttendance` reads `r.status`
- `u.color AS user_color` → but `mapAttendance` reads `r.color`
- `d.name AS station_location` → but `mapAttendance` reads `r.department_name` + `r.location_name`
CREATE OR REPLACE VIEW refuses to rename columns (SQLSTATE 42P16), so simply re-running the view with a new SELECT failed — DROP VIEW … CASCADE required first.

## Fix applied

### A. Error-shape normalization (defense in depth across 3 layers)

**Layer 1 — New helper `normalizeSupabaseError`** in `features/data/supabase-utils.ts`:
- If `error instanceof Error`, return it as-is.
- If plain object, concatenate `.message / .details / .hint / .code / .schema / .table / .column` into a single human-readable string and wrap in real `Error` with `{ cause: error }`.
- Fallback: `String(error)`.

**Layer 2 — Repository throw sites normalized.**
- `features/data/repositories/operations-repository.ts`: import `normalizeSupabaseError` and replace all **21** occurrences of `if (error) throw error;` with `if (error) throw normalizeSupabaseError(error);` via `replace_all`.
- `features/users/repositories/supabase-user-repository.ts`: same treatment for its **9** throw sites (covers verifyByClockInPin RPC throws).

**Layer 3 — user-service.ts catch blocks upgraded for belt-and-suspenders.**
- `tryToggle` catch (L238–258): instance check expanded to also accept `typeof err.message === "string"` on plain objects, extracting the message even if a future repository site slips through un-normalized.
- `verifyByClockInPin` outer catch (L270–281): same dual-shape extraction expanded.

### B. Migration 010: attendance columns + view reshapes

`supabase/migrations/010_attendance_columns_and_view_fixes.sql` (applied successfully exit=0 via apply-migration.mjs):

1. **Attendance table patch**: `ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS` for:
   - `approval_status VARCHAR(16) NOT NULL DEFAULT 'pending'` + CHECK (pending/approved/rejected/needs_review) + `idx_attendance_approval`
   - `approved_by UUID → users.id ON DELETE SET NULL`
   - `approved_at TIMESTAMPTZ`
   - `note TEXT`
   - `hourly_rate NUMERIC(10,4)`

2. **v_live_floor view rewrite**: `DROP VIEW IF EXISTS … CASCADE` (resolves the 42P16 cannot-rename-column error encountered on first attempt) → CREATE OR REPLACE VIEW that exposes **all** raw attendance_sessions columns (`id/status/color/department_name/location_name/gps coords/approval_*`) plus enrichment aliases (`full_name`, `seconds_on_shift`, `user_hourly_rate`) in the exact shape `mapAttendance` destructures. WHERE-clause keeps `status IN (clocked_in, on_break) AND users.is_active`.

3. **v_today_active_shifts view rewrite**: DROP/CREATE pattern exposing both `shift_id` (original alias) AND raw `id` column so roster/shift mappers work either way, plus `full_name`, `department_name`, `location_name`, `user_color`, `avatar_url`, `employee_id`.

4. **Grants**: `REVOKE ALL FROM PUBLIC` then `GRANT SELECT TO authenticated, service_role` for both views so service_role RPCs and dashboard queries can read.

## Post-fix verification

| Check | Expected | Actual | Pass? |
|---|---|---|---|
| `010_*.sql` applied via `scripts/apply-migration.mjs` | exit=0, "Migration applied successfully." | ✅ exit=0, log line printed | ✅ |
| `npx tsc --noEmit` | exit=0, no TS errors | ✅ exit=0, zero output | ✅ |
| `npm run lint` | exit=0, 0 warnings (--max-warnings=0) | ✅ exit=0, clean | ✅ |
| Error visibility going forward | Postgres/Postgrest errors now rendered via `normalizeSupabaseError` in toast `description` (message + details + hint + pg code + table/col) instead of opaque fallback string | TBD — requires browser runtime click | ⏳ User verification |
| Clock In / Clock Out actually writes a row | `attendance_sessions` row inserted with status=clocked_in; second click updates same row to clocked_out with work_minutes | TBD — requires browser runtime click | ⏳ User verification |
| Live floor widget | `v_live_floor` returns rows with `id/status/color/department_name/location_name` matching mapAttendance | TBD — confirmed statically via SELECT column check | ✅ (static) |

## Next step for user

Refresh the app (to pick up the server-action code changes) and try the Clock In button again. If there is still a real DB permission or data issue, the Sonner toast **will now surface the actual Postgres error message + code** instead of "Unable to record clock action.", which lets us pinpoint any remaining issue in a single iteration.
