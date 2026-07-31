import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local", override: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminMobile = process.env.ADMIN_MOBILE;
const adminPin = process.env.ADMIN_PIN;

const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });

const normalizeAU = (input) => {
  const raw = input.replace(/[\s\-()]/g, "").trim();
  if (/^\+614\d{8}$/.test(raw)) return raw;
  if (/^614\d{8}$/.test(raw)) return `+${raw}`;
  if (/^04\d{8}$/.test(raw)) return `+61${raw.slice(1)}`;
  return null;
};

const cases = [
  {
    name: "env_admin match (Ganga + 5087)",
    async fn() {
      const mobile = normalizeAU(adminMobile);
      const pin = adminPin;
      const { data: rows } = await sb.rpc("verify_user_pin", { user_mobile: mobile, pin_input: pin });
      const hit = Array.isArray(rows) ? rows[0] : null;
      return { passed: hit?.matched === true, note: `role=${hit?.role ?? "n/a"} source=env_admin_then_verify_user_pin` };
    },
  },
  {
    name: "DB manager login (Ramesh + 4384)",
    async fn() {
      const { data: rows, error } = await sb.rpc("verify_user_pin", { user_mobile: "+61481904384", pin_input: "4384" });
      if (error) return { passed: false, note: error.message };
      const hit = Array.isArray(rows) ? rows[0] : null;
      return { passed: hit?.matched === true && hit?.role === "manager", note: `role=${hit?.role}` };
    },
  },
  {
    name: "Login rejects supervisor (Siddi 6509) from admin dashboard",
    async fn() {
      const { data: rows, error } = await sb.rpc("verify_user_pin", { user_mobile: "+61450006509", pin_input: "6509" });
      if (error) return { passed: false, note: error.message };
      const hit = Array.isArray(rows) ? rows[0] : null;
      const dashboardAllowed = ["super_admin", "restaurant_admin", "manager"].includes(hit?.role);
      return { passed: hit?.matched === true && !dashboardAllowed, note: `role=${hit?.role} dashboardAllowed=${dashboardAllowed}` };
    },
  },
  {
    name: "Clock-in PIN employee (Anmol 4041)",
    async fn() {
      const { data: rows, error } = await sb.rpc("verify_clock_in_pin", { pin_input: "4041" });
      if (error) return { passed: false, note: error.message };
      const hit = Array.isArray(rows) ? rows[0] : null;
      return { passed: hit?.matched === true && hit?.role === "employee", note: `first_name=${hit?.first_name} role=${hit?.role}` };
    },
  },
  {
    name: "Wrong PIN rejection (0000)",
    async fn() {
      const { data: rows, error } = await sb.rpc("verify_clock_in_pin", { pin_input: "0000" });
      if (error) return { passed: false, note: error.message };
      const hit = Array.isArray(rows) ? rows[0] : null;
      return { passed: hit?.matched === false, note: `matched=${hit?.matched}` };
    },
  },
  {
    name: "Active users count via repo layer (service_role bypass RLS)",
    async fn() {
      const { count, error } = await sb.from("users").select("*", { count: "exact", head: true }).eq("is_active", true);
      if (error) return { passed: false, note: error.message };
      return { passed: Number(count ?? 0) >= 4, note: `count=${count}` };
    },
  },
];

let passCount = 0;
console.log("\n🔬 ShiftMaster Pro Auth E2E\n");
for (const c of cases) {
  const r = await c.fn();
  const tick = r.passed ? "✅" : "❌";
  if (r.passed) passCount += 1;
  console.log(`${tick} ${c.name}  —  ${r.note ?? ""}`);
}
console.log(`\nResult: ${passCount}/${cases.length}`);
process.exit(passCount === cases.length ? 0 : 1);
