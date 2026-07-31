import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
dotenv.config({ path: ".env.local", override: true });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  { auth: { persistSession: false } },
);

const tables = [
  "departments",
  "locations",
  "users",
  "roster_periods",
  "shifts",
  "attendance_sessions",
  "shift_swap_requests",
  "payroll_periods",
  "terminals",
];
for (const t of tables) {
  const { count, error } = await sb
    .from(t)
    .select("*", { count: "exact", head: true });
  console.log(t.padEnd(22), "rows=", count ?? 0, error ? `err=${error.message}` : "");
}

const { data: today } = await sb
  .from("v_today_active_shifts")
  .select("shift_id,full_name,department_name,station_label,start_time,end_time")
  .limit(5);
console.log("today shifts (top 5):\n", today);

const { data: live } = await sb
  .from("v_live_floor")
  .select("full_name,job_title,seconds_on_shift,department_name")
  .limit(6);
console.log("live floor (top 6):\n", live);
