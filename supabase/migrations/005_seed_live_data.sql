-- ShiftMaster Pro — Migration 005
-- Seed departments, locations, a roster period, a payroll period, terminals,
-- ~40 shift rows (8 users × 5 days sample), 6 active attendance clock-ins,
-- shift swap requests, + link users.department_id + sample hourly rates.
--
-- Existing users:
--   Ganga  +61425071500  restaurant_admin   PIN 5087
--   Ramesh +61481904384  manager            PIN 4384
--   Siddi  +61450006509  supervisor         PIN 6509
--   Anmol  +61435064041  employee           PIN 4041
--
-- Add 4 extra fictional employees to match the reference images:
--   Marco Rossi  (Kitchen / Chef)          PIN 1234
--   Sarah Chen   (Front of House / Server) PIN 1235
--   Leo Mendez   (Front of House / Bar)    PIN 1236
--   Priya Shah   (Floor / Host)            PIN 1237
-- =====================================================================

-- 1. Departments
INSERT INTO public.departments (code, name, short_label, accent_class, sort_order) VALUES
('FOH', 'Front of House', 'FRONT',  'bg-emerald-300/70', 1),
('KIT', 'Kitchen',       'KITCHEN','bg-sky-300/70',       2),
('BAR', 'Bar',           'BAR',    'bg-amber-300/70',     3),
('MGT', 'Management',    'MGMT',   'bg-rose-300/70',      4)
ON CONFLICT (code) DO NOTHING;

-- 2. Locations / stations
INSERT INTO public.locations (code, name, sort_order) VALUES
('FL1','Floor 1',    1),
('FL2','Floor 2',    2),
('LNG','Lounge',     3),
('BAR','Main Bar',   4),
('OFF','Office',     5),
('KIT','Kitchen Line',6),
('PREP','Prep Area', 7)
ON CONFLICT (code) DO NOTHING;

-- 3. Four additional fictional employees (bcrypt via extensions.crypt)
INSERT INTO public.users
  (first_name, last_name, mobile, role, employee_id, job_title, hourly_rate, department_id, color, is_active, pin_hash)
VALUES
  ('Marco','Rossi', '+61410111222', 'employee',   'EMP-0101','Head Chef',   32.50,
    (SELECT id FROM public.departments WHERE code='KIT'),'#06B6D4',TRUE,
    extensions.crypt('1234', extensions.gen_salt('bf',10))),
  ('Sarah','Chen',  '+61410111223', 'employee',   'EMP-0102','Lead Server', 28.75,
    (SELECT id FROM public.departments WHERE code='FOH'),'#34D399',TRUE,
    extensions.crypt('1235', extensions.gen_salt('bf',10))),
  ('Leo','Mendez',  '+61410111224', 'employee',   'EMP-0103','Bartender',   26.00,
    (SELECT id FROM public.departments WHERE code='BAR'),'#FBBF24',TRUE,
    extensions.crypt('1236', extensions.gen_salt('bf',10))),
  ('Priya','Shah',  '+61410111225', 'employee',   'EMP-0104','Host',        25.00,
    (SELECT id FROM public.departments WHERE code='FOH'),'#F472B6',TRUE,
    extensions.crypt('1237', extensions.gen_salt('bf',10)))
ON CONFLICT (mobile) DO NOTHING;
-- 4. Attach departments to the existing users
UPDATE public.users SET department_id = (SELECT id FROM public.departments WHERE code='MGT'), job_title='Restaurant Owner',  hourly_rate=60.00 WHERE mobile='+61425071500';
UPDATE public.users SET department_id = (SELECT id FROM public.departments WHERE code='MGT'), job_title='Restaurant Manager', hourly_rate=45.00 WHERE mobile='+61481904384';
UPDATE public.users SET department_id = (SELECT id FROM public.departments WHERE code='FOH'), job_title='Floor Supervisor',   hourly_rate=35.00 WHERE mobile='+61450006509';
UPDATE public.users SET department_id = (SELECT id FROM public.departments WHERE code='KIT'), job_title='Line Cook',        hourly_rate=27.00 WHERE mobile='+61435064041';

-- 5. Roster period for *this week* (Mon-Sun ending Sunday)
INSERT INTO public.roster_periods (week_start, week_end, status, budget_amount)
VALUES (
    DATE_TRUNC('week', CURRENT_DATE)::DATE + 0,
    DATE_TRUNC('week', CURRENT_DATE)::DATE + 6,
    'published',
    20000.00
) ON CONFLICT (week_start, week_end) DO NOTHING;

-- 6. Payroll period
INSERT INTO public.payroll_periods (period_start, period_end, status)
VALUES (
    DATE_TRUNC('week', CURRENT_DATE)::DATE,
    DATE_TRUNC('week', CURRENT_DATE)::DATE + 13,
    'open'
) ON CONFLICT (period_start, period_end) DO NOTHING;

