/* Back-to-top button for the Admin Panel and Business OS.
   Loaded by both admin.html and admin-biz.html; the button injects itself, so
   neither page needs markup for it. Styling lives in admin-theme.css, which both
   already load.

   The two pages do not scroll the same way. admin.html scrolls the document;
   Business OS sets html,body{overflow:hidden} and scrolls an inner panel
   instead, and which panel that is changes with the tab you are on. So rather
   than naming a container, this listens for scroll in the capture phase (scroll
   events do not bubble) and remembers whichever element actually reported one.
   That works on both pages and keeps working if a tab's layout changes. */
(function () {
  if (window.__taScrollTop) return;          // both pages, one instance
  window.__taScrollTop = true;

  function init() {
    if (document.getElementById('taScrollTopBtn')) return;

    var btn = document.createElement('button');
    btn.id = 'taScrollTopBtn';
    btn.type = 'button';
    btn.className = 'ta-scrolltop';
    btn.setAttribute('aria-label', 'Back to top');
    btn.title = 'Back to top';
    btn.innerHTML =
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<polyline points="18 15 12 9 6 15"/></svg>';
    document.body.appendChild(btn);

    var target = document.scrollingElement || document.documentElement;
    var SHOW_AFTER = 400;

    function topOf(el) { return (el && el.scrollTop) || 0; }

    /* The remembered target is whatever last fired a scroll event, which covers
       every normal case. It can still be wrong the first time: a panel scrolled
       by keyboard or by an anchor jump before any scroll reached us. So before
       acting, if the remembered element is already at the top, look for one that
       genuinely is scrolled and prefer it. Cheap, and only on click/update. */
    function scroller() {
      if (topOf(target) > 0) return target;
      var els = document.querySelectorAll('.main-area,.biz-body,.panel,main,[data-scroll-root]');
      for (var i = 0; i < els.length; i++) if (topOf(els[i]) > 0) return els[i];
      var doc = document.scrollingElement || document.documentElement;
      if (topOf(doc) > 0) return doc;
      if (topOf(document.body) > 0) return document.body;
      return target;
    }

    function update() {
      var y = topOf(scroller());
      btn.classList.toggle('show', y > SHOW_AFTER);
      /* Add Order pins a full-width action bar to the bottom of the viewport.
         Sitting on top of the Save button would be worse than not existing, so
         when that bar is on screen the button moves up to clear it. */
      var bar = document.getElementById('qaFixedBottom');
      var barUp = !!(bar && bar.offsetParent !== null);
      btn.classList.toggle('above-bar', barUp);
      if (barUp) btn.style.setProperty('--ta-bar-h', bar.offsetHeight + 'px');
    }

    document.addEventListener('scroll', function (e) {
      var el = e.target;
      if (el === document || el === document.documentElement || el === document.body) {
        el = document.scrollingElement || document.documentElement;
      }
      if (el && typeof el.scrollTop === 'number') target = el;
      update();
    }, true);

    window.addEventListener('resize', update);

    btn.addEventListener('click', function () {
      var reduce = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
      var el = scroller();
      try {
        el.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
      } catch (_) {
        el.scrollTop = 0;                     // older engines ignore the options form
      }
      btn.classList.remove('show');          // do not linger over a page already at the top
      /* Nothing else on the page moves focus back up, so a keyboard user would
         otherwise be scrolled to the top with their focus still far below. */
      var first = document.querySelector('main, .main-area, .biz-body, header');
      if (first && first.focus) { try { first.setAttribute('tabindex', '-1'); first.focus({ preventScroll: true }); } catch (_) {} }
    });

    update();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
