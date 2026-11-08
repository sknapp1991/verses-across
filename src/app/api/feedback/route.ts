/**
 * Feedback reports from the in-app form (src/components/feedback-dialog.tsx). Each report is saved as
 * one JSON file in the private R2 bucket bound as FEEDBACK (Cloudflare dashboard → R2 →
 * versesacross-feedback, one folder per day). The visitor's IP address is used only for the rate limit
 * and is not stored.
 *
 * Each report is also emailed (binding FEEDBACK_MAIL, Cloudflare Email Sending, Workers Paid plan) from
 * feedback@versesacross.com to the address in the secret FEEDBACK_TO, at most 50 a day.
 * Reports are anonymous (no name or email is asked for). If the email can't be sent, the report is still saved.
 *
 * Each report is also queued in D1 (STATS_DB, table feedback_queue, data/feedback/schema.sql) for the
 * once-a-day triage into the Ideas & Bugs sheet. Spam checks (spamReason below): a hidden "website"
 * field only bots fill in, a form sent within 2.5 s of opening, too many links, common spam words,
 * or the same message again within a day. Spam is still saved (marked) but not emailed; the reply looks
 * the same either way, so a bot learns nothing.
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
type D1 = {
  prepare(q: string): { bind(...v: unknown[]): { run(): Promise<unknown>; first<T = Record<string, unknown>>(): Promise<T | null> } };
};

const SPAM_WORDS =
  /\b(casino|viagra|cialis|porn|crypto ?(signals?|airdrop)|forex|bitcoin investment|seo (services?|agency)|backlinks?|guest post|payday loan|onlyfans|web ?design services|rank (your|on) google)\b/i;

/** Why this looks like spam, or null. Cheap checks only; the daily triage looks at everything again. */
async function spamReason(message: string, page: string, body: Record<string, unknown>, db: D1 | undefined, day: string): Promise<string | null> {
  if (typeof body.website === "string" && body.website.trim()) return "hidden field filled";
  const ms = Number(body.openMs);
  if (Number.isFinite(ms) && ms >= 0 && ms < 2500) return "sent too fast";
  if ((message.match(/https?:\/\/|www\./gi) ?? []).length > 3) return "too many links";
  if (SPAM_WORDS.test(message)) return "spam words";
  // A repeat: the same longer message on the same page today (short ones like "verse missing" are
  // normal for different people to send).
  if (db && message.length > 40) {
    const dup = await db
      .prepare("SELECT id FROM feedback_queue WHERE message = ? AND page = ? AND received >= ? LIMIT 1")
      .bind(message, page, `${day}T00:00:00`)
      .first()
      .catch(() => null);
    if (dup) return "repeat of an earlier report";
  }
  return null;
}

const TOPICS = new Set(["text", "audio", "bug", "idea", "other"]);
const clip = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : "");

export async function POST(request: Request) {
  let env: { FEEDBACK?: Bucket; FEEDBACK_LIMIT?: Limiter; FEEDBACK_MAIL?: Mailer; FEEDBACK_TO?: string; STATS_DB?: D1 } = {};
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
  const spam = await spamReason(message, report.page, body, env.STATS_DB, day);
  // Spam goes in its own folder, so it never counts toward the day's email cap.
  const key = `${spam ? "spam/" : ""}${day}/${now.toISOString().slice(11, 19).replace(/:/g, "")}-${report.topic}-${id}.json`;
  await env.FEEDBACK.put(key, JSON.stringify(spam ? { ...report, spam } : report, null, 2), { httpMetadata: { contentType: "application/json" } });
  // Queue it for the daily triage (best effort: the report is already saved).
  await env.STATS_DB?.prepare(
    "INSERT INTO feedback_queue (id, received, topic, message, page, r2key, spam, spam_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(id, report.received, String(report.topic), message, report.page, key, spam ? 1 : 0, spam)
    .run()
    .catch((e: Error) => console.error("feedback queue failed", id, e.message));
  // Email it too (best effort: the report is already saved).
  // What happened to the email, in the reply (no addresses): "sent", "off" (no binding or address set),
  // "limit" (daily cap reached) or the error code. Spam isn't emailed but gets the same reply.
  let mail = "off";
  if (spam) mail = "sent";
  else if (env.FEEDBACK_MAIL && env.FEEDBACK_TO) {
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
