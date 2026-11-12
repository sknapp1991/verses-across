/**
 * Built-in AI study companion (src/components/ai-window.tsx). Two free models to choose from:
 *   - "gemini": Google Gemini, free tier (GEMINI_API_KEY secret)
 *   - "openai": OpenAI's open model gpt-oss-120b, run by Cloudflare Workers AI (the AI binding in
 *     wrangler.jsonc — no key; free daily allowance). Also the fallback when Gemini is out of quota.
 * - GET → { ready, providers }: which are set up (the app hides the AI button if none).
 * - POST → the answer, streamed as plain text.
 * The key (GEMINI_API_KEY, a Cloudflare Worker secret) never reaches the browser. Without billing
 * turned on for that Google project the free tier simply stops at its daily limit — it can't cost money.
 * Limits: Cloudflare rate-limit binding ASK_LIMIT (per visitor IP, see wrangler.jsonc), plus a small
 * per-instance fallback.
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { z } from "zod";
import { ASK_SYSTEM } from "@/lib/ai";

const body = z.object({
  context: z
    .object({
      reference: z.string().max(200),
      work: z.string().max(100),
      versions: z.array(z.object({ abbr: z.string().max(40), name: z.string().max(120), language: z.string().max(40) })).max(20),
      passage: z.string().max(30000),
    })
    .nullable()
    .optional(),
  verse: z
    .object({
      reference: z.string().max(200),
      texts: z.array(z.object({ abbr: z.string().max(40), name: z.string().max(120), language: z.string().max(40), text: z.string().max(4000) })).max(20),
    })
    .nullable()
    .optional(),
  messages: z.array(z.object({ role: z.enum(["user", "model"]), text: z.string().max(8000) })).min(1).max(30),
  provider: z.enum(["gemini", "openai"]).optional(),
  /** "deep": a longer, more thorough answer (more thinking, more room); slower. */
  depth: z.enum(["standard", "deep"]).optional(),
});

type WorkersAI = { run(model: string, input: unknown): Promise<unknown> };
const OPENAI_MODEL = "@cf/openai/gpt-oss-120b";

type Limiter = { limit(o: { key: string }): Promise<{ success: boolean }> };
const env = () => {
  try {
    return getCloudflareContext().env as unknown as { GEMINI_API_KEY?: string; GEMINI_MODEL?: string; ASK_LIMIT?: Limiter; AI?: WorkersAI };
  } catch {
    return {};
  }
};
const apiKey = () => env().GEMINI_API_KEY ?? process.env.GEMINI_API_KEY;

const WINDOW_MS = 60_000;
const LIMIT = 8;
const hits = new Map<string, number[]>();

const providers = () => [...(apiKey() ? ["gemini"] : []), ...(env().AI ? ["openai"] : [])];

export async function GET() {
  const list = providers();
  return Response.json({ ready: list.length > 0, providers: list }, { headers: { "cache-control": "no-store" } });
}

/** Lines of an SSE stream → plain text, picking the text out of each event's JSON with `pick`. */
function sseToText(body: ReadableStream<Uint8Array>, pick: (d: unknown) => string) {
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  let buf = "";
  const emit = (line: string, ctl: TransformStreamDefaultController<Uint8Array>) => {
    if (!line.startsWith("data:")) return;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") return;
    try {
      const t = pick(JSON.parse(data));
      if (t) ctl.enqueue(enc.encode(t));
    } catch {
      /* partial line */
    }
  };
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, ctl) {
        buf += dec.decode(chunk, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          emit(line, ctl);
        }
      },
      flush(ctl) {
        // A last event without a trailing newline would otherwise be dropped.
        buf += dec.decode();
        emit(buf.trim(), ctl);
        buf = "";
      },
    }),
  );
}
const textResponse = (body: ReadableStream<Uint8Array>) =>
  new Response(body, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });

