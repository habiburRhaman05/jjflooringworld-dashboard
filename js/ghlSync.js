/* ==========================================================================
   ghlSync.js  -  GoHighLevel sync stub
   --------------------------------------------------------------------------
   THIS IS A STUB. No network calls are made anywhere in this file.
   Every function appends a readable entry to the in-app Sync Activity Log
   (Admin only) and mirrors it to console.

   When the real private-integration token exists, the ONLY change needed is
   inside `transport()`: replace the log-and-return with a fetch() to the GHL
   v2 API. Every caller elsewhere in the app stays exactly as written.

       async function transport(direction, event, payload) {
         return fetch('https://services.leadconnectorhq.com/' + routeFor(event), {
           method: 'POST',
           headers: {
             'Authorization': 'Bearer ' + GHL_TOKEN,
             'Version': '2021-07-28',
             'Content-Type': 'application/json'
           },
           body: JSON.stringify(payload)
         });
       }
   ========================================================================== */

(function (global) {
  'use strict';

  var MAX_ENTRIES = 200;
  var listeners = [];

  function transport(direction, event, message, payload) {
    // --- swap this body for the real API call later ---
    var arrow = direction === 'out' ? 'App → GHL' : 'GHL → App';
    if (global.console) {
      console.log('[ghlSync] ' + arrow + ' | ' + event, payload || '');
    }
    return { ok: true, stub: true, event: event, direction: direction };
  }

  function record(direction, event, message, payload) {
    var db = global.DB.load();
    db.syncLog = db.syncLog || [];
    var arrow = direction === 'out' ? 'App → GHL: ' : 'GHL → App: ';
    var entry = {
      id: global.DB.uid('sync'),
      at: new Date().toISOString(),
      dir: direction,
      event: event,
      message: arrow + message,
      payload: payload || null
    };
    db.syncLog.unshift(entry);
    if (db.syncLog.length > MAX_ENTRIES) db.syncLog.length = MAX_ENTRIES;
    global.DB.save();

    transport(direction, event, message, payload);
    listeners.forEach(function (fn) { try { fn(entry); } catch (e) {} });
    return entry;
  }

  var GHLSync = {
    /* Outbound: something in this app should be pushed to GHL. */
    syncAppToGHL: function (event, payload, message) {
      return record('out', event, message || describe(event, payload), payload);
    },
    /* Inbound: GHL told us something (webhook or poll). */
    syncGHLToApp: function (event, payload, message) {
      return record('in', event, message || describe(event, payload), payload);
    },

    /* Short aliases used throughout the app. */
    out: function (event, message, payload) { return record('out', event, message, payload); },
    'in': function (event, message, payload) { return record('in', event, message, payload); },

    entries: function () { return (global.DB.load().syncLog || []).slice(); },
    clear: function () {
      var db = global.DB.load();
      db.syncLog = [];
      global.DB.save();
    },
    onEntry: function (fn) { listeners.push(fn); }
  };

  function describe(event, payload) {
    var id = payload && (payload.id || payload.name) ? " (" + (payload.name || payload.id) + ")" : '';
    return event + id;
  }

  global.GHLSync = GHLSync;

})(window);
