"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Save, Shield, ShieldCheck, UserPlus2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, SwitchField, TextArea } from "@/components/ui/field";
import { createStaff, getStaffForEdit, updateStaff } from "@/features/users/actions/staff-actions";
import { listDepartments } from "@/features/data/actions/reference-actions";
import type { DepartmentRow } from "@/features/data/actions/reference-actions";
import type { User } from "@/types/user";
import { canManageStaff } from "@/types/user";
import type { AppRole } from "@/types/app";
import { clsx } from "clsx";

const AppRoleZ = z.enum(["super_admin", "restaurant_admin", "manager", "supervisor", "employee"]) satisfies z.ZodSchema<AppRole>;

const PERMISSION_KEYS = [
  { key: "canViewRoster", label: "View Rosters", description: "Can view all rosters and shifts" },
  { key: "canEditRoster", label: "Edit Rosters", description: "Create, edit, publish rosters" },
  { key: "canApproveLeave", label: "Approve Leave", description: "Approve / reject leave requests" },
  { key: "canViewPayroll", label: "View Payroll", description: "View payroll summaries and reports" },
  { key: "canRunPayroll", label: "Run Payroll", description: "Finalize and export pay runs" },
  { key: "canManageStaff", label: "Manage Staff", description: "Create / edit / deactivate staff" },
  { key: "canSendBroadcast", label: "Send Broadcasts", description: "Message entire departments" },
  { key: "canViewReports", label: "View Reports", description: "View analytics and reports" },
  { key: "canConfigureSettings", label: "Configure Settings", description: "Administer app settings" },
] as const;

const ROLE_DEFAULT_PERMS: Record<AppRole, Record<string, boolean>> = {
  super_admin: {
    canViewRoster: true, canEditRoster: true, canApproveLeave: true,
    canViewPayroll: true, canRunPayroll: true, canManageStaff: true,
    canSendBroadcast: true, canViewReports: true, canConfigureSettings: true,
  },
  restaurant_admin: {
    canViewRoster: true, canEditRoster: true, canApproveLeave: true,
    canViewPayroll: true, canRunPayroll: true, canManageStaff: true,
    canSendBroadcast: true, canViewReports: true, canConfigureSettings: true,
  },
  manager: {
    canViewRoster: true, canEditRoster: true, canApproveLeave: true,
    canViewPayroll: true, canRunPayroll: false, canManageStaff: true,
    canSendBroadcast: true, canViewReports: true, canConfigureSettings: false,
  },
  supervisor: {
    canViewRoster: true, canEditRoster: true, canApproveLeave: false,
    canViewPayroll: false, canRunPayroll: false, canManageStaff: false,
    canSendBroadcast: false, canViewReports: false, canConfigureSettings: false,
  },
  employee: {
    canViewRoster: true, canEditRoster: false, canApproveLeave: false,
    canViewPayroll: false, canRunPayroll: false, canManageStaff: false,
    canSendBroadcast: false, canViewReports: false, canConfigureSettings: false,
  },
};

const pinSame4Regex = /^(\d)\1{3}$/;
const pinSequentialForward = /^(0123|1234|2345|3456|4567|5678|6789|0123)$/;
const pinSequentialBack = /^(9876|8765|7654|6543|5432|4321|3210|9876)$/;

