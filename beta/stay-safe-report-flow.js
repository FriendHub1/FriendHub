/* XOXO Avenue — BETA report flow coordinator.
 * Frontend-only; DOES NOT persist or submit reports.
 * Caller must supply authenticated, authorized visible messages.
 */
(function(){
"use strict";
function start({conversationId,locale="es",messages=[],onPrepared}={}){
 if(typeof conversationId!=="string"||!conversationId||typeof onPrepared!=="function"||!Array.isArray(messages))return false;
 const form=window.XOXOReportFormBeta;
 const evidence=window.XOXOEvidencePickerBeta;
 if(!form?.open||!evidence?.open)return false;
 return form.open({
  conversationId,locale,
  onContinue:report=>{
   evidence.open({
    conversationId,locale,messages,
    onContinue:selection=>{
     // A prepared report is not a submitted report.
     // The host must validate permissions and persist server-side.
     onPrepared(Object.freeze({
      conversationId,
      reasonCode:report.reasonCode,
      details:report.details,
      messageIds:Object.freeze([...selection.messageIds])
     }));
    }
   });
  }
 });
}
window.XOXOReportFlowBeta=Object.freeze({start});
})();