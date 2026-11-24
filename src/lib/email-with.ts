"use client";
/**
 * Writing an email from the site (my brother's ticket 90d15e23, Nov 24): a mailto: link only opens the computer's own
 * mail app (Apple Mail on a Mac, even for someone who uses Gmail in the browser), and no site can tell which email a
 * person uses. So the first time, they pick: the mail app, Gmail, Outlook.com or Yahoo Mail; the choice is kept on
 * this device, and can be changed. The web ones open a new message in a new tab, with the subject and text filled in.
 */
export type MailWith = "app" | "gmail" | "outlook" | "yahoo";
const KEY = "va-mail-with:v1";

export const MAIL_CHOICES: { id: MailWith; label: string }[] = [
  { id: "gmail", label: "Gmail" },
  { id: "outlook", label: "Outlook.com" },
  { id: "yahoo", label: "Yahoo Mail" },
  { id: "app", label: "My mail app" },
];

export function mailWith(): MailWith | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "app" || v === "gmail" || v === "outlook" || v === "yahoo" ? v : null;
  } catch {
    return null;
  }
}
export function setMailWith(v: MailWith | null) {
  try {
    if (v) localStorage.setItem(KEY, v);
    else localStorage.removeItem(KEY);
  } catch {
    /* fine without */
  }
}

/** Open a new message (to nobody yet) with this subject and text, in the chosen email. */
export function openEmail(how: MailWith, subject: string, body: string) {
  const s = encodeURIComponent(subject);
  const b = encodeURIComponent(body);
  if (how === "app") {
    window.location.assign(`mailto:?subject=${s}&body=${b}`);
    return;
  }
  const url =
    how === "gmail"
      ? `https://mail.google.com/mail/?view=cm&fs=1&su=${s}&body=${b}`
      : how === "outlook"
        ? `https://outlook.live.com/mail/0/deeplink/compose?subject=${s}&body=${b}`
        : `https://compose.mail.yahoo.com/?subject=${s}&body=${b}`;
  window.open(url, "_blank", "noopener");
}
