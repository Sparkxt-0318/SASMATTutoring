import { CLUB_NAME, SCHOOL_NAME } from "@/lib/constants";

/**
 * Shared wrapper for all transactional emails. Table-based layout and inline
 * styles for broad email-client compatibility.
 */
export function emailShell(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f7;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:18px;overflow:hidden;">
          <tr>
            <td style="padding:28px 40px 0 40px;">
              <p style="margin:0;font-size:13px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#6e6e73;">${escapeHtml(CLUB_NAME)} · Tutoring</p>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 40px 36px 40px;">
              ${bodyHtml}
            </td>
          </tr>
        </table>
        <p style="max-width:560px;margin:20px auto 0;font-size:12px;line-height:1.5;color:#86868b;text-align:center;">
          ${escapeHtml(CLUB_NAME)} at ${escapeHtml(SCHOOL_NAME)}.<br/>
          Something look wrong? Just reply to this email.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function button(label: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0;">
    <tr>
      <td style="border-radius:980px;background-color:#0071e3;">
        <a href="${url}" style="display:inline-block;padding:13px 28px;font-size:16px;font-weight:500;color:#ffffff;text-decoration:none;border-radius:980px;">${escapeHtml(label)}</a>
      </td>
    </tr>
  </table>`;
}

export function heading(text: string): string {
  return `<h1 style="margin:8px 0 16px;font-size:26px;line-height:1.2;font-weight:700;letter-spacing:-0.02em;color:#1d1d1f;">${escapeHtml(text)}</h1>`;
}

export function paragraph(html: string): string {
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#424245;">${html}</p>`;
}

export function detailRows(rows: Array<[string, string]>): string {
  const cells = rows
    .map(
      ([label, value]) => `<tr>
        <td style="padding:9px 16px 9px 0;font-size:13px;font-weight:600;color:#6e6e73;white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</td>
        <td style="padding:9px 0;font-size:14px;line-height:1.5;color:#1d1d1f;">${escapeHtml(value)}</td>
      </tr>`,
    )
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0;padding:4px 20px;background-color:#f5f5f7;border-radius:12px;width:100%;"><tbody>${cells}</tbody></table>`;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
