// XOXO Reveal BETA — two-phase browser controller (NOT deployed)
// Does not send media or modify production DM. All RPC/media functions injected.
export class RevealPlaybackController {
  constructor({ prepare, start, fetchMedia, onState = () => {}, now = () => Date.now(), schedule = setTimeout, cancel = clearTimeout }) {
    if (![prepare,start,fetchMedia].every(f => typeof f === "function")) throw new TypeError("Missing backend adapters");
    Object.assign(this,{prepare,start,fetchMedia,onState,now,schedule,cancel});
    this.state="sealed"; this.progress=0; this.generation=0; this.timer=null; this.media=null;
  }
  status(value) { this.state=value; this.onState(value); }
  slide(value) { if(this.state==="sealed") this.progress=Math.max(0,Math.min(100,Number(value)||0)); }
  release() { if(this.state!=="sealed") return false; if(this.progress<100){this.progress=0;return false;}return true; }
  async open(revealId) {
    if(!this.release()) return false;
    const gen=++this.generation;
    this.status("preparing");
    try {
      const prep=await this.prepare(revealId);
      if(gen!==this.generation) return false;
      if(!prep?.preparation_id || !Number.isFinite(Date.parse(prep.prepare_until)) || Date.parse(prep.prepare_until)<=this.now()) throw new Error("Preparation expired");
      // fetchMedia MUST NOT return bytes during preparation. The backend is not yet
      // implemented; preloading bytes here would defeat single-view privacy.
      this.status("ready-to-start");
      this.preparation={revealId,prep};
      return true;
    } catch(e) { if(gen===this.generation) this.status("error"); throw e; }
  }
  async begin() {
    if(this.state!=="ready-to-start") return false;
    const gen=this.generation, {revealId,prep}=this.preparation;
    if(Date.parse(prep.prepare_until)<=this.now()){this.status("expired");return false;}
    this.status("starting");
    try {
      const session=await this.start(revealId,prep.preparation_id);
      if(gen!==this.generation) return false;
      if(!session?.session_id || !Number.isFinite(Date.parse(session.active_until))) throw new Error("Invalid session");
      const deadline=Date.parse(session.active_until);
      if(deadline<=this.now()){this.status("expired");return false;}
      // Fetch only after server START. Timer starts server-side before first byte.
      this.deadline=deadline;
      this.status("loading");
      const media=await this.fetchMedia(revealId,session);
      if(gen!==this.generation){media?.dispose?.();return false;}
      if(this.now()>=deadline){media?.dispose?.();this.expire();return false;}
      this.media=media;this.status("viewing");this.tick(gen);return true;
    } catch(e){if(gen===this.generation)this.status("error");throw e;}
  }
  tick(gen=this.generation){
    if(gen!==this.generation||this.state!=="viewing")return;
    if(this.now()>=this.deadline)return this.expire();
    this.timer=this.schedule(()=>this.tick(gen),Math.min(100,this.deadline-this.now()));
  }
  expire(){this.cancel(this.timer);this.media?.dispose?.();this.media=null;this.generation++;this.status("expired");}
  close(){this.cancel(this.timer);this.media?.dispose?.();this.media=null;this.generation++;this.status("closed");}
}
// Security/UX tradeoff: timer starts at server START before media fetch completes.
// Achieving full duration after image load requires a different, carefully audited
// buffering protocol. Never claim full seconds are guaranteed on slow networks.
