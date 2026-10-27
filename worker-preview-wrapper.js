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
  const raw = String(url.searchParams.get("lang") || "en").toLowerCase();
  return raw === "pt" || raw === "pt-br" ? "pt-br" : raw === "no" ? "nb" : raw;
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
    if(raw==="pt"||raw==="pt-br") return "pt-br";
    if(raw==="no") return "nb";
    return raw;
  }
  function rewrite(value){
    try{
      if(typeof value!=="string"||!/whatsapp\\.com|wa\\.me/i.test(value)) return value;
      var u=new URL(value,location.href);
      if(!/whatsapp\\.com|wa\\.me/i.test(u.hostname)) return value;
      var text=u.searchParams.get("text")||"";
      var match=text.match(/https:\\/\\/xoxoavenue\\.com(?:\\/[^\\s]*)?/i);
      if(!match) return value;
      var share=new URL(match[0]);
      var lang=normalize(localStorage.getItem("friendhub_language")||share.searchParams.get("lang")||document.documentElement.lang||"en");
      if(!messages[lang]) lang="en";
      share.searchParams.set("lang",lang);
      share.searchParams.set("xoxo_share","1");
      var english="Join me on XOXO Avenue — meet people, discover communities and make new friends!";
      var localized=messages[lang];
      if(text.indexOf(english)!==-1) text=text.replace(english,localized);
      else if(lang!=="en" && text.trim()) text=text.replace(/^[^\\n]*(?=\\n|$)/,localized);
      u.searchParams.set("text",text.replace(match[0],share.toString()));
      return u.toString();
    }catch(_){return value;}
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

async function localizedResponse(request, env, ctx) {
  const baseResponse = await baseWorker.fetch(request, env, ctx);
  const url = new URL(request.url);

  if (url.pathname !== "/") return baseResponse;

  const type = String(baseResponse.headers.get("content-type") || "").toLowerCase();
  if (!type.includes("text/html")) return baseResponse;

  const isSharePreview = url.searchParams.get("xoxo_share") === "1";
  const description = localizedDescription(url);

  const response = new HTMLRewriter()
    .on('meta[property="og:description"]', {
      element(element) {
        if (isSharePreview) element.setAttribute("content", description);
      }
    })
    .on('meta[name="twitter:description"]', {
      element(element) {
        if (isSharePreview) element.setAttribute("content", description);
      }
    })
    .on('meta[name="description"]', {
      element(element) {
        if (isSharePreview) element.setAttribute("content", description);
      }
    })
    .on("head", {
      element(element) {
        if (isSharePreview) {
          const escaped = description.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
          element.append(`<meta property="og:description" content="${escaped}"><meta name="twitter:description" content="${escaped}">`, {html: true});
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
