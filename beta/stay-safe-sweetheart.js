/* XOXO Avenue — Stay Safe, Sweetheart! BETA
 * Isolated prototype. Not loaded by production or index.html.
 * Integration must use the existing chat lifecycle and moderation APIs.
 */
(function () {
  "use strict";
  const COPY = {
    en: {title:"Stay Safe, Sweetheart! 💛",intro:"Your safety matters.",money:"Never send money, gift cards or crypto to someone you have not verified.",privacy:"Keep passwords, verification codes and banking details private.",images:"Intimate photos can be saved, shared or used for blackmail. Never feel pressured to send them.",links:"Be careful with suspicious links, fake identities and urgent requests.",support:"You're not alone, sweetheart. You deserve kindness, respect and support. Your feelings matter. Your safety matters. YOU matter. 💛",ack:"Got it, stay safe! 💛"},
    es: {title:"¡Cuídate, cariño! 💛",intro:"Tu seguridad importa.",money:"No envíes dinero, tarjetas regalo ni criptomonedas a personas cuya identidad no has verificado.",privacy:"Protege tus contraseñas, códigos de verificación y datos bancarios.",images:"Las fotos íntimas pueden guardarse, difundirse o usarse para chantajearte. Nunca tienes que enviarlas por presión.",links:"Ten cuidado con enlaces sospechosos, identidades falsas y solicitudes urgentes.",support:"No estás solo, cariño. Mereces respeto, comprensión y apoyo. Tus sentimientos importan. Tu seguridad importa. TÚ importas. 💛",ack:"Entendido, ¡cuídate! 💛"},
    "pt-BR": {title:"Cuide-se, meu bem! 💛",intro:"Sua segurança importa.",money:"Nunca envie dinheiro, cartões-presente ou criptomoedas a alguém cuja identidade você não verificou.",privacy:"Proteja suas senhas, códigos de verificação e dados bancários.",images:"Fotos íntimas podem ser salvas, compartilhadas ou usadas para chantagem. Nunca se sinta pressionado a enviá-las.",links:"Cuidado com links suspeitos, identidades falsas e pedidos urgentes.",support:"Você não está só, meu bem. Você merece carinho, respeito e apoio. Seus sentimentos importam. Sua segurança importa. VOCÊ importa. 💛",ack:"Entendi, vou me cuidar! 💛"},
    "fr": {title:"Prends soin de toi, mon cœur ! 💛",intro:"Ta sécurité compte.",money:"N'envoie jamais d'argent, de cartes-cadeaux ou de cryptomonnaies à une personne dont tu n'as pas vérifié l'identité.",privacy:"Protège tes mots de passe, codes de vérification et informations bancaires.",images:"Les photos intimes peuvent être enregistrées, partagées ou utilisées pour te faire chanter. Ne cède jamais à la pression.",links:"Méfie-toi des liens suspects, des fausses identités et des demandes urgentes.",support:"Tu n'es pas seul(e), mon cœur. Tu mérites bienveillance, respect et soutien. Tes sentiments comptent. Ta sécurité compte. TU comptes. 💛",ack:"Compris, je reste prudent(e) ! 💛"},
    "pl": {title:"Dbaj o siebie, kochanie! 💛",intro:"Twoje bezpieczeństwo jest ważne.",money:"Nie wysyłaj pieniędzy, kart podarunkowych ani kryptowalut osobie, której tożsamości nie udało Ci się potwierdzić.",privacy:"Chroń swoje hasła, kody weryfikacyjne i dane bankowe.",images:"Intymne zdjęcia mogą zostać zapisane, udostępnione lub użyte do szantażu. Nie ulegaj presji, by je wysyłać.",links:"Uważaj na podejrzane linki, fałszywe tożsamości i pilne prośby.",support:"Nie jesteś sam(a), kochanie. Zasługujesz na życzliwość, szacunek i wsparcie. Twoje uczucia są ważne. Twoje bezpieczeństwo jest ważne. TY jesteś ważny(-a). 💛",ack:"Rozumiem, dbam o siebie! 💛"},
    "de": {title:"Pass auf dich auf, Schatz! 💛",intro:"Deine Sicherheit ist wichtig.",money:"Sende niemals Geld, Geschenkkarten oder Kryptowährungen an Personen, deren Identität du nicht überprüft hast.",privacy:"Schütze deine Passwörter, Bestätigungscodes und Bankdaten.",images:"Intime Fotos können gespeichert, weitergegeben oder zur Erpressung genutzt werden. Lass dich niemals dazu drängen.",links:"Sei vorsichtig bei verdächtigen Links, falschen Identitäten und dringenden Forderungen.",support:"Du bist nicht allein, Schatz. Du verdienst Freundlichkeit, Respekt und Unterstützung. Deine Gefühle zählen. Deine Sicherheit zählt. DU zählst. 💛",ack:"Verstanden, ich passe auf! 💛"},
    "cs": {title:"Dávej na sebe pozor, zlato! 💛",intro:"Na tvém bezpečí záleží.",money:"Neposílej peníze, dárkové karty ani kryptoměny lidem, jejichž totožnost sis neověřil(a).",privacy:"Chraň svá hesla, ověřovací kódy a bankovní údaje.",images:"Intimní fotografie mohou být uloženy, sdíleny nebo zneužity k vydírání. Nenech se nutit k jejich posílání.",links:"Pozor na podezřelé odkazy, falešné identity a naléhavé žádosti.",support:"Nejsi v tom sám ani sama, zlato. Zasloužíš si laskavost, úctu a podporu. Na tvých pocitech záleží. Na tvém bezpečí záleží. NA TOBĚ záleží. 💛",ack:"Rozumím, budu opatrný/á! 💛"},
    "no": {title:"Ta vare på deg selv, kjære! 💛",intro:"Din trygghet betyr noe.",money:"Ikke send penger, gavekort eller kryptovaluta til noen du ikke har bekreftet identiteten til.",privacy:"Beskytt passord, bekreftelseskoder og bankopplysninger.",images:"Intime bilder kan lagres, deles eller brukes til utpressing. La deg aldri presse til å sende dem.",links:"Vær forsiktig med mistenkelige lenker, falske identiteter og hastesaker.",support:"Du er ikke alene, kjære. Du fortjener omsorg, respekt og støtte. Følelsene dine betyr noe. Tryggheten din betyr noe. DU betyr noe. 💛",ack:"Forstått, jeg passer på! 💛"}
  };
  const css = `
.xoxo-safe-backdrop{position:fixed;inset:0;z-index:2147483000;background:#000a;display:grid;place-items:center;padding:16px}
.xoxo-safe-dialog{box-sizing:border-box;max-width:430px;width:100%;max-height:90vh;overflow:auto;background:#160e29;color:#f5ebff;border:1px solid #69478a;border-radius:22px;padding:22px;box-shadow:0 20px 65px #0009;font:inherit}
.xoxo-safe-dialog h2{margin:0 0 8px;color:#ffdc64;font-size:23px}
.xoxo-safe-dialog p{line-height:1.5}
.xoxo-safe-dialog li{margin:10px 0;line-height:1.4}
.xoxo-safe-dialog button{background:#ffda60;color:#24132f;border:0;border-radius:11px;padding:12px 16px;width:100%;font-weight:700;cursor:pointer}
`;
  function show({conversationId, locale="en", accountId, onReport}={}) {
    if (!conversationId || !accountId) return false;
    const key = "xoxo:safety:v1:"+encodeURIComponent(accountId)+":"+encodeURIComponent(conversationId);
    try { if (localStorage.getItem(key)==="seen") return false; } catch {}
    if (document.querySelector(".xoxo-safe-backdrop")) return false;
    const aliases={"pt":"pt-BR","pt-br":"pt-BR","nb":"no","nb-NO":"no","nn":"no","cz":"cs"};
    const normalized=String(locale).trim();
    const language=aliases[normalized]||aliases[normalized.toLowerCase()]||normalized;
    const t=COPY[language]||COPY[language.split("-")[0]]||COPY.en;
    const style=document.createElement("style");style.textContent=css;document.head.append(style);
    const backdrop=document.createElement("div");backdrop.className="xoxo-safe-backdrop";
    const dialog=document.createElement("section");dialog.className="xoxo-safe-dialog";dialog.setAttribute("role","dialog");dialog.setAttribute("aria-modal","true");dialog.setAttribute("aria-labelledby","xoxo-safe-title");
    const heading=document.createElement("h2");heading.id="xoxo-safe-title";heading.textContent=t.title;dialog.append(heading);
    const intro=document.createElement("p");intro.textContent=t.intro;dialog.append(intro);
    const list=document.createElement("ul");
    [t.money,t.privacy,t.images,t.links].forEach(s=>{const li=document.createElement("li");li.textContent=s;list.append(li)});
    dialog.append(list);
    const support=document.createElement("p");support.textContent=t.support;dialog.append(support);
    const close=document.createElement("button");close.type="button";close.textContent=t.ack;
    const previousFocus=document.activeElement;
    function onKeyDown(event){
      if(event.key==="Tab"){event.preventDefault();close.focus();}
      if(event.key==="Escape"){event.preventDefault();dismiss();}
    }
    function dismiss(){try{localStorage.setItem(key,"seen")}catch{} document.removeEventListener("keydown",onKeyDown);backdrop.remove();style.remove();if(previousFocus?.isConnected && typeof previousFocus.focus==="function") previousFocus.focus();}
    close.addEventListener("click",dismiss);dialog.append(close);
    backdrop.append(dialog);document.body.append(backdrop);document.addEventListener("keydown",onKeyDown);close.focus();
    return true;
  }
  window.XOXOSafetyReminderBeta=Object.freeze({show,copy:COPY});
})();
