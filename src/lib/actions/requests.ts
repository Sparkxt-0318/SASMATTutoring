"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { sendRequestBlast } from "@/lib/blast";
import { shanghaiDateTime } from "@/lib/constants";
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

  const request = await prisma.tutoringRequest.create({
    data: {
      ...rest,
      meetingStart: shanghaiDateTime(meetingDate, startTime),
      meetingEnd: shanghaiDateTime(meetingDate, endTime),
      receivedTeacherHelp: receivedTeacherHelp === "Yes",
    },
  });
  await sendRequestBlast(request.id);

  redirect("/request/success");
}
