/* TriAkar, Shared Partials v1
   Defines NAV, DRAWER and FOOTER HTML as globals.
   Each page loads this synchronously then injects via tiny inline scripts,
   so nav/footer appear before first paint, zero flash. */

/* ── Image optimiser ─────────────────────────────────────────
   taImg(url, opts) returns a right-sized, modern-format (AVIF/WebP via
   f_auto) version of an image so each context downloads only the pixels
   it needs at smart quality (q_auto).
     • Native Cloudinary URLs  → its transformation segment is rewritten.
     • Remote URLs (e.g. raw Supabase Storage originals) → routed through
       Cloudinary's fetch CDN, which downloads the source once, optimises
       it, and edge-caches the result. This is what shrinks the multi-MB
       Supabase PNGs down to a few KB.
     • Relative / data / unknown URLs → returned untouched.
   Options:
     opts.w     target width  (default 600)
     opts.h     target height (default = w, square)
     opts.crop  'fill' (default, square crop) | 'limit' (keep aspect) */
window.TA_CLD = 'https://res.cloudinary.com/dtpibsruo';
window.taImg = function (url, opts) {
  opts = opts || {};
  if (!url || typeof url !== 'string') return url || '';

  // Build the transformation string once.
  var w = opts.w || 600;
  var parts = ['f_auto', 'q_auto', 'dpr_auto'];
  if (opts.crop === 'limit') parts.push('c_limit', 'w_' + w);
  else parts.push('c_fill', 'w_' + w, 'h_' + (opts.h || w));
  var t = parts.join(',');

  // 1) Native Cloudinary delivery URL, swap its transformation segment.
  var marker = '/image/upload/';
  var i = url.indexOf(marker);
  if (i !== -1) {
    var head = url.slice(0, i + marker.length);
    var tail = url.slice(i + marker.length).split('/');
    if (tail.length > 1 && /(^|,)[a-z]{1,3}_[^/]+/.test(tail[0])) tail.shift();
    return head + t + '/' + tail.join('/');
  }

  // 2) Remote http(s) image (Supabase Storage, etc.), optimise via fetch.
  if (/^https?:\/\//.test(url) && url.indexOf('res.cloudinary.com') === -1) {
    return window.TA_CLD + '/image/fetch/' + t + '/' + encodeURIComponent(url);
  }

  // 3) Anything else (relative path, data URI), leave as-is.
  return url;
};

/* ── Mobile menu style (admin-selectable, site-wide) ──────────────
   Applies the cached / default style instantly (no flash) by setting
   <html data-menu-style>, then refreshes from Supabase in the background.
   Values: '7' = top tile grid (default) · '6' = left drawer · '4' = bottom sheet.
   Falls back to '7' if the setting/table is missing, always safe. */