const schema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("create"),
    firstName: z.string().trim().min(2).max(64),
    lastName: z.string().trim().min(2).max(64),
    mobile: z.string().trim().min(6, "Enter a valid mobile number"),
    role: AppRoleZ,
    pin: z
      .string()
      .regex(/^\d{4}$/, "PIN must be 4 digits")
      .refine((p) => !pinSame4Regex.test(p), "PIN cannot be 4 identical digits")
      .refine(
        (p) => !pinSequentialForward.test(p) && !pinSequentialBack.test(p),
        "PIN cannot be a sequential run like 1234 or 4321",
      ),
    employeeId: z.union([z.string().trim().max(32), z.null(), z.literal("")]).transform((v) => (v === "" ? null : v)),
    jobTitle: z.union([z.string().trim().max(128), z.null(), z.literal("")]).transform((v) => (v === "" ? null : v)),
    hourlyRate: z.union([z.number().min(0).max(9999), z.null()]).optional(),
    avatarUrl: z.union([z.string().trim().max(512).url(), z.null(), z.literal("")]).transform((v) => (v === "" ? null : v)),
    color: z.union([z.string().trim().regex(/^#(?:[0-9a-fA-F]{3}){1,2}$/), z.null(), z.literal("")]).transform((v) => (v === "" ? null : v)),
    departmentId: z.union([z.string().uuid(), z.null(), z.literal("")]).transform((v) => (v === "" ? null : v)),
    email: z.union([z.string().trim().email().max(255), z.null(), z.literal("")]).transform((v) => (v === "" ? null : v)),
    employmentDate: z.union([z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/), z.null(), z.literal("")]).transform((v) => (v === "" ? null : v)),
    address: z.union([z.string().trim().max(512), z.null(), z.literal("")]).transform((v) => (v === "" ? null : v)),
    emergencyContactName: z.union([z.string().trim().max(128), z.null(), z.literal("")]).transform((v) => (v === "" ? null : v)),
    emergencyContactPhone: z.union([z.string().trim().max(32), z.null(), z.literal("")]).transform((v) => (v === "" ? null : v)),
    notes: z.union([z.string().trim().max(4000), z.null(), z.literal("")]).transform((v) => (v === "" ? null : v)),
    permissions: z.record(z.string(), z.boolean()),
    isActive: z.boolean(),
  }),
  z.object({
    mode: z.literal("edit"),
    id: z.string().uuid(),
    firstName: z.string().trim().min(2).max(64),
    lastName: z.string().trim().min(2).max(64),
    mobile: z.string().trim().min(6),
    role: AppRoleZ,
    pin: z.union([z.string().regex(/^\d{4}$/), z.null()]).optional(),
    employeeId: z.union([z.string().trim().max(32), z.null(), z.literal("")]).transform((v) => (v === "" ? null : v)),
    jobTitle: z.union([z.string().trim().max(128), z.null(), z.literal("")]).transform((v) => (v === "" ? null : v)),
    hourlyRate: z.union([z.number().min(0).max(9999), z.null()]).optional(),
    avatarUrl: z.union([z.string().trim().max(512).url(), z.null(), z.literal("")]).transform((v) => (v === "" ? null : v)),
    color: z.union([z.string().trim().regex(/^#(?:[0-9a-fA-F]{3}){1,2}$/), z.null(), z.literal("")]).transform((v) => (v === "" ? null : v)),
    departmentId: z.union([z.string().uuid(), z.null(), z.literal("")]).transform((v) => (v === "" ? null : v)),
    email: z.union([z.string().trim().email().max(255), z.null(), z.literal("")]).transform((v) => (v === "" ? null : v)),
    employmentDate: z.union([z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/), z.null(), z.literal("")]).transform((v) => (v === "" ? null : v)),
    address: z.union([z.string().trim().max(512), z.null(), z.literal("")]).transform((v) => (v === "" ? null : v)),
    emergencyContactName: z.union([z.string().trim().max(128), z.null(), z.literal("")]).transform((v) => (v === "" ? null : v)),
    emergencyContactPhone: z.union([z.string().trim().max(32), z.null(), z.literal("")]).transform((v) => (v === "" ? null : v)),
    notes: z.union([z.string().trim().max(4000), z.null(), z.literal("")]).transform((v) => (v === "" ? null : v)),
    permissions: z.record(z.string(), z.boolean()),
    isActive: z.boolean(),
  }),
]);

type FormValues = z.infer<typeof schema>;

function fieldError(message: unknown): string | undefined {
  return typeof message === "string" ? message : undefined;
}

