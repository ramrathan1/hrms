import { employees } from "@/data/core";
import { can } from "./api";
import { CURRENT_USER } from "./store";

/**
 * Who this user may pick in a "whose record is this?" field.
 *
 * An employee portal belongs to one person. Offering a list of colleagues in
 * the leave, timesheet and ticket dialogs invited exactly the thing the server
 * now refuses — logging hours onto someone else's timesheet, filing their
 * leave — and even where the server held, the list told the employee things
 * about their colleagues that the screen had no reason to show.
 *
 * Acting for other people is a manager's job, so the caller names the
 * permission that marks one. Everyone else gets a list of one: themselves.
 */
export function selectablePeople(elevatedPermission: string) {
  if (can(elevatedPermission)) return employees;
  return employees.filter((e) => e.id === CURRENT_USER.id);
}

/** Options for a `<select>`; a single entry when you may only act for yourself. */
export function peopleOptions(elevatedPermission: string) {
  return selectablePeople(elevatedPermission).map((e) => ({ value: e.id, label: e.name }));
}