-- 7. Terminals
INSERT INTO public.terminals (terminal_code, display_name, location_id, sync_status, last_sync_at)
VALUES
 ('TERM-8821-B','POS Terminal #1',(SELECT id FROM public.locations WHERE code='FL1'),'active',NOW()),
 ('TERM-1090-A','Kitchen KDS',     (SELECT id FROM public.locations WHERE code='KIT'),'active',NOW())
ON CONFLICT (terminal_code) DO NOTHING;

-- =====================================================================
-- 8. Seed shifts for the current roster week Mon-Sun
--    Matrix exactly mirrors the weekly roster grid reference layout
--    adapted to the current live week (2026-07-27 Monday onwards)
-- =====================================================================

INSERT INTO public.shifts
  (roster_period_id, user_id, department_id, location_id,
   shift_date, start_time, end_time, break_minutes, status, station_label, hourly_rate)
SELECT
    rp.id,
    u.id,
    d.id,
    loc.id,
    shift_date_val::DATE,
    seed.start_time::TIME,
    seed.end_time::TIME,
    seed.br,
    'scheduled',
    seed.station,
    seed.hr::NUMERIC
FROM public.roster_periods rp
CROSS JOIN LATERAL (VALUES
-- user_mobile         dept  loc   station             offset_days  start   end     br   hr
('+61410111222','KIT','KIT','Kitchen Line',       0, '08:00','16:00', 30, 32.50),
('+61410111222','KIT','KIT','Kitchen Line',       1, '08:00','16:00', 30, 32.50),
('+61410111222','KIT','KIT','Kitchen Line',       3, '08:00','16:00', 30, 32.50),
('+61410111222','KIT','KIT','Kitchen Line',       4, '08:00','16:00', 30, 32.50),
('+61410111222','KIT','KIT','Saturday Cook',      5, '08:00','14:00', 30, 32.50),

('+61410111223','FOH','FL1','Lead Server',        1, '16:00','00:00', 60, 28.75),
('+61410111223','FOH','FL1','Lead Server',        2, '16:00','00:00', 60, 28.75),
('+61410111223','FOH','LNG','Floor 2 Hostess',    3, '12:00','20:00', 60, 28.75),
('+61410111223','FOH','FL1','Lead Server',        4, '17:00','01:00', 60, 28.75),
('+61410111223','FOH','LNG','Lounge Server',      6, '16:00','22:00', 60, 28.75),

('+61410111224','BAR','BAR','Evening Bartender',  0, '18:00','02:00', 60, 26.00),
('+61410111224','BAR','BAR','Evening Bartender',  1, '18:00','02:00', 60, 26.00),
('+61410111224','BAR','BAR','Friday Night Bar',   4, '19:00','03:00', 60, 26.00),
('+61410111224','BAR','BAR','Saturday Day Bar',   5, '11:00','17:00', 30, 26.00),

('+61410111225','FOH','LNG','Lunch Host',         0, '11:00','19:00', 30, 25.00),
('+61410111225','FOH','LNG','Lunch Host',         1, '11:00','19:00', 30, 25.00),
('+61410111225','FOH','LNG','Lunch Host',         2, '11:00','19:00', 30, 25.00),
('+61410111225','FOH','LNG','Lunch Host',         3, '11:00','19:00', 30, 25.00),
('+61410111225','FOH','LNG','Dinner Host',        4, '16:00','22:00', 30, 25.00),
('+61410111225','FOH','FL1','Floor 1 Host',       5, '16:00','22:00', 30, 25.00),
('+61410111225','FOH','LNG','Brunch Host',        6, '10:00','16:00', 30, 25.00),

('+61435064041','KIT','KIT','Line Cook',          0, '10:00','18:00', 30, 27.00),
('+61435064041','KIT','KIT','Line Cook',          1, '10:00','18:00', 30, 27.00),
('+61435064041','KIT','KIT','Line Cook',          2, '10:00','18:00', 30, 27.00),
('+61435064041','KIT','KIT','Line Cook',          3, '12:00','20:00', 30, 27.00),
('+61435064041','KIT','KIT','Line Cook',          4, '12:00','20:00', 30, 27.00),
('+61435064041','KIT','KIT','Saturday Cook',      5, '10:00','18:00', 30, 27.00),

('+61450006509','FOH','FL1','Floor Supervisor',   0, '12:00','20:00', 45, 35.00),
('+61450006509','FOH','FL1','Floor Supervisor',   1, '12:00','20:00', 45, 35.00),
('+61450006509','FOH','LNG','Lounge Supervisor',  2, '15:00','23:00', 45, 35.00),
('+61450006509','FOH','FL1','Floor Supervisor',   4, '14:00','22:00', 45, 35.00),
('+61450006509','FOH','LNG','Sat Supervisor',     5, '14:00','22:00', 45, 35.00),

('+61481904384','MGT','OFF','Daily Manager',      0, '09:00','17:00', 60, 45.00),
('+61481904384','MGT','OFF','Daily Manager',      1, '09:00','17:00', 60, 45.00),
('+61481904384','MGT','OFF','Daily Manager',      2, '09:00','17:00', 60, 45.00),
('+61481904384','MGT','OFF','Daily Manager',      3, '09:00','17:00', 60, 45.00),
('+61481904384','MGT','OFF','Daily Manager',      4, '09:00','17:00', 60, 45.00),

('+61425071500','MGT','OFF','Owner Oversight',    0, '10:00','15:00', 30, 60.00),
('+61425071500','MGT','OFF','Owner Oversight',    2, '10:00','15:00', 30, 60.00),
('+61425071500','MGT','OFF','Owner Oversight',    4, '10:00','15:00', 30, 60.00)
) AS seed(mobile, dept_code, loc_code, station, offset_days, start_time, end_time, br, hr)
JOIN public.users u ON u.mobile = seed.mobile
JOIN public.departments d ON d.code = seed.dept_code
JOIN public.locations loc ON loc.code = seed.loc_code
CROSS JOIN LATERAL (SELECT rp.week_start + seed.offset_days AS shift_date_val) AS d2
WHERE rp.status = 'published'
  AND NOT EXISTS (
      SELECT 1 FROM public.shifts s
       WHERE s.user_id = u.id
         AND s.shift_date = shift_date_val::DATE
         AND s.start_time = seed.start_time::TIME
         AND s.end_time   = seed.end_time::TIME
  );

