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

export const STUDENT_EMAIL_DOMAIN = "saschina.org";

/** OPEN requests older than this are auto-expired by the daily cron. */
export const REQUEST_EXPIRY_DAYS = 14;

/** CLAIMED requests with no logged session after this many days trigger a reminder. */
export const COMPLETION_REMINDER_DAYS = 7;

/** Duration choices for logging a session, in minutes. */
export const DURATION_OPTIONS = [15, 30, 45, 60, 75, 90, 105, 120] as const;

export const CLUB_NAME = "Mu Alpha Theta";
export const SCHOOL_NAME = "Shanghai American School";

export const TIMEZONE = "Asia/Shanghai";

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
