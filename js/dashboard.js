/* ==========================================================================
   dashboard.js  -  Admin reporting and management views
   Admin is the only role that sees cost, margin, commission and the sync log.
   ========================================================================== */

(function (global) {
  'use strict';

  var UI = global.UI;
  var mounts = {};

  function mount(name) {
    if (!mounts[name]) mounts[name] = document.querySelector('[data-mount="' + name + '"]');
    return mounts[name];
  }

  function renderAll() {
    renderOverview();
    renderPipeline();
    renderJobs();
    renderProducts();
    renderCommissions();
    renderEarnings();
    renderTeam();
    renderSync();
  }

  /* ---------------------------------------------------------------- Overview */
  function renderOverview() {
    var m = mount('overview'); if (!m) return;
    UI.clear(m);
    var db = global.DB.load();
    var c = global.DB.companyTotals();

    var strip = UI.el('div', { class: 'stat-strip' }, [
      stat('Contracted revenue', UI.money(c.revenue), c.jobCount + ' jobs on the books'),
      stat('Cost of goods', UI.money(c.cost), 'Materials and labour'),
      stat('Gross margin', UI.money(c.margin), UI.pct(c.marginPct) + ' of revenue', 'good'),
      stat('Collected', UI.money(c.collected), 'Deposits plus paid balances'),
      stat('Outstanding', UI.money(c.outstanding), 'Balances still owed', c.outstanding > 0 ? 'warn' : '')
    ]);
    m.appendChild(strip);

    var grid = UI.el('div', { class: 'grid-2', style: 'margin-top:16px' });

    grid.appendChild(UI.el('div', { class: 'panel' }, [
      UI.el('div', { class: 'panel-head' }, [
        UI.el('h3', { text: 'Sales funnel' }),
        UI.el('span', { class: 't-meta', text: db.leads.length + ' leads' })
      ]),
      UI.el('div', { class: 'panel-body' }, [global.Pipeline.funnel(global.DB.salesFunnel())])
    ]));

    var jobCounts = global.DB.jobPipelineCounts();
    var jobRows = UI.el('div', { class: 'funnel' });
    var maxJ = jobCounts.reduce(function (a, b) { return Math.max(a, b.count); }, 0) || 1;
    jobCounts.forEach(function (r) {
      jobRows.appendChild(UI.el('div', { class: 'funnel-row' }, [
        UI.el('span', { class: 'fl', text: r.label }),
        UI.el('span', { class: 'funnel-bar' }, [UI.el('span', { style: 'width:' + Math.round((r.count / maxJ) * 100) + '%' })]),
        UI.el('span', { class: 'fn', text: String(r.count) })
      ]));
    });
    grid.appendChild(UI.el('div', { class: 'panel' }, [
      UI.el('div', { class: 'panel-head' }, [
        UI.el('h3', { text: 'Job pipeline' }),
        UI.el('span', { class: 't-meta', text: db.jobs.length + ' jobs' })
      ]),
      UI.el('div', { class: 'panel-body' }, [jobRows])
    ]));
    m.appendChild(grid);

    /* Leaderboard */
    var reps = db.users.filter(function (u) { return u.role === 'Sales Rep'; }).map(function (u) {
      return global.DB.repStats(u.id);
    }).sort(function (a, b) { return b.revenue - a.revenue; });

    var lbBody = UI.el('tbody', {});
    reps.forEach(function (r, i) {
      lbBody.appendChild(UI.el('tr', {}, [
        UI.el('td', {}, [
          UI.el('div', { class: 'row' }, [
            UI.el('span', { class: 'pill pill-oak', text: '#' + (i + 1) }),
            UI.el('span', { style: 'font-weight:600', text: r.name })
          ])
        ]),
        UI.el('td', { class: 'num', text: String(r.dealsWon) }),
        UI.el('td', { class: 'num', text: String(r.openLeads) }),
        UI.el('td', { class: 'num', text: UI.pct(r.closeRate) }),
        UI.el('td', { class: 'num', text: UI.money(r.revenue) }),
        UI.el('td', { class: 'num', text: UI.pct(r.effectiveRate) }),
        UI.el('td', { class: 'num', style: 'font-weight:600;color:var(--moss)', text: UI.money2(r.commission) })
      ]));
    });

    m.appendChild(UI.el('div', { class: 'panel section' }, [
      UI.el('div', { class: 'panel-head' }, [
        UI.el('h3', { text: 'Sales rep leaderboard' }),
        UI.el('span', { class: 't-meta', text: 'Worked out line by line, so a product rate can lift a rep above their base' })
      ]),
      UI.el('div', { class: 'table-wrap' }, [
        UI.el('table', { class: 'grid' }, [
          UI.el('thead', {}, [UI.el('tr', {}, [
            UI.el('th', { text: 'Rep' }),
            UI.el('th', { class: 'num', text: 'Won' }),
            UI.el('th', { class: 'num', text: 'Open' }),
            UI.el('th', { class: 'num', text: 'Close rate' }),
            UI.el('th', { class: 'num', text: 'Revenue' }),
            UI.el('th', { class: 'num', text: 'Eff. rate' }),
            UI.el('th', { class: 'num', text: 'Commission' })
          ])]),
          lbBody
        ])
      ])
    ]));

    /* Outstanding balances */
    var open = db.invoices.filter(function (i) { return i.paymentStatus !== 'Paid'; });
    var obBody = UI.el('tbody', {});
    open.forEach(function (inv) {
      var lead = global.DB.lead(inv.leadId);
      obBody.appendChild(UI.el('tr', {}, [
        UI.el('td', { text: lead ? lead.name : inv.leadId }),
        UI.el('td', {}, [global.Invoices.statusPill(inv)]),
        UI.el('td', { class: 'num', text: UI.money2(inv.totalPrice) }),
        UI.el('td', { class: 'num muted', text: UI.money2(inv.depositAmount) }),
        UI.el('td', { class: 'num', style: 'font-weight:600', text: UI.money2(inv.paymentStatus === 'Unpaid' ? inv.totalPrice : inv.balanceAmount) }),
        UI.el('td', {}, [UI.el('button', {
          class: 'btn btn-sm', text: 'Open invoice',
          onclick: function () { global.Invoices.open(inv, { onChange: renderAll }); }
        })])
      ]));
    });

    m.appendChild(UI.el('div', { class: 'panel section' }, [
      UI.el('div', { class: 'panel-head' }, [
        UI.el('h3', { text: 'Outstanding balances' }),
        UI.el('span', { class: 'pill ' + (c.outstanding ? 'pill-clay' : 'pill-moss'), text: UI.money(c.outstanding) })
      ]),
      open.length
        ? UI.el('div', { class: 'table-wrap' }, [
            UI.el('table', { class: 'grid' }, [
              UI.el('thead', {}, [UI.el('tr', {}, [
                UI.el('th', { text: 'Customer' }),
                UI.el('th', { text: 'Status' }),
                UI.el('th', { class: 'num', text: 'Contract' }),
                UI.el('th', { class: 'num', text: 'Deposit' }),
                UI.el('th', { class: 'num', text: 'Owed' }),
                UI.el('th', { text: '' })
              ])]),
              obBody
            ])
          ])
        : UI.el('div', { class: 'panel-body' }, [UI.empty('All settled', 'Every invoice on the books is paid in full.')])
    ]));
  }

  function stat(label, value, note, tone) {
    return UI.el('div', { class: 'stat' }, [
      UI.el('div', { class: 'stat-label', text: label }),
      UI.el('div', { class: 'stat-value ' + (tone || ''), text: value }),
      note ? UI.el('div', { class: 'stat-note', text: note }) : null
    ]);
  }

  /* ---------------------------------------------------------------- Pipeline */
  function renderPipeline() {
    var m = mount('pipeline'); if (!m) return;
    UI.clear(m);
    var db = global.DB.load();

    var repFilter = UI.el('select', { class: 'select', style: 'max-width:220px' });
    repFilter.appendChild(UI.el('option', { value: '', text: 'All reps' }));
    db.users.filter(function (u) { return u.role === 'Sales Rep'; }).forEach(function (u) {
      repFilter.appendChild(UI.el('option', { value: u.id, text: u.name }));
    });

    var boardMount = UI.el('div', {});

    function draw() {
      UI.clear(boardMount);
      var leads = db.leads.filter(function (l) { return !repFilter.value || l.assignedRepId === repFilter.value; });
      boardMount.appendChild(global.Pipeline.leadBoard(leads, { onOpen: openLead }));
    }
    repFilter.addEventListener('change', draw);

    m.appendChild(UI.el('div', { class: 'spread', style: 'margin-bottom:16px' }, [
      UI.el('div', { class: 'row' }, [
        UI.el('span', { class: 'label', style: 'margin:0', text: 'Filter' }), repFilter
      ]),
      UI.el('button', {
        class: 'btn btn-primary btn-sm', text: 'New estimate',
        onclick: function () { global.Estimator.openBuilder({ onSaved: renderAll }); }
      })
    ]));
    m.appendChild(boardMount);
    draw();
  }

  function openLead(lead) {
    var body = UI.el('div', {});
    var rep = global.DB.user(lead.assignedRepId);

    body.appendChild(UI.el('dl', { class: 'kv' }, [
      UI.el('dt', { text: 'Phone' }), UI.el('dd', { text: lead.phone }),
      UI.el('dt', { text: 'Email' }), UI.el('dd', { text: lead.email }),
      UI.el('dt', { text: 'Address' }), UI.el('dd', { text: lead.address }),
      UI.el('dt', { text: 'Source' }), UI.el('dd', { text: lead.source }),
      UI.el('dt', { text: 'Rep' }), UI.el('dd', { text: rep ? rep.name : '-' }),
      UI.el('dt', { text: 'Created' }), UI.el('dd', { text: UI.dt(lead.createdAt) })
    ]));

    body.appendChild(UI.el('hr', { class: 'divider' }));
    body.appendChild(UI.el('div', { class: 'label', text: 'Stage' }));
    body.appendChild(global.Pipeline.stageSelect(lead.stage, global.DB.SALES_STAGES, function (v) {
      global.DB.setLeadStage(lead.id, v);
      UI.toast('Stage set to ' + v + '.', 'ok');
      renderAll();
    }));

    var ests = global.DB.estimatesForLead(lead.id);
    body.appendChild(UI.el('hr', { class: 'divider' }));
    body.appendChild(UI.el('div', { class: 'label', text: 'Estimates' }));
    if (!ests.length) {
      body.appendChild(UI.el('div', { class: 't-meta', text: 'No estimate built yet.' }));
    } else {
      ests.forEach(function (e) {
        body.appendChild(UI.el('div', { class: 'spread dotted-row' }, [
          UI.el('div', {}, [
            UI.el('div', { text: e.id + (e.acceptedTier ? ', ' + e.acceptedTier : '') }),
            UI.el('div', { class: 't-meta', text: UI.dt(e.createdAt) })
          ]),
          UI.el('div', { class: 'row' }, [
            UI.stagePill(e.status),
            UI.el('button', { class: 'btn btn-sm', text: 'View', onclick: function () { global.Estimator.openSignSheet(e.id, renderAll); } })
          ])
        ]));
      });
    }

    var notes = UI.el('div', { style: 'margin-top:8px' });
    (lead.notes || []).forEach(function (n) {
      var by = global.DB.user(n.by);
      notes.appendChild(UI.el('div', { class: 'note-row' }, [
        UI.el('div', { class: 'nr-text', text: n.text }),
        UI.el('div', { class: 'nr-meta', text: (by ? by.name : 'System') + ', ' + UI.relative(n.at) })
      ]));
    });
    body.appendChild(UI.el('hr', { class: 'divider' }));
    body.appendChild(UI.el('div', { class: 'label', text: 'Notes' }));
    body.appendChild(notes);

    UI.modal({
      title: lead.name,
      subtitle: lead.zipCode + ', ' + lead.stage,
      body: body,
      actions: [{ label: 'Close', tone: 'btn-ghost' }]
    });
  }

  /* ------------------------------------------------------------------- Jobs */
  function renderJobs() {
    var m = mount('jobs'); if (!m) return;
    UI.clear(m);
    var db = global.DB.load();

    if (!db.jobs.length) {
      m.appendChild(UI.empty('No jobs yet', 'A job is created automatically the moment an estimate is signed.'));
      return;
    }

    var tbody = UI.el('tbody', {});
    db.jobs.forEach(function (job) {
      var lead = global.DB.lead(job.leadId);
      var inv = global.DB.invoiceForJob(job.id);
      var fin = global.DB.jobFinancials(job.id);
      var inst = global.DB.user(job.installerId);

      tbody.appendChild(UI.el('tr', {}, [
        UI.el('td', {}, [
          UI.el('div', { style: 'font-weight:600', text: lead ? lead.name : job.leadId }),
          UI.el('div', { class: 't-meta', text: lead ? lead.address : '' })
        ]),
        UI.el('td', {}, [UI.stagePill(job.stage)]),
        UI.el('td', { text: UI.dayLabel(job.scheduledDate) }),
        UI.el('td', { text: inst ? inst.name : '-', class: inst ? '' : 'muted' }),
        UI.el('td', { class: 'num', text: UI.money(fin.totalPrice) }),
        UI.el('td', { class: 'num muted', text: UI.money(fin.totalCost) }),
        UI.el('td', { class: 'num', style: 'color:var(--moss);font-weight:600', text: UI.money(fin.totalMargin) }),
        UI.el('td', {}, [inv ? global.Invoices.statusPill(inv) : UI.el('span', { class: 't-meta', text: '-' })]),
        UI.el('td', {}, [
          UI.el('button', { class: 'btn btn-sm', text: 'Manage', onclick: function () { openJob(job); } })
        ])
      ]));
    });

    m.appendChild(UI.el('div', { class: 'panel' }, [
      UI.el('div', { class: 'panel-head' }, [
        UI.el('h3', { text: 'All jobs' }),
        UI.el('span', { class: 't-meta', text: 'Cost and margin columns are Admin only' })
      ]),
      UI.el('div', { class: 'table-wrap' }, [
        UI.el('table', { class: 'grid' }, [
          UI.el('thead', {}, [UI.el('tr', {}, [
            UI.el('th', { text: 'Customer' }),
            UI.el('th', { text: 'Stage' }),
            UI.el('th', { text: 'Scheduled' }),
            UI.el('th', { text: 'Installer' }),
            UI.el('th', { class: 'num', text: 'Price' }),
            UI.el('th', { class: 'num', text: 'Cost' }),
            UI.el('th', { class: 'num', text: 'Margin' }),
            UI.el('th', { text: 'Invoice' }),
            UI.el('th', { text: '' })
          ])]),
          tbody
        ])
      ])
    ]));
  }

  function openJob(job) {
    var lead = global.DB.lead(job.leadId);
    var inv = global.DB.invoiceForJob(job.id);
    var db = global.DB.load();
    var body = UI.el('div', {});

    body.appendChild(global.Pipeline.jobRail(job.stage));
    body.appendChild(UI.el('hr', { class: 'divider' }));

    body.appendChild(UI.el('div', { class: 'label', text: 'Stage' }));
    body.appendChild(global.Pipeline.stageSelect(job.stage, global.DB.JOB_STAGES, function (v) {
      global.DB.setJobStage(job.id, v);
      UI.toast('Job moved to ' + v + '.', 'ok');
      renderAll();
    }));

    var instSel = UI.el('select', { class: 'select' });
    instSel.appendChild(UI.el('option', { value: '', text: 'Unassigned' }));
    db.users.filter(function (u) { return u.role === 'Installer'; }).forEach(function (u) {
      instSel.appendChild(UI.el('option', { value: u.id, text: u.name }));
    });
    instSel.value = job.installerId || '';

    var dateInput = UI.el('input', { class: 'input', type: 'date', value: UI.toInputDate(job.scheduledDate) });

    body.appendChild(UI.el('hr', { class: 'divider' }));
    body.appendChild(UI.el('div', { class: 'field-row' }, [
      UI.el('label', { class: 'field grow' }, [UI.el('span', { class: 'label', text: 'Installer' }), instSel]),
      UI.el('label', { class: 'field grow' }, [UI.el('span', { class: 'label', text: 'Scheduled date' }), dateInput])
    ]));
    body.appendChild(UI.el('button', {
      class: 'btn btn-primary btn-sm', text: 'Save schedule',
      onclick: function () {
        global.DB.assignInstaller(job.id, instSel.value || null, UI.fromInputDate(dateInput.value));
        UI.toast('Schedule saved.', 'ok');
        renderAll();
      }
    }));

    body.appendChild(UI.el('hr', { class: 'divider' }));
    body.appendChild(UI.el('label', { class: 'check' }, [
      UI.el('input', {
        type: 'checkbox', checked: job.materialsReceived ? true : null,
        onchange: function (e) { global.DB.setMaterialsReceived(job.id, e.target.checked); renderAll(); }
      }),
      UI.el('span', { text: 'Materials received at the warehouse' })
    ]));

    if (job.photos && job.photos.length) {
      body.appendChild(UI.el('hr', { class: 'divider' }));
      body.appendChild(UI.el('div', { class: 'label', text: 'Job photos' }));
      body.appendChild(UI.el('div', { class: 'photo-grid' }, job.photos.map(function (p) {
        return UI.el('div', { class: 'photo-chip' }, [
          UI.el('span', { class: 'lbl', text: p.label }),
          UI.el('span', { class: 'tm', text: UI.dt(p.at, true) })
        ]);
      })));
    }

    if (inv) {
      body.appendChild(UI.el('hr', { class: 'divider' }));
      body.appendChild(UI.el('div', { class: 'label', text: 'Invoice ' + inv.id }));
      body.appendChild(global.Invoices.summary(inv, { showCost: true }));
      body.appendChild(UI.el('div', { style: 'margin-top:12px' }, [
        global.Invoices.paymentControls(inv, renderAll)
      ]));
    }

    var actions = [{ label: 'Close', tone: 'btn-ghost' }];
    if (job.stage === 'Completed' && !job.adminConfirmedAt) {
      actions.push({
        label: 'Confirm completion', tone: 'btn-go',
        onClick: function () {
          global.DB.confirmJob(job.id);
          global.GHLSync.out('job.confirmed', "Job '" + (lead ? lead.name : job.id) + "' confirmed complete by office");
          UI.toast('Completion confirmed.', 'ok');
          renderAll();
        }
      });
    }

    UI.modal({
      title: lead ? lead.name : job.id,
      subtitle: 'Job ' + job.id + (job.adminConfirmedAt ? ', confirmed ' + UI.dt(job.adminConfirmedAt) : ''),
      body: body, wide: true, actions: actions
    });
  }

  /* --------------------------------------------------------------- Products */
  function renderProducts() {
    var m = mount('products'); if (!m) return;
    UI.clear(m);

    var search = UI.el('input', { class: 'input', type: 'search', placeholder: 'Search products' });
    var showInactive = UI.el('input', { type: 'checkbox' });
    var tableMount = UI.el('div', {});

    function draw() {
      UI.clear(tableMount);
      var q = search.value.trim().toLowerCase();
      var list = global.DB.load().products.filter(function (p) {
        if (!showInactive.checked && !p.active) return false;
        if (q && p.name.toLowerCase().indexOf(q) === -1 && p.category.toLowerCase().indexOf(q) === -1) return false;
        return true;
      });

      var tbody = UI.el('tbody', {});
      list.forEach(function (p) {
        var margin = global.DB.round2(p.pricePerUnit - p.costPerUnit);
        var pct = p.pricePerUnit ? (margin / p.pricePerUnit) * 100 : 0;
        tbody.appendChild(UI.el('tr', { style: p.active ? '' : 'opacity:.55' }, [
          UI.el('td', {}, [
            UI.el('div', { style: 'font-weight:500', text: p.name }),
            UI.el('div', { class: 't-meta', text: p.tier ? p.tier + ' tier' : '' })
          ]),
          UI.el('td', {}, [UI.el('span', { class: 'pill pill-outline', text: p.category })]),
          UI.el('td', { class: 'muted', text: p.unit }),
          UI.el('td', { class: 'num', text: UI.money2(p.costPerUnit) }),
          UI.el('td', { class: 'num', text: UI.money2(p.pricePerUnit) }),
          UI.el('td', { class: 'num', style: 'color:var(--moss);font-weight:600', text: UI.money2(margin) }),
          UI.el('td', { class: 'num muted', text: UI.pct(pct) }),
          UI.el('td', {
            class: 'num ' + (typeof p.commissionRate === 'number' ? '' : 'muted'),
            text: typeof p.commissionRate === 'number' ? UI.pct(p.commissionRate * 100) : 'rep rate'
          }),
          UI.el('td', {}, [
            UI.el('div', { class: 'row' }, [
              UI.el('button', { class: 'btn btn-sm', text: 'Edit', onclick: function () { productForm(p); } }),
              UI.el('button', {
                class: 'btn btn-sm btn-ghost', text: p.active ? 'Deactivate' : 'Activate',
                onclick: function () { global.DB.toggleProduct(p.id); draw(); UI.toast('Product ' + (p.active ? 'activated' : 'deactivated') + '.'); }
              })
            ])
          ])
        ]));
      });

      tableMount.appendChild(UI.el('div', { class: 'panel' }, [
        UI.el('div', { class: 'panel-head' }, [
          UI.el('h3', { text: 'Products' }),
          UI.el('span', { class: 't-meta', text: list.length + ' of ' + global.DB.load().products.length + ' products' })
        ]),
        list.length
          ? UI.el('div', { class: 'table-wrap' }, [
              UI.el('table', { class: 'grid' }, [
                UI.el('thead', {}, [UI.el('tr', {}, [
                  UI.el('th', { text: 'Product' }),
                  UI.el('th', { text: 'Category' }),
                  UI.el('th', { text: 'Unit' }),
                  UI.el('th', { class: 'num', text: 'Cost' }),
                  UI.el('th', { class: 'num', text: 'Price' }),
                  UI.el('th', { class: 'num', text: 'Margin' }),
                  UI.el('th', { class: 'num', text: 'Margin %' }),
                  UI.el('th', { class: 'num', text: 'Comm. %' }),
                  UI.el('th', { text: '' })
                ])]),
                tbody
              ])
            ])
          : UI.el('div', { class: 'panel-body' }, [UI.empty('Nothing found', 'No product matches that search.')])
      ]));
    }

    search.addEventListener('input', draw);
    showInactive.addEventListener('change', draw);

    m.appendChild(UI.el('div', { class: 'spread', style: 'margin-bottom:16px' }, [
      UI.el('div', { class: 'row grow', style: 'max-width:480px' }, [search]),
      UI.el('div', { class: 'row' }, [
        UI.el('label', { class: 'check' }, [showInactive, UI.el('span', { text: 'Show inactive' })]),
        UI.el('button', { class: 'btn btn-primary btn-sm', text: 'Add product', onclick: function () { productForm(null); } })
      ])
    ]));
    m.appendChild(tableMount);
    draw();
  }

  function productForm(p) {
    var f = {};
    function field(key, label, node) {
      f[key] = node;
      return UI.el('label', { class: 'field grow' }, [UI.el('span', { class: 'label', text: label }), node]);
    }

    var catSel = UI.el('select', { class: 'select' });
    global.DB.PRODUCT_CATEGORIES.forEach(function (c) { catSel.appendChild(UI.el('option', { value: c, text: c })); });
    var unitSel = UI.el('select', { class: 'select' });
    global.DB.UNITS.forEach(function (u) { unitSel.appendChild(UI.el('option', { value: u, text: u })); });
    var tierSel = UI.el('select', { class: 'select' });
    [''].concat(global.DB.TIERS).forEach(function (t) { tierSel.appendChild(UI.el('option', { value: t, text: t || 'No tier' })); });

    if (p) { catSel.value = p.category; unitSel.value = p.unit; tierSel.value = p.tier || ''; }

    var marginNote = UI.el('div', { class: 't-meta', style: 'margin-top:-6px' });
    function updateMargin() {
      var c = Number(f.cost.value) || 0, pr = Number(f.price.value) || 0;
      var m = global.DB.round2(pr - c);
      marginNote.textContent = 'Margin computes to ' + UI.money2(m) + (pr ? ' (' + UI.pct((m / pr) * 100) + ')' : '') + '. It is never stored or edited directly.';
    }

    /* Commission rides on the product, so it can be set the moment the
       product is created rather than being remembered separately. */
    var commissionIn = UI.el('input', {
      class: 'input', type: 'number', step: '0.5', min: '0', max: '100',
      placeholder: 'Rep rate',
      value: p && typeof p.commissionRate === 'number' ? String(global.DB.round2(p.commissionRate * 100)) : ''
    });
    var commissionField = field('commission', 'Commission %', commissionIn);
    commissionField.appendChild(UI.el('span', { class: 't-meta', text:
      'What the rep earns on this product. Leave it blank to pay their own rate instead.' }));

    var body = UI.el('div', {}, [
      field('name', 'Product name', UI.el('input', { class: 'input', value: p ? p.name : '' })),
      UI.el('div', { class: 'field-row' }, [
        field('category', 'Category', catSel),
        field('unit', 'Unit', unitSel),
        field('tier', 'Tier', tierSel)
      ]),
      UI.el('div', { class: 'field-row' }, [
        field('cost', 'Cost per unit', UI.el('input', { class: 'input', type: 'number', step: '0.01', min: '0', value: p ? p.costPerUnit : '', oninput: updateMargin })),
        field('price', 'Price per unit', UI.el('input', { class: 'input', type: 'number', step: '0.01', min: '0', value: p ? p.pricePerUnit : '', oninput: updateMargin }))
      ]),
      marginNote,
      commissionField
    ]);
    updateMargin();

    UI.modal({
      title: p ? 'Edit product' : 'Add product',
      body: body,
      actions: [
        { label: 'Cancel', tone: 'btn-ghost' },
        {
          label: 'Save', tone: 'btn-primary', keep: true,
          onClick: function (close) {
            if (!f.name.value.trim()) { UI.toast('Give the product a name.', 'warn'); return false; }
            global.DB.saveProduct({
              id: p ? p.id : null,
              name: f.name.value.trim(),
              category: catSel.value,
              unit: unitSel.value,
              tier: tierSel.value || null,
              costPerUnit: f.cost.value,
              pricePerUnit: f.price.value,
              commissionRate: f.commission.value === '' ? null : (Number(f.commission.value) || 0) / 100
            });
            UI.toast('Product saved.', 'ok');
            close();
            renderAll();
          }
        }
      ]
    });
  }

  /* ------------------------------------------------------------- Commission */
  function renderCommissions() {
    var m = mount('commissions'); if (!m) return;
    UI.clear(m);
    var db = global.DB.load();
    var set = global.DB.settings();
    var totals = global.DB.commissionTotals();
    var reps = db.users.filter(function (u) { return u.role === 'Sales Rep'; });
    var overrides = db.products.filter(function (p) { return typeof p.commissionRate === 'number'; });

    m.appendChild(UI.el('div', { class: 'stat-strip' }, [
      stat('Company default', UI.pct(set.defaultCommissionRate * 100), 'Used when a rep has no rate of their own'),
      stat('Reps on commission', String(reps.length), reps.length
        ? reps.map(function (u) { return u.name.split(' ')[0] + ' ' + UI.pct(u.commissionRate * 100); }).join(', ')
        : 'Nobody yet'),
      stat('Product rates', overrides.length + ' of ' + db.products.length, 'Products carrying their own rate'),
      stat('Blended rate', UI.pct(totals.effectiveRate), 'Across everything invoiced so far', 'good')
    ]));

    /* --- the company default --- */
    var defaultIn = UI.el('input', {
      class: 'input', type: 'number', step: '0.5', min: '0', max: '100',
      value: String(global.DB.round2(set.defaultCommissionRate * 100))
    });

    /* --- per rep --- */
    var repBody = UI.el('tbody', {});
    reps.forEach(function (u) {
      var rateIn = UI.el('input', {
        class: 'input', type: 'number', step: '0.5', min: '0', max: '100',
        value: String(global.DB.round2(u.commissionRate * 100))
      });
      repBody.appendChild(UI.el('tr', {}, [
        UI.el('td', { style: 'font-weight:600', text: u.name }),
        UI.el('td', {}, [UI.el('span', { class: 'pill pill-outline', text: u.role })]),
        UI.el('td', { class: 'num' }, [
          UI.el('div', { class: 'row', style: 'justify-content:flex-end' }, [
            UI.el('div', { style: 'width:86px' }, [rateIn]),
            UI.el('span', { class: 't-meta', text: '%' })
          ])
        ]),
        UI.el('td', {}, [
          UI.el('div', { class: 'row' }, [
            UI.el('button', {
              class: 'btn btn-sm btn-primary', text: 'Save',
              onclick: function () {
                var pct = Number(rateIn.value) || 0;
                global.DB.saveUser({ id: u.id, name: u.name, role: u.role, commissionRate: pct / 100 });
                UI.toast(u.name.split(' ')[0] + ' set to ' + pct + '%.', 'ok');
                renderAll();
              }
            }),
            UI.el('button', { class: 'btn btn-sm btn-ghost', text: 'Edit details', onclick: function () { userForm(u); } })
          ])
        ])
      ]));
    });

    m.appendChild(UI.el('div', { class: 'panel section' }, [
      UI.el('div', { class: 'panel-head' }, [
        UI.el('div', {}, [
          UI.el('h3', { text: 'Rep commission rates' }),
          UI.el('div', { class: 't-meta', text: 'Applies to every line whose product does not carry a rate of its own.' })
        ])
      ]),
      UI.el('div', { class: 'panel-body tight' }, [
        UI.el('div', { class: 'spread' }, [
          UI.el('div', {}, [
            UI.el('div', { class: 'label', style: 'margin:0', text: 'Default for a rep with no rate' }),
            UI.el('div', { class: 't-meta', text: 'Also the value a new user starts at.' })
          ]),
          UI.el('div', { class: 'row' }, [
            UI.el('div', { style: 'width:86px' }, [defaultIn]),
            UI.el('span', { class: 't-meta', text: '%' }),
            UI.el('button', {
              class: 'btn btn-sm btn-primary', text: 'Save',
              onclick: function () {
                global.DB.saveSettings({ defaultCommissionRate: (Number(defaultIn.value) || 0) / 100 });
                UI.toast('Default rate saved.', 'ok');
                renderAll();
              }
            })
          ])
        ])
      ]),
      UI.el('div', { class: 'table-wrap' }, [
        UI.el('table', { class: 'grid' }, [
          UI.el('thead', {}, [UI.el('tr', {}, [
            UI.el('th', { text: 'Rep' }),
            UI.el('th', { text: 'Role' }),
            UI.el('th', { class: 'num', text: 'Base rate' }),
            UI.el('th', { text: '' })
          ])]),
          repBody
        ])
      ])
    ]));

    /* --- per product --- */
    var ovBody = UI.el('tbody', {});
    overrides.forEach(function (p) {
      ovBody.appendChild(UI.el('tr', {}, [
        UI.el('td', {}, [
          UI.el('div', { style: 'font-weight:600', text: p.name }),
          UI.el('div', { class: 't-meta', text: p.tier ? p.tier + ' tier' : 'per ' + p.unit })
        ]),
        UI.el('td', {}, [UI.el('span', { class: 'pill pill-outline', text: p.category })]),
        UI.el('td', { class: 'num', style: 'font-weight:600', text: UI.pct(p.commissionRate * 100) }),
        UI.el('td', { class: 'num muted', text: UI.pct(set.defaultCommissionRate * 100) }),
        UI.el('td', {}, [
          UI.el('button', {
            class: 'btn btn-sm btn-ghost', text: 'Use rep rate',
            onclick: function () {
              global.DB.setProductCommission(p.id, null);
              UI.toast(p.name + ' will pay the rep rate.', 'ok');
              renderAll();
            }
          })
        ])
      ]));
    });

    m.appendChild(UI.el('div', { class: 'panel' }, [
      UI.el('div', { class: 'panel-head' }, [
        UI.el('div', {}, [
          UI.el('h3', { text: 'Product rates' }),
          UI.el('div', { class: 't-meta', text: 'Set on the product itself, in Products, or when the product is first created.' })
        ]),
        UI.el('span', { class: 't-meta', text: overrides.length + ' of ' + db.products.length })
      ]),
      overrides.length
        ? UI.el('div', { class: 'table-wrap' }, [
            UI.el('table', { class: 'grid' }, [
              UI.el('thead', {}, [UI.el('tr', {}, [
                UI.el('th', { text: 'Product' }),
                UI.el('th', { text: 'Category' }),
                UI.el('th', { class: 'num', text: 'Rate' }),
                UI.el('th', { class: 'num', text: 'If cleared' }),
                UI.el('th', { text: '' })
              ])]),
              ovBody
            ])
          ])
        : UI.el('div', { class: 'panel-body' }, [
            UI.empty('No product rates yet', 'Every line pays the rep rate. Add a rate on a product to pay a different one on that line.')
          ])
    ]));
  }

  /* --------------------------------------------------------------- Earnings */
  function renderEarnings() {
    var m = mount('earnings'); if (!m) return;
    UI.clear(m);
    var rows = global.DB.productEarnings();
    var t = global.DB.commissionTotals();

    m.appendChild(UI.el('div', { class: 'stat-strip' }, [
      stat('Revenue sold', UI.money(t.revenue), t.soldCount + ' of ' + t.productCount + ' products sold'),
      stat('Cost of goods', UI.money(t.cost), 'Materials and labour'),
      stat('Gross margin', UI.money(t.margin), UI.pct(t.marginPct) + ' of revenue', 'good'),
      stat('Commission paid', UI.money(t.commission), 'Blended ' + UI.pct(t.effectiveRate), 'gold'),
      stat('Net after commission', UI.money(t.net), 'Gross margin less commission')
    ]));

    if (!rows.length) {
      m.appendChild(UI.el('div', { class: 'panel section' }, [
        UI.el('div', { class: 'panel-body' }, [
          UI.empty('Nothing sold yet', 'Sign an estimate and every product on it turns up here with what it earned.')
        ])
      ]));
      return;
    }

    var tbody = UI.el('tbody', {});
    rows.forEach(function (r) {
      tbody.appendChild(UI.el('tr', {}, [
        UI.el('td', {}, [
          UI.el('div', { style: 'font-weight:600', text: r.name }),
          UI.el('div', { class: 't-meta', text: r.orders + (r.orders === 1 ? ' job' : ' jobs') })
        ]),
        UI.el('td', {}, [UI.el('span', { class: 'pill pill-outline', text: r.category })]),
        UI.el('td', { class: 'num', text: UI.qty(r.units) + ' ' + r.unit }),
        UI.el('td', { class: 'num', text: UI.money2(r.revenue) }),
        UI.el('td', { class: 'num muted', text: UI.money2(r.cost) }),
        UI.el('td', { class: 'num', style: 'font-weight:600', text: UI.money2(r.margin) }),
        UI.el('td', { class: 'num muted', text: UI.pct(r.effectiveRate) }),
        UI.el('td', { class: 'num', text: UI.money2(r.commission) }),
        UI.el('td', { class: 'num', style: 'color:var(--moss);font-weight:600', text: UI.money2(r.net) })
      ]));
    });

    tbody.appendChild(UI.el('tr', { style: 'background:var(--panel-sunk)' }, [
      UI.el('td', { colspan: '3', style: 'text-align:right;font-weight:700', text: 'All products' }),
      UI.el('td', { class: 'num', style: 'font-weight:700', text: UI.money2(t.revenue) }),
      UI.el('td', { class: 'num muted', text: UI.money2(t.cost) }),
      UI.el('td', { class: 'num', style: 'font-weight:700', text: UI.money2(t.margin) }),
      UI.el('td', { class: 'num muted', text: UI.pct(t.effectiveRate) }),
      UI.el('td', { class: 'num', style: 'font-weight:700', text: UI.money2(t.commission) }),
      UI.el('td', { class: 'num', style: 'font-weight:700;color:var(--moss)', text: UI.money2(t.net) })
    ]));

    m.appendChild(UI.el('div', { class: 'panel' }, [
      UI.el('div', { class: 'panel-head' }, [
        UI.el('div', {}, [
          UI.el('h3', { text: 'Earnings by product' }),
          UI.el('div', { class: 't-meta', text: 'Net is the gross margin less the commission that sale paid out.' })
        ]),
        UI.el('span', { class: 't-meta', text: rows.length + ' products sold' })
      ]),
      UI.el('div', { class: 'table-wrap' }, [
        UI.el('table', { class: 'grid' }, [
          UI.el('thead', {}, [UI.el('tr', {}, [
            UI.el('th', { text: 'Product' }),
            UI.el('th', { text: 'Category' }),
            UI.el('th', { class: 'num', text: 'Units' }),
            UI.el('th', { class: 'num', text: 'Revenue' }),
            UI.el('th', { class: 'num', text: 'Cost' }),
            UI.el('th', { class: 'num', text: 'Margin' }),
            UI.el('th', { class: 'num', text: 'Comm. %' }),
            UI.el('th', { class: 'num', text: 'Commission' }),
            UI.el('th', { class: 'num', text: 'Net' })
          ])]),
          tbody
        ])
      ])
    ]));

    var reps = global.DB.repCommission();
    var rBody = UI.el('tbody', {});
    reps.forEach(function (r) {
      rBody.appendChild(UI.el('tr', {}, [
        UI.el('td', { style: 'font-weight:600', text: r.name }),
        UI.el('td', { class: 'num', text: String(r.deals) }),
        UI.el('td', { class: 'num', text: UI.money(r.revenue) }),
        UI.el('td', { class: 'num muted', text: UI.pct(r.rate * 100) }),
        UI.el('td', { class: 'num muted', text: UI.pct(r.effectiveRate) }),
        UI.el('td', { class: 'num', style: 'color:var(--moss);font-weight:600', text: UI.money2(r.commission) })
      ]));
    });

    m.appendChild(UI.el('div', { class: 'panel section' }, [
      UI.el('div', { class: 'panel-head' }, [
        UI.el('div', {}, [
          UI.el('h3', { text: 'Commission by rep' }),
          UI.el('div', { class: 't-meta', text: 'Base is the rep rate; blended is what they actually averaged once product rates applied.' })
        ])
      ]),
      reps.length
        ? UI.el('div', { class: 'table-wrap' }, [
            UI.el('table', { class: 'grid' }, [
              UI.el('thead', {}, [UI.el('tr', {}, [
                UI.el('th', { text: 'Rep' }),
                UI.el('th', { class: 'num', text: 'Jobs' }),
                UI.el('th', { class: 'num', text: 'Revenue' }),
                UI.el('th', { class: 'num', text: 'Base' }),
                UI.el('th', { class: 'num', text: 'Blended' }),
                UI.el('th', { class: 'num', text: 'Commission' })
              ])]),
              rBody
            ])
          ])
        : UI.el('div', { class: 'panel-body' }, [UI.empty('No reps yet', 'Add a sales rep to start tracking commission.')])
    ]));
  }

  /* ------------------------------------------------------------------- Team */
  function renderTeam() {
    var m = mount('team'); if (!m) return;
    UI.clear(m);
    var db = global.DB.load();

    var tbody = UI.el('tbody', {});
    db.users.forEach(function (u) {
      tbody.appendChild(UI.el('tr', {}, [
        UI.el('td', { style: 'font-weight:500', text: u.name }),
        UI.el('td', {}, [UI.el('span', { class: 'pill pill-outline', text: u.role })]),
        UI.el('td', { class: 'num', text: u.role === 'Sales Rep' ? UI.pct(u.commissionRate * 100) : '-' }),
        UI.el('td', {}, [
          UI.el('div', { class: 'row' }, [
            UI.el('button', { class: 'btn btn-sm', text: 'Edit', onclick: function () { userForm(u); } }),
            u.id === 'u_admin' ? null : UI.el('button', {
              class: 'btn btn-sm btn-danger', text: 'Remove',
              onclick: function () {
                UI.confirm({
                  title: 'Remove ' + u.name,
                  message: 'They will no longer appear in assignment lists. Existing records keep their reference.',
                  confirmLabel: 'Remove', danger: true,
                  onConfirm: function () { global.DB.removeUser(u.id); UI.toast('User removed.'); renderAll(); }
                });
              }
            })
          ])
        ])
      ]));
    });

    m.appendChild(UI.el('div', { class: 'spread', style: 'margin-bottom:16px' }, [
      UI.el('div', { class: 't-sub', text: 'Mock users for the demo. Roles decide what each login can see.' }),
      UI.el('button', { class: 'btn btn-primary btn-sm', text: 'Add user', onclick: function () { userForm(null); } })
    ]));

    m.appendChild(UI.el('div', { class: 'panel' }, [
      UI.el('div', { class: 'table-wrap' }, [
        UI.el('table', { class: 'grid' }, [
          UI.el('thead', {}, [UI.el('tr', {}, [
            UI.el('th', { text: 'Name' }),
            UI.el('th', { text: 'Role' }),
            UI.el('th', { class: 'num', text: 'Commission' }),
            UI.el('th', { text: '' })
          ])]),
          tbody
        ])
      ])
    ]));
  }

  function userForm(u) {
    var name = UI.el('input', { class: 'input', value: u ? u.name : '' });
    var roleSel = UI.el('select', { class: 'select' });
    ['Admin', 'Sales Rep', 'CSR', 'Installer'].forEach(function (r) {
      roleSel.appendChild(UI.el('option', { value: r, text: r }));
    });
    if (u) roleSel.value = u.role;
    /* Percent, not a decimal: an admin thinks in 6%, not 0.06. */
    var rate = UI.el('input', {
      class: 'input', type: 'number', step: '0.5', min: '0', max: '100',
      value: String(global.DB.round2((u ? u.commissionRate : global.DB.settings().defaultCommissionRate) * 100))
    });
    var rateField = UI.el('label', { class: 'field grow' }, [
      UI.el('span', { class: 'label', text: 'Commission %' }), rate
    ]);
    rateField.appendChild(UI.el('span', { class: 't-meta', text:
      'Only sales reps earn commission. 0 keeps them off it.' }));

    UI.modal({
      title: u ? 'Edit user' : 'Add user',
      body: UI.el('div', {}, [
        UI.el('label', { class: 'field' }, [UI.el('span', { class: 'label', text: 'Name' }), name]),
        UI.el('div', { class: 'field-row' }, [
          UI.el('label', { class: 'field grow' }, [UI.el('span', { class: 'label', text: 'Role' }), roleSel]),
          rateField
        ])
      ]),
      actions: [
        { label: 'Cancel', tone: 'btn-ghost' },
        {
          label: 'Save', tone: 'btn-primary', keep: true,
          onClick: function (close) {
            if (!name.value.trim()) { UI.toast('Name is required.', 'warn'); return false; }
            global.DB.saveUser({
              id: u ? u.id : null,
              name: name.value.trim(),
              role: roleSel.value,
              commissionRate: (Number(rate.value) || 0) / 100
            });
            UI.toast('User saved.', 'ok');
            close();
            renderAll();
          }
        }
      ]
    });
  }

  /* ------------------------------------------------------------- Sync + reset */
  function renderSync() {
    var m = mount('sync'); if (!m) return;
    UI.clear(m);
    var entries = global.GHLSync.entries();

    var feed = UI.el('div', { class: 'sync-feed' });
    if (!entries.length) {
      feed.appendChild(UI.empty('Nothing yet', 'Sync events appear here as soon as something changes in the app.'));
    }
    entries.forEach(function (e) {
      feed.appendChild(UI.el('div', { class: 'sync-item ' + e.dir }, [
        UI.el('span', { class: 'arrow', text: e.dir === 'out' ? 'OUT' : 'IN' }),
        UI.el('span', { class: 'msg' }, [
          UI.el('div', { text: e.message }),
          UI.el('div', { class: 't-meta t-mono', text: e.event })
        ]),
        UI.el('time', { text: UI.relative(e.at) })
      ]));
    });

    m.appendChild(UI.el('div', { class: 'panel' }, [
      UI.el('div', { class: 'panel-head' }, [
        UI.el('div', {}, [
          UI.el('h3', { text: 'Sync Activity Log' }),
          UI.el('div', { class: 't-meta', text: 'Stubbed GoHighLevel integration. No network calls are made.' })
        ]),
        UI.el('button', {
          class: 'btn btn-sm btn-ghost', text: 'Clear',
          onclick: function () { global.GHLSync.clear(); renderSync(); }
        })
      ]),
      UI.el('div', { class: 'panel-body' }, [feed]),
      UI.el('div', { class: 'panel-foot' }, [
        UI.el('div', { class: 't-meta', text: 'When the private integration token exists, only transport() inside ghlSync.js changes. Every caller stays the same.' })
      ])
    ]));

    m.appendChild(UI.el('div', { class: 'panel section' }, [
      UI.el('div', { class: 'panel-head' }, [UI.el('h3', { text: 'Demo controls' })]),
      UI.el('div', { class: 'panel-body' }, [
        UI.el('p', { class: 't-sub', text: 'Reset wipes everything created during the demo and reloads the seeded leads, products, estimates and jobs.' }),
        UI.el('div', { class: 'row-wrap' }, [
          UI.el('button', {
            class: 'btn btn-danger', text: 'Reset demo data',
            onclick: function () {
              UI.confirm({
                title: 'Reset demo data',
                message: 'Everything you created in this session is discarded and the original seed set is restored.',
                confirmLabel: 'Reset', danger: true,
                onConfirm: function () { global.DB.resetDemoData(); UI.toast('Demo data reset.', 'ok'); renderAll(); }
              });
            }
          }),
          UI.el('button', {
            class: 'btn', text: 'Simulate inbound GHL event',
            onclick: function () {
              var leads = global.DB.load().leads;
              var l = leads[Math.floor(Math.random() * leads.length)];
              global.GHLSync['in']('contact.updated', "Contact '" + l.name + "' updated in GHL workflow");
              UI.toast('Inbound event logged.');
              renderSync();
            }
          }),
          UI.el('span', { class: 't-meta', text: global.DB.Storage.persistent ? 'Storage: localStorage' : 'Storage: tab-session fallback' })
        ])
      ])
    ]));
  }

  global.Dashboard = { renderAll: renderAll, openJob: openJob, openLead: openLead };

})(window);
