// XOXO Reveal BETA — in-memory idempotency coordinator for isolated tests.
// NOT DEPLOYED. Production requires durable atomic DB reservations and
// idempotency keys scoped to the verified sender, with expiry/reconciliation.
export class RevealIdempotencyCoordinator {
  #requests=new Map();
  async execute({senderId,key,fingerprint,run}={}){
    if(typeof senderId!=="string"||!senderId ||
       typeof key!=="string"||! /^[A-Za-z0-9_-]{16,128}$/.test(key) ||
       typeof fingerprint!=="string"||! /^[a-f0-9]{64}$/.test(fingerprint) ||
       typeof run!=="function")throw new TypeError("Invalid idempotency request");
    const scope=senderId+":"+key;
    const existing=this.#requests.get(scope);
    if(existing){
      if(existing.fingerprint!==fingerprint)
        throw new Error("Idempotency key reused with different content");
      return existing.promise;
    }
    const entry={fingerprint,promise:null};
    // Store before invoking run so concurrent callers share one operation.
    const promise=Promise.resolve().then(run);
    entry.promise=promise;
    this.#requests.set(scope,entry);
    try{return await promise;}
    catch(error){
      // Failed requests can retry, but ambiguous remote commits MUST be
      // reconciled via durable transaction state before retry in production.
      if(this.#requests.get(scope)===entry)this.#requests.delete(scope);
      throw error;
    }
  }
  get pendingOrCompletedCount(){return this.#requests.size;}
}
// No durable persistence, restart safety, distributed locking, TTL or
// cross-device guarantee. Never treat this as a production deduplication layer.
