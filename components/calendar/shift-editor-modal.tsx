"use client";

import { useState, useEffect } from "react";
import { X, Trash2, Loader2, Calendar, Clock, User, Building2 } from "lucide-react";
import { Department } from "@/types/domain";
import { cn } from "@/lib/utils";

interface ShiftEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  initialRange?: { start: string; end: string } | null;
  shift?: any | null;
  departments: Department[];
  users: any[];
}

export function ShiftEditorModal({
  isOpen,
  onClose,
  onSave,
  initialRange,
  shift,
  departments,
  users,
}: ShiftEditorModalProps) {
  const [userIds, setUserIds] = useState<string[]>(shift ? [shift.userId] : []);
  const [departmentId, setDepartmentId] = useState(shift?.departmentId || "");
  const [shiftDate, setShiftDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (shift) {
      setUserIds([shift.userId]);
      setDepartmentId(shift.departmentId);
      setShiftDate(shift.shiftDate);
      setEndDate(shift.shiftDate);
      setStartTime(shift.startTime.slice(0, 5));
      setEndTime(shift.endTime.slice(0, 5));
    } else if (initialRange) {
      const startDate = new Date(initialRange.start);
      const endD = new Date(initialRange.end);

      const pad = (n: number) => n.toString().padStart(2, "0");
      const startStr = `${startDate.getFullYear()}-${pad(startDate.getMonth() + 1)}-${pad(startDate.getDate())}`;
      setShiftDate(startStr);
      setEndDate(startStr);
      setStartTime(`${pad(startDate.getHours())}:${pad(startDate.getMinutes())}`);

      if (initialRange.start === initialRange.end) {
        endD.setHours(startDate.getHours() + 4);
      }
      setEndTime(`${pad(endD.getHours())}:${pad(endD.getMinutes())}`);
    }
  }, [shift, initialRange]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    if (userIds.length === 0) {
      setError("Please select at least one staff member.");
      setIsSubmitting(false);
      return;
    }

    let finalDeptId = departmentId;
    if (!finalDeptId) {
      const firstUser = users.find((u) => u.id === userIds[0]);
      if (firstUser?.department_id) {
        finalDeptId = firstUser.department_id;
      } else {
        setError("Please select a department (staff member has no default department).");
        setIsSubmitting(false);
        return;
      }
    }

    const payload = shift ? {
      id: shift.id,
      userId: userIds[0],
      departmentId: finalDeptId,
      shiftDate,
      startTime,
      endTime,
    } : {
      userIds,
      departmentId: finalDeptId,
      shiftDate,
      endDate: endDate || shiftDate,
      startTime,
      endTime,
    };

    try {
      const res = await fetch("/api/shifts", {
        method: shift ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to save shift");
      }

      onSave();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!shift) return;
    if (!confirm("Are you sure you want to delete this shift?")) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/shifts?id=${shift.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error("Failed to delete shift");
      }
      onSave();
    } catch (err: any) {
      setError(err.message);
      setIsSubmitting(false);
    }
  };

  const handleUserSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOptions = Array.from(e.target.selectedOptions).map(opt => opt.value);
    setUserIds(selectedOptions);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-3 sm:p-4">
      <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-[#181920] p-4 sm:p-6 shadow-2xl max-h-[92vh] overflow-y-auto touch-scroll text-slate-100">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 sm:pb-4 mb-4 sm:mb-5">
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white">
            {shift ? "Edit Shift" : "Create Shifts"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Staff Selection */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <User className="size-3.5 text-slate-500" />
              <span>Staff Member(s)</span>
            </label>
            <select
              multiple={!shift}
              value={shift ? userIds[0] : userIds}
              onChange={shift ? (e) => setUserIds([e.target.value]) : handleUserSelect}
              required
              className={cn(
                "w-full rounded-xl border border-slate-800 bg-slate-900/90 px-3 py-2.5 text-sm font-medium text-white outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500",
                !shift && "min-h-[110px]"
              )}
            >
              {shift && <option value="" disabled className="bg-slate-900">Select Staff</option>}
              {users.map((u) => (
                <option key={u.id} value={u.id} className="bg-slate-900 py-1 text-slate-200">
                  {u.first_name} {u.last_name} ({u.job_title || "Staff"})
                </option>
              ))}
            </select>
            {!shift && (
              <p className="text-[11px] text-slate-500">
                Hold <code className="text-slate-400 font-mono">CMD/CTRL</code> to select multiple staff members.
              </p>
            )}
          </div>

          {/* Department Selection */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <Building2 className="size-3.5 text-slate-500" />
              <span>Department (Optional)</span>
            </label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-3 py-2.5 text-sm font-medium text-white outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="" className="bg-slate-900">Use Staff Default</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id} className="bg-slate-900 text-slate-200">
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <Calendar className="size-3.5 text-slate-500" />
                <span>{shift ? "Date" : "Start Date"}</span>
              </label>
              <input
                type="date"
                value={shiftDate}
                onChange={(e) => setShiftDate(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-3 py-2 text-sm font-medium text-white outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 [color-scheme:dark]"
              />
            </div>
            {!shift && (
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <Calendar className="size-3.5 text-slate-500" />
                  <span>End Date</span>
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  min={shiftDate}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-3 py-2 text-sm font-medium text-white outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 [color-scheme:dark]"
                />
              </div>
            )}
          </div>

          {/* Times */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <Clock className="size-3.5 text-slate-500" />
                <span>Start Time</span>
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-3 py-2 text-sm font-medium text-white outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 [color-scheme:dark]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <Clock className="size-3.5 text-slate-500" />
                <span>End Time</span>
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-3 py-2 text-sm font-medium text-white outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 [color-scheme:dark]"
              />
            </div>
          </div>

          {/* Action Footer */}
          <div className="mt-6 flex items-center justify-end gap-2 pt-3 border-t border-slate-800/80">
            {shift && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSubmitting}
                className="flex items-center gap-1.5 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3.5 py-2 text-sm font-medium text-rose-400 hover:bg-rose-500/20 transition-colors disabled:opacity-40"
              >
                <Trash2 className="size-4" />
                <span>Delete</span>
              </button>
            )}
            <div className="flex-1" />
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl px-4 py-2 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 hover:bg-blue-500 transition-all disabled:opacity-40"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>{shift ? "Save Shift" : "Create Shifts"}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}