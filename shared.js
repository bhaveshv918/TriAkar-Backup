/* TRIAKAR shared.js v7, Full Order Flow + Supabase */

/* Image optimiser, defined in partials.js; this no-op shim guards against
   load-order issues so bare taImg(url) never throws. */
if (typeof window !== 'undefined' && typeof window.taImg !== 'function') {
  window.taImg = function (u) { return u || ''; };
}
var taImg = window.taImg;

/* ── FIX #12: HTML escape helper, use for all user-supplied data in innerHTML ── */
function _esc(s){
  if(s===null||s===undefined)return'';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

/* ── Auto-load address-autocomplete.js if not already present ── */
(function(){
  if(typeof window.AddressAC!=='undefined')return;
  const s=document.createElement('script');
  // derive base path relative to this script tag
  const scripts=[...document.querySelectorAll('script[src]')];
  const self=scripts.find(sc=>sc.src.includes('shared.js'));
  const base=self?self.src.replace(/shared\.js.*/,''):(window.location.origin+'/');
  s.src=base+'js/address-autocomplete.js';
  document.head.appendChild(s);
})();

/* ── Supabase Client (lazy-loaded, not fetched until actually needed) ── */
const SUPABASE_URL='https://qarjbmogersuaerkhlcu.supabase.co';
const SUPABASE_ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhcmpibW9nZXJzdWFlcmtobGN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMDMzNzMsImV4cCI6MjA5NDU3OTM3M30.iS7VcO9j9UjlmBN0EhhuWBOu6Vvrg8-SQrb3oZ25AIs';
const _SB_CDN='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.0';
let _sb=null, _sbLoadPromise=null;

function getSB(){
  if(_sb)return _sb;
  if(window.supabase&&window.supabase.createClient){
    _sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON);
  }
  return _sb;
}

/* Returns a Promise<SupabaseClient|null>.
   Dynamically injects the CDN script the first time it is needed,
   so pages that never use Supabase features pay zero download cost. */
function _ensureSB(){
  var existing=getSB();
  if(existing)return Promise.resolve(existing);
  if(_sbLoadPromise)return _sbLoadPromise;
  _sbLoadPromise=new Promise(function(resolve){
    var s=document.createElement('script');
    s.src=_SB_CDN;
    s.onload=function(){
      if(window.supabase&&window.supabase.createClient){
        _sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON);
      }
      resolve(_sb);
    };
    s.onerror=function(){resolve(null);};
    document.head.appendChild(s);
  });
  return _sbLoadPromise;
}

/* ── Safe GA4 analytics helper ──────────────────────────── */
function gtagEvent(name, params){ try{ if(typeof window!=='undefined' && typeof window.gtag==='function'){ window.gtag('event', name, params||{}); } }catch(_){} }

/* ── Scroll-to-top button ────────────────────────────────── */
(function(){
  const btn=document.createElement('button');
  btn.className='scroll-top';btn.setAttribute('aria-label','Back to top');
  btn.innerHTML='<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 11V3M3 7l4-4 4 4"/></svg>';
  document.body.appendChild(btn);
  /* rAF-throttled: raw scroll events can fire many times per frame
     (trackpad/momentum scroll), classList.toggle is cheap but there's no
     reason to run it more than once per paint. */
  let sttTicking=false;
  window.addEventListener('scroll',()=>{
    if(sttTicking)return;
    sttTicking=true;
    requestAnimationFrame(()=>{sttTicking=false;btn.classList.toggle('show',window.scrollY>300);});
  },{passive:true});

  // Fast eased scroll, 320ms ease-out (much snappier than native smooth)
  btn.addEventListener('click',function(){
    const start=window.scrollY;
    const startTime=performance.now();
    const duration=Math.min(320, Math.max(160, start*0.18)); // scales with distance
    function easeOut(t){return 1-(1-t)*(1-t);}
    function step(now){
      const elapsed=now-startTime;
      const progress=Math.min(elapsed/duration,1);
      window.scrollTo(0, start*(1-easeOut(progress)));
      if(progress<1)requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  });
})();

/* ── Nav scroll + mobile drawer ─────────────────────────── */
(function(){
  const toggle=document.querySelector('.nav-toggle');
  const drawer=document.querySelector('.nav-drawer');
  /* Same real SVG-refraction glass as the mobile bottom nav (see
     partials.js), applied to the top nav's floating "scrolled" capsule.
     Gated to actual Safari (window.TA_GLASS_SAFARI, set in partials.js):
     every other engine has to re-rasterize this filter every scroll frame
     over a full-width fixed element, which was the main source of the
     "laggy navbar" jank on desktop Chrome/Edge/Firefox and Android, not
     just Android as previously assumed. Those engines fall back to the
     much cheaper plain blur below. */
  var isGlassSafari=!!window.TA_GLASS_SAFARI; /* already excludes low-power devices, see partials.js */
  var isLowPower=!!window.TA_LOW_POWER;

  var navEl=null,ticking=false,wasScrolled=false,distortTimer=null,offsetTimer=null;
  var firstRun=true,morphRafId=0,morphEndTime=0;

  /* The filter sidebar / sticky filter bar on the shop page reserve a
     fixed top offset (var(--header-offset), see shared.css) sized for the
     tall pre-scroll header. Once the header shrinks into its floating
     capsule that reserved space is wrong (too big or too small depending
     on breakpoint) and content can overlap the header. Measuring the
     nav's real rendered bottom edge and writing it into the CSS var keeps
     the two in sync regardless of exact geometry at any screen size. */
  function updateHeaderOffset(){
    if(!navEl)return;
    var bottom=navEl.getBoundingClientRect().bottom;
    document.documentElement.style.setProperty('--header-offset',Math.max(0,bottom+12)+'px');
  }

  /* Runs updateHeaderOffset() on its own rAF chain for the duration of the
     .45s top/left/right/height/border-radius morph, then stops. The nav's
     real geometry only changes during that window, measuring it on every
     scroll-driven tick forever (the old behaviour) meant a forced
     getBoundingClientRect() + style write on every single scroll frame of
     the page's life, long after the shape had settled. will-change is
     applied only for the same window so the compositor layer promotion
     isn't held open indefinitely either. */
  function runMorphUpdates(){
    updateHeaderOffset();
    if(performance.now()<morphEndTime){
      morphRafId=requestAnimationFrame(runMorphUpdates);
    }else{
      morphRafId=0;
      navEl.classList.remove('nav-morphing');
    }
  }
  function startMorph(){
    if(isLowPower){
      /* Low-power devices collapse the shape morph to an instant CSS swap
         (see html.low-power in shared.css), so there's no top/left/right/
         height transition in flight to track and no reason to hold open
         the will-change layer promotion for 480ms. One measurement is
         enough, matching the firstRun path above. */
      updateHeaderOffset();
      return;
    }
    navEl.classList.add('nav-morphing');
    morphEndTime=performance.now()+480; /* covers the .45s shape transition + margin */
    if(!morphRafId) morphRafId=requestAnimationFrame(runMorphUpdates);
  }

  function applyScrollState(){
    ticking=false;
    if(!navEl){
      navEl=document.querySelector('.main-nav');
      if(!navEl)return;
    }
    var s=window.scrollY>10;
    navEl.classList.toggle('scrolled',s);
    document.documentElement.classList.toggle('is-scrolled',s); /* slides the top notice bar away on scroll */

    if(firstRun){
      /* Page can load already scrolled (anchor link, browser restoring
         scroll position). No transition is in flight yet, one measurement
         is enough, no need for the morph rAF chain. */
      firstRun=false;
      wasScrolled=s;
      updateHeaderOffset();
      return;
    }

    if(s!==wasScrolled){
      wasScrolled=s;
      clearTimeout(distortTimer);
      if(s){
        /* Let the shape morph into the capsule on plain blur first (cheap),
           only add the expensive SVG-refraction filter once that .45s
           transition has settled, recomputing feDisplacementMap on the
           same frame the box is also resizing/repositioning is the
           single biggest source of the scroll-start jank. */
        if(isGlassSafari) distortTimer=setTimeout(function(){navEl.classList.add('nav-distort');},460);
      }else{
        navEl.classList.remove('nav-distort');
      }
      startMorph();
    }
  }

  /* rAF-throttled: raw scroll events can fire far more often than the
     screen refreshes, especially on trackpads/momentum scroll. Without
     this, every single one of those events re-queried the DOM and wrote
     to two classLists, throttling to once per frame is what actually
     removes the "sometimes laggy" hitch right as scrolling starts. */
  window.addEventListener('scroll',function(){
    if(!ticking){ticking=true;requestAnimationFrame(applyScrollState);}
  },{passive:true});
  window.addEventListener('resize',function(){
    clearTimeout(offsetTimer);
    offsetTimer=setTimeout(updateHeaderOffset,150);
  },{passive:true});

  /* Sync immediately on load too, not just on the next scroll event, a
     page can load already scrolled (an anchor link, or the browser
     restoring scroll position on refresh/back-navigation), and without
     this the header/sidebar state wouldn't be correct until the user
     scrolled again. Called directly rather than via requestAnimationFrame:
     rAF callbacks are deferred/throttled by the browser for background or
     not-yet-visible tabs, which would leave --header-offset unset for an
     unpredictable stretch right when it matters most (first paint). */
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',applyScrollState);}
  else{applyScrollState();}
  if(toggle&&drawer){
    toggle.addEventListener('click',()=>{
      const o=drawer.classList.toggle('open');
      toggle.classList.toggle('open',o);
      toggle.setAttribute('aria-expanded',o);
      document.documentElement.classList.toggle('drawer-open',o);
      if(navEl) navEl.style.top = o ? '0' : '';
    });
    const closeDrawer=()=>{
      drawer.classList.remove('open');toggle.classList.remove('open');
      toggle.setAttribute('aria-expanded','false');
      document.documentElement.classList.remove('drawer-open');
      if(navEl) navEl.style.top = '';
    };
    drawer.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeDrawer));
    /* Tap on the dim scrim (anywhere outside the panel/nav) closes the menu */
    document.addEventListener('click',e=>{
      if(!document.documentElement.classList.contains('drawer-open'))return;
      if(e.target.closest('.nav-drawer')||e.target.closest('.main-nav'))return;
      closeDrawer();
    });
    const openDrawer=()=>{
      drawer.classList.add('open');toggle.classList.add('open');
      toggle.setAttribute('aria-expanded','true');
      document.documentElement.classList.add('drawer-open');
    };
    /* App-style swipe gestures (phones only):
       a left-to-right swipe anywhere on the page opens the menu;
       a right-to-left swipe (outside the panel) closes it. Swipes that
       start inside a horizontal scroller/carousel are ignored so
       product rows keep scrolling normally. */
    const inHScroll=el=>{
      for(let n=el;n&&n!==document.body&&n.nodeType===1;n=n.parentElement){
        const cs=getComputedStyle(n);
        if((cs.overflowX==='auto'||cs.overflowX==='scroll')&&n.scrollWidth>n.clientWidth+8)return true;
      }
      return false;
    };
    let swX=0,swY=0,swOK=false,swOpen=false;
    document.addEventListener('touchstart',e=>{
      swOK=false;
      if(window.innerWidth>768)return;
      const t=e.touches[0];
      swX=t.clientX;swY=t.clientY;
      swOpen=document.documentElement.classList.contains('drawer-open');
      swOK=!e.target.closest('.nav-drawer')&&!inHScroll(e.target);
    },{passive:true});
    document.addEventListener('touchend',e=>{
      if(!swOK||window.innerWidth>768)return;
      swOK=false;
      const t=e.changedTouches[0];
      const dx=t.clientX-swX,dy=t.clientY-swY;
      if(Math.abs(dy)>60||Math.abs(dx)<70)return;
      if(!swOpen&&dx>0)openDrawer();
      else if(swOpen&&dx<0)closeDrawer();
    },{passive:true});
  }
})();

