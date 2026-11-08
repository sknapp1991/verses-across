/**
 * Feedback reports from the in-app form (src/components/feedback-dialog.tsx). Each report is saved as
 * one JSON file in the private R2 bucket bound as FEEDBACK (Cloudflare dashboard → R2 →
 * versesacross-feedback, one folder per day). The visitor's IP address is used only for the rate limit
 * and is not stored.
 *
 * Each report is also emailed (binding FEEDBACK_MAIL, Cloudflare Email Sending, Workers Paid plan) from
 * feedback@versesacross.com to the address in the secret FEEDBACK_TO, at most 50 a day.
 * Reports are anonymous (no name or email is asked for). If the email can't be sent, the report is still saved.
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";

type Bucket = {
  put(key: string, value: string, opts?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  list(opts: { prefix: string; limit: number }): Promise<{ objects: unknown[] }>;
};
type Mail = { to: string; from: { email: string; name: string }; subject: string; text: string };
type Mailer = { send(message: Mail): Promise<{ messageId: string }> };
const FROM = "feedback@versesacross.com";
const MAX_EMAILS_A_DAY = 50;
const TOPIC_NAME: Record<string, string> = { text: "Text mistake", audio: "Audio", bug: "Bug", idea: "Idea", other: "Feedback" };

/** A plain-text email for one report, to the owner (FEEDBACK_TO). */
function emailFor(report: { id: string; topic: string; message: string; contact: string | null; page: string; details: unknown; received: string }, to: string): Mail {
  const first = report.message.replace(/\s+/g, " ").slice(0, 60);
  const subject = `[Verses Across] ${TOPIC_NAME[report.topic] ?? "Feedback"}: ${first}${report.message.length > 60 ? "…" : ""}`;
  const body = [
    report.message,
    "",
    "—",
    `Topic: ${TOPIC_NAME[report.topic] ?? report.topic}`,
    `Page: ${report.page || "(not given)"}`,
    `Report ${report.id}, received ${report.received}`,
    report.details ? `\nDetails:\n${JSON.stringify(report.details, null, 2).slice(0, 8000)}` : "",
  ].join("\n");
  return { to, from: { email: FROM, name: "Verses Across feedback" }, subject, text: body };
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
    contact: null, // anonymous: no contact address is taken
    page: clip(body.page, 500),
    details: body.details && typeof body.details === "object" ? body.details : null,
  };
  const day = now.toISOString().slice(0, 10);
  const key = `${day}/${now.toISOString().slice(11, 19).replace(/:/g, "")}-${report.topic}-${id}.json`;
  await env.FEEDBACK.put(key, JSON.stringify(report, null, 2), { httpMetadata: { contentType: "application/json" } });
  // Email it too (best effort: the report is already saved).
  // What happened to the email, in the reply (no addresses): "sent", "off" (no binding or address set),
  // "limit" (daily cap reached) or the error code.
  let mail = "off";
  if (env.FEEDBACK_MAIL && env.FEEDBACK_TO) {
    try {
      const today = await env.FEEDBACK.list({ prefix: `${day}/`, limit: MAX_EMAILS_A_DAY + 1 });
      if (today.objects.length <= MAX_EMAILS_A_DAY) {
        await env.FEEDBACK_MAIL.send(emailFor({ ...report, topic: String(report.topic) }, env.FEEDBACK_TO));
        mail = "sent";
      } else mail = "limit";
    } catch (e) {
      mail = (e as { code?: string }).code ?? "error";
      console.error("feedback email failed", id, mail, (e as Error).message);
    }
  } else mail = env.FEEDBACK_MAIL ? "off: no address" : "off: no binding";
  return Response.json({ ok: true, id, mail }, { headers: { "cache-control": "no-store" } });
}
