/* ==========================================================================
   pipeline.js  -  sales pipeline and job pipeline rendering
   Stage changes are button/dropdown driven rather than drag and drop: it is
   the same number of clicks on a phone and it never strands a card.
   ========================================================================== */

(function (global) {
  'use strict';

  var UI = global.UI;

  function nextSalesStage(stage) {
    var i = global.DB.SALES_STAGES.indexOf(stage);
    if (i < 0 || stage === 'Won' || stage === 'Lost') return null;
    var n = global.DB.SALES_STAGES[i + 1];
    return n === 'Won' ? null : n; // Won is reached by signing, not by nudging
  }

  function jobPhaseOf(stage) {
    var phases = global.DB.JOB_PHASES;
    for (var i = 0; i < phases.length; i++) {
      if (phases[i].stages.indexOf(stage) !== -1) return phases[i].label;
    }
    return stage;
  }

  function nextJobStage(stage) {
    var i = global.DB.JOB_STAGES.indexOf(stage);
    if (i < 0 || i === global.DB.JOB_STAGES.length - 1) return null;
    return global.DB.JOB_STAGES[i + 1];
  }

  /* --- Lead kanban -------------------------------------------------------- */
  function leadBoard(leads, opts) {
    opts = opts || {};
    var stages = opts.stages || global.DB.SALES_STAGES;
    var board = UI.el('div', { class: 'board' });

    stages.forEach(function (stage) {
      var items = leads.filter(function (l) { return l.stage === stage; });
      var cls = 'col' + (stage === 'Won' ? ' won' : stage === 'Lost' ? ' lost' : '');
      var col = UI.el('div', { class: cls }, [
        UI.el('div', { class: 'col-head' }, [
          UI.el('span', { class: 'name', text: stage }),
          UI.el('span', { class: 'count', text: String(items.length) })
        ])
      ]);
      var body = UI.el('div', { class: 'col-body' });

      if (!items.length) {
        body.appendChild(UI.el('div', { class: 't-meta', style: 'padding:4px 2px', text: 'Nothing here' }));
      }

      items.forEach(function (l) {
        var rep = global.DB.user(l.assignedRepId);
        var tileCls = 'tile' + (stage === 'Won' ? ' won' : stage === 'Lost' ? ' lost' : '');
        var tile = UI.el('div', {
          class: tileCls, tabindex: '0', role: 'button',
          onclick: function () { if (opts.onOpen) opts.onOpen(l); },
          onkeydown: function (e) { if (e.key === 'Enter' && opts.onOpen) opts.onOpen(l); }
        }, [
          UI.el('div', { class: 'tile-name', text: l.name }),
          UI.el('div', { class: 'tile-meta', text: l.zipCode + ', ' + l.source }),
          UI.el('div', { class: 'tile-foot' }, [
            opts.showRep !== false && rep ? UI.el('span', { class: 'pill pill-outline', text: rep.name.split(' ')[0] }) : null,
            UI.el('span', { class: 't-meta', text: UI.relative(l.createdAt) })
          ])
        ]);
        body.appendChild(tile);
      });

      col.appendChild(body);
      board.appendChild(col);
    });

    return board;
  }

  /* --- Funnel ------------------------------------------------------------- */
  function funnel(rows) {
    var max = rows.reduce(function (m, r) { return Math.max(m, r.count); }, 0) || 1;
    var wrap = UI.el('div', { class: 'funnel' });
    rows.forEach(function (r) {
      var cls = 'funnel-row' + (r.stage === 'Won' ? ' is-won' : r.stage === 'Lost' ? ' is-lost' : '');
      wrap.appendChild(UI.el('div', { class: cls }, [
        UI.el('span', { class: 'fl', text: r.stage }),
        UI.el('span', { class: 'funnel-bar' }, [
          UI.el('span', { style: 'width:' + Math.round((r.count / max) * 100) + '%' })
        ]),
        UI.el('span', { class: 'fn', text: String(r.count) })
      ]));
    });
    return wrap;
  }

  /* --- Job stage rail ----------------------------------------------------- */
  function jobRail(currentStage) {
    var phases = global.DB.JOB_PHASES;
    var currentPhase = jobPhaseOf(currentStage);
    var idx = phases.map(function (p) { return p.label; }).indexOf(currentPhase);
    var rail = UI.el('div', { class: 'rail' });
    phases.forEach(function (p, i) {
      var cls = 'rail-step' + (i < idx ? ' done' : i === idx ? ' current' : '');
      var label = p.label;
      if (i === idx && p.stages.length > 1) label = p.label + ' (' + currentStage + ')';
      rail.appendChild(UI.el('div', { class: cls }, [
        UI.el('span', { class: 'dot' }),
        UI.el('span', { text: label })
      ]));
    });
    return rail;
  }

  /* --- Stage change control ---------------------------------------------- */
  function stageSelect(current, stages, onChange) {
    var sel = UI.el('select', { class: 'select', onchange: function () { onChange(sel.value); } });
    stages.forEach(function (s) {
      sel.appendChild(UI.el('option', { value: s, text: s, selected: s === current ? true : null }));
    });
    sel.value = current;
    return sel;
  }

  global.Pipeline = {
    leadBoard: leadBoard,
    funnel: funnel,
    jobRail: jobRail,
    stageSelect: stageSelect,
    nextSalesStage: nextSalesStage,
    nextJobStage: nextJobStage,
    jobPhaseOf: jobPhaseOf
  };

})(window);