function toDateInput(d: Date | null): string {
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function defaultPermissionsFor(role: AppRole, merge: Record<string, boolean> | undefined): Record<string, boolean> {
  const base = { ...ROLE_DEFAULT_PERMS[role] };
  if (merge) Object.assign(base, merge);
  return base;
}

export interface AddStaffModalProps {
  open: boolean;
  onClose: () => void;
  editingStaffId?: string | null;
  onSaved?: (user: User) => void;
  viewerRole?: AppRole | null;
}

export function AddStaffModal({ open, onClose, editingStaffId, onSaved, viewerRole }: AddStaffModalProps) {
  const canEdit = !viewerRole || canManageStaff(viewerRole);
  const isEdit = !!editingStaffId;
  const mode: "create" | "edit" = isEdit ? "edit" : "create";
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [loadingDept, setLoadingDept] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, reset, formState: { errors }, watch, setValue, trigger } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: useMemo<FormValues>(
      () => ({
        mode: "create",
        firstName: "", lastName: "", mobile: "", role: "employee", pin: "",
        employeeId: null, jobTitle: null, hourlyRate: null, avatarUrl: null,
        color: "#10B981", departmentId: null, email: null, employmentDate: null,
        address: null, emergencyContactName: null, emergencyContactPhone: null,
        notes: null, permissions: { ...ROLE_DEFAULT_PERMS.employee }, isActive: true,
      }),
      [],
    ),
  });

  const watchRole = watch("role") as AppRole;
  const watchPerms = watch("permissions");

  useEffect(() => {
    if (!open) return;
    setLoadingDept(true);
    listDepartments()
      .then((d) => {
        setDepartments(d);
        if (d.length === 0) {
          toast.warning("No departments available", {
            description: "Run migration 004+005 in Supabase SQL Editor to seed departments.",
            duration: 8000,
          });
        }
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        toast.error("Could not load departments", { description: msg });
        setDepartments([]);
      })
      .finally(() => {
        setLoadingDept(false);
      });
    if (!editingStaffId) {
      reset({
        mode: "create",
        firstName: "", lastName: "", mobile: "", role: "employee", pin: "",
        employeeId: null, jobTitle: null, hourlyRate: null, avatarUrl: null,
        color: "#10B981", departmentId: null, email: null, employmentDate: null,
        address: null, emergencyContactName: null, emergencyContactPhone: null,
        notes: null, permissions: { ...ROLE_DEFAULT_PERMS.employee }, isActive: true,
      });
    } else {
      setSubmitting(true);
      getStaffForEdit(editingStaffId).then((u) => {
        setSubmitting(false);
        if (!u) {
          toast.error("Staff member not found");
          return;
        }
        const perms = defaultPermissionsFor(u.role, u.permissions as Record<string, boolean> | undefined);
        reset({
          mode: "edit",
          id: u.id,
          firstName: u.firstName,
          lastName: u.lastName,
          mobile: u.mobile,
          role: u.role,
          pin: null,
          employeeId: u.employeeId ?? null,
          jobTitle: u.jobTitle ?? null,
          hourlyRate: u.hourlyRate ?? null,
          avatarUrl: u.avatarUrl ?? null,
          color: u.color ?? "#10B981",
          departmentId: u.departmentId ?? null,
          email: u.email ?? null,
          employmentDate: u.employmentDate ? toDateInput(new Date(u.employmentDate)) : null,
          address: u.address ?? null,
          emergencyContactName: u.emergencyContactName ?? null,
          emergencyContactPhone: u.emergencyContactPhone ?? null,
          notes: u.notes ?? null,
          permissions: perms,
          isActive: u.isActive,
        });
      });
    }
  }, [open, editingStaffId, reset]);

  // When role changes, apply default perms but preserve explicit overrides
  useEffect(() => {
    const defaults = ROLE_DEFAULT_PERMS[watchRole];
    const next: Record<string, boolean> = {};
    for (const { key } of PERMISSION_KEYS) {
      next[key] = (watchPerms && typeof watchPerms[key] === "boolean" && watchRole !== "employee")
        ? watchPerms[key]
        : defaults[key];
      if (watchRole === "employee") next[key] = defaults[key];
    }
    setValue("permissions", next, { shouldDirty: true });
    void trigger("permissions");
  }, [watchRole]);

  const onSubmit = async (values: FormValues) => {
    if (!canEdit) {
      toast.error("You don't have permission to manage staff");
      return;
    }
    setSubmitting(true);
    try {
      const { mode: modeValue, ...payload } = values;
      void modeValue;
      const r = values.mode === "create"
        ? await createStaff(payload)
        : await updateStaff(payload);
      if (r.zodErrors && r.zodErrors.length) {
        for (const issue of r.zodErrors) {
          const key = issue.path?.[0];
          if (typeof key === "string") {
            void trigger(key as Parameters<typeof trigger>[0]);
            toast.error(`${key}: ${issue.message}`);
          } else {
            toast.error(issue.message);
          }
        }
        return;
      }
      if (!r.success || !r.data) {
        toast.error(r.message, r.description ? { description: r.description } : undefined);
        return;
      }
      toast.success(
        mode === "create" ? `${r.data.firstName} ${r.data.lastName} added` : "Staff details updated",
        { description: mode === "create" ? "Record saved and secured" : "Audit log updated" },
      );
      onSaved?.(r.data);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={
        mode === "edit" ? "Edit staff member" : "Add a new staff member"
      }
      subtitle={
        mode === "edit"
          ? "Changes are saved with a full audit trail. PIN is only updated if you enter a new one."
          : "All fields marked with a security badge are encrypted at rest and access-logged."
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
            <Button type="submit" form="staff-form" disabled={submitting || !canEdit}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : mode === "edit" ? <Save className="mr-2 h-4 w-4" /> : <UserPlus2 className="mr-2 h-4 w-4" />}
            {mode === "edit" ? "Save changes" : "Create staff"}
          </Button>
        </>
      }
    >
        <form id="staff-form" onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Field label="First name" error={fieldError(errors.firstName?.message)}>
              <Input autoFocus {...register("firstName")} invalid={!!errors.firstName} placeholder="Jamie" />
          </Field>
            <Field label="Last name" error={fieldError(errors.lastName?.message)}>
              <Input {...register("lastName")} invalid={!!errors.lastName} placeholder="Okafor" />
          </Field>
            <Field label="Mobile (AU)" hint="e.g. 0412 345 678 — normalised to +61" error={fieldError(errors.mobile?.message)}>
              <Input {...register("mobile")} invalid={!!errors.mobile} inputMode="tel" placeholder="0412 345 678" />
          </Field>
            <Field label="Role" error={fieldError(errors.role?.message)}>
              <Select {...register("role")} invalid={!!errors.role}>
              <option value="employee">Employee</option>
              <option value="supervisor">Supervisor</option>
              <option value="manager">Manager</option>
              <option value="restaurant_admin">Restaurant Admin</option>
              <option value="super_admin">Super Admin</option>
            </Select>
          </Field>
          <Field
            label={
              <span className="inline-flex items-center gap-1.5">
                {mode === "edit" ? "New PIN (optional)" : "4-digit PIN"}
                <ShieldCheck className="h-3.5 w-3.5 text-blue-500" />
                </span>
            }
            hint={mode === "edit" ? "Leave blank to keep the current PIN" : "Never use 1234, 0000 or similar"}
              error={fieldError(errors.pin?.message)}
          >
              <Input {...register("pin")} invalid={!!errors.pin} inputMode="numeric" maxLength={4} placeholder="••••" />
          </Field>
            <Field label="Employee ID" error={fieldError(errors.employeeId?.message)}>
              <Input {...register("employeeId")} invalid={!!errors.employeeId} placeholder="EMP-0042" />
          </Field>
            <Field label="Job title" error={fieldError(errors.jobTitle?.message)}>
              <Input {...register("jobTitle")} invalid={!!errors.jobTitle} placeholder="Head Chef" />
          </Field>
            <Field label="Hourly rate (AUD)" error={fieldError(errors.hourlyRate?.message)}>
            <Input
              type="number"
              step="0.01"
              min={0}
                {...register("hourlyRate", { valueAsNumber: true })}
              invalid={!!errors.hourlyRate}
              placeholder="29.75"
            />
          </Field>
            <Field label="Department" hint={loadingDept ? "Loading departments…" : undefined} error={fieldError(errors.departmentId?.message)}>
              <Select {...register("departmentId")} invalid={!!errors.departmentId}>
              <option value="">— No department —</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name} ({d.short_label})</option>
              ))}
            </Select>
          </Field>
            <Field label="Email" error={fieldError(errors.email?.message)}>
              <Input type="email" {...register("email")} invalid={!!errors.email} placeholder="jamie@venue.com" />
          </Field>
            <Field label="Employment date" error={fieldError(errors.employmentDate?.message)}>
              <Input type="date" {...register("employmentDate")} invalid={!!errors.employmentDate} />
          </Field>
            <Field label="Avatar color" error={fieldError(errors.color?.message)}>
            <div className="flex items-center gap-3">
                <Input type="color" className={clsx("h-11 w-14 p-1")} {...register("color")} invalid={!!errors.color} />
              <span className="text-xs text-slate-500">Used as avatar fallback</span>
            </div>
          </Field>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Residential address" error={fieldError(errors.address?.message)}>
              <TextArea {...register("address")} invalid={!!errors.address} rows={2} placeholder="123 Example Street…" />
          </Field>
            <Field label="Staff notes" error={fieldError(errors.notes?.message)}>
              <TextArea {...register("notes")} invalid={!!errors.notes} rows={2} placeholder="Allergies, training notes, preferences…" />
          </Field>
            <Field label="Emergency contact name" error={fieldError(errors.emergencyContactName?.message)}>
              <Input {...register("emergencyContactName")} invalid={!!errors.emergencyContactName} placeholder="Alex Okafor" />
          </Field>
            <Field label="Emergency contact phone" error={fieldError(errors.emergencyContactPhone?.message)}>
              <Input {...register("emergencyContactPhone")} invalid={!!errors.emergencyContactPhone} placeholder="02 8000 1234" />
          </Field>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Shield className="h-4 w-4 text-sky-400" />
                Permissions matrix
              </h3>
              <p className="text-xs text-slate-500">
                Defaults are applied from the role above; you may override individual toggles. Changes are recorded in the audit log.
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-500">
              Active account
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 bg-white/5 text-blue-600 focus:ring-blue-500/30"
                  {...register("isActive")}
              />
            </label>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PERMISSION_KEYS.map((p) => {
              const val = !!(watchPerms && watchPerms[p.key]);
              const locked = watchRole === "employee";
              return (
                <div key={p.key} className={clsx(locked && "opacity-70")}>
                  <SwitchField
                    checked={val}
                    onChange={(v) => {
                      if (locked) return;
                      setValue("permissions", { ...watchPerms, [p.key]: v }, { shouldDirty: true });
                    }}
                    label={p.label}
                    description={p.description + (locked ? " (employee default)" : "")}
                  />
                </div>
              );
            })}
          </div>
        </section>
      </form>
    </Modal>
  );
}
