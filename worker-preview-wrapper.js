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
  const raw = String(url.searchParams.get("lang") || "").toLowerCase();
  return raw || "en";
}

function localizedDescription(url) {
  return DESCRIPTIONS[languageFrom(url)] || DESCRIPTIONS.en;
}

function rewriteShareUrl(value) {
  try {
    const u = new URL(value, "https://xoxoavenue.com/");
    if (!/whatsapp\\.com|wa\\.me/i.test(u.hostname)) return value;
    const text = u.searchParams.get("text") || "";
    const match = text.match(/https:\/\/xoxoavenue\.com\/\?[^\\s]+/i);
    if (!match) return value;
    const share = new URL(match[0]);
    if (!share.searchParams.get("lang")) share.searchParams.set("lang", "en");
    share.searchParams.set("xoxo_share", "1");
    u.searchParams.set("text", text.replace(match[0], share.toString()));
    return u.toString();
  } catch (_) {
    return value;
  }
}

async function localizedResponse(request, env, ctx) {
  const baseResponse = await baseWorker.fetch(request, env, ctx);
  const url = new URL(request.url);

  if (url.pathname !== "/" || url.searchParams.get("xoxo_share") !== "1") {
    return baseResponse;
  }

  const type = String(baseResponse.headers.get("content-type") || "").toLowerCase();
  if (!type.includes("text/html")) return baseResponse;

  const description = localizedDescription(url);
  let foundDescription = false;

  const response = new HTMLRewriter()
    .on('meta[property="og:description"]', {
      element(element) {
        element.setAttribute("content", description);
        foundDescription = true;
      }
    })
    .on('meta[name="twitter:description"]', {
      element(element) {
        element.setAttribute("content", description);
      }
    })
    .on('meta[name="description"]', {
      element(element) {
        element.setAttribute("content", description);
      }
    })
    .on("head", {
      element(element) {
        if (!foundDescription) {
          element.append(`<meta property="og:description" content="${description.replace(/"/g, "&quot;")}"><meta name="twitter:description" content="${description.replace(/"/g, "&quot;")}">`, {html: true});
        }
        element.append(`<script id="xoxo-share-cache-buster">(function(){try{function r(v){try{if(typeof v!=="string"||!/whatsapp\\.com|wa\\.me/i.test(v))return v;var u=new URL(v,location.href),t=u.searchParams.get("text")||"",m=t.match(/https:\\/\\/xoxoavenue\\.com\\/\\?[^\\s]+/i);if(!m)return v;var s=new URL(m[0]);if(!s.searchParams.get("lang"))s.searchParams.set("lang",String(localStorage.getItem("friendhub_language")||"en").toLowerCase());s.searchParams.set("xoxo_share","1");u.searchParams.set("text",t.replace(m[0],s.toString()));return u.toString()}catch(_){return v}}var o=window.open;window.open=function(v){var a=[].slice.call(arguments);if(typeof a[0]==="string")a[0]=r(a[0]);return o.apply(window,a)};document.addEventListener("click",function(e){var a=e.target&&e.target.closest?e.target.closest("a"):null;if(!a)return;var h=a.href||"";var f=r(h);if(f!==h){e.preventDefault();e.stopImmediatePropagation();window.open(f,"_blank","noopener,noreferrer")}},true)}catch(_){}})();</script>`, {html: true});
      }
    })
    .transform(baseResponse);

  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store");
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
