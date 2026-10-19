// XOXO Reveal BETA — safe preparation adapter. NOT wired into production DMs.
// Import in a module-capable page only after backend authorization is complete.
import { optimizeRevealImage, validateRevealVideo } from "./xoxo-reveal-media-optimizer.js";

export const REVEAL_MODES = Object.freeze({
  once: { mode: "once", seconds: null },
  "5": { mode: "timed", seconds: 5 },
  "10": { mode: "timed", seconds: 10 },
  "15": { mode: "timed", seconds: 15 },
  "20": { mode: "timed", seconds: 20 },
  keep: { mode: "keep", seconds: null }
});

export async function prepareXoxoReveal({ file, duration, recipientId }) {
  const selection = REVEAL_MODES[String(duration)];
  if (!selection) throw new Error("Choose a valid Reveal duration.");
  if (!recipientId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(recipientId)) {
    throw new Error("Choose a valid recipient.");
  }
  if (!(file instanceof File)) throw new Error("Choose a photo or video.");
  let optimizedFile, mediaType;
  if (file.type.startsWith("image/")) {
    optimizedFile = await optimizeRevealImage(file);
    mediaType = "image";
  } else if (file.type.startsWith("video/")) {
    optimizedFile = await validateRevealVideo(file);
    mediaType = "video";
  } else {
    throw new Error("Unsupported media type.");
  }
  return {
    recipientId,
    mode: selection.mode,
    durationSeconds: selection.seconds,
    mediaType,
    file: optimizedFile,
    originalBytes: file.size,
    uploadBytes: optimizedFile.size,
    bytesSaved: Math.max(0, file.size - optimizedFile.size)
  };
}

// Deliberately not implemented: secure backend upload and DM insertion.
// Never fall back to a public URL or ordinary DM attachment when this is unavailable.
export async function sendXoxoReveal() {
  throw new Error("Secure Reveal delivery is not enabled yet.");
}
