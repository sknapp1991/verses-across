"use client";
/**
 * Under a Bible verse that English Bibles print differently (Matthew 17:21, Mark 16:9…): a small "Not in every
 * Bible · why?" link to its entry on /differences (data/bible-differences-marks.json, scripts/build-differences.mts).
 */
import Link from "next/link";
import marks from "../../data/bible-differences-marks.json";
import { useReaderState } from "./use-reader-state";

const MARKS = marks as Record<string, string>;

export function DiffMark({ v }: { v: string }) {
  const { ref } = useReaderState();
  if (ref.work !== "bible") return null;
  const id = MARKS[`${ref.book}/${ref.chapter}/${v}`];
  if (!id) return null;
  return (
    <Link
      href={`/differences#${id}`}
      className="mt-1 inline-flex min-h-8 items-center gap-1 font-sans text-xs text-muted hover:text-accent"
      title="Some Bibles leave this out or question it: see why"
    >
      <span aria-hidden className="text-accent">≠</span> Not in every Bible · <span className="text-accent underline-offset-2 hover:underline">why?</span>
    </Link>
  );
}
