// XOXO Reveal BETA — mirrors existing direct_messages INSERT eligibility.
// This module generates a parameterized SQL predicate for review; it does NOT
// grant permissions or write to the production database.
export const REVEAL_DM_ELIGIBILITY_SQL = `
  sender_id = auth.uid()
  AND sender_id <> recipient_id
  AND public.xoxo_has_existing_dm_or_acceptance(sender_id, recipient_id)
  AND NOT EXISTS (
    SELECT 1 FROM public.user_blocks b
    WHERE (b.blocker_id=sender_id AND b.blocked_id=recipient_id)
       OR (b.blocker_id=recipient_id AND b.blocked_id=sender_id)
  )
  AND (
    (NOT public.sl_is_beta_tester(sender_id)
      AND NOT public.sl_is_beta_tester(recipient_id))
    OR public.sl_users_are_matched(sender_id, recipient_id)
    OR public.xoxo_has_existing_dm_or_acceptance(sender_id, recipient_id)
  )
`.trim();

// Server upload handler must evaluate this against a database row with
// server-verified auth.uid(), never a sender_id asserted by a browser.
// Verify function permissions/search_path before adopting in a SECURITY
// DEFINER RPC; prefer reusing the actual DM INSERT RLS when feasible.
// Existing eligibility may change; audit policy again before deployment.
export function evaluateRevealDmEligibility({
  authenticatedSenderId, senderId, recipientId,
  hasExistingDmOrAcceptance, senderBlocksRecipient, recipientBlocksSender,
  senderIsSecretLetterTester, recipientIsSecretLetterTester, secretLetterMatched
}) {
  if (!authenticatedSenderId || !senderId || !recipientId ||
      authenticatedSenderId!==senderId || senderId===recipientId) return false;
  if (!hasExistingDmOrAcceptance || senderBlocksRecipient || recipientBlocksSender) return false;
  return ((!senderIsSecretLetterTester && !recipientIsSecretLetterTester) ||
    !!secretLetterMatched || !!hasExistingDmOrAcceptance);
}
