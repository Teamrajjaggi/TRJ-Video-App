/* Site behavior: mobile nav, lead form submission, mortgage calculator,
   and campaign attribution that rides along with every lead into CINC. */
(function () {
  'use strict';

  // ---- mobile nav --------------------------------------------------------
  var toggle = document.querySelector('[data-nav-toggle]');
  var mobileNav = document.getElementById('mobile-nav');
  if (toggle && mobileNav) {
    toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      mobileNav.hidden = open;
    });
  }

  var header = document.querySelector('[data-header]');
  if (header) {
    var onScroll = function () {
      header.classList.toggle('is-stuck', window.scrollY > 8);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // ---- attribution -------------------------------------------------------
  // First-touch campaign data is stored once and attached to every later
  // submission, so a lead that converts on visit three still credits the ad.
  var UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid'];

  function readStoredAttribution() {
    try {
      return JSON.parse(sessionStorage.getItem('trj_attribution') || '{}');
    } catch (err) {
      return {};
    }
  }

  function captureAttribution() {
    var params = new URLSearchParams(window.location.search);
    var stored = readStoredAttribution();
    var found = false;
    UTM_KEYS.forEach(function (key) {
      var value = params.get(key);
      if (value && !stored[key]) {
        stored[key] = value;
        found = true;
      }
    });
    if (!stored.landingPage) {
      stored.landingPage = window.location.pathname;
      found = true;
    }
    if (!stored.referrer && document.referrer && document.referrer.indexOf(window.location.host) === -1) {
      stored.referrer = document.referrer;
      found = true;
    }
    if (found) {
      try { sessionStorage.setItem('trj_attribution', JSON.stringify(stored)); } catch (err) { /* private mode */ }
    }
    return stored;
  }

  var attribution = captureAttribution();

  // ---- lead forms --------------------------------------------------------
  document.querySelectorAll('[data-lead-form]').forEach(function (form) {
    var status = form.querySelector('[data-status]');
    var submit = form.querySelector('[data-submit]');

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (submit && submit.disabled) return;

      var data = {};
      new FormData(form).forEach(function (value, key) {
        data[key] = typeof value === 'string' ? value : '';
      });

      // Client-side check only — the server validates again.
      if (!(data.name || '').trim()) return fail('Please enter your name.');
      if (!(data.email || '').trim() && !(data.phone || '').trim()) {
        return fail('Please add an email address or a phone number so we can reach you.');
      }

      // The select labelled "I am" is a UI convenience; map it to the intent
      // CINC routing rules read.
      if (data.intentChoice && !data.intent) {
        data.intent = /sell/i.test(data.intentChoice) ? 'seller'
          : /buy/i.test(data.intentChoice) ? 'buyer'
          : /invest/i.test(data.intentChoice) ? 'investor'
          : /join/i.test(data.intentChoice) ? 'recruit'
          : '';
      }

      UTM_KEYS.forEach(function (key) { if (attribution[key]) data[key] = attribution[key]; });
      data.pageUrl = window.location.href;
      data.referrer = attribution.referrer || document.referrer || '';

      if (status) { status.textContent = ''; status.className = 'form-status'; }
      if (submit) { submit.disabled = true; submit.dataset.label = submit.textContent; submit.textContent = 'Sending...'; }

      fetch('/api/lead', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(data),
      })
        .then(function (res) { return res.json().then(function (json) { return { ok: res.ok, json: json }; }); })
        .then(function (result) {
          if (!result.ok || !result.json.ok) {
            var message = (result.json.errors && result.json.errors[0]) || 'Something went wrong. Please call us instead.';
            return fail(message);
          }
          if (window.gtag) window.gtag('event', 'generate_lead', { form: data.formName || 'lead' });
          if (window.fbq) window.fbq('track', 'Lead');
          var intent = encodeURIComponent(data.intent || '');
          window.location.href = '/thank-you?intent=' + intent;
        })
        .catch(function () {
          fail('We could not send that. Please call us and we will take it by phone.');
        });

      function fail(message) {
        if (submit) { submit.disabled = false; if (submit.dataset.label) submit.textContent = submit.dataset.label; }
        if (status) { status.textContent = message; status.className = 'form-status is-error'; }
        return false;
      }
    });
  });

  // ---- search bar --------------------------------------------------------
  // Drop empty inputs so the IDX handoff URL stays clean.
  document.querySelectorAll('[data-idx-search]').forEach(function (form) {
    form.addEventListener('submit', function () {
      Array.prototype.forEach.call(form.elements, function (el) {
        if (el.name && !el.value) el.disabled = true;
      });
    });
  });

  // ---- mortgage calculator ----------------------------------------------
  var calc = document.querySelector('[data-calc]');
  var out = document.querySelector('[data-calc-out]');
  if (calc && out) {
    var fmt = function (n) {
      return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
    };

    var run = function () {
      var price = Number(calc.price.value) || 0;
      var downPct = Number(calc.down.value) || 0;
      var rate = Number(calc.rate.value) || 0;
      var years = Number(calc.years.value) || 30;
      var taxes = Number(calc.taxes.value) || 0;
      var insurance = Number(calc.insurance.value) || 0;

      var principal = Math.max(price - price * (downPct / 100), 0);
      var monthlyRate = rate / 100 / 12;
      var payments = years * 12;
      var pi = monthlyRate > 0
        ? principal * (monthlyRate * Math.pow(1 + monthlyRate, payments)) / (Math.pow(1 + monthlyRate, payments) - 1)
        : principal / payments;
      if (!isFinite(pi)) pi = 0;

      var monthlyTax = taxes / 12;
      var monthlyIns = insurance / 12;
      var total = pi + monthlyTax + monthlyIns;

      out.innerHTML =
        row('Principal & interest', pi) +
        row('Property taxes', monthlyTax) +
        row('Insurance', monthlyIns) +
        '<div class="calc-row calc-total"><span>Estimated monthly payment</span><strong>' + fmt(total) + '</strong></div>' +
        '<div class="calc-row"><span>Down payment</span><strong>' + fmt(price * (downPct / 100)) + '</strong></div>' +
        '<div class="calc-row"><span>Loan amount</span><strong>' + fmt(principal) + '</strong></div>';

      function row(label, value) {
        return '<div class="calc-row"><span>' + label + '</span><strong>' + fmt(value) + '</strong></div>';
      }
    };

    calc.addEventListener('input', run);
    run();
  }

  // ---- call tracking -----------------------------------------------------
  document.querySelectorAll('[data-call]').forEach(function (link) {
    link.addEventListener('click', function () {
      if (window.gtag) window.gtag('event', 'click_to_call');
      if (window.fbq) window.fbq('track', 'Contact');
    });
  });
})();

