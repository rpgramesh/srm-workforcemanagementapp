"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import type { AppRole } from "@/types/app";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, SwitchField } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { ROLE_LABEL } from "@/lib/user-labels";

const DEPARTMENTS = ["Front of House", "Back of House", "Bar", "Kitchen"];

const DUTY_BADGES = [
  { id: "host", label: "Host", color: "#06B6D4" },
  { id: "barista", label: "Barista", color: "#8B5CF6" },
  { id: "runner", label: "Runner", color: "#F59E0B" },
  { id: "bartender", label: "Bartender", color: "#EC4899" },
  { id: "chef", label: "Chef", color: "#EF4444" },
  { id: "waiter", label: "Waiter", color: "#2563EB" },
  { id: "cleaner", label: "Cleaner", color: "#3B82F6" },
  { id: "supervisor", label: "Supervisor", color: "#14B8A6" },
];

interface StaffSummary {
  id: string;
  firstName: string;
  lastName: string;
  role: AppRole;
  status: "on-duty" | "off" | "break";
  badge?: string;
}

const SAMPLE_STAFF: StaffSummary[] = [
  { id: "1", firstName: "Alex", lastName: "Chung", role: "supervisor", status: "on-duty", badge: "supervisor" },
  { id: "2", firstName: "Brooke", lastName: "Davis", role: "employee", status: "on-duty", badge: "waiter" },
  { id: "3", firstName: "Charlie", lastName: "Evans", role: "employee", status: "break", badge: "barista" },
  { id: "4", firstName: "Dana", lastName: "Ford", role: "employee", status: "on-duty", badge: "bartender" },
  { id: "5", firstName: "Evan", lastName: "Green", role: "employee", status: "off", badge: "chef" },
  { id: "6", firstName: "Faith", lastName: "Hill", role: "employee", status: "on-duty", badge: "host" },
];

interface ManagerSettingsPanelProps {
  actorRole: AppRole;
  myStaffCount: number;
  totalStaffCount: number;
  departmentCounts: Record<string, number>;
}

