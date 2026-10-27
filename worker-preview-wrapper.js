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
  return String(url.searchParams.get("lang") || "en").toLowerCase();
}

function localizedDescription(url) {
  return DESCRIPTIONS[languageFrom(url)] || DESCRIPTIONS.en;
}

const SHARE_SCRIPT = `(function(){try{
  function rewrite(value){
    try{
      if(typeof value!=="string"||!/whatsapp\\.com|wa\\.me/i.test(value)) return value;
      var u=new URL(value,location.href);
      var text=u.searchParams.get("text")||"";
      var match=text.match(/https:\\/\\/xoxoavenue\\.com(?:\\/[^\\s]*)?/i);
      if(!match) return value;
      var share=new URL(match[0]);
      var lang=String(localStorage.getItem("friendhub_language")||share.searchParams.get("lang")||document.documentElement.lang||"en").toLowerCase();
      share.searchParams.set("lang",lang);
      share.searchParams.set("xoxo_share","1");
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