/* ── Nav overflow guard ─────────────────────────────────
   The header row's content width is not knowable up front: login swaps in
   a "Hi, <name>" chip of arbitrary length, and the scrolled glass capsule
   narrows the bar independently of the viewport. So no fixed media-query
   breakpoint can guarantee the row fits. The bar is flex-wrap:nowrap
   (shared.css), meaning it can never wrap to a second row and overlap the
   page; if the single row genuinely overflows sideways, this guard flips
   the header into the compact hamburger layout (html.nav-compact, the twin
   of the <=1200px media query).
   Anti-flicker: on failure we record the width the full layout needed
   (scrollWidth), and only retry it once the bar is actually wider than
   that, so it can't oscillate at the boundary. Because a measurement taken
   mid-load can be transiently wrong and would then stick, the settled
   moments (window load, web fonts ready) force an unconditional
   re-evaluation instead of trusting the recorded value. classList changes
   reflow synchronously, so a failed retry re-compacts before paint and is
   never visible. */
(function(){
  var doc=document.documentElement,inner=null,needed=0,raf=0;
  function ensureInner(){
    if(!inner)inner=document.querySelector('.main-nav .nav-inner');
    return !!inner;
  }
  function fits(){return inner.scrollWidth<=inner.clientWidth+1;}
  function engage(){needed=inner.scrollWidth;doc.classList.add('nav-compact');}
  function check(){
    raf=0;
    if(!ensureInner())return;
    if(doc.classList.contains('nav-compact')){
      if(inner.clientWidth>needed+8)revalidate();
    }else if(!fits()){
      engage();
    }
  }
  function revalidate(){
    if(!ensureInner())return;
    doc.classList.remove('nav-compact');
    if(!fits())engage();
  }
  function queue(){if(!raf)raf=requestAnimationFrame(check);}
  function start(){
    check();
    window.addEventListener('resize',queue,{passive:true});
    /* Authoritative re-evaluations once layout has truly settled: all
       resources loaded, and web fonts swapped in (both change widths). */
    if(document.readyState==='complete')revalidate();
    else window.addEventListener('load',function(){revalidate();});
    if(document.fonts&&document.fonts.ready)document.fonts.ready.then(function(){revalidate();});
    var nav=document.querySelector('.main-nav');
    if(nav){
      /* Re-check when the nav's content or state changes: the auth code
         swaps Login for the profile chip after render, badges appear, and
         the .scrolled class starts the morph into the narrower capsule. */
      if(window.MutationObserver){
        new MutationObserver(queue).observe(nav,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
      }
      /* The capsule morph animates left/right over .45s, the bar's final
         width only exists after the transition ends, so measure again then. */
      nav.addEventListener('transitionend',queue);
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);
  else start();
})();

/* ── Instant-feel navigation ─────────────────────────────
   Prefetch the primary tab/menu pages so tapping them skips the
   network round-trip (pairs with the CSS view transitions). */
(function(){
  try{
    if(!(window.HTMLScriptElement&&HTMLScriptElement.supports&&HTMLScriptElement.supports('speculationrules')))return;
    var s=document.createElement('script');
    s.type='speculationrules';
    s.textContent=JSON.stringify({prefetch:[{urls:[
      '/index.html','/products.html','/wishlist.html','/account.html','/order.html'
    ]}]});
    document.head.appendChild(s);
  }catch(_){}
})();

/* ── Nav active state (single source of truth) ──────────── */
function applyNavActiveState(){
  // Works for both clean URLs (/about) and .html URLs (/about.html)
  const path=window.location.pathname.toLowerCase();
  let file=(path.split('/').pop()||'').replace(/\.html$/,'');
  const PAGES={
    'products':'products.html',
    'product-detail':'products.html',
    'order':'order.html', // the nav/footer "Customization" link points to order.html, not custom.html
    'custom':'custom.html',
    'stories':'stories.html',
    'about':'about.html',
    'contact':'contact.html',
    'track-order':'track-order.html'
  };
  const match=PAGES[file]||'';   // '' for index / home → no active item

  document.querySelectorAll('.nav-links a,.nav-drawer a').forEach(a=>{
    a.classList.remove('active','nav-active');
    if(!match)return;
    const href=(a.getAttribute('href')||'').toLowerCase();
    // Exact filename match, not substring, 'track-order.html' contains
    // 'order.html' as a substring, which used to false-match Customization's
    // active state onto Track Order too.
    const hrefFile=href.split('/').pop().split('?')[0].split('#')[0];
    if(hrefFile===match){
      a.classList.add('nav-active');
    }
  });
}

/* ── Scroll reveal ──────────────────────────────────────── */
(function(){
  const obs=new IntersectionObserver(entries=>entries.forEach(e=>{
    if(e.isIntersecting){e.target.classList.add('on');obs.unobserve(e.target)}
  }),{threshold:.05,rootMargin:'0px 0px -24px 0px'});
  document.querySelectorAll('.r').forEach(el=>obs.observe(el));
})();

/* ══ CART ════════════════════════════════════════════════════ */
const Cart=(function(){
  const _API=window.location.hostname==='localhost'?'http://localhost:3000':'https://triakar.onrender.com';
  const CART_KEY='triakar_cart';
  let items=[];
  try{
    const raw=JSON.parse(localStorage.getItem(CART_KEY)||localStorage.getItem('ta_cart')||'[]');
    items=raw.map(i=>({id:i.id,name:i.name,price:i.price,quantity:i.quantity||i.qty||1,color:i.color||i.variant||'',image:i.image||i.img||'',customization:i.customization||null,type:i.type||null,instant_quote_id:i.instant_quote_id||null}));
    /* Dedup on load, cleans any dupes that accumulated from the color
       normalisation bug (undefined vs '' mismatch in add()).  Later entries
       are dropped; quantities are preserved on the first entry. */
    var _seen=new Set();
    items=items.filter(function(i){var k=i.id+'|'+(i.color||'')+'|'+_custKey(i.customization||null);if(_seen.has(k))return false;_seen.add(k);return true;});
    if(localStorage.getItem('ta_cart')){localStorage.removeItem('ta_cart');try{localStorage.setItem(CART_KEY,JSON.stringify(items))}catch(e){}}
  }catch(e){items=[]}

  function _syncServer(){
    const tok=localStorage.getItem('ta_token');
    if(!tok)return;
    fetch(_API+'/api/cart',{method:'PUT',headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok},body:JSON.stringify({items})}).catch(()=>{});
  }

  function save(){try{localStorage.setItem(CART_KEY,JSON.stringify(items))}catch(e){}badge();_syncServer();}
  function badge(){const n=items.reduce((s,i)=>s+i.quantity,0);document.querySelectorAll('.cart-badge').forEach(b=>{b.textContent=n;b.classList.toggle('on',n>0)})}
  // Build a stable match key from id + color + customization values
  function _custKey(cust){if(!cust||!Object.keys(cust).length)return '';return JSON.stringify(cust);}
  function add(p){
    const ck=_custKey(p.customization||null);
    const nc=p.color||''; /* normalise, storage always uses '' not undefined */
    const idx=items.findIndex(i=>i.id===p.id&&i.color===nc&&_custKey(i.customization||null)===ck);
    if(idx>-1){
      items[idx].quantity++;
      if(!items[idx].image&&p.image)items[idx].image=p.image;
    }else{
      items.push({id:p.id,name:p.name,price:p.price,quantity:1,color:p.color||'',image:p.image||'',customization:p.customization||null});
    }
    save();render();openCart();
  }
  // Instant Quote cart items carry the server-computed price + quote id (never a
  // client-editable price) and use the existing customization-block UI to show the
  // chosen printer/material/infill, so no new cart-rendering markup is needed.
  function addInstantQuote(q){
    const iid='iq-'+q.instant_quote_id;
    const idx=items.findIndex(i=>i.id===iid);
    if(idx>-1){ items[idx].quantity+=(q.quantity||1); }
    else{
      items.push({
        id:iid, type:'instant_quote', instant_quote_id:q.instant_quote_id,
        name:q.name, price:q.price, quantity:q.quantity||1, color:'', image:q.image||'',
        customization:{Printer:q.printer||'', Material:q.material||'', Infill:(q.infill!=null?q.infill+'%':'')},
      });
    }
    save();render();openCart();
  }
  function changeQty(id,color,d,custKey){
    const nc=color||'';
    const idx=items.findIndex(i=>i.id===id&&i.color===nc&&(custKey===undefined||_custKey(i.customization||null)===custKey));
    if(idx<0)return;items[idx].quantity+=d;if(items[idx].quantity<=0)items.splice(idx,1);save();render();
  }
  function remove(id,color,custKey){
    const nc=color||'';
    const idx=items.findIndex(i=>i.id===id&&i.color===nc&&(custKey===undefined||_custKey(i.customization||null)===custKey));
    if(idx<0)return;items.splice(idx,1);save();render();
  }
  function total(){return items.reduce((s,i)=>s+i.price*i.quantity,0)}
  function getItems(){return[...items]}
  function clear(){items=[];save();render()}

  async function loadFromServer(){
    const tok=localStorage.getItem('ta_token');
    if(!tok)return;
    try{
      const res=await fetch(_API+'/api/cart',{headers:{'Authorization':'Bearer '+tok}});
      if(!res.ok)return;
      const {items:srv}=await res.json();
      if(srv&&srv.length){items=srv.map(i=>({id:i.id,name:i.name,price:i.price,quantity:i.quantity||i.qty||1,color:i.color||i.variant||'',image:i.image||i.img||'',customization:i.customization||null,type:i.type||null,instant_quote_id:i.instant_quote_id||null}));try{localStorage.setItem(CART_KEY,JSON.stringify(items))}catch(e){}}
      badge();render();
    }catch(_){}
  }

  // Called right after a successful login. Merges the guest (local) cart
  // with the server cart so nothing the user added while logged out is
  // lost, then persists the merged result back to the server.
  async function mergeOnLogin(){
    const tok=localStorage.getItem('ta_token');
    if(!tok)return;
    let srv=[];
    try{
      const res=await fetch(_API+'/api/cart',{headers:{'Authorization':'Bearer '+tok}});
      if(res.ok){const j=await res.json();srv=(j&&j.items)||[];}
    }catch(_){return;}
    (srv||[]).forEach(function(s){
      const sid=s.id,scolor=s.color||s.variant||'',sq=s.quantity||s.qty||1,scust=s.customization||null;
      const ck=_custKey(scust);
      const idx=items.findIndex(i=>i.id===sid&&i.color===scolor&&_custKey(i.customization||null)===ck);
      if(idx>-1){
        items[idx].quantity=items[idx].quantity+sq;
        if(!items[idx].image&&(s.image||s.img))items[idx].image=s.image||s.img;
      }else{
        items.push({id:sid,name:s.name,price:s.price,quantity:sq,color:scolor,image:s.image||s.img||'',customization:scust,type:s.type||null,instant_quote_id:s.instant_quote_id||null});
      }
    });
    save(); // persists locally + pushes merged cart to server
    render();
  }

  async function _enrichImages(){
    const missing=items.filter(function(i){return !i.image;});
    if(!missing.length)return false;
    try{
      const res=await fetch(_API+'/api/products');
      if(!res.ok)return false;
      const json=await res.json();
      const prods=json.products||json;
      if(!prods||!prods.length)return false;
      const imgMap={};
      prods.forEach(function(p){if(p.images&&p.images.length)imgMap[p.slug]=p.images[0];});
      let changed=false;
      items.forEach(function(i){
        if(!i.image&&imgMap[i.id]){i.image=imgMap[i.id];changed=true;}
      });
      if(changed){try{localStorage.setItem(CART_KEY,JSON.stringify(items));}catch(e){}}
      return changed;
    }catch(e){return false;}
  }

  function _renderCartItems(el){
    /* Event delegation, set up once per container element, survives innerHTML
       rebuilds. Reads id/color/ck from data-* attributes so no quoting issues. */
    if(!el._taCartBound){
      el._taCartBound=true;
      el.addEventListener('click',function(e){
        var btn=e.target.closest('[data-action]');
        if(!btn)return;
        var act=btn.dataset.action,id=btn.dataset.id,col=btn.dataset.color||'',ck=btn.dataset.ck;
        if(act==='minus') changeQty(id,col,-1,ck);
        else if(act==='plus') changeQty(id,col,1,ck);
        else if(act==='remove') remove(id,col,ck);
      });
    }
    el.innerHTML=items.map(item=>{
      const ckRaw=_custKey(item.customization||null);
      const custHtml=item.customization&&Object.keys(item.customization).length
        ?'<div class="ci-cust">'+Object.entries(item.customization).map(([k,v])=>`<span><b>${_esc(k)}:</b> ${_esc(v)}</span>`).join('')+'</div>'
        :'';
      /* data-* stores id/color/ck safely, no JS quoting inside HTML attributes */
      const da=`data-id="${_esc(item.id)}" data-color="${_esc(item.color||'')}" data-ck="${_esc(ckRaw)}"`;
      return`<div class="cart-item">
        <div class="ci-img">${item.image
          ?`<img src="${_esc(taImg(item.image,{w:120}))}" alt="${_esc(item.name)}" width="56" height="56" loading="eager" decoding="sync" style="width:56px;height:56px;object-fit:cover;border-radius:3px;display:block">`
          :`<svg viewBox="0 0 56 56" fill="none" style="width:32px"><rect x="6" y="6" width="44" height="44" rx="3" fill="#E8E4DC"/></svg>`}</div>
        <div style="flex:1;min-width:0"><div class="ci-name">${_esc(item.name)}</div><div class="ci-var">${_esc(item.color||'')}</div>
          ${custHtml}
          <div class="ci-qty">
            <button class="ci-qbtn" data-action="minus" ${da} aria-label="Decrease quantity">−</button>
            <span class="ci-qn">${item.quantity}</span>
            <button class="ci-qbtn" data-action="plus" ${da} aria-label="Increase quantity">+</button>
          </div>
        </div>
        <div class="ci-right">
          <div class="ci-price">₹${(item.price*item.quantity).toLocaleString('en-IN')}</div>
          <button class="ci-rm" data-action="remove" ${da} aria-label="Remove item"><svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M2 2l10 10M12 2L2 12"/></svg></button>
        </div>
      </div>`;
    }).join('');
  }

  const FREE_SHIP_MIN=999;
  function _renderShipProgress(){
    const foot=document.querySelector('.cart-foot');
    if(!foot)return;
    let bar=foot.querySelector('.cart-ship-progress');
    if(!items.length){ if(bar)bar.style.display='none'; return; }
    if(!bar){
      bar=document.createElement('div');
      bar.className='cart-ship-progress';
      bar.innerHTML='<div class="csp-msg"></div><div class="csp-track"><div class="csp-fill"></div></div>';
      foot.insertBefore(bar,foot.firstChild);
    }
    bar.style.display='';
    const t=total();
    const remaining=Math.max(0,FREE_SHIP_MIN-t);
    const pct=Math.min(100,Math.round(t/FREE_SHIP_MIN*100));
    const msg=bar.querySelector('.csp-msg');
    const fill=bar.querySelector('.csp-fill');
    if(remaining>0){
      msg.innerHTML='Add <strong>₹'+remaining.toLocaleString('en-IN')+'</strong> more for <strong>free shipping</strong>';
      bar.classList.remove('done');
    }else{
      msg.innerHTML='You’ve unlocked <strong>free shipping</strong> ✓';
      bar.classList.add('done');
    }
    if(fill)fill.style.width=pct+'%';
  }

  function render(){
    const el=document.getElementById('cartItemsList');
    const tot=document.getElementById('cartTotal');
    if(!el)return;
    if(tot)tot.textContent='₹'+total().toLocaleString('en-IN');
    if(!items.length){
      el.innerHTML='<div class="cart-empty">'
        +'<svg viewBox="0 0 48 48" width="46" height="46" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8h4l3 22h22l4-15H14"/><circle cx="18" cy="38" r="2.4"/><circle cx="34" cy="38" r="2.4"/></svg>'
        +'<div class="cart-empty-t">Your cart is empty</div>'
        +'<div class="cart-empty-s">Discover design objects, made fresh in India.</div>'
        +'<a href="/products.html" class="btn btn-dark cart-empty-cta" onclick="closeCart()">Browse products →</a>'
        +'</div>';
      _renderShipProgress();
      return;
    }
    _renderCartItems(el);
    _renderShipProgress();
    // Async-enrich any items missing images, then re-render
    if(items.some(i=>!i.image)){
      _enrichImages().then(changed=>{if(changed)_renderCartItems(el);});
    }
  }
  return{add,addInstantQuote,changeQty,remove,total,getItems,clear,render,badge,loadFromServer,mergeOnLogin,_enrichImages};
})();

/* ══ WISHLIST ════════════════════════════════════════════════
   Per-user saved items. Works offline (localStorage) and syncs to
   /api/wishlist when logged in. Toggling a heart adds/removes both
   locally and server-side; on login the local list is merged up. */
const Wishlist=(function(){
  const _API=window.location.hostname==='localhost'?'http://localhost:3000':'https://triakar.onrender.com';
  const WL_KEY='triakar_wishlist';
  let items=[]; // [{slug,name}]
  try{
    const raw=JSON.parse(localStorage.getItem(WL_KEY)||'[]');
    if(Array.isArray(raw))items=raw.filter(x=>x&&x.slug).map(x=>({slug:String(x.slug),name:x.name||''}));
  }catch(e){items=[]}

  function _token(){return localStorage.getItem('ta_token');}
  function _saveLocal(){try{localStorage.setItem(WL_KEY,JSON.stringify(items))}catch(e){}}
  function has(slug){return items.some(i=>i.slug===slug);}
  function getItems(){return items.map(i=>({slug:i.slug,name:i.name}));}
  function count(){return items.length;}

  function badge(){
    const n=items.length;
    document.querySelectorAll('.wishlist-badge').forEach(b=>{b.textContent=n;b.classList.toggle('on',n>0);});
  }
  function _paintHearts(){
    document.querySelectorAll('.wl-heart[data-slug]').forEach(el=>{
      const on=has(el.getAttribute('data-slug'));
      el.classList.toggle('active',on);
      el.setAttribute('aria-pressed',on?'true':'false');
      el.setAttribute('aria-label',on?'Remove from wishlist':'Add to wishlist');
    });
  }
  function refresh(){badge();_paintHearts();}

  function _serverAdd(slug,name){
    const tok=_token();if(!tok)return;
    fetch(_API+'/api/wishlist',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok},body:JSON.stringify({product_slug:slug,product_name:name})}).catch(()=>{});
  }
  function _serverRemove(slug){
    const tok=_token();if(!tok)return;
    fetch(_API+'/api/wishlist/'+encodeURIComponent(slug),{method:'DELETE',headers:{'Authorization':'Bearer '+tok}}).catch(()=>{});
  }

  function add(slug,name){
    if(!slug||has(slug))return;
    items.push({slug:String(slug),name:name||''});
    _saveLocal();_serverAdd(slug,name||'');refresh();
    gtagEvent('add_to_wishlist',{items:[{item_id:slug,item_name:name||''}]});
  }
  function remove(slug){
    const i=items.findIndex(x=>x.slug===slug);
    if(i<0)return;
    items.splice(i,1);
    _saveLocal();_serverRemove(slug);refresh();
  }
  function toggle(slug,name){
    if(has(slug)){remove(slug);return false;}
    add(slug,name);return true;
  }

  async function loadFromServer(){
    const tok=_token();if(!tok)return;
    try{
      const res=await fetch(_API+'/api/wishlist',{headers:{'Authorization':'Bearer '+tok}});
      if(!res.ok)return;
      const {items:srv}=await res.json();
      if(Array.isArray(srv)){
        items=srv.map(x=>({slug:x.product_slug,name:x.product_name||''}));
        _saveLocal();
      }
      refresh();
    }catch(_){}
  }

  // After login: push any guest items the server doesn't have, then reload.
  async function mergeOnLogin(){
    const tok=_token();if(!tok)return;
    let srv=[];
    try{
      const res=await fetch(_API+'/api/wishlist',{headers:{'Authorization':'Bearer '+tok}});
      if(res.ok){const j=await res.json();srv=(j&&j.items)||[];}
    }catch(_){return;}
    const srvSlugs=new Set(srv.map(s=>s.product_slug));
    items.forEach(i=>{if(!srvSlugs.has(i.slug))_serverAdd(i.slug,i.name);});
    await loadFromServer();
  }

  return{add,remove,toggle,has,getItems,count,badge,refresh,loadFromServer,mergeOnLogin};
})();

