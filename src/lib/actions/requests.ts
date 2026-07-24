"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { sendRequestBlast } from "@/lib/blast";
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
    availability: String(formData.get("availability") ?? ""),
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

  // Duplicate guard: same student + course submitted moments ago → treat as
  // the same request instead of blasting members twice.
  const recentDuplicate = await prisma.tutoringRequest.findFirst({
    where: {
      studentEmail: parsed.data.studentEmail,
      subject: parsed.data.subject,
      status: { in: ["OPEN", "CLAIMED"] },
      createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MINUTES * 60 * 1000) },
    },
  });
  if (recentDuplicate) {
    redirect("/request/success");
  }

  const request = await prisma.tutoringRequest.create({ data: parsed.data });
  await sendRequestBlast(request.id);

  redirect("/request/success");
}
