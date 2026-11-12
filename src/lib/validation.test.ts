import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { requestSchema } from "./validation";

// Freeze "now" at 2028-02-01 noon Shanghai time, so the 60-day window covers February 2028.
mock.timers.enable({ apis: ["Date"], now: new Date("2028-02-01T12:00:00+08:00") });

const valid = {
  studentName: "Jane Doe",
  studentEmail: "jane01px2030@saschina.org",
  gradeLevel: "10",
  subject: "IM1",
  topic: "Factoring quadratics before the unit test",
  receivedTeacherHelp: "No",
  meetingDate: "2028-02-10",
  startTime: "15:30",
  endTime: "16:30",
};

function firstIssue(overrides: Partial<typeof valid>) {
  const result = requestSchema.safeParse({ ...valid, ...overrides });
  assert.equal(result.success, false);
  const issue = result.error!.issues[0];
  return { path: issue.path.join("."), message: issue.message };
}

test("a normal request passes", () => {
  assert.equal(requestSchema.safeParse(valid).success, true);
});

test("impossible dates are refused, a real leap day is not (#10)", () => {
  for (const meetingDate of ["2026-02-31", "2026-02-29"]) {
    assert.deepEqual(firstIssue({ meetingDate }), { path: "meetingDate", message: "Please pick a valid date." });
  }
  assert.equal(requestSchema.safeParse({ ...valid, meetingDate: "2028-02-29" }).success, true);
});

test("sessions under 15 minutes and end before start are refused", () => {
  assert.deepEqual(firstIssue({ endTime: "15:40" }), {
    path: "endTime",
    message: "Sessions need to be at least 15 minutes.",
  });
  assert.equal(firstIssue({ endTime: "15:00" }).path, "endTime");
});

test("only school email addresses are accepted", () => {
  assert.equal(firstIssue({ studentEmail: "jane@gmail.com" }).path, "studentEmail");
});