/* Toggle handler for heart buttons. Pass the clicked element so its
   pressed state updates instantly. Element must carry data-slug + data-name. */
/* Footer "Stay inspired" email capture — see partials.js _FOOTER_HTML */
function taNewsletterSignup(form){
  var btn=form.querySelector('button');
  var input=form.querySelector('input[type="email"]');
  var email=(input&&input.value||'').trim();
  if(!email)return false;
  var prevLabel=btn.textContent;
  btn.disabled=true;btn.textContent='...';
  var _API=window.location.hostname==='localhost'?'http://localhost:3000':'https://triakar.onrender.com';
  fetch(_API+'/api/newsletter',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email})})
    .then(function(r){return r.json().then(function(d){return {ok:r.ok,data:d};});})
    .then(function(res){
      if(res.ok){
        form.innerHTML='<span class="foot-news-ok">Thanks, you\'re on the list.</span>';
      }else{
        btn.disabled=false;btn.textContent=prevLabel;
        input.setCustomValidity(res.data&&res.data.error||'Something went wrong');
        input.reportValidity();
        input.oninput=function(){input.setCustomValidity('');};
      }
    })
    .catch(function(){btn.disabled=false;btn.textContent=prevLabel;});
  return false;
}

function toggleWishlist(el){
  if(!el)return;
  const slug=el.getAttribute('data-slug');
  const name=el.getAttribute('data-name')||'';
  if(!slug)return;
  Wishlist.toggle(slug,name);
  /* heart pop animation */
  if(el.classList.contains('wl-heart')){el.classList.remove('pop');void el.offsetWidth;el.classList.add('pop');}
}

