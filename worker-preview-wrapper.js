
 // XOXO Avenue server-side wrapper for localized WhatsApp link previews.
import baseWorker from "./worker.js";

const DESCRIPTIONS = {
  es: "Conoce personas, haz nuevos amigos y descubre comunidades en XOXO Avenue.",
  en: "Meet people, make friends, and discover communities on XOXO Avenue.",
  "pt-br": "Conheça pessoas, faça novos amigos e descubra comunidades no XOXO Avenue.",
  fr: "Rencontrez de nouvelles personnes, faites-vous de nouveaux amis et découvrez des communautés sur XOXO Avenue.",
  pl: "Poznawaj ludzi, nawiązuj nowe znajomości i odkrywaj społeczności na XOXO Avenue.",
  de: "Lerne neue Menschen kennen, finde neue Freunde und entdecke Communities auf XOXO Avenue.",
  nb: "Møt nye mennesker, få nye venner og oppdag fellesskap på XOXO Avenue.",
  cs: "Poznávejte nové lidi, najděte nové přátele a objevujte komunity na XOXO Avenue.",
  sv: "Träffa nya människor, få nya vänner och upptäck gemenskaper på XOXO Avenue.",
  it: "Conosci nuove persone, fai nuove amicizie e scopri community su XOXO Avenue."
};

function languageFrom(url) {
  const raw = String(url.searchParams.get("lang") || "en").trim().toLowerCase().replace(/_/g, "-");
  if (raw === "pt" || raw.startsWith("pt-")) return "pt-br";
  if (raw === "no" || raw === "nb" || raw.startsWith("nb-")) return "nb";
  const base = raw.split("-")[0];
  return DESCRIPTIONS[base] ? base : "en";
}

function localizedDescription(url) {
  return DESCRIPTIONS[languageFrom(url)] || DESCRIPTIONS.en;
}

