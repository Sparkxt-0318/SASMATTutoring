"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { prisma } from "@/lib/db";
import { sendRequestBlast } from "@/lib/blast";
import { sendAdminAlert, sendEmail } from "@/lib/email";
import { insertRequest } from "@/lib/race-safe";
import { MAX_ACTIVE_REQUESTS_PER_STUDENT, appUrl, shanghaiDateTime } from "@/lib/constants";
import { requestSchema } from "@/lib/validation";
import { adminAlertEmail, requestConfirmEmail } from "@/emails/templates";

export interface RequestFormState {
  errors: Record<string, string>;
  values: Record<string, string>;
}

const LIMIT_MESSAGES = {
  active: `You already have ${MAX_ACTIVE_REQUESTS_PER_STUDENT} requests waiting. Please wait for a tutor to reach out, or ask an officer for help.`,
  "student-day": "You have sent several requests today already. Please try again tomorrow.",
  busy: "We are getting a lot of requests right now. Please try again in a little while.",
};

/**
 * The public request form. The request is saved as UNCONFIRMED and the student
 * is emailed a confirmation link (#4): nothing reaches members until they press
 * it, so nobody can request tutoring in someone else's name. The duplicate check,
 * abuse limits and insert are race-safe (see insertRequest).
 */
export async function createRequest(
  _prev: RequestFormState,
  formData: FormData,
): Promise<RequestFormState> {
  // Honeypot: real users never see or fill this field.
  if (formData.get("website")) {
    redirect("/request/success");
  }

  const raw = {
    studentName: String(formData.get("studentName") ?? ""),
    studentEmail: String(formData.get("studentEmail") ?? ""),
    gradeLevel: String(formData.get("gradeLevel") ?? ""),
    subject: String(formData.get("subject") ?? ""),
    topic: String(formData.get("topic") ?? ""),
    receivedTeacherHelp: String(formData.get("receivedTeacherHelp") ?? ""),
    meetingDate: String(formData.get("meetingDate") ?? ""),
    startTime: String(formData.get("startTime") ?? ""),
    endTime: String(formData.get("endTime") ?? ""),
  };

  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "form");
      if (!errors[field]) errors[field] = issue.message;
    }
    return { errors, values: raw };
  }

  const { meetingDate, startTime, endTime, receivedTeacherHelp, ...rest } = parsed.data;
  const request = {
    ...rest,
    meetingStart: shanghaiDateTime(meetingDate, startTime),
    meetingEnd: shanghaiDateTime(meetingDate, endTime),
  };
  const outcome = await insertRequest({ ...request, receivedTeacherHelp: receivedTeacherHelp === "Yes" });
  if (!outcome.ok) return { errors: { form: LIMIT_MESSAGES[outcome.reason] }, values: raw };

  // An exact retry of a waiting request is the same request: no second email.
  if (!outcome.duplicate) {
    const { confirmToken } = outcome;
    after(async () => {
      const mail = requestConfirmEmail(request, `${appUrl()}/request/confirm/${confirmToken}`);
      try {
        await sendEmail({ to: rest.studentEmail, subject: mail.subject, html: mail.html });
      } catch (err) {
        console.error("Request confirmation email failed:", err);
        const alert = adminAlertEmail(
          "A student's confirmation email failed",
          `${rest.studentName} (${rest.studentEmail}) asked for ${rest.subject} help, but the email with their confirmation link could not be sent (${String(err)}). The request waits under "Awaiting student" in the Requests tab; you may want to contact them.`,
        );
        await sendAdminAlert(alert.subject, alert.html);
      }
    });
  }

  redirect("/request/success");
}

/**
 * The student pressed "Confirm my request" (a POST, never on GET, because email
 * scanners open links). Only now are members emailed, after the response.
 */
export async function confirmRequest(token: string): Promise<void> {
  const now = new Date();
  const confirmed = await prisma.tutoringRequest.updateManyAndReturn({
    where: { confirmToken: token, status: "UNCONFIRMED", meetingStart: { gt: now } },
    data: { status: "OPEN", confirmedAt: now },
    select: { id: true },
  });
  if (confirmed.length === 1) {
    const requestId = confirmed[0].id;
    after(async () => {
      try {
        await sendRequestBlast(requestId);
      } catch (err) {
        console.error("Request blast crashed:", err);
      }
    });
  }
  redirect(`/request/confirm/${token}`);
}
