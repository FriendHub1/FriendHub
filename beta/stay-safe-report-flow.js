/* XOXO Avenue — BETA report flow coordinator.
 * Frontend-only; DOES NOT persist or submit reports.
 * Caller must supply authenticated, authorized visible messages.
 */
(function(){
"use strict";
function start({conversationId,currentUserId,otherUserId,locale="es",messages=[],onPrepared}={}){
 if(typeof conversationId!=="string"||!conversationId||typeof currentUserId!=="string"||!currentUserId||typeof otherUserId!=="string"||!otherUserId||typeof onPrepared!=="function"||!Array.isArray(messages))return false;
 const form=window.XOXOReportFormBeta;
 const evidence=window.XOXOEvidencePickerBeta;
 const validator=window.XOXOReportValidationBeta;
 const peer=otherUserId.toLowerCase();
 const self=currentUserId.toLowerCase();
 if(self===peer)return false;
 const available=new Set(messages.filter(m=>m&&typeof m.id==="string"&&typeof m.senderId==="string"&&typeof m.recipientId==="string"&&((m.senderId.toLowerCase()===peer&&m.recipientId.toLowerCase()===self)||(m.senderId.toLowerCase()===self&&m.recipientId.toLowerCase()===peer))).map(m=>m.id));
 if(!form?.open||!evidence?.open||!validator?.validate)return false;
 return form.open({
  conversationId,locale,
  onContinue:report=>{
   evidence.open({
    conversationId,locale,messages,
    onContinue:selection=>{
     // A prepared report is not a submitted report.
     // The host must validate permissions and persist server-side.
     const prepared=Object.freeze({
      otherUserId,
      reasonCode:report.reasonCode,
      details:report.details,
      messageIds:Object.freeze([...selection.messageIds])
     });
     const check=validator.validate(prepared);
     if(!check.ok||selection.messageIds.some(id=>!available.has(id))){console.warn("XOXO BETA report validation failed");return;}
     onPrepared(prepared);
    }
   });
  }
 });
}
window.XOXOReportFlowBeta=Object.freeze({start});
})();