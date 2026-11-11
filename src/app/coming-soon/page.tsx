import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/site";
import Link from "next/link";
import { FeedbackButton } from "@/components/feedback-dialog";

export const metadata: Metadata = {
  title: "Coming soon",
  description: `What's planned next for ${SITE_NAME}: games and quizzes, a section for children, a path for teachers, reading plans and more.`,
  alternates: { canonical: "/coming-soon" },
};

/**
 * "Coming soon" (the top-bar icon on a computer, a tile in the ⋯ sheet on a phone): what's planned, in plain
 * words. Children and Teachers are placeholders for now (feature list, Nov 8). Keep it to things that are
 * really planned (ROADMAP.md), without dates.
 */
const PLANNED: { title: string; tag?: string; text: string; points?: string[] }[] = [
  {
    title: "For children",
    tag: "Placeholder",
    text: "A section made for young readers, with texts and reading plans picked for them.",
    points: [
      "Recommendations by age and school level",
      "By interests (stories, poems, animals, heroes…)",
      "Parents can set limits on what's shown",
      "Read-along audio and a simpler screen",
    ],
  },
  {
    title: "For teachers and educators",
    tag: "Placeholder",
    text: "A teaching path you can follow or build for a class, from the first stories to university reading.",
    points: ["Preschool", "Elementary school", "Middle school", "High school", "College and university", "Track a class's progress"],
  },
  {
    title: "Games and quizzes",
    text: "A games area: crosswords made from what you read and quizzes on it, with XP and badges to earn.",
  },
  {
    title: "Reading plans and questions for books",
    text: "Plans for the literature shelves, and short questions after a chapter to check your understanding and think about its themes.",
  },
  {
    title: "Study guides and lesson plans from the themes",
    text: "Themes are here: one theme (forgiveness, suffering, creation…) across every tradition and book. Next, study material built on them.",
    points: ["A study guide for each theme: the key passages side by side, with questions", "Quizzes on a theme", "Lesson plans for a class or study group, week by week"],
  },
  {
    title: "History",
    text: "A timeline and a map through time: zoom from millennia down to years, switch on cultures, empires and events, and see where and when each text was written and what it tells of, linked both ways to the reading.",
    points: ["A timeline with layers (empires, religions, rulers, wars, writings)", "A world map that changes as you move through the years", "From a chapter: when and where it happened, and what else was going on"],
  },
  {
    title: "More languages and recordings",
    text: "More translations, more read-aloud voices, and the original languages side by side.",
  },
];

const a = "underline underline-offset-2 hover:text-ink";

export default function ComingSoonPage() {
  return (
    <main className="h-dvh overflow-y-auto bg-paper text-muted">
      <div className="mx-auto max-w-2xl space-y-8 px-4 pb-16 pt-8 leading-relaxed md:px-8">
        <header className="space-y-3">
          <Link href="/" className={`text-sm ${a}`}>
            ← Back to reading
          </Link>
          <h1 className="font-serif text-3xl font-semibold text-ink">Coming soon</h1>
          <p>
            What we&rsquo;re working on next. Everything stays free, with no ads and no account. For what&rsquo;s already
            changed, see{" "}
            <Link href="/whats-new" className={a}>
              What&rsquo;s new
            </Link>
            .
          </p>
        </header>

        <ul className="space-y-4">
          {PLANNED.map((p) => (
            <li key={p.title} className="space-y-2 rounded-2xl border border-line bg-raised/40 p-4">
              <h2 className="flex flex-wrap items-center gap-2 font-serif text-lg font-semibold text-ink">
                {p.title}
                {p.tag && (
                  <span className="rounded-full border border-line px-2 py-0.5 font-sans text-[11px] font-medium text-faint">{p.tag}</span>
                )}
              </h2>
              <p>{p.text}</p>
              {p.points && (
                <ul className="list-disc space-y-0.5 pl-5 text-sm">
                  {p.points.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>

        <p className="text-sm">
          Have an idea, or want something sooner?{" "}
          <FeedbackButton className={a}>Tell us</FeedbackButton>.
        </p>
      </div>
    </main>
  );
}
