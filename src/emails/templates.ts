import { formatMeeting, formatMinutes, meetingMinutes, minutesToHours } from "@/lib/constants";
import { button, detailRows, emailShell, escapeHtml, heading, paragraph } from "./layout";

interface RequestInfo {
  studentName: string;
  studentEmail: string;
  gradeLevel: string;
  subject: string;
  topic: string;
  meetingStart: Date;
  meetingEnd: Date;
}

function truncate(text: string, max = 300): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function meetingLabel(request: RequestInfo): string {
  const length = formatMinutes(meetingMinutes(request.meetingStart, request.meetingEnd));
  return `${formatMeeting(request.meetingStart, request.meetingEnd)} (${length})`;
}

/** 1. Blast to every active member. Deliberately excludes student contact info. */
export function requestBlastEmail(request: RequestInfo, claimUrl: string) {
  const subject = `New tutoring request: ${request.subject} (grade ${request.gradeLevel})`;
  const html = emailShell(
    subject,
    [
      heading("New tutoring request"),
      paragraph(
        "A student is looking for help. First member to confirm gets the session. Claim it only if you can make the meeting time.",
      ),
      detailRows([
        ["Course", request.subject],
        ["Grade", request.gradeLevel],
        ["Topic", truncate(request.topic)],
        ["Meeting time", meetingLabel(request)],
      ]),
      button("Claim this request", claimUrl),
      paragraph(
        `<span style="font-size:13px;color:#86868b;">This link is personal to you, so don't forward it. The student's contact details are shared with whoever claims first. Times are Shanghai time.</span>`,
      ),
    ].join(""),
  );
  return { subject, html };
}

/** 2. Confirmation to the winning tutor, with full student contact info. */
export function tutorConfirmationEmail(request: RequestInfo, tutorName: string) {
  const subject = `You claimed: ${request.subject} for ${request.studentName}`;
  const html = emailShell(
    subject,
    [
      heading("It's yours! 🎉"),
      paragraph(
        `Hi ${escapeHtml(tutorName)}, you claimed this request. Please email ${escapeHtml(request.studentName)} within 24 hours to confirm the time and pick a spot to meet.`,
      ),
      detailRows([
        ["Student", request.studentName],
        ["Email", request.studentEmail],
        ["Course", request.subject],
        ["Grade", request.gradeLevel],
        ["Topic", request.topic],
        ["Meeting time", meetingLabel(request)],
      ]),
      paragraph(
        `<span style="font-size:13px;color:#86868b;">There's nothing to log afterwards. Officers record tutoring hours themselves every weekend, using the meeting time above.</span>`,
      ),
    ].join(""),
  );
  return { subject, html };
}

/** 3. Intro to the student once a tutor claims. */
export function studentIntroEmail(request: RequestInfo, tutorName: string, tutorEmail: string) {
  const subject = `Your MAT tutor: ${tutorName}`;
  const html = emailShell(
    subject,
    [
      heading("You've got a tutor"),
      paragraph(
        `Hi ${escapeHtml(request.studentName)}, <strong>${escapeHtml(tutorName)}</strong> from Mu Alpha Theta will be your tutor for <strong>${escapeHtml(request.subject)}</strong>.`,
      ),
      detailRows([
        ["Your tutor", tutorName],
        ["Their email", tutorEmail],
        ["Your request", request.topic],
        ["Meeting time", meetingLabel(request)],
      ]),
      paragraph(
        `${escapeHtml(tutorName)} will reach out soon to confirm where to meet, or you can email them directly (just reply to this email).`,
      ),
    ].join(""),
  );
  return { subject, html };
}

export interface DigestMemberRow {
  name: string;
  totalMinutes: number;
  sessionCount: number;
  weekMinutes: number;
}

export interface DigestData {
  totalMinutesAllTime: number;
  totalSessionsAllTime: number;
  weekMinutes: number;
  /** Claimed sessions whose meeting time has passed but haven't been credited yet. */
  awaitingCreditCount: number;
  members: DigestMemberRow[];
}

/** 4. Weekly digest, sent ONLY to REPORT_EMAIL. */
export function weeklyDigestEmail(data: DigestData) {
  const subject = `MAT weekly hours: ${minutesToHours(data.totalMinutesAllTime)}h total`;

  const memberRows = data.members
    .map(
      (m) => `<tr>
        <td style="padding:9px 0;font-size:14px;color:#1d1d1f;border-bottom:1px solid #e8e8ed;">${escapeHtml(m.name)}</td>
        <td style="padding:9px 0;font-size:14px;color:#1d1d1f;text-align:right;border-bottom:1px solid #e8e8ed;">${minutesToHours(m.totalMinutes)}h</td>
        <td style="padding:9px 0;font-size:14px;color:#6e6e73;text-align:right;border-bottom:1px solid #e8e8ed;">${m.sessionCount}</td>
        <td style="padding:9px 0;font-size:14px;color:${m.weekMinutes > 0 ? "#0071e3" : "#86868b"};text-align:right;border-bottom:1px solid #e8e8ed;">${m.weekMinutes > 0 ? `+${formatMinutes(m.weekMinutes)}` : "0"}</td>
      </tr>`,
    )
    .join("");

  const html = emailShell(
    subject,
    [
      heading("Weekly tutoring report"),
      `<div style="margin:20px 0;padding:24px;background-color:#f5f5f7;border-radius:16px;text-align:center;">
        <p style="margin:0;font-size:13px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;color:#6e6e73;">All-time total, all members</p>
        <p style="margin:6px 0 0;font-size:44px;font-weight:700;letter-spacing:-0.03em;color:#1d1d1f;">${minutesToHours(data.totalMinutesAllTime)}<span style="font-size:22px;font-weight:500;color:#6e6e73;"> hours</span></p>
        <p style="margin:6px 0 0;font-size:13px;color:#6e6e73;">${data.totalSessionsAllTime} credited session${data.totalSessionsAllTime === 1 ? "" : "s"} · ${data.weekMinutes > 0 ? `+${formatMinutes(data.weekMinutes)} this week` : "no new hours this week"}</p>
      </div>`,
      data.awaitingCreditCount > 0
        ? paragraph(
            `⏳ <strong>${data.awaitingCreditCount} session${data.awaitingCreditCount === 1 ? "" : "s"} waiting for credit</strong>. Record them in the admin dashboard's Hours tab during your weekend check.`,
          )
        : "",
      `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top:8px;">
        <thead>
          <tr>
            <th style="padding:9px 0;font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#6e6e73;text-align:left;border-bottom:1px solid #d2d2d7;">Member</th>
            <th style="padding:9px 0;font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#6e6e73;text-align:right;border-bottom:1px solid #d2d2d7;">Hours</th>
            <th style="padding:9px 0;font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#6e6e73;text-align:right;border-bottom:1px solid #d2d2d7;">Sessions</th>
            <th style="padding:9px 0;font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#6e6e73;text-align:right;border-bottom:1px solid #d2d2d7;">This week</th>
          </tr>
        </thead>
        <tbody>${memberRows}</tbody>
      </table>`,
    ].join(""),
  );
  return { subject, html };
}

/** 5. Operational alert to the officer inbox (blast failures etc.). */
export function adminAlertEmail(title: string, message: string) {
  const subject = `[MAT Tutoring] ${title}`;
  const html = emailShell(subject, [heading(title), paragraph(escapeHtml(message))].join(""));
  return { subject, html };
}
