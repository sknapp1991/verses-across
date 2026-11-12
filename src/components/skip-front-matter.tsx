"use client";
/**
 * On a Library book's front matter (a Preface, Introduction, Foreword… before the book itself begins), a small
 * bar: "Skip the Preface → Chapter 1". Which books and where they begin: data/story-start.json, built by
 * scripts/build-story-start.mts from the chapters' titles. The × hides it for that book. Ticket d9e4ffa1.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { chapterTitle, readHref } from "@/lib/catalog";
import { CloseIcon } from "./icons";

type Starts = Record<string, [number, string, string?]>;
let dataP: Promise<Starts> | null = null;
const load = () => (dataP ??= import("../../data/story-start.json").then((m) => m.default as unknown as Starts));

const HIDDEN = "va-skip-front-hidden:v1";
const hidden = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(HIDDEN) ?? "[]") as string[];
  } catch {
    return [];
  }
};

export function SkipFrontMatter({ work, book, chapter, entry, versions }: { work: string; book: string; chapter: number; entry: Parameters<typeof chapterTitle>[0]; versions: string[] }) {
  const key = `${work}/${book}`;
  const [start, setStart] = useState<[number, string, string?] | null>(null);
  const [off, setOff] = useState(false);
  useEffect(() => {
    if (!work.startsWith("lit-")) return;
    let alive = true;
    void load().then((s) => {
      if (!alive) return;
      setStart(s[key] ?? null);
      setOff(hidden().includes(key));
    });
    return () => {
      alive = false;
    };
  }, [key, work]);
  if (!start || off || chapter >= start[0]) return null;
  const [to, what, toTitle] = start;
  const first = what.split(" · ")[0];
  const label = first.length > 40 ? "the front matter" : `the ${first.replace(/^the /i, "")}`;
  return (
    <div className="mx-auto mb-2 mt-1 flex max-w-xl items-center gap-2 rounded-xl border border-line bg-raised/50 px-3 py-1.5 text-sm text-muted">
      <span className="min-w-0 flex-1">Want to begin with the book itself?</span>
      <Link href={readHref({ work, book, chapter: to }, versions)} className="min-w-0 rounded-lg px-2 py-1.5 text-right font-medium text-accent hover:bg-raised">
        Skip {label} → {toTitle || chapterTitle(entry, to)}
      </Link>
      <button
        type="button"
        aria-label="Hide this for this book"
        title="Hide this for this book"
        onClick={() => {
          try {
            localStorage.setItem(HIDDEN, JSON.stringify([...hidden(), key].slice(-500)));
          } catch {
            /* private mode */
          }
          setOff(true);
        }}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-faint hover:bg-raised hover:text-ink"
      >
        <CloseIcon width={14} height={14} />
      </button>
    </div>
  );
}
