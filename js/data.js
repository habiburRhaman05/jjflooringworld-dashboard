/* ==========================================================================
   data.js  -  J&J Flooring World prototype
   localStorage schema, seed data, CRUD helpers, resetDemoData().
   No backend. Everything lives in the browser.
   ========================================================================== */

(function (global) {
  'use strict';

  /* v3: products carry their own commission rate and the database holds
     commission settings, so an older stored database is abandoned rather
     than migrated. There is nothing worth keeping in a demo store. */
  var STORE_KEY   = 'jjfw.db.v3';
  var SESSION_KEY = 'jjfw.session.v1';
  var BANNER_KEY  = 'jjfw.banner.dismissed.v1';

  /* ------------------------------------------------------------------
     Storage adapter.
     localStorage works from file:// in Chrome and Firefox (all file://
     pages share one origin). Safari blocks it there, so we fall back to
     window.name, which survives navigation between the role pages inside
     the same tab. Demo affordance only; a real build would use a server.
     ------------------------------------------------------------------ */
  var Storage = (function () {
    var ok = false;
    try {
      global.localStorage.setItem('__jjfw_probe__', '1');
      global.localStorage.removeItem('__jjfw_probe__');
      ok = true;
    } catch (e) { ok = false; }

    function bag() {
      try { return JSON.parse(global.name || '{}'); } catch (e) { return {}; }
    }

    return {
      persistent: ok,
      get: function (k) {
        if (ok) return global.localStorage.getItem(k);
        var b = bag();
        return Object.prototype.hasOwnProperty.call(b, k) ? b[k] : null;
      },
      set: function (k, v) {
        if (ok) { global.localStorage.setItem(k, v); return; }
        var b = bag(); b[k] = v; global.name = JSON.stringify(b);
      },
      remove: function (k) {
        if (ok) { global.localStorage.removeItem(k); return; }
        var b = bag(); delete b[k]; global.name = JSON.stringify(b);
      }
    };
  })();

  /* ------------------------------------------------------------------
     Pipelines
     ------------------------------------------------------------------ */
  var SALES_STAGES = [
    'New Lead', 'Contacted', 'Qualified', 'Appointment Set',
    'Estimate Sent', 'Follow-Up', 'Won', 'Lost'
  ];

  // The Installation phase carries two sub-states, flattened here so a job
  // always has exactly one current stage; JOB_PHASES groups them for display.
  var JOB_STAGES = [
    'Deposit Paid', 'Materials Ordered', 'Ready to Schedule',
    'Scheduled', 'En Route', 'In Progress', 'Completed'
  ];

  var JOB_PHASES = [
    { label: 'Deposit Paid',      stages: ['Deposit Paid'] },
    { label: 'Materials Ordered', stages: ['Materials Ordered'] },
    { label: 'Ready to Schedule', stages: ['Ready to Schedule'] },
    { label: 'Scheduled',         stages: ['Scheduled'] },
    { label: 'Installation',      stages: ['En Route', 'In Progress'] },
    { label: 'Completed',         stages: ['Completed'] }
  ];

  var CSR_STAGES = ['New Lead', 'Contacted', 'Appointment Set'];

  /* Categories follow the product lines the company actually sells on its own
     site (jjflooringworld.com): carpet, carpet tile, hardwood and hardwood
     refinishing, luxury vinyl plank, laminate, sheet vinyl and vinyl tile,
     plus the job lines every install carries. */
  var PRODUCT_CATEGORIES = [
    'Carpet', 'Carpet Tile', 'Hardwood', 'Refinishing',
    'Luxury Vinyl Plank', 'Laminate', 'Sheet Vinyl', 'Vinyl Tile',
    'Stairs', 'Removal & Prep', 'Underlayment', 'Transitions',
    'Trim', 'Adhesive', 'Labor'
  ];

  var UNITS = ['SF', 'YD', 'EA', 'LF'];
  var TIERS = ['Good', 'Better', 'Best'];
  var LEAD_SOURCES = ['Facebook Ads', 'Website Form', 'Other'];

  /* Commission policy, resolved in this order and never stored on a line:
       1. the product's own rate, when the product carries one
       2. the rep's rate
       3. this company default
     Every commmission figure in the app is derived through that chain, so the
     rep's own number and the office's earnings report can never drift apart. */
  var DEFAULT_SETTINGS = { defaultCommissionRate: 0.06 };

  /* ------------------------------------------------------------------
     Helpers
     ------------------------------------------------------------------ */
  var seq = 0;
  function uid(prefix) {
    seq += 1;
    return prefix + '_' + Date.now().toString(36) + seq.toString(36);
  }
  function daysAgo(n) {
    var d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(9, 30, 0, 0);
    return d.toISOString();
  }
  function daysAhead(n) {
    var d = new Date();
    d.setDate(d.getDate() + n);
    d.setHours(8, 0, 0, 0);
    return d.toISOString();
  }

  /* ------------------------------------------------------------------
     Seed data
     ------------------------------------------------------------------ */
  function seedUsers() {
    return [
      { id: 'u_admin',  name: 'Janet Ross',      role: 'Admin',     commissionRate: 0 },
      { id: 'u_rep_a',  name: 'Marcus Hale',     role: 'Sales Rep', commissionRate: 0.06 },
      { id: 'u_rep_b',  name: 'Dana Whitfield',  role: 'Sales Rep', commissionRate: 0.055 },
      { id: 'u_csr',    name: 'Priya Nair',      role: 'CSR',       commissionRate: 0 },
      { id: 'u_inst_1', name: 'Tony Alvarez',    role: 'Installer', commissionRate: 0 },
      { id: 'u_inst_2', name: 'Rick Boone',      role: 'Installer', commissionRate: 0 }
    ];
  }

  /* The catalog mirrors what the company actually sells, so a rep quoting a
     job is picking from the same list a customer sees on the website. The
     first seven rows carry the Good / Better / Best tier markers the estimate
     builder reads when it shows the ladder.

     Rows 1 to 23 keep their original positions on purpose: the seeded
     estimates reference them by id, so the demo still tells a coherent story
     after a rename. Rows 24 onward are the remaining site lines.

     Column 7 is the commission the line earns. The finishing materials carry
     their own rate because that is where the money is; consumables, tear-out,
     trim and labour leave it null so they pay the rep's standard rate, which
     is how the fallback chain gets exercised in the demo. */
  function seedProducts() {
    var p = [
      // Luxury vinyl plank, the flagship waterproof line
      ['Luxury Vinyl Plank, Traditional 4mm',    'Luxury Vinyl Plank', 'SF', 2.18,  4.45,  'Good',   0.08],
      ['Luxury Vinyl Plank, Waterproof 6mm',     'Luxury Vinyl Plank', 'SF', 2.74,  5.60,  'Better', 0.09],
      ['Luxury Vinyl Plank, Rigid Core 8mm',     'Luxury Vinyl Plank', 'SF', 3.62,  7.25,  'Best',   0.10],
      // Laminate, the budget alternative to plank
      ['Laminate, 8mm Water Resistant',          'Laminate',           'SF', 2.05,  4.10,  'Good',   0.07],
      // Carpet
      ['Carpet, Plush Polyester',                'Carpet',             'YD', 14.20, 27.50, 'Good',   0.07],
      ['Carpet, Stain-Resistant Nylon',          'Carpet',             'YD', 18.90, 36.00, 'Better', 0.08],
      ['Carpet, Textured Wool Blend',            'Carpet',             'YD', 27.40, 52.00, 'Best',   0.09],
      ['8lb Rebond Carpet Pad',                  'Underlayment',       'YD', 3.10,  6.25,  null,     null],
      ['Plank Underlayment, Vapor Barrier',      'Underlayment',       'SF', 0.42,  0.95,  null,     null],
      // Stairs
      ['Stair Tread Wrap, Stained Oak',          'Stairs',             'EA', 38.00, 96.00, null,     0.06],
      ['Stair Riser Cover, Painted',             'Stairs',             'EA', 12.50, 34.00, null,     null],
      ['Carpet Stair Install, Per Step',         'Stairs',             'EA', 14.00, 38.00, null,     null],
      // Demolition and prep
      ['Tear-Out and Haul, Carpet',              'Removal & Prep',     'SF', 0.38,  0.95,  null,     null],
      ['Tear-Out and Haul, Glue-Down',           'Removal & Prep',     'SF', 0.72,  1.85,  null,     null],
      ['Floor Prep and Level, Skim Coat',        'Removal & Prep',     'SF', 0.55,  1.40,  null,     null],
      // Transitions and trim
      ['T-Molding Transition',                   'Transitions',        'LF', 3.40,  8.50,  null,     null],
      ['Reducer Strip',                          'Transitions',        'LF', 3.10,  7.90,  null,     null],
      ['Quarter Round, Primed',                  'Trim',               'LF', 0.85,  2.60,  null,     null],
      ['Baseboard 3-1/4in, Primed MDF',          'Trim',               'LF', 1.40,  4.20,  null,     null],
      ['Pressure Sensitive Adhesive, 4gal',      'Adhesive',           'EA', 62.00, 118.00, null,     null],
      // Installation labour
      ['Flooring Installation Labor',            'Labor',              'SF', 1.15,  2.85,  null,     null],
      ['Carpet Installation Labor',              'Labor',              'YD', 4.20,  9.50,  null,     null],
      ['Furniture Move, Per Room',               'Labor',              'EA', 22.00, 65.00, null,     null],
      // The rest of the site lines
      ['Carpet Tile, Peel and Stick 20x20',      'Carpet Tile',        'SF', 1.45,  3.20,  null,     0.07],
      ['Commercial Carpet Tile, 24x24',          'Carpet Tile',        'SF', 1.85,  4.20,  null,     0.08],
      ['Solid Hardwood, Oak 3/4in',              'Hardwood',           'SF', 4.10,  8.90,  null,     0.06],
      ['Engineered Hardwood, Hickory',           'Hardwood',           'SF', 3.35,  7.40,  null,     0.06],
      ['Hardwood Refinishing, Sand and Finish',  'Refinishing',        'SF', 1.20,  3.10,  null,     0.10],
      ['Sheet Vinyl, Roll Goods',                'Sheet Vinyl',        'SF', 1.05,  2.55,  null,     0.07],
      ['Vinyl Floor Tile, Glue-Down',            'Vinyl Tile',         'SF', 1.60,  3.75,  null,     0.07],
      ['Laminate Stairs, Per Step',              'Stairs',             'EA', 14.00, 38.00, null,     null],
      ['Vinyl Stairs, Per Step',                 'Stairs',             'EA', 12.50, 34.00, null,     null]
    ];
    return p.map(function (r, i) {
      return {
        id: 'prod_' + (i + 1),
        name: r[0], category: r[1], unit: r[2],
        costPerUnit: r[3], pricePerUnit: r[4],
        tier: r[5], commissionRate: r[6], active: true
      };
    });
  }

  function seedLeads() {
    var rows = [
      ['Eleanor Whitcomb', '(704) 555-0182', 'e.whitcomb@example.com', '28202', '1140 Sycamore Ln, Charlotte, NC',  'Facebook Ads',  'u_rep_a', 'Won',            2,  'Whole main floor LVP, wants Best tier finish.'],
      ['Darnell Pierce',   '(704) 555-0119', 'dpierce@example.com',    '28216', '308 Kestrel Ct, Charlotte, NC',     'Website Form',  'u_rep_a', 'Won',            9,  'Stairs plus upstairs carpet. Referral from neighbor.'],
      ['Sofia Martinelli', '(803) 555-0143', 'sofiam@example.com',     '29708', '44 Waxhaw Trace, Fort Mill, SC',    'Facebook Ads',  'u_rep_b', 'Won',            16, 'Basement LVP over concrete, needed leveling.'],
      ['Grant Ferraro',    '(704) 555-0177', 'gferraro@example.com',   '28277', '9021 Ballantyne Commons, Charlotte','Website Form',  'u_rep_b', 'Estimate Sent',  3,  'Sent Good/Better/Best Tuesday. Comparing with one other bid.'],
      ['Renata Cole',      '(704) 555-0155', 'renata.cole@example.com','28105', '712 Matthews Township Pkwy, Matthews','Other',       'u_rep_a', 'Follow-Up',      6,  'Liked Better tier, waiting on spouse.'],
      ['Micah Bledsoe',    '(704) 555-0190', 'mbledsoe@example.com',   '28078', '15 Northcross Dr, Huntersville, NC','Facebook Ads',  'u_rep_b', 'Appointment Set',1,  'Measure appointment booked, wants carpet in 3 bedrooms.'],
      ['Yvonne Adebayo',   '(704) 555-0133', 'yadebayo@example.com',   '28269', '2204 Prosperity Ridge, Charlotte',  'Website Form',  'u_rep_a', 'Qualified',      2,  'Budget confirmed around 9k. Needs weekend install.'],
      ['Tomas Vidal',      '(803) 555-0166', 'tvidal@example.com',     '29715', '881 Springfield Pkwy, Fort Mill, SC','Facebook Ads', 'u_rep_b', 'Contacted',      1,  'Left voicemail, texted back asking for pricing range.'],
      ['Harriet Okonkwo',  '(704) 555-0121', 'hokonkwo@example.com',   '28211', '3317 Providence Rd, Charlotte, NC', 'Website Form',  'u_rep_a', 'New Lead',       0,  'Form says kitchen and hallway, approx 480 SF.'],
      ['Bryce Lindqvist',  '(704) 555-0104', 'blind@example.com',      '28203', '520 South Blvd, Charlotte, NC',     'Other',         'u_rep_b', 'New Lead',       0,  'Walk-in at showroom. Condo, HOA sound rules apply.'],
      ['Priscilla Hahn',   '(704) 555-0198', 'phahn@example.com',      '28226', '6605 Carmel Rd, Charlotte, NC',     'Facebook Ads',  'u_rep_a', 'Lost',           21, 'Went with a big box retailer on price.']
    ];
    return rows.map(function (r, i) {
      return {
        id: 'lead_' + (i + 1),
        name: r[0], phone: r[1], email: r[2], zipCode: r[3], address: r[4],
        source: r[5], assignedRepId: r[6], stage: r[7],
        createdAt: daysAgo(r[8] + 4),
        appointmentAt: r[7] === 'Appointment Set' ? daysAhead(2) : null,
        notes: [{ at: daysAgo(r[8]), by: 'u_csr', text: r[9] }]
      };
    });
  }

  // Build a line item list from [productId, qty] pairs.
  function li(pairs) {
    return pairs.map(function (p) { return { productId: p[0], qty: p[1] }; });
  }

  function seedEstimates() {
    return [
      {
        id: 'est_1', leadId: 'lead_1', repId: 'u_rep_a', createdAt: daysAgo(14),
        status: 'Signed', signedAt: daysAgo(12), signedByName: 'Eleanor Whitcomb',
        depositPercent: 35, acceptedTier: 'Best',
        tiers: {
          Good:   li([['prod_1', 1180], ['prod_21', 1180], ['prod_13', 1180], ['prod_18', 210]]),
          Better: li([['prod_2', 1180], ['prod_21', 1180], ['prod_13', 1180], ['prod_18', 210], ['prod_16', 34]]),
          Best:   li([['prod_3', 1180], ['prod_21', 1180], ['prod_13', 1180], ['prod_15', 1180], ['prod_19', 210], ['prod_16', 34]])
        }
      },
      {
        id: 'est_2', leadId: 'lead_2', repId: 'u_rep_a', createdAt: daysAgo(11),
        status: 'Signed', signedAt: daysAgo(10), signedByName: 'Darnell Pierce',
        depositPercent: 30, acceptedTier: 'Better',
        tiers: {
          Good:   li([['prod_5', 96], ['prod_8', 96], ['prod_22', 96], ['prod_12', 14]]),
          Better: li([['prod_6', 96], ['prod_8', 96], ['prod_22', 96], ['prod_12', 14], ['prod_13', 860]]),
          Best:   li([['prod_7', 96], ['prod_8', 96], ['prod_22', 96], ['prod_10', 14], ['prod_11', 14], ['prod_13', 860]])
        }
      },
      {
        id: 'est_3', leadId: 'lead_3', repId: 'u_rep_b', createdAt: daysAgo(19),
        status: 'Signed', signedAt: daysAgo(18), signedByName: 'Sofia Martinelli',
        depositPercent: 35, acceptedTier: 'Good',
        tiers: {
          Good:   li([['prod_1', 720], ['prod_21', 720], ['prod_15', 720], ['prod_18', 140]]),
          Better: li([['prod_2', 720], ['prod_21', 720], ['prod_15', 720], ['prod_9', 720], ['prod_18', 140]]),
          Best:   li([['prod_3', 720], ['prod_21', 720], ['prod_15', 720], ['prod_9', 720], ['prod_19', 140], ['prod_17', 22]])
        }
      },
      {
        id: 'est_4', leadId: 'lead_4', repId: 'u_rep_b', createdAt: daysAgo(3),
        status: 'Sent', signedAt: null, signedByName: null,
        depositPercent: 30, acceptedTier: null,
        tiers: {
          Good:   li([['prod_4', 940], ['prod_21', 940], ['prod_13', 940]]),
          Better: li([['prod_2', 940], ['prod_21', 940], ['prod_13', 940], ['prod_16', 28]]),
          Best:   li([['prod_3', 940], ['prod_21', 940], ['prod_14', 940], ['prod_15', 940], ['prod_16', 28]])
        }
      },
      {
        id: 'est_5', leadId: 'lead_5', repId: 'u_rep_a', createdAt: daysAgo(6),
        status: 'Viewed', signedAt: null, signedByName: null,
        depositPercent: 30, acceptedTier: null,
        tiers: {
          Good:   li([['prod_5', 62], ['prod_8', 62], ['prod_22', 62]]),
          Better: li([['prod_6', 62], ['prod_8', 62], ['prod_22', 62], ['prod_23', 3]]),
          Best:   li([['prod_7', 62], ['prod_8', 62], ['prod_22', 62], ['prod_23', 3], ['prod_13', 560]])
        }
      }
    ];
  }

  function seedJobs() {
    return [
      {
        id: 'job_1', leadId: 'lead_1', estimateId: 'est_1', stage: 'Scheduled',
        scheduledDate: daysAhead(3), installerId: 'u_inst_1',
        materialsReceived: true, photos: [], completedAt: null, adminConfirmedAt: null,
        createdAt: daysAgo(12)
      },
      {
        id: 'job_2', leadId: 'lead_2', estimateId: 'est_2', stage: 'In Progress',
        scheduledDate: daysAhead(0), installerId: 'u_inst_1',
        materialsReceived: true,
        photos: [{ id: 'ph_1', label: 'Before', name: 'before-stairs.jpg', at: daysAgo(0) }],
        completedAt: null, adminConfirmedAt: null, createdAt: daysAgo(10)
      },
      {
        id: 'job_3', leadId: 'lead_3', estimateId: 'est_3', stage: 'Completed',
        scheduledDate: daysAgo(4), installerId: 'u_inst_2',
        materialsReceived: true,
        photos: [
          { id: 'ph_2', label: 'Before', name: 'before-basement.jpg', at: daysAgo(4) },
          { id: 'ph_3', label: 'Completion', name: 'after-basement.jpg', at: daysAgo(4) }
        ],
        completedAt: daysAgo(4), adminConfirmedAt: daysAgo(3), createdAt: daysAgo(18)
      }
    ];
  }

  /* ------------------------------------------------------------------
     Money math. Cost and margin are always derived, never stored as
     editable values on an estimate or invoice.
     ------------------------------------------------------------------ */
  function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

  function priceLines(db, lines) {
    return (lines || []).map(function (l) {
      var p = byId(db.products, l.productId);
      if (!p) return null;
      return {
        productId: p.id,
        name: p.name,
        category: p.category,
        unit: p.unit,
        qty: l.qty,
        pricePerUnit: p.pricePerUnit,
        costPerUnit: p.costPerUnit,
        linePrice: round2(p.pricePerUnit * l.qty),
        lineCost: round2(p.costPerUnit * l.qty)
      };
    }).filter(Boolean);
  }

  function totalsFor(db, lines) {
    var rows = priceLines(db, lines);
    var price = 0, cost = 0;
    rows.forEach(function (r) { price += r.linePrice; cost += r.lineCost; });
    price = round2(price); cost = round2(cost);
    return {
      rows: rows,
      totalPrice: price,
      totalCost: cost,
      totalMargin: round2(price - cost),
      marginPct: price > 0 ? round2(((price - cost) / price) * 100) : 0
    };
  }

  function byId(arr, id) {
    for (var i = 0; i < (arr || []).length; i++) if (arr[i].id === id) return arr[i];
    return null;
  }

  function seedInvoices(db) {
    var out = [];
    db.jobs.forEach(function (job) {
      var est = byId(db.estimates, job.estimateId);
      if (!est) return;
      var tier = est.acceptedTier || 'Better';
      var t = totalsFor(db, est.tiers[tier]);
      var deposit = round2(t.totalPrice * (est.depositPercent / 100));
      var paidInFull = job.stage === 'Completed';
      out.push({
        id: 'inv_' + (out.length + 1),
        jobId: job.id,
        estimateId: est.id,
        leadId: job.leadId,
        repId: est.repId,
        tier: tier,
        lineItems: est.tiers[tier],
        totalPrice: t.totalPrice,
        totalCost: t.totalCost,
        totalMargin: t.totalMargin,
        depositPercent: est.depositPercent,
        depositAmount: deposit,
        depositPaid: true,
        balanceAmount: round2(t.totalPrice - deposit),
        paymentStatus: paidInFull ? 'Paid' : 'Partial',
        paidAt: paidInFull ? job.completedAt : null,
        createdAt: job.createdAt
      });
    });
    return out;
  }

  function buildSeed() {
    var db = {
      version: 3,
      seededAt: new Date().toISOString(),
      settings: { defaultCommissionRate: DEFAULT_SETTINGS.defaultCommissionRate },
      users: seedUsers(),
      products: seedProducts(),
      leads: seedLeads(),
      estimates: seedEstimates(),
      jobs: seedJobs(),
      invoices: [],
      syncLog: []
    };
    db.invoices = seedInvoices(db);
    db.syncLog = [
      { id: uid('sync'), at: daysAgo(12), dir: 'out', event: 'opportunity.stage', message: "App → GHL: Opportunity 'Eleanor Whitcomb' moved to 'Won'" },
      { id: uid('sync'), at: daysAgo(10), dir: 'out', event: 'job.created',        message: "App → GHL: Job created for 'Darnell Pierce', pipeline 'Installation'" },
      { id: uid('sync'), at: daysAgo(9),  dir: 'in',  event: 'contact.updated',    message: "GHL → App: Contact 'Tomas Vidal' phone updated" },
      { id: uid('sync'), at: daysAgo(4),  dir: 'out', event: 'job.stage',          message: "App → GHL: Job 'Sofia Martinelli' moved to 'Completed'" }
    ];
    return db;
  }

  /* ------------------------------------------------------------------
     DB access
     ------------------------------------------------------------------ */
  var _cache = null;

  function load() {
    if (_cache) return _cache;
    var raw = Storage.get(STORE_KEY);
    if (!raw) {
      _cache = buildSeed();
      persist();
      return _cache;
    }
    try {
      _cache = JSON.parse(raw);
    } catch (e) {
      _cache = buildSeed();
      persist();
    }
    return _cache;
  }

  function persist() {
    try {
      Storage.set(STORE_KEY, JSON.stringify(_cache));
    } catch (e) {
      // Quota or a blocked store. The app keeps working from the in-memory
      // copy for the rest of the session.
      if (global.console) console.warn('[data] persist failed:', e);
    }
    return _cache;
  }

  function resetDemoData() {
    _cache = buildSeed();
    persist();
    Storage.remove(BANNER_KEY);
    return _cache;
  }

  function hardReset() {
    Storage.remove(STORE_KEY);
    Storage.remove(SESSION_KEY);
    Storage.remove(BANNER_KEY);
    _cache = null;
  }

  /* ------------------------------------------------------------------
     Domain operations
     ------------------------------------------------------------------ */
  function user(id) { return byId(load().users, id); }
  function lead(id) { return byId(load().leads, id); }
  function product(id) { return byId(load().products, id); }
  function estimate(id) { return byId(load().estimates, id); }
  function job(id) { return byId(load().jobs, id); }
  function invoice(id) { return byId(load().invoices, id); }
  function invoiceForJob(jobId) {
    var list = load().invoices;
    for (var i = 0; i < list.length; i++) if (list[i].jobId === jobId) return list[i];
    return null;
  }
  function estimatesForLead(leadId) {
    return load().estimates.filter(function (e) { return e.leadId === leadId; });
  }
  function jobForEstimate(estId) {
    var list = load().jobs;
    for (var i = 0; i < list.length; i++) if (list[i].estimateId === estId) return list[i];
    return null;
  }

  function addLead(fields) {
    var db = load();
    var l = {
      id: uid('lead'),
      name: fields.name,
      phone: fields.phone || '',
      email: fields.email || '',
      zipCode: fields.zipCode || '',
      address: fields.address || '',
      source: fields.source || 'Other',
      assignedRepId: fields.assignedRepId || 'u_rep_a',
      stage: 'New Lead',
      createdAt: new Date().toISOString(),
      appointmentAt: null,
      notes: fields.note ? [{ at: new Date().toISOString(), by: fields.by || 'u_csr', text: fields.note }] : []
    };
    db.leads.unshift(l);
    persist();
    global.GHLSync.out('contact.created', "Contact '" + l.name + "' created, pipeline 'Sales', stage 'New Lead'");
    return l;
  }

  function setLeadStage(leadId, stage, actorId) {
    var l = lead(leadId);
    if (!l || l.stage === stage) return l;
    l.stage = stage;
    persist();
    global.GHLSync.out('opportunity.stage', "Opportunity '" + l.name + "' moved to '" + stage + "'");
    return l;
  }

  function addLeadNote(leadId, text, actorId) {
    var l = lead(leadId);
    if (!l) return null;
    l.notes = l.notes || [];
    l.notes.unshift({ at: new Date().toISOString(), by: actorId || 'u_csr', text: text });
    persist();
    global.GHLSync.out('note.created', "Note added to contact '" + l.name + "'");
    return l;
  }

  function setAppointment(leadId, isoDate) {
    var l = lead(leadId);
    if (!l) return null;
    l.appointmentAt = isoDate;
    if (l.stage === 'New Lead' || l.stage === 'Contacted' || l.stage === 'Qualified') {
      l.stage = 'Appointment Set';
    }
    persist();
    global.GHLSync.out('appointment.created', "Appointment booked for '" + l.name + "'");
    return l;
  }

  function saveProduct(fields) {
    var db = load();
    var p = fields.id ? byId(db.products, fields.id) : null;
    if (!p) {
      p = { id: uid('prod'), active: true };
      db.products.push(p);
    }
    p.name = fields.name;
    p.category = fields.category;
    p.unit = fields.unit;
    p.costPerUnit = Number(fields.costPerUnit) || 0;
    p.pricePerUnit = Number(fields.pricePerUnit) || 0;
    p.tier = fields.tier || null;
    p.commissionRate = normaliseRate(fields.commissionRate);
    if (typeof fields.active === 'boolean') p.active = fields.active;
    persist();
    global.GHLSync.out('product.updated', "Product '" + p.name + "' saved to the product catalog");
    return p;
  }

  /* A blank rate is meaningful: it means "pay whatever the rep's rate is",
     which is not the same as a rate of zero. */
  function normaliseRate(value) {
    if (value === null || value === undefined || value === '') return null;
    var n = Number(value);
    return isNaN(n) ? null : n;
  }

  function setProductCommission(id, rate) {
    var p = product(id);
    if (!p) return null;
    p.commissionRate = normaliseRate(rate);
    persist();
    global.GHLSync.out('product.commission', "Commission on '" + p.name + "' set to " +
      (p.commissionRate === null ? 'the rep rate' : (p.commissionRate * 100) + '%'));
    return p;
  }

  function settings() {
    var db = load();
    if (!db.settings) db.settings = { defaultCommissionRate: DEFAULT_SETTINGS.defaultCommissionRate };
    return db.settings;
  }

  function saveSettings(fields) {
    var s = settings();
    if (fields && fields.defaultCommissionRate !== undefined) {
      s.defaultCommissionRate = normaliseRate(fields.defaultCommissionRate);
      if (s.defaultCommissionRate === null) s.defaultCommissionRate = 0;
    }
    persist();
    return s;
  }

  function toggleProduct(id) {
    var p = product(id);
    if (!p) return null;
    p.active = !p.active;
    persist();
    return p;
  }

  function saveUser(fields) {
    var db = load();
    var u = fields.id ? byId(db.users, fields.id) : null;
    if (!u) { u = { id: uid('u') }; db.users.push(u); }
    u.name = fields.name;
    u.role = fields.role;
    u.commissionRate = Number(fields.commissionRate) || 0;
    persist();
    return u;
  }

  function removeUser(id) {
    var db = load();
    if (id === 'u_admin') return false;
    db.users = db.users.filter(function (u) { return u.id !== id; });
    persist();
    return true;
  }

  function saveEstimate(fields) {
    var db = load();
    var e = fields.id ? byId(db.estimates, fields.id) : null;
    if (!e) {
      e = {
        id: uid('est'),
        createdAt: new Date().toISOString(),
        status: 'Draft',
        signedAt: null,
        signedByName: null,
        acceptedTier: null
      };
      db.estimates.push(e);
    }
    e.leadId = fields.leadId;
    e.repId = fields.repId;
    e.depositPercent = Number(fields.depositPercent) || 30;
    e.tiers = fields.tiers;
    persist();
    return e;
  }

  function sendEstimate(estId) {
    var e = estimate(estId);
    if (!e) return null;
    e.status = 'Sent';
    persist();
    var l = lead(e.leadId);
    setLeadStage(e.leadId, 'Estimate Sent');
    global.GHLSync.out('estimate.sent', "Estimate " + e.id + " sent to '" + (l ? l.name : e.leadId) + "'");
    return e;
  }

  function markEstimateViewed(estId) {
    var e = estimate(estId);
    if (!e || e.status !== 'Sent') return e;
    e.status = 'Viewed';
    persist();
    global.GHLSync['in']('estimate.viewed', "Estimate " + e.id + " opened by customer");
    return e;
  }

  /* Signing is the hinge of the whole demo: it wins the lead, creates the
     job and the invoice, and fires three sync events. The deposit is
     recorded as paid at signature to keep the click-through short; a real
     build would wait on a payment webhook from GHL. */
  function signEstimate(estId, typedName, tier) {
    var db = load();
    var e = estimate(estId);
    if (!e) return null;

    e.status = 'Signed';
    e.signedAt = new Date().toISOString();
    e.signedByName = typedName;
    e.acceptedTier = tier;

    setLeadStage(e.leadId, 'Won');

    var existing = jobForEstimate(e.id);
    var j = existing || {
      id: uid('job'),
      leadId: e.leadId,
      estimateId: e.id,
      stage: 'Deposit Paid',
      scheduledDate: null,
      installerId: null,
      materialsReceived: false,
      photos: [],
      completedAt: null,
      adminConfirmedAt: null,
      createdAt: new Date().toISOString()
    };
    if (!existing) db.jobs.unshift(j);

    var t = totalsFor(db, e.tiers[tier]);
    var deposit = round2(t.totalPrice * (e.depositPercent / 100));
    var inv = invoiceForJob(j.id);
    if (!inv) {
      inv = { id: uid('inv'), jobId: j.id, createdAt: new Date().toISOString() };
      db.invoices.unshift(inv);
    }
    inv.estimateId = e.id;
    inv.leadId = e.leadId;
    inv.repId = e.repId;
    inv.tier = tier;
    inv.lineItems = e.tiers[tier];
    inv.totalPrice = t.totalPrice;
    inv.totalCost = t.totalCost;
    inv.totalMargin = t.totalMargin;
    inv.depositPercent = e.depositPercent;
    inv.depositAmount = deposit;
    inv.depositPaid = true;
    inv.balanceAmount = round2(t.totalPrice - deposit);
    inv.paymentStatus = 'Partial';
    inv.paidAt = null;

    persist();

    var l = lead(e.leadId);
    var who = l ? l.name : e.leadId;
    global.GHLSync.out('estimate.signed', "Estimate " + e.id + " signed by '" + typedName + "' (" + tier + " tier)");
    global.GHLSync.out('job.created', "Job " + j.id + " created for '" + who + "', pipeline 'Installation', stage 'Deposit Paid'");
    global.GHLSync.out('invoice.created', "Invoice " + inv.id + " created, deposit recorded");

    return { estimate: e, job: j, invoice: inv };
  }

  function setJobStage(jobId, stage) {
    var j = job(jobId);
    if (!j || j.stage === stage) return j;
    j.stage = stage;
    if (stage === 'Completed') j.completedAt = new Date().toISOString();
    persist();
    var l = lead(j.leadId);
    global.GHLSync.out('job.stage', "Job '" + (l ? l.name : j.id) + "' moved to '" + stage + "'");
    return j;
  }

  function assignInstaller(jobId, installerId, isoDate) {
    var j = job(jobId);
    if (!j) return null;
    j.installerId = installerId || null;
    if (isoDate) j.scheduledDate = isoDate;
    if (j.installerId && j.scheduledDate && JOB_STAGES.indexOf(j.stage) < JOB_STAGES.indexOf('Scheduled')) {
      j.stage = 'Scheduled';
    }
    persist();
    var l = lead(j.leadId);
    var u = user(installerId);
    global.GHLSync.out('job.assigned', "Job '" + (l ? l.name : j.id) + "' assigned to " + (u ? u.name : 'unassigned'));
    return j;
  }

  function setMaterialsReceived(jobId, value) {
    var j = job(jobId);
    if (!j) return null;
    j.materialsReceived = !!value;
    persist();
    var l = lead(j.leadId);
    global.GHLSync.out('job.materials', "Materials " + (value ? 'confirmed received' : 'marked outstanding') + " for '" + (l ? l.name : j.id) + "'");
    return j;
  }

  function addJobPhoto(jobId, label, name) {
    var j = job(jobId);
    if (!j) return null;
    j.photos = j.photos || [];
    j.photos.push({ id: uid('ph'), label: label, name: name, at: new Date().toISOString() });
    persist();
    global.GHLSync.out('job.photo', label + " photo attached to job " + j.id);
    return j;
  }

  function confirmJob(jobId) {
    var j = job(jobId);
    if (!j) return null;
    j.adminConfirmedAt = new Date().toISOString();
    persist();
    return j;
  }

  function setPaymentStatus(invoiceId, status) {
    var inv = invoice(invoiceId);
    if (!inv) return null;
    inv.paymentStatus = status;
    if (status === 'Paid') {
      inv.paidAt = new Date().toISOString();
      inv.depositPaid = true;
    }
    if (status === 'Unpaid') { inv.depositPaid = false; inv.paidAt = null; }
    persist();
    var l = lead(inv.leadId);
    global.GHLSync.out('invoice.payment', "Invoice " + inv.id + " for '" + (l ? l.name : '') + "' marked " + status);
    return inv;
  }

  /* ------------------------------------------------------------------
     Commission and earnings
     Every commission figure in the app comes out of this block, so the
     number a rep sees on their own page is the same number the office sees
     on the earnings report. Nothing here is stored: it is all derived from
     the invoice lines and the two rates.
     ------------------------------------------------------------------ */
  function rateForProduct(p) {
    if (!p) return null;
    return typeof p.commissionRate === 'number' ? p.commissionRate : null;
  }

  /* Product override, else the rep's rate, else the company default. */
  function commissionRateFor(db, productId, repId) {
    var own = rateForProduct(byId(db.products, productId));
    if (own !== null) return own;
    var u = byId(db.users, repId);
    if (u && typeof u.commissionRate === 'number' && u.commissionRate > 0) return u.commissionRate;
    var fallback = db.settings && typeof db.settings.defaultCommissionRate === 'number'
      ? db.settings.defaultCommissionRate
      : DEFAULT_SETTINGS.defaultCommissionRate;
    return fallback || 0;
  }

  function invoiceCommission(inv) {
    var db = load();
    var total = 0;
    var lines = priceLines(db, inv.lineItems).map(function (r) {
      var rate = commissionRateFor(db, r.productId, inv.repId);
      var amount = round2(r.linePrice * rate);
      total += amount;
      return {
        productId: r.productId, name: r.name,
        linePrice: r.linePrice, rate: rate, amount: amount
      };
    });
    return { total: round2(total), lines: lines };
  }

  /* What each product has actually earned, across every invoice raised. */
  function productEarnings() {
    var db = load();
    var map = {};

    db.invoices.forEach(function (inv) {
      priceLines(db, inv.lineItems).forEach(function (r) {
        var rec = map[r.productId];
        if (!rec) {
          rec = map[r.productId] = {
            productId: r.productId, name: r.name, category: r.category, unit: r.unit,
            units: 0, orders: 0, revenue: 0, cost: 0, commission: 0
          };
        }
        rec.units += r.qty;
        rec.orders += 1;
        rec.revenue += r.linePrice;
        rec.cost += r.lineCost;
        rec.commission += r.linePrice * commissionRateFor(db, r.productId, inv.repId);
      });
    });

    var out = Object.keys(map).map(function (k) {
      var r = map[k];
      r.revenue = round2(r.revenue);
      r.cost = round2(r.cost);
      r.commission = round2(r.commission);
      r.margin = round2(r.revenue - r.cost);
      r.net = round2(r.margin - r.commission);
      r.marginPct = r.revenue ? round2((r.margin / r.revenue) * 100) : 0;
      r.effectiveRate = r.revenue ? round2((r.commission / r.revenue) * 100) : 0;
      return r;
    });

    out.sort(function (a, b) { return b.revenue - a.revenue; });
    return out;
  }

  function commissionTotals() {
    var db = load();
    var rows = productEarnings();
    var t = {
      revenue: 0, cost: 0, margin: 0, commission: 0, net: 0,
      soldCount: rows.length, productCount: db.products.length
    };
    rows.forEach(function (r) {
      t.revenue += r.revenue;
      t.cost += r.cost;
      t.margin += r.margin;
      t.commission += r.commission;
      t.net += r.net;
    });
    t.revenue = round2(t.revenue);
    t.cost = round2(t.cost);
    t.margin = round2(t.margin);
    t.commission = round2(t.commission);
    t.net = round2(t.net);
    t.marginPct = t.revenue ? round2((t.margin / t.revenue) * 100) : 0;
    t.effectiveRate = t.revenue ? round2((t.commission / t.revenue) * 100) : 0;
    return t;
  }

  /* Commission owed, per rep, taken from the same line math as the report. */
  function repCommission() {
    var db = load();
    return db.users.filter(function (u) { return u.role === 'Sales Rep'; }).map(function (u) {
      var revenue = 0, commission = 0, deals = 0;
      db.invoices.forEach(function (inv) {
        var l = byId(db.leads, inv.leadId);
        var owner = inv.repId || (l ? l.assignedRepId : null);
        if (owner !== u.id) return;
        deals += 1;
        revenue += inv.totalPrice;
        commission += invoiceCommission(inv).total;
      });
      revenue = round2(revenue);
      commission = round2(commission);
      return {
        repId: u.id, name: u.name, rate: u.commissionRate,
        deals: deals, revenue: revenue, commission: commission,
        effectiveRate: revenue ? round2((commission / revenue) * 100) : 0
      };
    }).sort(function (a, b) { return b.commission - a.commission; });
  }

  /* ------------------------------------------------------------------
     Derived reporting
     ------------------------------------------------------------------ */
  function jobFinancials(jobId) {
    var inv = invoiceForJob(jobId);
    if (!inv) return { totalPrice: 0, totalCost: 0, totalMargin: 0, marginPct: 0 };
    return {
      totalPrice: inv.totalPrice,
      totalCost: inv.totalCost,
      totalMargin: inv.totalMargin,
      marginPct: inv.totalPrice ? round2((inv.totalMargin / inv.totalPrice) * 100) : 0
    };
  }

  function companyTotals() {
    var db = load();
    var price = 0, cost = 0, outstanding = 0, collected = 0;
    db.invoices.forEach(function (inv) {
      price += inv.totalPrice;
      cost += inv.totalCost;
      if (inv.paymentStatus === 'Paid') {
        collected += inv.totalPrice;
      } else if (inv.paymentStatus === 'Partial') {
        collected += inv.depositAmount;
        outstanding += inv.balanceAmount;
      } else {
        outstanding += inv.totalPrice;
      }
    });
    return {
      revenue: round2(price),
      cost: round2(cost),
      margin: round2(price - cost),
      marginPct: price ? round2(((price - cost) / price) * 100) : 0,
      outstanding: round2(outstanding),
      collected: round2(collected),
      jobCount: db.jobs.length
    };
  }

  function repStats(repId) {
    var db = load();
    var u = user(repId);
    var won = db.leads.filter(function (l) { return l.assignedRepId === repId && l.stage === 'Won'; });
    var wonIds = won.map(function (l) { return l.id; });
    var revenue = 0, commission = 0;
    db.invoices.forEach(function (inv) {
      if (wonIds.indexOf(inv.leadId) === -1) return;
      revenue += inv.totalPrice;
      commission += invoiceCommission(inv).total;
    });
    var open = db.leads.filter(function (l) {
      return l.assignedRepId === repId && l.stage !== 'Won' && l.stage !== 'Lost';
    }).length;
    var lost = db.leads.filter(function (l) { return l.assignedRepId === repId && l.stage === 'Lost'; }).length;
    var rate = u ? (u.commissionRate || 0) : 0;
    revenue = round2(revenue);
    commission = round2(commission);
    return {
      repId: repId,
      name: u ? u.name : repId,
      dealsWon: won.length,
      dealsLost: lost,
      openLeads: open,
      revenue: revenue,
      commissionRate: rate,
      /* What the rep actually earned per dollar, once product overrides are
         applied. It differs from commissionRate as soon as a product on one
         of their jobs carries its own rate. */
      effectiveRate: revenue ? round2((commission / revenue) * 100) : rate * 100,
      commission: commission,
      closeRate: (won.length + lost) ? round2((won.length / (won.length + lost)) * 100) : 0
    };
  }

  function salesFunnel() {
    var db = load();
    return SALES_STAGES.map(function (s) {
      return { stage: s, count: db.leads.filter(function (l) { return l.stage === s; }).length };
    });
  }

  function jobPipelineCounts() {
    var db = load();
    return JOB_PHASES.map(function (p) {
      return {
        label: p.label,
        count: db.jobs.filter(function (j) { return p.stages.indexOf(j.stage) !== -1; }).length
      };
    });
  }

  /* ------------------------------------------------------------------
     Export
     ------------------------------------------------------------------ */
  global.DB = {
    STORE_KEY: STORE_KEY,
    SESSION_KEY: SESSION_KEY,
    BANNER_KEY: BANNER_KEY,
    Storage: Storage,

    SALES_STAGES: SALES_STAGES,
    JOB_STAGES: JOB_STAGES,
    JOB_PHASES: JOB_PHASES,
    CSR_STAGES: CSR_STAGES,
    PRODUCT_CATEGORIES: PRODUCT_CATEGORIES,
    UNITS: UNITS,
    TIERS: TIERS,
    LEAD_SOURCES: LEAD_SOURCES,

    load: load,
    save: persist,
    resetDemoData: resetDemoData,
    hardReset: hardReset,
    uid: uid,
    round2: round2,

    user: user, lead: lead, product: product,
    estimate: estimate, job: job, invoice: invoice,
    invoiceForJob: invoiceForJob,
    estimatesForLead: estimatesForLead,
    jobForEstimate: jobForEstimate,

    addLead: addLead,
    setLeadStage: setLeadStage,
    addLeadNote: addLeadNote,
    setAppointment: setAppointment,

    saveProduct: saveProduct,
    toggleProduct: toggleProduct,
    setProductCommission: setProductCommission,
    settings: settings,
    saveSettings: saveSettings,
    saveUser: saveUser,
    removeUser: removeUser,

    saveEstimate: saveEstimate,
    sendEstimate: sendEstimate,
    markEstimateViewed: markEstimateViewed,
    signEstimate: signEstimate,

    setJobStage: setJobStage,
    assignInstaller: assignInstaller,
    setMaterialsReceived: setMaterialsReceived,
    addJobPhoto: addJobPhoto,
    confirmJob: confirmJob,
    setPaymentStatus: setPaymentStatus,

    priceLines: priceLines,
    totalsFor: totalsFor,
    rateForProduct: rateForProduct,
    commissionRateFor: commissionRateFor,
    invoiceCommission: invoiceCommission,
    productEarnings: productEarnings,
    commissionTotals: commissionTotals,
    repCommission: repCommission,
    jobFinancials: jobFinancials,
    companyTotals: companyTotals,
    repStats: repStats,
    salesFunnel: salesFunnel,
    jobPipelineCounts: jobPipelineCounts
  };

})(window);
