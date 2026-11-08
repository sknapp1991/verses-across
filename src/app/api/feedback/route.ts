/**
 * Feedback reports from the in-app form (src/components/feedback-dialog.tsx). Each report is saved as
 * one JSON file in the private R2 bucket bound as FEEDBACK (Cloudflare dashboard → R2 →
 * versesacross-feedback, one folder per day). The visitor's IP address is used only for the rate limit
 * and is not stored.
 *
 * Each report is also emailed (binding FEEDBACK_MAIL, Cloudflare Email Routing) from feedback@versesacross.com
 * to the address in the secret FEEDBACK_TO, at most 50 a day; Reply goes to the reader when they left an
 * email address. If the email can't be sent, the report is still saved.
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";

type Bucket = {
  put(key: string, value: string, opts?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  list(opts: { prefix: string; limit: number }): Promise<{ objects: unknown[] }>;
};
type Mailer = { send(message: unknown): Promise<void> };
const FROM = "feedback@versesacross.com";
/** The site's address each topic goes to (shown in the email's To line, so Gmail files it under that label). */
const TOPIC_ADDRESS: Record<string, string> = { text: "feedback@versesacross.com", audio: "feedback@versesacross.com", bug: "feedback@versesacross.com", idea: "feedback@versesacross.com", other: "contact@versesacross.com" };
const MAX_EMAILS_A_DAY = 50;
const TOPIC_NAME: Record<string, string> = { text: "Text mistake", audio: "Audio", bug: "Bug", idea: "Idea", other: "Feedback" };

/**
 * A subject line any mail app shows correctly: plain when it is plain ASCII, otherwise encoded in short
 * pieces (RFC 2047 keeps each encoded word to 75 characters), one per folded line.
 */
function encodeSubject(subject: string, b64: (s: string) => string) {
  if (/^[\x20-\x7e]*$/.test(subject)) return subject;
  const words: string[] = [];
  let cur = "";
  for (const ch of subject) {
    if (new TextEncoder().encode(cur + ch).length > 42) {
      words.push(`=?UTF-8?B?${b64(cur)}?=`);
      cur = "";
    }
    cur += ch;
  }
  if (cur) words.push(`=?UTF-8?B?${b64(cur)}?=`);
  return words.join("\r\n ");
}

/** A plain-text email (RFC 5322) for one report. */
function emailFor(report: { id: string; topic: string; message: string; contact: string | null; page: string; details: unknown; received: string }) {
  // The envelope goes to the owner (FEEDBACK_TO); the To line names the site address for the topic.
  const first = report.message.replace(/\s+/g, " ").slice(0, 60);
  const subject = `[Verses Across] ${TOPIC_NAME[report.topic] ?? "Feedback"}: ${first}${report.message.length > 60 ? "…" : ""}`;
  const b64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
  const replyTo = report.contact && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(report.contact) ? report.contact : null;
  const body = [
    report.message,
    "",
    "—",
    `Topic: ${TOPIC_NAME[report.topic] ?? report.topic}`,
    `Page: ${report.page || "(not given)"}`,
    `Contact: ${report.contact ?? "(none)"}`,
    `Report ${report.id}, received ${report.received}`,
    report.details ? `\nDetails:\n${JSON.stringify(report.details, null, 2).slice(0, 8000)}` : "",
  ].join("\n");
  return [
    `From: Verses Across feedback <${FROM}>`,
    `To: <${TOPIC_ADDRESS[report.topic] ?? FROM}>`,
    ...(replyTo ? [`Reply-To: <${replyTo}>`] : []),
    `Subject: ${encodeSubject(subject, b64)}`,
    `Message-ID: <${report.id}.${Date.now()}@versesacross.com>`,
    `Date: ${new Date(report.received).toUTCString()}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    b64(body).replace(/.{76}/g, "$&\r\n"),
  ].join("\r\n");
}
type Limiter = { limit(o: { key: string }): Promise<{ success: boolean }> };

const TOPICS = new Set(["text", "audio", "bug", "idea", "other"]);
const clip = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : "");

export async function POST(request: Request) {
  let env: { FEEDBACK?: Bucket; FEEDBACK_LIMIT?: Limiter; FEEDBACK_MAIL?: Mailer; FEEDBACK_TO?: string } = {};
  try {
    env = getCloudflareContext().env as unknown as typeof env;
  } catch {
    /* not on Cloudflare */
  }
  if (!env.FEEDBACK) return Response.json({ error: "Feedback storage isn’t set up." }, { status: 503 });

  const ip = request.headers.get("cf-connecting-ip") ?? "local";
  if (env.FEEDBACK_LIMIT && !(await env.FEEDBACK_LIMIT.limit({ key: ip }).catch(() => ({ success: true }))).success)
    return Response.json({ error: "Too many reports in a row. Please wait a minute and try again." }, { status: 429 });

  const raw = await request.text();
  if (raw.length > 40_000) return Response.json({ error: "That report is too long." }, { status: 413 });
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }
  const message = clip(body.message, 5000).trim();
  if (!message) return Response.json({ error: "Please write what happened." }, { status: 400 });

  const now = new Date();
  const id = crypto.randomUUID().slice(0, 8);
  const report = {
    id,
    received: now.toISOString(),
    topic: TOPICS.has(body.topic as string) ? body.topic : "other",
    message,
    contact: clip(body.contact, 200).trim() || null,
    page: clip(body.page, 500),
    details: body.details && typeof body.details === "object" ? body.details : null,
  };
  const day = now.toISOString().slice(0, 10);
  const key = `${day}/${now.toISOString().slice(11, 19).replace(/:/g, "")}-${report.topic}-${id}.json`;
  await env.FEEDBACK.put(key, JSON.stringify(report, null, 2), { httpMetadata: { contentType: "application/json" } });
  // Email it too (best effort: the report is already saved).
  if (env.FEEDBACK_MAIL && env.FEEDBACK_TO) {
    try {
      const today = await env.FEEDBACK.list({ prefix: `${day}/`, limit: MAX_EMAILS_A_DAY + 1 });
      if (today.objects.length <= MAX_EMAILS_A_DAY) {
        // Workers' EmailMessage (not something the Next.js bundle can see: imported when it runs).
        const mod = "cloudflare:email"; // a Workers built-in, loaded by name when the request runs
        const { EmailMessage } = (await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ mod)) as {
          EmailMessage: new (from: string, to: string, raw: string) => unknown;
        };
        await env.FEEDBACK_MAIL.send(new EmailMessage(FROM, env.FEEDBACK_TO, emailFor({ ...report, topic: String(report.topic) })));
      }
    } catch (e) {
      console.error("feedback email failed", e);
    }
  }
  return Response.json({ ok: true, id }, { headers: { "cache-control": "no-store" } });
}
