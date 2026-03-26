/**
 * HR service — birthday/anniversary logic, event management.
 * Ported from hr-events-list-v2.py.
 */

import crypto from "crypto";
import { getAllActiveEmployees } from "@/lib/db/employees";
import { getHREventsByMonth, putHREvent, archiveHREvent } from "@/lib/db/hr-events";
import { workDateLima } from "@/lib/utils/time";
import type {
  Employee,
  BirthdayEntry,
  AnniversaryEntry,
  UpcomingBirthday,
  HREvent,
  HREventType,
} from "@/lib/types";

interface HRDashboard {
  birthdays: BirthdayEntry[];
  anniversaries: AnniversaryEntry[];
  upcomingBirthdays: UpcomingBirthday[];
  announcements: HREvent[];
}

interface CreateHREventInput {
  type: HREventType;
  title: string;
  message: string;
  eventDate: string;
  audience?: string;
  imageUrl?: string;
}

/** Parse "YYYY-MM" into { year, month } (1-based month) */
function parseMonth(month: string): { year: number; month: number } {
  const [y, m] = month.split("-").map(Number);
  return { year: y, month: m };
}

function buildBirthdayEntry(emp: Employee, targetYear: number): BirthdayEntry | null {
  if (!emp.BirthDate) return null;
  const [bYear, bMonth, bDay] = emp.BirthDate.split("-").map(Number);
  const age = targetYear - bYear;
  return {
    employeeId: emp.EmployeeID,
    employeeName: emp.FullName,
    email: emp.Email,
    role: emp.Role,
    area: emp.Area,
    position: emp.Position,
    type: "BIRTHDAY",
    eventDate: emp.BirthDate,
    day: bDay,
    years: age,
    title: `Cumpleaños de ${emp.FullName}`,
    message: `${emp.FullName} cumple ${age} años`,
  };
}

function buildAnniversaryEntry(emp: Employee, targetYear: number): AnniversaryEntry | null {
  if (!emp.HireDate) return null;
  const [hYear, , hDay] = emp.HireDate.split("-").map(Number);
  const years = targetYear - hYear;
  if (years <= 0) return null;
  return {
    employeeId: emp.EmployeeID,
    employeeName: emp.FullName,
    email: emp.Email,
    role: emp.Role,
    area: emp.Area,
    position: emp.Position,
    type: "WORK_ANNIVERSARY",
    eventDate: emp.HireDate,
    day: hDay,
    years,
    isQuinquenio: years % 5 === 0,
    title: `Aniversario de ${emp.FullName}`,
    message: `${emp.FullName} cumple ${years} año${years === 1 ? "" : "s"} en la empresa`,
  };
}

export async function getHRDashboard(month?: string, tenantId?: string): Promise<HRDashboard> {
  const today = workDateLima();
  const targetMonth = month ?? today.substring(0, 7); // "YYYY-MM"
  const { year: targetYear, month: targetM } = parseMonth(targetMonth);

  const employees = await getAllActiveEmployees(tenantId);

  // --- Birthdays of the month ---
  const birthdays: BirthdayEntry[] = [];
  for (const emp of employees) {
    if (!emp.BirthDate) continue;
    const bMonth = parseInt(emp.BirthDate.split("-")[1], 10);
    if (bMonth === targetM) {
      const entry = buildBirthdayEntry(emp, targetYear);
      if (entry) birthdays.push(entry);
    }
  }
  birthdays.sort((a, b) => a.day - b.day);

  // --- Anniversaries of the month ---
  const anniversaries: AnniversaryEntry[] = [];
  for (const emp of employees) {
    if (!emp.HireDate) continue;
    const hMonth = parseInt(emp.HireDate.split("-")[1], 10);
    if (hMonth === targetM) {
      const entry = buildAnniversaryEntry(emp, targetYear);
      if (entry) anniversaries.push(entry);
    }
  }
  anniversaries.sort((a, b) => a.day - b.day);

  // --- Upcoming birthdays (next 30 days from today) ---
  const upcomingBirthdays: UpcomingBirthday[] = [];
  const todayDate = new Date(today + "T12:00:00");
  for (const emp of employees) {
    if (!emp.BirthDate) continue;
    const [bYear, bMonthStr, bDayStr] = emp.BirthDate.split("-");
    // Build this year's birthday
    let nextBirthday = new Date(
      `${todayDate.getFullYear()}-${bMonthStr}-${bDayStr}T12:00:00`
    );
    // If already passed this year, use next year
    if (nextBirthday < todayDate) {
      nextBirthday = new Date(
        `${todayDate.getFullYear() + 1}-${bMonthStr}-${bDayStr}T12:00:00`
      );
    }
    const diffMs = nextBirthday.getTime() - todayDate.getTime();
    const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (daysUntil >= 0 && daysUntil <= 30) {
      const age = nextBirthday.getFullYear() - parseInt(bYear, 10);
      upcomingBirthdays.push({
        employeeId: emp.EmployeeID,
        employeeName: emp.FullName,
        email: emp.Email,
        role: emp.Role,
        area: emp.Area,
        position: emp.Position,
        type: "BIRTHDAY",
        eventDate: emp.BirthDate,
        day: parseInt(bDayStr, 10),
        years: age,
        title: `Cumpleaños de ${emp.FullName}`,
        message: `${emp.FullName} cumple ${age} años`,
        daysUntil,
      });
    }
  }
  upcomingBirthdays.sort((a, b) => a.daysUntil - b.daysUntil);

  // --- Announcements / Holidays ---
  const allEvents = await getHREventsByMonth(targetMonth, tenantId);
  const announcements = allEvents.filter(
    (e) => e.Type === "ANNOUNCEMENT" || e.Type === "HOLIDAY"
  );

  return { birthdays, anniversaries, upcomingBirthdays, announcements };
}

export async function createHREvent(
  input: CreateHREventInput,
  createdBy: string,
  tenantId?: string
): Promise<string> {
  const notificationId = crypto.randomUUID();
  const eventMonth = input.eventDate.substring(0, 7); // "YYYY-MM"

  const event: HREvent = {
    NotificationID: notificationId,
    Type: input.type,
    EventDate: input.eventDate,
    EventMonth: eventMonth,
    Title: input.title,
    Message: input.message,
    Status: "ACTIVE",
    Audience: input.audience,
    ImageUrl: input.imageUrl,
    CreatedBy: createdBy,
    CreatedAt: new Date().toISOString(),
    ...(tenantId && { TenantID: tenantId }),
  };

  await putHREvent(event);
  return notificationId;
}

export async function archiveEvent(notificationId: string): Promise<void> {
  await archiveHREvent(notificationId);
}
