/* ==========================================================================
   auth.js  -  role session and top bar chrome
   No passwords: clicking a role button on index.html is the whole login.
   The session is {role, userId} in localStorage.
   ========================================================================== */

(function (global) {
  'use strict';

  var ROLES = [
    {
      key: 'Admin', page: 'admin.html', accent: 'var(--blue)',
      blurb: 'Full visibility. Revenue, cost, margin, products, users and the GHL sync log.',
      icon: 'M3 20h18M5 20V9l7-5 7 5v11M9 20v-6h6v6'
    },
    {
      key: 'Sales Rep', page: 'sales-rep.html', accent: 'var(--gold)',
      label: 'Sales Rep / Estimator',
      blurb: 'Own pipeline, estimate builder with Good/Better/Best, e-signature, commission tracker.',
      icon: 'M4 19V5a1 1 0 011-1h9l6 6v9a1 1 0 01-1 1H5a1 1 0 01-1-1zM14 4v6h6M8 13h8M8 17h5'
    },
    {
      key: 'CSR', page: 'csr.html', accent: 'var(--slate)',
      blurb: 'Intake and booking. Early-stage leads, outreach notes, appointments. No money anywhere.',
      icon: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z'
    },
    {
      key: 'Installer', page: 'installer.html', accent: 'var(--moss)',
      blurb: 'Today on the truck. Assigned jobs, scope of work, status updates, job photos.',
      icon: 'M3 13h11v5H3zM14 9h4l3 4v5h-7zM7 21a2 2 0 100-4 2 2 0 000 4zM18 21a2 2 0 100-4 2 2 0 000 4z'
    }
  ];

  function roleDef(key) {
    for (var i = 0; i < ROLES.length; i++) if (ROLES[i].key === key) return ROLES[i];
    return null;
  }

  function defaultUserFor(role) {
    var users = global.DB.load().users;
    for (var i = 0; i < users.length; i++) if (users[i].role === role) return users[i];
    return null;
  }

  function usersWithRole(role) {
    return global.DB.load().users.filter(function (u) { return u.role === role; });
  }

  function session() {
    var raw = global.DB.Storage.get(global.DB.SESSION_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  function login(role, userId) {
    var u = userId ? global.DB.user(userId) : defaultUserFor(role);
    var s = { role: role, userId: u ? u.id : null, at: new Date().toISOString() };
    global.DB.Storage.set(global.DB.SESSION_KEY, JSON.stringify(s));
    return s;
  }

  function logout() { global.DB.Storage.remove(global.DB.SESSION_KEY); }

  function currentUser() {
    var s = session();
    return s && s.userId ? global.DB.user(s.userId) : null;
  }

  function role() { var s = session(); return s ? s.role : null; }

  /* Permission gate. Cost, margin and commission are Admin-only; the views
     consult this before BUILDING the nodes, so the numbers never reach the
     DOM for the other roles. See the note in estimator.js. */
  var can = {
    viewCost: function () { return role() === 'Admin'; },
    viewMargin: function () { return role() === 'Admin'; },
    viewPrice: function () { return role() === 'Admin' || role() === 'Sales Rep'; },
    viewOwnCommission: function () { return role() === 'Sales Rep' || role() === 'Admin'; },
    manageProducts: function () { return role() === 'Admin'; },
    manageUsers: function () { return role() === 'Admin'; }
  };

  /* Page guard. Send anyone without the right session back to the login. */
  function require(expectedRole) {
    var s = session();
    if (!s || s.role !== expectedRole) {
      location.replace('index.html');
      return null;
    }
    if (!s.userId) {
      var u = defaultUserFor(expectedRole);
      if (u) { s = login(expectedRole, u.id); }
    }
    return s;
  }

  /* ------------------------------------------------------------------
     Switch Role.
     DEMO AFFORDANCE: a real deployment would never let a signed-in user
     change their own role from the header. It lives here so whoever is
     running the demo can jump between the four views without logging out.
     ------------------------------------------------------------------ */
  function switchRoleDialog() {
    var UI = global.UI;
    var wrap = UI.el('div', {});

    wrap.appendChild(UI.el('p', {
      class: 't-sub',
      text: 'Demo control. Pick a role to view the same data through different eyes.'
    }));

    ROLES.forEach(function (r) {
      var people = usersWithRole(r.key);
      var row = UI.el('div', { class: 'panel', style: 'margin-bottom:10px' }, [
        UI.el('div', { class: 'panel-body tight' }, [
          UI.el('div', { class: 'spread' }, [
            UI.el('div', {}, [
              UI.el('div', { style: 'font-weight:600', text: r.label || r.key }),
              UI.el('div', { class: 't-meta', text: people.map(function (p) { return p.name; }).join(', ') || 'No user seeded' })
            ]),
            UI.el('div', { class: 'row' }, people.length > 1
              ? people.map(function (p) {
                  return UI.el('button', {
                    class: 'btn btn-sm', text: p.name.split(' ')[0],
                    onclick: function () { login(r.key, p.id); location.href = r.page; }
                  });
                })
              : [UI.el('button', {
                  class: 'btn btn-sm btn-primary', text: 'Open',
                  onclick: function () { login(r.key, people[0] && people[0].id); location.href = r.page; }
                })])
          ])
        ])
      ]);
      wrap.appendChild(row);
    });

    UI.modal({
      title: 'Switch Role',
      subtitle: 'Prototype demo control, not a real permission change',
      body: wrap,
      actions: [
        { label: 'Sign out', tone: 'btn-ghost', onClick: function () { logout(); location.href = 'index.html'; } },
        { label: 'Stay here', tone: 'btn-primary' }
      ]
    });
  }

  /* ------------------------------------------------------------------
     Top bar chrome.
     One mountHeader call dresses the top bar on every page: logo, where you
     are, the page's own actions, the signed-in user. The destinations
     themselves live in the page's tab strip (#nav), which is why this does
     not build them: each role declares its own in the markup.
     ------------------------------------------------------------------ */
  var ICON_SWAP = 'M7 4v13m0 0l-3-3m3 3l3-3M17 20V7m0 0l3 3m-3-3l-3 3';

  function svgIcon(d, size) {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.8');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    if (size) { svg.setAttribute('width', size); svg.setAttribute('height', size); }
    var p = document.createElementNS(ns, 'path');
    p.setAttribute('d', d);
    svg.appendChild(p);
    return svg;
  }

  function initialsOf(name) {
    var parts = String(name || '').trim().split(/\s+/);
    var a = (parts[0] || '')[0] || '';
    var b = (parts[1] || '')[0] || '';
    return (a + b).toUpperCase() || 'JJ';
  }

  /* Renders the sticky top bar. The destinations stay in the page markup so
     each role can declare its own set. */
  function mountHeader(headerEl, opts) {
    opts = opts || {};
    var UI = global.UI;
    var u = currentUser();
    var r = role();
    var def = roleDef(r) || {};
    var roleLabel = def.label || r || '';
    var nav = document.getElementById('nav');
    var firstNav = nav ? nav.querySelector('button') : null;
    var firstLabel = firstNav ? (firstNav.dataset.title || firstNav.textContent).trim() : null;

    UI.clear(headerEl);

    headerEl.appendChild(UI.el('a', {
      class: 'bar-logo', href: 'index.html', 'aria-label': 'J&J Flooring World'
    }, [UI.el('img', { src: 'assets/jj-logo.png', alt: 'J&J Flooring World' })]));

    headerEl.appendChild(UI.el('span', { class: 'bar-rule' }));

    headerEl.appendChild(UI.el('div', { class: 'crumb-wrap' }, [
      UI.el('div', { class: 'crumb', text: opts.title || firstLabel || roleLabel }),
      UI.el('div', { class: 'crumb-sub', text: roleLabel + (u ? ', ' + u.name : '') })
    ]));

    headerEl.appendChild(UI.el('span', { class: 'spacer' }));

    (opts.extras || []).forEach(function (n) { headerEl.appendChild(n); });

    headerEl.appendChild(UI.el('button', {
      class: 'bar-btn', title: 'Switch role (demo control)',
      onclick: switchRoleDialog
    }, [
      svgIcon(ICON_SWAP),
      UI.el('span', { class: 'lbl', text: 'Switch Role' })
    ]));

    headerEl.appendChild(UI.el('span', { class: 'bar-rule' }));

    headerEl.appendChild(UI.el('div', {
      class: 'bar-user',
      title: (u ? u.name : 'Not signed in') + ', ' + roleLabel
    }, [UI.el('span', { class: 'bar-avatar', text: initialsOf(u && u.name) })]));
  }

  global.Auth = {
    ROLES: ROLES,
    svgIcon: svgIcon,
    roleDef: roleDef,
    usersWithRole: usersWithRole,
    defaultUserFor: defaultUserFor,
    session: session,
    login: login,
    logout: logout,
    currentUser: currentUser,
    role: role,
    can: can,
    require: require,
    mountHeader: mountHeader,
    switchRoleDialog: switchRoleDialog
  };

})(window);
