// BETA: authenticated bounded image loader. Not deployed.
// Loads only AFTER start; never uses public/signed Storage URLs.
// Video is deliberately rejected pending a safe Safari streaming transport.
export function createRevealImageLoader({requestRange, createObjectURL, revokeObjectURL, maxBytes=900*1024}) {
  if (typeof requestRange!=="function" || typeof createObjectURL!=="function" || typeof revokeObjectURL!=="function")
    throw new TypeError("Missing media transport");
  return async function fetchMedia(revealId, session) {
    if (!revealId || !session?.session_id) throw new TypeError("Authorized session required");
    const first=await requestRange({revealId,sessionId:session.session_id,start:0,end:0});
    if (first?.status!==206 || !(first.bytes instanceof Uint8Array)) throw new Error("Invalid private media response");
    const m=/^bytes 0-0\/(\d+)$/.exec(first.contentRange||"");
    if (!m) throw new Error("Missing total length");
    const total=Number(m[1]);
    if (!Number.isSafeInteger(total)||total<1||total>maxBytes) throw new Error("Media exceeds image budget");
    const chunks=[first.bytes];
    let pos=1;
    while(pos<total){
      const end=Math.min(pos+262143,total-1);
      const part=await requestRange({revealId,sessionId:session.session_id,start:pos,end});
      if(part?.status!==206 || !(part.bytes instanceof Uint8Array) ||
         part.bytes.length!==end-pos+1 || part.contentRange!==`bytes ${pos}-${end}/${total}`)
        throw new Error("Invalid image range");
      chunks.push(part.bytes);pos=end+1;
    }
    const blob=new Blob(chunks,{type:"image/webp"});
    if(blob.size!==total) throw new Error("Image length mismatch");
    const url=createObjectURL(blob);
    let disposed=false;
    return {kind:"image",url,dispose(){if(!disposed){disposed=true;revokeObjectURL(url);}}};
  };
}
// LIMITATION: This transport cannot guarantee that a recipient will not save
// already received image bytes or capture the screen.
