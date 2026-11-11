// XOXO Reveal BETA — client-side image optimization (branch-only, not deployed)
// No network calls; original files are never uploaded by this module.
// Recommended target <= 350 KiB; hard cap 900 KiB. No upscaling.
export async function optimizeRevealImage(file, options = {}) {
  if (!(file instanceof File) || !/^image\/(jpeg|png|webp)$/.test(file.type)) {
    throw new Error("Choose a JPEG, PNG or WebP photo.");
  }
  const maxSide = options.maxSide ?? 1600;
  const targetBytes = options.targetBytes ?? 350 * 1024;
  const maxBytes = options.maxBytes ?? 900 * 1024;
  const image = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Unable to optimize photo.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);
    const encode = (quality) => new Promise((resolve, reject) =>
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Photo compression failed")), "image/webp", quality));
    let best = null;
    for (const quality of [0.84, 0.76, 0.66, 0.55, 0.44]) {
      const blob = await encode(quality);
      if (!best || blob.size < best.size) best = blob;
      if (blob.size <= targetBytes) { best = blob; break; }
    }
    if (best.size > maxBytes) throw new Error("Photo is still too large. Please choose a smaller image.");
    return new File([best], "xoxo-reveal.webp", { type: "image/webp", lastModified: Date.now() });
  } finally {
    image.close();
  }
}

// Video: do not pretend that resizing the HTML player compresses bytes.
// Keep the original file ONLY if both duration and size are within limits;
// otherwise ask for a shorter/smaller clip. A future opt-in encoder may be added.
export async function validateRevealVideo(file, { maxBytes = 15 * 1024 * 1024, maxSeconds = 15 } = {}) {
  if (!(file instanceof File) || !["video/mp4", "video/webm"].includes(file.type))
    throw new Error("Choose an MP4 or WebM video.");
  if (file.size > maxBytes) throw new Error("Video exceeds the 15 MB limit.");
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    const duration = await new Promise((resolve, reject) => {
      video.onloadedmetadata = () => resolve(video.duration);
      video.onerror = () => reject(new Error("Unable to read video duration."));
      video.src = url;
    });
    if (!Number.isFinite(duration) || duration <= 0 || duration > maxSeconds)
      throw new Error("Choose a video of 15 seconds or less.");
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
}
