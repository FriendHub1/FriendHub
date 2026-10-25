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
    en:{title:"Conversation report",by:"Reported by",target:"Reported user",reason:"Reason",details:"Additional details",empty:"None provided",evidence:"Selected evidence",units:"message(s)",view:"🔐 Open existing conversation viewer",unlock:"🔐 Verify PIN to review conversation reports",saving:"Saving…",saveFailed:"Could not update report.",unavailable:"Stay Safe BETA: conversation reports are not available in Supabase yet.",retryPin:"Could not load reports. Verify your PIN again.",confirm:"Change this report to ",statuses:{pending:"Pending",reviewed:"Reviewed",resolved:"Resolved",dismissed:"Dismissed"},actions:{pending:"↺ Reopen",reviewed:"✓ Mark reviewed",resolved:"✓ Resolve",dismissed:"× Dismiss"},reasons:["Scam or money requests","Threats or blackmail","Harassment or unwanted messages","Fake profile or identity","Intimate photo threats","Other"]},
    es:{title:"Denuncia de conversación",by:"Denunciante",target:"Usuario denunciado",reason:"Motivo",details:"Detalles adicionales",empty:"Sin detalles",evidence:"Pruebas seleccionadas",units:"mensaje(s)",view:"🔐 Abrir en el visor de moderación existente",unlock:"🔐 Verificar PIN para revisar denuncias de conversaciones",saving:"Guardando…",saveFailed:"No se pudo actualizar la denuncia.",unavailable:"Stay Safe BETA: las denuncias aún no están disponibles en Supabase.",retryPin:"No se pudieron cargar las denuncias. Verifica el PIN nuevamente.",confirm:"¿Cambiar el estado de la denuncia a ",statuses:{pending:"Pendiente",reviewed:"Revisada",resolved:"Resuelta",dismissed:"Descartada"},actions:{pending:"↺ Reabrir",reviewed:"✓ Marcar revisada",resolved:"✓ Resolver",dismissed:"× Descartar"},reasons:["Estafa o solicitudes de dinero","Amenazas o chantaje","Acoso o mensajes no deseados","Perfil o identidad falsa","Amenazas con fotos íntimas","Otro"]},
    "pt-BR":{title:"Denúncia de conversa",by:"Denunciado por",target:"Usuário denunciado",reason:"Motivo",details:"Detalhes adicionais",empty:"Sem detalhes",evidence:"Provas selecionadas",units:"mensagem(ns)",view:"🔐 Abrir no visualizador de moderação existente",unlock:"🔐 Verificar PIN para consultar denúncias",saving:"Salvando…",saveFailed:"Não foi possível atualizar a denúncia.",unavailable:"Stay Safe BETA: as denúncias ainda não estão disponíveis no Supabase.",retryPin:"Não foi possível carregar denúncias. Verifique o PIN novamente.",confirm:"Alterar o status da denúncia para ",statuses:{pending:"Pendente",reviewed:"Revisada",resolved:"Resolvida",dismissed:"Descartada"},actions:{pending:"↺ Reabrir",reviewed:"✓ Marcar como revisada",resolved:"✓ Resolver",dismissed:"× Descartar"},reasons:["Golpe ou pedidos de dinheiro","Ameaças ou chantagem","Assédio ou mensagens indesejadas","Perfil ou identidade falsa","Ameaças com fotos íntimas","Outro"]},
    fr:{title:"Signalement de conversation",by:"Signalé par",target:"Utilisateur signalé",reason:"Motif",details:"Précisions",empty:"Aucun détail",evidence:"Preuves sélectionnées",units:"message(s)",view:"🔐 Ouvrir dans le lecteur de modération existant",unlock:"🔐 Vérifier le code PIN pour consulter les signalements",saving:"Enregistrement…",saveFailed:"Impossible de mettre à jour le signalement.",unavailable:"Stay Safe BÊTA : les signalements ne sont pas encore disponibles dans Supabase.",retryPin:"Impossible de charger les signalements. Vérifie à nouveau le code PIN.",confirm:"Changer le statut du signalement en ",statuses:{pending:"En attente",reviewed:"Examiné",resolved:"Résolu",dismissed:"Rejeté"},actions:{pending:"↺ Rouvrir",reviewed:"✓ Marquer examiné",resolved:"✓ Résoudre",dismissed:"× Rejeter"},reasons:["Arnaque ou demande d'argent","Menaces ou chantage","Harcèlement ou messages indésirables","Faux profil ou fausse identité","Menaces liées aux photos intimes","Autre"]},
    pl:{title:"Zgłoszenie rozmowy",by:"Zgłaszający",target:"Zgłoszony użytkownik",reason:"Powód",details:"Dodatkowe informacje",empty:"Brak szczegółów",evidence:"Wybrane dowody",units:"wiadomość/wiadomości",view:"🔐 Otwórz w istniejącym podglądzie moderacji",unlock:"🔐 Zweryfikuj PIN, aby przejrzeć zgłoszenia",saving:"Zapisywanie…",saveFailed:"Nie udało się zaktualizować zgłoszenia.",unavailable:"Stay Safe BETA: zgłoszenia nie są jeszcze dostępne w Supabase.",retryPin:"Nie udało się pobrać zgłoszeń. Zweryfikuj PIN ponownie.",confirm:"Zmień status zgłoszenia na ",statuses:{pending:"Oczekujące",reviewed:"Sprawdzone",resolved:"Rozwiązane",dismissed:"Odrzucone"},actions:{pending:"↺ Otwórz ponownie",reviewed:"✓ Oznacz jako sprawdzone",resolved:"✓ Rozwiąż",dismissed:"× Odrzuć"},reasons:["Oszustwo lub prośba o pieniądze","Groźby lub szantaż","Nękanie lub niechciane wiadomości","Fałszywy profil lub tożsamość","Groźby dotyczące intymnych zdjęć","Inne"]},
    de:{title:"Gesprächsmeldung",by:"Gemeldet von",target:"Gemeldeter Nutzer",reason:"Grund",details:"Weitere Angaben",empty:"Keine Angaben",evidence:"Ausgewählte Beweise",units:"Nachricht(en)",view:"🔐 Im vorhandenen Moderationsfenster öffnen",unlock:"🔐 PIN bestätigen, um Meldungen zu prüfen",saving:"Speichern…",saveFailed:"Meldung konnte nicht aktualisiert werden.",unavailable:"Stay Safe BETA: Meldungen sind in Supabase noch nicht verfügbar.",retryPin:"Meldungen konnten nicht geladen werden. Bitte PIN erneut bestätigen.",confirm:"Meldungsstatus ändern zu ",statuses:{pending:"Ausstehend",reviewed:"Geprüft",resolved:"Gelöst",dismissed:"Abgewiesen"},actions:{pending:"↺ Wieder öffnen",reviewed:"✓ Als geprüft markieren",resolved:"✓ Lösen",dismissed:"× Abweisen"},reasons:["Betrug oder Geldforderungen","Drohungen oder Erpressung","Belästigung oder unerwünschte Nachrichten","Gefälschtes Profil oder Identität","Drohungen mit intimen Fotos","Sonstiges"]},
    cs:{title:"Nahlášená konverzace",by:"Nahlásil(a)",target:"Nahlášený uživatel",reason:"Důvod",details:"Další podrobnosti",empty:"Bez podrobností",evidence:"Vybrané důkazy",units:"zpráv(a)",view:"🔐 Otevřít ve stávajícím moderátorském prohlížeči",unlock:"🔐 Ověřit PIN pro zobrazení hlášení",saving:"Ukládání…",saveFailed:"Hlášení se nepodařilo aktualizovat.",unavailable:"Stay Safe BETA: hlášení zatím nejsou dostupná v Supabase.",retryPin:"Hlášení se nepodařilo načíst. Ověř PIN znovu.",confirm:"Změnit stav hlášení na ",statuses:{pending:"Čeká",reviewed:"Zkontrolováno",resolved:"Vyřešeno",dismissed:"Zamítnuto"},actions:{pending:"↺ Znovu otevřít",reviewed:"✓ Označit jako zkontrolované",resolved:"✓ Vyřešit",dismissed:"× Zamítnout"},reasons:["Podvod nebo žádosti o peníze","Výhrůžky nebo vydírání","Obtěžování nebo nevyžádané zprávy","Falešný profil nebo identita","Výhrůžky intimními fotografiemi","Jiné"]},
    no:{title:"Samtalerapport",by:"Rapportert av",target:"Rapportert bruker",reason:"Årsak",details:"Flere detaljer",empty:"Ingen detaljer",evidence:"Valgte bevis",units:"melding(er)",view:"🔐 Åpne i eksisterende modereringsvisning",unlock:"🔐 Bekreft PIN for å se rapporter",saving:"Lagrer…",saveFailed:"Kunne ikke oppdatere rapporten.",unavailable:"Stay Safe BETA: rapporter er ennå ikke tilgjengelige i Supabase.",retryPin:"Kunne ikke laste rapporter. Bekreft PIN på nytt.",confirm:"Endre rapportstatus til ",statuses:{pending:"Venter",reviewed:"Gjennomgått",resolved:"Løst",dismissed:"Avvist"},actions:{pending:"↺ Åpne igjen",reviewed:"✓ Merk som gjennomgått",resolved:"✓ Løs",dismissed:"× Avvis"},reasons:["Svindel eller pengeforespørsler","Trusler eller utpressing","Trakassering eller uønskede meldinger","Falsk profil eller identitet","Trusler knyttet til intime bilder","Annet"]},
    sv:{title:"Konversationsanmälan",by:"Anmält av",target:"Anmäld användare",reason:"Orsak",details:"Ytterligare information",empty:"Inga detaljer",evidence:"Valda bevis",units:"meddelande(n)",view:"🔐 Öppna i befintlig modereringsvy",unlock:"🔐 Verifiera PIN för att granska anmälningar",saving:"Sparar…",saveFailed:"Det gick inte att uppdatera anmälan.",unavailable:"Stay Safe BETA: anmälningar är ännu inte tillgängliga i Supabase.",retryPin:"Det gick inte att läsa in anmälningar. Verifiera PIN igen.",confirm:"Ändra anmälans status till ",statuses:{pending:"Väntar",reviewed:"Granskad",resolved:"Löst",dismissed:"Avvisad"},actions:{pending:"↺ Öppna igen",reviewed:"✓ Markera granskad",resolved:"✓ Lös",dismissed:"× Avvisa"},reasons:["Bedrägeri eller begäran om pengar","Hot eller utpressning","Trakasserier eller oönskade meddelanden","Falsk profil eller identitet","Hot med intima bilder","Annat"]},
    it:{title:"Segnalazione conversazione",by:"Segnalato da",target:"Utente segnalato",reason:"Motivo",details:"Dettagli aggiuntivi",empty:"Nessun dettaglio",evidence:"Prove selezionate",units:"messaggio/i",view:"🔐 Apri nel visualizzatore di moderazione esistente",unlock:"🔐 Verifica il PIN per consultare le segnalazioni",saving:"Salvataggio…",saveFailed:"Impossibile aggiornare la segnalazione.",unavailable:"Stay Safe BETA: le segnalazioni non sono ancora disponibili su Supabase.",retryPin:"Impossibile caricare le segnalazioni. Verifica di nuovo il PIN.",confirm:"Cambiare lo stato della segnalazione in ",statuses:{pending:"In attesa",reviewed:"Esaminata",resolved:"Risolta",dismissed:"Respinta"},actions:{pending:"↺ Riapri",reviewed:"✓ Segna esaminata",resolved:"✓ Risolvi",dismissed:"× Respingi"},reasons:["Truffa o richieste di denaro","Minacce o ricatto","Molestie o messaggi indesiderati","Profilo o identità falsa","Minacce con foto intime","Altro"]}
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
  function addReportCard(report,list,adapter){
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
        if(typeof xoxoIsAdmin==="undefined"||!xoxoIsAdmin||
           !window.confirm(t.confirm+t.statuses[status]+"?"))return;
        for(const item of actions.querySelectorAll("button"))item.disabled=true;
        feedback.textContent=t.saving;
        const result=await adapter.updateReportStatus(supabaseClient,report,status);
        if(result?.ok){await window.loadXoxoDmReports();return;}
        feedback.textContent=t.saveFailed;
        for(const item of actions.querySelectorAll("button"))item.disabled=false;
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
    }
    function invalidate(){
      ++generation;
      cached=[];
      unlocked=false;
      clearBetaUI();
      // Never touch cards owned by the existing DM report renderer.
    }
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
        if(!isActiveAdmin()||typeof xoxoModerationPinAuthorize!=="function")return;
        action.disabled=true;
        try{
          // Reuse the EXACT existing PIN + moderation-reason dialog.
          const authorization=await xoxoModerationPinAuthorize(
            typeof getFriendHubLanguage==="function" && getFriendHubLanguage()==="es");
          if(!authorization?.reason || !isActiveAdmin())return;
          unlocked=true;
          await window.loadXoxoDmReports();
        }catch{
          // PIN failure must not leave a locally unlocked queue.
          invalidate();
          paintUnlockControl();
        }finally{action.disabled=false;}
      });
      list.append(action);
    }
    function paintCachedReports(){
      const list=reportList();
      if(!list||!isActiveAdmin())return;
      clearBetaUI();
      if(!cached.length)return;
      const empty=Array.from(list.querySelectorAll(".xmm-report-feedback"))
        .find(x=>x.textContent.includes("No private-message reports yet"));
      if(empty)empty.remove();
      for(const report of cached)addReportCard(report,list,adapter);
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
      clearBetaUI();
      if(!isActiveAdmin()){invalidate();return;}
      if(!unlocked){paintUnlockControl();return;}
      let queue;
      try{
        queue=await adapter.loadReportQueue(supabaseClient,{includeLegacy:false});
      }catch{
        queue={ok:false,reason:"conversation_reports_unavailable"};
      }
      if(version!==generation||!isActiveAdmin())return;

      const error=queue?.warning;
      const denied=!queue?.ok || !Array.isArray(queue.reports) ||
        (error && error!=="conversation_reports_not_deployed");
      if(denied){
        // PIN may have expired. Fail closed, purge metadata and allow a new
        // verification; do not present an authorization failure as "empty".
        unlocked=false;
        cached=[];
        paintUnlockControl();
        showWarning("reauthorize");
        return;
      }
      cached=queue.reports.filter(x=>x.source==="conversation_beta");
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
        if(!insideLegacyLoad && unlocked)void refreshBetaQueue();
        return result;
      };
    }

    window.loadXoxoDmReports=async function(...args){
      const version=++generation;
      insideLegacyLoad++;
      try{
        await original.apply(this,args);
      }finally{
        insideLegacyLoad--;
      }
      if(version!==generation)return;
      if(!isActiveAdmin()){invalidate();return;}
      if(!unlocked){
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
