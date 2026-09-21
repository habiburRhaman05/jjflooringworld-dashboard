/* ==========================================================================
   ui.js  -  shared UI primitives
   Toasts, modals and confirms are built components, never alert()/confirm().
   Also holds the formatting and escaping helpers every view uses.
   ========================================================================== */

(function (global) {
  'use strict';

  /* --- DOM ---------------------------------------------------------------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class') node.className = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'text') node.textContent = v;
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else if (k === 'dataset') Object.keys(v).forEach(function (d) { node.dataset[d] = v[d]; });
        else node.setAttribute(k, v === true ? '' : v);
      });
    }
    (children || []).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); return node; }

  /* --- Formatting --------------------------------------------------------- */
  var moneyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  var moneyFmt2 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function money(n) { return moneyFmt.format(Number(n) || 0); }
  function money2(n) { return moneyFmt2.format(Number(n) || 0); }
  function pct(n) { return (Math.round((Number(n) || 0) * 10) / 10) + '%'; }
  function qty(n) { return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number(n) || 0); }

  function dt(iso, withTime) {
    if (!iso) return '-';
    var d = new Date(iso);
    if (isNaN(d)) return '-';
    var opts = { month: 'short', day: 'numeric' };
    if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
    if (withTime) { opts.hour = 'numeric'; opts.minute = '2-digit'; }
    return d.toLocaleDateString('en-US', opts);
  }

  function relative(iso) {
    if (!iso) return '';
    var diff = Date.now() - new Date(iso).getTime();
    var mins = Math.round(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    var hrs = Math.round(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    var days = Math.round(hrs / 24);
    if (days < 30) return days + 'd ago';
    return dt(iso);
  }

  function dayLabel(iso) {
    if (!iso) return 'Unscheduled';
    var d = new Date(iso); d.setHours(0, 0, 0, 0);
    var t = new Date(); t.setHours(0, 0, 0, 0);
    var diff = Math.round((d - t) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    return dt(iso);
  }

  function toInputDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d)) return '';
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }

  function fromInputDate(v) {
    if (!v) return null;
    var d = new Date(v + 'T08:00:00');
    return isNaN(d) ? null : d.toISOString();
  }

  /* --- Stage pill colouring ----------------------------------------------- */
  var STAGE_TONE = {
    'New Lead': 'pill-slate', 'Contacted': 'pill-slate', 'Qualified': 'pill-oak',
    'Appointment Set': 'pill-oak', 'Estimate Sent': 'pill-brass', 'Follow-Up': 'pill-brass',
    'Won': 'pill-moss', 'Lost': 'pill-clay',
    'Deposit Paid': 'pill-slate', 'Materials Ordered': 'pill-slate',
    'Ready to Schedule': 'pill-oak', 'Scheduled': 'pill-oak',
    'En Route': 'pill-brass', 'In Progress': 'pill-brass', 'Completed': 'pill-moss',
    'Draft': 'pill-outline', 'Sent': 'pill-oak', 'Viewed': 'pill-brass',
    'Signed': 'pill-moss', 'Expired': 'pill-clay',
    'Paid': 'pill-moss', 'Partial': 'pill-brass', 'Unpaid': 'pill-clay'
  };

  function stagePill(stage) {
    return el('span', { class: 'pill pill-dot ' + (STAGE_TONE[stage] || ''), text: stage });
  }

  /* --- Toasts ------------------------------------------------------------- */
  function dock() {
    var d = $('.toast-dock');
    if (!d) { d = el('div', { class: 'toast-dock', role: 'status', 'aria-live': 'polite' }); document.body.appendChild(d); }
    return d;
  }

  function toast(message, tone, ms) {
    var t = el('div', { class: 'toast ' + (tone || '') }, [
      el('span', { class: 'mark' }),
      el('span', { class: 'txt', text: message })
    ]);
    dock().appendChild(t);
    var life = ms || 3200;
    setTimeout(function () {
      t.classList.add('is-out');
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 220);
    }, life);
    return t;
  }

  /* --- Modal -------------------------------------------------------------- */
  var openScrims = [];

  function modal(opts) {
    // opts: { title, subtitle, body (Node), actions: [{label, tone, onClick, keep}], wide, onClose }
    var scrim = el('div', { class: 'scrim' });
    var box = el('div', { class: 'modal' + (opts.wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true' });

    function close() {
      if (!scrim.parentNode) return;
      document.body.removeChild(scrim);
      document.removeEventListener('keydown', onKey);
      openScrims = openScrims.filter(function (s) { return s !== scrim; });
      if (!openScrims.length) document.body.style.overflow = '';
      if (opts.onClose) opts.onClose();
    }
    function onKey(e) { if (e.key === 'Escape') close(); }

    var head = el('div', { class: 'modal-head' }, [
      el('div', {}, [
        el('h3', { text: opts.title || '' }),
        opts.subtitle ? el('div', { class: 't-meta', text: opts.subtitle }) : null
      ]),
      el('button', { class: 'x-btn', 'aria-label': 'Close', onclick: close, html: '&times;' })
    ]);

    var body = el('div', { class: 'modal-body' });
    if (typeof opts.body === 'string') body.innerHTML = opts.body;
    else if (opts.body) body.appendChild(opts.body);

    box.appendChild(head);
    box.appendChild(body);

    if (opts.actions && opts.actions.length) {
      var foot = el('div', { class: 'modal-foot' });
      opts.actions.forEach(function (a) {
        foot.appendChild(el('button', {
          class: 'btn ' + (a.tone || ''),
          text: a.label,
          onclick: function () {
            var r = a.onClick ? a.onClick(close, body) : undefined;
            if (!a.keep && r !== false) close();
          }
        }));
      });
      box.appendChild(foot);
    }

    scrim.appendChild(box);
    scrim.addEventListener('mousedown', function (e) { if (e.target === scrim && !opts.sticky) close(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(scrim);
    document.body.style.overflow = 'hidden';
    openScrims.push(scrim);

    var focusable = box.querySelector('input, select, textarea, button.btn');
    if (focusable) setTimeout(function () { focusable.focus(); }, 30);

    return { close: close, body: body, box: box };
  }

  function confirm(opts) {
    return modal({
      title: opts.title,
      body: el('p', { text: opts.message, class: 't-sub' }),
      actions: [
        { label: opts.cancelLabel || 'Cancel', tone: 'btn-ghost' },
        {
          label: opts.confirmLabel || 'Confirm',
          tone: opts.danger ? 'btn-danger' : 'btn-primary',
          onClick: function () { if (opts.onConfirm) opts.onConfirm(); }
        }
      ]
    });
  }

  /* --- Empty state -------------------------------------------------------- */
  function empty(title, message) {
    return el('div', { class: 'empty' }, [
      el('div', { class: 'empty-mark', text: title }),
      el('p', { text: message || '' })
    ]);
  }

  /* --- Demo banner -------------------------------------------------------- */
  function demoBanner(mount) {
    if (!mount) return;
    if (global.DB.Storage.get(global.DB.BANNER_KEY) === '1') return;
    var b = el('div', { class: 'demo-banner' }, [
      el('div', {}, [
        el('div', { html: '<strong>This is a working prototype.</strong> Data is stored only in your browser (localStorage), not on a server.' }),
        el('div', { class: 't-meta', style: 'margin-top:4px', text: 'Use Switch Role in the header to see the same data through Admin, Sales Rep, CSR and Installer eyes.' })
      ]),
      el('button', {
        class: 'btn btn-sm btn-ghost close', text: 'Dismiss',
        onclick: function () {
          global.DB.Storage.set(global.DB.BANNER_KEY, '1');
          if (b.parentNode) b.parentNode.removeChild(b);
        }
      })
    ]);
    mount.insertBefore(b, mount.firstChild);
  }

  /* --- Tabs --------------------------------------------------------------- */
  function wireTabs(navSelector, onChange) {
    var buttons = $$(navSelector + ' button');
    var crumb = $('.appbar .crumb');
    /* Phone nav: the select that replaces the tab pill below 560px (see
       layout.css). It lives beside the tab pill in the subnav, and its
       options are built from the same buttons so there is one source of
       truth for the destinations. The Installer has no select and no tab
       pill, so this is a no-op there. */
    var nav = $(navSelector);
    var navSelect = nav && nav.parentNode ? nav.parentNode.querySelector('select.tab-select') : null;
    if (navSelect) {
      buttons.forEach(function (b) {
        var opt = document.createElement('option');
        opt.value = b.dataset.view;
        opt.textContent = (b.dataset.title || b.textContent).trim();
        navSelect.appendChild(opt);
      });
      navSelect.addEventListener('change', function () { select(navSelect.value); });
    }
    function select(name) {
      var active = null;
      buttons.forEach(function (b) {
        var on = b.dataset.view === name;
        b.setAttribute('aria-selected', String(on));
        if (on) active = b;
      });
      // Keep the top-bar breadcrumb in step with the active destination.
      if (crumb && active) crumb.textContent = (active.dataset.title || active.textContent).trim();
      // And the phone select, so a rotate across the breakpoint lands on the
      // same destination the pill or menu had chosen.
      if (navSelect && navSelect.value !== name) navSelect.value = name;
      $$('.view').forEach(function (v) { v.classList.toggle('is-active', v.dataset.view === name); });
      if (onChange) onChange(name);
      try { history.replaceState(null, '', '#' + name); } catch (e) {}
      window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
    }
    buttons.forEach(function (b) { b.addEventListener('click', function () { select(b.dataset.view); }); });
    var start = (location.hash || '').replace('#', '');
    var valid = buttons.some(function (b) { return b.dataset.view === start; });
    select(valid ? start : (buttons[0] && buttons[0].dataset.view));
    return { select: select };
  }

  global.UI = {
    $: $, $$: $$, el: el, esc: esc, clear: clear,
    money: money, money2: money2, pct: pct, qty: qty,
    dt: dt, relative: relative, dayLabel: dayLabel,
    toInputDate: toInputDate, fromInputDate: fromInputDate,
    stagePill: stagePill, STAGE_TONE: STAGE_TONE,
    toast: toast, modal: modal, confirm: confirm,
    empty: empty, demoBanner: demoBanner, wireTabs: wireTabs
  };

})(window);
