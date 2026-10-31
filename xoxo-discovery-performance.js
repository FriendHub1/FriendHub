/* XOXO Avenue — discovery and public-profile loading optimizations */
(function () {
  "use strict";
  if (window.__xoxoDiscoveryPerformanceLoaded) return;
  window.__xoxoDiscoveryPerformanceLoaded = true;

  function languageIsSpanish() {
    try { return typeof getFriendHubLanguage === "function" && getFriendHubLanguage() === "es"; }
    catch (_) { return false; }
  }

  async function loadFriendSuggestionsFast() {
    const section = document.getElementById("friendSuggestionsSection");
    const list = document.getElementById("friendSuggestionsList");
    if (!section || !list) return;
    if (typeof currentUser === "undefined" || !currentUser?.id) {
      section.style.display = "none";
      list.innerHTML = "";
      return;
    }

    const myId = String(currentUser.id);
    const token = String(Date.now()) + Math.random();
    list.dataset.loadToken = token;
    const hadCards = !!list.querySelector(".friend-suggestion-card");
    if (!hadCards) {
      section.style.display = "";
      list.innerHTML = '<div class="empty-state">' +
        (languageIsSpanish() ? "Buscando nuevas conexiones..." : "Finding new connections...") +
        "</div>";
    }

    try {
      const [followingResult, blockedResult] = await Promise.all([
        supabaseClient.from("user_follows").select("following_id").eq("follower_id", myId),
        supabaseClient.from("user_blocks").select("blocked_id").eq("blocker_id", myId)
      ]);
      if (followingResult.error) throw followingResult.error;

      const alreadyFollowing = new Set((followingResult.data || []).map(row => String(row.following_id)));
      const blockedIds = new Set(!blockedResult.error
        ? (blockedResult.data || []).map(row => String(row.blocked_id))
        : []);
      const firstDegree = [...alreadyFollowing];

      const secondDegreePromise = firstDegree.length
        ? supabaseClient.from("user_follows")
            .select("follower_id, following_id")
            .in("follower_id", firstDegree)
        : Promise.resolve({ data: [], error: null });
      const fallbackPromise = supabaseClient.from("friendhub_public_profiles")
        .select("user_id, username, country, profile_photo")
        .limit(36);

      const [secondDegreeResult, fallbackResult] = await Promise.all([
        secondDegreePromise, fallbackPromise
      ]);
      if (secondDegreeResult.error) throw secondDegreeResult.error;
      if (fallbackResult.error) throw fallbackResult.error;

      const mutualCounts = new Map();
      for (const row of secondDegreeResult.data || []) {
        const candidateId = String(row.following_id || "");
        if (!candidateId || candidateId === myId || alreadyFollowing.has(candidateId) || blockedIds.has(candidateId)) continue;
        mutualCounts.set(candidateId, (mutualCounts.get(candidateId) || 0) + 1);
      }

      const candidateIds = [...mutualCounts.keys()];
      let profiles = [];
      if (candidateIds.length && typeof getCachedPublicProfiles === "function") {
        const result = await getCachedPublicProfiles(candidateIds, ["username", "country", "profile_photo"]);
        if (result.error) throw result.error;
        profiles = result.data || [];
      }

      const seen = new Set(profiles.map(profile => String(profile.user_id)));
      for (const profile of fallbackResult.data || []) {
        const id = String(profile.user_id || "");
        if (!id || id === myId || alreadyFollowing.has(id) || blockedIds.has(id) || seen.has(id)) continue;
        profiles.push(profile);
        seen.add(id);
        if (profiles.length >= 6) break;
      }

      profiles.sort((a, b) =>
        (mutualCounts.get(String(b.user_id)) || 0) -
        (mutualCounts.get(String(a.user_id)) || 0)
      );
      profiles = profiles.slice(0, 6);

      if (list.dataset.loadToken !== token) return;
      list.dataset.loadToken = "";
      if (!profiles.length) {
        section.style.display = "none";
        list.innerHTML = "";
        return;
      }

      const es = languageIsSpanish();
      list.innerHTML = profiles.map(profile => {
        const id = String(profile.user_id);
        const username = profile.username || "@User";
        const initial = escapeHtml(username.replace("@", "").charAt(0).toUpperCase() || "U");
        const bubbleAvatar = typeof xoxoBubbleImg === "function"
          ? xoxoBubbleImg(id, username)
          : initial;
        const bubbleUrl = typeof xoxoBubbleUrl === "function"
          ? escapeHtmlAttribute(xoxoBubbleUrl(id, username))
          : "";
        const avatar = profile.profile_photo
          ? '<img src="' + escapeHtmlAttribute(profile.profile_photo) + '" alt="Profile photo" loading="lazy"' +
            (bubbleUrl ? ' onerror="this.onerror=null;this.src=&quot;' + bubbleUrl + '&quot;"' : '') + '>'
          : bubbleAvatar;
        const mutual = mutualCounts.get(id) || 0;
        const reason = mutual > 0
          ? mutual + " " + (es ? (mutual === 1 ? "conexión en común" : "conexiones en común") : (mutual === 1 ? "mutual connection" : "mutual connections"))
          : (es ? "Sugerencia de XOXO Avenue" : "XOXO Avenue suggestion");
        const safeId = escapeHtmlAttribute(id);
        return '<div class="friend-suggestion-card" data-suggestion-user="' + safeId + '">' +
          '<button class="friend-suggestion-profile" type="button" onclick="openPublicProfile(\'' + safeId + '\')">' +
          '<span class="friend-suggestion-avatar">' + avatar + '</span>' +
          '<span><span class="friend-suggestion-name">' + escapeHtml(username) + '</span>' +
          '<span class="friend-suggestion-reason">' + escapeHtml(reason) + '</span></span></button>' +
          '<div class="friend-suggestion-actions">' +
          '<button class="btn btn-primary" type="button" onclick="followFriendSuggestion(\'' + safeId + '\', this)">' + (es ? "Seguir" : "Follow") + '</button>' +
          '<button class="btn btn-secondary" type="button" onclick="openPublicProfile(\'' + safeId + '\')">' + (es ? "Perfil" : "Profile") + '</button>' +
          '</div></div>';
      }).join("");
      section.style.display = "";
    } catch (error) {
      console.error("Optimized friend suggestions error:", error);
      if (list.dataset.loadToken === token) {
        list.dataset.loadToken = "";
        if (!hadCards) {
          section.style.display = "none";
          list.innerHTML = "";
        }
      }
    }
  }

  function installPublicProfilePrefetch() {
    if (typeof supabaseClient === "undefined" || !supabaseClient || supabaseClient.__xoxoProfilePrefetchInstalled) return;
    const originalRpc = supabaseClient.rpc.bind(supabaseClient);
    const pending = new Map();
    const keyFor = (name, args) => name + ":" + String(args?.target_user_id || "");
    supabaseClient.rpc = function (name, args, options) {
      const key = keyFor(name, args);
      if ((name === "get_public_post_count" || name === "record_profile_view") && pending.has(key)) {
        const promise = pending.get(key);
        pending.delete(key);
        return promise;
      }
      return originalRpc(name, args, options);
    };
    supabaseClient.__xoxoProfilePrefetchInstalled = true;

    function prefetch(userId) {
      const id = String(userId || "");
      if (!id) return;
      const args = { target_user_id: id };
      const countKey = keyFor("get_public_post_count", args);
      if (!pending.has(countKey)) pending.set(countKey, originalRpc("get_public_post_count", args));
      if (typeof currentUser !== "undefined" && currentUser?.id && String(currentUser.id) !== id) {
        const visitKey = keyFor("record_profile_view", args);
        if (!pending.has(visitKey)) pending.set(visitKey, originalRpc("record_profile_view", args));
      }
      setTimeout(() => {
        pending.delete(countKey);
        pending.delete(keyFor("record_profile_view", args));
      }, 30000);
    }

    const originalOpen = window.openPublicProfile;
    if (typeof originalOpen === "function" && !originalOpen.__xoxoPrefetchWrapped) {
      const wrapped = function (userId) {
        prefetch(userId);
        return originalOpen.apply(this, arguments);
      };
      wrapped.__xoxoPrefetchWrapped = true;
      window.openPublicProfile = wrapped;
    }
  }

  window.loadFriendSuggestions = loadFriendSuggestionsFast;
  installPublicProfilePrefetch();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installPublicProfilePrefetch, { once: true });
  }
})();