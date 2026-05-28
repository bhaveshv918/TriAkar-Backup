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
      <a href="#" class="cart-btn" onclick="openCart();return false;">
        <svg width="17" height="17" viewBox="0 0 18 18" fill="none"><path d="M1 1h2.5l1.6 8h8.4l1.5-5.5H5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="7.5" cy="14.5" r="1.2" fill="currentColor"/><circle cx="13" cy="14.5" r="1.2" fill="currentColor"/></svg>
        Cart <span class="cart-badge" id="cartBadge">0</span>
      </a>
      <a href="/account.html" class="nav-shop">Login</a>
      <button class="nav-toggle" aria-label="Menu" aria-expanded="false"><span></span><span></span><span></span></button>
    </div>
  </div>
</nav>`;

window._DRAWER_HTML = `<nav class="nav-drawer"><form class="drawer-search" role="search" onsubmit="return window.taSearch(this);"><input type="search" name="q" placeholder="Search products…" aria-label="Search products" autocomplete="off"><button type="submit" aria-label="Search"><svg width="16" height="16" viewBox="0 0 18 18" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/><path d="M12.4 12.4L16 16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button></form><a href="/products.html">Shop</a><a href="/custom.html">Custom Order</a><a href="/stories.html">Our Stories</a><a href="/about.html">About</a><a href="/contact.html">Contact</a><a href="/track-order.html">Track Order</a></nav>`;

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
        <div class="foot-phone"><a href="tel:+919217555833">+91 92175 55833</a></div>
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