/* Design layer: staggered reveals and counting stats. Both degrade to plain
   static content when IntersectionObserver is unavailable or the visitor has
   asked for reduced motion. */
(function () {
  'use strict';

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var items = document.querySelectorAll('[data-reveal]');

  if (reduced || !('IntersectionObserver' in window)) {
    Array.prototype.forEach.call(items, function (el) { el.classList.add('is-in'); });
    return;
  }

  var revealer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      revealer.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

  Array.prototype.forEach.call(items, function (el) { revealer.observe(el); });



  // Stat counters animate from zero, preserving any prefix/suffix ("1,000+", "#1").
  var stats = document.querySelectorAll('[data-count]');
  var counter = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      var el = entry.target;
      counter.unobserve(el);

      var text = el.textContent;
      var match = text.match(/[\d,]+/);
      if (!match) return;
      var target = Number(match[0].replace(/,/g, ''));
      if (!target) return;

      var prefix = text.slice(0, match.index);
      var suffix = text.slice(match.index + match[0].length);
      var started = null;

      var step = function (now) {
        if (started === null) started = now;
        var progress = Math.min((now - started) / 900, 1);
        // Ease out so the number settles rather than stopping dead.
        var eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = prefix + Math.round(target * eased).toLocaleString('en-US') + suffix;
        if (progress < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }, { threshold: 0.5 });

  Array.prototype.forEach.call(stats, function (el) { counter.observe(el); });
})();
