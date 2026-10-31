// XOXO Avenue server-side wrapper for localized WhatsApp link previews.
import baseWorker from "./worker.js";

const DESCRIPTIONS = {
  es: "Conoce personas por internet, haz amistades internacionales y descubre comunidades y publicaciones públicas en XOXO Avenue.",
  en: "Meet people online, make new friends worldwide, discover social communities, and explore public posts on XOXO Avenue.",
  "pt-br": "Conheça pessoas online, faça amizades internacionais, descubra comunidades e explore publicações no XOXO Avenue.",
  fr: "Rencontrez des personnes en ligne, créez des amitiés internationales, découvrez des communautés et explorez des publications sur XOXO Avenue.",
  pl: "Poznawaj ludzi online, nawiązuj międzynarodowe przyjaźnie, odkrywaj społeczności i przeglądaj publiczne posty na XOXO Avenue.",
  de: "Lerne online neue Menschen kennen, finde internationale Freunde, entdecke Communities und öffentliche Beiträge auf XOXO Avenue.",
  nb: "Møt nye mennesker på nettet, få internasjonale venner, oppdag fellesskap og utforsk offentlige innlegg på XOXO Avenue.",
  cs: "Poznávejte nové lidi online, navazujte mezinárodní přátelství, objevujte komunity a prohlížejte veřejné příspěvky na XOXO Avenue.",
  sv: "Lär känna nya människor online, få internationella vänner, upptäck gemenskaper och utforska offentliga inlägg på XOXO Avenue.",
  it: "Conosci persone online, fai amicizie internazionali, scopri community ed esplora post pubblici su XOXO Avenue."
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
  var messages={es:"¡Únete a mí en XOXO Avenue! Conoce personas, descubre comunidades y haz nuevos amigos.",en:"Join me on XOXO Avenue — meet people, discover communities and make new friends!","pt-br":"Junte-se a mim no XOXO Avenue! Conheça pessoas, descubra comunidades e faça novas amizades.",fr:"Rejoins-moi sur XOXO Avenue ! Rencontre de nouvelles personnes, découvre des communautés et fais de nouveaux amis.",pl:"Dołącz do mnie na XOXO Avenue! Poznawaj ludzi, odkrywaj społeczności i nawiązuj nowe znajomości.",de:"Komm zu XOXO Avenue! Lerne neue Menschen kennen, entdecke Communities und finde neue Freunde.",nb:"Bli med meg på XOXO Avenue! Møt nye mennesker, oppdag fellesskap og få nye venner.",cs:"Přidej se ke mně na XOXO Avenue! Poznávej nové lidi, objevuj komunity a navazuj přátelství.",sv:"Häng med mig på XOXO Avenue! Träffa nya människor, upptäck gemenskaper och få nya vänner.",it:"Unisciti a me su XOXO Avenue! Conosci nuove persone, scopri community e fai nuove amicizie."};
  function normalize(raw){raw=String(raw||"").toLowerCase().replace(/_/g,"-");if(raw==="pt"||raw.indexOf("pt-")===0)return "pt-br";if(raw==="no"||raw==="nb"||raw.indexOf("nb-")===0)return "nb";var base=raw.split("-")[0];return messages[base]?base:"en";}
  function syncHomeLanguageToUrl(){try{var page=new URL(location.href);if(page.pathname!=="/"||page.searchParams.has("profile")||page.searchParams.has("post"))return;if(["code","token_hash","access_token","refresh_token","error","type"].some(function(k){return page.searchParams.has(k);}))return;var raw=page.searchParams.get("lang")||localStorage.getItem("friendhub_language")||document.documentElement.lang||"en";var lang=normalize(raw);if(!messages[lang])return;if(page.searchParams.get("lang")!==lang){page.searchParams.set("lang",lang);history.replaceState(history.state,"",page.pathname+"?"+page.searchParams.toString()+page.hash);}}catch(_){} }
  syncHomeLanguageToUrl();
  try{var originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){originalSetItem.apply(this,arguments);if(key==="friendhub_language")syncHomeLanguageToUrl();};}catch(_){}
  function rewrite(value){try{if(typeof value!=="string")return value;var u=new URL(value,location.href),host=String(u.hostname||"").toLowerCase();if(host!=="wa.me"&&host!=="whatsapp.com"&&!host.endsWith(".whatsapp.com"))return value;var text=u.searchParams.get("text")||"",marker="https://xoxoavenue.com",start=text.toLowerCase().indexOf(marker);if(start<0)return value;var end=start;while(end<text.length&&!" \n\r\t".includes(text.charAt(end)))end++;var rawShare=text.slice(start,end);while(rawShare.length&&"),.!?]".includes(rawShare.charAt(rawShare.length-1)))rawShare=rawShare.slice(0,-1);var share=new URL(rawShare);if(share.hostname.toLowerCase()!=="xoxoavenue.com")return value;var lang=normalize(new URL(location.href).searchParams.get("lang")||localStorage.getItem("friendhub_language")||share.searchParams.get("lang")||document.documentElement.lang||"en");share.searchParams.set("lang",lang);share.searchParams.set("xoxo_share","1");share.searchParams.set("xoxo_v","20261027z10");var english="Join me on XOXO Avenue — meet people, discover communities and make new friends!",localized=messages[lang];if(text.indexOf(english)!==-1)text=text.replace(english,localized);var newStart=text.toLowerCase().indexOf(marker);if(newStart<0)return value;var newEnd=newStart;while(newEnd<text.length&&!" \n\r\t".includes(text.charAt(newEnd)))newEnd++;text=text.slice(0,newStart)+share.toString()+text.slice(newEnd);u.searchParams.set("text",text);return u.toString();}catch(_){return value;}}
  var originalOpen=window.open;window.open=function(value){var args=[].slice.call(arguments);if(typeof args[0]==="string")args[0]=rewrite(args[0]);return originalOpen.apply(window,args);};
}catch(_){} })();`;

async function localizedResponse(request, env, ctx) {
  const baseResponse = await baseWorker.fetch(request, env, ctx);
  const url = new URL(request.url);
  const type = String(baseResponse.headers.get("content-type") || "").toLowerCase();

  if (url.pathname !== "/") {
    const routeName = url.pathname.replace(/^\//, "").replace(/\/$/, "");
    const reserved = new Set(["about","discover","privacy","terms","guidelines","api","u","post","profile-preview-image","post-preview-image","assets","beta","favicon.ico","robots.txt","sitemap.xml"]);
    const isUsernameProfile = /^\/[A-Za-z0-9][A-Za-z0-9._-]{0,29}\/?$/.test(url.pathname) && !reserved.has(routeName.toLowerCase());
    if (isUsernameProfile && type.includes("text/html") && request.method === "GET") {
      const profileShareScript = `(function(){try{
        function rewriteUrl(raw){try{var u=new URL(raw,location.href),host=u.hostname.toLowerCase();if(host!=="xoxoavenue.com"&&host!=="www.xoxoavenue.com"&&host!==location.hostname.toLowerCase())return raw;var legacy=/^\\/u\\/[0-9a-f-]{36}\\/?$/i.test(u.pathname)||u.searchParams.has("profile");if(!legacy)return raw;var current=new URL("https://xoxoavenue.com"+location.pathname);u.searchParams.forEach(function(v,k){if(k!=="profile"&&k!=="lang")current.searchParams.append(k,v);});return current.toString();}catch(_){return raw;}}
        function rewriteText(value){if(typeof value!=="string")return value;return value.replace(/https?:\\/\\/[^\\s]+/gi,function(raw){var suffix="",candidate=raw;while(candidate.length&&/[),.!?\\]]/.test(candidate.charAt(candidate.length-1))){suffix=candidate.slice(-1)+suffix;candidate=candidate.slice(0,-1);}return rewriteUrl(candidate)+suffix;});}
        if(typeof navigator!=="undefined"&&typeof navigator.share==="function"){var share=navigator.share.bind(navigator);navigator.share=function(data){if(data&&typeof data==="object"){var copy=Object.assign({},data);if(typeof copy.url==="string")copy.url=rewriteUrl(copy.url);if(typeof copy.text==="string")copy.text=rewriteText(copy.text);return share(copy);}return share(data);};}
        if(typeof navigator!=="undefined"&&navigator.clipboard&&typeof navigator.clipboard.writeText==="function"){var write=navigator.clipboard.writeText.bind(navigator.clipboard);navigator.clipboard.writeText=function(value){return write(rewriteText(value));};}
      }catch(_){}})();`;
      const response = new HTMLRewriter().on("head", { element(element) { element.prepend(`<link rel="stylesheet" href="/xoxo-seasonal-themes.css?v=3"><script src="/xoxo-seasonal-themes.js?v=3" defer></script><script id="xoxo-profile-share-url-fix">${profileShareScript}</script>`, {html:true}); } }).transform(baseResponse);
      return new Response(response.body, {status:response.status,statusText:response.statusText,headers:response.headers});
    }
    if (type.includes("text/html") && request.method === "GET") {
      const themedResponse = new HTMLRewriter().on("head", { element(element) { element.append('<link rel="stylesheet" href="/xoxo-seasonal-themes.css?v=3"><script src="/xoxo-seasonal-themes.js?v=3" defer></script>', {html:true}); } }).transform(baseResponse);
      return new Response(themedResponse.body, {status:themedResponse.status,statusText:themedResponse.statusText,headers:themedResponse.headers});
    }
    return baseResponse;
  }

  if (!type.includes("text/html")) return baseResponse;
  const isHomePage = url.pathname === "/" && !url.searchParams.has("profile") && !url.searchParams.has("post");
  const isHomeSharePreview = isHomePage && (url.searchParams.get("xoxo_share") === "1" || url.searchParams.has("lang"));
  const isSharePreview = isHomeSharePreview;
  const isDefaultHomeSeo = isHomePage && !isHomeSharePreview;
  const homeTitle = "Make Friends Online & Meet People Worldwide | XOXO Avenue";
  const homeDescription = "Discover new people, build genuine friendships, and find communities that share your interests. Connect with people worldwide and express yourself on XOXO Avenue.";
  const description = localizedDescription(url);
  const locale = ({es:"es_ES",en:"en_US","pt-br":"pt_BR",fr:"fr_FR",pl:"pl_PL",de:"de_DE",nb:"nb_NO",cs:"cs_CZ",sv:"sv_SE",it:"it_IT"})[languageFrom(url)] || "en_US";
  const shareUrl = url.origin + url.pathname + url.search;
  const escapedShareUrl = shareUrl.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

  const response = new HTMLRewriter()
    .on('title', { element(element) { if (isDefaultHomeSeo) element.setInnerContent(homeTitle); else if (isSharePreview) element.setInnerContent("XOXO Avenue"); } })
    .on('meta[property^="og:"]', { element(element) { if (isSharePreview || isDefaultHomeSeo) element.remove(); } })
    .on('meta[name^="twitter:"]', { element(element) { if (isSharePreview || isDefaultHomeSeo) element.remove(); } })
    .on('meta[name="description"]', { element(element) { if (isSharePreview || isDefaultHomeSeo) element.remove(); } })
    .on('link[rel="canonical"]', { element(element) { if (isSharePreview) element.setAttribute("href", shareUrl); else if (isDefaultHomeSeo) element.remove(); } })
    .on("head", { element(element) {
      if (isSharePreview || isDefaultHomeSeo) {
        const title = isDefaultHomeSeo ? homeTitle : "XOXO Avenue";
        const metaDescription = isDefaultHomeSeo ? homeDescription : description;
        const escaped = metaDescription.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
        const image = "https://xoxoavenue.com/xoxoavenue-social.png";
        const canonical = isDefaultHomeSeo ? "https://xoxoavenue.com/" : escapedShareUrl;
        const activeLocale = isDefaultHomeSeo ? "en_US" : locale;
        const structuredData = isDefaultHomeSeo ? `<script type="application/ld+json">${JSON.stringify({"@context":"https://schema.org","@graph":[{"@type":"Organization","@id":"https://xoxoavenue.com/#organization","name":"XOXO Avenue","url":"https://xoxoavenue.com/","sameAs":["https://www.instagram.com/xoxoavenueapp","https://www.tiktok.com/@xoxoavenueapp","https://www.facebook.com/xoxoavenueapp","https://x.com/xoxoavenueapp"]},{"@type":"WebSite","@id":"https://xoxoavenue.com/#website","url":"https://xoxoavenue.com/","name":"XOXO Avenue","description":homeDescription,"publisher":{"@id":"https://xoxoavenue.com/#organization"},"inLanguage":["es","en","pt-BR","de","nb","pl","fr","cs","sv","it"]}]})}</script>` : "";
        element.prepend(`${structuredData}<link rel="canonical" href="${canonical}"><meta property="og:type" content="website"><meta property="og:title" content="${title}"><meta property="og:site_name" content="XOXO Avenue"><meta property="og:url" content="${canonical}"><meta property="og:locale" content="${activeLocale}"><meta property="og:description" content="${escaped}"><meta property="og:image" content="${image}"><meta property="og:image:secure_url" content="${image}"><meta name="description" content="${escaped}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${title}"><meta name="twitter:description" content="${escaped}"><meta name="twitter:image" content="${image}">`, {html:true});
      }
      element.append('<link rel="stylesheet" href="/xoxo-seasonal-themes.css?v=3"><script src="/xoxo-seasonal-themes.js?v=3" defer></script><script src="/xoxo-streaks.js?v=20261031a" defer></script>', {html:true});
      element.append(`<script id="xoxo-share-localizer">${SHARE_SCRIPT}</script>`, {html:true});
    }})
    .transform(baseResponse);

  const headers = new Headers(response.headers);
  if (isSharePreview) headers.set("Cache-Control", "no-store");
  return new Response(response.body, {status: response.status, statusText: response.statusText, headers});
}

export default { async fetch(request, env, ctx) { return localizedResponse(request, env, ctx); }, async scheduled(controller, env, ctx) { if (typeof baseWorker.scheduled === "function") return baseWorker.scheduled(controller, env, ctx); } };