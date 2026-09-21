/* ==========================================================================
   installer.js  -  Installer job list and status flow
   --------------------------------------------------------------------------
   PERMISSIONS: this module reads product names, units and quantities only.
   It never reads pricePerUnit, costPerUnit or any invoice field, so no money
   figure of any kind is constructed for this role. It also filters strictly
   on installerId, so another crew's jobs are never built into the DOM.
   ========================================================================== */

(function (global) {
  'use strict';

  var UI = global.UI;
  var me = null;

  function myJobs() {
    return global.DB.load().jobs.filter(function (j) { return j.installerId === me.id; });
  }

  function sortByDate(a, b) {
    return new Date(a.scheduledDate || 0) - new Date(b.scheduledDate || 0);
  }

  function isToday(iso) {
    if (!iso) return false;
    var d = new Date(iso), t = new Date();
    return d.toDateString() === t.toDateString();
  }

  /* Scope of work: names, units and quantities. No prices are read. */
  function scopeList(job) {
    var inv = global.DB.invoiceForJob(job.id);
    var lines = inv ? inv.lineItems : [];
    var ul = UI.el('ul', { class: 'scope-list' });
    if (!lines.length) {
      ul.appendChild(UI.el('li', {}, [UI.el('span', { class: 't-meta', text: 'Scope not attached yet.' })]));
      return ul;
    }
    lines.forEach(function (l) {
      var p = global.DB.product(l.productId);
      if (!p) return;
      ul.appendChild(UI.el('li', {}, [
        UI.el('span', { text: p.name }),
        UI.el('span', { class: 'q', text: UI.qty(l.qty) + ' ' + p.unit })
      ]));
    });
    return ul;
  }

  /* Sequential status. Exactly one action is live at any moment. */
  var FLOW = [
    { from: 'Scheduled',   to: 'En Route',    label: 'Mark En Route' },
    { from: 'En Route',    to: 'In Progress', label: 'Mark In Progress' },
    { from: 'In Progress', to: 'Completed',   label: 'Mark Completed' }
  ];

  function nextAction(job) {
    for (var i = 0; i < FLOW.length; i++) if (FLOW[i].from === job.stage) return FLOW[i];
    return null;
  }

  function statusButtons(job, onChange) {
    var wrap = UI.el('div', { class: 'row-wrap' });
    var next = nextAction(job);

    FLOW.forEach(function (step) {
      var done = global.DB.JOB_STAGES.indexOf(job.stage) > global.DB.JOB_STAGES.indexOf(step.from);
      var live = next && next.from === step.from;
      var btn = UI.el('button', {
        class: 'btn btn-sm' + (live ? ' btn-go' : ''),
        text: step.label,
        'aria-disabled': live ? null : 'true',
        onclick: function () {
          if (!live) return;
          if (step.to === 'Completed' && !job.materialsReceived) {
            UI.toast('Confirm materials received before closing the job.', 'warn');
            return;
          }
          global.DB.setJobStage(job.id, step.to);
          UI.toast(step.label.replace('Mark ', 'Status: '), 'ok');
          if (onChange) onChange();
        }
      });
      if (done) { btn.textContent = step.to + ' ✓'; btn.classList.add('btn-ghost'); }
      wrap.appendChild(btn);
    });

    if (job.stage === 'Completed') {
      wrap.appendChild(UI.el('span', { class: 'pill pill-moss pill-dot', text: 'Job closed' }));
    }
    if (global.DB.JOB_STAGES.indexOf(job.stage) < global.DB.JOB_STAGES.indexOf('Scheduled')) {
      UI.clear(wrap);
      wrap.appendChild(UI.el('span', { class: 'pill pill-slate pill-dot', text: 'Waiting on the office to schedule' }));
    }
    return wrap;
  }

  function photoSection(job, onChange) {
    var wrap = UI.el('div', {});
    wrap.appendChild(UI.el('div', { class: 'spread', style: 'margin-bottom:10px' }, [
      UI.el('span', { class: 'label', style: 'margin:0', text: 'Job photos' }),
      UI.el('button', { class: 'btn btn-sm', text: '+ Add Photo', onclick: function () { addPhoto(job, onChange); } })
    ]));
    if (!(job.photos && job.photos.length)) {
      wrap.appendChild(UI.el('div', { class: 't-meta', text: 'No photos yet. Before, progress and completion shots all help the office close the job.' }));
      return wrap;
    }
    wrap.appendChild(UI.el('div', { class: 'photo-grid' }, job.photos.map(function (p) {
      return UI.el('div', { class: 'photo-chip' }, [
        UI.el('span', { class: 'lbl', text: p.label }),
        UI.el('span', { class: 'tm', text: UI.dt(p.at, true) })
      ]);
    })));
    return wrap;
  }

  /* Placeholder capture. No upload backend: the filename and a label are
     stored so the flow is demoable end to end. */
  function addPhoto(job, onChange) {
    var sel = UI.el('select', { class: 'select' });
    ['Before', 'Progress', 'Completion', 'Issue'].forEach(function (l) {
      sel.appendChild(UI.el('option', { value: l, text: l }));
    });
    var nameIn = UI.el('input', { class: 'input', value: 'IMG_' + Math.floor(1000 + Math.random() * 8999) + '.jpg' });

    UI.modal({
      title: 'Add photo',
      subtitle: 'Placeholder capture, no file is uploaded in this prototype',
      body: UI.el('div', {}, [
        UI.el('label', { class: 'field' }, [UI.el('span', { class: 'label', text: 'Label' }), sel]),
        UI.el('label', { class: 'field' }, [UI.el('span', { class: 'label', text: 'File name' }), nameIn])
      ]),
      actions: [
        { label: 'Cancel', tone: 'btn-ghost' },
        {
          label: 'Attach', tone: 'btn-primary',
          onClick: function () {
            global.DB.addJobPhoto(job.id, sel.value, nameIn.value || 'photo.jpg');
            UI.toast(sel.value + ' photo attached.', 'ok');
            if (onChange) onChange();
          }
        }
      ]
    });
  }

  function jobCard(job, onChange, opts) {
    opts = opts || {};
    var lead = global.DB.lead(job.leadId);
    var cls = 'job-card' + (job.stage === 'Completed' ? ' is-done' : isToday(job.scheduledDate) ? ' is-today' : '');

    var top = UI.el('div', { class: 'jc-top' }, [
      UI.el('div', { class: 'jc-name', text: lead ? lead.name : job.leadId }),
      UI.el('div', { class: 'jc-addr', text: lead ? lead.address : '' }),
      UI.el('div', { class: 'jc-meta' }, [
        UI.stagePill(job.stage),
        UI.el('span', { class: 'pill pill-outline', text: UI.dayLabel(job.scheduledDate) }),
        UI.el('span', { class: 'pill ' + (job.materialsReceived ? 'pill-moss' : 'pill-clay'),
          text: job.materialsReceived ? 'Materials in' : 'Materials pending' })
      ])
    ]);

    var card = UI.el('div', { class: cls }, [top]);

    if (opts.expanded) {
      card.appendChild(UI.el('div', { style: 'padding:0 15px 13px' }, [
        UI.el('div', { class: 'label', text: 'Scope of work' }),
        scopeList(job),
        UI.el('hr', { class: 'divider' }),
        UI.el('label', { class: 'check' }, [
          UI.el('input', {
            type: 'checkbox', checked: job.materialsReceived ? true : null,
            onchange: function (e) {
              global.DB.setMaterialsReceived(job.id, e.target.checked);
              UI.toast(e.target.checked ? 'Materials confirmed received.' : 'Materials marked outstanding.');
              if (onChange) onChange();
            }
          }),
          UI.el('span', { text: 'Confirm materials received' })
        ]),
        UI.el('hr', { class: 'divider' }),
        photoSection(job, onChange)
      ]));
      card.appendChild(UI.el('div', { class: 'jc-foot' }, [statusButtons(job, onChange)]));
    } else {
      card.appendChild(UI.el('div', { class: 'jc-foot' }, [
        UI.el('button', {
          class: 'btn btn-sm btn-primary', text: 'Open job',
          onclick: function () { openJob(job, onChange); }
        }),
        UI.el('a', {
          class: 'btn btn-sm', target: '_blank', rel: 'noopener',
          href: 'https://maps.google.com/?q=' + encodeURIComponent(lead ? lead.address : ''),
          text: 'Directions'
        })
      ]));
    }

    return card;
  }

  function openJob(job, onChange) {
    var lead = global.DB.lead(job.leadId);
    var body = UI.el('div', {});

    function redraw() {
      UI.clear(body);
      var fresh = global.DB.job(job.id);
      body.appendChild(global.Pipeline.jobRail(fresh.stage));
      body.appendChild(UI.el('hr', { class: 'divider' }));
      body.appendChild(UI.el('div', { class: 'label', text: 'Scope of work' }));
      body.appendChild(scopeList(fresh));
      body.appendChild(UI.el('hr', { class: 'divider' }));
      body.appendChild(UI.el('label', { class: 'check' }, [
        UI.el('input', {
          type: 'checkbox', checked: fresh.materialsReceived ? true : null,
          onchange: function (e) {
            global.DB.setMaterialsReceived(fresh.id, e.target.checked);
            UI.toast(e.target.checked ? 'Materials confirmed received.' : 'Materials marked outstanding.');
            redraw(); if (onChange) onChange();
          }
        }),
        UI.el('span', { text: 'Confirm materials received' })
      ]));
      body.appendChild(UI.el('hr', { class: 'divider' }));
      body.appendChild(photoSection(fresh, function () { redraw(); if (onChange) onChange(); }));
      body.appendChild(UI.el('hr', { class: 'divider' }));
      body.appendChild(UI.el('div', { class: 'label', text: 'Status' }));
      body.appendChild(statusButtons(fresh, function () { redraw(); if (onChange) onChange(); }));
    }
    redraw();

    UI.modal({
      title: lead ? lead.name : job.id,
      subtitle: (lead ? lead.address : '') + ', ' + UI.dayLabel(job.scheduledDate),
      body: body,
      actions: [{ label: 'Close', tone: 'btn-ghost' }]
    });
  }

  /* ------------------------------------------------------------------ views */
  function render() {
    var jobs = myJobs();
    var today = jobs.filter(function (j) { return isToday(j.scheduledDate) && j.stage !== 'Completed'; }).sort(sortByDate);
    var active = jobs.filter(function (j) { return j.stage !== 'Completed'; }).sort(sortByDate);
    var done = jobs.filter(function (j) { return j.stage === 'Completed'; }).sort(sortByDate).reverse();

    drawList('today', today, 'Nothing on today', 'No installs are scheduled for you today. Check Upcoming for what is next.', true);
    drawList('upcoming', active, 'No open jobs', 'When the office schedules you, jobs land here.', false);
    drawList('done', done, 'No completed jobs yet', 'Finished installs stay here for your records.', false);

    var badge = document.querySelector('[data-count="today"]');
    if (badge) badge.textContent = today.length ? String(today.length) : '';
  }

  function drawList(name, list, emptyTitle, emptyMsg, expandFirst) {
    var m = document.querySelector('[data-mount="' + name + '"]');
    if (!m) return;
    UI.clear(m);
    if (!list.length) { m.appendChild(UI.empty(emptyTitle, emptyMsg)); return; }
    list.forEach(function (j, i) {
      m.appendChild(jobCard(j, render, { expanded: expandFirst && i === 0 }));
    });
  }

  function init(user) {
    me = user;
    render();
  }

  global.InstallerView = { init: init, render: render, openJob: openJob };

})(window);
