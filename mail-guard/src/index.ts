/**
 * Mail guard: sits in front of the @versesacross.com and @skylarknapp.com addresses (Cloudflare Email
 * Routing sends each address to this Worker instead of straight to Gmail).
 *
 * It rejects, with a polite bounce, mail that:
 *   - carries a risky attachment: SVG or HTML pages, scripts, programs and installers, macro-enabled
 *     Office files, shortcut/disk-image files, and archives (zip, rar, 7z…) that could hide any of those.
 *     SVG and HTML attachments are a common phishing trick: they open in the browser and can run code.
 *   - pretends to come from our own domains (hidden sender or visible From line) without passing DMARC,
 *     as checked by Cloudflare's own mail servers.
 * Everything else is forwarded to FORWARD_TO (a secret: Skylar's Gmail, never in the repo).
 *
 * The normal HTML body of an email is fine; only attachments are checked. Nothing is stored.
 */

type Email = {
  from: string;
  to: string;
  headers: Headers;
  raw: ReadableStream;
  rawSize: number;
  setReject(reason: string): void;
  forward(to: string, headers?: Headers): Promise<void>;
};
type Env = { FORWARD_TO?: string };

const OUR_DOMAINS = ["versesacross.com", "skylarknapp.com"];
const MAX_SIZE = 25 * 1024 * 1024; // Gmail's own limit

/** File types that can run code or hide something that can (checked on the attachment's file name). */
export const RISKY_EXT = new Set([
  // pages and images that can run script in a browser
  "svg", "svgz", "html", "htm", "shtml", "xhtml", "xht", "mht", "mhtml", "hta", "xsl", "url", "website",
  // scripts
  "js", "mjs", "jse", "vbs", "vbe", "wsf", "wsh", "wsc", "ps1", "psm1", "bat", "cmd", "sh", "py", "pl", "rb", "php", "jar", "sct", "scf",
  // programs and installers
  "exe", "com", "scr", "pif", "msi", "msix", "msp", "appx", "appxbundle", "dll", "cpl", "ocx", "sys", "drv", "apk", "dmg", "pkg", "app", "deb", "rpm", "reg", "chm", "inf", "lnk", "library-ms", "search-ms", "settingcontent-ms", "application", "gadget",
  // macro-enabled Office and other document tricks
  "docm", "dotm", "xlsm", "xltm", "xlam", "xll", "pptm", "potm", "ppam", "sldm", "one", "onepkg", "iqy", "slk", "pub",
  // disk images and archives (could hide any of the above)
  "iso", "img", "vhd", "vhdx", "udf", "zip", "zipx", "rar", "7z", "cab", "gz", "tgz", "bz2", "xz", "tar", "arj", "lzh", "ace",
]);
/** Content types that are risky as attachments even without a telling file name. */
const RISKY_TYPES = /^(image\/svg\+xml|text\/html|application\/(xhtml\+xml|x-msdownload|x-dosexec|x-msdos-program|javascript|x-javascript|ecmascript|hta|x-ms-shortcut|java-archive|x-sh|x-bat|vnd\.microsoft\.portable-executable|zip|x-zip-compressed|x-rar-compressed|vnd\.rar|x-7z-compressed|gzip|x-iso9660-image|vnd\.ms-(word|excel|powerpoint)[^;]*macroenabled[^;]*))\b/i;

/** Invisible and direction-changing characters (used to make "evil<RLO>gpj.exe" look like a .jpg), and control characters. */
const HIDDEN_CHARS = /[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩﻿]/g;

/** Decode RFC 2047 encoded words in a header value (=?utf-8?B?...?= / =?utf-8?Q?...?=) well enough to read a file name. */
function decodeWords(v: string): string {
  // Encoded words next to each other are one piece of text ("=?..?B?ZXZpbC5z?= =?..?B?dmc=?=" is "evil.svg").
  const joined = v.replace(/\?=\s+=\?/g, "?==?");
  return joined.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_m: string, _cs: string, enc: string, text: string) => {
    try {
      const bytes =
        enc.toUpperCase() === "B"
          ? Uint8Array.from(atob(text), (c) => c.charCodeAt(0))
          : new TextEncoder().encode(text.replace(/_/g, " ").replace(/=([0-9A-F]{2})/gi, (_x: string, h: string) => String.fromCharCode(parseInt(h, 16))));
      return new TextDecoder().decode(bytes);
    } catch {
      return text;
    }
  });
}

type Part = { type: string; disposition: string; name: string; encoding: string };

