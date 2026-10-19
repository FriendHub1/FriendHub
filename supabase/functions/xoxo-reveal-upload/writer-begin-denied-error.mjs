// Trusted coordinator signal: beginWriter returned false before uploadPrivate ran.
// Do not use this class for timeout, thrown RPC errors or ambiguous Storage writes.
export class RevealWriterBeginDeniedError extends Error {
 constructor(){
  super('Writer begin denied');
  this.name='RevealWriterBeginDeniedError';
  // A denied claim is a trusted pre-write outcome, not a retry authorization.
  // Never infer that a separate writer has completed or that Storage is idle.
  this.storageWriteStarted=false;
 }
}
