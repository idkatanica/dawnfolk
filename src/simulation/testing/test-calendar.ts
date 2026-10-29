import { Calendar } from "../nature/calendar.ts";

export function calendarAt(day: number): Calendar {
  const calendar = new Calendar();

  calendar.day = day;

  return calendar;
}