function openCart(){
  document.getElementById('cartSidebar')?.classList.add('open');
  document.getElementById('cartOverlay')?.classList.add('open');
  Cart.render();
  // Always try to enrich images when cart opens, catches items loaded from localStorage
  Cart._enrichImages().then(changed=>{
    if(changed){
      const el=document.getElementById('cartItemsList');
      if(el)Cart.render();
    }
  });
}
function closeCart(){document.getElementById('cartSidebar')?.classList.remove('open');document.getElementById('cartOverlay')?.classList.remove('open')}

/* ══ ADD TO CART BUTTON HELPER ═════════════════════════════ */
function addToCartBtn(btnEl,product){
  if(!product)return;
  Cart.add({id:product.id,name:product.name,price:product.price,color:product.color||'',image:product.image||product.img||''});
  gtagEvent('add_to_cart',{currency:'INR',value:product.price,items:[{item_id:product.id,item_name:product.name,price:product.price}]});
  /* feedback: toast + cart-badge bounce */
  if(window.showToast) showToast((product.name||'Item')+' added to cart','success');
  document.querySelectorAll('.cart-badge,.tabn-badge').forEach(function(b){b.classList.remove('pop');void b.offsetWidth;b.classList.add('pop');});
  if(!btnEl)return;
  // Guard against re-trigger while in "Added" state
  if(btnEl.dataset.adding==='1')return;
  btnEl.dataset.adding='1';
  const original=btnEl.dataset.label||btnEl.textContent||'Add to Cart';
  btnEl.dataset.label=original;
  btnEl.textContent='Added ✓';
  btnEl.classList.add('added');
  setTimeout(function(){
    btnEl.textContent=btnEl.dataset.label||'Add to Cart';
    btnEl.classList.remove('added');
    btnEl.dataset.adding='0';
  },1500);
}

/* ══ INDIAN STATES LIST ════════════════════════════════════ */
const INDIAN_STATES=[
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana',
  'Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur',
  'Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana',
  'Tripura','Uttar Pradesh','Uttarakhand','West Bengal',
  'Andaman & Nicobar','Chandigarh','Dadra & Nagar Haveli','Daman & Diu','Delhi',
  'Jammu & Kashmir','Ladakh','Lakshadweep','Puducherry'
];

/* ══ SEARCHABLE DROPDOWN ═══════════════════════════════════ */
function initSearchableDropdown(wrap){
  const input=wrap.querySelector('.sd-input');
  const dropdown=wrap.querySelector('.sd-dropdown');
  const search=wrap.querySelector('.sd-search');
  const options=wrap.querySelectorAll('.sd-option');
  let allOptions=[...options];

  input.addEventListener('click',()=>{dropdown.classList.toggle('open');if(dropdown.classList.contains('open')&&search)search.focus()});
  document.addEventListener('click',(e)=>{if(!wrap.contains(e.target))dropdown.classList.remove('open')});

  if(search){
    search.addEventListener('input',()=>{
      const q=search.value.toLowerCase();
      allOptions.forEach(o=>{o.style.display=o.textContent.toLowerCase().includes(q)?'':'none'});
    });
  }
  allOptions.forEach(o=>{
    o.addEventListener('click',()=>{
      input.value=o.textContent;
      input.dataset.value=o.dataset.value||o.textContent;
      allOptions.forEach(x=>x.classList.remove('selected'));
      o.classList.add('selected');
      dropdown.classList.remove('open');
    });
  });
}

/* ══ TRK ORDER ID GENERATOR ═══════════════════════════════ */
// FIX #21: added millisecond timestamp + 4 more random hex chars to drastically reduce collision risk
function generateTRKId(){
  const d=new Date();
  const yyyy=d.getFullYear();
  const mm=String(d.getMonth()+1).padStart(2,'0');
  const dd=String(d.getDate()).padStart(2,'0');
  // ms since midnight (0–86399999) encoded as base-36 (up to 5 chars) + 4 random hex chars
  const ms=d.getHours()*3600000+d.getMinutes()*60000+d.getSeconds()*1000+d.getMilliseconds();
  const msPart=ms.toString(36).toUpperCase().padStart(5,'0');
  const rndPart=Math.floor(Math.random()*0x10000).toString(16).toUpperCase().padStart(4,'0');
  return 'TRK-'+yyyy+mm+dd+'-'+msPart+rndPart;
}

/* ══ PINCODE AUTO-FILL ════════════════════════════════════ */
// Strategy (in order):
//   1. Nominatim postalcode=, OSM postcode endpoint. Parses ISO3166-2-lvl4
//      because postalcode= responses never include address.state directly.
//   2. /api/pincode/:pin, our own server proxy to India Post
//      (api.postalpincode.in SSL cert expired; server bypasses it).
//   3. {unavailable:true}, soft warning, user fills manually. Never blocks.

// ISO 3166-2 India → canonical state name
const _ISO_STATE={
  'IN-AP':'Andhra Pradesh','IN-AR':'Arunachal Pradesh','IN-AS':'Assam',
  'IN-BR':'Bihar','IN-CT':'Chhattisgarh','IN-GA':'Goa','IN-GJ':'Gujarat',
  'IN-HR':'Haryana','IN-HP':'Himachal Pradesh','IN-JH':'Jharkhand',
  'IN-KA':'Karnataka','IN-KL':'Kerala','IN-MP':'Madhya Pradesh',
  'IN-MH':'Maharashtra','IN-MN':'Manipur','IN-ML':'Meghalaya',
  'IN-MZ':'Mizoram','IN-NL':'Nagaland','IN-OD':'Odisha','IN-OR':'Odisha',
  'IN-PB':'Punjab','IN-RJ':'Rajasthan','IN-SK':'Sikkim','IN-TN':'Tamil Nadu',
  'IN-TG':'Telangana','IN-TR':'Tripura','IN-UP':'Uttar Pradesh',
  'IN-UT':'Uttarakhand','IN-WB':'West Bengal',
  'IN-AN':'Andaman & Nicobar','IN-CH':'Chandigarh',
  'IN-DH':'Dadra & Nagar Haveli','IN-DN':'Dadra & Nagar Haveli',
  'IN-DD':'Daman & Diu','IN-DL':'Delhi','IN-JK':'Jammu & Kashmir',
  'IN-LA':'Ladakh','IN-LD':'Lakshadweep','IN-PY':'Puducherry',
};

const _PIN_API=window.location.hostname==='localhost'
  ?'http://localhost:3000'
  :'https://triakar.onrender.com';

async function lookupPincode(pin){
  if(!/^\d{6}$/.test(pin))return{unavailable:true};

  // ── 1. Nominatim postalcode= ──
  // NOTE: postalcode= responses return ISO3166-2-lvl4 (e.g. "IN-DL"), NOT address.state.
  try{
    const ctrl=new AbortController();
    const t=setTimeout(()=>ctrl.abort(),6000);
    const res=await fetch(
      'https://nominatim.openstreetmap.org/search?postalcode='+pin+'&countrycodes=in&format=jsonv2&addressdetails=1&limit=5',
      {signal:ctrl.signal,headers:{'Accept-Language':'en'}}
    );
    clearTimeout(t);
    if(res.ok){
      const data=await res.json();
      if(data&&data[0]){
        const a=data[0].address||{};
        // postalcode= endpoint: state comes via ISO3166-2-lvl4, not address.state
        const isoCode=a['ISO3166-2-lvl4']||a['ISO3166-2-lvl6']||'';
        const stateRaw=a.state||a.state_district||_ISO_STATE[isoCode]||'';
        const state=_normaliseState(stateRaw);
        if(state){
          const district=a.county||a.city_district||a.state_district||'';
          const city=a.city||a.town||a.village||a.municipality||district||'';
          return{city,district,state};
        }
      }
    }
  }catch(e){/* fall through to server proxy */}

  // ── 2. Our server proxy → India Post (bypasses expired SSL cert) ──
  try{
    const ctrl2=new AbortController();
    const t2=setTimeout(()=>ctrl2.abort(),7000);
    const res2=await fetch(_PIN_API+'/api/pincode/'+pin,{signal:ctrl2.signal});
    clearTimeout(t2);
    if(res2.ok){
      const d=await res2.json();
      if(d&&d.state){
        return{city:d.city||'',district:d.district||'',state:_normaliseState(d.state)};
      }
    }
  }catch(e){/* both failed */}

  return{unavailable:true};
}

// State name normaliser, handles all Indian states/UTs plus common OSM/India Post variants
function _normaliseState(raw){
  if(!raw)return'';
  const map={
    // 28 States
    'andhra pradesh':'Andhra Pradesh',
    'arunachal pradesh':'Arunachal Pradesh',
    'assam':'Assam',
    'bihar':'Bihar',
    'chhattisgarh':'Chhattisgarh','chattisgarh':'Chhattisgarh',
    'goa':'Goa',
    'gujarat':'Gujarat',
    'haryana':'Haryana',
    'himachal pradesh':'Himachal Pradesh',
    'jharkhand':'Jharkhand',
    'karnataka':'Karnataka','karnataka state':'Karnataka',
    'kerala':'Kerala',
    'madhya pradesh':'Madhya Pradesh',
    'maharashtra':'Maharashtra',
    'manipur':'Manipur',
    'meghalaya':'Meghalaya',
    'mizoram':'Mizoram',
    'nagaland':'Nagaland',
    'odisha':'Odisha','orissa':'Odisha',
    'punjab':'Punjab',
    'rajasthan':'Rajasthan',
    'sikkim':'Sikkim',
    'tamil nadu':'Tamil Nadu','tamilnadu':'Tamil Nadu',
    'telangana':'Telangana','telegana':'Telangana',
    'tripura':'Tripura',
    'uttar pradesh':'Uttar Pradesh','u.p.':'Uttar Pradesh','up':'Uttar Pradesh',
    'uttarakhand':'Uttarakhand','uttaranchal':'Uttarakhand',
    'west bengal':'West Bengal',
    // 8 UTs
    'andaman & nicobar':'Andaman & Nicobar',
    'andaman and nicobar':'Andaman & Nicobar',
    'andaman and nicobar islands':'Andaman & Nicobar',
    'andaman & nicobar islands':'Andaman & Nicobar',
    'chandigarh':'Chandigarh',
    'dadra & nagar haveli':'Dadra & Nagar Haveli',
    'dadra and nagar haveli':'Dadra & Nagar Haveli',
    'dadra & nagar haveli and daman & diu':'Dadra & Nagar Haveli',
    'dadra and nagar haveli and daman and diu':'Dadra & Nagar Haveli',
    'daman & diu':'Daman & Diu','daman and diu':'Daman & Diu','daman':'Daman & Diu',
    'delhi':'Delhi',
    'national capital territory of delhi':'Delhi',
    'nct of delhi':'Delhi','nct':'Delhi',
    'new delhi':'Delhi',
    'jammu & kashmir':'Jammu & Kashmir',
    'jammu and kashmir':'Jammu & Kashmir',
    'j&k':'Jammu & Kashmir','j & k':'Jammu & Kashmir',
    'ladakh':'Ladakh',
    'lakshadweep':'Lakshadweep',
    'puducherry':'Puducherry','pondicherry':'Puducherry','pudducherry':'Puducherry',
  };
  return map[raw.toLowerCase().trim()]||raw;
}