export function ManagerSettingsPanel({ actorRole, myStaffCount, totalStaffCount, departmentCounts }: ManagerSettingsPanelProps) {
  const [isPending, startTransition] = useTransition();

  const [department, setDepartment] = useState(DEPARTMENTS[0]);
  const [openHoursStart, setOpenHoursStart] = useState("07:00");
  const [openHoursEnd, setOpenHoursEnd] = useState("23:00");
  const [autoClockOutThreshold, setAutoClockOutThreshold] = useState("12");
  const [breakRuleMeal, setBreakRuleMeal] = useState("30");
  const [breakRuleRest, setBreakRuleRest] = useState("10");
  const [defaultShiftLength, setDefaultShiftLength] = useState("8");
  const [rosterPublishReminder, setRosterPublishReminder] = useState("48");
  const [shiftSwapApprovalsRequireManager, setShiftSwapApprovalsRequireManager] = useState(true);
  const [maxSimultaneous, setMaxSimultaneous] = useState<Record<string, string>>({
    "Front of House": "12",
    "Back of House": "8",
    Bar: "4",
    Kitchen: "6",
  });
  const [selectedDeptForResources, setSelectedDeptForResources] = useState(DEPARTMENTS[0]);

  const handleSaveFloorOps = () => {
    startTransition(async () => {
      toast.success("Floor operations saved", {
        description: "Open hours, auto clock-out and break rules updated",
      });
    });
  };

  const handleSaveScheduling = () => {
    startTransition(async () => {
      toast.success("Scheduling controls saved", {
        description: "Shift defaults and swap approvals updated",
      });
    });
  };

  const handleSaveDeptResources = () => {
    startTransition(async () => {
      toast.success("Department resources saved", {
        description: `${selectedDeptForResources} staffing caps updated`,
      });
    });
  };

  const handleDownloadPayroll = () => {
    startTransition(async () => {
      toast.success("Report queued", {
        description: "Payroll CSV is being generated and will be available shortly",
      });
    });
  };

  const handleDownloadLabor = () => {
    startTransition(async () => {
      toast.success("Report queued", {
        description: "Labor % CSV is being generated",
      });
    });
  };

  const handleDownloadHours = () => {
    startTransition(async () => {
      toast.success("Report queued", {
        description: "Hours summary CSV is being generated",
      });
    });
  };

  const onDutyCount = SAMPLE_STAFF.filter((s) => s.status === "on-duty").length;

  return (
    <div className="space-y-6">
      {/* Team & Department Overview */}
      <Card className="rounded-3xl border border-slate-800 bg-[#181920]/90 shadow-2xl backdrop-blur-md">
        <CardHeader className="border-b border-slate-800/60 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-bold text-white">Team</CardTitle>
              <p className="mt-1 text-xs text-slate-400">My staff overview and department headcount</p>
            </div>
            <div>
              <Field id="deptSwitch" label="Department">
                <Select
                  id="deptSwitch"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="bg-slate-900 border-slate-800 text-white focus:border-blue-500"
                >
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d} className="bg-slate-900 text-white">{d}</option>
                  ))}
                </Select>
              </Field>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 pt-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="text-xs uppercase tracking-wider text-slate-400 font-medium">My Direct Reports</div>
              <div className="mt-2 text-3xl font-bold text-white">{myStaffCount}</div>
              <div className="mt-2"><Badge tone="sky" size="sm">{ROLE_LABEL[actorRole]}</Badge></div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="text-xs uppercase tracking-wider text-slate-400 font-medium">{department} Headcount</div>
              <div className="mt-2 text-3xl font-bold text-white">{departmentCounts[department] ?? 0}</div>
              <div className="mt-2 text-xs text-slate-400">of {totalStaffCount} total</div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="text-xs uppercase tracking-wider text-slate-400 font-medium">Currently On Duty</div>
              <div className="mt-2 text-3xl font-bold text-white">{onDutyCount}</div>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-xs text-slate-400">Live status</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/40">
            <div className="border-b border-slate-800/80 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Staff Summary
            </div>
            <div className="divide-y divide-slate-800/60">
              {SAMPLE_STAFF.map((s) => {
                const badgeColor = DUTY_BADGES.find((b) => b.id === s.badge)?.color;
                return (
                  <div key={s.id} className="flex items-center gap-4 px-5 py-3 transition hover:bg-slate-900/60">
                    <Avatar firstName={s.firstName} lastName={s.lastName} size="sm" accent={badgeColor} />
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-sm font-semibold text-white">{s.firstName} {s.lastName}</div>
                      <div className="text-xs text-slate-400">{ROLE_LABEL[s.role]}</div>
                    </div>
                    {s.badge && badgeColor ? (
                      <Badge
                        tone="slate"
                        size="sm"
                        dotColor={badgeColor}
                        className="bg-slate-900 text-slate-300 border border-slate-800"
                      >
                        {DUTY_BADGES.find((b) => b.id === s.badge)?.label}
                      </Badge>
                    ) : null}
                    <Badge
                      tone={s.status === "on-duty" ? "emerald" : s.status === "break" ? "amber" : "slate"}
                      size="sm"
                    >
                      {s.status === "on-duty" ? "On" : s.status === "break" ? "Break" : "Off"}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Floor Operations */}
      <Card className="rounded-3xl border border-slate-800 bg-[#181920]/90 shadow-2xl backdrop-blur-md">
        <CardHeader className="border-b border-slate-800/60 pb-4">
          <CardTitle className="text-lg font-bold text-white">Floor Operations</CardTitle>
          <p className="mt-1 text-xs text-slate-400">Open hours, clock-in guardrails and break rules</p>
        </CardHeader>
        <CardContent className="space-y-5 pt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field id="openStart" label="Open Hours Start">
              <Input
                id="openStart"
                type="time"
                value={openHoursStart}
                onChange={(e) => setOpenHoursStart(e.target.value)}
                className="bg-slate-900 border-slate-800 text-white focus:border-blue-500 [color-scheme:dark]"
              />
            </Field>
            <Field id="openEnd" label="Open Hours End">
              <Input
                id="openEnd"
                type="time"
                value={openHoursEnd}
                onChange={(e) => setOpenHoursEnd(e.target.value)}
                className="bg-slate-900 border-slate-800 text-white focus:border-blue-500 [color-scheme:dark]"
              />
            </Field>
            <Field id="autoClockOut" label="Auto Clock-Out (hrs)" hint="Max shift before auto sign-off">
              <Input
                id="autoClockOut"
                type="number"
                min="1"
                max="24"
                value={autoClockOutThreshold}
                onChange={(e) => setAutoClockOutThreshold(e.target.value)}
                className="bg-slate-900 border-slate-800 text-white focus:border-blue-500"
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="breakMeal" label="Meal Break (mins)" hint="Auto-inserted for shifts over 6h">
              <Input
                id="breakMeal"
                type="number"
                min="0"
                max="120"
                value={breakRuleMeal}
                onChange={(e) => setBreakRuleMeal(e.target.value)}
                className="bg-slate-900 border-slate-800 text-white focus:border-blue-500"
              />
            </Field>
            <Field id="breakRest" label="Rest Break (mins)" hint="Per 4-hour block worked">
              <Input
                id="breakRest"
                type="number"
                min="0"
                max="60"
                value={breakRuleRest}
                onChange={(e) => setBreakRuleRest(e.target.value)}
                className="bg-slate-900 border-slate-800 text-white focus:border-blue-500"
              />
            </Field>
          </div>
          <div className="flex justify-end pt-2">
            <Button variant="primary" onClick={handleSaveFloorOps} disabled={isPending}>
              {isPending ? "Saving…" : "Save Floor Ops"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reporting */}
      <Card className="rounded-3xl border border-slate-800 bg-[#181920]/90 shadow-2xl backdrop-blur-md">
        <CardHeader className="border-b border-slate-800/60 pb-4">
          <CardTitle className="text-lg font-bold text-white">Reporting</CardTitle>
          <p className="mt-1 text-xs text-slate-400">Analytics links and quick CSV exports</p>
        </CardHeader>
        <CardContent className="space-y-5 pt-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="text-xs uppercase tracking-wider text-slate-400 font-medium">Labor %</div>
              <div className="mt-2 flex items-baseline gap-2">
                <div className="text-3xl font-bold text-blue-400">28.4%</div>
                <span className="text-xs text-slate-400">target 30%</span>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                <div className="h-full w-[28.4%] rounded-full bg-gradient-to-r from-blue-500 to-sky-400" />
              </div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="text-xs uppercase tracking-wider text-slate-400 font-medium">Weekly Payroll</div>
              <div className="mt-2 text-3xl font-bold text-white">$24,180</div>
              <div className="mt-2 text-xs text-slate-400">38 scheduled this week</div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="text-xs uppercase tracking-wider text-slate-400 font-medium">Pending Swaps</div>
              <div className="mt-2 text-3xl font-bold text-amber-400">5</div>
              <div className="mt-2 text-xs text-slate-400">Awaiting manager approval</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/admin/staff">
              <Button variant="primary">View Full Payroll</Button>
            </Link>
            <Button
              variant="subtle"
              className="border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white"
              onClick={handleDownloadPayroll}
            >
              ↓ Payroll CSV
            </Button>
            <Button
              variant="subtle"
              className="border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white"
              onClick={handleDownloadLabor}
            >
              ↓ Labor % CSV
            </Button>
            <Button
              variant="subtle"
              className="border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white"
              onClick={handleDownloadHours}
            >
              ↓ Hours Summary
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Staff Scheduling Controls */}
      <Card className="rounded-3xl border border-slate-800 bg-[#181920]/90 shadow-2xl backdrop-blur-md">
        <CardHeader className="border-b border-slate-800/60 pb-4">
          <CardTitle className="text-lg font-bold text-white">Staff Scheduling Controls</CardTitle>
          <p className="mt-1 text-xs text-slate-400">Roster defaults and shift governance</p>
        </CardHeader>
        <CardContent className="space-y-5 pt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field id="defShiftLen" label="Default Shift Length (hrs)">
              <Input
                id="defShiftLen"
                type="number"
                min="1"
                max="16"
                step="0.5"
                value={defaultShiftLength}
                onChange={(e) => setDefaultShiftLength(e.target.value)}
                className="bg-slate-900 border-slate-800 text-white focus:border-blue-500"
              />
            </Field>
            <Field id="rosterReminder" label="Publish Reminder (hrs)" hint="Before first day of roster">
              <Input
                id="rosterReminder"
                type="number"
                min="1"
                max="336"
                value={rosterPublishReminder}
                onChange={(e) => setRosterPublishReminder(e.target.value)}
                className="bg-slate-900 border-slate-800 text-white focus:border-blue-500"
              />
            </Field>
          </div>
          <div className="space-y-3">
            <SwitchField
              checked={shiftSwapApprovalsRequireManager}
              onChange={setShiftSwapApprovalsRequireManager}
              label="Shift Swap Approvals Require Manager"
              description={shiftSwapApprovalsRequireManager
                ? "All swaps between staff need explicit manager approval before applying"
                : "Staff can freely swap shifts within same role without approval"}
            />
          </div>
          <div className="flex justify-end pt-2">
            <Button variant="primary" onClick={handleSaveScheduling} disabled={isPending}>
              {isPending ? "Saving…" : "Save Scheduling"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Departmental Resources */}
      <Card className="rounded-3xl border border-slate-800 bg-[#181920]/90 shadow-2xl backdrop-blur-md">
        <CardHeader className="border-b border-slate-800/60 pb-4">
          <CardTitle className="text-lg font-bold text-white">Departmental Resources</CardTitle>
          <p className="mt-1 text-xs text-slate-400">On-duty role badges and maximum simultaneous staffing</p>
        </CardHeader>
        <CardContent className="space-y-5 pt-6">
          <Field id="resourceDept" label="Department">
            <Select
              id="resourceDept"
              value={selectedDeptForResources}
              onChange={(e) => setSelectedDeptForResources(e.target.value)}
              className="bg-slate-900 border-slate-800 text-white focus:border-blue-500"
            >
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d} className="bg-slate-900 text-white">{d}</option>
              ))}
            </Select>
          </Field>

          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">On-Duty Badges</div>
            <div className="flex flex-wrap gap-2">
              {DUTY_BADGES.map((b) => (
                <Badge
                  key={b.id}
                  tone="slate"
                  dotColor={b.color}
                  size="md"
                  className="bg-slate-900 text-slate-300 border border-slate-800"
                >
                  {b.label}
                </Badge>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {DEPARTMENTS.map((d) => (
              <Field key={d} id={`max-${d}`} label={`Max ${d}`} hint="Simultaneous on-duty staff">
                <Input
                  id={`max-${d}`}
                  type="number"
                  min="1"
                  max="100"
                  value={maxSimultaneous[d] ?? "8"}
                  onChange={(e) => setMaxSimultaneous((prev) => ({ ...prev, [d]: e.target.value }))}
                  className="bg-slate-900 border-slate-800 text-white focus:border-blue-500"
                />
              </Field>
            ))}
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="primary" onClick={handleSaveDeptResources} disabled={isPending}>
              {isPending ? "Saving…" : "Save Resources"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}