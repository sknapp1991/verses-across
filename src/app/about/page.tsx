import type { Metadata } from "next";
import Link from "next/link";
import { FeedbackButton } from "@/components/feedback-dialog";
import { ORIGINS, SITE_NAME, SITE_SIDE } from "@/lib/site";

const LIB = SITE_SIDE === "library";

export const metadata: Metadata = {
  title: "About, terms and privacy",
  description: `Who makes ${SITE_NAME}, the terms of use, privacy, and credits for every text.`,
  alternates: { canonical: "/about" },
};

const REPO = "https://github.com/sknapp1991/snoopwiggy";
const SOCIALS = [
  ["YouTube", "https://www.youtube.com/@versesacross"],
  ["Instagram", "https://www.instagram.com/versesacross/"],
  ["TikTok", "https://www.tiktok.com/@versesacross"],
  ["Facebook", "https://www.facebook.com/profile.php?id=61596354840469"],
] as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section id={title.toLowerCase().replace(/[^a-z]+/g, "-")} className="scroll-mt-4 space-y-3">
      <h2 className="font-serif text-xl font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

const a = "underline underline-offset-2 hover:text-ink";

export default function AboutPage() {
  return (
    <main className="h-dvh overflow-y-auto bg-paper text-muted">
      <div className="mx-auto max-w-2xl space-y-10 px-4 pb-16 pt-8 leading-relaxed md:px-8">
        <header className="space-y-3">
          <Link href="/" className={`text-sm ${a}`}>
            ← Back to reading
          </Link>
          <h1 className="font-serif text-3xl font-semibold text-ink">About {SITE_NAME}&trade;</h1>
          {LIB ? (
            <p>
              Library Across lets you read the classic books (novels, poetry, drama, children&rsquo;s books, Freethought and
              Psychology) with read-aloud, word help and notes. It is the sister site of{" "}
              <a href={ORIGINS.scriptures} className={a}>
                Verses Across
              </a>
              , which keeps the world&rsquo;s scriptures. It is free, and always will be: no ads, no purchases, no account.
            </p>
          ) : (
            <p>
              Verses Across lets you read the world&rsquo;s scriptures side by side, in many languages. Its sister site{" "}
              <a href={ORIGINS.library} className={a}>
                Library Across
              </a>{" "}
              keeps the classic books. It is free, and always will be: no ads, no purchases, no account.
            </p>
          )}
        </header>

        <Section title="Copyright and license">
          <p>
            <strong className="text-ink">© 2026 {SITE_NAME}</strong>
          </p>
          <p>
            The app&rsquo;s code is free software under the{" "}
            <a href="https://www.gnu.org/licenses/agpl-3.0.html" target="_blank" rel="noopener noreferrer" className={a}>
              GNU Affero General Public License v3.0
            </a>{" "}
            or later. You may use, change and share it, as long as your version stays open source under the same license.
            The code is on{" "}
            <a href={REPO} target="_blank" rel="noopener noreferrer" className={a}>
              GitHub
            </a>
            .
          </p>
          <p>
            The names Verses Across&trade; and Library Across&trade; and their logos are trademarks and are not covered by that license. If you
            share a modified version, please give it its own name and logo.
          </p>
        </Section>

        <Section title="The texts and recordings">
          {LIB ? (
            <>
              <p>
                The books are public domain in the United States, almost all from Project Gutenberg; each one is credited, with
                a link to its source, at the bottom of every chapter. The texts are shown as published: we change formatting
                only, never wording.
              </p>
              <p>
                <strong className="text-ink">Audio.</strong> Recorded voices are computer voices (Kokoro, an open
                text-to-speech model). Where there is no recording, your phone or computer&rsquo;s own built-in voice reads
                the text aloud.
              </p>
            </>
          ) : (
            <>
          <p>
            The scriptures are not ours. Every text is public domain or shared under an open licence by its translators
            and publishers, and each one is credited, with a link to its source, at the bottom of every chapter. A few are
            shared for non-commercial use only: the William Davidson Talmud (via Sefaria) and the Bah&aacute;&rsquo;&iacute;
            writings (&copy; Bah&aacute;&rsquo;&iacute; International Community). Please respect each text&rsquo;s own
            licence if you copy it.
          </p>
          <p>
            The texts are shown as published: we change formatting only, never wording. Every translation is the work of
            its human translators, with one clearly marked exception below.
          </p>
          <p>
            <strong className="text-ink">AI translations.</strong> For a few texts no free English translation exists, or
            only part of one does. For those we made an English version with AI (Claude, by Anthropic), currently{" "}
            <em>Mencius</em> and the complete <em>Popol Vuh</em>. These are always separate versions, never mixed into a
            human translation: each is named &ldquo;AI translation&rdquo;, carries an <strong className="text-ink">AI</strong>{" "}
            badge above its column, and sits beside the original-language text it was translated from so you can compare.
            They can contain mistakes. We may add more where nothing else exists, always labelled the same way.
          </p>
          <p>
            <strong className="text-ink">Audio.</strong> The King James Version is read by a LibriVox volunteer. The other
            recorded voices are computer voices (Kokoro, an open text-to-speech model). Where there is no recording, your
            phone or computer&rsquo;s own built-in voice reads the text aloud.
          </p>
            </>
          )}
        </Section>

        <Section title="Terms of use">
          <ul className="list-disc space-y-2 pl-5">
            <li>You are welcome to use {SITE_NAME} for {LIB ? "reading, study, teaching" : "personal study, teaching, worship"} and sharing.</li>
            <li>
              It is provided &ldquo;as is&rdquo;, without warranty of any kind. We work hard to keep texts, verse numbers
              and audio accurate, but mistakes can happen. Check an authoritative printed edition for anything important.
            </li>
            <li>
              AI translations and computer-voice audio are made by a computer and can contain mistakes. Compare with the
              original-language text or a human translation for anything important.
            </li>
            <li>
              Answers from the AI companion are generated by a computer and can be wrong. They are not religious, legal,
              medical or professional advice.
            </li>
            <li>Please don&rsquo;t misuse the service, for example by flooding it with automated requests.</li>
            <li>We may change or improve the app, and these terms, at any time.</li>
          </ul>
        </Section>

        <Section title="Privacy">
          <ul className="list-disc space-y-2 pl-5">
            <li>There are no accounts, ads, cookies or tracking.</li>
            <li>
              We count, anonymously, how often chapters are read, read-along audio is played and versions are downloaded:
              only daily totals per work, version and language. Nothing about you is stored with them (no IP address, no
              ID, no cookie), so the totals can&rsquo;t be linked to anyone.
            </li>
            <li>
              Your notes, highlights, bookmarks, plans and settings are stored only on your device. We never see them. Clearing
              your browser data deletes them.
            </li>
            <li>
              Offline downloads (versions and read-along audio you save to read or listen without a signal) are stored only
              on your device. Downloading them sends nothing about you; you can delete them at any time.
            </li>
            <li>
              Progress, goals and badges (reading and listening time, verses and chapters read, streaks) are worked out
              and stored on your device too.
            </li>
            <li>
              <strong className="text-ink">Sync (optional).</strong> If you turn on sync, your study data, progress, goals,
              plans and some settings are locked (encrypted) on your device with your private sync code before they are
              uploaded. We store only that locked copy and can&rsquo;t read it; without the code it&rsquo;s meaningless. You
              can delete it from the server at any time (My Study → Sync).
            </li>
            <li>
              <strong className="text-ink">Study groups (optional).</strong> In a group you join, the other members see the
              name you choose and, unless you turn it off, your streak, reading time and chapters this week and your progress
              in the group&rsquo;s book; if you turn it on, also the chapter you&rsquo;re reading. This is encrypted with the
              group&rsquo;s code, so only people with the code can see it. Leaving a group removes your card.
            </li>
            <li>
              When you ask the AI companion a question, the question and the passage you&rsquo;re reading are sent to the AI
              service you picked to get an answer: Google Gemini, or OpenAI&rsquo;s open model (GPT-OSS) run by Cloudflare.
              Don&rsquo;t include personal information you want to keep private.
            </li>
            <li>
              Cross references (&ldquo;similar verses&rdquo;) are worked out in advance and stored with the app; looking
              them up sends nothing about you anywhere.
            </li>
            <li>
              If you send feedback, we receive what you write (anonymously: no name or email is asked for) and (unless you untick
              it) the page you were on, the verse and versions on screen, your device and browser type, your reading
              settings and any recent error messages. You can see all of it before sending. We store reports privately and
              email a copy to the maintainer&rsquo;s inbox, use them only to fix and improve {SITE_NAME}, and never share or sell them. Ask us and we&rsquo;ll delete
              yours:{" "}
              <a href="mailto:privacy@versesacross.com" className={a}>
                privacy@versesacross.com
              </a>
              .
            </li>
            <li>
              Like every website, our host (Cloudflare) briefly handles standard technical data such as your IP address, to
              deliver pages and to limit abuse.
            </li>
            {!LIB && (
            <li>
              The Android app is this same website in an app window, so everything above applies to it too. It asks for no
              special permissions and collects nothing extra.
            </li>
            )}
          </ul>
        </Section>

        <Section title="Contact">
          <p>
            Found a mistake in a text, a problem with the audio, or a bug? Or have an idea? Tell us, no account needed:
          </p>
          <FeedbackButton className="min-h-11 rounded-xl bg-accent px-5 font-medium text-accent-ink">Send feedback</FeedbackButton>
          <p className="text-sm">
            The quickest way to report a problem with one verse: tap or click the verse, then &ldquo;Report it&rdquo; at the
            bottom of its menu. The verse and versions are filled in for you. You can also{" "}
            <a href={`${REPO}/issues`} target="_blank" rel="noopener noreferrer" className={a}>
              open an issue on GitHub
            </a>
            , or email{" "}
            <a href="mailto:feedback@versesacross.com" className={a}>
              feedback@versesacross.com
            </a>
            .
          </p>
          <ul className="space-y-1 text-sm">
            <li>
              Something not working, or need help:{" "}
              <a href="mailto:support@versesacross.com" className={a}>
                support@versesacross.com
              </a>
            </li>
            <li>
              Privacy and your data:{" "}
              <a href="mailto:privacy@versesacross.com" className={a}>
                privacy@versesacross.com
              </a>
            </li>
            <li>
              Anything else, including business:{" "}
              <a href="mailto:contact@versesacross.com" className={a}>
                contact@versesacross.com
              </a>
            </li>
          </ul>
          <p className="text-sm">Follow Verses Across{LIB ? " (Library Across's sister site)" : ""} for new features and a verse of the day:</p>
          <ul className="flex flex-wrap gap-2 text-sm">
            {SOCIALS.map(([name, href]) => (
              <li key={name}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer me"
                  className="inline-flex min-h-10 items-center rounded-lg border border-line px-3 text-ink hover:border-faint hover:bg-raised"
                >
                  {name}
                </a>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </main>
  );
}