/* ══ PIN CODE AUTOFILL HELPER ═════════════════════════════ */
// Attaches smart PIN autofill to any pincode input.
// Shows: ✓ green (auto-filled) | ⚠ yellow (API down, fill manually) | nothing for < 6 digits
// NEVER blocks the user, format check (6 digits, no leading 0) is the only gate.
function attachPincodeAutofill(pinId, infoId, cityId, districtId, stateId, stateWrapId){
  const pinEl=document.getElementById(pinId);
  if(!pinEl)return;
  let _lastPin='';
  pinEl.addEventListener('input',async function(){
    const val=this.value.replace(/\D/g,'').slice(0,6);
    this.value=val; // strip non-digits live
    const infoEl=document.getElementById(infoId);
    if(!infoEl)return;
    if(val.length<6){infoEl.innerHTML='';_lastPin='';return;}
    if(val===_lastPin)return;
    _lastPin=val;
    // Show spinner
    infoEl.innerHTML='<span style="color:var(--stone,#888)">⟳ Looking up PIN…</span>';
    const info=await lookupPincode(val);
    if(info&&!info.unavailable){
      // Success, always overwrite city, district, state from fresh PIN lookup
      const cityEl=document.getElementById(cityId);
      const distEl=document.getElementById(districtId);
      const stateEl=document.getElementById(stateId);
      if(cityEl&&info.city)cityEl.value=info.city;
      if(distEl&&info.district)distEl.value=info.district;
      if(stateEl&&info.state){
        stateEl.value=info.state;
        stateEl.dataset.value=info.state;
        // Sync the searchable dropdown visible input and selection
        const wrap=document.getElementById(stateWrapId);
        if(wrap){
          const sdInp=wrap.querySelector('.sd-input');
          if(sdInp)sdInp.value=info.state;
          wrap.querySelectorAll('.sd-option').forEach(o=>{
            o.classList.toggle('selected',o.textContent.trim()===info.state||o.dataset.value===info.state);
          });
        }
        // Fire change so any listeners (validation, etc.) pick up the new value
        stateEl.dispatchEvent(new Event('change',{bubbles:true}));
      }
      infoEl.innerHTML='<span style="color:#15803d">✓ '+(info.district||info.city||'')+', '+info.state+'</span>';
    } else {
      // API down or PIN not in its DB, never an error, just let user fill
      infoEl.innerHTML='<span style="color:var(--stone,#888)">⚠ Could not auto-fill, please enter city &amp; state manually</span>';
    }
  });
}

/* ══ SAVED ADDRESSES (Supabase) ═══════════════════════════ */
async function loadSavedAddresses(){
  const sb=await _ensureSB();
  if(!sb)return[];
  const user=(typeof Auth!=='undefined'&&Auth.getUser)?Auth.getUser():null;
  if(!user)return[];
  try{
    const {data,error}=await sb.from('user_addresses').select('*').eq('user_id',user.id).order('is_default',{ascending:false});
    if(error)throw error;
    return data||[];
  }catch(e){return[]}
}

/* ══ CHECKOUT, ORDER FORM MODAL ═══════════════════════════ */
/* Strict login gate, no login = no checkout */
function isLoggedInStrict(){
  const token=localStorage.getItem('ta_token');
  const user=localStorage.getItem('ta_user');
  if(!token||!user)return false;
  if(token.trim()===''||user.trim()===''||user==='null'||token==='null')return false;
  return true;
}

function checkout(){
  const items=Cart.getItems();
  if(!items.length)return;

  if(!isLoggedInStrict()){
    closeCart();
    document.body.style.overflow='';
    sessionStorage.setItem('after_login','checkout');
    const msg=document.createElement('div');
    msg.textContent='Please login to continue checkout';
    msg.style.cssText='position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#0F0F0D;color:#fff;padding:16px 28px;border-radius:8px;font-size:15px;z-index:99999;font-family:inherit;box-shadow:0 4px 20px rgba(0,0,0,.3)';
    document.body.appendChild(msg);
    setTimeout(function(){
      msg.remove();
      window.location.href='account.html?next=checkout';
    },500);
    return;
  }

  closeCart();
  gtagEvent('begin_checkout',{currency:'INR',value:Cart.total()});
  window.location.href='checkout.html';
}


/* Resume checkout after login redirect */
document.addEventListener('DOMContentLoaded',function(){
  if(sessionStorage.getItem('after_login')==='checkout'){
    if(isLoggedInStrict()&&Cart.getItems().length){
      sessionStorage.removeItem('after_login');
      window.location.href='checkout.html';
    }else{
      sessionStorage.removeItem('after_login');
    }
  }
});


/* WhatsApp floating button, disabled per request */

/* ══ SITE-WIDE SEARCH OVERLAY ══════════════════════════════ */
(function(){
  let _built = false, _data = null, _loading = null, _activeIdx = -1, _results = [];

  function _api(){
    return (window.location.hostname === 'localhost')
      ? 'http://localhost:3000' : 'https://triakar.onrender.com';
  }

  function _normLocal(){
    if (typeof window.PRODUCTS === 'undefined') return null;
    return Object.entries(window.PRODUCTS).map(function(e){
      const slug = e[0], p = e[1];
      const cdn = (typeof window.getProductImage === 'function') ? window.getProductImage(p) : null;
      return { slug: slug, name: p.name, price: p.price, category: p.category,
        desc: p.short_description || p.description || '',
        image: cdn || p.image || '' };
    });
  }

  function _loadData(){
    if (_data) return Promise.resolve(_data);
    if (_loading) return _loading;
    const local = _normLocal();
    if (local && local.length) _data = local; // instant fallback
    _loading = fetch(_api() + '/api/products')
      .then(function(r){ if(!r.ok) throw 0; return r.json(); })
      .then(function(d){
        const ps = d && d.products;
        if (ps && ps.length){
          _data = ps.map(function(p){
            return { slug: p.slug, name: p.name, price: p.price, category: p.category,
              desc: p.short_description || p.description || '',
              image: (p.images && p.images.length) ? p.images[0] : '' };
          });
        }
        return _data;
      })
      .catch(function(){ return _data; });
    return local && local.length ? Promise.resolve(_data) : _loading;
  }

  function _build(){
    if (_built) return;
    _built = true;
    const ov = document.createElement('div');
    ov.className = 'ta-search-ov';
    ov.id = 'taSearchOv';
    ov.innerHTML =
      '<div class="ta-search-box" role="dialog" aria-modal="true" aria-label="Search products">'
      + '<div class="ta-search-head">'
      + '<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/><path d="M12.4 12.4L16 16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>'
      + '<input type="search" id="taSearchInput" placeholder="Search products…" aria-label="Search products" autocomplete="off">'
      + '<button class="ta-search-esc" type="button" aria-label="Close search">Esc</button>'
      + '</div>'
      + '<div class="ta-search-results" id="taSearchResults"></div>'
      + '</div>';
    ov.addEventListener('click', function(e){ if (e.target === ov) closeSearch(); });
    document.body.appendChild(ov);
    ov.querySelector('.ta-search-esc').addEventListener('click', closeSearch);
    const inp = ov.querySelector('#taSearchInput');
    inp.addEventListener('input', function(){ _render(inp.value); });
    inp.addEventListener('keydown', _onKey);
    _loadData();
  }

  function _render(q){
    const box = document.getElementById('taSearchResults');
    if (!box) return;
    q = (q || '').trim().toLowerCase();
    _activeIdx = -1;
    if (!q){
      _results = [];
      box.innerHTML = '<div class="ta-search-empty">Start typing to search the catalog.</div>';
      return;
    }
    const data = _data || [];
    _results = data.filter(function(p){
      return ((p.name||'') + ' ' + (p.desc||'') + ' ' + (p.category||'')).toLowerCase().indexOf(q) !== -1;
    }).slice(0, 8);
    if (!_results.length){
      box.innerHTML = '<div class="ta-search-empty">No products match “' + _esc(q) + '”.</div>';
      return;
    }
    box.innerHTML = _results.map(function(p, i){
      const img = p.image
        ? '<img src="' + _esc(taImg(p.image, {w:96})) + '" alt="" loading="lazy" decoding="async">'
        : '<span class="ta-sr-noimg"></span>';
      return '<a class="ta-search-item" data-i="' + i + '" href="product-detail.html?slug=' + encodeURIComponent(p.slug) + '">'
        + '<span class="ta-sr-img">' + img + '</span>'
        + '<span class="ta-sr-txt"><span class="ta-sr-name">' + _esc(p.name) + '</span>'
        + '<span class="ta-sr-cat">' + _esc(p.category || '') + '</span></span>'
        + '<span class="ta-sr-price">₹' + Number(p.price).toLocaleString('en-IN') + '</span></a>';
    }).join('')
      + '<button class="ta-search-all" type="button" onclick="window.location.href=\'/products.html?search=\'+encodeURIComponent(document.getElementById(\'taSearchInput\').value.trim())">See all results →</button>';
  }

  function _onKey(e){
    if (e.key === 'Escape'){ closeSearch(); return; }
    const items = _results.length;
    if (e.key === 'ArrowDown'){ e.preventDefault(); _activeIdx = Math.min(_activeIdx + 1, items - 1); _highlight(); }
    else if (e.key === 'ArrowUp'){ e.preventDefault(); _activeIdx = Math.max(_activeIdx - 1, -1); _highlight(); }
    else if (e.key === 'Enter'){
      if (_activeIdx >= 0 && _results[_activeIdx]){
        window.location.href = 'product-detail.html?slug=' + encodeURIComponent(_results[_activeIdx].slug);
      } else {
        const v = e.target.value.trim();
        if (v) window.location.href = '/products.html?search=' + encodeURIComponent(v);
      }
    }
  }

  function _highlight(){
    const els = document.querySelectorAll('.ta-search-item');
    els.forEach(function(el, i){ el.classList.toggle('active', i === _activeIdx); });
    if (_activeIdx >= 0 && els[_activeIdx]) els[_activeIdx].scrollIntoView({ block: 'nearest' });
  }

  window.openSearch = function(prefill){
    _build();
    _loadData();
    const ov = document.getElementById('taSearchOv');
    const inp = document.getElementById('taSearchInput');
    ov.classList.add('open');
    document.body.style.overflow = 'hidden';
    if (typeof prefill === 'string' && prefill) inp.value = prefill;
    _render(inp.value);
    setTimeout(function(){ inp.focus(); }, 30);
  };

  window.closeSearch = function(){
    const ov = document.getElementById('taSearchOv');
    if (ov) ov.classList.remove('open');
    document.body.style.overflow = '';
  };

  // "/" keyboard shortcut (ignore when typing in a field)
  document.addEventListener('keydown', function(e){
    if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    const tag = t && t.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
    e.preventDefault();
    window.openSearch();
  });

  // Spacebar shortcut, same overlay. Unlike "/", space has a native action
  // on lots of focused elements (activates a button, ticks a checkbox,
  // scrolls the page), so this only fires when nothing is actually focused,
  // not just when the focused thing isn't a text field.
  document.addEventListener('keydown', function(e){
    if (e.code !== 'Space' || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    const t = e.target;
    const tag = t && t.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' || tag === 'A'
      || (t && t.isContentEditable)
      || (t && typeof t.closest === 'function' && t.closest('[role="button"],[role="link"],[tabindex]'))) return;
    e.preventDefault();
    window.openSearch();
  });

  // Hook nav/drawer search inputs to open the overlay on focus
  document.addEventListener('DOMContentLoaded', function(){
    document.querySelectorAll('.nav-search input, .drawer-search input').forEach(function(inp){
      inp.addEventListener('focus', function(e){
        e.preventDefault();
        inp.blur();
        window.openSearch(inp.value);
      });
    });
  });
})();