(function(){
  var KEY='ta_menu_style', OK={'4':1,'6':1,'7':1};
  function apply(v){ if(OK[v]) document.documentElement.setAttribute('data-menu-style', v); }
  var cached=null; try{cached=localStorage.getItem(KEY);}catch(_){}
  apply(cached||'7');
  var SB='https://qarjbmogersuaerkhlcu.supabase.co';
  var ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhcmpibW9nZXJzdWFlcmtobGN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMDMzNzMsImV4cCI6MjA5NDU3OTM3M30.iS7VcO9j9UjlmBN0EhhuWBOu6Vvrg8-SQrb3oZ25AIs';
  fetch(SB+'/rest/v1/site_settings?select=value&key=eq.mobile_menu_style',{headers:{apikey:ANON,Authorization:'Bearer '+ANON}})
    .then(function(r){return r.ok?r.json():null;})
    .then(function(rows){
      if(!rows||!rows.length)return;
      var v=String(rows[0].value==null?'':rows[0].value).replace(/"/g,'').trim();
      if(OK[v]){ apply(v); try{localStorage.setItem(KEY,v);}catch(_){} }
    }).catch(function(){});
})();

window._NAV_HTML = `<nav class="main-nav" id="mainNav">
  <div class="nav-inner">
    <button class="nav-toggle" aria-label="Menu" aria-expanded="false"><span></span><span></span><span></span></button>
    <a href="/index.html" class="logo">
      <span class="logo-en"><span style="color:var(--accent)">TRI</span>AKAR</span>
      <span class="logo-hi"><span style="color:var(--accent)">त्रि</span>आकार</span>
    </a>
    <ul class="nav-links"><li><a href="/products.html">Shop</a></li><li><a href="/order.html">Customization</a></li><li><a href="/stories.html">Our Stories</a></li><li><a href="/about.html">About</a></li><li><a href="/contact.html">Contact</a></li><li><a href="/track-order.html">Track Order</a></li></ul>
    <div class="nav-right">
      <form class="nav-search" role="search" onsubmit="return window.taSearch(this);">
        <input type="search" id="navSearchInput" name="q" placeholder="Search products…" aria-label="Search products" autocomplete="off">
        <button type="submit" aria-label="Search"><svg width="15" height="15" viewBox="0 0 18 18" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/><path d="M12.4 12.4L16 16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button>
      </form>
      <a href="/wishlist.html" class="wishlist-btn" aria-label="Wishlist">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>
        <span class="wishlist-badge" id="wishlistBadge">0</span>
      </a>
      <a href="/order.html" class="nav-corp" aria-label="Corporate or bulk order">Corporate Order →</a>
      <a href="#" class="cart-btn" onclick="openCart();return false;">
        <svg width="17" height="17" viewBox="0 0 18 18" fill="none"><path d="M1 1h2.5l1.6 8h8.4l1.5-5.5H5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="7.5" cy="14.5" r="1.2" fill="currentColor"/><circle cx="13" cy="14.5" r="1.2" fill="currentColor"/></svg>
        Cart <span class="cart-badge" id="cartBadge">0</span>
      </a>
      <a href="/account.html" class="nav-shop">Login</a>
    </div>
  </div>
</nav>`;

window._DRAWER_HTML = `<nav class="nav-drawer"><a href="/order.html" class="drawer-link"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>Customization</a><a href="/wishlist.html" class="drawer-link" style="display:none"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>Wishlist</a><a href="/stories.html" class="drawer-link"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/></svg>Our Stories</a><a href="/products.html" class="drawer-link"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>Shop</a><a href="/about.html" class="drawer-link"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>About</a><a href="/contact.html" class="drawer-link"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>Contact</a><a href="/track-order.html" class="drawer-link"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2"/><circle cx="18.5" cy="18.5" r="2"/></svg>Track Order</a><a href="/account.html" class="drawer-login drawer-auth">Login</a></nav>`;

/* Site-wide product search, used by nav + drawer search forms */
window.taSearch = function(form){
  var i = form.querySelector('input');
  var q = (i && i.value || '').trim();
  if(!q){ if(i) i.focus(); return false; }
  window.location.href = '/products.html?search=' + encodeURIComponent(q);
  return false;
};

window._FOOTER_HTML = `<footer>
  <div class="mw">
    <div class="foot-news">
      <div>
        <div class="foot-news-t">Stay inspired.</div>
        <div class="foot-news-d">Get new-drop alerts and design ideas, no spam.</div>
      </div>
      <form class="foot-news-form" onsubmit="return taNewsletterSignup(this)">
        <input type="email" name="email" required placeholder="Enter your email" aria-label="Email address">
        <button type="submit">Subscribe</button>
      </form>
    </div>
    <div class="foot-grid">
      <div>
        <div class="foot-brand"><span style="color:var(--accent)">TRI</span><span style="color:#ffffff">AKAR</span></div>
        <div class="foot-hi"><span style="color:var(--accent)">त्रि</span>आकार</div>
        <p class="foot-desc">3D Printing Services, Delhi NCR</p>
        <div class="foot-phone"><a href="tel:+919217555833">+91 9217-555-833</a></div>
        <div class="foot-hours">Open Mon–Sat · 11 AM – 8 PM</div>
        <div class="foot-addr">Shop No. 25, Karan Singh Market<br>Chhoti Milak, Greater Noida West, UP – 201307</div>
        <a href="https://maps.app.goo.gl/Ki2GXFgi6JUZMb7z6" class="foot-dir" target="_blank">Get Directions →</a>
      </div>
      <div><div class="foot-col-t">Shop</div>
        <ul class="foot-links">
          <li><a href="/products.html">All Products</a></li>
          <li><a href="/products.html?cat=desk">Desk</a></li>
          <li><a href="/products.html?cat=home">Home</a></li>
          <li><a href="/products.html?cat=gifting">Gifting</a></li>
          <li><a href="/order.html">Customization</a></li>
          <li><a href="/stories.html">Stories</a></li>
          <li><a href="/services/replacement-parts.html">Replacement Parts</a></li>
          <li><a href="/services/personalized-gifts.html">Personalized Gifts</a></li>
        </ul>
      </div>
      <!-- SEO: hidden from the visible footer but kept in the DOM (and in sitemap.xml) so search engines still crawl these local landing pages -->
      <div style="display:none"><div class="foot-col-t">Services</div>
        <ul class="foot-links">
          <li><a href="/services/corporate-gifting">Corporate Gifting</a></li>
          <li><a href="/gifts/corporate-gifts-noida">Corporate Gifts Noida</a></li>
          <li><a href="/gifts/birthday-gifts-noida">Birthday Gifts Noida</a></li>
          <li><a href="/gifts/housewarming-gifts">Housewarming Gifts</a></li>
          <li><a href="/3d-printing-noida">3D Printing Noida</a></li>
          <li><a href="/3d-printing-greater-noida">3D Printing Greater Noida</a></li>
          <li><a href="/replacement-parts-noida">Replacement Parts Noida</a></li>
          <li><a href="/3d-printed-gifts-delhi">3D Printed Gifts Delhi</a></li>
        </ul>
      </div>
      <div><div class="foot-col-t">Help</div>
        <ul class="foot-links">
          <li><a href="/contact.html">Contact Us</a></li>
          <li><a href="/reviews.html">Reviews</a></li>
          <li><a href="/track-order.html">Track Order</a></li>
          <li><a href="/refund-policy.html">Refund Policy</a></li>
          <li><a href="/about.html">About</a></li>
          <li><a href="/order.html">Customization</a></li>
        </ul>
      </div>
      <div><div class="foot-col-t">Legal</div>
        <ul class="foot-links">
          <li><a href="/terms.html">Terms &amp; Conditions</a></li>
          <li><a href="/privacy.html">Privacy Policy</a></li>
        </ul>
      </div>
    </div>
    <div class="foot-bottom">
      <p class="foot-copy">© 2026 TriAkar. All rights reserved.</p>
      <a href="https://www.instagram.com/triakarofficial" target="_blank" rel="noopener" class="foot-insta" aria-label="TriAkar on Instagram"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><circle cx="17.5" cy="6.5" r=".5" fill="currentColor" stroke="none"/></svg>@triakarofficial</a>
      <p class="foot-tag" style="font-family:var(--font-g);text-transform:none;letter-spacing:.02em;font-size:13px">Crafting the <span style="color:var(--accent)">Third</span> Dimension</p>
    </div>
    <div class="pay-trust-row" style="margin-top:18px">
      <span class="pay-trust-badge">UPI</span>
      <span class="pay-trust-badge">Visa</span>
      <span class="pay-trust-badge">Mastercard</span>
      <span class="pay-trust-badge">RuPay</span>
      <span class="pay-trust-badge">Secured by Razorpay</span>
    </div>
  </div>
</footer>`;

/* ════════════════════════════════════════════════════════════════════
   F1, TOP CONTACT BAR (two lines, site-wide)
   Line 1: phone + WhatsApp + "Bulk / Corporate Order?"  (desktop only)
   Line 2: rotating notice carousel (3 messages, 3s fade)
   Supersedes any per-page .notice-bar (hidden via injected CSS = no flash).
   ════════════════════════════════════════════════════════════════════ */
(function(){
  var WA='https://wa.me/919217555833?text='+encodeURIComponent('Hi TriAkar! I have a question.');
  var NOTES=[
    'Free shipping above ₹999 · ₹99 fee below ₹999',
    'Custom 3D printing, your design, made in Greater Noida',
    'Noida pickup available · Open Mon–Sat, 11 AM – 8 PM'
  ];
  /* Inject CSS first (head exists during parse) so per-page .notice-bar
     is hidden before it paints, prevents a double-bar flash. */
  try{
    var head=document.head||document.getElementsByTagName('head')[0];
    if(head && !document.getElementById('taTopbarCSS')){
      var st=document.createElement('style');st.id='taTopbarCSS';
      st.textContent=
        '.notice-bar{display:none!important}'+
        '.ta-topbar{position:fixed;top:0;left:0;right:0;z-index:1001;height:var(--notice-h);display:flex;align-items:center;justify-content:center;font-family:var(--font-b,inherit);background:var(--charcoal,#0F0F0D);color:var(--ivory,#F4F2EC);transition:transform .4s cubic-bezier(.22,1,.36,1),opacity .35s}'+
        'html.is-scrolled .ta-topbar{transform:translateY(-100%);opacity:0;pointer-events:none}'+
        '.ta-topbar-l2{width:100%}'+
        '.ta-topbar-l1{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:6px 20px;font-size:11px;letter-spacing:.02em;border-bottom:1px solid rgba(255,255,255,.08)}'+
        '.ta-topbar-l1 a{color:var(--ivory,#F4F2EC);text-decoration:none;opacity:.85;transition:opacity .2s}'+
        '.ta-topbar-l1 a:hover{opacity:1}'+
        '.ta-topbar-l1 .ttb-left{display:flex;align-items:center;gap:18px}'+
        '.ta-topbar-l1 .ttb-corp{color:var(--accent,#C4622A);font-weight:600;letter-spacing:.06em;text-transform:uppercase;font-size:10px;opacity:1}'+
        '.ta-topbar-l2{position:relative;height:30px;overflow:hidden;text-align:center}'+
        '.notice-carousel{position:relative;height:30px}'+
        '.notice-slide{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:11px;letter-spacing:.04em;color:var(--ivory,#F4F2EC);opacity:0;transition:opacity .6s ease}'+
        '.notice-slide.active{opacity:.92}'+
        /* nav-corp pill removed from the top nav to prevent crowding/collision, corporate CTA lives in the top contact bar (ttb-corp), footer, and mobile drawer */
        '.nav-corp{display:none!important}'+
        '.nav-corp:hover{background:var(--accent,#C4622A)}'+
        '@media(max-width:768px){.ta-topbar-l1{display:none}.nav-corp{display:none}}'+
        'body:has(.nav-drawer.open) .ta-topbar{display:none!important}';
      head.appendChild(st);
    }
  }catch(_){}

  function build(){
    var p=location.pathname.replace(/\/$/,'');
    if(p!==''&&p!=='/index.html'&&!p.endsWith('/index.html')){
      document.documentElement.style.setProperty('--notice-h','0px');
      return;
    }
    if(document.getElementById('taTopbar'))return;
    var bar=document.createElement('div');
    bar.id='taTopbar';bar.className='ta-topbar';
    var slides=NOTES.map(function(n,i){
      return '<div class="notice-slide'+(i===0?' active':'')+'">'+n+'</div>';
    }).join('');
    bar.innerHTML=
      '<div class="ta-topbar-l2"><div class="notice-carousel">'+slides+'</div></div>';
    document.body.insertBefore(bar,document.body.firstChild);

    /* Rotate line-2 messages every 3s */
    var els=bar.querySelectorAll('.notice-slide');
    if(els.length>1){
      var idx=0;
      setInterval(function(){
        els[idx].classList.remove('active');
        idx=(idx+1)%els.length;
        els[idx].classList.add('active');
      },3000);
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',build);
  else build();
})();

/* ════════════════════════════════════════════════════════════════════
   SITE CONTENT hydration (Module 4), applies admin-editable values from
   site_settings onto the already-rendered footer/top-bar. Purely additive
   and fully guarded: any failure leaves the hardcoded defaults untouched.
   ════════════════════════════════════════════════════════════════════ */
(function(){
  function apply(s){
    try{
      if(s.whatsapp_number){
        var num=String(s.whatsapp_number).replace(/[^0-9]/g,'');
        if(num.length>=10) document.querySelectorAll('a[href*="wa.me/"]').forEach(function(a){ a.href=a.href.replace(/wa\.me\/\d+/, 'wa.me/'+num); });
      }
      if(s.social_instagram){
        document.querySelectorAll('a[href*="instagram.com"]').forEach(function(a){ a.href=s.social_instagram; });
      }
      var notes=[s.announcement_1,s.announcement_2,s.announcement_3];
      var slides=document.querySelectorAll('#taTopbar .notice-slide');
      for(var i=0;i<slides.length && i<notes.length;i++){
        if(notes[i] && String(notes[i]).trim()) slides[i].textContent=String(notes[i]);
      }
    }catch(_){}
  }
  function run(){
    try{
      var API=(location.hostname==='localhost'||location.hostname==='127.0.0.1')?'http://localhost:3000':'https://triakar.onrender.com';
      fetch(API+'/api/site-settings').then(function(r){return r.json();}).then(function(d){ apply((d&&d.settings)||{}); }).catch(function(){});
    }catch(_){}
  }
  if(document.readyState==='complete') setTimeout(run,300);
  else window.addEventListener('load',function(){ setTimeout(run,300); });
})();

/* ════════════════════════════════════════════════════════════════════
   PWA, manifest link, theme-color, and service-worker registration.
   Injected here so it runs site-wide without editing every page <head>.
   ════════════════════════════════════════════════════════════════════ */
(function(){
  try{
    var head=document.head||document.getElementsByTagName('head')[0];
    if(head){
      if(!head.querySelector('link[rel="manifest"]')){
        var m=document.createElement('link');m.rel='manifest';m.href='/manifest.json';head.appendChild(m);
      }
      if(!head.querySelector('meta[name="theme-color"]')){
        var t=document.createElement('meta');t.name='theme-color';t.content='#0F0F0D';head.appendChild(t);
      }
      if(!head.querySelector('link[rel="apple-touch-icon"]')){
        var a=document.createElement('link');a.rel='apple-touch-icon';a.href='/favicon.svg';head.appendChild(a);
      }
      if(!head.querySelector('meta[name="apple-mobile-web-app-capable"]')){
        var c=document.createElement('meta');c.name='apple-mobile-web-app-capable';c.content='yes';head.appendChild(c);
      }
    }
  }catch(_){}
  /* Register service worker (skip localhost file:// & http to avoid dev noise) */
  if('serviceWorker' in navigator && location.protocol.indexOf('http')===0){
    /* Auto-reload once when a NEW service worker takes control, so deploys
       reach users without a manual cache clear. Gated on an existing
       controller so the first-ever install doesn't trigger a reload. */
    var _swReloaded=false;
    var _hadController=!!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange',function(){
      if(_swReloaded || !_hadController) return;
      _swReloaded=true;
      location.reload();
    });
    window.addEventListener('load',function(){
      navigator.serviceWorker.register('/sw.js').then(function(reg){
        if(reg && reg.update) reg.update(); /* check for a newer SW on every load */
      }).catch(function(){});
    });
  }
})();

/* ════════════════════════════════════════════════════════════════════
   MOBILE BOTTOM NAV, app-style tab bar, shown only on small screens.
   Cart/wishlist badges reuse the .cart-badge/.wishlist-badge classes so
   shared.js keeps them in sync automatically.
   ════════════════════════════════════════════════════════════════════ */
(function(){
  function build(){
    if(document.getElementById('taBottomNav'))return;
    var path=(location.pathname||'').toLowerCase();
    var seg=(path.split('/').pop()||'').replace(/\.html$/,'');
    var isHome=(seg===''||seg==='index');
    var isShop=(seg==='products'||seg==='product-detail');
    var isWish=(seg==='wishlist');
    var isAcct=(seg==='account');

    /* Real glass refraction (feDisplacementMap) for iOS/Safari, shared by
       both the bottom tab bar and the top nav's scrolled glass capsule.
       Injected here (before the product-detail early return below) so it's
       available on every page, not just the ones with the tab bar.
       Android's Chrome/WebView renders this filter weakly, so it's skipped
       there and both navs fall back to their plain blur. */
    try{
      if(!/Android/i.test(navigator.userAgent)&&!document.getElementById('liquid-glass-distortion')){
        var filterSvg=document.createElementNS('http://www.w3.org/2000/svg','svg');
        filterSvg.setAttribute('width','0');filterSvg.setAttribute('height','0');
        filterSvg.style.position='absolute';
        filterSvg.innerHTML='<filter id="liquid-glass-distortion" x="-20%" y="-20%" width="140%" height="140%">'+
          '<feTurbulence type="fractalNoise" baseFrequency="0.008 0.06" numOctaves="2" seed="7" result="noise"/>'+
          '<feGaussianBlur in="noise" stdDeviation="2" result="blurredNoise"/>'+
          '<feDisplacementMap in="SourceGraphic" in2="blurredNoise" scale="18" xChannelSelector="R" yChannelSelector="G"/>'+
        '</filter>';
        document.body.appendChild(filterSvg);
      }
    }catch(_){}

    /* ── PRODUCT DETAIL: price + Add to Cart + Buy Now bar ────── */
    if(seg==='product-detail'){
      var pdpNav=document.createElement('nav');
      pdpNav.id='taBottomNav';
      pdpNav.className='ta-bottomnav ta-bottomnav--pdp';
      try{ if(!/Android/i.test(navigator.userAgent)) pdpNav.classList.add('tabn-distort'); }catch(_){}
      pdpNav.setAttribute('aria-label','Product actions');
      pdpNav.innerHTML=
        '<div class="tabn-pdp-info">'+
          '<div class="tabn-pdp-label">Price</div>'+
          '<div class="tabn-pdp-price" id="tabnPdpPrice">—</div>'+
        '</div>'+
        '<div class="tabn-pdp-actions">'+
          '<button class="tabn-pdp-cart" onclick="if(window.addToCartFromDetail)addToCartFromDetail()" aria-label="Add to cart">'+
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>'+
            'Add to Cart'+
          '</button>'+
          '<button class="tabn-pdp-buy" onclick="if(window.buyNow)buyNow()" aria-label="Buy now">'+
            'Buy Now →'+
          '</button>'+
        '</div>';
      document.body.appendChild(pdpNav);
      document.body.classList.add('has-bottomnav');

      /* Hide bar when on-page buy buttons are visible; show when they scroll off */
      try{
        var _watchBuyButtons=function(){
          var anchor=document.getElementById('buyButtons');
          if(!anchor)return;
          new IntersectionObserver(function(entries){
            pdpNav.classList.toggle('tabn-peek-hidden',entries[0].isIntersecting);
          },{threshold:0.1}).observe(anchor);
        };
        /* buyButtons is rendered after JS init, wait for it */
        if(document.getElementById('buyButtons')){_watchBuyButtons();}
        else{setTimeout(_watchBuyButtons,800);setTimeout(_watchBuyButtons,2000);}
      }catch(_){}

      /* Sync price from product JS once it loads */
      try{
        var _syncPrice=function(){
          var src=document.getElementById('prodPrice');
          var dst=document.getElementById('tabnPdpPrice');
          if(src&&dst){
            var t=(src.textContent||'').replace(/\s+/g,' ').trim();
            if(t&&t.indexOf('₹')!==-1){dst.textContent=t;}
          }
        };
        var _priceEl=document.getElementById('prodPrice');
        if(_priceEl){
          var _obs=new MutationObserver(_syncPrice);
          _obs.observe(_priceEl,{childList:true,subtree:true,characterData:true});
        }
        setTimeout(_syncPrice,600);setTimeout(_syncPrice,1500);setTimeout(_syncPrice,3000);
      }catch(_){}
      return;
    }

    var nav=document.createElement('nav');
    nav.id='taBottomNav';nav.className='ta-bottomnav';
    nav.setAttribute('aria-label','Primary');
    try{ if(!/Android/i.test(navigator.userAgent)) nav.classList.add('tabn-distort'); }catch(_){}
    nav.innerHTML=
      '<a href="/index.html" class="tabn-item'+(isHome?' active':'')+'" aria-label="Home">'+
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5L12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>'+
        '<span>Home</span></a>'+
      '<a href="/products.html" class="tabn-item'+(isShop?' active':'')+'" aria-label="Shop">'+
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>'+
        '<span>Shop</span></a>'+
      '<a href="/wishlist.html" class="tabn-item'+(isWish?' active':'')+'" aria-label="Wishlist">'+
        '<span class="tabn-ico-wrap"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>'+
        '<span class="wishlist-badge tabn-badge" id="tabnWishBadge">0</span></span>'+
        '<span>Saved</span></a>'+
      '<a href="#" class="tabn-item" aria-label="Cart" onclick="if(window.openCart){openCart();}return false;">'+
        '<span class="tabn-ico-wrap"><svg viewBox="0 0 18 18" fill="none"><path d="M1 1h2.5l1.6 8h8.4l1.5-5.5H5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="7.5" cy="14.5" r="1.2" fill="currentColor"/><circle cx="13" cy="14.5" r="1.2" fill="currentColor"/></svg>'+
        '<span class="cart-badge tabn-badge" id="tabnCartBadge">0</span></span>'+
        '<span>Cart</span></a>'+
      '<a href="/account.html#orders" class="tabn-item'+(isAcct?' active':'')+'" aria-label="Account">'+
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.6"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/></svg>'+
        '<span>Account</span></a>';
    document.body.appendChild(nav);
    document.body.classList.add('has-bottomnav');

    /* ── Hide on scroll-down, reveal on scroll-up ──────────────────────
       Standard native-app tab bar behaviour: reuses the same
       tabn-peek-hidden class/transform the PDP bar uses for its
       buyButtons visibility toggle, just driven by scroll direction here
       since the icon tab bar has no on-page anchor to watch. Always shown
       near the top of the page regardless of direction. */
    (function initScrollHide(){
      var lastY=window.scrollY,hidden=false,ticking=false;
      var THRESHOLD=6,TOP_GUARD=40;
      function update(){
        ticking=false;
        var y=window.scrollY;
        var dy=y-lastY;
        if(y<=TOP_GUARD){
          if(hidden){hidden=false;nav.classList.remove('tabn-peek-hidden');}
        }else if(dy>THRESHOLD&&!hidden){
          hidden=true;nav.classList.add('tabn-peek-hidden');
        }else if(dy<-THRESHOLD&&hidden){
          hidden=false;nav.classList.remove('tabn-peek-hidden');
        }
        lastY=y;
      }
      window.addEventListener('scroll',function(){
        if(!ticking){ticking=true;requestAnimationFrame(update);}
      },{passive:true});
    })();

    /* ── Sliding glass highlight ──────────────────────────────────────
       A single pill slides behind the active tab. To make the slide
       visible across full page loads (this is a multi-page site), we
       remember the previously-active tab index in sessionStorage and
       animate from there to the current one. Purely additive: if any
       of this fails the tab still shows orange via CSS. */
    try{
      var items=Array.prototype.slice.call(nav.querySelectorAll('.tabn-item'));
      var activeEl=nav.querySelector('.tabn-item.active');
      if(activeEl){
        var ind=document.createElement('span');
        ind.className='tabn-indicator';
        nav.insertBefore(ind,nav.firstChild);

        var curIdx=items.indexOf(activeEl);
        var reduceMotion=function(){
          try{
            return (window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)||
              document.documentElement.classList.contains('a11y-reduce-motion');
          }catch(_){return false;}
        };

        /* ── Liquid-glass motion effect: chromatic edge fringe on the pill.
           Wired into both the drag gesture and the CSS-driven pill
           transitions (cross-page arrival slide, drag-release settle) via
           one shared engine, so a tap-triggered slide across several tabs
           gets the same live sweep-through feedback as an actual drag.
           Gated to tabn-distort (skipped on Android) and a no-op under
           reduced motion. transform/opacity only. Labels themselves are
           never animated, no squeeze/scale effect on tab text. */
        var fringeLeft=null,fringeRight=null;
        try{
          ind.innerHTML=
            '<span class="tabn-fringe tabn-fringe-left" aria-hidden="true"></span>'+
            '<span class="tabn-fringe tabn-fringe-right" aria-hidden="true"></span>';
          fringeLeft=ind.querySelector('.tabn-fringe-left');
          fringeRight=ind.querySelector('.tabn-fringe-right');
        }catch(_){}

        var lastFxX=null,lastFxT=null;
        var velocityAt=function(x){
          var now=(window.performance&&performance.now)?performance.now():Date.now();
          var v=0;
          if(lastFxX!==null&&lastFxT!==null){
            var dt=now-lastFxT;
            if(dt>0)v=(x-lastFxX)/dt;
          }
          lastFxX=x;lastFxT=now;
          return v;
        };
        var applyFringe=function(v){
          if(!fringeLeft||!fringeRight)return;
          if(reduceMotion()||!nav.classList.contains('tabn-distort')){
            fringeLeft.style.opacity=0;fringeRight.style.opacity=0;return;
          }
          var speed=Math.min(Math.abs(v)/2.4,1);
          var goingRight=v>0.03,goingLeft=v<-0.03;
          fringeLeft.style.opacity=speed*(goingRight?0.9:(goingLeft?0.28:0));
          fringeRight.style.opacity=speed*(goingLeft?0.9:(goingRight?0.28:0));
        };
        var resetFx=function(){
          lastFxX=null;lastFxT=null;
          if(fringeLeft)fringeLeft.style.opacity=0;
          if(fringeRight)fringeRight.style.opacity=0;
        };
        var fxFrame=function(x){applyFringe(velocityAt(x));};
        var currentIndTransformX=function(){
          try{
            var t=getComputedStyle(ind).transform;
            if(!t||t==='none')return 0;
            return new DOMMatrixReadOnly(t).m41;
          }catch(_){return 0;}
        };
        var runFxDuring=function(ms){
          if(reduceMotion())return;
          var t0=(window.performance&&performance.now)?performance.now():Date.now();
          lastFxX=null;lastFxT=null;
          function step(now){
            var x=currentIndTransformX();
            fxFrame(x);
            if(now-t0<ms){requestAnimationFrame(step);}else{resetFx();}
          }
          requestAnimationFrame(step);
        };

        var place=function(el,squeeze){
          if(!el||!el.offsetWidth)return false; /* skip when hidden (e.g. desktop width) */
          var w=el.offsetWidth,x=el.offsetLeft;
          ind.style.width=w+'px';
          ind.style.transform='translateX('+x+'px)'+((squeeze&&!reduceMotion())?' scaleX(1.12)':' scaleX(1)');
          if(squeeze&&!reduceMotion()){
            setTimeout(function(){ ind.style.transform='translateX('+x+'px) scaleX(1)'; },160);
          }
          return true;
        };
        var snapThen=function(startEl,endEl){
          ind.classList.add('tabn-indicator--noanim');
          if(!place(startEl)){ind.classList.remove('tabn-indicator--noanim');return false;}
          ind.classList.add('on');
          void ind.offsetWidth; /* flush so the start position isn't animated */
          var isRealSlide=startEl!==endEl;
          requestAnimationFrame(function(){
            ind.classList.remove('tabn-indicator--noanim');
            place(endEl,true); /* squeeze/stretch pop on arrival, the "liquid" morph */
            /* The fringe/squeeze rAF loop reads computed styles every frame
               for 520ms, only worth paying for when the pill is actually
               travelling between two different tabs. A fresh load or direct
               nav settles in place (startEl===endEl) with no real motion,
               so skip it there, it was running on every single page view
               site-wide for no visible benefit and just cost CPU/battery. */
            if(isRealSlide)runFxDuring(520); /* matches the .5s transform / .38s width transition */
          });
          return true;
        };

        var prevIdx=-1;
        try{var v=sessionStorage.getItem('ta_btmTab');if(v!==null)prevIdx=parseInt(v,10);}catch(_){}

        var doInitialPlace=function(){
          if(prevIdx>=0&&prevIdx<items.length&&prevIdx!==curIdx){
            return snapThen(items[prevIdx],activeEl);   /* slide from the tab we came from */
          }
          return snapThen(activeEl,activeEl);            /* fresh load → settle in place */
        };

        if(!doInitialPlace()){
          /* Nav has zero size right now, e.g. account.html starts with
             body.acct-auth hiding .ta-bottomnav (display:none!important)
             until the async session check resolves, so offsetWidth reads 0
             and the pill can't be measured. Previously this left the
             capsule missing forever (only recovering by accident if some
             unrelated window "resize" happened to fire later). Watch the
             nav's own box and place the pill the moment it actually gets
             a size, instead of leaving it invisible with just the plain
             orange active-tab color showing.
             Deliberately NOT gated to "mobile viewport only": this block
             only ever runs at all when placement already failed, so on
             desktop it just means one idle ResizeObserver per pageview
             (negligible) versus the confirmed missing-capsule bug it
             exists to fix. Adding a matchMedia/innerWidth check here adds
             a second synchronous condition to get exactly right at a very
             early point in page load for no real-world benefit (desktop
             users never hit the mobile tab bar anyway), so the simpler,
             unconditional version stays. */
          if(typeof ResizeObserver!=='undefined'){
            var visRO=new ResizeObserver(function(){
              if(nav.offsetWidth>0){
                visRO.disconnect();
                doInitialPlace();
              }
            });
            visRO.observe(nav);
          }
        }
        try{sessionStorage.setItem('ta_btmTab',String(curIdx));}catch(_){}

        /* Reposition on viewport/orientation change (snap, no slide). */
        var rt;
        window.addEventListener('resize',function(){
          clearTimeout(rt);
          rt=setTimeout(function(){
            ind.classList.add('tabn-indicator--noanim');
            if(place(activeEl)){
              ind.classList.add('on');
              void ind.offsetWidth;
              requestAnimationFrame(function(){ind.classList.remove('tabn-indicator--noanim');});
            }
          },150);
        },{passive:true});

        /* ── Press-and-hold + drag the pill, snap to nearest tab on release ──
           The pointer target is the active tab's own anchor (not the pill,
           which sits behind it at z-index:0) so normal quick taps still work
           as plain links; a long-press promotes the same gesture into a drag
           that moves the visual pill 1:1 with the finger. Releasing over a
           different tab persists it for cross-page continuity, then performs
           the real navigation (this is a multi-page site, no client router). */
        (function initPillDrag(){
          var LONG_PRESS_MS=140;
          var timer=null,dragging=false,justDragged=false;
          var startX=0,startLeft=0,pillW=0;

          function centerOf(el){return el.offsetLeft+el.offsetWidth/2;}
          function nearestIndexForCenter(cx){
            var best=0,bd=Infinity;
            items.forEach(function(el,i){
              var d=Math.abs(centerOf(el)-cx);
              if(d<bd){bd=d;best=i;}
            });
            return best;
          }

          activeEl.classList.add('tabn-item--pillhost');

          activeEl.addEventListener('pointerdown',function(e){
            if(e.pointerType==='mouse'&&e.button!==0)return;
            startX=e.clientX;
            startLeft=ind.offsetLeft;
            pillW=ind.offsetWidth;
            clearTimeout(timer);
            timer=setTimeout(function(){
              dragging=true;
              try{activeEl.setPointerCapture(e.pointerId);}catch(_){}
              ind.classList.add('tabn-indicator--dragging','tabn-indicator--noanim');
              lastFxX=null;lastFxT=null;
            },LONG_PRESS_MS);
          });

          activeEl.addEventListener('pointermove',function(e){
            if(!dragging)return;
            e.preventDefault();
            var maxX=Math.max(0,nav.clientWidth-pillW);
            var left=Math.max(0,Math.min(maxX,startLeft+(e.clientX-startX)));
            ind.style.transform='translateX('+left+'px)';
            var hoverIdx=nearestIndexForCenter(left+pillW/2);
            items.forEach(function(it,i){it.classList.toggle('active',i===hoverIdx);});
            fxFrame(left); /* continuous drag-through: fringe, live every move */
          });

          function endDrag(e){
            clearTimeout(timer);
            if(!dragging)return; /* plain tap, default link navigation proceeds untouched */
            dragging=false;
            justDragged=true;
            setTimeout(function(){justDragged=false;},0);
            ind.classList.remove('tabn-indicator--dragging');

            var maxX=Math.max(0,nav.clientWidth-pillW);
            var left=Math.max(0,Math.min(maxX,startLeft+(e.clientX-startX)));
            var snapIdx=nearestIndexForCenter(left+pillW/2);
            var targetEl=items[snapIdx];
            var isCartTab=(targetEl.getAttribute('href')==='#');

            items.forEach(function(it,i){it.classList.toggle('active',i===curIdx);});

            if(snapIdx===curIdx||isCartTab){
              if(!reduceMotion())ind.classList.remove('tabn-indicator--noanim');
              place(activeEl,true);
              runFxDuring(420);
              if(isCartTab&&snapIdx!==curIdx&&window.openCart)window.openCart();
              return;
            }

            /* real tab: persist so the destination page's arrival slide
               continues from here, then hand off to real navigation */
            try{sessionStorage.setItem('ta_btmTab',String(snapIdx));}catch(_){}
            if(reduceMotion()){
              location.href=targetEl.getAttribute('href');
            }else{
              ind.classList.remove('tabn-indicator--noanim');
              place(targetEl,true);
              runFxDuring(300); /* short, the page unloads at 150ms anyway */
              setTimeout(function(){location.href=targetEl.getAttribute('href');},150);
            }
          }

          activeEl.addEventListener('pointerup',endDrag);
          activeEl.addEventListener('pointercancel',endDrag);
          activeEl.addEventListener('click',function(e){
            if(justDragged){e.preventDefault();e.stopPropagation();}
          });
        })();
      }
    }catch(_){}
  }
  /* Build immediately, partials.js is a blocking script at the top of
     <body>, so the tab bar exists before first paint and stays in the very
     first frame of cross-page view transitions (no blink between pages). */
  if(document.body)build();
  else if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',build);
  else build();
})();

/* ════════════════════════════════════════════════════════════════════
   ACCESSIBILITY WIDGET, site-wide
   partials.js is a blocking script at the top of <body>, so saved
   settings are applied to <html> before first paint = zero flash.
   The widget UI itself is built once the DOM is ready.
   ════════════════════════════════════════════════════════════════════ */
(function(){
  var KEY='ta_a11y';
  var FLAGS={contrast:'a11y-contrast',bigtext:'a11y-bigtext',readable:'a11y-readable',links:'a11y-links',motion:'a11y-reduce-motion'};
  var CB={deut:'a11y-cb-deut',prot:'a11y-cb-prot',trit:'a11y-cb-trit'};

  function read(){try{return JSON.parse(localStorage.getItem(KEY))||{};}catch(_){return {};}}
  function write(s){try{localStorage.setItem(KEY,JSON.stringify(s));}catch(_){}}
  function apply(s){
    var root=document.documentElement;
    Object.keys(FLAGS).forEach(function(k){root.classList.toggle(FLAGS[k],!!s[k]);});
    Object.keys(CB).forEach(function(k){root.classList.toggle(CB[k],s.cb===k);});
  }

  var state=read();
  apply(state); /* ① pre-paint */

  function isOn(type,key){return type==='cb'?state.cb===key:!!state[key];}
  function opt(type,key,label){
    return '<button class="a11y-opt" type="button" data-type="'+type+'" data-key="'+key+'" aria-pressed="'+isOn(type,key)+'">'+
      '<span>'+label+'</span><span class="a11y-state">'+(isOn(type,key)?'On':'Off')+'</span></button>';
  }

  function build(){
    if(document.getElementById('a11yFab'))return;

    var fab=document.createElement('button');
    fab.id='a11yFab';fab.type='button';fab.className='a11y-fab';
    fab.setAttribute('aria-label','Accessibility options');
    fab.setAttribute('aria-expanded','false');
    fab.setAttribute('aria-controls','a11yPanel');
    fab.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="3.6" r="1.7" fill="currentColor" stroke="none"/><path d="M3.5 7.5c2.8 1 5.4 1.4 8.5 1.4s5.7-.4 8.5-1.4"/><path d="M12 8.9V15m0 0l-3.2 5.5M12 15l3.2 5.5"/></svg>';
    document.body.appendChild(fab);

    var panel=document.createElement('div');
    panel.id='a11yPanel';panel.className='a11y-panel';
    panel.setAttribute('role','dialog');
    panel.setAttribute('aria-label','Accessibility options');
    panel.innerHTML=
      '<div class="a11y-panel-head"><span class="a11y-panel-title">Accessibility</span>'+
      '<button class="a11y-close" id="a11yClose" type="button" aria-label="Close accessibility options">&times;</button></div>'+
      '<div class="a11y-panel-sub">Adjust the site to suit how you see and read. Your choices are saved on this device.</div>'+
      '<div class="a11y-group-label">Colour-blind friendly</div>'+
      opt('cb','deut','Red-green · Deuteranopia')+
      opt('cb','prot','Red-green · Protanopia')+
      opt('cb','trit','Blue-yellow · Tritanopia')+
      '<div class="a11y-group-label">Vision &amp; reading</div>'+
      opt('flag','contrast','High contrast')+
      opt('flag','bigtext','Bigger text')+
      opt('flag','readable','Readable font')+
      opt('flag','links','Highlight links')+
      opt('flag','motion','Reduce motion')+
      '<button class="a11y-reset" id="a11yReset" type="button">Reset all</button>';
    document.body.appendChild(panel);

    function refresh(){
      panel.querySelectorAll('.a11y-opt').forEach(function(b){
        var on=isOn(b.dataset.type,b.dataset.key);
        b.setAttribute('aria-pressed',on);
        b.querySelector('.a11y-state').textContent=on?'On':'Off';
      });
    }
    function openP(){panel.classList.add('open');fab.setAttribute('aria-expanded','true');var f=panel.querySelector('.a11y-opt');if(f)f.focus();}
    function closeP(){panel.classList.remove('open');fab.setAttribute('aria-expanded','false');}

    fab.addEventListener('click',function(){panel.classList.contains('open')?closeP():openP();});
    panel.addEventListener('click',function(e){
      var o=e.target.closest('.a11y-opt');
      if(o){
        var t=o.dataset.type,k=o.dataset.key;
        if(t==='cb')state.cb=(state.cb===k?null:k);else state[k]=!state[k];
        write(state);apply(state);refresh();return;
      }
      if(e.target.closest('#a11yReset')){state={};write(state);apply(state);refresh();return;}
      if(e.target.closest('#a11yClose')){closeP();fab.focus();}
    });
    document.addEventListener('keydown',function(e){if(e.key==='Escape'&&panel.classList.contains('open')){closeP();fab.focus();}});
    document.addEventListener('click',function(e){
      if(panel.classList.contains('open')&&!panel.contains(e.target)&&!fab.contains(e.target))closeP();
    });
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',build);
  else build();
})();
