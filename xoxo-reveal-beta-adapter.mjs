// Beta adapter: injected RPC client, no deployment or database changes.
export function createRevealAdapter(client) {
  if (typeof client?.rpc !== "function") throw new TypeError("Missing RPC client");
  async function invoke(method, parameters) {
    const result = await client.rpc(method, parameters);
    if (result.error) throw new Error(result.error.message || "Request failed");
    const row = Array.isArray(result.data) ? result.data[0] : result.data;
    if (!row) throw new Error("Empty result");
    return row;
  }
  return {
    prepare(id) {
      return invoke("xoxo_reveal_prepare_v1", {p_reveal_id:id});
    },
    start(id, token) {
      return invoke("xoxo_reveal_start_v1", {p_reveal_id:id,p_preparation_id:token});
    }
  };
}
