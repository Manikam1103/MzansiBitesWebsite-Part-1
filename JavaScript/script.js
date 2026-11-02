/* ==========================================================================
   Mzansi Bites Bakery — script.js (Part 3)
   Features: mobile nav, scroll reveal, open-now badge, today's special,
   dynamic menu (fetch + search/filter/sort + modal), tabs, accordion,
   gallery lightbox, form validation, AJAX enquiry, mailto contact form,
   Google Maps embed with geolocation distance.
   Security note: user-supplied text is only ever written with textContent /
   encodeURIComponent, never innerHTML.
   ========================================================================== */
(function () {
  'use strict';

  // ---------- Config (edit here) ----------
  var CONTACT_EMAIL = 'hello@mzansibites.co.za';           // recipient for the contact form (mailto)
  var BAKERY = { lat: -29.8587, lng: 31.0218, name: 'Mzansi Bites Bakery' };
  // Opening hours by JS weekday (0 = Sunday): [openHour, closeHour] in 24h time, null = closed
  var HOURS = { 0: null, 1: [7, 18], 2: [7, 18], 3: [7, 18], 4: [7, 18], 5: [7, 18], 6: [8, 15] };
  var DELIVERY_FEE = 60;
  var SERVICES = [
    { id: 'svc-design', name: 'Custom cake design consultation', price: 0, label: 'Free', leadDays: 3, unit: 'consultation' },
    { id: 'svc-catering', name: 'Event catering platter (feeds 10)', price: 650, label: 'R650', leadDays: 7, unit: 'platter' }
  ];

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var money = function (n) { return 'R' + Number(n).toLocaleString('en-ZA', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }); };
  var el = function (tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // ---------- Menu data (AJAX with offline/file:// fallback) ----------
  var menuPromise;
  function loadMenu() {
    if (menuPromise) return menuPromise;
    menuPromise = fetch('JavaScript/menu.json', { headers: { 'Accept': 'application/json' } })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .catch(function () {
        // Opening index.html straight from disk (file://) blocks fetch(); use the bundled copy.
        if (window.MZANSI_MENU) return window.MZANSI_MENU;
        throw new Error('Menu data unavailable');
      });
    return menuPromise;
  }
  function imgSet(item) {
    return { src: 'Images/' + item.image + '-600.jpg', srcset: 'Images/' + item.image + '-400.jpg 400w, Images/' + item.image + '-600.jpg 600w' };
  }

  // ---------- Navigation ----------
  function initNav() {
    var nav = $('#site-nav'), btn = $('.nav-toggle');
    if (!nav || !btn) return;
    btn.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('open')) { nav.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); btn.focus(); }
    });
  }

  // ---------- Scroll reveal + back to top ----------
  function initReveal() {
    var items = $$('.reveal');
    if (!items.length) return;
    if (!('IntersectionObserver' in window)) { items.forEach(function (i) { i.classList.add('visible'); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('visible'); io.unobserve(en.target); } });
    }, { threshold: 0.12 });
    items.forEach(function (i) { io.observe(i); });
  }
  function initToTop() {
    var b = $('.to-top');
    if (!b) return;
    window.addEventListener('scroll', function () { b.classList.toggle('show', window.scrollY > 500); }, { passive: true });
    b.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
  }

  // ---------- Open now badge (DOM manipulation from live clock) ----------
  function openStatus(now) {
    var h = HOURS[now.getDay()], t = now.getHours() + now.getMinutes() / 60;
    if (h && t >= h[0] && t < h[1]) return { open: true, text: 'Open now · closes ' + String(h[1]).padStart(2, '0') + ':00' };
    for (var i = 0; i < 8; i++) {   // find the next opening day
      var d = (now.getDay() + i) % 7, hh = HOURS[d];
      if (!hh) continue;
      if (i === 0 && t >= hh[1]) continue;
      if (i === 0 && t < hh[0]) return { open: false, text: 'Closed · opens today at ' + String(hh[0]).padStart(2, '0') + ':00' };
      return { open: false, text: 'Closed · opens ' + (i === 1 ? 'tomorrow' : DAYS[d]) + ' at ' + String(hh[0]).padStart(2, '0') + ':00' };
    }
    return { open: false, text: 'Closed' };
  }
  function initOpenBadges() {
    var s = openStatus(new Date());
    $$('[data-open-status]').forEach(function (b) {
      b.textContent = s.text;
      b.classList.add('status-badge', s.open ? 'open' : 'closed');
      b.classList.remove(s.open ? 'closed' : 'open');
    });
  }

  // ---------- Today's special (home page) ----------
  var SPECIALS = { 0: 'Sunday: we are closed, but you can pre-order for Monday!', 1: 'Monday special: Seeded Sourdough, fresh out of the oven.', 2: 'Tuesday special: Koeksisters (4 pieces) with a free Chelsea Bun.', 3: 'Wednesday special: Butter Croissants, buy 3 get 1 free.', 4: 'Thursday special: Vetkoek (6 pieces) with homemade mince.', 5: 'Friday special: Milk Tart Slice with a coffee.', 6: 'Saturday special: Cupcake Box, ask about our free toppers.' };
  function initSpecial() {
    var box = $('#todays-special');
    if (!box) return;
    var day = new Date().getDay();
    box.textContent = '';
    box.appendChild(el('h2', null, "Today's Special"));
    box.appendChild(el('p', null, SPECIALS[day]));
    box.hidden = false;
  }

  // ---------- Menu page: render + search / filter / sort + modal ----------
  function initMenu() {
    var grid = $('#menu-grid');
    if (!grid) return;
    var state = { cat: 'all', q: '', sort: 'default' }, items = [];
    var count = $('#result-count'), search = $('#menu-search'), sortSel = $('#menu-sort'), modal = $('#item-modal');
    var catNames = { bread: 'Bread', pastry: 'Pastry', cake: 'Cake' };

    function render() {
      var q = state.q.trim().toLowerCase();
      var list = items.filter(function (i) {
        return (state.cat === 'all' || i.category === state.cat) &&
          (!q || (i.name + ' ' + i.description + ' ' + i.category).toLowerCase().indexOf(q) !== -1);
      });
      var sorters = {
        'price-asc': function (a, b) { return a.price - b.price; },
        'price-desc': function (a, b) { return b.price - a.price; },
        'name-asc': function (a, b) { return a.name.localeCompare(b.name); }
      };
      if (sorters[state.sort]) list.sort(sorters[state.sort]);
      grid.textContent = '';
      if (!list.length) {
        var empty = el('div', 'empty-state');
        empty.appendChild(el('p', null, 'No items match "' + state.q + '". Try a different word or clear the filters.'));
        grid.appendChild(empty);
      }
      list.forEach(function (item, idx) { grid.appendChild(card(item, idx)); });
      count.textContent = 'Showing ' + list.length + ' of ' + items.length + ' items';
      grid.setAttribute('aria-busy', 'false');
    }
    function card(item, idx) {
      var a = el('article', 'menu-card'), im = imgSet(item);
      a.style.animationDelay = Math.min(idx, 8) * 40 + 'ms';
      var img = el('img'); img.src = im.src; img.srcset = im.srcset; img.sizes = '(max-width: 560px) 100vw, 256px';
      img.alt = item.alt; img.loading = 'lazy'; img.width = 400; img.height = 267;
      var body = el('div', 'menu-card-body');
      body.appendChild(el('span', 'tag', catNames[item.category] || item.category));
      body.appendChild(el('h3', null, item.name));
      body.appendChild(el('p', null, item.description));
      body.appendChild(el('span', 'price', (item.from ? 'From ' : '') + money(item.price)));
      var act = el('div', 'actions');
      var more = el('button', 'btn btn-small btn-outline', 'Details'); more.type = 'button';
      more.addEventListener('click', function () { openModal(item, more); });
      var enq = el('a', 'btn btn-small', 'Enquire'); enq.href = 'enquiry.html#' + item.id;
      act.appendChild(more); act.appendChild(enq);
      body.appendChild(act);
      a.appendChild(img); a.appendChild(body);
      return a;
    }
    function openModal(item, opener) {
      if (!modal) return;
      var im = imgSet(item);
      $('#modal-img').src = im.src; $('#modal-img').alt = item.alt;
      $('#modal-title').textContent = item.name;
      $('#modal-desc').textContent = item.description;
      $('#modal-meta').textContent = (item.from ? 'From ' : '') + money(item.price) + ' · ' + (item.leadDays ? 'Order at least ' + item.leadDays + ' day' + (item.leadDays > 1 ? 's' : '') + ' ahead' : 'Baked fresh daily');
      $('#modal-enquire').href = 'enquiry.html#' + item.id;
      modal._opener = opener;
      if (typeof modal.showModal === 'function') modal.showModal(); else modal.setAttribute('open', '');
    }
    if (modal) {
      $('.modal-close', modal).addEventListener('click', function () { modal.close(); });
      modal.addEventListener('click', function (e) { if (e.target === modal) modal.close(); }); // click on backdrop
      modal.addEventListener('close', function () { if (modal._opener) modal._opener.focus(); });
    }

    $$('.chip[data-cat]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        state.cat = chip.getAttribute('data-cat');
        $$('.chip[data-cat]').forEach(function (c) { c.setAttribute('aria-pressed', String(c === chip)); });
        render();
      });
    });
    search.addEventListener('input', function () { state.q = search.value; render(); });
    sortSel.addEventListener('change', function () { state.sort = sortSel.value; render(); });

    window.addEventListener('hashchange', function () {
      var h = (location.hash || '').replace('#', ''), chip = $('.chip[data-cat="' + (catNames[h] ? h : 'all') + '"]'); if (chip && items.length) chip.click();
    });
    loadMenu().then(function (data) {
      items = data.items;
      var h = (location.hash || '').replace('#', '');
      if (catNames[h]) { var chip = $('.chip[data-cat="' + h + '"]'); if (chip) chip.click(); else render(); } else render();
    }).catch(function () {
      grid.textContent = '';
      var e = el('div', 'empty-state'); e.appendChild(el('p', null, 'Sorry, the menu could not be loaded. Please refresh the page or call us on 031 000 0000.'));
      grid.appendChild(e); count.textContent = '';
    });
  }

  // ---------- Tabs (About page) ----------
  function initTabs() {
    $$('.tabs').forEach(function (wrap) {
      var tabs = $$('[role="tab"]', wrap), panels = $$('[role="tabpanel"]', wrap);
      function select(tab, focus) {
        tabs.forEach(function (t, i) {
          var on = t === tab;
          t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; panels[i].hidden = !on;
        });
        if (focus) tab.focus();
      }
      select(tabs[0]);
      tabs.forEach(function (t, i) {
        t.addEventListener('click', function () { select(t); });
        t.addEventListener('keydown', function (e) {
          var n = null;
          if (e.key === 'ArrowRight') n = tabs[(i + 1) % tabs.length];
          if (e.key === 'ArrowLeft') n = tabs[(i - 1 + tabs.length) % tabs.length];
          if (e.key === 'Home') n = tabs[0];
          if (e.key === 'End') n = tabs[tabs.length - 1];
          if (n) { e.preventDefault(); select(n, true); }
        });
      });
    });
  }

  // ---------- Accordion (FAQ) ----------
  function initAccordion() {
    $$('.accordion').forEach(function (acc) {
      var btns = $$('.accordion-trigger', acc);
      function close(b) {
        var p = document.getElementById(b.getAttribute('aria-controls'));
        b.setAttribute('aria-expanded', 'false'); p.classList.remove('open'); p.style.maxHeight = null;
      }
      btns.forEach(function (btn) {
        var panel = document.getElementById(btn.getAttribute('aria-controls'));
        btn.addEventListener('click', function () {
          var wasOpen = btn.getAttribute('aria-expanded') === 'true';
          btns.forEach(close);                                  // one open at a time
          if (!wasOpen) { btn.setAttribute('aria-expanded', 'true'); panel.classList.add('open'); panel.style.maxHeight = panel.scrollHeight + 'px'; }
        });
      });
    });
  }

  // ---------- Gallery: category filter + lightbox ----------
  function initGallery() {
    var items = $$('.gallery-item');
    if (!items.length) return;
    $$('.chip[data-gallery-filter]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        var f = chip.getAttribute('data-gallery-filter');
        $$('.chip[data-gallery-filter]').forEach(function (c) { c.setAttribute('aria-pressed', String(c === chip)); });
        items.forEach(function (it) { it.hidden = !(f === 'all' || it.getAttribute('data-category') === f); });
      });
    });
    var lb = $('#lightbox'); if (!lb) return;
    var img = $('img', lb), cap = $('figcaption', lb), idx = 0, opener = null;
    function visible() { return items.filter(function (i) { return !i.hidden; }); }
    function show(i) {
      var v = visible(); if (!v.length) return;
      idx = (i + v.length) % v.length;
      var it = v[idx];
      img.src = it.getAttribute('data-full'); img.alt = $('img', it).alt; cap.textContent = it.getAttribute('data-caption') || $('img', it).alt;
    }
    function open(it) {
      opener = it; show(visible().indexOf(it));
      lb.classList.add('open'); lb.setAttribute('aria-hidden', 'false'); document.body.classList.add('no-scroll');
      $('.lb-close', lb).focus();
    }
    function close() { lb.classList.remove('open'); lb.setAttribute('aria-hidden', 'true'); document.body.classList.remove('no-scroll'); if (opener) opener.focus(); }
    items.forEach(function (it) { it.addEventListener('click', function () { open(it); }); });
    $('.lb-close', lb).addEventListener('click', close);
    $('.lb-prev', lb).addEventListener('click', function () { show(idx - 1); });
    $('.lb-next', lb).addEventListener('click', function () { show(idx + 1); });
    lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
    document.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') show(idx - 1);
      if (e.key === 'ArrowRight') show(idx + 1);
      if (e.key === 'Tab') {   // keep keyboard focus inside the lightbox
        var f = $$('button', lb), first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }

  // ---------- Form validation helpers ----------
  var rules = {
    name: function (v) { return /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ '’-]{1,59}$/.test(v) ? '' : 'Enter your full name (2-60 letters, no digits).'; },
    email: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) && v.length <= 120 ? '' : 'Enter a valid email address, e.g. name@example.com.'; },
    phone: function (v) {
      var d = v.replace(/[\s\-()]/g, '');
      return /^(?:\+27|0)[1-9][0-9]{8}$/.test(d) ? '' : 'Enter a valid South African number, e.g. 031 000 0000 or +27 82 123 4567.';
    },
    phoneOptional: function (v) { return v.trim() === '' ? '' : rules.phone(v); }
  };
  function setError(field, msg) {
    var group = field.closest('.form-group'), err = group && $('.error', group);
    if (!group) return;
    group.classList.toggle('invalid', !!msg); group.classList.toggle('valid', !msg && field.value !== '');
    field.setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (err) err.textContent = msg;
  }
  // validators: { fieldId: function(value, form) -> '' | 'message' }
  function wireValidation(form, validators) {
    form.noValidate = true;     // we show our own, friendlier messages (HTML5 attributes stay as a no-JS fallback)
    function check(field) {
      var fn = validators[field.id]; if (!fn) return true;
      var msg = fn(field.value.trim(), form); setError(field, msg); return !msg;
    }
    Object.keys(validators).forEach(function (id) {
      var f = document.getElementById(id); if (!f) return;
      f.addEventListener('blur', function () { check(f); });
      f.addEventListener('input', function () { if (f.closest('.form-group').classList.contains('invalid')) check(f); });
      f.addEventListener('change', function () { check(f); });
    });
    return function validateAll() {
      var firstBad = null;
      Object.keys(validators).forEach(function (id) {
        var f = document.getElementById(id); if (f && !check(f) && !firstBad) firstBad = f;
      });
      if (firstBad) firstBad.focus();
      return !firstBad;
    };
  }
  function counter(field, max) {
    var c = field.closest('.form-group').querySelector('.char-count'); if (!c) return;
    function up() { c.textContent = field.value.length + ' / ' + max; }
    field.addEventListener('input', up); up();
  }
  function isoDate(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function parseDate(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(d, n) { var r = new Date(d); r.setDate(r.getDate() + n); return r; }
  function longDate(d) { return DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + d.toLocaleString('en-ZA', { month: 'long' }) + ' ' + d.getFullYear(); }
  function nextOpenDay(d) { while (!HOURS[d.getDay()]) d = addDays(d, 1); return d; }

  // ---------- Enquiry page (validation + quote + AJAX) ----------
  function initEnquiry() {
    var form = $('#enquiry-form'); if (!form) return;
    var sel = $('#topic'), qty = $('#quantity'), date = $('#needed-date'), msg = $('#enq-message'), status = $('#enquiry-status'), submit = $('#enquiry-submit');
    var catalogue = {};
    SERVICES.forEach(function (s) { catalogue[s.id] = { id: s.id, name: s.name, price: s.price, from: false, leadDays: s.leadDays }; });
    date.min = isoDate(new Date());
    counter(msg, 500);

    loadMenu().then(function (data) {
      var groups = { bread: 'Breads', pastry: 'Pastries', cake: 'Celebration cakes' };
      Object.keys(groups).forEach(function (k) {
        var og = document.createElement('optgroup'); og.label = groups[k];
        data.items.filter(function (i) { return i.category === k; }).forEach(function (i) {
          catalogue[i.id] = i;
          var o = el('option', null, i.name + ' (' + (i.from ? 'from ' : '') + money(i.price) + ')'); o.value = i.id; og.appendChild(o);
        });
        sel.appendChild(og);
      });
      var og2 = document.createElement('optgroup'); og2.label = 'Services';
      SERVICES.forEach(function (s) { var o = el('option', null, s.name + ' (' + s.label + ')'); o.value = s.id; og2.appendChild(o); });
      sel.appendChild(og2);
      var pre = (location.hash || '').replace('#', '');
      if (catalogue[pre]) sel.value = pre;       // arrived from a menu "Enquire" button
    }).catch(function () { sel.appendChild(el('option', null, 'Menu unavailable: describe your request below')); });

    var validate = wireValidation(form, {
      'full-name': function (v) { return rules.name(v); },
      'email': function (v) { return rules.email(v); },
      'phone': function (v) { return rules.phone(v); },
      'topic': function (v) { return v ? '' : 'Choose a product or service.'; },
      'quantity': function (v) { var n = Number(v); return Number.isInteger(n) && n >= 1 && n <= 200 ? '' : 'Enter a whole number between 1 and 200.'; },
      'needed-date': function (v) {
        if (!v) return 'Choose the date you need it.';
        var d = parseDate(v), today = parseDate(isoDate(new Date()));
        if (isNaN(d)) return 'Enter a valid date.';
        if (d < today) return 'The date cannot be in the past.';
        if (d > addDays(today, 365)) return 'Please choose a date within the next year.';
        return '';
      },
      'enq-message': function (v) { return v.length === 0 || v.length >= 10 ? (v.length <= 500 ? '' : 'Keep your message under 500 characters.') : 'Please add at least 10 characters, or leave it empty.'; }
    });

    function buildQuote(data) {
      var item = catalogue[data.topic], q = Number(data.quantity), want = parseDate(data.date), today = parseDate(isoDate(new Date()));
      var earliest = nextOpenDay(addDays(today, item ? item.leadDays : 0));
      var sub = item ? item.price * q : 0, delivery = data.delivery ? DELIVERY_FEE : 0;
      var available = want >= earliest && !!HOURS[want.getDay()];
      var reason = '';
      if (!HOURS[want.getDay()]) reason = 'We are closed on Sundays.';
      else if (want < earliest) reason = (item.name + ' needs ' + item.leadDays + ' day' + (item.leadDays === 1 ? '' : 's') + ' notice.');
      return { item: item, qty: q, sub: sub, delivery: delivery, total: sub + delivery, from: item && item.from, available: available, earliest: earliest, want: want, reason: reason };
    }
    function showResult(data, quote, ref, sent) {
      status.hidden = false; status.className = 'form-status ' + (quote.available ? 'success' : ''); status.textContent = '';
      status.appendChild(el('h2', null, quote.available ? 'Good news, we can do that!' : 'That date is not available'));
      status.appendChild(el('p', null, 'Thank you, ' + data.name.split(' ')[0] + '. Your reference is ' + ref + '.'));
      var t = el('table', 'quote-table'), tb = document.createElement('tbody');
      function row(a, b) { var tr = document.createElement('tr'); tr.appendChild(el('td', null, a)); tr.appendChild(el('td', null, b)); tb.appendChild(tr); }
      row(quote.item.name + ' × ' + quote.qty, (quote.from ? 'from ' : '') + money(quote.sub));
      if (quote.delivery) row('Delivery within Durban', money(quote.delivery));
      var tr = document.createElement('tr'); var th = el('th', null, 'Estimated total'), td = el('th', null, (quote.from ? 'from ' : '') + money(quote.total)); tr.appendChild(th); tr.appendChild(td); tb.appendChild(tr);
      t.appendChild(tb); status.appendChild(t);
      if (quote.available) {
        status.appendChild(el('p', null, 'Availability: ' + longDate(quote.want) + ' is available. We bake it fresh for you.'));
      } else {
        status.appendChild(el('p', null, 'Availability: ' + quote.reason + ' The earliest we can have this ready is ' + longDate(quote.earliest) + '. Change the date and send again.'));
      }
      if (quote.from) status.appendChild(el('p', 'hint', 'Cake prices start from the amount shown; a designer will confirm the final price once we know your design.'));
      status.appendChild(el('p', null, sent ? 'Your enquiry has been sent to our team. We will confirm by email within one business day.' : 'We could not reach our server just now, so this enquiry was not recorded. Please email ' + CONTACT_EMAIL + ' quoting ' + ref + '.'));
      status.setAttribute('tabindex', '-1'); status.focus(); status.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if ($('#website', form).value) return;                   // honeypot: bots fill this, humans never see it
      if (!validate()) { status.hidden = false; status.className = 'form-status error-box'; status.textContent = 'Please fix the highlighted fields and try again.'; return; }
      var data = {
        name: $('#full-name').value.trim(), email: $('#email').value.trim(), phone: $('#phone').value.replace(/[\s\-()]/g, ''),
        topic: sel.value, quantity: qty.value, date: date.value, delivery: $('#delivery').checked, message: msg.value.trim()
      };
      var quote = buildQuote(data);
      var ref = 'MB-' + isoDate(new Date()).replace(/-/g, '') + '-' + String(Math.floor(1000 + Math.random() * 9000));
      submit.disabled = true; submit.textContent = ''; submit.appendChild(el('span', 'spinner')); submit.appendChild(document.createTextNode('Sending…'));
      var ctrl = ('AbortController' in window) ? new AbortController() : null, timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 8000);
      // AJAX submission: POST JSON to the form's action URL without reloading the page.
      fetch(form.action, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ reference: ref, enquiry: data, estimatedTotal: quote.total, available: quote.available }),
        signal: ctrl ? ctrl.signal : undefined
      }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function () { showResult(data, quote, ref, true); })
        .catch(function () { showResult(data, quote, ref, false); })
        .then(function () { clearTimeout(timer); submit.disabled = false; submit.textContent = 'Send enquiry'; if (quote.available) { form.reset(); $$('.form-group', form).forEach(function (g) { g.classList.remove('valid', 'invalid'); }); counter(msg, 500); } });
    });
  }

  // ---------- Contact page (validation + mailto) ----------
  function initContact() {
    var form = $('#contact-form'); if (!form) return;
    var msg = $('#c-message'), status = $('#contact-status');
    counter(msg, 1000);
    var validate = wireValidation(form, {
      'c-name': function (v) { return rules.name(v); },
      'c-email': function (v) { return rules.email(v); },
      'c-phone': function (v) { return rules.phoneOptional(v); },
      'c-type': function (v) { return v ? '' : 'Choose a message type.'; },
      'c-subject': function (v) { return v.length >= 3 && v.length <= 80 ? '' : 'Subject must be 3-80 characters.'; },
      'c-message': function (v) { return v.length >= 20 ? (v.length <= 1000 ? '' : 'Keep your message under 1000 characters.') : 'Please write at least 20 characters (you have ' + v.length + ').'; }
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if ($('#c-website', form).value) return;                // honeypot
      if (!validate()) { status.hidden = false; status.className = 'form-status error-box'; status.textContent = 'Please fix the highlighted fields and try again.'; return; }
      var type = $('#c-type').value, name = $('#c-name').value.trim(), email = $('#c-email').value.trim(), phone = $('#c-phone').value.trim();
      var subject = ('[' + type + '] ' + $('#c-subject').value.trim()).replace(/[\r\n]+/g, ' ');   // strip newlines: prevents header injection
      var body = 'Message type: ' + type + '\nFrom: ' + name + '\nEmail: ' + email + (phone ? '\nPhone: ' + phone : '') + '\n\n' + msg.value.trim() + '\n\nSent from the Mzansi Bites website contact form.';
      var href = 'mailto:' + CONTACT_EMAIL + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
      status.hidden = false; status.className = 'form-status success'; status.textContent = '';
      status.appendChild(el('h2', null, 'Your email is ready'));
      status.appendChild(el('p', null, 'Your email app should open with this message addressed to ' + CONTACT_EMAIL + '. Press Send there to deliver it.'));
      status.appendChild(el('div', 'email-preview', 'To: ' + CONTACT_EMAIL + '\nSubject: ' + subject + '\n\n' + body));
      var open = el('a', 'btn btn-small', 'Open email app again'); open.href = href; status.appendChild(open);
      if (navigator.clipboard) {
        var cp = el('button', 'btn btn-small btn-outline', 'Copy message'); cp.type = 'button'; cp.style.marginLeft = '.5rem';
        cp.addEventListener('click', function () { navigator.clipboard.writeText(body).then(function () { cp.textContent = 'Copied!'; }); });
        status.appendChild(cp);
      }
      status.setAttribute('tabindex', '-1'); status.focus();
      window.location.href = href;
    });
  }

  // ---------- Leaflet map + geolocation ----------
  function haversineKm(a, b) {
    var R = 6371, r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function initMap() {
    // The map itself is a Google Maps embed (iframe) in contact.html; this adds a location-based feature on top of it.
    var btn = $('#locate-btn'), out = $('#distance-out');
    if (!btn) return;
    if (!('geolocation' in navigator)) { btn.hidden = true; return; }
    btn.addEventListener('click', function () {
      out.textContent = 'Finding your location…';
      navigator.geolocation.getCurrentPosition(function (pos) {
        var u = { lat: pos.coords.latitude, lng: pos.coords.longitude }, km = haversineKm(u, BAKERY);
        out.textContent = 'You are about ' + km.toFixed(1) + ' km from the bakery (straight-line distance). Your location stays in your browser and is not stored.';
      }, function () { out.textContent = 'We could not get your location. You can still use the map above or the directions link.'; }, { timeout: 10000 });
    });
  }

  // ---------- Boot ----------
  document.addEventListener('DOMContentLoaded', function () {
    initNav(); initReveal(); initToTop(); initOpenBadges(); initSpecial();
    initMenu(); initTabs(); initAccordion(); initGallery(); initEnquiry(); initContact(); initMap();
  });
})();
