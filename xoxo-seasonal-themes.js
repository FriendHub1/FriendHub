/* XOXO Seasonal Themes — automatic, lightweight, no storage or paid services.
   Public username profile pages are intentionally left untouched to protect shared profile designs. */
(function () {
  "use strict";
  try {
    var path = window.location.pathname || "/";
    var reserved = /^(about|discover|privacy|terms|guidelines|api|u|post|profile-preview-image|post-preview-image|assets|beta|favicon\.ico|robots\.txt|sitemap\.xml)$/i;
    var route = path.replace(/^\/+|\/+$/g, "");
    var isUsernameProfile = /^\/?[A-Za-z0-9][A-Za-z0-9._-]{0,29}\/?$/.test(path) && !reserved.test(route);
    if (isUsernameProfile) return;

    var now = new Date();
    var month = now.getMonth(); // Browser-local calendar, no external service.
    var day = now.getDate();
    var season = "spring";
    var palette = {
      halloween: { colors: "#8d48ff,#ff8b35,#f6dfff", symbols: "🎃 ✦ 👻" },
      autumn:    { colors: "#a66b86,#d6a64c,#f3d7b5", symbols: "🍂 ✦ 💛" },
      winter:    { colors: "#9d8aff,#d8eaff,#fff7ff", symbols: "❄️ ✦ ✨" },
      love:      { colors: "#b56bff,#ff77b7,#ffd76a", symbols: "💘 ✦ 💜" },
      spring:    { colors: "#ba8bff,#ffb9d8,#e7f4b0", symbols: "🌸 ✦ ✨" },
      summer:    { colors: "#9b65ff,#ff8e8e,#ffdb6e", symbols: "☀️ ✦ 💫" }
    };

    if (month === 9) season = "halloween";            // October
    else if (month === 10) season = "autumn";         // November
    else if (month === 11 || month === 0) season = "winter"; // December–January
    else if (month === 1) season = "love";            // February
    else if (month >= 2 && month <= 4) season = "spring"; // March–May
    else if (month >= 5 && month <= 7) season = "summer"; // June–August
    else season = "autumn";                           // September

    var chosen = palette[season];
    if (!chosen || document.getElementById("xoxo-seasonal-themes-style")) return;
    document.documentElement.setAttribute("data-xoxo-season", season);

    var style = document.createElement("style");
    style.id = "xoxo-seasonal-themes-style";
    style.textContent =
      'html[data-xoxo-season]::before{' +
        'content:"";position:fixed;top:0;left:0;right:0;height:3px;' +
        'background:linear-gradient(90deg,' + chosen.colors + ');' +
        'pointer-events:none;z-index:2147483646}' +
      'html[data-xoxo-season]::after{' +
        'content:"' + chosen.symbols + '";position:fixed;right:12px;bottom:76px;' +
        'font-size:17px;letter-spacing:3px;opacity:.38;pointer-events:none;' +
        'z-index:2147483645;white-space:nowrap;filter:drop-shadow(0 1px 5px rgba(120,70,160,.18))}' +
      '@media(max-width:600px){html[data-xoxo-season]::after{display:none}}' +
      '@media(prefers-reduced-motion:reduce){html[data-xoxo-season]::after{filter:none}}';
    (document.head || document.documentElement).appendChild(style);
  } catch (error) {
    // Seasonal decoration must never interfere with the main site.
    console.warn("XOXO Seasonal Themes skipped:", error);
  }
})();