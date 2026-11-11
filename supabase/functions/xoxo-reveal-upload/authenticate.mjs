// XOXO Reveal BETA — server-side authentication boundary, NOT DEPLOYED.
// Verifies the bearer token using an injected trusted Supabase Auth client.
// Never accept senderId from a browser payload.
export async function authenticateRevealSender({authorization,authClient}) {
  if(typeof authClient?.auth?.getUser!=="function") throw new TypeError("Trusted Auth client required");
  if(typeof authorization!=="string" || !/^Bearer [A-Za-z0-9._~+/-]+={0,2}$/.test(authorization))
    throw new Error("Authentication required");
  const token=authorization.slice(7);
  const {data,error}=await authClient.auth.getUser(token);
  const user=data?.user;
  if(error || !user?.id || typeof user.id!=="string") throw new Error("Invalid authentication");
  return {senderId:user.id};
}
// This is only one boundary. An actual Edge handler must still validate origin,
// body length, authorization for recipient, rate limits and service-role isolation.
