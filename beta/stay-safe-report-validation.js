/* XOXO Avenue — local validation before server submission.
 * This does NOT authorize access or submit anything. Backend must revalidate.
 */
(function(){
"use strict";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VALID_CODES=new Set([0,1,2,3,4,5]);
function validate(input){
 const errors=[];
 if(!input||typeof input!=="object"||Array.isArray(input))return {ok:false,errors:["invalid_payload"]};
 if(!UUID.test(input.otherUserId||""))errors.push("invalid_other_user_id");
 if(!Number.isInteger(input.reasonCode)||!VALID_CODES.has(input.reasonCode))errors.push("invalid_reason");
 if(typeof input.details!=="string"||input.details.length>2000)errors.push("invalid_details");
 if(!Array.isArray(input.messageIds)||input.messageIds.length<1||input.messageIds.length>20)errors.push("invalid_evidence_count");
 else if(input.messageIds.some(id=>typeof id!=="string"||!UUID.test(id))||new Set(input.messageIds).size!==input.messageIds.length)errors.push("invalid_message_ids");
 return {ok:errors.length===0,errors};
}
window.XOXOReportValidationBeta=Object.freeze({validate});
})();