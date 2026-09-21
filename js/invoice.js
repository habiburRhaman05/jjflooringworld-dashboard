/* ==========================================================================
   invoice.js  -  invoice rendering and payment state
   The cost / margin columns are built only when Auth.can.viewCost() is true.
   For every other role those cells are never constructed, so they cannot be
   found in the rendered DOM.
   ========================================================================== */

(function (global) {
  'use strict';

  var UI = global.UI;

  function lineTable(lineItems, opts) {
    opts = opts || {};
    var showCost = !!opts.showCost;
    var t = global.DB.totalsFor(global.DB.load(), lineItems);

    var head = UI.el('tr', {}, [
      UI.el('th', { text: 'Item' }),
      UI.el('th', { text: 'Unit' }),
      UI.el('th', { class: 'num', text: 'Qty' }),
      UI.el('th', { class: 'num', text: 'Price' }),
      UI.el('th', { class: 'num', text: 'Line total' })
    ]);
    if (showCost) {
      head.appendChild(UI.el('th', { class: 'num', text: 'Cost' }));
      head.appendChild(UI.el('th', { class: 'num', text: 'Margin' }));
    }

    var tbody = UI.el('tbody', {});
    t.rows.forEach(function (r) {
      var tr = UI.el('tr', {}, [
        UI.el('td', {}, [
          UI.el('div', { text: r.name }),
          UI.el('div', { class: 't-meta', text: r.category })
        ]),
        UI.el('td', { class: 'muted', text: r.unit }),
        UI.el('td', { class: 'num', text: UI.qty(r.qty) }),
        UI.el('td', { class: 'num', text: UI.money2(r.pricePerUnit) }),
        UI.el('td', { class: 'num', text: UI.money2(r.linePrice) })
      ]);
      if (showCost) {
        tr.appendChild(UI.el('td', { class: 'num muted', text: UI.money2(r.lineCost) }));
        tr.appendChild(UI.el('td', { class: 'num', text: UI.money2(r.linePrice - r.lineCost) }));
      }
      tbody.appendChild(tr);
    });

    var footCells = [
      UI.el('td', { colspan: '4', style: 'text-align:right;font-weight:600', text: 'Total' }),
      UI.el('td', { class: 'num', style: 'font-weight:700', text: UI.money2(t.totalPrice) })
    ];
    if (showCost) {
      footCells.push(UI.el('td', { class: 'num muted', text: UI.money2(t.totalCost) }));
      footCells.push(UI.el('td', { class: 'num', style: 'font-weight:700;color:var(--moss)', text: UI.money2(t.totalMargin) }));
    }
    tbody.appendChild(UI.el('tr', { style: 'background:var(--panel-sunk)' }, footCells));

    return UI.el('div', { class: 'table-wrap' }, [
      UI.el('table', { class: 'grid' }, [UI.el('thead', {}, [head]), tbody])
    ]);
  }

  /* Compact money summary. Cost and margin rows exist only for Admin. */
  function summary(inv, opts) {
    opts = opts || {};
    var showCost = !!opts.showCost;
    var dl = UI.el('dl', { class: 'kv' });

    function row(k, v, style) {
      dl.appendChild(UI.el('dt', { text: k }));
      dl.appendChild(UI.el('dd', { text: v, style: style || null }));
    }

    row('Contract total', UI.money2(inv.totalPrice));
    row('Deposit (' + inv.depositPercent + '%)', UI.money2(inv.depositAmount) + (inv.depositPaid ? ' paid' : ' due'));
    row('Balance', UI.money2(inv.balanceAmount));
    if (showCost) {
      row('Cost of goods', UI.money2(inv.totalCost));
      row('Margin', UI.money2(inv.totalMargin) + '  (' + UI.pct(inv.totalPrice ? (inv.totalMargin / inv.totalPrice) * 100 : 0) + ')',
        'color:var(--moss);font-weight:600');
    }
    return dl;
  }

  function statusPill(inv) { return UI.stagePill(inv.paymentStatus); }

  /* Admin-only payment control. */
  function paymentControls(inv, onChange) {
    var wrap = UI.el('div', { class: 'row-wrap' });
    ['Unpaid', 'Partial', 'Paid'].forEach(function (s) {
      wrap.appendChild(UI.el('button', {
        class: 'btn btn-sm' + (inv.paymentStatus === s ? ' btn-primary' : ''),
        text: 'Mark ' + s,
        onclick: function () {
          global.DB.setPaymentStatus(inv.id, s);
          UI.toast('Invoice marked ' + s + '.', s === 'Paid' ? 'ok' : '');
          if (onChange) onChange();
        }
      }));
    });
    return wrap;
  }

  function open(inv, opts) {
    opts = opts || {};
    var showCost = global.Auth.can.viewCost();
    var lead = global.DB.lead(inv.leadId);
    var body = UI.el('div', {});

    body.appendChild(UI.el('div', { class: 'spread', style: 'margin-bottom:12px' }, [
      UI.el('div', {}, [
        UI.el('div', { style: 'font-weight:600', text: lead ? lead.name : inv.leadId }),
        UI.el('div', { class: 't-meta', text: (lead ? lead.address : '') + ', ' + inv.tier + ' tier' })
      ]),
      statusPill(inv)
    ]));

    body.appendChild(lineTable(inv.lineItems, { showCost: showCost }));
    body.appendChild(UI.el('hr', { class: 'divider' }));
    body.appendChild(summary(inv, { showCost: showCost }));

    if (showCost) {
      body.appendChild(UI.el('hr', { class: 'divider' }));
      body.appendChild(UI.el('div', { class: 'label', text: 'Payment' }));
      body.appendChild(paymentControls(inv, function () {
        m.close();
        if (opts.onChange) opts.onChange();
      }));
    }

    var m = UI.modal({
      title: 'Invoice ' + inv.id,
      subtitle: 'Created ' + UI.dt(inv.createdAt),
      body: body,
      wide: true,
      actions: [{ label: 'Close', tone: 'btn-ghost' }]
    });
    return m;
  }

  global.Invoices = {
    lineTable: lineTable,
    summary: summary,
    statusPill: statusPill,
    paymentControls: paymentControls,
    open: open
  };

})(window);