/* ══ CALLBACK MODAL ════════════════════════════════════════ */
function openCallbackModal(){
  let ov=document.getElementById('cbOverlay');
  if(!ov){
    ov=document.createElement('div');
    ov.id='cbOverlay';
    ov.className='cb-overlay';
    ov.innerHTML=`
    <div class="cb-modal">
      <button class="cb-close" onclick="closeCallbackModal()">&times;</button>
      <h3 style="font-size:17px;font-weight:700;margin-bottom:16px">Request a Callback</h3>
      <div class="ck-field"><label>Your Name *</label><input type="text" id="cbName"></div>
      <div class="ck-field"><label>Phone Number *</label><input type="tel" id="cbPhone" required></div>
      <div class="ck-field"><label>Topic</label>
        <select id="cbTopic" style="width:100%;padding:10px 12px;border:1px solid var(--stone-p);font-family:var(--font-b);font-size:14px">
          <option>Custom order</option><option>Replacement part</option><option>Corporate gifting</option><option>Other</option>
        </select>
      </div>
      <div class="ck-field"><label>Best Time to Call</label>
        <select id="cbTime" style="width:100%;padding:10px 12px;border:1px solid var(--stone-p);font-family:var(--font-b);font-size:14px">
          <option>Morning 11 AM – 1 PM</option><option>Afternoon 1 PM – 5 PM</option><option>Evening 5 PM – 9 PM</option>
        </select>
      </div>
      <div id="cbInlineMsg" style="display:none;margin-top:12px"></div>
      <button class="btn btn-magnetic" id="cbSubmitBtn" style="width:100%;margin-top:14px" onclick="submitCallback()">Send Request →</button>
    </div>`;
    document.body.appendChild(ov);
  }
  ov.classList.add('open');
  setTimeout(function(){initPhoneField('cbPhone')},50);
}
function closeCallbackModal(){document.getElementById('cbOverlay')?.classList.remove('open')}

/* Generate a 12-char-style callback reference id: TRK-CALL-YYYYMMDD-XXXX */
function generateCallbackRef(){
  const d=new Date();
  const yyyy=d.getFullYear();
  const mm=String(d.getMonth()+1).padStart(2,'0');
  const dd=String(d.getDate()).padStart(2,'0');
  const rand=String(Math.floor(1000+Math.random()*9000));
  return 'TRK-CALL-'+yyyy+mm+dd+'-'+rand;
}

/* Resilient Supabase insert for callback_requests, retries with minimal columns
   if the full row fails (e.g. missing columns in schema). */
async function _insertCallbackResilient(payload){
  const sb=await _ensureSB();
  if(!sb)return{ok:false,error:'Supabase unavailable'};
  try{
    const {error}=await sb.from('callback_requests').insert([payload]);
    if(!error)return{ok:true};
    // Retry with minimum viable columns (name + phone only)
    const minimal={name:payload.name,phone:payload.phone};
    const r2=await sb.from('callback_requests').insert([minimal]);
    if(!r2.error)return{ok:true,degraded:true};
    return{ok:false,error:r2.error.message||error.message||'Insert failed'};
  }catch(e){
    return{ok:false,error:e&&e.message||'Insert threw'};
  }
}

/* Show inline success/error card inside the callback modal (no popup) */
function _renderCallbackInline(html,kind){
  const box=document.getElementById('cbInlineMsg');
  if(!box)return;
  const bg=kind==='error'?'rgba(185,28,28,.06)':'rgba(45,138,78,.06)';
  const border=kind==='error'?'#B91C1C':'#2D8A4E';
  box.style.cssText='display:block;margin-top:14px;padding:16px;border-radius:6px;background:'+bg+';border:1px solid '+border+';font-size:13px;line-height:1.6;color:var(--charcoal)';
  box.innerHTML=html;
}