/** OpenAI gpt-oss on Workers AI, streamed. Null when it isn't available or fails. */
async function askOpenAI(system: string, turns: { role: "user" | "model"; text: string }[], deep = false) {
  const ai = env().AI;
  if (!ai) return null;
  try {
    const out = await ai.run(OPENAI_MODEL, {
      messages: [
        { role: "system", content: system },
        ...turns.map((t) => ({ role: t.role === "model" ? "assistant" : "user", content: t.text })),
      ],
      stream: true,
      max_tokens: deep ? 8192 : 4096,
      reasoning: { effort: deep ? "medium" : "low" },
    });
    if (!(out instanceof ReadableStream)) return null;
    // Events are either Workers AI's {"response": "…"} or OpenAI-style {"choices":[{"delta":{"content":"…"}}]}.
    return textResponse(
      sseToText(out as ReadableStream<Uint8Array>, (d) => {
        const x = d as { response?: unknown; choices?: { delta?: { content?: unknown } }[] };
        if (typeof x.response === "string") return x.response;
        const c = x.choices?.[0]?.delta?.content;
        return typeof c === "string" ? c : "";
      }),
    );
  } catch (e) {
    console.error("workers-ai failed", String(e).slice(0, 300));
    return null;
  }
}

export async function POST(request: Request) {
  if (!providers().length) return Response.json({ error: "The AI isn’t set up on this site yet." }, { status: 503 });

  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  const limiter = env().ASK_LIMIT;
  let allowed = true;
  if (limiter) allowed = (await limiter.limit({ key: ip }).catch(() => ({ success: true }))).success;
  else {
    const now = Date.now();
    const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
    allowed = recent.length < LIMIT;
    if (allowed) hits.set(ip, [...recent, now]);
  }
  if (!allowed) return Response.json({ error: "That’s a lot of questions at once — please wait a minute and try again." }, { status: 429 });

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Bad request" }, { status: 400 });
  const { context, verse, messages, provider, depth } = parsed.data;
  const deep = depth === "deep";

  // The reader's screen goes in the system prompt, so follow-up questions keep it.
  const sys = [
    deep
      ? ASK_SYSTEM.replace(
          "Be concise (under 300 words unless asked for more).",
          "In-depth mode: give a thorough answer (about 600–1,000 words): the historical and literary context, the key original-language words, how the main traditions and scholars read it, and connections to related passages.",
        )
      : ASK_SYSTEM,
    "Format with short paragraphs; use **bold** sparingly and simple '-' lists when helpful (no tables). Give scripture references in the usual form (e.g. Numbers 21:4–9, Surah 2:255, MN 10).",
    // The app turns this line into tappable suggestion bubbles (src/components/ai-window.tsx).
    "End with one final line in exactly this form: 'Next: <follow-up question> | <follow-up question>' — two short questions (under 12 words each) the reader might like to explore next, written as the reader would ask them.",
  ];
  if (context) {
    sys.push(
      "",
      `The reader currently has ${context.reference} (${context.work}) open, in these versions: ${context.versions
        .map((v) => `${v.abbr} (${v.language}, ${v.name})`)
        .join("; ")}.`,
      "The passage on their screen (verse number, then each version's text):",
      context.passage,
    );
  }
  const turns = messages.slice(-16).map((m) => ({ role: m.role, parts: [{ text: m.text }] }));
  if (verse) {
    const last = turns[turns.length - 1];
    last.parts[0].text = [
      `About ${verse.reference}:`,
      ...verse.texts.map((t) => `- ${t.abbr} (${t.language}, ${t.name}): "${t.text}"`),
      "",
      last.parts[0].text,
    ].join("\n");
  }
  if (turns[0].role !== "user") turns.shift();

  const key = apiKey();
  const plain = turns.map((t) => ({ role: t.role, text: t.parts[0].text }));
  // OpenAI chosen (or no Gemini key): Workers AI.
  if (provider === "openai" || !key) {
    const r = await askOpenAI(sys.join("\n"), plain, deep);
    return r ?? Response.json({ error: "The OpenAI model is unavailable right now — try Gemini instead." }, { status: 502 });
  }

  // Free-tier models are sometimes "busy" (503) or out of quota (429): retry once, then fall back to
  // Google's rolling aliases. A model that doesn't exist for this key (404) is skipped too.
  const primary = env().GEMINI_MODEL ?? process.env.GEMINI_MODEL ?? "gemini-3.8-flash";
  const models = [primary, "gemini-flash-latest", "gemini-flash-lite-latest"];
  // Little "thinking" before answering: answers start in a few seconds instead of timing out.
  const payload = (thinking: boolean) =>
    JSON.stringify({
      systemInstruction: { parts: [{ text: sys.join("\n") }] },
      contents: turns,
      generationConfig: { temperature: 0.4, maxOutputTokens: deep ? 8192 : 4096, ...(thinking ? { thinkingConfig: { thinkingLevel: deep ? "medium" : "low" } } : {}) },
    });
  let upstream: Response | null = null;
  let answer: ReadableStream<Uint8Array> | null = null;
  let status = 0;
  let thinking = true;
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    // No answer text within 10 s (30 s in depth: it thinks longer first): don't leave the reader waiting (ticket
    // 7bccc422: answers took 20-50 s when the free model was slow; the OpenAI model starts in ~5 s). The timer
    // stops once the first piece of the answer arrives, so a long answer is never cut off.
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), deep ? 30_000 : 10_000);
    upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: payload(thinking),
      signal: ctl.signal,
    }).catch(() => null);
    if (upstream?.ok && upstream.body) {
      const reader = upstream.body.getReader();
      // Read until the answer's first words have arrived (an event with a "text" part), keeping what came so far.
      const head: Uint8Array[] = [];
      const dec = new TextDecoder();
      let seen = "";
      let ended = false;
      while (!/"text"\s*:/.test(seen)) {
        const r = await reader.read().catch(() => null);
        if (!r || r.done) {
          ended = true;
          break;
        }
        head.push(r.value);
        seen = (seen + dec.decode(r.value, { stream: true })).slice(-4000);
      }
      clearTimeout(timer);
      if (!ended && head.length) {
        answer = new ReadableStream<Uint8Array>({
          start(c) {
            for (const h of head) c.enqueue(h);
          },
          async pull(c) {
            const { done, value } = await reader.read();
            if (done) c.close();
            else c.enqueue(value);
          },
          cancel(reason) {
            return reader.cancel(reason);
          },
        });
        break;
      }
      void reader.cancel().catch(() => {});
      console.error("gemini failed", model, "no answer in time");
      upstream = null;
      status = 0;
      break; // slow: straight to the OpenAI model below
    }
    status = upstream?.status ?? 0;
    const detail = upstream ? (await upstream.text().catch(() => "")).slice(0, 300) : "network/timeout";
    clearTimeout(timer);
    console.error("gemini failed", model, status, detail);
    upstream = null;
    // This model doesn't accept the thinking setting: same model again without it.
    if (status === 400 && thinking && /thinking/i.test(detail)) {
      thinking = false;
      i--;
      continue;
    }
    if (status === 0) break; // slow or unreachable: go straight to the OpenAI model below instead of waiting on another Gemini
    if (![404, 429, 500, 502, 503, 504, 524].includes(status)) break; // bad request etc.: another model won't help
  }
  if (!answer) {
    // Gemini is busy or out of its free quota: answer with the OpenAI model instead, if it's there.
    const r = await askOpenAI(sys.join("\n"), plain, deep);
    if (r) return r;
    return Response.json(
      { error: status === 429 ? "The free AI has reached its limit for now — please try again later." : "The AI service is unavailable right now." },
      { status: status === 429 ? 429 : 502 },
    );
  }

  // Gemini SSE ("data: {json}" lines) → plain text chunks (its "thought" parts left out).
  return textResponse(
    sseToText(answer, (d) => {
      const x = d as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] };
      return x.candidates?.[0]?.content?.parts?.filter((p) => !p.thought).map((p) => p.text ?? "").join("") ?? "";
    }),
  );
}
