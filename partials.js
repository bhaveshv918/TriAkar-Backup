/* TriAkar — Shared Partials v1
   Defines NAV, DRAWER and FOOTER HTML as globals.
   Each page loads this synchronously then injects via tiny inline scripts,
   so nav/footer appear before first paint — zero flash. */

window._NAV_HTML = `<nav class="main-nav" id="mainNav">
  <div class="nav-inner">
    <a href="/index.html" class="logo">
      <span class="logo-en"><span style="color:var(--accent)">TRI</span>AKAR</span>
      <span class="logo-hi">त्रिआकार</span>
    </a>
    <ul class="nav-links"><li><a href="/products.html">Shop</a></li><li><a href="/custom.html">Custom Order</a></li><li><a href="/stories.html">Our Stories</a></li><li><a href="/about.html">About</a></li><li><a href="/contact.html">Contact</a></li><li><a href="/track-order.html">Track Order</a></li></ul>
    <div class="nav-right">
      <form class="nav-search" role="search" onsubmit="return window.taSearch(this);">
        <input type="search" id="navSearchInput" name="q" placeholder="Search products…" aria-label="Search products" autocomplete="off">
        <button type="submit" aria-label="Search"><svg width="15" height="15" viewBox="0 0 18 18" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/><path d="M12.4 12.4L16 16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button>
      </form>
      <a href="/wishlist.html" class="wishlist-btn" aria-label="Wishlist">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>
        <span class="wishlist-badge" id="wishlistBadge">0</span>
      </a>
      <a href="/custom.html" class="nav-corp" aria-label="Corporate or bulk order">Corporate Order →</a>
      <a href="#" class="cart-btn" onclick="openCart();return false;">
        <svg width="17" height="17" viewBox="0 0 18 18" fill="none"><path d="M1 1h2.5l1.6 8h8.4l1.5-5.5H5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="7.5" cy="14.5" r="1.2" fill="currentColor"/><circle cx="13" cy="14.5" r="1.2" fill="currentColor"/></svg>
        Cart <span class="cart-badge" id="cartBadge">0</span>
      </a>
      <a href="/account.html" class="nav-shop">Login</a>
      <button class="nav-toggle" aria-label="Menu" aria-expanded="false"><span></span><span></span><span></span></button>
    </div>
  </div>
</nav>`;

window._DRAWER_HTML = `<nav class="nav-drawer"><form class="drawer-search" role="search" onsubmit="return window.taSearch(this);"><input type="search" name="q" placeholder="Search products…" aria-label="Search products" autocomplete="off"><button type="submit" aria-label="Search"><svg width="16" height="16" viewBox="0 0 18 18" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/><path d="M12.4 12.4L16 16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button></form><a href="/products.html">Shop</a><a href="/custom.html">Custom Order</a><a href="/custom.html">Corporate Order</a><a href="/wishlist.html">Wishlist</a><a href="/stories.html">Our Stories</a><a href="/about.html">About</a><a href="/contact.html">Contact</a><a href="/track-order.html">Track Order</a></nav>`;

/* Site-wide product search — used by nav + drawer search forms */
window.taSearch = function(form){
  var i = form.querySelector('input');
  var q = (i && i.value || '').trim();
  if(!q){ if(i) i.focus(); return false; }
  window.location.href = '/products.html?search=' + encodeURIComponent(q);
  return false;
};

window._FOOTER_HTML = `<footer>
  <div class="mw">
    <div class="foot-grid">
      <div>
        <div class="foot-brand"><span style="color:var(--accent)">TRI</span><span style="color:#ffffff">AKAR</span></div>
        <div class="foot-hi">त्रिआकार</div>
        <p class="foot-desc">3D Printing Services, Delhi NCR</p>
        <div class="foot-phone"><a href="tel:+919217555833">+91 9217-555-833</a></div>
        <div class="foot-hours">Open all days, 11 AM to 9 PM</div>
        <div class="foot-addr">Shop No. 25, Karan Singh Market<br>Chhoti Milak, Greater Noida West, UP – 201318</div>
        <a href="https://maps.google.com/?q=TRIAKAR+Karan+Singh+Market+Chhoti+Milak+Greater+Noida+West+201318" class="foot-dir" target="_blank">Get Directions →</a>
      </div>
      <div><div class="foot-col-t">Shop</div>
        <ul class="foot-links">
          <li><a href="/products.html">All Products</a></li>
          <li><a href="/products.html?cat=desk">Desk</a></li>
          <li><a href="/products.html?cat=home">Home</a></li>
          <li><a href="/products.html?cat=gifting">Gifting</a></li>
          <li><a href="/custom.html">Custom Order</a></li>
          <li><a href="/stories.html">Stories</a></li>
          <li><a href="/services/replacement-parts.html">Replacement Parts</a></li>
          <li><a href="/services/corporate-gifting.html">Corporate Gifting</a></li>
          <li><a href="/services/personalized-gifts.html">Personalized Gifts</a></li>
        </ul>
      </div>
      <div><div class="foot-col-t">Help</div>
        <ul class="foot-links">
          <li><a href="/contact.html">Contact Us</a></li>
          <li><a href="/track-order.html">Track Order</a></li>
          <li><a href="/refund-policy.html">Refund Policy</a></li>
          <li><a href="/about.html">About</a></li>
          <li><a href="/custom.html">Custom Order</a></li>
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
      <p class="foot-tag">Serving Delhi NCR: Noida, Greater Noida, Faridabad, Gurugram, Delhi. Shipping across India.</p>
    </div>
  </div>
</footer>`;

