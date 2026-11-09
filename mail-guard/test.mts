// Local test of the mail guard's decisions:  npx tsx mail-guard/test.mts
import { verdict } from "./src/index.ts";

const CF_PASS = "Authentication-Results: mx.cloudflare.net; dkim=pass header.d=example.com; dmarc=pass header.from=example.com; spf=pass";
const msg = (parts: string[], { top = 'multipart/mixed; boundary="B"', from = "someone@example.com", auth = CF_PASS, extra = [] as string[] } = {}) =>
  [auth, ...extra, `From: ${from}`, `To: contact@versesacross.com`, `Subject: hi`, `Content-Type: ${top}`, ``, ...parts.flatMap((p) => [`--B`, p]), `--B--`, ``].join("\r\n");
const text = `Content-Type: text/plain; charset=utf-8\r\n\r\nHello there\r\n-- \r\nSkylar`;
const html = `Content-Type: text/html; charset=utf-8\r\n\r\n<p>Hello <b>there</b></p>`;
const att = (type: string, name: string) => `Content-Type: ${type}; name="${name}"\r\nContent-Disposition: attachment; filename="${name}"\r\nContent-Transfer-Encoding: base64\r\n\r\nAAAA`;
const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");
const OK = "someone@example.com";

let pass = 0, fail = 0;
const check = (name: string, v: string | null, expect: string | null) => {
  const ok = expect === null ? v === null : !!v && v.includes(expect);
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  → ${v}`}`);
};

// Let through
check("plain text (with a '-- ' signature)", verdict(msg([text]), OK), null);
check("newsletter HTML body", verdict(msg([text, html], { top: 'multipart/alternative; boundary="B"' }), OK), null);
check("inline logo image in a newsletter", verdict(msg([html, `Content-Type: image/png; name="logo.png"\r\nContent-Disposition: inline; filename="logo.png"\r\n\r\nAAAA`]), OK), null);
check("PDF", verdict(msg([text, att("application/pdf", "resume.pdf")]), OK), null);
check("photo", verdict(msg([text, att("image/jpeg", "IMG_2854.jpg")]), OK), null);
check("calendar invite (.ics)", verdict(msg([text, att("text/calendar", "invite.ics")]), OK), null);
check("contact card (.vcf)", verdict(msg([text, att("text/vcard", "skylar.vcf")]), OK), null);
check("e-invoice (.xml)", verdict(msg([text, att("application/xml", "invoice.xml")]), OK), null);

// Rejected attachments
check("SVG", verdict(msg([text, att("image/svg+xml", "invoice.svg")]), OK), "svg");
check("SVG sent as octet-stream", verdict(msg([text, att("application/octet-stream", "photo.svg")]), OK), "svg");
check("HTML attachment", verdict(msg([text, att("text/html", "Payment_Details.htm")]), OK), "htm");
check("HTML attachment with no name", verdict(msg([text, `Content-Type: text/html\r\nContent-Disposition: attachment\r\n\r\n<p>x</p>`]), OK), "text/html");
check("zip", verdict(msg([text, att("application/zip", "files.zip")]), OK), "zip");
check("double extension", verdict(msg([text, att("application/octet-stream", "invoice.pdf.exe")]), OK), "exe");
check("macro Word file", verdict(msg([text, att("application/vnd.ms-word.document.macroEnabled.12", "report.docm")]), OK), "docm");
check("encoded file name", verdict(msg([text, `Content-Type: application/octet-stream; name="=?utf-8?B?${b64("scan.svg")}?="\r\nContent-Disposition: attachment\r\n\r\nAAAA`]), OK), "svg");
check("name split across two encoded words", verdict(msg([text, `Content-Type: application/octet-stream; name="=?utf-8?B?${b64("evil.s")}?= =?utf-8?B?${b64("vg")}?="\r\nContent-Disposition: attachment\r\n\r\nAAAA`]), OK), "svg");
check("RFC 2231 file name", verdict(msg([text, `Content-Type: application/octet-stream\r\nContent-Disposition: attachment; filename*=utf-8''bill%2Ehtml\r\n\r\nAAAA`]), OK), "html");
check("trailing dot (evil.svg.)", verdict(msg([text, att("application/octet-stream", "evil.svg.")]), OK), "svg");
check("trailing space and NUL", verdict(msg([text, `Content-Type: application/octet-stream; name="evil.svg%00 "\r\nContent-Disposition: attachment; filename*=utf-8''evil.svg%00%20\r\n\r\nAAAA`]), OK), "svg");
check("right-to-left trick (looks like .jpg)", verdict(msg([text, att("application/octet-stream", "photo‮gpj.exe")]), OK), "exe");
check("uppercase .SVG", verdict(msg([text, att("application/octet-stream", "LOGO.SVG")]), OK), "svg");
check("folded header", verdict(msg([text, `Content-Type: application/octet-stream;\r\n\tname="evil.hta"\r\nContent-Disposition: attachment\r\n\r\nAAAA`]), OK), "hta");
check("forwarded email containing an SVG", verdict(msg([text, `Content-Type: message/rfc822\r\n\r\nFrom: x@y.z\r\nContent-Type: multipart/mixed; boundary="C"\r\n\r\n--C\r\n${att("image/svg+xml", "a.svg")}\r\n--C--`]), OK), "svg");
check("forwarded email hidden in base64", verdict(msg([text, `Content-Type: message/rfc822\r\nContent-Transfer-Encoding: base64\r\n\r\n${b64("From: x\r\n\r\nhi")}`]), OK), "forwarded");

// Spoofing our own domains (only Cloudflare's own Authentication-Results counts)
const CF_FAIL = "Authentication-Results: mx.cloudflare.net; dkim=none; dmarc=fail header.from=versesacross.com; spf=fail";
check("fake envelope @versesacross.com", verdict(msg([text], { auth: CF_FAIL }), "support@versesacross.com"), "own domain");
check("fake visible From: line only", verdict(msg([text], { auth: CF_FAIL, from: "Verses Across <support@versesacross.com>" }), "bounce@attacker.example", "Verses Across <support@versesacross.com>"), "own domain");
check("attacker adds their own 'dmarc=pass' line", verdict(msg([text], { auth: CF_FAIL, extra: ["Authentication-Results: attacker.example; dkim=pass; dmarc=pass"] }), "bounce@attacker.example", "skylar@skylarknapp.com"), "own domain");
check("no Cloudflare result at all", verdict(msg([text], { auth: "X-Other: 1" }), "skylar@skylarknapp.com"), "own domain");
check("real @versesacross.com mail (dmarc=pass from Cloudflare)", verdict(msg([text], { auth: "Authentication-Results: mx.cloudflare.net; dkim=pass; dmarc=pass header.from=versesacross.com" }), "feedback@versesacross.com", "Verses Across <feedback@versesacross.com>"), null);
check("someone else failing their own DMARC (not ours)", verdict(msg([text], { auth: "Authentication-Results: mx.cloudflare.net; dmarc=fail header.from=example.org" }), "news@example.org", "news@example.org"), null);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
