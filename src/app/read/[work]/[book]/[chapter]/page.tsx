import type { Metadata } from "next";
import { Suspense } from "react";
import { headers } from "next/headers";
import { permanentRedirect } from "next/navigation";
import { ReaderFallback, ReaderView } from "@/components/reader";
import { ChapterSeed } from "@/lib/chapter-store";
import { chapterJsonLd, chapterMetadata, initialChapters } from "@/lib/seo";
import { sideOfWork } from "@/lib/catalog";
import { ORIGINS, SITE_NAMES, SITE_SIDE } from "@/lib/site";
import { MovedAway } from "@/components/moved-away";

type Props = PageProps<"/read/[work]/[book]/[chapter]">;
/** Search engines and link-preview fetchers (they never carry saved data, so they get a real redirect). */
const BOT = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|preview|whatsapp|telegram|discord|mediapartners|lighthouse|headless/i;
const vOf = (sp: Record<string, string | string[] | undefined>) => (typeof sp.v === "string" ? sp.v : undefined);

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ work, book, chapter }, sp] = await Promise.all([params, searchParams]);
  return chapterMetadata(work, book, chapter, vOf(sp));
}

export default async function ReadPage({ params, searchParams }: Props) {
  const [{ work, book, chapter }, sp] = await Promise.all([params, searchParams]);
  // A book of the other site (Verses Across / Library Across): send the reader there with their saved data.
  const side = sideOfWork(work);
  if (side !== SITE_SIDE) {
    // Search engines: a permanent redirect, so the page's place in results moves to the other site. People: a
    // forward in the browser that takes their saved data along (it lives only in this site's storage).
    const ua = (await headers()).get("user-agent") ?? "";
    const query = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : Array.isArray(v) ? v.map((x) => [k, x]) : []))).toString();
    if (BOT.test(ua)) permanentRedirect(`${ORIGINS[side]}/read/${work}/${book}/${chapter}${query ? `?${query}` : ""}`);
    return <MovedAway origin={ORIGINS[side]} name={SITE_NAMES[side]} />;
  }
  const ld = chapterJsonLd(work, book, chapter);
  // The first versions' text comes with the page (search engines read it; the reader shows it at once).
  const chapters = await initialChapters(work, book, chapter, vOf(sp));
  return (
    <>
      {ld && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />}
      <ChapterSeed chapters={chapters}>
        <Suspense fallback={<ReaderFallback />}>
          <ReaderView />
        </Suspense>
      </ChapterSeed>
    </>
  );
}
