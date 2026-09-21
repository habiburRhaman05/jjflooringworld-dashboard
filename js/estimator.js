/* ==========================================================================
   estimator.js  -  product picker, Good/Better/Best builder, e-signature
   --------------------------------------------------------------------------
   PERMISSIONS NOTE
   The builder is shared by Admin and Sales Rep. Every cost and margin node
   is created inside an `if (showCost)` branch, so for a Sales Rep session
   those numbers are never written into the document at all. Searching the
   rendered DOM for a cost value in a rep session returns nothing. This is a
   render-layer rule, not a CSS rule: there is no hidden element to unhide.
   ========================================================================== */

(function (global) {
  'use strict';

  var UI = global.UI;
  var TIER_CLASS = { Good: 'good', Better: 'better', Best: 'best' };

  /* ------------------------------------------------------------------
     Builder
     ------------------------------------------------------------------ */
  function openBuilder(opts) {
    opts = opts || {};
    var db = global.DB.load();
    var showCost = global.Auth.can.viewCost();

    var existing = opts.estimateId ? global.DB.estimate(opts.estimateId) : null;
    var state = {
      leadId: opts.leadId || (existing && existing.leadId) || '',
      repId: opts.repId || (existing && existing.repId) || (global.Auth.currentUser() || {}).id,
      depositPercent: existing ? existing.depositPercent : 30,
      activeTier: 'Better',
      tiers: existing
        ? JSON.parse(JSON.stringify(existing.tiers))
        : { Good: [], Better: [], Best: [] }
    };

    var body = UI.el('div', { class: 'builder' });
    var leftCol = UI.el('div', {});
    var rightCol = UI.el('div', {});
    body.appendChild(leftCol);
    body.appendChild(rightCol);

    /* --- lead + deposit ---------------------------------------------- */
    var leadSelect = UI.el('select', { class: 'select', onchange: function () { state.leadId = leadSelect.value; } });
    var candidates = db.leads.filter(function (l) {
      if (global.Auth.role() === 'Sales Rep' && l.assignedRepId !== state.repId) return false;
      return l.stage !== 'Lost';
    });
    leadSelect.appendChild(UI.el('option', { value: '', text: 'Select a customer' }));
    candidates.forEach(function (l) {
      leadSelect.appendChild(UI.el('option', { value: l.id, text: l.name + ', ' + l.zipCode + ', ' + l.stage }));
    });
    if (state.leadId) leadSelect.value = state.leadId;

    var depositInput = UI.el('input', {
      class: 'input', type: 'number', min: '0', max: '100', step: '5',
      value: String(state.depositPercent),
      oninput: function () { state.depositPercent = Number(depositInput.value) || 0; renderTiers(); }
    });

    leftCol.appendChild(UI.el('div', { class: 'field-row' }, [
      UI.el('label', { class: 'field grow' }, [UI.el('span', { class: 'label', text: 'Customer' }), leadSelect]),
      UI.el('label', { class: 'field', style: 'flex:0 0 140px' }, [UI.el('span', { class: 'label', text: 'Deposit %' }), depositInput])
    ]));

    /* --- catalog ------------------------------------------------------ */
    var search = UI.el('input', { class: 'input', type: 'search', placeholder: 'Search products' });
    var catFilter = UI.el('select', { class: 'select' });
    catFilter.appendChild(UI.el('option', { value: '', text: 'All categories' }));
    global.DB.PRODUCT_CATEGORIES.forEach(function (c) {
      catFilter.appendChild(UI.el('option', { value: c, text: c }));
    });

    var catalog = UI.el('div', { class: 'catalog' });

    function renderCatalog() {
      UI.clear(catalog);
      var q = search.value.trim().toLowerCase();
      var cat = catFilter.value;
      var list = global.DB.load().products.filter(function (p) {
        if (!p.active) return false;
        if (cat && p.category !== cat) return false;
        if (q && p.name.toLowerCase().indexOf(q) === -1 && p.category.toLowerCase().indexOf(q) === -1) return false;
        return true;
      });
      if (!list.length) {
        catalog.appendChild(UI.el('div', { style: 'padding:16px' }, [UI.empty('No match', 'No product in the catalog matches that search.')]));
        return;
      }
      list.forEach(function (p) {
        var meta = p.category + ' (per ' + p.unit + ')' + (p.tier ? ', ' + p.tier : '');
        var right = [UI.el('span', { class: 'cp', text: UI.money2(p.pricePerUnit) })];
        // Cost is only ever put on screen for Admin.
        if (showCost) {
          right.push(UI.el('span', { class: 'cp muted t-meta', text: 'cost ' + UI.money2(p.costPerUnit) }));
        }
        catalog.appendChild(UI.el('div', { class: 'cat-row' }, [
          UI.el('div', { class: 'grow' }, [
            UI.el('div', { class: 'cn', text: p.name }),
            UI.el('div', { class: 'cm', text: meta })
          ])
        ].concat(right).concat([
          UI.el('button', {
            class: 'btn btn-sm btn-primary', text: 'Add',
            title: 'Add to the ' + state.activeTier + ' tier',
            onclick: function () { addLine(p.id); }
          })
        ])));
      });
    }

    search.addEventListener('input', renderCatalog);
    catFilter.addEventListener('change', renderCatalog);

    var tierSeg = UI.el('div', { class: 'seg' });
    global.DB.TIERS.forEach(function (t) {
      tierSeg.appendChild(UI.el('button', {
        type: 'button', text: t, 'aria-pressed': String(t === state.activeTier),
        onclick: function () {
          state.activeTier = t;
          UI.$$('button', tierSeg).forEach(function (b) { b.setAttribute('aria-pressed', String(b.textContent === t)); });
          renderCatalog();
        }
      }));
    });

    leftCol.appendChild(UI.el('div', { class: 'panel' }, [
      UI.el('div', { class: 'panel-head' }, [
        UI.el('h3', { text: 'Products' }),
        UI.el('div', { class: 'row' }, [UI.el('span', { class: 't-meta', text: 'Adding to' }), tierSeg])
      ]),
      UI.el('div', { class: 'panel-body tight' }, [
        UI.el('div', { class: 'field-row', style: 'margin-bottom:10px' }, [
          UI.el('div', { class: 'field grow', style: 'margin-bottom:0' }, [search]),
          UI.el('div', { class: 'field', style: 'flex:0 0 165px;margin-bottom:0' }, [catFilter])
        ]),
        catalog
      ])
    ]));

    /* --- tiers -------------------------------------------------------- */
    var tiersMount = UI.el('div', {});
    rightCol.appendChild(UI.el('div', { class: 'panel' }, [
      UI.el('div', { class: 'panel-head' }, [
        UI.el('h3', { text: 'Estimate tiers' }),
        UI.el('span', { class: 't-meta', text: 'Good / Better / Best' })
      ]),
      UI.el('div', { class: 'panel-body tight' }, [tiersMount])
    ]));

    function addLine(productId) {
      var lines = state.tiers[state.activeTier];
      var found = null;
      lines.forEach(function (l) { if (l.productId === productId) found = l; });
      if (found) found.qty = Number(found.qty) + 1;
      else lines.push({ productId: productId, qty: 1 });
      renderTiers();
      UI.toast(global.DB.product(productId).name + ' added to ' + state.activeTier + '.', 'ok', 1800);
    }

    function renderTiers() {
      UI.clear(tiersMount);
      global.DB.TIERS.forEach(function (tier) {
        var lines = state.tiers[tier];
        var t = global.DB.totalsFor(global.DB.load(), lines);
        var box = UI.el('div', { class: 'tierbox ' + TIER_CLASS[tier] });

        var headRight = [UI.el('strong', { class: 't-num', text: UI.money2(t.totalPrice) })];
        if (showCost) {
          headRight.push(UI.el('span', {
            class: 't-meta', style: 'color:var(--moss)',
            text: 'margin ' + UI.money2(t.totalMargin) + ' (' + UI.pct(t.marginPct) + ')'
          }));
        }

        box.appendChild(UI.el('header', {}, [
          UI.el('div', { class: 'row' }, [
            UI.el('span', { class: 'tname', text: tier }),
            UI.el('span', { class: 't-meta', text: lines.length + ' item' + (lines.length === 1 ? '' : 's') })
          ]),
          UI.el('div', { class: 'row' }, headRight)
        ]));

        if (!lines.length) {
          box.appendChild(UI.el('div', { style: 'padding:14px' }, [
            UI.el('div', { class: 't-meta', text: 'Empty. Pick "' + tier + '" above, then add items from the catalog.' })
          ]));
        }

        lines.forEach(function (l, idx) {
          var p = global.DB.product(l.productId);
          if (!p) return;
          var qtyInput = UI.el('input', {
            class: 'input', type: 'number', min: '0', step: '1', value: String(l.qty),
            oninput: function () { l.qty = Number(qtyInput.value) || 0; refreshTotals(); }
          });
          box.appendChild(UI.el('div', { class: 'line-row' }, [
            UI.el('div', {}, [
              UI.el('div', { text: p.name }),
              UI.el('div', { class: 't-meta', text: p.category + ', ' + UI.money2(p.pricePerUnit) + ' per ' + p.unit })
            ]),
            qtyInput,
            UI.el('div', { class: 'lp t-num', text: UI.money2(p.pricePerUnit * l.qty) }),
            UI.el('button', {
              class: 'x-btn', title: 'Remove', html: '&times;',
              onclick: function () { lines.splice(idx, 1); renderTiers(); }
            })
          ]));
        });

        tiersMount.appendChild(box);
      });

      var best = global.DB.totalsFor(global.DB.load(), state.tiers.Better);
      var dep = global.DB.round2(best.totalPrice * (state.depositPercent / 100));
      tiersMount.appendChild(UI.el('div', { class: 't-meta', style: 'margin-top:12px', text:
        'Deposit on the Better tier at ' + state.depositPercent + '% would be ' + UI.money2(dep) + '.' }));
    }

    function refreshTotals() { renderTiers(); }

    renderCatalog();
    renderTiers();

    function collect() {
      if (!state.leadId) { UI.toast('Pick a customer first.', 'warn'); return null; }
      var any = global.DB.TIERS.some(function (t) { return state.tiers[t].length; });
      if (!any) { UI.toast('Add at least one line item.', 'warn'); return null; }
      return global.DB.saveEstimate({
        id: existing ? existing.id : null,
        leadId: state.leadId,
        repId: state.repId,
        depositPercent: state.depositPercent,
        tiers: state.tiers
      });
    }

    var m = UI.modal({
      title: existing ? 'Edit estimate' : 'New estimate',
      subtitle: 'Prices shown are customer-facing' + (showCost ? '. Cost and margin are visible because you are an Admin.' : '. Cost and margin are not part of this view.'),
      body: body,
      wide: true,
      sticky: true,
      actions: [
        { label: 'Cancel', tone: 'btn-ghost' },
        {
          label: 'Save draft', tone: '', keep: true,
          onClick: function (close) {
            var e = collect();
            if (!e) return false;
            UI.toast('Draft saved.', 'ok');
            close();
            if (opts.onSaved) opts.onSaved(e);
          }
        },
        {
          label: 'Send estimate', tone: 'btn-primary', keep: true,
          onClick: function (close) {
            var e = collect();
            if (!e) return false;
            global.DB.sendEstimate(e.id);
            UI.toast('Estimate sent. Lead moved to Estimate Sent.', 'ok');
            close();
            if (opts.onSaved) opts.onSaved(e);
          }
        }
      ]
    });

    return m;
  }

  /* ------------------------------------------------------------------
     Customer e-signature sheet
     Simulates the link the customer receives. Price only, always: this
     screen is customer-facing, so cost is never rendered even for Admin.
     ------------------------------------------------------------------ */
  function openSignSheet(estimateId, onSigned) {
    var e = global.DB.estimate(estimateId);
    if (!e) return;
    var lead = global.DB.lead(e.leadId);
    var rep = global.DB.user(e.repId);

    global.DB.markEstimateViewed(e.id);

    var chosen = e.acceptedTier || 'Better';
    var body = UI.el('div', {});

    body.appendChild(UI.el('div', { class: 'signsheet' }, [
      UI.el('div', { class: 'ss-head' }, [
        UI.el('h3', { text: 'Proposal for ' + (lead ? lead.name : '') }),
        UI.el('div', { class: 't-meta', text: (lead ? lead.address : '') + ', prepared by ' + (rep ? rep.name : '') + ', ' + UI.dt(e.createdAt) })
      ])
    ]));

    var tierMount = UI.el('div', { style: 'margin-top:16px' });
    body.appendChild(tierMount);

    var nameInput = UI.el('input', {
      class: 'sign-input', type: 'text', placeholder: 'Type your full name',
      value: e.signedByName || ''
    });

    function renderTierCards() {
      UI.clear(tierMount);
      global.DB.TIERS.forEach(function (tier) {
        var lines = e.tiers[tier] || [];
        if (!lines.length) return;
        var t = global.DB.totalsFor(global.DB.load(), lines);
        var deposit = global.DB.round2(t.totalPrice * (e.depositPercent / 100));
        var isSel = chosen === tier;

        var card = UI.el('div', {
          class: 'panel', style: 'margin-bottom:12px;cursor:pointer;' + (isSel ? 'border-color:var(--blue);box-shadow:var(--lift-2)' : ''),
          onclick: function () { chosen = tier; renderTierCards(); }
        }, [
          UI.el('div', { class: 'panel-head' }, [
            UI.el('div', { class: 'row' }, [
              UI.el('input', { type: 'radio', name: 'tier', checked: isSel ? true : null, style: 'accent-color:var(--blue)' }),
              UI.el('h3', { text: tier })
            ]),
            UI.el('div', { style: 'text-align:right' }, [
              UI.el('div', { class: 'money-big', text: UI.money2(t.totalPrice) }),
              UI.el('div', { class: 't-meta', text: UI.money2(deposit) + ' deposit (' + e.depositPercent + '%)' })
            ])
          ]),
          UI.el('div', { class: 'panel-body tight' }, [
            UI.el('ul', { class: 'scope-list' }, t.rows.map(function (r) {
              return UI.el('li', {}, [
                UI.el('span', { text: r.name }),
                UI.el('span', { class: 'q', text: UI.qty(r.qty) + ' ' + r.unit + ', ' + UI.money2(r.linePrice) })
              ]);
            }))
          ])
        ]);
        tierMount.appendChild(card);
      });
    }
    renderTierCards();

    if (e.status === 'Signed') {
      body.appendChild(UI.el('div', { class: 'panel', style: 'margin-top:12px' }, [
        UI.el('div', { class: 'panel-body' }, [
          UI.el('div', { class: 'row' }, [
            UI.stagePill('Signed'),
            UI.el('span', { text: 'Signed by ' + e.signedByName + ' on ' + UI.dt(e.signedAt, true) })
          ])
        ])
      ]));
      UI.modal({
        title: 'Signed proposal',
        subtitle: 'Estimate ' + e.id,
        body: body, wide: true,
        actions: [{ label: 'Close', tone: 'btn-ghost' }]
      });
      return;
    }

    body.appendChild(UI.el('div', { class: 'panel', style: 'margin-top:16px' }, [
      UI.el('div', { class: 'panel-body' }, [
        UI.el('div', { class: 'label', text: 'Electronic signature' }),
        nameInput,
        UI.el('div', { class: 't-meta', style: 'margin-top:7px', text:
          'Typing your name and pressing Sign constitutes acceptance of the selected option and authorises the deposit.' })
      ])
    ]));

    UI.modal({
      title: 'Review and sign',
      subtitle: 'Simulates the link the customer receives by text or email',
      body: body,
      wide: true,
      actions: [
        { label: 'Close', tone: 'btn-ghost' },
        {
          label: 'Sign and accept', tone: 'btn-go', keep: true,
          onClick: function (close) {
            var typed = nameInput.value.trim();
            if (typed.length < 3) { UI.toast('Type the full name to sign.', 'warn'); nameInput.focus(); return false; }
            var res = global.DB.signEstimate(e.id, typed, chosen);
            close();
            UI.toast('Signed. Job ' + res.job.id + ' created and deposit recorded.', 'ok', 4200);
            if (onSigned) onSigned(res);
          }
        }
      ]
    });
  }

  global.Estimator = {
    openBuilder: openBuilder,
    openSignSheet: openSignSheet
  };

})(window);
