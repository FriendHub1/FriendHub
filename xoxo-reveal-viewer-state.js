// XOXO Reveal BETA — recipient viewer state machine (not deployed)
// This module enforces UX gating, not server-side authorization.
// Server must independently enforce one-time opens and expiry.
export class RevealViewer {
  constructor({ claim, load, onState, onExpire, clock = () => Date.now() }) {
    if (![claim, load, onState, onExpire].every(fn => typeof fn === "function"))
      throw new TypeError("Missing Reveal viewer callbacks");
    Object.assign(this, { claim, load, onState, onExpire, clock });
    this.state = "sealed";
    this.progress = 0;
    this.media = null;
    this.deadline = null;
    this.timer = null;
    this.disposed = false;
  }
  setState(next) { this.state = next; this.onState(next); }
  slide(progress) {
    if (this.disposed || this.state !== "sealed") return;
    this.progress = Math.min(100, Math.max(0, Number(progress) || 0));
  }
  release() {
    if (this.disposed || this.state !== "sealed") return false;
    if (this.progress < 100) { this.progress = 0; return false; }
    return true;
  }
  async open({ revealId, mode, seconds }) {
    if (!this.release()) return false;
    this.setState("claiming");
    try {
      // claim() is expected to return a server-issued, short-lived session.
      // Never request a media URL before the slider is complete.
      const grant = await this.claim(revealId);
      if (this.disposed) return false;
      if (!grant?.sessionId || !Number.isFinite(Date.parse(grant.expiresAt)))
        throw new Error("Invalid server grant");
      this.grant = grant;
      this.setState("loading");
      const media = await this.load({ revealId, grant, mode });
      if (this.disposed) { media?.dispose?.(); return false; }
      this.media = media;
      // Server's expiry is authoritative. The UI may not extend it.
      this.deadline = Date.parse(grant.expiresAt);
      if (this.deadline <= this.clock()) { this.expire(); return false; }
      this.setState("ready");
      return true;
    } catch (error) {
      if (!this.disposed) this.setState("error");
      throw error;
    }
  }
  startPlayback() {
    if (this.disposed || this.state !== "ready") return;
    this.setState("viewing");
    this.tick();
  }
  tick() {
    if (this.disposed || this.state !== "viewing") return;
    if (this.clock() >= this.deadline) return this.expire();
    this.timer = setTimeout(() => this.tick(), Math.min(200, this.deadline - this.clock()));
  }
  expire() {
    if (this.disposed || this.state === "expired") return;
    clearTimeout(this.timer);
    this.media?.dispose?.();
    this.media = null;
    this.setState("expired");
    this.onExpire();
  }
  close() {
    clearTimeout(this.timer);
    this.media?.dispose?.();
    this.media = null;
    this.disposed = true;
    this.setState("closed");
  }
}

// IMPORTANT: This viewer starts its visible timer at playback, but server expiry
// currently starts at claim. Thus loading time reduces viewing time.
// Do not deploy until the server implements a distinct PREPARE and START flow,
// with a short prepare TTL and atomic server-side start; never allow client to
// choose its own start timestamp.
