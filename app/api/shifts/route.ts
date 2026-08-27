import { NextResponse } from "next/server";
import { operationsRepository } from "@/features/data/repositories/operations-repository";
import { getOpeningHours } from "@/features/settings/services/opening-hours-service";
import { z } from "zod";

const shiftSchema = z.object({
  userIds: z.array(z.string().uuid()),
  departmentId: z.string(),
  shiftDate: z.string(),
  endDate: z.string().optional(),
  startTime: z.string(), // "HH:MM"
  endTime: z.string(),   // "HH:MM"
});

function timeToMinutes(timeStr: string) {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    if (!start || !end) {
      return NextResponse.json({ error: "Missing start or end date" }, { status: 400 });
    }

    const shifts = await operationsRepository.listShifts({
      from: start,
      to: end,
      withUserJoins: true,
    });

    return NextResponse.json({ shifts });
  } catch (error: any) {
    console.error("Failed to fetch shifts:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = shiftSchema.parse(body);

    const { start: openStart, end: openEnd } = await getOpeningHours();
    
    // basic validation
    const shiftStartMins = timeToMinutes(data.startTime);
    let shiftEndMins = timeToMinutes(data.endTime);
    if (shiftEndMins <= shiftStartMins) {
      shiftEndMins += 24 * 60; // next day
    }

    const openStartMins = timeToMinutes(openStart);
    let openEndMins = timeToMinutes(openEnd);
    if (openEndMins <= openStartMins) {
      openEndMins += 24 * 60;
    }

    if (shiftStartMins < openStartMins || shiftEndMins > openEndMins) {
      return NextResponse.json(
        { error: `Shift must be within operating hours (${openStart} to ${openEnd})` },
        { status: 400 }
      );
    }

    const start = new Date(data.shiftDate);
    const end = new Date(data.endDate || data.shiftDate);
    
    const shiftsToCreate = [];
    
    let currentDate = new Date(start);
    while (currentDate <= end) {
      const pad = (n: number) => n.toString().padStart(2, "0");
      const dateStr = `${currentDate.getFullYear()}-${pad(currentDate.getMonth() + 1)}-${pad(currentDate.getDate())}`;
      
      for (const userId of data.userIds) {
        shiftsToCreate.push({
          userId,
          departmentId: data.departmentId,
          shiftDate: dateStr,
          startTime: data.startTime,
          endTime: data.endTime,
        });
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }

    const createdShifts = [];
    for (const shiftData of shiftsToCreate) {
      const shift = await operationsRepository.createShift(shiftData);
      createdShifts.push(shift);
    }

    return NextResponse.json({ shifts: createdShifts });
  } catch (error: any) {
    console.error("Failed to create shift:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, ...data } = body;
    
    if (!id) {
      return NextResponse.json({ error: "Missing shift id" }, { status: 400 });
    }

    if (data.startTime && data.endTime) {
      const { start: openStart, end: openEnd } = await getOpeningHours();
      const shiftStartMins = timeToMinutes(data.startTime);
      let shiftEndMins = timeToMinutes(data.endTime);
      if (shiftEndMins <= shiftStartMins) {
        shiftEndMins += 24 * 60; // next day
      }

      const openStartMins = timeToMinutes(openStart);
      let openEndMins = timeToMinutes(openEnd);
      if (openEndMins <= openStartMins) {
        openEndMins += 24 * 60;
      }

      if (shiftStartMins < openStartMins || shiftEndMins > openEndMins) {
        return NextResponse.json(
          { error: `Shift must be within operating hours (${openStart} to ${openEnd})` },
          { status: 400 }
        );
      }
    }

    const shift = await operationsRepository.updateShift(id, data);
    return NextResponse.json({ shift });
  } catch (error: any) {
    console.error("Failed to update shift:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    
    if (!id) {
      return NextResponse.json({ error: "Missing shift id" }, { status: 400 });
    }

    await operationsRepository.deleteShift(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to delete shift:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
