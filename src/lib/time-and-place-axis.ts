/**
 * Shared by the Time and place timelines ("When they were written", "When they lived") and their place pages: the
 * year axis, the name filter, the #place address and the form field style. Plain code, safe in old Safari.
 */
import { fold } from "./time-and-place";

/** The timeline runs from 2200 BCE to 2000 CE; negative years are BCE. */
export const T0 = -2200;
export const T1 = 2000;
/** A year's position on the axis, in percent (clamped to the axis). */
export const pct = (y: number) => ((Math.min(T1, Math.max(T0, y)) - T0) / (T1 - T0)) * 100;
export const TICKS = [-2000, -1500, -1000, -500, 0, 500, 1000, 1500, 2000];
export const tickLabel = (y: number) => (y === 0 ? "1 CE" : y < 0 ? `${-y} BCE` : `${y}`);

/** For the filter: folded, with spaces (and so apostrophes) gone: "bahai" finds Bahá’í, "kiche" K’iche’. */
export const squash = (s: string) => fold(s).replace(/ /g, "");

/** "#place=a15257a" opens that place's page (so Back closes it). */
export const placeFromHash = () => {
  if (typeof location === "undefined") return null;
  const m = /^#place=(a[0-9a-f]{6})$/.exec(location.hash);
  return m ? m[1] : null;
};

export const field = "min-h-11 w-full rounded-xl border border-line bg-paper px-3 text-ink";

/** Whether this visit opened the place page now in the address (so Back closes it), shared by the tabs. */
const placeNav = { pushed: false };
export const placePushed = () => placeNav.pushed;
export const setPlacePushed = (v: boolean) => {
  placeNav.pushed = v;
};
