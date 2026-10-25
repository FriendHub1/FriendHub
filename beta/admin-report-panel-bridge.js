/* XOXO Avenue BETA — adds conversation reports to the existing admin report
 * section without altering the existing PIN-protected conversation viewer.
 * Only loaded by an opt-in BETA preview; server RPC permissions still apply.
 */
(function(){
  "use strict";
  if(typeof window==="undefined")return;
  const statuses=[["reviewed","✓ Mark reviewed"],["resolved","✓ Resolve"],["dismissed","× Dismiss"],["pending","↺ Reopen"]];
  // Text used by the actual workers.dev admin preview (10 XOXO languages).
  // Reasons are indexed 0–5; statuses stay the existing backend enum.
  const COPY = {
    en:{title:"Conversation report",by:"Reported by",target:"Reported user",reason:"Reason",details:"Additional details",empty:"None provided",evidence:"Selected evidence",units:"message(s)",view:"🔐 Open existing conversation viewer",unlock:"🔐 Verify PIN to review conversation reports",saving:"Saving…",saveFailed:"Could not update report.",unavailable:"Stay Safe BETA: conversation reports are not available in Supabase yet.",retryPin:"Could not load reports. Verify your PIN again.",more:"Load more reports",loadingMore:"Loading more reports…",confirm:"Change this report to ",statuses:{pending:"Pending",reviewed:"Reviewed",resolved:"Resolved",dismissed:"Dismissed"},actions:{pending:"↺ Reopen",reviewed:"✓ Mark reviewed",resolved:"✓ Resolve",dismissed:"× Dismiss"},reasons:["Scam or money requests","Threats or blackmail","Harassment or unwanted messages","Fake profile or identity","Intimate photo threats","Other"]},
    es:{title:"Denuncia de conversación",by:"Denunciante",target:"Usuario denunciado",reason:"Motivo",details:"Detalles adicionales",empty:"Sin detalles",evidence:"Pruebas seleccionadas",units:"mensaje(s)",view:"🔐 Abrir en el visor de moderación existente",unlock:"🔐 Verificar PIN para revisar denuncias de conversaciones",saving:"Guardando…",saveFailed:"No se pudo actualizar la denuncia.",unavailable:"Stay Safe BETA: las denuncias aún no están disponibles en Supabase.",retryPin:"No se pudieron cargar las denuncias. Verifica el PIN nuevamente.",more:"Cargar más denuncias",loadingMore:"Cargando más denuncias…",confirm:"¿Cambiar el estado de la denuncia a ",statuses:{pending:"Pendiente",reviewed:"Revisada",resolved:"Resuelta",dismissed:"Descartada"},actions:{pending:"↺ Reabrir",reviewed:"✓ Marcar revisada",resolved:"✓ Resolver",dismissed:"× Descartar"},reasons:["Estafa o solicitudes de dinero","Amenazas o chantaje","Acoso o mensajes no deseados","Perfil o identidad falsa","Amenazas con fotos íntimas","Otro"]},
    "pt-BR":{title:"Denúncia de conversa",by:"Denunciado por",target:"Usuário denunciado",reason:"Motivo",details:"Detalhes adicionais",empty:"Sem detalhes",evidence:"Provas selecionadas",units:"mensagem(ns)",view:"🔐 Abrir no visualizador de moderação existente",unlock:"🔐 Verificar PIN para consultar denúncias",saving:"Salvando…",saveFailed:"Não foi possível atualizar a denúncia.",unavailable:"Stay Safe BETA: as denúncias ainda não estão disponíveis no Supabase.",retryPin:"Não foi possível carregar denúncias. Verifique o PIN novamente.",more:"Carregar mais denúncias",loadingMore:"Carregando mais denúncias…",confirm:"Alterar o status da denúncia para ",statuses:{pending:"Pendente",reviewed:"Revisada",resolved:"Resolvida",dismissed:"Descartada"},actions:{pending:"↺ Reabrir",reviewed:"✓ Marcar como revisada",resolved:"✓ Resolver",dismissed:"× Descartar"},reasons:["Golpe ou pedidos de dinheiro","Ameaças ou chantagem","Assédio ou mensagens indesejadas","Perfil ou identidade falsa","Ameaças com fotos íntimas","Outro"]},
    fr:{title:"Signalement de conversation",by:"Signalé par",target:"Utilisateur signalé",reason:"Motif",details:"Précisions",empty:"Aucun détail",evidence:"Preuves sélectionnées",units:"message(s)",view:"🔐 Ouvrir dans le lecteur de modération existant",unlock:"🔐 Vérifier le code PIN pour consulter les signalements",saving:"Enregistrement…",saveFailed:"Impossible de mettre à jour le signalement.",unavailable:"Stay Safe BÊTA : les signalements ne sont pas encore disponibles dans Supabase.",retryPin:"Impossible de charger les signalements. Vérifie à nouveau le code PIN.",more:"Charger plus de signalements",loadingMore:"Chargement des signalements…",confirm:"Changer le statut du signalement en ",statuses:{pending:"En attente",reviewed:"Examiné",resolved:"Résolu",dismissed:"Rejeté"},actions:{pending:"↺ Rouvrir",reviewed:"✓ Marquer examiné",resolved:"✓ Résoudre",dismissed:"× Rejeter"},reasons:["Arnaque ou demande d'argent","Menaces ou chantage","Harcèlement ou messages indésirables","Faux profil ou fausse identité","Menaces liées aux photos intimes","Autre"]},
    pl:{title:"Zgłoszenie rozmowy",by:"Zgłaszający",target:"Zgłoszony użytkownik",reason:"Powód",details:"Dodatkowe informacje",empty:"Brak szczegółów",evidence:"Wybrane dowody",units:"wiadomość/wiadomości",view:"🔐 Otwórz w istniejącym podglądzie moderacji",unlock:"🔐 Zweryfikuj PIN, aby przejrzeć zgłoszenia",saving:"Zapisywanie…",saveFailed:"Nie udało się zaktualizować zgłoszenia.",unavailable:"Stay Safe BETA: zgłoszenia nie są jeszcze dostępne w Supabase.",retryPin:"Nie udało się pobrać zgłoszeń. Zweryfikuj PIN ponownie.",more:"Wczytaj więcej zgłoszeń",loadingMore:"Wczytywanie zgłoszeń…",confirm:"Zmień status zgłoszenia na ",statuses:{pending:"Oczekujące",reviewed:"Sprawdzone",resolved:"Rozwiązane",dismissed:"Odrzucone"},actions:{pending:"↺ Otwórz ponownie",reviewed:"✓ Oznacz jako sprawdzone",resolved:"✓ Rozwiąż",dismissed:"× Odrzuć"},reasons:["Oszustwo lub prośba o pieniądze","Groźby lub szantaż","Nękanie lub niechciane wiadomości","Fałszywy profil lub tożsamość","Groźby dotyczące intymnych zdjęć","Inne"]},
    de:{title:"Gesprächsmeldung",by:"Gemeldet von",target:"Gemeldeter Nutzer",reason:"Grund",details:"Weitere Angaben",empty:"Keine Angaben",evidence:"Ausgewählte Beweise",units:"Nachricht(en)",view:"🔐 Im vorhandenen Moderationsfenster öffnen",unlock:"🔐 PIN bestätigen, um Meldungen zu prüfen",saving:"Speichern…",saveFailed:"Meldung konnte nicht aktualisiert werden.",unavailable:"Stay Safe BETA: Meldungen sind in Supabase noch nicht verfügbar.",retryPin:"Meldungen konnten nicht geladen werden. Bitte PIN erneut bestätigen.",more:"Weitere Meldungen laden",loadingMore:"Weitere Meldungen werden geladen…",confirm:"Meldungsstatus ändern zu ",statuses:{pending:"Ausstehend",reviewed:"Geprüft",resolved:"Gelöst",dismissed:"Abgewiesen"},actions:{pending:"↺ Wieder öffnen",reviewed:"✓ Als geprüft markieren",resolved:"✓ Lösen",dismissed:"× Abweisen"},reasons:["Betrug oder Geldforderungen","Drohungen oder Erpressung","Belästigung oder unerwünschte Nachrichten","Gefälschtes Profil oder Identität","Drohungen mit intimen Fotos","Sonstiges"]},
    cs:{title:"Nahlášená konverzace",by:"Nahlásil(a)",target:"Nahlášený uživatel",reason:"Důvod",details:"Další podrobnosti",empty:"Bez podrobností",evidence:"Vybrané důkazy",units:"zpráv(a)",view:"🔐 Otevřít ve stávajícím moderátorském prohlížeči",unlock:"🔐 Ověřit PIN pro zobrazení hlášení",saving:"Ukládání…",saveFailed:"Hlášení se nepodařilo aktualizovat.",unavailable:"Stay Safe BETA: hlášení zatím nejsou dostupná v Supabase.",retryPin:"Hlášení se nepodařilo načíst. Ověř PIN znovu.",more:"Načíst další hlášení",loadingMore:"Načítání dalších hlášení…",confirm:"Změnit stav hlášení na ",statuses:{pending:"Čeká",reviewed:"Zkontrolováno",resolved:"Vyřešeno",dismissed:"Zamítnuto"},actions:{pending:"↺ Znovu otevřít",reviewed:"✓ Označit jako zkontrolované",resolved:"✓ Vyřešit",dismissed:"× Zamítnout"},reasons:["Podvod nebo žádosti o peníze","Výhrůžky nebo vydírání","Obtěžování nebo nevyžádané zprávy","Falešný profil nebo identita","Výhrůžky intimními fotografiemi","Jiné"]},
    no:{title:"Samtalerapport",by:"Rapportert av",target:"Rapportert bruker",reason:"Årsak",details:"Flere detaljer",empty:"Ingen detaljer",evidence:"Valgte bevis",units:"melding(er)",view:"🔐 Åpne i eksisterende modereringsvisning",unlock:"🔐 Bekreft PIN for å se rapporter",saving:"Lagrer…",saveFailed:"Kunne ikke oppdatere rapporten.",unavailable:"Stay Safe BETA: rapporter er ennå ikke tilgjengelige i Supabase.",retryPin:"Kunne ikke laste rapporter. Bekreft PIN på nytt.",more:"Last inn flere rapporter",loadingMore:"Laster inn flere rapporter…",confirm:"Endre rapportstatus til ",statuses:{pending:"Venter",reviewed:"Gjennomgått",resolved:"Løst",dismissed:"Avvist"},actions:{pending:"↺ Åpne igjen",reviewed:"✓ Merk som gjennomgått",resolved:"✓ Løs",dismissed:"× Avvis"},reasons:["Svindel eller pengeforespørsler","Trusler eller utpressing","Trakassering eller uønskede meldinger","Falsk profil eller identitet","Trusler knyttet til intime bilder","Annet"]},
    sv:{title:"Konversationsanmälan",by:"Anmält av",target:"Anmäld användare",reason:"Orsak",details:"Ytterligare information",empty:"Inga detaljer",evidence:"Valda bevis",units:"meddelande(n)",view:"🔐 Öppna i befintlig modereringsvy",unlock:"🔐 Verifiera PIN för att granska anmälningar",saving:"Sparar…",saveFailed:"Det gick inte att uppdatera anmälan.",unavailable:"Stay Safe BETA: anmälningar är ännu inte tillgängliga i Supabase.",retryPin:"Det gick inte att läsa in anmälningar. Verifiera PIN igen.",more:"Läs in fler anmälningar",loadingMore:"Läser in fler anmälningar…",confirm:"Ändra anmälans status till ",statuses:{pending:"Väntar",reviewed:"Granskad",resolved:"Löst",dismissed:"Avvisad"},actions:{pending:"↺ Öppna igen",reviewed:"✓ Markera granskad",resolved:"✓ Lös",dismissed:"× Avvisa"},reasons:["Bedrägeri eller begäran om pengar","Hot eller utpressning","Trakasserier eller oönskade meddelanden","Falsk profil eller identitet","Hot med intima bilder","Annat"]},
    it:{title:"Segnalazione conversazione",by:"Segnalato da",target:"Utente segnalato",reason:"Motivo",details:"Dettagli aggiuntivi",empty:"Nessun dettaglio",evidence:"Prove selezionate",units:"messaggio/i",view:"🔐 Apri nel visualizzatore di moderazione esistente",unlock:"🔐 Verifica il PIN per consultare le segnalazioni",saving:"Salvataggio…",saveFailed:"Impossibile aggiornare la segnalazione.",unavailable:"Stay Safe BETA: le segnalazioni non sono ancora disponibili su Supabase.",retryPin:"Impossibile caricare le segnalazioni. Verifica di nuovo il PIN.",more:"Carica altre segnalazioni",loadingMore:"Caricamento segnalazioni…",confirm:"Cambiare lo stato della segnalazione in ",statuses:{pending:"In attesa",reviewed:"Esaminata",resolved:"Risolta",dismissed:"Respinta"},actions:{pending:"↺ Riapri",reviewed:"✓ Segna esaminata",resolved:"✓ Risolvi",dismissed:"× Respingi"},reasons:["Truffa o richieste di denaro","Minacce o ricatto","Molestie o messaggi indesiderati","Profilo o identità falsa","Minacce con foto intime","Altro"]}
  };
  function localized(){
    let code = typeof getFriendHubLanguage==="function" ? String(getFriendHubLanguage()) : "en";
    if (/^pt(-|$)/i.test(code)) code="pt-BR";
    else if (/^(nb|nn|no)(-|$)/i.test(code)) code="no";
    else code=code.split("-")[0].toLowerCase();
    return COPY[code] || COPY.en;
  }
  // Static translations only; safe to expose for independent coverage tests.
  window.XOXOActiveAdminSafetyCopyBeta = Object.freeze(COPY);

  function node(tag,text,className){
    const el=document.createElement(tag);
    if(className)el.className=className;
    el.textContent=text==null?"":String(text);
    return el;
  }
  function adminName(id){
    return typeof xoxoDmAdminName==="function"?xoxoDmAdminName(id):String(id||"Unknown");
  }
  function addReportCard(report,list,adapter,moderationReason,onAuthorizationLost,isStillAuthorized){
    const t=localized();
    const card=node("article","","xmm-report-card");
    card.setAttribute("data-xoxo-conversation-beta-report",report.id);
    const top=node("div","","xmm-report-top");
    top.append(node("strong","🚩 "+t.title+" · "+report.id.slice(0,8)));
    top.append(node("span",t.statuses[report.status]||report.status,"xmm-report-status"));
    card.append(top);
    card.append(node("div",t.by+": "+adminName(report.reporter_id)+" · "+
      t.target+": "+adminName(report.reported_user_id),"xmm-report-meta"));
    const reason=Number.isInteger(report.reason_code) && t.reasons[report.reason_code]
      ? t.reasons[report.reason_code] : report.reason;
    card.append(node("div",t.reason+": "+reason+" · "+
      (report.created_at?new Date(report.created_at).toLocaleString():""),"xmm-report-meta"));
    card.append(node("div",t.details+": "+(report.details?.trim()||t.empty),"xmm-report-details"));
    card.append(node("div",t.evidence+": "+(report.evidence_count??"—")+" "+t.units,"xmm-report-meta"));
    const actions=node("div","","xmm-report-actions");
    const feedback=node("div","","xmm-report-feedback");
    const view=node("button",t.view);
    view.type="button";
    view.addEventListener("click",()=>{
      if(typeof isStillAuthorized==="function"&&!isStillAuthorized())return;
      if(typeof xoxoIsAdmin==="undefined"||!xoxoIsAdmin||
         typeof openXoxoDmConversation!=="function")return;
      // Only reuses the PIN-gated, reason-audited existing viewer.
      openXoxoDmConversation({user_1:report.reporter_id,user_2:report.reported_user_id,message_count:0});
    });
    actions.append(view);
    for(const [status] of statuses){
      if(status===report.status)continue;
      const button=node("button",t.actions[status]);
      button.type="button";
      button.addEventListener("click",async()=>{
        if((typeof isStillAuthorized==="function"&&!isStillAuthorized())||
           typeof xoxoIsAdmin==="undefined"||!xoxoIsAdmin||
           !window.confirm(t.confirm+t.statuses[status]+"?"))return;
        for(const item of actions.querySelectorAll("button"))item.disabled=true;
        feedback.textContent=t.saving;
        const result=await adapter.updateReportStatus(supabaseClient,report,status,moderationReason);
        // A late write response from a previous login/PIN session must never
        // trigger the legacy moderation loader in the NEW session.
        if(typeof isStillAuthorized==="function"&&!isStillAuthorized())return;
        if(result?.ok){await window.loadXoxoDmReports();return;}
        // A PIN may expire while the status request is in flight.
        // Remove private metadata immediately rather than leaving stale rows.
        if(typeof onAuthorizationLost==="function")onAuthorizationLost();
        feedback.textContent=t.saveFailed;
      });
      actions.append(button);
    }
    card.append(actions,feedback);
    list.append(card);
  }
  function install(){
    const adapter=window.XOXOAdminReportQueueBeta;
    const original=window.loadXoxoDmReports;
    if(window.__xoxoAdminReportBridgeBetaInstalled||
       typeof original!=="function"||!adapter?.loadReportQueue)return;
    window.__xoxoAdminReportBridgeBetaInstalled=true;

    let generation=0;
    let insideLegacyLoad=0;
    let cached=[];
    // This only enables attempts to fetch the queue. Actual access is checked
    // by the PIN-protected Supabase RPC on EVERY retrieval.
    let unlocked=false;
    let moderationReason="";
    let pageCursor=null;
    let canLoadMore=false;
    let loadingMore=false;
    // The existing server PIN verification lasts 15 minutes. Hide BETA-only
    // report metadata earlier, without changing the legacy PIN/viewer flow.
    const PIN_DISPLAY_WINDOW_MS=14*60*1000;
    let pinExpiresAt=0;
    let pinExpiryTimer=null;

    function isActiveAdmin(){
      return typeof xoxoIsAdmin!=="undefined" && !!xoxoIsAdmin &&
        !!document.getElementById("xoxoAdminModeration")?.classList.contains("active");
    }
    function reportList(){
      return document.getElementById("xmmReportsList");
    }
    function clearBetaUI(){
      const list=reportList();
      if(!list)return;
      for(const item of list.querySelectorAll("[data-xoxo-conversation-beta-report]"))item.remove();
      for(const item of list.querySelectorAll("[data-xoxo-safety-report-notice]"))item.remove();
      for(const item of list.querySelectorAll("[data-xoxo-safety-load-more]"))item.remove();
    }
    function invalidate(){
      if(pinExpiryTimer!==null && typeof window.clearTimeout==="function")
        window.clearTimeout(pinExpiryTimer);
      pinExpiryTimer=null;
      pinExpiresAt=0;
      ++generation;
      cached=[];
      unlocked=false;
      moderationReason="";
      pageCursor=null;
      canLoadMore=false;
      loadingMore=false;
      clearBetaUI();
      // Never touch cards owned by the existing DM report renderer.
    }
    function isPinWindowActive(){
      if(!unlocked)return false;
      if(!pinExpiresAt || Date.now()>=pinExpiresAt){
        invalidate();
        if(isActiveAdmin())paintUnlockControl();
        return false;
      }
      return true;
    }
    function armPinExpiry(){
      pinExpiresAt=Date.now()+PIN_DISPLAY_WINDOW_MS;
      if(typeof window.setTimeout!=="function")return;
      const deadline=pinExpiresAt;
      pinExpiryTimer=window.setTimeout(()=>{
        if(unlocked && pinExpiresAt===deadline && Date.now()>=deadline)
          isPinWindowActive();
      },PIN_DISPLAY_WINDOW_MS);
      pinExpiryTimer?.unref?.();
    }
    // Supabase Auth events are synchronous notifications. Drop sensitive BETA
    // cards immediately when a session is signed out/switched; incrementing
    // generation means an older, in-flight RPC can NEVER repaint them.
    let accountId=null;
    if(typeof supabaseClient!=="undefined" &&
       typeof supabaseClient?.auth?.onAuthStateChange==="function"){
      supabaseClient.auth.onAuthStateChange((event,session)=>{
        const nextId=typeof session?.user?.id==="string"?session.user.id:null;
        const changed=nextId!==accountId;
        accountId=nextId;
        if(event==="SIGNED_OUT" || event==="SIGNED_IN" ||
           event==="USER_DELETED" || changed){
          invalidate();
          if(isActiveAdmin())paintUnlockControl();
        }
      });
    }

    // Navigating away from the moderator section must not leave a readable
    // snapshot of the previously PIN-authorized report cards in a hidden DOM.
    const moderationArea=document.getElementById("xoxoAdminModeration");
    if(moderationArea && typeof MutationObserver==="function"){
      const guard=new MutationObserver(()=>{
        if(!isActiveAdmin())invalidate();
      });
      guard.observe(moderationArea,{attributes:true,attributeFilter:["class"]});
    }
    if(typeof window.addEventListener==="function"){
      window.addEventListener("pagehide",invalidate);
      // Background browsers can throttle timers; re-check when focused.
      window.addEventListener("focus",()=>{if(unlocked)isPinWindowActive();});
    }
    if(typeof document.addEventListener==="function")
      document.addEventListener("visibilitychange",()=>{
        if(document.visibilityState==="visible" && unlocked)isPinWindowActive();
      });

    function paintUnlockControl(){
      if(!isActiveAdmin())return;
      const list=reportList();
      if(!list)return;
      for(const old of list.querySelectorAll("[data-xoxo-safety-report-unlock]"))old.remove();
      if(unlocked)return;
      const action=node("button",localized().unlock,"xmm-reload");
      action.type="button";
      action.setAttribute("data-xoxo-safety-report-unlock","1");
      action.addEventListener("click",async()=>{
        if(action.disabled || !isActiveAdmin() ||
           typeof xoxoModerationPinAuthorize!=="function")return;
        // A PIN dialog can remain open while the user signs out or switches
        // accounts. Its delayed completion belongs ONLY to this auth epoch.
        const authorizationGeneration=generation;
        const authorizationAccount=accountId;
        const sameAuthorization=()=>authorizationGeneration===generation &&
          authorizationAccount===accountId && isActiveAdmin();
        action.disabled=true;
        try{
          // Reuse the EXACT existing PIN + moderation-reason dialog.
          const authorization=await xoxoModerationPinAuthorize(
            typeof getFriendHubLanguage==="function" && getFriendHubLanguage()==="es");
          if(!sameAuthorization())return;
          const reason=typeof authorization?.reason==="string" ? authorization.reason.trim() : "";
          if(reason.length<10 || reason.length>300)return;
          moderationReason=reason;
          unlocked=true;
          armPinExpiry();
          await window.loadXoxoDmReports();
        }catch{
          // An obsolete dialog must NEVER invalidate a newer account's PIN
          // session; only its own epoch is eligible for error handling.
          if(!sameAuthorization())return;
          invalidate();
          paintUnlockControl();
        }finally{action.disabled=false;}
      });
      list.append(action);
    }
    function paintCachedReports(){
      const list=reportList();
      if(!list||!isActiveAdmin())return;
      if(!isPinWindowActive())return;
      clearBetaUI();
      if(!cached.length)return;
      const empty=Array.from(list.querySelectorAll(".xmm-report-feedback"))
        .find(x=>x.textContent.includes("No private-message reports yet"));
      if(empty)empty.remove();
      const cardGeneration=generation;
      for(const report of cached)addReportCard(report,list,adapter,moderationReason,()=>{
        invalidate();
        if(isActiveAdmin()){paintUnlockControl();showWarning("reauthorize");}
      },()=>isPinWindowActive() && isActiveAdmin() && cardGeneration===generation);
      if(canLoadMore && pageCursor){
        const button=node("button",localized().more,"xmm-reload");
        button.type="button";
        button.setAttribute("data-xoxo-safety-load-more","1");
        button.addEventListener("click",()=>{void loadMoreReportPage();});
        list.append(button);
      }
    }
    async function loadMoreReportPage(){
      if(loadingMore || !isPinWindowActive() || !canLoadMore || !pageCursor ||
         !isActiveAdmin())return;
      const version=++generation;
      const previous=cached.slice();
      const cursor=pageCursor;
      loadingMore=true;
      // Always erase private cached cards before verifying the NEXT server
      // request; each page checks the active session, admin role, PIN and reason.
      cached=[];
      clearBetaUI();
      let page;
      try {
        page=await adapter.loadMoreReports(supabaseClient,{
          moderationReason,cursor,limit:50
        });
      }catch{page={ok:false};}
      // A stale response must not clear the loading lock belonging to a new
      // authenticated admin session.
      if(version!==generation || !isActiveAdmin() || !isPinWindowActive())return;
      loadingMore=false;
      if(!page?.ok || !Array.isArray(page.reports)){
        invalidate();paintUnlockControl();showWarning("reauthorize");
        return;
      }
      const known=new Set(previous.map(r=>r.id.toLowerCase()));
      const unique=page.reports.filter(r=>{
        const id=r.id.toLowerCase();
        if(known.has(id))return false;
        known.add(id);return true;
      });
      cached=previous.concat(unique);
      canLoadMore=page.hasMore;
      pageCursor=page.nextCursor;
      paintCachedReports();
    }
    function showWarning(kind="unavailable"){
      const list=reportList();
      if(!list||!isActiveAdmin())return;
      for(const item of list.querySelectorAll("[data-xoxo-safety-report-notice]"))item.remove();
      const message=node("div",
        kind==="reauthorize"?localized().retryPin:localized().unavailable,
        "xmm-report-feedback");
      message.setAttribute("data-xoxo-safety-report-notice","1");
      list.append(message);
    }
    async function refreshBetaQueue(){
      const version=++generation;
      // CRITICAL: never replay sensitive cached report metadata while the
      // server's PIN authorization is unknown or a new request is pending.
      cached=[];
      pageCursor=null;
      canLoadMore=false;
      clearBetaUI();
      if(!isActiveAdmin()){invalidate();return;}
      if(!isPinWindowActive() || moderationReason.length<10 || moderationReason.length>300){
        invalidate();paintUnlockControl();return;
      }
      let queue;
      try{
        queue=await adapter.loadReportQueue(supabaseClient,{
          includeLegacy:false,moderationReason
        });
      }catch{
        queue={ok:false,reason:"conversation_reports_unavailable"};
      }
      if(version!==generation||!isActiveAdmin()||!isPinWindowActive())return;

      const error=queue?.warning;
      const denied=!queue?.ok || !Array.isArray(queue.reports) ||
        (error && error!=="conversation_reports_not_deployed");
      if(denied){
        // PIN may have expired. Fail closed, purge metadata and allow a new
        // verification; do not present an authorization failure as "empty".
        invalidate();
        paintUnlockControl();
        showWarning("reauthorize");
        return;
      }
      cached=queue.reports.filter(x=>x.source==="conversation_beta");
      // Initial compatibility RPC exposes 100; if full, offer a next page.
      // Its last card supplies the same priority/timestamp/UUID cursor.
      canLoadMore=cached.length===100;
      pageCursor=canLoadMore ? adapter.cursorAfter(cached[cached.length-1]) : null;
      canLoadMore=canLoadMore && !!pageCursor;
      paintCachedReports();
      if(error==="conversation_reports_not_deployed")showWarning();
    }

    // Direct renderer calls can occur after a PIN expires. Re-query the
    // authenticated server every time; cached rows are NEVER repainted first.
    const originalRender=window.renderXoxoDmReports;
    if(typeof originalRender==="function"){
      window.renderXoxoDmReports=function(...args){
        const result=originalRender.apply(this,args);
        cached=[];
        clearBetaUI();
        if(!isActiveAdmin()){invalidate();return result;}
        paintUnlockControl();
        if(!insideLegacyLoad && isPinWindowActive())void refreshBetaQueue();
        return result;
      };
    }

    window.loadXoxoDmReports=async function(...args){
      const version=++generation;
      insideLegacyLoad++;
      try{
        await original.apply(this,args);
      }catch(error){
        // A failure in the legacy loader must also invalidate any report
        // metadata from an earlier PIN session; do not leave it in the DOM.
        invalidate();
        if(isActiveAdmin())paintUnlockControl();
        throw error;
      }finally{
        insideLegacyLoad--;
      }
      if(version!==generation)return;
      if(!isActiveAdmin()){invalidate();return;}
      if(!isPinWindowActive()){
        cached=[];
        clearBetaUI();
        paintUnlockControl();
        return;
      }
      await refreshBetaQueue();
    };
  }
  if(document.readyState==="loading")window.addEventListener("DOMContentLoaded",install,{once:true});
  else install();
})();
