import type { Metadata } from "next";
import Link from "next/link";
import { permanentRedirect } from "next/navigation";
import { TestersChat } from "@/components/testers-chat";
import { ORIGINS, SITE_SIDE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Test the Android app",
  description: "Help test the Verses Across Android app before it goes public on Google Play: three steps and the testers' chat.",
  alternates: { canonical: "/testers" },
  robots: { index: false }, // reached from the Facebook post's link; not a search result
};

const PLAY = "https://play.google.com/apps/testing/com.versesacross.app";
const a = "underline underline-offset-2 hover:text-ink";

/**
 * The Android testers' page (Skylar, Nov 10): the three steps of Google Play's closed test (12 testers × 14 days)
 * and the testers' study chat (src/components/testers-chat.tsx, src/app/api/chat). The chat link (?c=…) comes
 * from Skylar's Facebook post; he can reset it.
 */
export default function TestersPage() {
  if (SITE_SIDE !== "scriptures") permanentRedirect(`${ORIGINS.scriptures}/testers`); // the Verses Across app's test
  return (
    <main className="h-app overflow-y-auto bg-paper text-muted">
      <div className="mx-auto max-w-2xl space-y-8 px-4 pb-16 pt-8 leading-relaxed md:px-8">
        <header className="space-y-3">
          <Link href="/" className={`text-sm ${a}`}>
            ← Back to reading
          </Link>
          <h1 className="font-serif text-3xl font-semibold text-ink">Help test the Android app</h1>
          <p>
            Verses Across is almost on Google Play. Before an app can go public, Google asks for at least 12 people to test it for 14
            days. Thank you for helping!
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="font-serif text-xl font-semibold text-ink">Three steps</h2>
          <ol className="space-y-3">
            <li className="rounded-xl border border-line bg-raised/40 p-4">
              <p className="font-medium text-ink">1. Say hi in the chat, then email us from your Android phone&rsquo;s Google account</p>
              <p className="text-sm">
                Pick a name in the testers&rsquo; chat below and say hi. Then send an email to{" "}
                <span className="select-all font-medium text-ink">testers@versesacross.com</span> from the Gmail you use on your Android
                phone, with <strong className="text-ink">your chat name as the subject</strong>. Google Play only lets that exact account
                into the test. Please don&rsquo;t post your email in the chat: everyone can read it.
              </p>
            </li>
            <li className="rounded-xl border border-line bg-raised/40 p-4">
              <p className="font-medium text-ink">2. Install the test version from Google Play</p>
              <p className="text-sm">
                Once Skylar has added you, open{" "}
                <a href={PLAY} className={a} target="_blank" rel="noopener noreferrer">
                  the Google Play test link
                </a>{" "}
                on your Android phone, signed in with that same Google account, tap <strong className="text-ink">Become a tester</strong>, then install. (The
                link works once Google has approved the app; we&rsquo;ll say so in the chat.)
              </p>
            </li>
            <li className="rounded-xl border border-line bg-raised/40 p-4">
              <p className="font-medium text-ink">3. Keep it for 14 days</p>
              <p className="text-sm">Keep the app installed and open it now and then. Feedback is welcome, but not required.</p>
            </li>
          </ol>
          <p className="text-sm">
            On an iPhone or a computer? This test is Android only, but you can use everything at{" "}
            <Link href="/" className={a}>
              versesacross.com
            </Link>{" "}
            today.
          </p>
        </section>

        <TestersChat />
      </div>
    </main>
  );
}
