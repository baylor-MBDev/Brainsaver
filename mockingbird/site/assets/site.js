// Progressive enhancement only. Every page works without this file: the nav
// is visible, and forms post normally and redirect.
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);

  // Mobile nav. The inline head script adds .js before paint, so CSS can
  // collapse the menu without a flash; this wires up the toggle.
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');
  if (toggle && nav) {
    var label = toggle.querySelector('.nav-toggle-label');
    var setOpen = function (open) {
      toggle.setAttribute('aria-expanded', String(open));
      nav.classList.toggle('is-open', open);
      if (label) label.textContent = open ? 'Close' : 'Menu';
    };
    toggle.addEventListener('click', function () {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && nav.classList.contains('is-open')) {
        setOpen(false);
        toggle.focus();
      }
    });
  }

  // Remember campaign tags from the landing page for the rest of the visit,
  // so a lead who browses before writing in is still attributed.
  var UTM = ['utm_source', 'utm_medium', 'utm_campaign'];
  var utm = {};
  try {
    utm = JSON.parse(sessionStorage.getItem('mb_utm') || '{}');
    if (UTM.some(function (key) { return params.get(key); })) {
      UTM.forEach(function (key) { utm[key] = params.get(key) || ''; });
      sessionStorage.setItem('mb_utm', JSON.stringify(utm));
    }
  } catch {
    // Storage can be blocked; attribution is a nice-to-have.
  }

  Array.prototype.forEach.call(document.querySelectorAll('form[data-lead-form]'), enhance);

  function enhance(form) {
    UTM.forEach(function (key) {
      if (form.elements[key] && utm[key]) form.elements[key].value = utm[key].slice(0, 200);
    });

    var service = params.get('service');
    var select = form.elements.service;
    if (service && select && select.querySelector('option[value="' + service.replace(/[^a-z]/g, '') + '"]')) select.value = service;

    var status = form.querySelector('[data-form-status]');
    var button = form.querySelector('button[type="submit"]');
    if (!window.fetch || !status || !button) return;

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (form.getAttribute('aria-busy') === 'true') return;
      var buttonText = button.textContent;
      form.setAttribute('aria-busy', 'true');
      button.disabled = true;
      button.textContent = 'Sending…';
      show('', '');

      fetch(form.action, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new URLSearchParams(new FormData(form)),
      })
        .then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (data) {
            if (!res.ok || !data.ok) throw { fromServer: true, message: data.error || 'Something went wrong. Please try again.' };
          });
        })
        .then(function () {
          form.reset();
          form.classList.add('is-sent');
          show(form.getAttribute('data-success') || 'Thanks, your message was sent.', 'success');
        })
        .catch(function (err) {
          // fetch() itself rejects with a browser-specific TypeError when offline.
          var message = err && err.fromServer ? err.message : 'We couldn’t reach the server. Check your connection and try again.';
          show(message, 'error');
          if (window.turnstile && form.querySelector('.cf-turnstile')) window.turnstile.reset(form.querySelector('.cf-turnstile'));
        })
        .then(function () {
          form.removeAttribute('aria-busy');
          button.disabled = false;
          button.textContent = buttonText;
        });
    });

    function show(message, kind) {
      status.textContent = message;
      status.className = 'form-status' + (kind ? ' is-' + kind : '');
      if (message) {
        status.setAttribute('tabindex', '-1');
        status.focus({ preventScroll: false });
      }
    }
  }
})();