/* Shared async submit, usable from anywhere (custom.html etc.) */
async function submitCallbackRequest(formData){
  const data=formData||{};
  const name=(data.name||'').trim();
  const phone=(data.phone||'').trim();
  const topic=(data.topic||'').trim();
  const preferred_time=(data.preferred_time||data.time||'').trim();
  if(!name||!phone)return{ok:false,error:'Name and phone required'};

  const reference_id=generateCallbackRef();
  const dbResult=await _insertCallbackResilient({
    reference_id,name,phone,topic,preferred_time,is_called:false
  });

  if(dbResult.ok){
    gtagEvent('generate_lead',{currency:'INR',value:0,lead_source:'callback'});
    // Best-effort, fire-and-forget owner notification, never blocks the WA + inline flow.
    try {
      const API = window.location.hostname==='localhost' ? 'http://localhost:3000' : 'https://triakar.onrender.com';
      fetch(API+'/api/notify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'callback',data:{reference_id:reference_id,name:name,phone:phone,topic:topic,preferred_time:preferred_time}})}).catch(function(){});
    } catch(_){}
  }

  // WhatsApp pre-filled message, KEEP existing behaviour
  const waMsg='*Callback Request*\n'
    +'*Ref:* '+reference_id+'\n'
    +'Name: '+name+'\n'
    +'Phone: '+phone+'\n'
    +(topic?'Topic: '+topic+'\n':'')
    +(preferred_time?'Best time: '+preferred_time+'\n':'');
  let waOpened=false;
  try{
    const win=window.open('https://wa.me/919217555833?text='+encodeURIComponent(waMsg),'_blank');
    waOpened=!!win;
  }catch(_){waOpened=false}

  return{
    ok:dbResult.ok||waOpened,
    saved:dbResult.ok,
    waOpened,
    reference_id,
    error:(!dbResult.ok&&!waOpened)?(dbResult.error||'Both Supabase save and WhatsApp failed'):null
  };
}

async function submitCallback(){
  const name=document.getElementById('cbName').value.trim();
  const phoneInp=document.getElementById('cbPhone');
  if(phoneInp&&phoneInp._validatePhone&&!phoneInp._validatePhone())return;
  const phone=document.getElementById('cbPhone').value.trim();
  const topic=document.getElementById('cbTopic').value;
  const time=document.getElementById('cbTime').value;
  if(!name||!phone){
    _renderCallbackInline('Please enter your name and phone number.','error');
    return;
  }
  const btn=document.getElementById('cbSubmitBtn');
  if(btn){btn.disabled=true;btn.textContent='Sending...'}
  const result=await submitCallbackRequest({name,phone,topic,preferred_time:time});
  if(btn){btn.disabled=false;btn.textContent='Send Request →'}

  if(result.ok){
    _renderCallbackInline(
      '<div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;font-weight:600;color:#2D8A4E;margin-bottom:6px">Request received</div>'
      +'<div style="font-size:18px;font-weight:700;color:var(--charcoal);letter-spacing:.04em;margin-bottom:8px">'+result.reference_id+'</div>'
      +'<div style="color:var(--warm)">Your callback request <strong>'+result.reference_id+'</strong> has been received. We will call you within business hours.</div>'
      +'<div style="margin-top:10px;font-size:12px;color:var(--stone)">📸 Take a screenshot of this number for future reference.</div>',
      'success'
    );
    if(btn)btn.style.display='none';
  }else{
    _renderCallbackInline(
      '<strong>We could not submit your request.</strong><br>'
      +(result.error||'Please try again, or call us directly at +91 9217-555-833.'),
      'error'
    );
  }
}

/* ══ COPY TO CLIPBOARD ═════════════════════════════════════ */
function copyAddress(){
  const addr='Shop No. 25, Karan Singh Market, Chhoti Milak, Greater Noida West, Gautam Buddha Nagar, UP – 201307';
  navigator.clipboard.writeText(addr).then(()=>{
    const btn=document.querySelector('.copy-btn');
    if(btn){const old=btn.textContent;btn.textContent='Copied!';setTimeout(()=>btn.textContent=old,2000)}
  });
}

/* ══ PROFILE CACHE HELPERS ═════════════════════════════════ */
/* Fetch fresh profile from API and store in localStorage ta_profile */
async function refreshProfileCache(){
  const token=localStorage.getItem('ta_token');
  if(!token)return null;
  const API=window.location.hostname==='localhost'?'http://localhost:3000':'https://triakar.onrender.com';
  try{
    const res=await fetch(API+'/api/auth/profile',{headers:{'Authorization':'Bearer '+token}});
    if(!res.ok)return null;
    const {profile}=await res.json();
    if(profile){
      localStorage.setItem('ta_profile',JSON.stringify(profile));
      return profile;
    }
  }catch(_){}
  return null;
}

function getProfileCache(){
  try{return JSON.parse(localStorage.getItem('ta_profile')||'null')}catch(_){return null}
}

/* Resolve best display name, priority: profile.nickname > first word of full_name > email prefix */
function resolveDisplayName(user,profile){
  if(profile&&profile.nickname&&profile.nickname.trim())return profile.nickname.trim();
  if(profile&&profile.full_name&&profile.full_name.trim())return profile.full_name.trim().split(' ')[0];
  const meta=user&&user.user_metadata||{};
  if(meta.nickname&&meta.nickname.trim())return meta.nickname.trim();
  if(meta.full_name&&meta.full_name.trim())return meta.full_name.trim().split(' ')[0];
  const email=user&&user.email||'';
  return email.split('@')[0]||'Account';
}

/* ══ NAV AUTH DROPDOWN ═════════════════════════════════════ */
function updateNavAuth(){
  document.querySelectorAll('.nav-auth-wrap,.nav-auth-link,.nav-login-btn').forEach(el=>{
    const p=el.parentElement;
    if(p&&p.tagName==='LI')p.remove(); else el.remove();
  });

  const user=(typeof Auth!=='undefined'&&Auth.getUser)?Auth.getUser():null;

  document.querySelectorAll('.nav-right').forEach(nr=>{
    const cartBtn=nr.querySelector('.cart-btn');
    if(!cartBtn)return;
    const shopBtn=nr.querySelector('.nav-shop');

    // FIX: save return URL so login can redirect back to this page
    if(!user&&shopBtn&&!shopBtn._retListenerAdded){
      shopBtn._retListenerAdded=true;
      shopBtn.addEventListener('click',function(){
        if(!location.href.includes('account.html'))
          sessionStorage.setItem('ta_return_url',location.href);
      });
    }

    if(user){
      if(shopBtn) shopBtn.style.display='none';
      // Use cached profile for nickname, refresh happens async after render
      const profile=getProfileCache();
      const displayName=resolveDisplayName(user,profile);
      const wrap=document.createElement('div');
      wrap.className='nav-auth-wrap';
      wrap.innerHTML=`
        <button class="nav-profile-btn" id="navProfileBtn">Hi, ${displayName} ▾</button>
        <div class="nav-profile-dropdown">
          <a href="account.html#orders">My Orders</a>
          <a href="account.html#profile">My Account</a>
          <button class="nav-logout-btn" id="navLogoutBtn">Logout</button>
        </div>`;
      nr.insertBefore(wrap,cartBtn);

      wrap.querySelector('.nav-profile-btn').addEventListener('click',function(e){
        e.stopPropagation();
        wrap.classList.toggle('open');
      });
      wrap.querySelector('#navLogoutBtn').addEventListener('click',function(){
        localStorage.removeItem('ta_profile');
        if(typeof Auth!=='undefined'&&Auth.logout)Auth.logout();
        else{localStorage.removeItem('ta_token');localStorage.removeItem('ta_user');window.location.href='index.html';}
      });

      // Async refresh profile, updates name if nickname changed
      refreshProfileCache().then(function(fresh){
        if(!fresh)return;
        const freshName=resolveDisplayName(user,fresh);
        const btn=document.getElementById('navProfileBtn');
        if(btn)btn.textContent='Hi, '+freshName+' ▾';
      });
    }
  });

  document.querySelectorAll('.nav-drawer').forEach(drawer=>{
    drawer.querySelectorAll('.drawer-auth,.drawer-shop').forEach(e=>e.remove());
    if(user){
      const btn=document.createElement('button');
      btn.className='drawer-auth drawer-signout';
      btn.textContent='Sign Out';
      btn.addEventListener('click',function(){
        if(typeof Auth!=='undefined'&&Auth.logout)Auth.logout();
        else{localStorage.removeItem('ta_token');localStorage.removeItem('ta_user');window.location.href='index.html';}
      });
      drawer.appendChild(btn);
    }else{
      const a=document.createElement('a');
      a.className='drawer-auth drawer-login';
      a.href='/account.html';
      a.textContent='Login';
      drawer.appendChild(a);
    }
  });

  // Always keep Cart as the last item before the hamburger toggle
  // so Login/Profile is always to the LEFT of Cart on every page
  document.querySelectorAll('.nav-right').forEach(function(nr){
    var toggle=nr.querySelector('.nav-toggle');
    var cart=nr.querySelector('.cart-btn');
    if(toggle&&cart)nr.insertBefore(cart,toggle);
  });

  document.addEventListener('click',function(){
    document.querySelectorAll('.nav-auth-wrap.open').forEach(w=>w.classList.remove('open'));
  });
}

/* ══ PHONE VALIDATION ═════════════════════════════════════ */
const PHONE_RULES={'+91':{len:10,label:'Indian'},'+1':{len:10,label:'US/Canada'},'+44':{len:10,label:'UK'},'+971':{len:9,label:'UAE'},'+61':{len:9,label:'Australia'},'+65':{len:8,label:'Singapore'},'+49':{len:10,label:'Germany'},'+974':{len:8,label:'Qatar'},'+966':{len:9,label:'Saudi Arabia'}};
const COUNTRY_CODES=['+91','+1','+44','+971','+61','+65','+49','+974','+966'];
const COUNTRY_DISPLAY={'+91':'🇮🇳 +91','+1':'🇺🇸 +1','+44':'🇬🇧 +44','+971':'🇦🇪 +971','+61':'🇦🇺 +61','+65':'🇸🇬 +65','+49':'🇩🇪 +49','+974':'🇶🇦 +974','+966':'🇸🇦 +966'};

function initPhoneField(inputId,options){
  const inp=document.getElementById(inputId);
  if(!inp||inp.dataset.phoneInit)return;
  inp.dataset.phoneInit='1';
  const wrap=inp.parentElement;

  // Create prefix + input layout
  const container=document.createElement('div');
  container.className='ta-phone-wrap';
  const prefix=document.createElement('select');
  prefix.className='ta-phone-prefix';
  prefix.id=inputId+'_cc';
  COUNTRY_CODES.forEach(c=>{const o=document.createElement('option');o.value=c;o.textContent=COUNTRY_DISPLAY[c]||c;prefix.appendChild(o)});
  const numInp=document.createElement('input');
  numInp.type='tel';numInp.className='ta-phone-num';
  numInp.id=inputId+'_num';
  numInp.placeholder='XXXXXXXXXX';
  numInp.required=inp.required;
  numInp.autocomplete='tel-national';
  numInp.setAttribute('inputmode','numeric');
  numInp.setAttribute('pattern','[0-9]*');

  const errDiv=document.createElement('div');
  errDiv.className='ta-phone-err';errDiv.id=inputId+'_err';

  // Hide original input, keep for form value
  inp.type='hidden';
  container.appendChild(prefix);
  container.appendChild(numInp);
  inp.parentElement.insertBefore(container,inp.nextSibling);
  inp.parentElement.appendChild(errDiv);

  // Sync hidden field
  function syncValue(){
    const cc=prefix.value;
    const num=numInp.value.replace(/\D/g,'');
    numInp.value=num;
    inp.value=num?cc+num:'';
  }

  // Validate
  function validate(){
    const cc=prefix.value;
    const num=numInp.value.replace(/\D/g,'');
    const rule=PHONE_RULES[cc]||{len:10};
    errDiv.textContent='';
    if(!num&&numInp.required){errDiv.textContent='Phone number is required.';return false}
    if(num&&num.length!==rule.len){
      errDiv.textContent=cc==='+91'
        ?'Please enter a valid 10-digit Indian mobile number.'
        :'Please enter a valid '+(rule.label||'')+' phone number ('+rule.len+' digits).';
      return false;
    }
    return true;
  }

  numInp.addEventListener('input',function(){
    this.value=this.value.replace(/\D/g,'');
    const cc=prefix.value;const rule=PHONE_RULES[cc]||{len:10};
    if(this.value.length>rule.len)this.value=this.value.slice(0,rule.len);
    syncValue();
    if(errDiv.textContent)validate();
  });
  prefix.addEventListener('change',function(){
    const rule=PHONE_RULES[this.value]||{len:10};
    numInp.maxLength=rule.len;
    numInp.placeholder='X'.repeat(rule.len);
    syncValue();validate();
  });
  numInp.addEventListener('blur',function(){if(numInp.value)validate()});

  // Handle autofill: if browser fills +91XXXXXXXXXX format
  const observer=new MutationObserver(()=>{checkAutofill()});
  function checkAutofill(){
    const v=(inp.value||numInp.value||'').trim();
    if(!v)return;
    for(const cc of COUNTRY_CODES){
      if(v.startsWith(cc)){
        prefix.value=cc;
        numInp.value=v.slice(cc.length).replace(/\D/g,'');
        syncValue();return;
      }
    }
    // Try +XX patterns
    const m=v.match(/^\+(\d{1,3})/);
    if(m){
      const found=COUNTRY_CODES.find(c=>v.startsWith(c));
      if(found){prefix.value=found;numInp.value=v.slice(found.length).replace(/\D/g,'');syncValue()}
      else{numInp.value=v.replace(/\D/g,'');syncValue()}
    }else{numInp.value=v.replace(/\D/g,'');syncValue()}
  }
  // Pre-populate if value exists
  if(inp.value)checkAutofill();
  setTimeout(checkAutofill,500);

  // Expose validate
  inp._validatePhone=validate;
  numInp._validatePhone=validate;
  return{validate,syncValue,prefix,numInp};
}

function validateAllPhones(container){
  const root=container||document;
  let valid=true;
  root.querySelectorAll('input[data-phone-init]').forEach(inp=>{
    if(inp._validatePhone&&!inp._validatePhone())valid=false;
  });
  return valid;
}

/* ══ IST TIMESTAMP FORMAT ═════════════════════════════════ */
function formatIST(date){
  if(!date)date=new Date();
  if(typeof date==='string')date=new Date(date);
  return date.toLocaleString('en-IN',{
    timeZone:'Asia/Kolkata',day:'numeric',month:'long',year:'numeric',
    hour:'numeric',minute:'2-digit',hour12:true
  });
}

/* ══ CHECKOUT PRE-FILL ════════════════════════════════════ */
// FIX #17: handle bare 10-digit numbers and sync visible phone component correctly
function prefillCheckout(){
  try{
    const user=JSON.parse(localStorage.getItem('ta_user'));
    if(!user)return;
    const nameEl=document.getElementById('ckName');
    const emailEl=document.getElementById('ckEmail');
    const phoneEl=document.getElementById('ckPhone'); // hidden after initPhoneField
    if(nameEl&&!nameEl.value&&user.user_metadata?.full_name)nameEl.value=user.user_metadata.full_name;
    if(emailEl&&!emailEl.value&&user.email)emailEl.value=user.email;
    // Only prefill if the visible number field is empty
    const numEl=document.getElementById('ckPhone_num');
    const ccEl=document.getElementById('ckPhone_cc');
    if(numEl&&!numEl.value&&user.user_metadata?.phone){
      let raw=String(user.user_metadata.phone).trim();
      // Normalise: strip leading zeros, detect country code
      let matched=false;
      for(const cc of COUNTRY_CODES){
        if(raw.startsWith(cc)){ccEl.value=cc;numEl.value=raw.slice(cc.length).replace(/\D/g,'');matched=true;break}
      }
      if(!matched){
        // Bare digits (e.g. Indian 10-digit stored without +91)
        const digits=raw.replace(/\D/g,'');
        if(digits.length===10){ccEl.value='+91';numEl.value=digits;}
        else if(digits.length===12&&digits.startsWith('91')){ccEl.value='+91';numEl.value=digits.slice(2);}
        else{numEl.value=digits;}
      }
      // Sync hidden field so getCheckoutData() reads the correct value
      if(phoneEl)phoneEl.value=(ccEl?ccEl.value:'+91')+(numEl.value||'');
    }
  }catch(e){}
}

/* ══ DOM READY ══════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded',function(){
  // Critical path: badge + nav state only, must be instant
  Cart.badge();
  Wishlist.refresh();
  // BUG 5: Auth.init() refreshes a near-expiry token and reconciles nav with the
  // real session state on load; falls back to a plain nav update if absent.
  if (window.Auth && typeof Auth.init === 'function') { Auth.init(); }
  else { updateNavAuth(); }
  applyNavActiveState();

  // Defer cart render + server sync until after first paint so LCP is not blocked.
  // requestAnimationFrame yields to the browser paint cycle first; the second
  // rAF ensures we're fully past layout/paint before doing any DOM work.
  requestAnimationFrame(function(){
    requestAnimationFrame(function(){
      Cart.render();

      // Sync cart from server 2.5 s after load, avoids competing with page resources.
      // On fast connections this feels instant; on slow connections it doesn't block LCP.
      setTimeout(function(){
        Cart.loadFromServer().then(function(){
          // Enrich missing images only AFTER cart sync, and only if cart is non-empty
          if(Cart.getItems().some(function(i){return !i.image;})){
            Cart._enrichImages().then(function(changed){if(changed)Cart.render();});
          }
        });
        Wishlist.loadFromServer();
      }, 2500);
    });
  });
});

/* ══ IMAGE PROTECTION (prevent casual right-click / drag copy) ══ */
/* Note: determined users can still screenshot. True signed-URL protection
   available via Cloudinary, add signed delivery profile for full DRM. */
document.addEventListener('contextmenu',function(e){
  if(e.target.tagName==='IMG'&&(
    e.target.closest('.prod-img')||
    e.target.closest('.product-img')||
    e.target.classList.contains('product-img')||
    e.target.classList.contains('prod-img')
  )){e.preventDefault();return false}
});
document.addEventListener('dragstart',function(e){
  if(e.target.tagName==='IMG')e.preventDefault();
});

/* ══ SENTRY INIT (lazy onLoad) ══════════════════════════════ */
document.addEventListener('DOMContentLoaded', function(){
  if (window.Sentry && typeof window.Sentry.onLoad === 'function') {
    window.Sentry.onLoad(function(){
      window.Sentry.init({
        environment: window.location.hostname === 'localhost' ? 'development' : 'production',
        tracesSampleRate: 0.2,
      });
    });
  }
});

/* SERVICE WORKER, registered by partials.js (single registration) */

/* ══ PWA INSTALL PROMPT, mobile only, once per session ════
   Triggers after 2 page views OR 30 s on site, whichever first.
   iOS: shows manual instructions. Android: uses beforeinstallprompt. */
(function(){
  if(window.matchMedia('(display-mode: standalone)').matches) return; // already installed
  if(!/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) return;  // desktop only skipped

  var _deferredPrompt = null;
  var _shown = sessionStorage.getItem('_pwaPromptShown');
  if(_shown) return;

  window.addEventListener('beforeinstallprompt', function(e){
    e.preventDefault();
    _deferredPrompt = e;
  });

  function _showBanner(){
    if(sessionStorage.getItem('_pwaPromptShown')) return;
    sessionStorage.setItem('_pwaPromptShown','1');

    var isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent) && !window.MSStream;

    if(isIOS){
      // iOS: no beforeinstallprompt, show manual tip
      var tip = document.createElement('div');
      tip.className = 'pwa-ios-tip show';
      tip.innerHTML = 'Add to your home screen: tap <b>Share ⬆</b> then <b>"Add to Home Screen"</b>';
      document.body.appendChild(tip);
      setTimeout(function(){ tip.classList.remove('show'); setTimeout(function(){ tip.remove(); }, 400); }, 6000);
      return;
    }

    var bar = document.createElement('div');
    bar.className = 'pwa-install-bar';
    bar.innerHTML =
      '<div class="pwa-install-bar-text">'
      + '<div class="pwa-install-bar-title">Add TriAkar to home screen</div>'
      + '<div class="pwa-install-bar-sub">Opens instantly, works offline</div>'
      + '</div>'
      + '<button class="pwa-install-bar-btn" id="_pwaInstallBtn">Add to homescreen</button>'
      + '<button class="pwa-install-bar-dismiss" aria-label="Dismiss">×</button>';
    document.body.appendChild(bar);
    requestAnimationFrame(function(){ bar.classList.add('show'); });

    bar.querySelector('._pwaInstallBtn, .pwa-install-bar-btn').addEventListener('click', function(){
      if(_deferredPrompt){
        _deferredPrompt.prompt();
        _deferredPrompt.userChoice.then(function(){ _deferredPrompt = null; });
      }
      bar.classList.remove('show');
      setTimeout(function(){ bar.remove(); }, 400);
    });
    bar.querySelector('.pwa-install-bar-dismiss').addEventListener('click', function(){
      bar.classList.remove('show');
      setTimeout(function(){ bar.remove(); }, 400);
    });
  }

  // Track page views in session
  var views = parseInt(sessionStorage.getItem('_pwaViews')||'0', 10) + 1;
  sessionStorage.setItem('_pwaViews', String(views));

  if(views >= 2){
    setTimeout(_showBanner, 1200);
  } else {
    setTimeout(_showBanner, 30000);
  }
})();

