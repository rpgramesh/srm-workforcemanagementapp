import "dotenv/config";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local", override: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

console.log("🔗 Testing connection to:", url);

const { data, error, count } = await db
  .from("users")
  .select("id,first_name,last_name,mobile,role,employee_id,is_active", { count: "exact" })
  .order("created_at", { ascending: true });

if (error) {
  console.error("❌ Query failed:", error.message, "\nHint: did you run migration 001_users_roles_pin_auth.sql in the Supabase SQL Editor yet?");
  process.exit(1);
}

console.log(`✅ Connected. public.users rows = ${count}`);
console.table(data, ["first_name", "last_name", "mobile", "role", "employee_id", "is_active"]);

const { data: pinCheck, error: pinError } = await db.rpc("verify_user_pin", {
  user_mobile: "+61425071500",
  pin_input: "5087",
});

if (pinError) {
  console.error("⚠️  verify_user_pin RPC failed:", pinError.message);
} else {
  console.log("🔐 verify_user_pin (Ganga 5087) =>", pinCheck?.[0] ?? pinCheck);
}

const { data: clockCheck, error: clockError } = await db.rpc("verify_clock_in_pin", {
  pin_input: "4041",
});

if (clockError) {
  console.error("⚠️  verify_clock_in_pin RPC failed:", clockError.message);
} else {
  console.log("⏰ verify_clock_in_pin (Anmol 4041) =>", clockCheck?.[0] ?? clockCheck);
}

const { data: clockCheck2 } = await db.rpc("verify_clock_in_pin", { pin_input: "0000" });
console.log("⏰ verify_clock_in_pin (wrong 0000) =>", clockCheck2?.[0] ?? clockCheck2);
