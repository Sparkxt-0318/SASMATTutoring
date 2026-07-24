import { z } from "zod";
import { COURSES, GRADES, STUDENT_EMAIL_DOMAIN } from "./constants";

export const requestSchema = z.object({
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
  availability: z
    .string()
    .trim()
    .min(5, "Let us know when you're free (e.g. lunch, after school Tuesdays).")
    .max(1000, "Please keep it under 1000 characters."),
});

export const sessionLogSchema = z.object({
  minutes: z.coerce.number().int().min(15, "Session must be at least 15 minutes.").max(480),
  notes: z.string().trim().max(1000).optional(),
});

export const memberSchema = z.object({
  name: z.string().trim().min(2, "Please enter a name.").max(100),
  email: z.string().trim().toLowerCase().email("Please enter a valid email."),
});
