// XOXO Reveal BETA — safe PostgreSQL test-target preflight.
// No connection is made here. Real runner must ALSO enforce isolation
// and verify the database identity before applying ANY SQL.
export function assessIsolatedPostgresTarget({url,environment}={}){
 if(environment!=="isolated-test")
  return {allowed:false,reason:"isolated_environment_required"};
 if(typeof url!=="string")
  return {allowed:false,reason:"missing_database_url"};
 let parsed;
 try{parsed=new URL(url);}catch{return {allowed:false,reason:"invalid_database_url"};}
 if(!["postgres:","postgresql:"].includes(parsed.protocol))
  return {allowed:false,reason:"postgres_protocol_required"};
 const host=parsed.hostname.toLowerCase();
 if(!["localhost","127.0.0.1","::1"].includes(host))
  return {allowed:false,reason:"non_local_database_forbidden"};
 if(!parsed.pathname||parsed.pathname==="/")
  return {allowed:false,reason:"dedicated_test_database_required"};
 const db=decodeURIComponent(parsed.pathname.slice(1));
 if(!/^xoxo_reveal_test_[a-z0-9_]+$/.test(db))
  return {allowed:false,reason:"dedicated_test_database_required"};
 if(parsed.search||parsed.hash)
  return {allowed:false,reason:"unexpected_connection_options"};
 return {allowed:true,reason:"local_test_target_only"};
}
// URL checks alone do not prove the database is disposable or that localhost
// is not tunneled to production. The actual runner must inspect DB identity,
// restrict privileges, use disposable infrastructure and never execute against
// the user's live Supabase project.