-- =====================================================================
-- 9. Active clock-ins for ~6 staff (live floor strip) + 3 upcoming rostered today
-- =====================================================================

INSERT INTO public.attendance_sessions
  (user_id, shift_id, terminal_id, clocked_in_at, status, in_gps_lat, in_gps_lng)
SELECT
    u.id,
    (SELECT s.id FROM public.shifts s
        WHERE s.user_id = u.id AND s.shift_date = CURRENT_DATE
        ORDER BY s.start_time ASC LIMIT 1),
    'TERM-8821-B',
    NOW() - interval_offset.minutes * INTERVAL '1 minute',
    'clocked_in',
    -33.87 + offset_geo.lat, 151.21 + offset_geo.lng
FROM (
    VALUES
     ('+61410111222', 372, 0.002,  0.001),  -- Marco  6h 12m
     ('+61481904384', 285, 0.003, -0.001),  -- Ramesh 4h 45m
     ('+61450006509', 130, 0.001,  0.002),  -- Siddi  2h 10m
     ('+61410111224', 485, 0.004,  0.003),  -- Leo    8h 05m
     ('+61435064041', 320, 0.000,  0.000),  -- Anmol  5h 20m
     ('+61410111223',  60, 0.002,  0.001)   -- Sarah  1h 00m  (also live for variety)
) AS src(mobile, minutes, lat, lng)
JOIN public.users u ON u.mobile = src.mobile
CROSS JOIN LATERAL (SELECT src.minutes AS minutes) AS interval_offset
CROSS JOIN LATERAL (SELECT src.lat AS lat, src.lng AS lng) AS offset_geo
WHERE NOT EXISTS (
    SELECT 1 FROM public.attendance_sessions a
     WHERE a.user_id = u.id AND a.status IN ('clocked_in','on_break')
);

-- =====================================================================
-- 10. 2 shift swap requests for shift_swaps_panel
-- =====================================================================

INSERT INTO public.shift_swap_requests
  (requester_user_id, shift_id, offered_to_user_id, status, reason)
SELECT
    requester.id,
    (SELECT s.id FROM public.shifts s
      WHERE s.user_id = requester.id ORDER BY shift_date DESC LIMIT 1),
    offered.id,
    'pending',
    'Family commitment — can you take my Sat evening shift?'
FROM public.users requester, public.users offered
WHERE requester.mobile = '+61410111223'   -- Sarah → Priya
  AND offered.mobile   = '+61410111225'
  AND NOT EXISTS (SELECT 1 FROM public.shift_swap_requests WHERE requester_user_id = requester.id);

INSERT INTO public.shift_swap_requests
  (requester_user_id, shift_id, offered_to_user_id, status, reason)
SELECT
    requester.id,
    (SELECT s.id FROM public.shifts s
      WHERE s.user_id = requester.id ORDER BY shift_date DESC LIMIT 1),
    offered.id,
    'approved',
    'Covering study exam — thank you!'
FROM public.users requester, public.users offered
WHERE requester.mobile = '+61410111225'   -- Priya → Sarah
  AND offered.mobile   = '+61410111223'
  AND NOT EXISTS (SELECT 1 FROM public.shift_swap_requests WHERE requester_user_id = requester.id AND status = 'approved');