const SHARE_SCRIPT = `(function(){try{
  var messages={
    es:"¡Únete a mí en XOXO Avenue! Conoce personas, descubre comunidades y haz nuevos amigos.",
    en:"Join me on XOXO Avenue — meet people, discover communities and make new friends!",
    "pt-br":"Junte-se a mim no XOXO Avenue! Conheça pessoas, descubra comunidades e faça novas amizades.",
    fr:"Rejoins-moi sur XOXO Avenue ! Rencontre de nouvelles personnes, découvre des communautés et fais de nouveaux amis.",
    pl:"Dołącz do mnie na XOXO Avenue! Poznawaj ludzi, odkrywaj społeczności i nawiązuj nowe znajomości.",
    de:"Komm zu XOXO Avenue! Lerne neue Menschen kennen, entdecke Communities und finde neue Freunde.",
    nb:"Bli med meg på XOXO Avenue! Møt nye mennesker, oppdag fellesskap og få nye venner.",
    cs:"Přidej se ke mně na XOXO Avenue! Poznávej nové lidi, objevuj komunity a navazuj přátelství.",
    sv:"Häng med mig på XOXO Avenue! Träffa nya människor, upptäck gemenskaper och få nya vänner.",
    it:"Unisciti a me su XOXO Avenue! Conosci nuove persone, scopri community e fai nuove amicizie."
  };
  function normalize(raw){
    raw=String(raw||"").toLowerCase();
    raw=raw.replace(/_/g,"-");
    if(raw==="pt"||raw.indexOf("pt-")===0) return "pt-br";
    if(raw==="no"||raw==="nb"||raw.indexOf("nb-")===0) return "nb";
    var base=raw.split("-")[0];
    return messages[base] ? base : "en";
  }
  function syncHomeLanguageToUrl(){
    try{
      var page=new URL(location.href);
      if(page.pathname!=="/"||page.searchParams.has("profile")||page.searchParams.has("post")) return;
      if(["code","token_hash","access_token","refresh_token","error","type"].some(function(k){return page.searchParams.has(k);})) return;
      var raw=page.searchParams.get("lang")||localStorage.getItem("friendhub_language")||document.documentElement.lang||"en";
      var lang=normalize(raw);
      if(!messages[lang]) return;
      if(page.searchParams.get("lang")!==lang){
        page.searchParams.set("lang",lang);
        history.replaceState(history.state,"",page.pathname+"?"+page.searchParams.toString()+page.hash);
      }
    }catch(_){}
  }
  syncHomeLanguageToUrl();
  try{
    var originalSetItem=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){
      originalSetItem.apply(this,arguments);
      if(key==="friendhub_language") syncHomeLanguageToUrl();
    };
  }catch(_){}
  function rewrite(value){
    try{
      if(typeof value!=="string") return value;
      var u=new URL(value,location.href);
      var host=String(u.hostname||"").toLowerCase();
      if(host!=="wa.me" && host!=="whatsapp.com" && !host.endsWith(".whatsapp.com")) return value;
      var text=u.searchParams.get("text")||"";
      var marker="https://xoxoavenue.com";
      var start=text.toLowerCase().indexOf(marker);
      if(start<0) return value;
      var end=start;
      while(end<text.length && text.charAt(end)!==" " && text.charAt(end)!=="\n" && text.charAt(end)!=="\r" && text.charAt(end)!=="\t") end++;
      var rawShare=text.slice(start,end);
      while(rawShare.length && "),.!?]".indexOf(rawShare.charAt(rawShare.length-1))!==-1) rawShare=rawShare.slice(0,-1);
      var share=new URL(rawShare);
      if(share.hostname.toLowerCase()!=="xoxoavenue.com") return value;
      var lang=normalize(new URL(location.href).searchParams.get("lang")||localStorage.getItem("friendhub_language")||share.searchParams.get("lang")||document.documentElement.lang||"en");
      if(!messages[lang]) lang="en";
      share.searchParams.set("lang",lang);
      share.searchParams.set("xoxo_share","1");
      share.searchParams.set("xoxo_v","20261027z10");
      var english="Join me on XOXO Avenue — meet people, discover communities and make new friends!";
      var localized=messages[lang];
      if(text.indexOf(english)!==-1) text=text.replace(english,localized);
      else if(lang!=="en" && text.trim()) {
        var lineEnd=text.indexOf("\n");
        if(lineEnd<0) lineEnd=text.length;
        text=localized+text.slice(lineEnd);
      }
      var newStart=text.toLowerCase().indexOf(marker);
      if(newStart<0) return value;
      var newEnd=newStart;
      while(newEnd<text.length && text.charAt(newEnd)!==" " && text.charAt(newEnd)!=="\n" && text.charAt(newEnd)!=="\r" && text.charAt(newEnd)!=="\t") newEnd++;
      text=text.slice(0,newStart)+share.toString()+text.slice(newEnd);
      u.searchParams.set("text",text);
      return u.toString();
    }catch(_){return value;}
  }
  function currentShareLanguage(){
    var rawLang="";
    try{rawLang=new URL(location.href).searchParams.get("lang")||""; if(!rawLang) rawLang=localStorage.getItem("friendhub_language")||"";}catch(_){}
    rawLang=rawLang||new URL(location.href).searchParams.get("lang")||document.documentElement.lang||"en";
    var lang=normalize(rawLang);
    return messages[lang]?lang:"en";
  }
  function localizeShareUrl(value){
    if(typeof value!=="string" || !value.trim()) return value;
    try{
      var share=new URL(value,location.href);
      if(share.hostname.toLowerCase()!=="xoxoavenue.com" && share.hostname.toLowerCase()!=="www.xoxoavenue.com") return value;
      var lang=currentShareLanguage();
      share.searchParams.set("lang",lang);
      share.searchParams.set("xoxo_share","1");
      share.searchParams.set("xoxo_v","20261027z10");
      return share.toString();
    }catch(_){return value;}
  }
  function localizeShareText(value){
    if(typeof value!=="string") return value;
    var lang=currentShareLanguage();
    var english="Join me on XOXO Avenue — meet people, discover communities and make new friends!";
    if(value.indexOf(english)!==-1) value=value.replace(english,messages[lang]);
    return value.replace(/https?:\/\/[^\s]+/gi,function(raw){
      var suffix="";
      var candidate=raw;
      while(candidate.length && /[),.!?\]]/.test(candidate.charAt(candidate.length-1))){
        suffix=candidate.charAt(candidate.length-1)+suffix;
        candidate=candidate.slice(0,-1);
      }
      return localizeShareUrl(candidate)+suffix;
    });
  }
  if(typeof navigator!=="undefined" && typeof navigator.share==="function"){
    var nativeShare=navigator.share.bind(navigator);
    navigator.share=function(data){
      if(data && typeof data==="object"){
        var copy=Object.assign({},data);
        if(typeof copy.text==="string") copy.text=localizeShareText(copy.text);
        if(typeof copy.url==="string") copy.url=localizeShareUrl(copy.url);
        return nativeShare(copy);
      }
      return nativeShare(data);
    };
  }
  if(typeof navigator!=="undefined" && navigator.clipboard && typeof navigator.clipboard.writeText==="function"){
    var nativeWriteText=navigator.clipboard.writeText.bind(navigator.clipboard);
    navigator.clipboard.writeText=function(value){return nativeWriteText(localizeShareText(value));};
  }
  var originalOpen=window.open;
  window.open=function(value){
    var args=[].slice.call(arguments);
    if(typeof args[0]==="string") args[0]=rewrite(args[0]);
    return originalOpen.apply(window,args);
  };
  document.addEventListener("click",function(event){
    var anchor=event.target&&event.target.closest?event.target.closest("a"):null;
    if(!anchor) return;
    var href=anchor.href||"";
    var rewritten=rewrite(href);
    if(rewritten!==href){
      event.preventDefault();
      event.stopImmediatePropagation();
      window.open(rewritten,"_blank","noopener,noreferrer");
    }
  },true);
}catch(_){} })();`;

