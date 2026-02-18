'use strict';

// Import Express so we can create a router
const express = require('express');

// Create a new router instance
const router = express.Router();

/*
  Helper function to parse cookies manually.
  Express does not automatically parse cookies unless you use cookie-parser.
  This extracts cookies from the request header into a usable object.
*/
function parseCookies(req) {
  // Grab raw Cookie header string (may be undefined)
  const header = req.headers.cookie || '';

  // Object that will hold parsed cookies
  const out = {};

  // Split cookies by ";", trim spaces, remove empty entries
  header
    .split(';')
    .map(s => s.trim())
    .filter(Boolean)
    .forEach(pair => {
      const i = pair.indexOf('=');

      // If no "=" exists, treat value as empty string
      const key = i === -1 ? pair : pair.slice(0, i);
      const value = i === -1 ? '' : pair.slice(i + 1);

      // Decode in case cookie was URL encoded
      out[decodeURIComponent(key)] = decodeURIComponent(value);
    });

  return out;
}

/*
  POST /telemetry
  This endpoint receives telemetry events from the browser.
*/
router.post('/telemetry', express.json({ limit: '50kb' }), (req, res) => {

  // Parse cookies from request
  const cookies = parseCookies(req);

  /*
    SERVER-SIDE CONSENT ENFORCEMENT

    If analytics_consent cookie is NOT "granted",
    we silently drop the event and return 204.

    This guarantees opt-out is real even if someone
    tries to manually POST telemetry.
  */
  if (cookies.analytics_consent !== 'granted') {
    return res.status(204).end();
  }

  // Extract request body (sent from browser JS)
  const body = req.body || {};

  // Basic validation: must have event name
  if (typeof body.event !== 'string') {
    return res.status(400).json({ error: 'Invalid event name' });
  }

  /*
    Build a clean event object.

    IMPORTANT:
    We do NOT trust the client blindly.
    We sanitize and limit fields.
  */
  const event = {
    event: String(body.event).slice(0, 64), // Limit event name length
    client_ts: typeof body.ts === 'string' ? body.ts : null, // Timestamp from browser
    server_ts: new Date().toISOString(), // Timestamp from server (reliable ordering)
    aid: cookies.aid || null, // Analytics ID from cookie (only exists if opted in)
    path: typeof body.url === 'string'
      ? new URL(body.url).pathname // Store only path, not full URL
      : null,
    ref: typeof body.ref === 'string' ? body.ref : null,
    props: (body.props && typeof body.props === 'object') ? body.props : {},
  };

  /*
    For now we log it.
    Replace this with database storage, queue, etc.
  */
  console.log(JSON.stringify({
    type: "client_telemetry",
    ts: new Date().toISOString(),
    ...event
  }));

  // Respond with 204 No Content (success, nothing returned)
  return res.status(204).end();
});

// Export router so Express can use it
module.exports = router;
