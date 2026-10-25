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
  // Reporting is delegated to the host chat's existing authenticated report flow.
  // This component never reads or transmits private messages.
  const ACTIONS = {
    en:{tips:"More safety tips",report:"Report conversation 🚩",meet:"If you meet in person, choose a public place, tell someone you trust and arrange your own transport.",threat:"If someone threatens or blackmails you, keep evidence, stop engaging and do not pay."},
    es:{tips:"Más consejos de seguridad",report:"Denunciar conversación 🚩",meet:"Si decides conocer a alguien, elige un lugar público, avisa a alguien de confianza y organiza tu propio transporte.",threat:"Si alguien te amenaza o chantajea, conserva las pruebas, deja de responder y no pagues."}
,
    "pt-BR":{tips:"Mais dicas de segurança",report:"Denunciar conversa 🚩",meet:"Se for encontrar alguém pessoalmente, escolha um lugar público, avise alguém de confiança e organize seu próprio transporte.",threat:"Se alguém ameaçar ou chantagear você, guarde as provas, interrompa o contato e não pague."},
    "fr":{tips:"Plus de conseils de sécurité",report:"Signaler la conversation 🚩",meet:"Pour une rencontre en personne, choisis un lieu public, préviens une personne de confiance et organise ton propre transport.",threat:"En cas de menace ou de chantage, conserve les preuves, cesse de répondre et ne paie pas."},
    "pl":{tips:"Więcej wskazówek bezpieczeństwa",report:"Zgłoś rozmowę 🚩",meet:"Jeśli spotykasz kogoś osobiście, wybierz miejsce publiczne, poinformuj zaufaną osobę i zorganizuj własny transport.",threat:"Jeśli ktoś Ci grozi lub szantażuje, zachowaj dowody, przerwij kontakt i nie płać."},
    "de":{tips:"Weitere Sicherheitstipps",report:"Unterhaltung melden 🚩",meet:"Wenn du jemanden persönlich triffst, wähle einen öffentlichen Ort, informiere eine Vertrauensperson und organisiere deine eigene Anreise.",threat:"Bei Drohungen oder Erpressung: Sichere Beweise, brich den Kontakt ab und zahle nicht."},
    "cs":{tips:"Další bezpečnostní tipy",report:"Nahlásit konverzaci 🚩",meet:"Pokud se s někým setkáš osobně, zvol veřejné místo, řekni o tom důvěryhodné osobě a zajisti si vlastní dopravu.",threat:"Pokud ti někdo vyhrožuje nebo tě vydírá, uchovej důkazy, přestaň reagovat a neplať."},
    "no":{tips:"Flere sikkerhetstips",report:"Rapporter samtalen 🚩",meet:"Hvis du møter noen personlig, velg et offentlig sted, fortell det til noen du stoler på, og ordne egen transport.",threat:"Hvis noen truer eller utpresser deg, ta vare på bevis, avslutt kontakten og ikke betal."}
  };
  const css = `
.xoxo-safe-backdrop{position:fixed;inset:0;z-index:2147483000;background:#000a;display:grid;place-items:center;padding:16px}
.xoxo-safe-dialog{box-sizing:border-box;max-width:430px;width:100%;max-height:90vh;overflow:auto;background:#160e29;color:#f5ebff;border:1px solid #69478a;border-radius:22px;padding:22px;box-shadow:0 20px 65px #0009;font:inherit}
.xoxo-safe-dialog h2{margin:0 0 8px;color:#ffdc64;font-size:23px}
.xoxo-safe-dialog p{line-height:1.5}
.xoxo-safe-dialog li{margin:10px 0;line-height:1.4}
.xoxo-safe-dialog button.xoxo-safe-secondary{background:#39254e;color:#ffe49a;border:1px solid #84659a;margin-top:9px}
.xoxo-safe-dialog [hidden]{display:none!important}
.xoxo-safe-dialog button{background:#ffda60;color:#24132f;border:0;border-radius:11px;padding:12px 16px;width:100%;font-weight:700;cursor:pointer}
`;
  function show({conversationId, locale="en", accountId, onReport}={}) {
    if (!conversationId || !accountId) return false;
    if (typeof conversationId!=="string" || typeof accountId!=="string") return false;
    const key = "xoxo:safety:v1:"+encodeURIComponent(accountId)+":"+encodeURIComponent(conversationId);
    try { if (localStorage.getItem(key)==="seen") return false; } catch {}
    if (document.querySelector(".xoxo-safe-backdrop")) return false;
    const aliases={"pt":"pt-BR","pt-br":"pt-BR","nb":"no","nb-no":"no","nn":"no","cz":"cs"};
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
    const a=ACTIONS[language]||ACTIONS[language.split("-")[0]]||ACTIONS.en;
    const details=document.createElement("div");details.hidden=true;details.id="xoxo-safe-more";
    const moreList=document.createElement("ul");
    [a.meet,a.threat].forEach(message=>{const li=document.createElement("li");li.textContent=message;moreList.append(li)});
    details.append(moreList);
    const tips=document.createElement("button");tips.type="button";tips.className="xoxo-safe-secondary";
    tips.textContent=a.tips;tips.setAttribute("aria-expanded","false");tips.setAttribute("aria-controls",details.id);
    tips.addEventListener("click",()=>{details.hidden=!details.hidden;tips.setAttribute("aria-expanded",String(!details.hidden))});
    dialog.append(tips,details);
    let report=null;
    if(typeof onReport==="function"){
      report=document.createElement("button");report.type="button";report.className="xoxo-safe-secondary";report.textContent=a.report;
      report.addEventListener("click",()=>{dismiss(true);onReport({conversationId})});
      dialog.append(report);
    }
    const close=document.createElement("button");close.type="button";close.textContent=t.ack;
    const previousFocus=document.activeElement;
    const previousBodyOverflow=document.body.style.overflow;
    document.body.style.overflow="hidden";
    function onKeyDown(event){
      if(event.key==="Tab"){
        const focusables=[tips,...(report?[report]:[]),close].filter(el=>!el.disabled);
        const i=focusables.indexOf(document.activeElement);
        if(event.shiftKey && (i<=0)){event.preventDefault();focusables[focusables.length-1].focus();}
        else if(!event.shiftKey && (i===focusables.length-1 || i<0)){event.preventDefault();focusables[0].focus();}
      }
      if(event.key==="Escape"){event.preventDefault();dismiss();}
    }
    function dismiss(remember=true){if(remember){try{localStorage.setItem(key,"seen")}catch{}} document.removeEventListener("keydown",onKeyDown);backdrop.remove();style.remove();document.body.style.overflow=previousBodyOverflow;if(previousFocus?.isConnected && typeof previousFocus.focus==="function") previousFocus.focus();}
    close.addEventListener("click",()=>dismiss());dialog.append(close);
    backdrop.append(dialog);document.body.append(backdrop);document.addEventListener("keydown",onKeyDown);close.focus();
    return true;
  }
  window.XOXOSafetyReminderBeta=Object.freeze({show,copy:COPY});
})();