async function localizedResponse(request, env, ctx) {  const baseResponse = await baseWorker.fetch(request, env, ctx);
  const url = new URL(request.url);

  if (url.pathname !== "/") return baseResponse;

  const type = String(baseResponse.headers.get("content-type") || "").toLowerCase();
  if (!type.includes("text/html")) return baseResponse;

  const isHomeSharePreview =
    !url.searchParams.has("profile") &&
    !url.searchParams.has("post") &&
    (url.searchParams.get("xoxo_share") === "1" || url.searchParams.has("lang"));
  const isSharePreview = isHomeSharePreview;
  const description = localizedDescription(url);
  const locale = ({
    es: "es_ES", en: "en_US", "pt-br": "pt_BR", fr: "fr_FR",
    pl: "pl_PL", de: "de_DE", nb: "nb_NO", cs: "cs_CZ",
    sv: "sv_SE", it: "it_IT"
  })[languageFrom(url)] || "en_US";

  // Preserve the exact incoming query string so og:url keeps the requested
  // language and xoxo_v instead of forcing every preview to 20261027i.
  const shareUrl = url.origin + url.pathname + url.search;
  const escapedShareUrl = shareUrl.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

  const response = new HTMLRewriter()
    // Rebuild the full social preview as one consistent localized set. This
    // guarantees a title and image remain available when old metadata is absent
    // or duplicated, while avoiding stale English descriptions.
    .on('meta[property^="og:"]', { element(element) { if (isSharePreview) element.remove(); } })
    .on('meta[name^="twitter:"]', { element(element) { if (isSharePreview) element.remove(); } })
    .on('meta[name="description"]', { element(element) { if (isSharePreview) element.remove(); } })
    .on('link[rel="canonical"]', {
      element(element) {
        if (isSharePreview) element.setAttribute("href", shareUrl);
      }
    })
    .on("head", {
      element(element) {
        if (isSharePreview) {
          const escaped = description.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
          const title = "XOXO Avenue";
          const image = "https://xoxoavenue.com/xoxoavenue-social.png";
          // prepend (not append): index.html's <head> is ~650 KB, so appended tags land past
          // byte 669,000 where link-preview crawlers that read only the start of the page miss them.
          element.prepend(
            `<meta property="og:type" content="website"><meta property="og:title" content="${title}"><meta property="og:site_name" content="XOXO Avenue"><meta property="og:url" content="${escapedShareUrl}"><meta property="og:locale" content="${locale}"><meta property="og:description" content="${escaped}"><meta property="og:image" content="${image}"><meta property="og:image:secure_url" content="${image}"><meta name="description" content="${escaped}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${title}"><meta name="twitter:description" content="${escaped}"><meta name="twitter:image" content="${image}">`,
            {html: true}
          );
        }
        element.append(`<script id="xoxo-share-localizer">${SHARE_SCRIPT}</script>`, {html: true});
      }
    })
    .transform(baseResponse);

  const headers = new Headers(response.headers);
  if (isSharePreview) headers.set("Cache-Control", "no-store");
  return new Response(response.body, {status: response.status, statusText: response.statusText, headers});
}

export default {
  async fetch(request, env, ctx) {
    return localizedResponse(request, env, ctx);
  },
  async scheduled(controller, env, ctx) {
    if (typeof baseWorker.scheduled === "function") {
      return baseWorker.scheduled(controller, env, ctx);
    }
  }
};