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
    if(window.__xoxoAdminReportBridgeBetaInstalled||typeof original!=="function"||!adapter?.loadReportQueue)return;
    window.__xoxoAdminReportBridgeBetaInstalled=true;
    let generation=0;
    let cached=[];
    function isActiveAdmin(){
      return typeof xoxoIsAdmin!=="undefined" && !!xoxoIsAdmin &&
        !!document.getElementById("xoxoAdminModeration")?.classList.contains("active");
    }
    function paintCachedReports(){
      if(!isActiveAdmin())return;
      const list=document.getElementById("xmmReportsList");
      if(!list)return;
      // The legacy renderer owns legacy cards. Remove only previously
      // appended BETA cards, so repeated panel renders never duplicate them.
      for(const card of list.querySelectorAll("[data-xoxo-conversation-beta-report]"))card.remove();
      if(!cached.length)return;
      const empty=Array.from(list.querySelectorAll(".xmm-report-feedback"))
        .find(x=>x.textContent.includes("No private-message reports yet"));
      if(empty)empty.remove();
      for(const report of cached)addReportCard(report,list,adapter);
    }
    // The existing admin dashboard may call renderXoxoDmReports() directly,
    // clearing the DOM without refreshing. Reapply only cached BETA cards.
    const originalRender=window.renderXoxoDmReports;
    if(typeof originalRender==="function"){
      window.renderXoxoDmReports=function(...args){
        const result=originalRender.apply(this,args);
        paintCachedReports();
        return result;
      };
    }
    window.loadXoxoDmReports=async function(...args){
      const version=++generation;
      await original.apply(this,args);
      if(!isActiveAdmin())return;
      const queue=await adapter.loadReportQueue(supabaseClient,{includeLegacy:false});
      if(version!==generation||!isActiveAdmin())return;
      // Fail closed: do not show stale BETA reports after a failed refresh.
      cached=queue?.ok && Array.isArray(queue.reports)
        ? queue.reports.filter(x=>x.source==="conversation_beta") : [];
      paintCachedReports();
    };
  }
  if(document.readyState==="loading")window.addEventListener("DOMContentLoaded",install,{once:true});
  else install();
})();
