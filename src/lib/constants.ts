export const COURSES = [
  "IM1",
  "IM2",
  "IM3",
  "IM3+",
  "AP PreCalculus",
  "AP Calculus BC",
  "IB Math AA SL",
  "IB Math AA HL",
  "IB Math AI SL",
  "IB Math AI HL",
  "Multivariable Calculus",
  "Linear Algebra",
] as const;

export const GRADES = ["9", "10", "11", "12"] as const;

export const YES_NO = ["Yes", "No"] as const;

export const STUDENT_EMAIL_DOMAIN = "saschina.org";

/** Session length limits for a requested meeting, in minutes. */
export const MIN_MEETING_MINUTES = 15;
export const MAX_MEETING_MINUTES = 180;

/** Abuse limits for the public request form. */
export const MAX_ACTIVE_REQUESTS_PER_STUDENT = 3;
export const MAX_REQUESTS_PER_STUDENT_PER_DAY = 5;
export const MAX_REQUESTS_PER_HOUR = 30;

/** Abuse limits for member sign-up (bots must not be able to mass-register). */
export const MAX_SIGNUPS_PER_HOUR = 60;
export const MAX_ACTIVE_MEMBERS = 300;

/**
 * Who may create a member account, set with the MEMBER_SIGNUP environment variable:
 *  - "open" (default): anyone can sign up.
 *  - "roster": only emails an officer has already added in the Members tab.
 */
export function signupMode(): "open" | "roster" {
  return process.env.MEMBER_SIGNUP === "roster" ? "roster" : "open";
}

/** Students can book at most this many days ahead. */
export const MAX_DAYS_AHEAD = 60;

/**
 * Hours each member is working toward. Drives the contribution-style progress
 * grid. Override with the MEMBER_HOURS_GOAL environment variable.
 */
export const MEMBER_HOURS_GOAL = Number(process.env.MEMBER_HOURS_GOAL) || 20;

/** One square in the progress grid represents this many minutes of tutoring. */
export const PROGRESS_CELL_MINUTES = 15;

export const CLUB_NAME = "Mu Alpha Theta";
export const SCHOOL_NAME = "Shanghai American School";

export const TIMEZONE = "Asia/Shanghai";

// Shanghai has no daylight saving, so a fixed +08:00 offset is always correct.
const SHANGHAI_OFFSET = "+08:00";

/** Today's date in Shanghai as YYYY-MM-DD (suitable for <input type="date" min>). */
export function shanghaiToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(new Date());
}

/** Combine a Shanghai-local date ("2026-10-09") and time ("12:30") into a Date. */
export function shanghaiDateTime(date: string, time: string): Date {
  return new Date(`${date}T${time}:00${SHANGHAI_OFFSET}`);
}

export function isPast(date: Date): boolean {
  return date.getTime() <= Date.now();
}

export function meetingMinutes(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 60000);
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

/** e.g. "Fri, Oct 9 · 12:30 PM to 1:15 PM" (Shanghai time). */
export function formatMeeting(start: Date, end: Date): string {
  const day = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(start);
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
  });
  return `${day} · ${time.format(start)} to ${time.format(end)}`;
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Hours with one decimal, e.g. 90 -> "1.5" */
export function minutesToHours(minutes: number): string {
  return (minutes / 60).toFixed(1);
}
