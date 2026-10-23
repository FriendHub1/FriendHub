# XOXO Girl — safe BETA integration checklist

The current pull request deliberately does not replace the 4.8 MB `index.html` with a potentially stale upload.

## Required edits in the CURRENT branch index.html

1. Immediately after `notifications = data || [];` inside `async function loadNotifications()`, add:

```js
window.XOXOGirlIntegration?.receive(notifications, currentUser.id);
```

2. Before the closing `</body>` tag, load these scripts in order:

```html
<script defer src="/xoxo-girl-voice-alerts.js"></script>
<script defer src="/xoxo-girl-notification-integration.js"></script>
```

3. Confirm `#notificationPanel .notification-panel-header` exists; this is where the opt-in switch is inserted.

4. Confirm assets for both JS files are included in the Cloudflare Worker static asset deployment. Test in BETA only; never merge or deploy production without approval.

## Browser verification

- OFF by default; no speech or chime until explicit user activation.
- With voice ON, preview button announces a sample after the browser audio gesture.
- Existing unread notifications do not announce when first opening the page.
- A genuinely new notification announces once; reloading the page must not replay it.
- Secret Letters and Jewels never announce.
- Sign out and sign into a different account; no cross-account notification replay.
- Verify iOS Safari requires a user gesture before audio can play.
