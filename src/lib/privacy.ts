"use client";
/**
 * Private mode (Skylar, Nov 10; Settings → Privacy): nothing leaves this device. The only things the app ever sends
 * are the five below, and each checks `isPrivate()` first:
 * - Ask AI (src/lib/ai-chat.ts): hidden, and a question isn't sent;
 * - the feedback form (src/components/feedback-dialog.tsx): shows the email address to copy instead;
 * - the anonymous reading counts (src/lib/count.ts): not sent;
 * - sync (src/lib/sync.ts) and study groups (src/lib/groups.ts): paused;
 * - the Android testers' chat on /testers (src/components/testers-chat.tsx): off.
 * Downloading texts and audio sends nothing about the reader, so it carries on.
 */
import { getSettings, useSettings } from "./settings";

export const isPrivate = () => {
  try {
    return getSettings().privateMode === true;
  } catch {
    return false;
  }
};
export const usePrivate = () => useSettings().privateMode === true;

/** Where the switch is, in the words the app's menus use. */
export const WHERE = "Display options (or More ⋯ on a phone) → Privacy";

/** The error a paused feature gives (sync, groups, Ask AI), in words a reader understands. */
export class PrivateModeError extends Error {
  constructor(what = "This") {
    super(`${what}: off while Private mode is on (${WHERE}).`);
  }
}