/* ══ TRIAKAR MINUTES, launch-teaser popup, once per day ══
   Shows the first time the site is opened each calendar day (localStorage
   date-stamp, not per-session) across any page that includes shared.js.
   Card shows immediately with a 30s auto-dismiss progress bar; the popup
   closes itself when the bar finishes. Close, email capture (reuses the
   newsletter API), and a WhatsApp "contact to know more" shortcut. */
(function(){
  var AUTO_CLOSE_MS=30000;

  function _todayKey(){
    var d=new Date();
    return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();
  }

  if(localStorage.getItem('_tmPromoLastShown')===_todayKey()) return;

  function _show(){
    if(localStorage.getItem('_tmPromoLastShown')===_todayKey()) return;
    localStorage.setItem('_tmPromoLastShown', _todayKey());

    var waHref='https://wa.me/919217555833?text='+encodeURIComponent('Hi TriAkar! I\'d like to know more about Triakar Minutes.');

    var ov=document.createElement('div');
    ov.className='tm-promo-ov';
    ov.innerHTML=
      '<div class="tm-promo-card glass-a">'
      + '<button type="button" class="tm-promo-close" aria-label="Close">×</button>'
      + '<div class="tm-promo-badge">Coming Soon</div>'
      + '<div class="tm-promo-title">Introducing <span class="tm-promo-accent">Triakar Minutes</span></div>'
      + '<div class="tm-promo-sub">Something new is brewing at TriAkar. Be the first to know when it drops.</div>'
      + '<form class="tm-promo-form" onsubmit="return taNewsletterSignup(this)">'
      + '<input type="email" name="email" required placeholder="Enter your email" aria-label="Email address">'
      + '<button type="submit">Subscribe</button>'
      + '</form>'
      + '<a class="tm-promo-contact" href="'+waHref+'" target="_blank" rel="noopener">Contact to know more</a>'
      + '<div class="tm-promo-loading-label">Closing automatically in <span class="tm-promo-loading-secs">30</span>s</div>'
      + '<div class="tm-promo-loading-track"><div class="tm-promo-loading-bar"></div></div>'
      + '</div>';
    document.body.appendChild(ov);
    requestAnimationFrame(function(){ ov.classList.add('show'); });

    var card=ov.querySelector('.tm-promo-card');
    var bar=ov.querySelector('.tm-promo-loading-bar');
    var secsEl=ov.querySelector('.tm-promo-loading-secs');
    var msLeft=AUTO_CLOSE_MS;
    var lastTick=Date.now();
    var closeTimer=null, countdownTimer=null, paused=false;

    bar.style.animationDuration=AUTO_CLOSE_MS+'ms';

    function _tick(){
      var now=Date.now();
      msLeft-=(now-lastTick);
      lastTick=now;
      secsEl.textContent=Math.max(Math.ceil(msLeft/1000),0);
      if(msLeft<=0){ clearInterval(countdownTimer); _close(); }
    }

    function _start(){
      lastTick=Date.now();
      bar.style.animationPlayState='running';
      closeTimer=setTimeout(_close, msLeft);
      countdownTimer=setInterval(_tick, 1000);
    }

    function _pause(){
      if(paused) return;
      paused=true;
      var now=Date.now();
      msLeft-=(now-lastTick);
      clearTimeout(closeTimer);
      clearInterval(countdownTimer);
      bar.style.animationPlayState='paused';
    }

    function _resume(){
      if(!paused) return;
      paused=false;
      _start();
    }

    _start();

    function _close(){
      clearTimeout(closeTimer);
      clearInterval(countdownTimer);
      ov.classList.remove('show');
      setTimeout(function(){ ov.remove(); }, 350);
    }
    card.addEventListener('mouseenter', _pause);
    card.addEventListener('mouseleave', _resume);
    ov.addEventListener('click', function(e){
      if(e.target===ov) _close();
      if(e.target.closest('.tm-promo-close')) _close();
    });
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', function(){ setTimeout(_show, 1500); });
  else setTimeout(_show, 1500);
})();

/* ══ Themed confirm dialog, replaces the native browser confirm() ══
   Usage: const ok = await taConfirm('Delete this address?', {danger:true});
   Resolves true on confirm, false on cancel/backdrop click/Escape. */
window.taConfirm = function(message, opts){
  opts = opts || {};
  return new Promise(function(resolve){
    var ov=document.createElement('div');
    ov.className='ta-confirm-ov';
    ov.innerHTML=
      '<div class="ta-confirm-card glass-a">'
      + '<div class="ta-confirm-title">'+(opts.title || 'Are you sure?')+'</div>'
      + '<div class="ta-confirm-msg"></div>'
      + '<div class="ta-confirm-actions">'
      + '<button type="button" class="ta-confirm-cancel">'+(opts.cancelText || 'Cancel')+'</button>'
      + '<button type="button" class="ta-confirm-ok'+(opts.danger ? ' danger' : '')+'">'+(opts.okText || 'OK')+'</button>'
      + '</div>'
      + '</div>';
    ov.querySelector('.ta-confirm-msg').textContent=message;
    document.body.appendChild(ov);
    requestAnimationFrame(function(){ ov.classList.add('show'); });

    function _close(result){
      document.removeEventListener('keydown', _onKey);
      ov.classList.remove('show');
      setTimeout(function(){ ov.remove(); }, 300);
      resolve(result);
    }
    function _onKey(e){ if(e.key==='Escape') _close(false); }
    document.addEventListener('keydown', _onKey);

    ov.querySelector('.ta-confirm-cancel').addEventListener('click', function(){ _close(false); });
    ov.querySelector('.ta-confirm-ok').addEventListener('click', function(){ _close(true); });
    ov.addEventListener('click', function(e){ if(e.target===ov) _close(false); });
  });
};

/* ════════════════════════════════════════════════════════════════════
   LIQUID GLASS, micro-interactions (toast, ripple, scroll-reveal)
   ════════════════════════════════════════════════════════════════════ */
(function(){
  /* ── Toast notifications ── */
  window.showToast = function(message, type){
    type = type || 'success';
    var t = document.createElement('div');
    t.className = 'toast toast-' + type;
    var icon = type === 'error' ? '✕' : (type === 'info' ? 'ℹ' : '✓');
    var ic = document.createElement('span'); ic.className = 'toast-icon'; ic.textContent = icon;
    var msg = document.createElement('span'); msg.textContent = message;
    t.appendChild(ic); t.appendChild(msg);
    document.body.appendChild(t);
    requestAnimationFrame(function(){ t.classList.add('show'); });
    setTimeout(function(){
      t.classList.remove('show');
      setTimeout(function(){ t.remove(); }, 320);
    }, 3000);
  };

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── Button ripple ── */
  function createRipple(e){
    var btn = e.currentTarget;
    var rect = btn.getBoundingClientRect();
    var size = Math.max(rect.width, rect.height);
    var r = document.createElement('span');
    r.style.cssText = 'position:absolute;width:'+size+'px;height:'+size+'px;left:'+
      (e.clientX-rect.left-size/2)+'px;top:'+(e.clientY-rect.top-size/2)+
      'px;background:rgba(255,255,255,.3);border-radius:50%;transform:scale(0);'+
      'animation:ta-ripple .5s linear;pointer-events:none;z-index:0';
    var cs = getComputedStyle(btn);
    if(cs.position === 'static') btn.style.position = 'relative';
    btn.style.overflow = 'hidden';
    btn.appendChild(r);
    setTimeout(function(){ r.remove(); }, 520);
  }
  function wireRipples(root){
    (root||document).querySelectorAll('.btn-primary,.btn-accent,.btn-add-cart').forEach(function(b){
      if(b._taRipple) return; b._taRipple = 1;
      b.addEventListener('click', createRipple);
    });
  }

  /* ── Scroll-reveal for .fade-in-up ── */
  function wireReveal(root){
    var els = (root||document).querySelectorAll('.fade-in-up');
    if(reduce || !('IntersectionObserver' in window)){
      els.forEach(function(el){ el.classList.add('visible'); });
      return;
    }
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if(en.isIntersecting){ en.target.classList.add('visible'); io.unobserve(en.target); }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
    els.forEach(function(el){ io.observe(el); });
  }

  function init(){ if(!reduce) wireRipples(); wireReveal(); }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
