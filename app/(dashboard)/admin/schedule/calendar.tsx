"use client";

import { useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Edit3 } from "lucide-react";
import { Department } from "@/types/domain";
import { ShiftEditorModal } from "@/components/calendar/shift-editor-modal";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface CalendarProps {
  initialDate?: string;
  openingHours: { start: string; end: string };
  departments: Department[];
  users: any[];
}

export function Calendar({ initialDate, openingHours, departments, users }: CalendarProps) {
  const calendarRef = useRef<FullCalendar>(null);
  const [shifts, setShifts] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRange, setSelectedRange] = useState<{ start: string; end: string } | null>(null);
  const [editingShift, setEditingShift] = useState<any | null>(null);
  const [activeView, setActiveView] = useState<"timeGridWeek" | "timeGridDay">("timeGridWeek");

  const fetchShifts = async (startStr: string, endStr: string) => {
    try {
      const res = await fetch(`/api/shifts?start=${startStr}&end=${endStr}`);
      if (!res.ok) throw new Error("Failed to fetch shifts");
      const data = await res.json();
      setShifts(data.shifts);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDatesSet = (arg: any) => {
    const start = arg.startStr.split("T")[0];
    const end = arg.endStr.split("T")[0];
    fetchShifts(start, end);
  };

  const handleSelect = (arg: any) => {
    setSelectedRange({
      start: arg.startStr,
      end: arg.endStr,
    });
    setEditingShift(null);
    setIsModalOpen(true);

    const calendarApi = calendarRef.current?.getApi();
    calendarApi?.unselect();
  };

  const handleEventClick = (arg: any) => {
    const shiftId = arg.event.id;
    const shift = shifts.find((s) => s.id === shiftId);
    if (shift) {
      setEditingShift(shift);
      setSelectedRange(null);
      setIsModalOpen(true);
    }
  };

  const handleEventDrop = async (arg: any) => {
    const shiftId = arg.event.id;
    const newStart = arg.event.start;
    const newEnd = arg.event.end;

    const pad = (n: number) => n.toString().padStart(2, "0");
    const shiftDate = `${newStart.getFullYear()}-${pad(newStart.getMonth() + 1)}-${pad(newStart.getDate())}`;
    const startTime = `${pad(newStart.getHours())}:${pad(newStart.getMinutes())}`;
    const endTimeStr = newEnd ? `${pad(newEnd.getHours())}:${pad(newEnd.getMinutes())}` : startTime;

    try {
      const res = await fetch(`/api/shifts`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: shiftId,
          shiftDate,
          startTime,
          endTime: endTimeStr,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        alert(`Failed to update shift: ${errorData.error}`);
        arg.revert();
      } else {
        const view = arg.view;
        fetchShifts(view.activeStart.toISOString().split("T")[0], view.activeEnd.toISOString().split("T")[0]);
      }
    } catch (err) {
      console.error(err);
      arg.revert();
    }
  };

  const events = shifts.map((s) => {
    const startDate = new Date(`${s.shiftDate}T${s.startTime}`);
    let endDate = new Date(`${s.shiftDate}T${s.endTime}`);

    if (endDate <= startDate) {
      endDate = new Date(endDate.getTime() + 24 * 60 * 60 * 1000);
    }

    return {
      id: s.id,
      title: s.userFullName || s.userFirstName || "Unknown",
      start: startDate,
      end: endDate,
      backgroundColor: s.departmentAccent ? getHexColor(s.departmentAccent) : s.userColor || "#3B82F6",
      borderColor: "transparent",
      textColor: "#FFFFFF",
      extendedProps: { shift: s },
    };
  });

  function getHexColor(accentClass: string): string {
    if (accentClass.includes("emerald")) return "#10B981";
    if (accentClass.includes("sky") || accentClass.includes("blue")) return "#0EA5E9";
    if (accentClass.includes("amber") || accentClass.includes("yellow")) return "#F59E0B";
    if (accentClass.includes("rose") || accentClass.includes("red")) return "#F43F5E";
    if (accentClass.includes("slate")) return "#64748B";
    return "#3B82F6";
  }

  const handleModalSave = () => {
    setIsModalOpen(false);
    const calendarApi = calendarRef.current?.getApi();
    if (calendarApi) {
      const start = calendarApi.view.activeStart.toISOString().split("T")[0];
      const end = calendarApi.view.activeEnd.toISOString().split("T")[0];
      fetchShifts(start, end);
    }
  };

  const slotMinTime = openingHours.start;
  let slotMaxTime = openingHours.end;
  if (slotMaxTime <= slotMinTime) {
    const [h, m] = slotMaxTime.split(":");
    slotMaxTime = `${parseInt(h, 10) + 24}:${m}:00`;
  }

  return (
    <div className="space-y-4">
      {/* Calendar Navigation Toolbar */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const api = calendarRef.current?.getApi();
              api?.changeView("timeGridWeek");
              setActiveView("timeGridWeek");
            }}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold border transition-all ${activeView === "timeGridWeek"
                ? "border-blue-500 bg-blue-500/20 text-white"
                : "border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
          >
            <CalendarIcon className="size-3.5" />
            Weekly
          </button>
          <button
            type="button"
            onClick={() => {
              const api = calendarRef.current?.getApi();
              api?.changeView("timeGridDay");
              setActiveView("timeGridDay");
            }}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold border transition-all ${activeView === "timeGridDay"
                ? "border-blue-500 bg-blue-500/20 text-white"
                : "border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
          >
            Daily
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => calendarRef.current?.getApi()?.prev()}
            className="rounded-full border border-slate-800 bg-slate-900 p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            aria-label="Previous Period"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => calendarRef.current?.getApi()?.today()}
            className="rounded-full border border-slate-800 bg-slate-900 px-4 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => calendarRef.current?.getApi()?.next()}
            className="rounded-full border border-slate-800 bg-slate-900 p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            aria-label="Next Period"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        <Button
          onClick={() => {
            setEditingShift(null);
            setSelectedRange(null);
            setIsModalOpen(true);
          }}
          className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs px-5 py-2 rounded-full shadow-md flex items-center justify-center gap-2"
        >
          <Edit3 className="size-3.5" />
          Create / Modify Schedule
        </Button>
      </div>

      {/* Calendar Card Viewport */}
      <Card className="bg-[#181920] border-slate-800 shadow-xl p-4 text-slate-100 overflow-hidden">
        <style>{`
          .fc-header-toolbar { display: none !important; }
          .fc { --fc-border-color: #272A37; --fc-page-bg-color: transparent; }
          .fc-theme-standard td, .fc-theme-standard th { border-color: #272A37 !important; }
          .fc-col-header-cell { background-color: #111218; padding: 10px 0 !important; }
          .fc-col-header-cell-cushion { color: #94A3B8 !important; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; text-decoration: none !important; }
          .fc-timegrid-slot-label-cushion { color: #64748B !important; font-size: 0.75rem; font-weight: 500; }
          .fc-timegrid-axis-cushion { color: #64748B !important; }
          .fc-timegrid-event { border-radius: 6px !important; box-shadow: 0 2px 4px rgba(0,0,0,0.3); font-weight: 600; font-size: 0.8rem; }
          .fc-timegrid-now-indicator-line { border-color: #EF4444 !important; }
          .fc-timegrid-now-indicator-arrow { border-color: #EF4444 !important; }
        `}</style>
        <div className="fc-theme-standard">
          <FullCalendar
            ref={calendarRef}
            plugins={[timeGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            initialDate={initialDate}
            headerToolbar={false}
            slotMinTime={slotMinTime}
            slotMaxTime={slotMaxTime}
            events={events}
            selectable={true}
            selectMirror={true}
            editable={true}
            eventClick={handleEventClick}
            select={handleSelect}
            eventDrop={handleEventDrop}
            datesSet={handleDatesSet}
            height="auto"
            allDaySlot={false}
            slotDuration="00:30:00"
            nowIndicator={true}
          />
        </div>
      </Card>

      {isModalOpen && (
        <ShiftEditorModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleModalSave}
          initialRange={selectedRange}
          shift={editingShift}
          departments={departments}
          users={users}
        />
      )}
    </div>
  );
}