import baseWorker from "./worker-preview-wrapper.js";

export default {
  async fetch(request, env, ctx) {
    const response = await baseWorker.fetch(request, env, ctx);
    const type = String(response.headers.get("content-type") || "").toLowerCase();
    if (request.method !== "GET" || !type.includes("text/html")) return response;

    const rewritten = new HTMLRewriter()
      .on("head", {
        element(element) {
          element.append('<script src="/xoxo-streaks.js?v=20261031f" defer></script>', { html: true });
        }
      })
      .transform(response);

    return new Response(rewritten.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
  }
};