/* ════════════════════════════════════════════════════════════════════
   F1 — TOP CONTACT BAR (two lines, site-wide)
   Line 1: phone + WhatsApp + "Bulk / Corporate Order?"  (desktop only)
   Line 2: rotating notice carousel (3 messages, 3s fade)
   Supersedes any per-page .notice-bar (hidden via injected CSS = no flash).
   ════════════════════════════════════════════════════════════════════ */
(function(){
  var WA='https://wa.me/919217555833?text='+encodeURIComponent('Hi TriAkar! I have a question.');
  var NOTES=[
    'Free shipping above ₹999 across India',
    'Custom 3D printing — your design, made in Greater Noida',
    'Noida pickup available · Open 11 AM–9 PM, all days'
  ];
  /* Inject CSS first (head exists during parse) so per-page .notice-bar
     is hidden before it paints — prevents a double-bar flash. */
  try{
    var head=document.head||document.getElementsByTagName('head')[0];
    if(head && !document.getElementById('taTopbarCSS')){
      var st=document.createElement('style');st.id='taTopbarCSS';
      st.textContent=
        '.notice-bar{display:none!important}'+
        '.ta-topbar{font-family:var(--font-b,inherit);background:var(--charcoal,#161614);color:var(--ivory,#F4F2EC)}'+
        '.ta-topbar-l1{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:6px 20px;font-size:11px;letter-spacing:.02em;border-bottom:1px solid rgba(255,255,255,.08)}'+
        '.ta-topbar-l1 a{color:var(--ivory,#F4F2EC);text-decoration:none;opacity:.85;transition:opacity .2s}'+
        '.ta-topbar-l1 a:hover{opacity:1}'+
        '.ta-topbar-l1 .ttb-left{display:flex;align-items:center;gap:18px}'+
        '.ta-topbar-l1 .ttb-corp{color:var(--accent,#C4622A);font-weight:600;letter-spacing:.06em;text-transform:uppercase;font-size:10px;opacity:1}'+
        '.ta-topbar-l2{position:relative;height:30px;overflow:hidden;text-align:center}'+
        '.notice-carousel{position:relative;height:30px}'+
        '.notice-slide{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:11px;letter-spacing:.04em;color:var(--ivory,#F4F2EC);opacity:0;transition:opacity .6s ease}'+
        '.notice-slide.active{opacity:.92}'+
        /* nav-corp pill removed from the top nav to prevent crowding/collision — corporate CTA lives in the top contact bar (ttb-corp), footer, and mobile drawer */
        '.nav-corp{display:none!important}'+
        '.nav-corp:hover{background:var(--accent,#C4622A)}'+
        '@media(max-width:768px){.ta-topbar-l1{display:none}.nav-corp{display:none}}';
      head.appendChild(st);
    }
  }catch(_){}

  function build(){
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
   PWA — manifest link, theme-color, and service-worker registration.
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
        var t=document.createElement('meta');t.name='theme-color';t.content='#161614';head.appendChild(t);
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
    window.addEventListener('load',function(){
      navigator.serviceWorker.register('/sw.js').catch(function(){});
    });
  }
})();

/* ════════════════════════════════════════════════════════════════════
   MOBILE BOTTOM NAV — app-style tab bar, shown only on small screens.
   Cart/wishlist badges reuse the .cart-badge/.wishlist-badge classes so
   shared.js keeps them in sync automatically.
   ════════════════════════════════════════════════════════════════════ */
(function(){
  function build(){
    if(document.getElementById('taBottomNav'))return;
    /* Product detail has its own sticky mobile buy-bar; skip the tab bar there */
    if(document.getElementById('mobileBuyBar'))return;
    var path=(location.pathname||'').toLowerCase();
    function on(names){return names.some(function(n){return path===n||path.endsWith('/'+n);});}
    var isHome=on(['','/','index.html'])||path==='/';
    var isShop=on(['products.html','product-detail.html']);
    var isWish=on(['wishlist.html']);
    var isAcct=on(['account.html']);

    var nav=document.createElement('nav');
    nav.id='taBottomNav';nav.className='ta-bottomnav';
    nav.setAttribute('aria-label','Primary');
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
      '<a href="/account.html" class="tabn-item'+(isAcct?' active':'')+'" aria-label="Account">'+
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.6"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/></svg>'+
        '<span>Account</span></a>';
    document.body.appendChild(nav);
    document.body.classList.add('has-bottomnav');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',build);
  else build();
})();

/* ════════════════════════════════════════════════════════════════════
   ACCESSIBILITY WIDGET — site-wide
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
