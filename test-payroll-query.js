import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function run() {
  const { data, error } = await supabase
      .from("attendance_sessions")
      .select(`
        *,
        user_full:users!attendance_sessions_user_id_fkey(first_name,last_name,job_title,color,hourly_rate,employee_id),
        dept:shifts!attendance_sessions_shift_id_fkey(departments(name))
      `)
      .order('clocked_in_at', { ascending: false })
      .limit(5)
  
  if (error) console.error(error)
  else console.log(data.length, "records returned")
}
run()
