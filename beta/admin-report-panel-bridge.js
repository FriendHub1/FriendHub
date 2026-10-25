/* XOXO Avenue BETA — adds conversation reports to the existing admin report
 * section without altering the existing PIN-protected conversation viewer.
 * Only loaded by an opt-in BETA preview; server RPC permissions still apply.
 */
(function(){
  "use strict";
  if(typeof window==="undefined")return;
  const statuses=[["reviewed","✓ Mark reviewed"],["resolved","✓ Resolve"],["dismissed","× Dismiss"],["pending","↺ Reopen"]];
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
    const card=node("article","","xmm-report-card");
    card.setAttribute("data-xoxo-conversation-beta-report",report.id);
    const top=node("div","","xmm-report-top");
    top.append(node("strong","🚩 Conversation report · "+report.id.slice(0,8)));
    top.append(node("span",report.status.toUpperCase(),"xmm-report-status"));
    card.append(top);
    card.append(node("div","Reported by: "+adminName(report.reporter_id)+" · Reported user: "+adminName(report.reported_user_id),"xmm-report-meta"));
    card.append(node("div","Reason: "+report.reason+" · "+(report.created_at?new Date(report.created_at).toLocaleString():""),"xmm-report-meta"));
    card.append(node("div","Additional details: "+(report.details?.trim()||"None provided"),"xmm-report-details"));
    card.append(node("div","Explicitly selected evidence: "+(report.evidence_count??"—")+" message(s)","xmm-report-meta"));
    const actions=node("div","","xmm-report-actions");
    const feedback=node("div","","xmm-report-feedback");
    const view=node("button","🔐 Open existing conversation viewer");
    view.type="button";
    view.addEventListener("click",()=>{
      if(typeof xoxoIsAdmin==="undefined"||!xoxoIsAdmin||typeof openXoxoDmConversation!=="function")return;
      // Always reuses the site's existing PIN gate and audited server RPC.
      openXoxoDmConversation({user_1:report.reporter_id,user_2:report.reported_user_id,message_count:0});
    });
    actions.append(view);
    for(const [status,label] of statuses){
      if(status===report.status)continue;
      const button=node("button",label);
      button.type="button";
      button.addEventListener("click",async()=>{
        if(typeof xoxoIsAdmin==="undefined"||!xoxoIsAdmin||!window.confirm("Change this report to "+status+"?"))return;
        for(const item of actions.querySelectorAll("button"))item.disabled=true;
        feedback.textContent="Saving…";
        const result=await adapter.updateReportStatus(supabaseClient,report,status);
        if(result?.ok){await window.loadXoxoDmReports();return;}
        feedback.textContent="Could not update report.";
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
      const action=node("button",
        typeof getFriendHubLanguage==="function" && getFriendHubLanguage()==="es"
          ? "🔐 Verificar PIN para consultar denuncias de conversaciones"
          : "🔐 Verify PIN to review conversation reports",
        "xmm-reload");
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
    function showWarning(){
      const list=reportList();
      if(!list||!isActiveAdmin())return;
      for(const item of list.querySelectorAll("[data-xoxo-safety-report-notice]"))item.remove();
      const message=node("div",
        "Stay Safe BETA: conversation reports are not available in Supabase yet.",
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
        showWarning();
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
