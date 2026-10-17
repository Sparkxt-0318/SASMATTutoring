import { test } from "node:test";
import assert from "node:assert/strict";
import { explainEmailError } from "./email-errors";

test("known provider errors get a plain-English next step", () => {
  assert.match(
    explainEmailError("You can only send testing emails to your own email address (me@example.com).") ?? "",
    /Resend is still in test mode/,
  );
  assert.match(
    explainEmailError("Invalid login: 534-5.7.9 Application-specific password required.") ?? "",
    /app password/,
  );
  assert.match(
    explainEmailError("535 5.7.139 Authentication unsuccessful, basic authentication is disabled.") ?? "",
    /refused the login/,
  );
  assert.match(
    explainEmailError("Invalid login: 535-5.7.8 Username and Password not accepted.") ?? "",
    /username or password is wrong/,
  );
  assert.match(explainEmailError("getaddrinfo ENOTFOUND smtp.example.com") ?? "", /could not reach the mail server/);
});

test("Microsoft's basic auth error is not mistaken for a wrong password", () => {
  assert.match(
    explainEmailError("535 5.7.30 Basic authentication is not supported for Client Submission.") ?? "",
    /Microsoft no longer accepts a password/,
  );
});

test("unknown errors return null", () => {
  assert.equal(explainEmailError("Something odd happened"), null);
});
