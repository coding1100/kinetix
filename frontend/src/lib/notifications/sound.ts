const SOUND_URL = "/sounds/notification.wav";
// Messages can land back-to-back; a single element would cut its own tail off
// restarting, so a small pool is round-robined instead.
const POOL_SIZE = 3;

let pool: HTMLAudioElement[] | null = null;
let nextIndex = 0;
let unlocked = false;

function getPool(): HTMLAudioElement[] | null {
  if (typeof window === "undefined") return null;
  if (!pool) {
    pool = Array.from({ length: POOL_SIZE }, () => {
      const audio = new Audio(SOUND_URL);
      audio.preload = "auto";
      // Deliberately left at full volume: the asset decides how loud and how
      // long the notification is. Attenuating here made a fast-decaying file
      // sound truncated, because its tail dropped below audibility early.
      return audio;
    });
  }
  return pool;
}

function unlock() {
  if (unlocked) return;
  const elements = getPool();
  if (!elements) return;
  unlocked = true;
  // Browsers only allow programmatic playback once the page has seen a user
  // gesture. Playing muted during that gesture marks every element as
  // user-activated, so later notification plays are not blocked - including
  // while the tab is in the background.
  //
  // Every step here is synchronous on purpose. Restoring muted/paused state
  // from the play() promise instead would leave a window - milliseconds, but
  // reliably hit when a message lands right after you click or type in an
  // open chat - where a real notification play either starts muted or gets
  // torn down by this function's own deferred pause().
  for (const audio of elements) {
    try {
      audio.muted = true;
      const started = audio.play();
      audio.pause();
      audio.currentTime = 0;
      audio.muted = false;
      // Pausing this promptly rejects the play() above with AbortError; the
      // element still counts as user-activated, which is the whole point.
      void started?.catch(() => {});
    } catch {
      // Safari throws on currentTime before metadata loads - leave the
      // element unmuted and move on to the rest of the pool.
      audio.muted = false;
    }
  }
}

if (typeof window !== "undefined") {
  const events: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "touchstart"];
  const handler = () => {
    unlock();
    events.forEach((event) => window.removeEventListener(event, handler));
  };
  events.forEach((event) => window.addEventListener(event, handler));

  // TEMPORARY: lets the exact notification code path be triggered from the
  // devtools console without needing a second account to send a message.
  if (process.env.NODE_ENV !== "production") {
    (window as unknown as { __testChatSound: () => void }).__testChatSound = () =>
      playNotificationSound();
  }
}

export function playNotificationSound() {
  const elements = getPool();
  if (!elements) return;
  // Prefer an element that is not mid-playback, so two messages close
  // together never cut each other off by rewinding a sounding element.
  let index = elements.findIndex((el) => el.paused || el.ended);
  if (index === -1) {
    index = nextIndex;
    nextIndex = (nextIndex + 1) % elements.length;
  }
  const audio = elements[index];
  // TEMPORARY: diagnosing why the sound is skipped with the chat open.
  const debug = process.env.NODE_ENV !== "production";
  try {
    audio.currentTime = 0;
  } catch {
    // Safari throws if the element has not loaded metadata yet; play() below
    // still starts it from the beginning.
  }
  if (debug) {
    console.log("[chat sound] play requested", {
      index,
      unlocked,
      readyState: audio.readyState,
      muted: audio.muted,
      volume: audio.volume,
      paused: audio.paused,
      src: audio.currentSrc,
    });
  }
  void audio.play().then(
    () => {
      if (debug) console.log("[chat sound] play started", { index });
    },
    (error: unknown) => {
      // Autoplay still blocked (no gesture on this page yet) - nothing to do,
      // the next gesture unlocks the pool for subsequent messages.
      if (debug) console.log("[chat sound] play rejected", { index, error });
    }
  );
}
