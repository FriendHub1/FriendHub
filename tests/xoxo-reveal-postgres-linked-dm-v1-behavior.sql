-- Executed only after disposable database guard in setup.
DO $t$
DECLARE s uuid:='11111111-1111-4111-8111-111111111111';
 r uuid:='22222222-2222-4222-8222-222222222222';
 a uuid:='55555555-5555-4555-8555-555555555555';
 c uuid:='66666666-6666-4666-8666-666666666666';
 x record; denied boolean;
BEGIN
 INSERT INTO public.xoxo_reveal_upload_attempts(id,sender_id,claim_token,status,writer_state,payload_fingerprint)
 VALUES(a,s,c,'pending','sealed','fingerprint');
 INSERT INTO public.xoxo_reveal_upload_objects(attempt_id,sender_id,bucket_id,object_path,payload_fingerprint)
 VALUES(a,s,'xoxo-reveal','private/one.webp','fingerprint');
 INSERT INTO public.xoxo_reveal_quota_reservations(upload_attempt_id,sender_id) VALUES(a,s);
 INSERT INTO public.message_requests(sender_id,recipient_id,status) VALUES(s,r,'accepted');
 PERFORM set_config('request.jwt.claim.role','authenticated',true);
 denied:=false;
 BEGIN
  PERFORM * FROM public.xoxo_reveal_create_linked_dm_v1(a,c,s,r,'private/one.webp','image','once',NULL);
 EXCEPTION WHEN OTHERS THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Non-service role was allowed'; END IF;
 PERFORM set_config('request.jwt.claim.role','service_role',true);
 denied:=false;
 BEGIN
  PERFORM * FROM public.xoxo_reveal_create_linked_dm_v1(a,'77777777-7777-4777-8777-777777777777',s,r,'private/one.webp','image','once',NULL);
 EXCEPTION WHEN OTHERS THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Wrong claim token was allowed'; END IF;
 INSERT INTO public.user_blocks(blocker_id,blocked_id) VALUES(r,s);
 denied:=false;
 BEGIN
  PERFORM * FROM public.xoxo_reveal_create_linked_dm_v1(a,c,s,r,'private/one.webp','image','once',NULL);
 EXCEPTION WHEN OTHERS THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Blocked recipient was allowed'; END IF;
 DELETE FROM public.user_blocks;
 SELECT * INTO x FROM public.xoxo_reveal_create_linked_dm_v1(a,c,s,r,'private/one.webp','image','once',NULL);
 IF x.reveal_id IS NULL OR x.dm_id IS NULL THEN RAISE EXCEPTION 'Missing linked IDs'; END IF;
 IF (SELECT count(*) FROM public.xoxo_reveals WHERE dm_id=x.dm_id)<>1
  OR (SELECT count(*) FROM public.direct_messages WHERE id=x.dm_id)<>1
 THEN RAISE EXCEPTION 'Linked records missing'; END IF;
 denied:=false;
 BEGIN
  PERFORM * FROM public.xoxo_reveal_create_linked_dm_v1(a,c,s,r,'private/one.webp','image','once',NULL);
 EXCEPTION WHEN OTHERS THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Duplicate private object was allowed'; END IF;
 IF (SELECT count(*) FROM public.direct_messages)<>1 THEN RAISE EXCEPTION 'Partial DM persisted after failed duplicate'; END IF;
 -- A different path for the SAME sealed upload attempt must also be denied.
 INSERT INTO public.xoxo_reveal_upload_objects(attempt_id,sender_id,bucket_id,object_path,payload_fingerprint)
 VALUES(a,s,'xoxo-reveal','private/second.webp','fingerprint');
 denied:=false;
 BEGIN
  PERFORM * FROM public.xoxo_reveal_create_linked_dm_v1(a,c,s,r,'private/second.webp','image','once',NULL);
 EXCEPTION WHEN OTHERS THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Reused upload attempt was allowed with a different path'; END IF;
 IF (SELECT count(*) FROM public.direct_messages)<>1 THEN RAISE EXCEPTION 'Reused attempt created an orphan DM'; END IF;
END $t$;
