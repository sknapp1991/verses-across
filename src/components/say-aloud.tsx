"use client";
/**
 * ▶ buttons that say a word aloud with the device's voices: the word in its own language (Hebrew, Greek, Russian,
 * Arabic, Chinese…), and its English meaning. A device with no voice for that language says the romanization
 * ("shalom") with an English voice instead, and says so.
 */
import { pickVoice, speechSupported, useVoices } from "@/lib/speech";
import { getLanguage } from "@/lib/languages";
import { toast } from "@/lib/ui-store";
import { PlayIcon } from "./icons";

function say(voices: SpeechSynthesisVoice[], text: string, lang: string, rate = 0.8) {
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const voice = pickVoice(voices, lang);
  if (voice) u.voice = voice;
  u.lang = voice?.lang ?? lang;
  u.rate = rate;
  synth.speak(u);
  return !!voice;
}

export function SayAloud({ word, lang, romanized, english }: { word: string; lang: string; romanized?: string | null; english?: string | null }) {
  // (Chrome lists its voices only after a moment: the hook re-renders when they arrive)
  const voices = useVoices();
  if (!speechSupported()) return null;
  const hasVoice = (l: string) => !!pickVoice(voices, l);
  const langName = getLanguage(lang).name;
  const btn = "inline-flex min-h-8 items-center gap-1 rounded-full border border-line px-2.5 text-xs font-medium text-accent hover:border-faint";
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      <button
        type="button"
        className={btn}
        title={`Say it in ${langName}`}
        onClick={() => {
          if (hasVoice(lang)) say(voices, word, lang);
          else if (romanized) {
            say(voices, romanized, "en");
            toast(`No ${langName} voice on this device: saying it the English way (“${romanized}”)`);
          } else toast(`No ${langName} voice on this device`);
        }}
      >
        <PlayIcon width={12} height={12} aria-hidden /> Say it
      </button>
      {english && (
        <button type="button" className={btn} title="Say the English meaning" onClick={() => say(voices, english, "en", 0.95)}>
          <PlayIcon width={12} height={12} aria-hidden /> English: {english}
        </button>
      )}
    </span>
  );
}
