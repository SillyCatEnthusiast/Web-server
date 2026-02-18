(function () {
  'use strict';

  /*
    Everything in this file runs in the browser.
    It is responsible for:
      - Managing consent
      - Creating analytics ID
      - Sending events
      - Stopping everything when opted out
  */

  // ---------------------------
  // Cookie helpers
  // ---------------------------

  function setCookie(name, value, days) {
    // Convert days to seconds
    var maxAge = days ? '; Max-Age=' + (days * 24 * 60 * 60) : '';

    /*
      SameSite=Lax:
        Prevents cross-site request leakage
      Secure:
        Only sent over HTTPS
    */
    document.cookie =
      encodeURIComponent(name) + '=' + encodeURIComponent(value) +
      maxAge + '; Path=/; SameSite=Lax; Secure';
  }

  function getCookie(name) {
    var needle = encodeURIComponent(name) + '=';
    var parts = document.cookie.split('; ');

    for (var i = 0; i < parts.length; i++) {
      if (parts[i].indexOf(needle) === 0) {
        return decodeURIComponent(parts[i].slice(needle.length));
      }
    }
    return null;
  }

  function deleteCookie(name) {
    // Max-Age=0 deletes immediately
    document.cookie =
      encodeURIComponent(name) +
      '=; Max-Age=0; Path=/; SameSite=Lax; Secure';
  }

  // ---------------------------
  // Privacy signals
  // ---------------------------

  /*
    Respect browser privacy flags automatically.
    If enabled, treat as opt-out.
  */
  function hasDntOrGpc() {
    var dnt = navigator.doNotTrack || window.doNotTrack || navigator.msDoNotTrack;
    var dntOn = (dnt === '1' || dnt === 'yes');
    var gpcOn = (navigator.globalPrivacyControl === true);
    return dntOn || gpcOn;
  }

  function consentStatus() {
    if (hasDntOrGpc()) return 'denied';
    return getCookie('analytics_consent') || 'unset';
  }

  // ---------------------------
  // Analytics ID
  // ---------------------------

  /*
    Generates a random ID ONLY if consent granted.
    This ID allows recognizing returning browsers.
  */
  function ensureAid() {
    var aid = getCookie('aid');

    if (!aid) {
      // Prefer cryptographically secure UUID if available
      aid = (window.crypto && crypto.randomUUID)
        ? crypto.randomUUID()
        : String(Math.random()).slice(2);

      setCookie('aid', aid, 180);
    }

    return aid;
  }

  // ---------------------------
  // Send event to server
  // ---------------------------

  function send(eventName, props) {

    // HARD GATE: do nothing unless consent granted
    if (consentStatus() !== 'granted') return;

    // Ensure analytics ID exists
    ensureAid();

    // Construct event payload
    var payload = {
      event: eventName,
      ts: new Date().toISOString(),
      url: location.href,
      ref: document.referrer || null,
      props: props || {}
    };

    var body = JSON.stringify(payload);

    /*
      sendBeacon is ideal for telemetry.
      It works during page unload and does not block navigation.
    */
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/telemetry',
        new Blob([body], { type: 'application/json' })
      );
    } else {
      // Fallback for older browsers
      fetch('/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
        keepalive: true,
        credentials: 'omit'
      }).catch(function () {});
    }
  }

  // ---------------------------
  // Public API for banner
  // ---------------------------

  window.analytics = {

    // User accepts analytics
    accept: function () {
      setCookie('analytics_consent', 'granted', 180);

      // Immediately send a page_view
      send('page_view', { first_after_consent: true });
    },

    // User rejects analytics
    reject: function () {
      setCookie('analytics_consent', 'denied', 180);

      // Delete analytics identifier
      deleteCookie('aid');
    },

    status: function () {
      return consentStatus();
    },

    track: send
  };

  // Auto-send page_view only if already opted in
  if (consentStatus() === 'granted') {
    send('page_view', {});
  }

})();
