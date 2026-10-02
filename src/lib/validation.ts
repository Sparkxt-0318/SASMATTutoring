import { z } from "zod";
import {
  COURSES,
  GRADES,
  MAX_DAYS_AHEAD,
  MAX_MEETING_MINUTES,
  MIN_MEETING_MINUTES,
  STUDENT_EMAIL_DOMAIN,
  YES_NO,
  isPast,
  meetingMinutes,
  shanghaiDateTime,
} from "./constants";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const requestSchema = z
  .object({
    studentName: z
      .string()
      .trim()
      .min(2, "Please enter your full name.")
      .max(100, "Name is too long."),
    studentEmail: z
      .string()
      .trim()
      .toLowerCase()
      .email("Please enter a valid email address.")
      .refine((email) => email.endsWith(`@${STUDENT_EMAIL_DOMAIN}`), {
        message: `Please use your @${STUDENT_EMAIL_DOMAIN} school email.`,
      }),
    gradeLevel: z.enum(GRADES, { message: "Please select your grade." }),
    subject: z.enum(COURSES, { message: "Please select a course." }),
    topic: z
      .string()
      .trim()
      .min(10, "Tell us a bit more about what you need help with (at least 10 characters).")
      .max(2000, "Please keep it under 2000 characters."),
    receivedTeacherHelp: z.enum(YES_NO, { message: "Please select an answer." }),
    meetingDate: z.string().regex(DATE_RE, "Please pick a date for the session."),
    startTime: z.string().regex(TIME_RE, "Please choose a start time."),
    endTime: z.string().regex(TIME_RE, "Please choose an end time."),
  })
  .superRefine((data, ctx) => {
    // Field-level errors above already cover malformed values.
    if (!DATE_RE.test(data.meetingDate) || !TIME_RE.test(data.startTime) || !TIME_RE.test(data.endTime)) {
      return;
    }
    const start = shanghaiDateTime(data.meetingDate, data.startTime);
    const end = shanghaiDateTime(data.meetingDate, data.endTime);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      ctx.addIssue({ code: "custom", path: ["meetingDate"], message: "Please pick a valid date." });
      return;
    }
    if (isPast(start)) {
      ctx.addIssue({
        code: "custom",
        path: ["startTime"],
        message: "That time has already passed — please choose a time in the future.",
      });
      return;
    }
    if (start.getTime() - Date.now() > MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000) {
      ctx.addIssue({
        code: "custom",
        path: ["meetingDate"],
        message: `Please pick a date within the next ${MAX_DAYS_AHEAD} days.`,
      });
      return;
    }
    const minutes = meetingMinutes(start, end);
    if (minutes <= 0) {
      ctx.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "The end time needs to be after the start time.",
      });
    } else if (minutes < MIN_MEETING_MINUTES) {
      ctx.addIssue({
        code: "custom",
        path: ["endTime"],
        message: `Sessions need to be at least ${MIN_MEETING_MINUTES} minutes.`,
      });
    } else if (minutes > MAX_MEETING_MINUTES) {
      ctx.addIssue({
        code: "custom",
        path: ["endTime"],
        message: `Sessions can be at most ${MAX_MEETING_MINUTES / 60} hours.`,
      });
    }
  });

/** Minutes an officer awards for a session. */
export const creditMinutesSchema = z.coerce
  .number()
  .int("Enter whole minutes.")
  .min(5, "Credit must be at least 5 minutes.")
  .max(480, "Credit can be at most 8 hours.");

export const memberSchema = z.object({
  name: z.string().trim().min(2, "Please enter a name.").max(100),
  email: z.string().trim().toLowerCase().email("Please enter a valid email."),
});
