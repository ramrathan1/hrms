/**
 * Things that belong on a calendar but are not events.
 *
 * Holidays live in their own collection and were drawn only on My Calendar, so
 * the Events calendar showed a working month that wasn't one — someone could
 * schedule a release on Independence Day and nothing on screen said otherwise.
 * One helper, so every calendar draws them identically.
 */
import type { CalEvent } from "@/components/CalendarMonth";
import { holidays } from "@/data/hr";

/** Deliberately outside the event-kind palette: a holiday is not a kind of event. */
export const HOLIDAY_COLOR = "#0f766e";

export const holidayEvents = (): CalEvent[] =>
  holidays.map((h) => ({ date: h.date, title: h.name, color: HOLIDAY_COLOR }));
