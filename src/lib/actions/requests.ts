"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { prisma } from "@/lib/db";
import { sendRequestBlast } from "@/lib/blast";
import {
  MAX_ACTIVE_REQUESTS_PER_STUDENT,
  MAX_REQUESTS_PER_HOUR,
  MAX_REQUESTS_PER_STUDENT_PER_DAY,
  shanghaiDateTime,
} from "@/lib/constants";
import { requestSchema } from "@/lib/validation";

export interface RequestFormState {
  errors: Record<string, string>;
  values: Record<string, string>;
}

const DUPLICATE_WINDOW_MINUTES = 10;

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

  // Duplicate guard: same student + course submitted moments ago → treat as
  // the same request instead of blasting members twice.
  const recentDuplicate = await prisma.tutoringRequest.findFirst({
    where: {
      studentEmail: rest.studentEmail,
      subject: rest.subject,
      status: { in: ["OPEN", "CLAIMED"] },
      createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MINUTES * 60 * 1000) },
    },
  });
  if (recentDuplicate) {
    redirect("/request/success");
  }

  // Abuse limits. Anyone can type any school address, so cap how many requests
  // one address can have, and how many arrive overall, before members get emailed.
  const now = Date.now();
  const [activeForStudent, dayForStudent, hourOverall] = await Promise.all([
    prisma.tutoringRequest.count({
      where: {
        studentEmail: rest.studentEmail,
        status: { in: ["OPEN", "CLAIMED"] },
        meetingEnd: { gt: new Date(now) },
      },
    }),
    prisma.tutoringRequest.count({
      where: {
        studentEmail: rest.studentEmail,
        createdAt: { gte: new Date(now - 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.tutoringRequest.count({
      where: { createdAt: { gte: new Date(now - 60 * 60 * 1000) } },
    }),
  ]);
  if (activeForStudent >= MAX_ACTIVE_REQUESTS_PER_STUDENT) {
    return {
      errors: {
        form: `You already have ${MAX_ACTIVE_REQUESTS_PER_STUDENT} requests waiting. Please wait for a tutor to reach out, or ask an officer for help.`,
      },
      values: raw,
    };
  }
  if (dayForStudent >= MAX_REQUESTS_PER_STUDENT_PER_DAY) {
    return {
      errors: { form: "You have sent several requests today already. Please try again tomorrow." },
      values: raw,
    };
  }
  if (hourOverall >= MAX_REQUESTS_PER_HOUR) {
    return {
      errors: { form: "We are getting a lot of requests right now. Please try again in a little while." },
      values: raw,
    };
  }

  const request = await prisma.tutoringRequest.create({
    data: {
      ...rest,
      meetingStart: shanghaiDateTime(meetingDate, startTime),
      meetingEnd: shanghaiDateTime(meetingDate, endTime),
      receivedTeacherHelp: receivedTeacherHelp === "Yes",
    },
  });

  // Email the members after the student has their confirmation page. Sending
  // 30 emails can take a while, and the student should not wait for it (or see
  // an error) if the mail server is slow. Members whose email fails stay
  // flagged in the admin Requests tab.
  after(async () => {
    try {
      await sendRequestBlast(request.id);
    } catch (err) {
      console.error("Request blast crashed:", err);
    }
  });

  redirect("/request/success");
}