/** Every MIME part's headers (Content-Type / Content-Disposition / Content-Transfer-Encoding), unfolded. */
export function partHeaders(raw: string): Part[] {
  const parts: Part[] = [];
  // A part's header block starts after a boundary line (or at the top) and ends at the first blank line.
  const blocks = raw.split(/\r?\n--[^\r\n]+\r?\n/);
  for (const b of blocks) {
    const head = b.split(/\r?\n\r?\n/)[0].replace(/\r?\n[ \t]+/g, " ");
    const get = (h: string) => new RegExp(`^${h}:\\s*(.*)$`, "im").exec(head)?.[1] ?? "";
    const type = get("Content-Type");
    const disposition = get("Content-Disposition");
    if (!type && !disposition) continue;
    // filename= / name= / filename*=utf-8''… (RFC 2231)
    const p = `${disposition}; ${type}`;
    let name =
      /filename\*\s*=\s*[^']*'[^']*'([^;]+)/i.exec(p)?.[1] ??
      /filename\s*=\s*"([^"]*)"/i.exec(p)?.[1] ??
      /filename\s*=\s*([^;\s]+)/i.exec(p)?.[1] ??
      /name\s*=\s*"([^"]*)"/i.exec(p)?.[1] ??
      /name\s*=\s*([^;\s]+)/i.exec(p)?.[1] ??
      "";
    try {
      name = decodeURIComponent(name);
    } catch {
      /* keep as is */
    }
    // Hidden characters removed, then trailing dots and spaces ("evil.svg." still ends in svg).
    const clean = decodeWords(name).replace(HIDDEN_CHARS, "").replace(/[\s.]+$/, "").trim();
    parts.push({ type: type.toLowerCase(), disposition: disposition.toLowerCase(), name: clean, encoding: get("Content-Transfer-Encoding").toLowerCase() });
  }
  return parts;
}

/** The Authentication-Results header Cloudflare's mail servers added (not any the sender put in), unfolded. */
export function cloudflareAuth(raw: string): string {
  const head = raw.split(/\r?\n\r?\n/)[0].replace(/\r?\n[ \t]+/g, " ");
  for (const line of head.split(/\r?\n/)) {
    const m = /^Authentication-Results:\s*(.*)$/i.exec(line);
    if (m && /^mx\.cloudflare\.net\b/i.test(m[1].trim())) return m[1];
  }
  return "";
}

/** Why this message is refused, or null to let it through. */
export function verdict(raw: string, from: string, headerFrom = ""): string | null {
  for (const part of partHeaders(raw)) {
    // A forwarded email wrapped in base64 / quoted-printable could hide its attachments from this check
    // (and isn't allowed by the email standard anyway).
    if (part.type.startsWith("message/rfc822") && /base64|quoted-printable/.test(part.encoding))
      return "forwarded emails in that encoding are not accepted at this address";
    const isAttachment = part.disposition.startsWith("attachment") || !!part.name;
    if (!isAttachment) continue; // the message's own text/HTML body is fine
    const ext = part.name.toLowerCase().match(/\.([a-z0-9-]+)$/)?.[1] ?? "";
    // Double extensions like "invoice.pdf.exe" end in the risky one.
    if (ext && RISKY_EXT.has(ext)) return `attachments of type .${ext} are not accepted at this address`;
    if (RISKY_TYPES.test(part.type)) return `attachments of type ${part.type.split(";")[0]} are not accepted at this address`;
  }
  // Mail claiming to be from our own domains (the hidden sender or the visible From line) must pass DMARC,
  // as checked by Cloudflare on the way in. Only Cloudflare's own result counts: a sender can add their own
  // "Authentication-Results" lines, so we read the one stamped by mx.cloudflare.net.
  const domainOf = (a: string) => ((/<([^>]+)>/.exec(a)?.[1] ?? a).trim().split("@").pop() ?? "").replace(/[>\s]/g, "").toLowerCase();
  const ours = (d: string) => OUR_DOMAINS.some((o) => d === o || d.endsWith("." + o));
  if ((ours(domainOf(from)) || ours(domainOf(headerFrom))) && !/dmarc=pass/i.test(cloudflareAuth(raw)))
    return "this message claims to be from our own domain but failed its authenticity checks";
  return null;
}

export default {
  async email(message: Email, env: Env) {
    if (!env.FORWARD_TO) {
      // Never drop mail silently: without a destination, bounce so the sender knows.
      message.setReject("This address can't take mail right now. Please try again later.");
      return;
    }
    if (message.rawSize > MAX_SIZE) {
      message.setReject("That message is too large (25 MB at most).");
      return;
    }
    // Read the raw message once (the stream can only be read one time); attachments are base64 text, so a
    // text view is enough to see every part's headers.
    const raw = await new Response(message.raw).text();
    const why = verdict(raw, message.from, message.headers.get("from") ?? "");
    if (why) {
      console.log(`rejected mail to ${message.to}: ${why}`);
      message.setReject(`Not delivered: ${why}. Please send a link or a different file type instead.`);
      return;
    }
    const h = new Headers();
    h.set("X-Mail-Guard", "checked");
    try {
      await message.forward(env.FORWARD_TO, h);
    } catch (e) {
      // Never lose a message silently: a temporary bounce makes the sender's server try again later.
      console.error("forward failed", (e as Error).message);
      message.setReject("Temporary problem delivering this message. Please try again later.");
    }
  },
};
