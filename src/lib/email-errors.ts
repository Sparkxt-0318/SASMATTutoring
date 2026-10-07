/**
 * Turns the raw error from the mail provider into a plain-English explanation
 * with the next step. Returns null when the error is not one we recognize (the
 * raw text is always shown too).
 */
export function explainEmailError(raw: string): string | null {
  const text = raw.toLowerCase();

  if (/only send testing emails to your own email/.test(text)) {
    return "Resend is still in test mode, so it only delivers to the address your Resend account was created with. To email anyone else, switch the site to a normal mailbox: set EMAIL_PROVIDER to smtp and fill in the SMTP settings (see the README), or verify a domain in Resend.";
  }
  if (/api key/.test(text) && /(invalid|missing|not found|restricted)/.test(text)) {
    return "The Resend API key is missing or wrong. Check RESEND_API_KEY in Vercel, or switch to SMTP.";
  }
  if (/application-specific password|534-5\.7\.9/.test(text)) {
    return "Gmail needs an app password, not your normal password. Turn on 2-step verification for the account, create an app password, and use it as SMTP_PASSWORD.";
  }
  if (/basic authentication is disabled|smtpclientauthentication|5\.7\.57|5\.7\.139|535 5\.7\.3|authentication unsuccessful/.test(text)) {
    return "The mail provider refused the login. Schools often turn off password and app-password sign-in on Microsoft 365. Try a club Gmail account instead (smtp.gmail.com with an app password).";
  }
  if (/username and password not accepted|invalid login|535/.test(text)) {
    return "The mail provider says the username or password is wrong. Check SMTP_USER and SMTP_PASSWORD in Vercel (use an app password), then redeploy.";
  }
  if (/enotfound|econnrefused|etimedout|econnreset|getaddrinfo|socket timeout|connection timeout/.test(text)) {
    return "The site could not reach the mail server. Check SMTP_HOST and SMTP_PORT (587 for most providers) in Vercel, then redeploy.";
  }
  if (/smtp is not set up/.test(text)) {
    return "SMTP is switched on but not fully filled in. Set SMTP_HOST, SMTP_USER and SMTP_PASSWORD in Vercel, then redeploy.";
  }
  if (/rate|throttl|too many|4\.7\.|421|450|451/.test(text)) {
    return "The mail provider is slowing us down because too many emails were sent at once. Wait a few minutes and try again.";
  }
  return null;
}
