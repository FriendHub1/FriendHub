// BETA ONLY. Connects the two-phase controller to RPC calls.
// Real media delivery is intentionally injected, never bypasses authorization.
import { RevealPlaybackController } from "./xoxo-reveal-two-phase-controller.mjs";
import { createRevealAdapter } from "./xoxo-reveal-beta-adapter.mjs";

export function createRevealBetaSession({
  client, fetchMedia, onState = () => {}, now, schedule, cancel
}) {
  if (typeof fetchMedia !== "function") throw new TypeError("Private media loader required");
  const adapter = createRevealAdapter(client);
  const viewer = new RevealPlaybackController({
    prepare: id => adapter.prepare(id),
    start: (id, preparationId) => adapter.start(id, preparationId),
    fetchMedia,
    onState,
    ...(now ? { now } : {}),
    ...(schedule ? { schedule } : {}),
    ...(cancel ? { cancel } : {})
  });
  return {
    slide: value => viewer.slide(value),
    releaseAndPrepare: id => viewer.open(id),
    startViewing: () => viewer.begin(),
    close: () => viewer.close(),
    get state() { return viewer.state; },
    get progress() { return viewer.progress; }
  };
}
// Do not supply public Storage URLs or service-role credentials to fetchMedia.
// Backend must verify recipient and unexpired session for every media request.
// No browser video streaming implementation is claimed here.
