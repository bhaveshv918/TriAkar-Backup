/* TRIAKAR shared.js v7 — Full Order Flow + Supabase */

/* ── FIX #12: HTML escape helper — use for all user-supplied data in innerHTML ── */
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

/* ── Supabase Client ───────────────────────────────────── */
const SUPABASE_URL='https://qarjbmogersuaerkhlcu.supabase.co';
const SUPABASE_ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhcmpibW9nZXJzdWFlcmtobGN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMDMzNzMsImV4cCI6MjA5NDU3OTM3M30.iS7VcO9j9UjlmBN0EhhuWBOu6Vvrg8-SQrb3oZ25AIs';
let _sb=null;
function getSB(){
  if(_sb)return _sb;
  if(window.supabase&&window.supabase.createClient){
    _sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON);
  }
  return _sb;
}

/* ── Safe GA4 analytics helper ──────────────────────────── */
function gtagEvent(name, params){ try{ if(typeof window!=='undefined' && typeof window.gtag==='function'){ window.gtag('event', name, params||{}); } }catch(_){} }

/* ── Scroll-to-top button ────────────────────────────────── */
(function(){
  const btn=document.createElement('button');
  btn.className='scroll-top';btn.setAttribute('aria-label','Back to top');
  btn.innerHTML='<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 11V3M3 7l4-4 4 4"/></svg>';
  document.body.appendChild(btn);
  window.addEventListener('scroll',()=>btn.classList.toggle('show',window.scrollY>300),{passive:true});

  // Fast eased scroll — 320ms ease-out (much snappier than native smooth)
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
  const nav=document.querySelector('.main-nav');
  const toggle=document.querySelector('.nav-toggle');
  const drawer=document.querySelector('.nav-drawer');
  if(nav) window.addEventListener('scroll',()=>nav.classList.toggle('scrolled',window.scrollY>10),{passive:true});
  if(toggle&&drawer){
    toggle.addEventListener('click',()=>{
      const o=drawer.classList.toggle('open');
      toggle.classList.toggle('open',o);
      toggle.setAttribute('aria-expanded',o);
    });
    drawer.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{
      drawer.classList.remove('open');toggle.classList.remove('open');
    }));
  }
})();

/* ── Nav active state (single source of truth) ──────────── */
function applyNavActiveState(){
  // Works for both clean URLs (/about) and .html URLs (/about.html)
  const path=window.location.pathname.toLowerCase();
  let file=(path.split('/').pop()||'').replace(/\.html$/,'');
  const PAGES={
    'products':'products.html',
    'product-detail':'products.html',
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
    if(href.indexOf(match)!==-1){
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
    items=raw.map(i=>({id:i.id,name:i.name,price:i.price,quantity:i.quantity||i.qty||1,color:i.color||i.variant||''}));
    if(localStorage.getItem('ta_cart')){localStorage.removeItem('ta_cart');try{localStorage.setItem(CART_KEY,JSON.stringify(items))}catch(e){}}
  }catch(e){items=[]}

  function _syncServer(){
    const tok=localStorage.getItem('ta_token');
    if(!tok)return;
    fetch(_API+'/api/cart',{method:'PUT',headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok},body:JSON.stringify({items})}).catch(()=>{});
  }

  function save(){try{localStorage.setItem(CART_KEY,JSON.stringify(items))}catch(e){}badge();_syncServer();}
  function badge(){const n=items.reduce((s,i)=>s+i.quantity,0);document.querySelectorAll('.cart-badge').forEach(b=>{b.textContent=n;b.classList.toggle('on',n>0)})}
  function add(p){const idx=items.findIndex(i=>i.id===p.id&&i.color===p.color);idx>-1?items[idx].quantity++:items.push({id:p.id,name:p.name,price:p.price,quantity:1,color:p.color||''});save();render();openCart()}
  function changeQty(id,color,d){const idx=items.findIndex(i=>i.id===id&&i.color===color);if(idx<0)return;items[idx].quantity+=d;if(items[idx].quantity<=0)items.splice(idx,1);save();render()}
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
      if(srv&&srv.length){items=srv.map(i=>({id:i.id,name:i.name,price:i.price,quantity:i.quantity||i.qty||1,color:i.color||i.variant||''}));try{localStorage.setItem(CART_KEY,JSON.stringify(items))}catch(e){}}
      badge();render();
    }catch(_){}
  }

  function render(){
    const el=document.getElementById('cartItemsList');
    const tot=document.getElementById('cartTotal');
    if(!el)return;
    if(tot)tot.textContent='₹'+total().toLocaleString('en-IN');
    if(!items.length){el.innerHTML='<div class="cart-empty">Your cart is empty.</div>';return}
    // FIX #12: escape all user-supplied data before inserting into innerHTML
    el.innerHTML=items.map(item=>`
      <div class="cart-item">
        <div class="ci-img"><svg viewBox="0 0 56 56" fill="none" style="width:32px"><rect x="6" y="6" width="44" height="44" rx="3" fill="#E8E4DC"/></svg></div>
        <div><div class="ci-name">${_esc(item.name)}</div><div class="ci-var">${_esc(item.color||'')}</div>
          <div class="ci-qty">
            <button class="ci-qbtn" onclick="Cart.changeQty('${_esc(item.id)}','${_esc(item.color||'')}',-1)">−</button>
            <span class="ci-qn">${_esc(item.quantity)}</span>
            <button class="ci-qbtn" onclick="Cart.changeQty('${_esc(item.id)}','${_esc(item.color||'')}',1)">+</button>
          </div>
        </div>
        <div class="ci-price">₹${(item.price*item.quantity).toLocaleString('en-IN')}</div>
      </div>`).join('')
  }
  return{add,changeQty,total,getItems,clear,render,badge,loadFromServer};
})();

function openCart(){document.getElementById('cartSidebar')?.classList.add('open');document.getElementById('cartOverlay')?.classList.add('open');Cart.render()}
function closeCart(){document.getElementById('cartSidebar')?.classList.remove('open');document.getElementById('cartOverlay')?.classList.remove('open')}

/* ══ ADD TO CART BUTTON HELPER ═════════════════════════════ */
function addToCartBtn(btnEl,product){
  if(!product)return;
  Cart.add({id:product.id,name:product.name,price:product.price,color:product.color||''});
  gtagEvent('add_to_cart',{currency:'INR',value:product.price,items:[{item_id:product.id,item_name:product.name,price:product.price}]});
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
// api.postalpincode.in is an unofficial, unreliable API — it incorrectly rejects many
// valid Indian pincodes (e.g. 201306 Greater Noida). We use it ONLY for best-effort
// city/state auto-fill. We NEVER block the user based on its response.
// Returns: {city,district,state}  — auto-fill data available
//          {unavailable:true}      — API failure or pincode not in its DB (both treated the same)
async function lookupPincode(pin){
  if(!/^\d{6}$/.test(pin))return{unavailable:true};
  try{
    const ctrl=new AbortController();
    const t=setTimeout(()=>ctrl.abort(),4000); // 4s timeout
    const res=await fetch('https://api.postalpincode.in/pincode/'+pin,{signal:ctrl.signal});
    clearTimeout(t);
    const data=await res.json();
    if(data&&data[0]&&data[0].Status==='Success'&&data[0].PostOffice&&data[0].PostOffice.length){
      const po=data[0].PostOffice[0];
      return{city:po.Block||po.Division||po.Taluk||po.Name,district:po.District,state:po.State};
    }
    // Any non-Success response — treat as unavailable, not as "invalid pincode"
    return{unavailable:true};
  }catch(e){
    return{unavailable:true};
  }
}

/* ══ SAVED ADDRESSES (Supabase) ═══════════════════════════ */
async function loadSavedAddresses(){
  const sb=getSB();
  if(!sb)return[];
  const user=(typeof Auth!=='undefined'&&Auth.getUser)?Auth.getUser():null;
  if(!user)return[];
  try{
    const {data,error}=await sb.from('user_addresses').select('*').eq('user_id',user.id).order('is_default',{ascending:false});
    if(error)throw error;
    return data||[];
  }catch(e){return[]}
}

/* ══ CHECKOUT — ORDER FORM MODAL ═══════════════════════════ */
/* Strict login gate — no login = no checkout */
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
    msg.style.cssText='position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#161614;color:#fff;padding:16px 28px;border-radius:8px;font-size:15px;z-index:99999;font-family:inherit;box-shadow:0 4px 20px rgba(0,0,0,.3)';
    document.body.appendChild(msg);
    setTimeout(function(){
      msg.remove();
      window.location.href='account.html?next=checkout';
    },1200);
    return;
  }

  closeCart();
  gtagEvent('begin_checkout',{currency:'INR',value:Cart.total()});
  openCheckoutModal();
}

function openCheckoutModal(){
  // Second-layer guard — belt and suspenders
  if(!isLoggedInStrict()){
    sessionStorage.setItem('after_login','checkout');
    window.location.href='account.html?next=checkout';
    return;
  }
  let overlay=document.getElementById('ckOverlay');
  if(!overlay){
    overlay=document.createElement('div');
    overlay.id='ckOverlay';
    overlay.className='ck-overlay';
    overlay.innerHTML=buildCheckoutHTML();
    document.body.appendChild(overlay);
    initCheckoutModal();
    // Close when clicking the dark backdrop (but not the modal content)
    overlay.addEventListener('click',function(e){
      if(e.target===overlay)closeCheckoutModal();
    });
  }
  renderCheckoutCart();
  prefillCheckout();
  showCheckoutStep(1);
  overlay.classList.add('open');
}

function closeCheckoutModal(){
  document.getElementById('ckOverlay')?.classList.remove('open');
}

/* Resume checkout after login redirect */
document.addEventListener('DOMContentLoaded',function(){
  if(sessionStorage.getItem('after_login')==='checkout'){
    if(isLoggedInStrict()&&Cart.getItems().length){
      sessionStorage.removeItem('after_login');
      setTimeout(openCheckoutModal,250);
    }else if(isLoggedInStrict()){
      // logged in but cart empty — just clear the flag
      sessionStorage.removeItem('after_login');
    }
  }
  // Close checkout on Escape key
  document.addEventListener('keydown',function(e){
    if(e.key==='Escape')closeCheckoutModal();
  });
});

function buildCheckoutHTML(){
  const stateOptions=INDIAN_STATES.map(s=>`<div class="sd-option" data-value="${s}">${s}</div>`).join('');
  return `
  <div class="ck-modal" style="position:relative">
    <button class="ck-close" onclick="closeCheckoutModal()">&times;</button>
    <div class="ck-dots"><span class="ck-dot active" data-step="1"></span><span class="ck-dot" data-step="2"></span><span class="ck-dot" data-step="3"></span><span class="ck-dot" data-step="4"></span></div>

    <!-- STEP 1: Cart Summary -->
    <div class="ck-step active" data-step="1">
      <h3 style="font-size:17px;font-weight:700;margin-bottom:16px">Your Order</h3>
      <div id="ckCartItems"></div>
      <div class="ck-total"><span>Total</span><span id="ckCartTotal">₹0</span></div>
      <button class="btn btn-dark" style="width:100%;margin-top:16px;justify-content:center" onclick="showCheckoutStep(2)">Continue to Details →</button>
    </div>

    <!-- STEP 2: Delivery Details -->
    <div class="ck-step" data-step="2">
      <h3 style="font-size:17px;font-weight:700;margin-bottom:16px">Delivery Details</h3>
      <div id="ckSavedAddresses" style="display:none;margin-bottom:16px">
        <label style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;font-weight:600;color:var(--stone);display:block;margin-bottom:8px">Saved Addresses</label>
        <div id="ckSavedList"></div>
        <button class="btn-ghost" style="font-size:12px;margin-top:8px" onclick="showNewAddressForm()">+ Add New Address</button>
      </div>
      <div id="ckAddressForm">
        <div class="ck-field"><label>Full Name *</label><input type="text" id="ckName" required></div>
        <div class="ck-field"><label>Phone Number *</label><input type="tel" id="ckPhone" required></div>
        <div class="ck-field"><label>Email *</label><input type="email" id="ckEmail" required></div>
        <div class="ck-row">
          <div class="ck-field" style="flex:1"><label>Address Line 1 *</label><input type="text" id="ckAddr1" placeholder="House/Flat/Building"></div>
        </div>
        <div class="ck-row">
          <div class="ck-field" style="flex:1"><label>Address Line 2</label><input type="text" id="ckAddr2" placeholder="Street/Colony/Area"></div>
        </div>
        <div class="ck-field"><label>Landmark</label><input type="text" id="ckLandmark" placeholder="Near..."></div>
        <div class="ck-row">
          <div class="ck-field" style="flex:1"><label>PIN Code *</label><input type="text" id="ckPincode" maxlength="6" pattern="[0-9]{6}" placeholder="6 digits"><span id="ckPincodeErr" style="display:block;font-size:11px;color:#B91C1C;margin-top:4px;min-height:0;line-height:1.4"></span></div>
          <div class="ck-field" style="flex:1"><label>City *</label><input type="text" id="ckCity" placeholder="City"></div>
        </div>
        <div class="ck-row">
          <div class="ck-field" style="flex:1"><label>District</label><input type="text" id="ckDistrict" placeholder="District"></div>
          <div class="ck-field" style="flex:1"><label>State *</label>
            <div class="sd-wrap" id="ckStateWrap">
              <input class="sd-input" id="ckState" placeholder="Select state" readonly>
              <div class="sd-dropdown"><input class="sd-search" placeholder="Search state...">${stateOptions}</div>
            </div>
          </div>
        </div>
        <div class="ck-field">
          <label>Who should the courier call? *</label>
          <input type="tel" id="ckContactPhone" required placeholder="10-digit mobile number">
          <div style="font-size:11px;color:var(--stone);margin-top:3px">This number will be shared with the delivery partner</div>
        </div>
        <div class="ck-field"><label>Special Instructions (optional)</label><textarea id="ckNotes" placeholder="Any special requests"></textarea></div>
      </div>
      <div style="display:flex;gap:10px;margin-top:16px">
        <button class="btn btn-outline" onclick="showCheckoutStep(1)">← Back</button>
        <button class="btn btn-dark" style="flex:1;justify-content:center" onclick="validateAndNext()">Choose Payment →</button>
      </div>
    </div>

    <!-- STEP 3: Payment -->
    <div class="ck-step" data-step="3">
      <h3 style="font-size:17px;font-weight:700;margin-bottom:16px">Payment Method</h3>
      <div style="font-size:11px;color:var(--warm);background:rgba(196,98,42,.07);border:1px solid rgba(196,98,42,.2);padding:9px 13px;border-radius:4px;margin-bottom:14px;line-height:1.5">
        ⚠ We do not accept Cash on Delivery. All products are made to order — prepayment required.
      </div>
      <div class="ck-radio-group" id="ckPaymentGroup">
        <label class="ck-radio selected"><input type="radio" name="ckPay" value="online" checked><div><div class="ck-radio-label">Pay Online</div><div class="ck-radio-desc">UPI, Cards, NetBanking, Wallets via Razorpay</div></div></label>
        <label class="ck-radio"><input type="radio" name="ckPay" value="whatsapp"><div><div class="ck-radio-label">Order via WhatsApp</div><div class="ck-radio-desc">We'll confirm your order and share payment details on WhatsApp</div></div></label>
      </div>
      <div class="ck-order-summary" style="margin-top:18px;padding:14px;background:var(--stone-p);border-radius:6px">
        <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--warm);margin-bottom:6px"><span>Subtotal</span><span id="ckPaySubtotal">₹0</span></div>
        <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--warm);margin-bottom:6px"><span>Shipping</span><span id="ckPayShipping">₹0</span></div>
        <div style="display:flex;justify-content:space-between;font-size:15px;font-weight:700;color:var(--charcoal);border-top:1px solid var(--stone);padding-top:8px;margin-top:4px"><span>Total</span><span id="ckPayTotal">₹0</span></div>
      </div>
      <div style="display:flex;gap:10px;margin-top:16px">
        <button class="btn btn-outline" onclick="showCheckoutStep(2)">← Back</button>
        <button class="btn btn-accent" style="flex:1;justify-content:center" id="ckPlaceBtn" onclick="placeOrder()">Place Order →</button>
      </div>
    </div>

    <!-- STEP 4: Confirmation -->
    <div class="ck-step" data-step="4">
      <div style="text-align:center;padding:24px 0" id="ckConfirmContent">
        <div style="width:48px;height:48px;border-radius:50%;background:var(--charcoal);display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L19 7" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
        <h3 style="font-size:20px;font-weight:700;margin-bottom:8px">Order Placed!</h3>
        <div id="ckOrderIdDisplay" style="font-size:16px;font-weight:700;color:var(--accent);margin-bottom:12px;letter-spacing:.04em"></div>
        <p style="font-size:13px;color:var(--warm);line-height:1.7;margin-bottom:16px">
          Save your order ID to <a href="track-order.html" style="color:var(--accent);font-weight:600">track your order</a>.<br>
          We'll contact you on WhatsApp to confirm.
        </p>
        <a href="tel:+919217555833" style="font-size:16px;font-weight:700;color:var(--charcoal);text-decoration:none">+91 92175 55833</a>
        <p style="font-size:11px;color:var(--stone);margin-top:4px">11 AM to 9 PM, all days</p>
        <div style="display:flex;gap:10px;justify-content:center;margin-top:20px">
          <a href="products.html" class="btn btn-dark">Continue Shopping</a>
          <button class="btn btn-outline" onclick="closeCheckoutModal()">Close</button>
        </div>
      </div>
    </div>
  </div>`;
}

function initCheckoutModal(){
  initPhoneField('ckPhone');
  initPhoneField('ckContactPhone');
  // Pre-fill contact phone from saved profile
  const profileCache=getProfileCache();
  const cpEl=document.getElementById('ckContactPhone_num')||document.getElementById('ckContactPhone');
  if(cpEl&&profileCache&&profileCache.mobile){
    const mob=String(profileCache.mobile).replace(/^\+91/,'').replace(/\D/g,'');
    if(cpEl.id.endsWith('_num'))cpEl.value=mob;
    else cpEl.value='+91'+mob;
    if(document.getElementById('ckContactPhone'))document.getElementById('ckContactPhone').value='+91'+mob;
  }
  const stateWrap=document.getElementById('ckStateWrap');
  if(stateWrap) initSearchableDropdown(stateWrap);

  // Radio group styling
  document.querySelectorAll('#ckPaymentGroup .ck-radio').forEach(r=>{
    r.addEventListener('click',()=>{
      document.querySelectorAll('#ckPaymentGroup .ck-radio').forEach(x=>x.classList.remove('selected'));
      r.classList.add('selected');
      r.querySelector('input').checked=true;
    });
  });

  // Pincode auto-fill — gracefully handles API unavailability
  const pinEl=document.getElementById('ckPincode');
  if(pinEl){
    pinEl.addEventListener('input',async function(){
      const val=this.value.trim();
      const errEl=document.getElementById('ckPincodeErr');
      if(errEl)errEl.textContent='';
      if(val.length===6&&/^\d{6}$/.test(val)){
        const info=await lookupPincode(val);
        if(info&&!info.unavailable){
          const cityEl=document.getElementById('ckCity');
          const distEl=document.getElementById('ckDistrict');
          const stateEl=document.getElementById('ckState');
          if(cityEl&&!cityEl.value)cityEl.value=info.city||'';
          if(distEl&&info.district)distEl.value=info.district;
          if(stateEl&&info.state){
            stateEl.value=info.state;
            stateEl.dataset.value=info.state;
            const wrap=document.getElementById('ckStateWrap');
            if(wrap){
              const display=wrap.querySelector('.sd-input');
              if(display)display.value=info.state;
              wrap.querySelectorAll('.sd-option').forEach(o=>{
                o.classList.toggle('selected',o.textContent.trim()===info.state||o.dataset.value===info.state);
              });
            }
          }
          if(errEl)errEl.textContent='';
        }
        // API unavailable or pincode not in DB — never show an error, user fills manually
      }
    });
  }

  // Address autocomplete (map search) for the modal form
  const ckAddressForm=document.getElementById('ckAddressForm');
  if(ckAddressForm&&typeof AddressAC!=='undefined'){
    AddressAC.init({
      container: ckAddressForm,
      fields:{
        line1:   'ckAddr1',
        line2:   'ckAddr2',
        city:    'ckCity',
        district:'ckDistrict',
        state:   'ckState',
        pincode: 'ckPincode',
      }
    });
  }

  // Load saved addresses for logged-in users
  loadAndShowSavedAddresses();
}

async function loadAndShowSavedAddresses(){
  const user=(typeof Auth!=='undefined'&&Auth.getUser)?Auth.getUser():null;
  if(!user)return;
  const addresses=await loadSavedAddresses();
  if(!addresses.length)return;
  const container=document.getElementById('ckSavedAddresses');
  const list=document.getElementById('ckSavedList');
  if(!container||!list)return;
  container.style.display='block';
  document.getElementById('ckAddressForm').style.display='none';
  // FIX #12: escape address fields before injecting into innerHTML
  list.innerHTML=addresses.map((a,i)=>`
    <div class="ck-saved-addr" onclick="selectSavedAddress(${i})" data-idx="${i}">
      <div class="ck-sa-radio"></div>
      <div class="ck-sa-body">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
          <strong style="font-size:13px">${_esc(a.full_name)}</strong>
          <span style="font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--stone);font-weight:600">${_esc(a.address_label||a.address_type||'Home')}</span>
        </div>
        <div style="font-size:12px;color:var(--warm);margin-top:4px;line-height:1.5">
          ${_esc(a.address_line1)}${a.address_line2?', '+_esc(a.address_line2):''}${a.landmark?', Near '+_esc(a.landmark):''}<br>
          ${_esc(a.city)}, ${_esc(a.state)} - ${_esc(a.pincode)}
        </div>
        <div style="font-size:12px;color:var(--stone);margin-top:2px">${_esc(a.phone||a.mobile||'')}</div>
      </div>
    </div>
  `).join('');

  // Store addresses data
  window._savedAddresses=addresses;
  // Auto-select the default address, or the first one so a choice is always made
  const defIdx=addresses.findIndex(a=>a.is_default);
  selectSavedAddress(defIdx>=0?defIdx:0);
}

function selectSavedAddress(idx){
  const addr=window._savedAddresses[idx];
  if(!addr)return;
  document.querySelectorAll('.ck-saved-addr').forEach(el=>el.classList.remove('selected'));
  document.querySelector(`.ck-saved-addr[data-idx="${idx}"]`)?.classList.add('selected');
  window._selectedAddress=addr;
  // Fill hidden fields for validation
  const nameEl=document.getElementById('ckName');
  const phoneEl=document.getElementById('ckPhone');
  if(nameEl)nameEl.value=addr.full_name;
  if(phoneEl)phoneEl.value=addr.phone||addr.mobile||'';
}

function showNewAddressForm(){
  document.getElementById('ckAddressForm').style.display='block';
  document.getElementById('ckSavedAddresses').style.display='none';
  window._selectedAddress=null;
}

function showCheckoutStep(n){
  document.querySelectorAll('.ck-step').forEach(s=>s.classList.toggle('active',parseInt(s.dataset.step)===n));
  document.querySelectorAll('.ck-dot').forEach(d=>d.classList.toggle('active',parseInt(d.dataset.step)<=n));
  // Update payment summary when reaching step 3
  if(n===3)updatePaymentSummary();
}

function updatePaymentSummary(){
  const sub=Cart.total();
  const ship=sub>=999?0:49;
  const tot=sub+ship;
  const subEl=document.getElementById('ckPaySubtotal');
  const shipEl=document.getElementById('ckPayShipping');
  const totEl=document.getElementById('ckPayTotal');
  if(subEl)subEl.textContent='₹'+sub.toLocaleString('en-IN');
  if(shipEl)shipEl.textContent=ship?'₹'+ship:'Free';
  if(totEl)totEl.textContent='₹'+tot.toLocaleString('en-IN');
}

function renderCheckoutCart(){
  const items=Cart.getItems();
  const el=document.getElementById('ckCartItems');
  const tot=document.getElementById('ckCartTotal');
  if(!el)return;
  el.innerHTML=items.map(i=>`<div class="ck-cart-item"><span>${i.name} × ${i.quantity}</span><span>₹${(i.price*i.quantity).toLocaleString('en-IN')}</span></div>`).join('');
  const shipping=Cart.total()>=999?0:49;
  if(shipping>0) el.innerHTML+=`<div class="ck-cart-item"><span>Shipping</span><span>₹${shipping}</span></div>`;
  if(tot) tot.textContent='₹'+(Cart.total()+shipping).toLocaleString('en-IN');
}

function getCheckoutData(){
  const contactPhone=document.getElementById('ckContactPhone')?.value.trim()||'';
  // If saved address is selected, build from that
  if(window._selectedAddress){
    const a=window._selectedAddress;
    const user=(typeof Auth!=='undefined'&&Auth.getUser)?Auth.getUser():null;
    return{
      name:a.full_name,
      phone:a.phone||a.mobile||'',
      contact_phone:contactPhone||a.phone||a.mobile||'',
      email:user?user.email:(document.getElementById('ckEmail')?.value.trim()||''),
      address_line1:a.address_line1,
      address_line2:a.address_line2||'',
      landmark:a.landmark||'',
      city:a.city,
      district:a.district||'',
      state:a.state,
      pincode:a.pincode,
      notes:document.getElementById('ckNotes')?.value.trim()||''
    };
  }
  return{
    name:document.getElementById('ckName')?.value.trim()||'',
    phone:document.getElementById('ckPhone')?.value.trim()||'',
    contact_phone:contactPhone,
    email:document.getElementById('ckEmail')?.value.trim()||'',
    address_line1:document.getElementById('ckAddr1')?.value.trim()||'',
    address_line2:document.getElementById('ckAddr2')?.value.trim()||'',
    landmark:document.getElementById('ckLandmark')?.value.trim()||'',
    city:document.getElementById('ckCity')?.value.trim()||'',
    district:document.getElementById('ckDistrict')?.value.trim()||'',
    state:document.getElementById('ckState')?.value.trim()||'',
    pincode:document.getElementById('ckPincode')?.value.trim()||'',
    notes:document.getElementById('ckNotes')?.value.trim()||''
  };
}

async function validateAndNext(){
  const d=getCheckoutData();
  if(!window._selectedAddress){
    const phoneInp=document.getElementById('ckPhone');
    if(phoneInp&&phoneInp._validatePhone&&!phoneInp._validatePhone())return;
    if(!d.address_line1||!d.city||!d.state||!d.pincode){alert('Please fill all required address fields.');return;}
    if(!/^\d{6}$/.test(d.pincode)){alert('Please enter a valid 6-digit PIN code.');return;}
    // Pincode: format is already validated above (6-digit). No external API blocking.
    // lookupPincode is used only for auto-fill — never for blocking validation.
    const pinErr=document.getElementById('ckPincodeErr');
    if(pinErr)pinErr.textContent='';
  }
  if(!d.name||!d.phone){alert('A delivery name and phone number are required.');return;}
  if(!d.address_line1||!d.city||!d.state||!d.pincode){alert('Please choose or enter a delivery address.');return;}
  if(!d.email){alert('Please enter your email address.');return;}
  if(!/^\S+@\S+\.\S+$/.test(d.email)){alert('Please enter a valid email address.');return;}
  showCheckoutStep(3);
}

/* Resolve an address_id for the server order — uses the chosen saved address,
   or creates a new user_addresses row from the entered form first. */
async function resolveAddressId(d,headers,API){
  if(window._selectedAddress&&window._selectedAddress.id){
    return window._selectedAddress.id;
  }
  // New address — persist it so the server can reference it by id
  const res=await fetch(API+'/api/addresses',{
    method:'POST',headers,
    body:JSON.stringify({
      full_name:d.name,phone:d.phone,
      address_line1:d.address_line1,
      address_line2:d.address_line2||null,
      city:d.city,state:d.state,pincode:d.pincode,
      country:'India',is_default:true
    })
  });
  let j={};try{j=await res.json()}catch(_){}
  if(!res.ok||!j.address||!j.address.id){
    throw new Error((j&&j.error)||'Could not save your delivery address');
  }
  window._selectedAddress=j.address;
  return j.address.id;
}

/* ══ PLACE ORDER ═══════════════════════════════════════════ */
async function placeOrder(){
  const items=Cart.getItems();
  const d=getCheckoutData();
  const payment=document.querySelector('input[name="ckPay"]:checked')?.value||'online';
  const shipping=Cart.total()>=999?0:49;
  const subtotal=Cart.total();
  const total=subtotal+shipping;
  const btn=document.getElementById('ckPlaceBtn');
  const trkId=generateTRKId();

  const shippingAddress={
    full_name:d.name,
    mobile:d.phone,
    contact_phone:d.contact_phone||d.phone,
    address_line1:d.address_line1,
    address_line2:d.address_line2,
    landmark:d.landmark,
    city:d.city,
    district:d.district,
    state:d.state,
    pincode:d.pincode,
    country:'India'
  };

  const orderItems=items.map(i=>({
    slug:i.id,name:i.name,quantity:i.quantity,unit_price:i.price,
    color:i.color||'',total:i.price*i.quantity
  }));

  // ── Pay Online — Razorpay ──
  if(payment==='online'){
    btn.disabled=true;btn.textContent='Processing...';
    const API=window.location.hostname==='localhost'?'http://localhost:3000':'https://triakar.onrender.com';
    try{
      const token=localStorage.getItem('ta_token');
      const headers={'Content-Type':'application/json'};
      if(token)headers['Authorization']='Bearer '+token;

      const cartItems=items.map(i=>({slug:i.id,quantity:i.quantity,customization_notes:d.notes||null}));
      // Server requires a saved-address id — resolve the chosen one, or persist a new one.
      const address_id=await resolveAddressId(d,headers,API);
      // FIX #13/#18: send TRK ID + customer fields upfront — no post-payment enrichment needed
      const res=await fetch(API+'/api/payments/create-order',{
        method:'POST',headers,
        body:JSON.stringify({
          items:cartItems,address_id,
          trk_id:trkId,
          customer_name:d.name,
          customer_email:d.email,
          customer_phone:d.phone,
          special_instructions:d.notes||null
        })
      });
      const data=await res.json();
      if(!res.ok)throw new Error(data.error||'Could not initiate payment');

      // Load Razorpay SDK
      await new Promise(function(resolve,reject){
        if(window.Razorpay){resolve();return}
        const s=document.createElement('script');
        s.src='https://checkout.razorpay.com/v1/checkout.js';
        s.onload=resolve;
        s.onerror=function(){reject(new Error('Could not load payment gateway'))};
        document.head.appendChild(s);
      });

      const rzp=new window.Razorpay({
        key:data.key_id,
        amount:data.amount,
        currency:data.currency||'INR',
        name:'TriAkar',
        description:'Premium 3D Printed Products',
        order_id:data.razorpay_order_id,
        prefill:{name:d.name,contact:d.phone,email:d.email},
        theme:{color:'#161614'},
        handler:async function(response){
          btn.textContent='Saving order...';
          try{
            // Verify payment
            const vRes=await fetch(API+'/api/payments/verify',{
              method:'POST',headers,
              body:JSON.stringify({
                razorpay_order_id:response.razorpay_order_id,
                razorpay_payment_id:response.razorpay_payment_id,
                razorpay_signature:response.razorpay_signature,
                order_id:data.order_id
              })
            });
            if(!vRes.ok)throw new Error('Payment verification failed');

            // TRK ID + customer data were already saved at create-order time (FIX #13/#18).
            // No additional enrichment needed — server handles everything.

            Cart.clear();
            gtagEvent('purchase',{transaction_id:trkId,currency:'INR',value:total});
            showOrderConfirmation(trkId,'online','paid');
          }catch(e){
            alert('Payment received. Your order ID: '+trkId+'. We will confirm shortly.');
            Cart.clear();
            showOrderConfirmation(trkId,'online','paid');
          }
        },
        modal:{ondismiss:function(){btn.disabled=false;btn.textContent='Place Order →'}}
      });
      rzp.on('payment.failed',function(r){
        btn.disabled=false;btn.textContent='Place Order →';
        alert('Payment failed: '+r.error.description);
      });
      rzp.open();
    }catch(err){
      btn.disabled=false;btn.textContent='Place Order →';
      alert('Checkout error: '+err.message);
    }
    return;
  }

  // ── WhatsApp Order ──
  if(payment==='whatsapp'){
    btn.disabled=true;btn.textContent='Placing order...';
    // FIX #6: log save errors so they're visible in the console for debugging
    try{
      await saveOrderToSupabase(trkId,d,orderItems,subtotal,shipping,total,'whatsapp','pending');
    }catch(e){console.warn('[TriAkar] WhatsApp order DB save failed — proceeding with WhatsApp fallback:',e);}
    // Build WhatsApp message for customer
    const itemLines=items.map(i=>i.name+' x'+i.quantity+' = ₹'+(i.price*i.quantity).toLocaleString('en-IN')).join('\n');
    const orderText='*New Order, TriAkar*\n'
      +'*Order ID:* '+trkId+'\n\n'
      +'*Items:*\n'+itemLines+'\n'
      +(shipping?'Shipping: ₹'+shipping+'\n':'')
      +'*Total: ₹'+total.toLocaleString('en-IN')+'*\n\n'
      +'*Customer:* '+d.name+'\n*Phone:* '+d.phone+'\n*Email:* '+d.email+'\n'
      +'*Address:* '+d.address_line1+(d.address_line2?', '+d.address_line2:'')+', '+d.city+', '+d.state+' - '+d.pincode+'\n'
      +(d.notes?'*Notes:* '+d.notes+'\n':'')
      +'*Payment:* WhatsApp Order (pending)';

    window.open('https://wa.me/919217555833?text='+encodeURIComponent(orderText),'_blank');
    Cart.clear();
    gtagEvent('purchase',{transaction_id:trkId,currency:'INR',value:total});
    showOrderConfirmation(trkId,'whatsapp','pending');
    return;
  }
}

/* ══ SAVE ORDER TO SUPABASE ═══════════════════════════════ */
async function saveOrderToSupabase(trkId,d,orderItems,subtotal,shipping,total,payMethod,payStatus){
  const sb=getSB();
  if(!sb){console.warn('Supabase not available');return;}
  const user=(typeof Auth!=='undefined'&&Auth.getUser)?Auth.getUser():null;

  const {data,error}=await sb.rpc('create_customer_order',{
    p_order_id:trkId,
    p_customer_name:d.name,
    p_customer_email:d.email,
    p_customer_phone:d.phone,
    p_shipping_address:{
      full_name:d.name,mobile:d.phone,
      address_line1:d.address_line1,address_line2:d.address_line2||'',
      landmark:d.landmark||'',city:d.city,district:d.district||'',
      state:d.state,pincode:d.pincode,country:'India'
    },
    p_items:orderItems,
    p_subtotal:subtotal,
    p_shipping_charge:shipping,
    p_total_amount:total,
    p_payment_method:payMethod,
    p_payment_status:payStatus,
    p_special_instructions:d.notes||null,
    p_user_id:user?user.id:null
  });
  if(error){console.error('Order save error:',error);throw error;}

  // Auto-save address for logged-in users (if not using a saved address)
  if(user&&!window._selectedAddress&&d.address_line1){
    try{
      // Check if this address already exists
      const {data:existing}=await sb.from('user_addresses').select('id').eq('user_id',user.id).eq('pincode',d.pincode).eq('address_line1',d.address_line1);
      if(!existing||!existing.length){
        // Check if user has any addresses — if not, make this default
        const {data:allAddr}=await sb.from('user_addresses').select('id').eq('user_id',user.id);
        const isFirst=!allAddr||!allAddr.length;
        await sb.from('user_addresses').insert({
          user_id:user.id,full_name:d.name,phone:d.phone,
          address_line1:d.address_line1,address_line2:d.address_line2||null,
          city:d.city,state:d.state,pincode:d.pincode,
          is_default:isFirst
        });
      }
    }catch(e){console.warn('Address auto-save skipped:',e)}
  }

  return data;
}

/* ══ WHATSAPP NOTIFICATION TO SHOP ════════════════════════ */
// FIX #20: For online (Razorpay) orders the server sends an admin email alert automatically.
// Shop monitors the admin panel — no client-side WhatsApp popup needed.
// This function is kept only for WhatsApp order path, which calls window.open() directly.
function sendShopWhatsApp(trkId,d,items,total,payLabel){
  // No-op for online orders. WhatsApp orders open wa.me directly in their own flow.
}

/* ══ ORDER CONFIRMATION DISPLAY ═══════════════════════════ */
function showOrderConfirmation(trkId,method,status){
  showCheckoutStep(4);
  const display=document.getElementById('ckOrderIdDisplay');
  if(display) display.textContent=trkId;

  // Update confirmation content based on payment method
  const content=document.getElementById('ckConfirmContent');
  if(!content)return;

  let methodNote='';
  if(method==='whatsapp') methodNote='We\'ll message you on WhatsApp with payment details.';
  else if(method==='online'&&status==='paid') methodNote='Payment received! Your order is confirmed.';

  const noteEl=content.querySelector('.ck-method-note');
  if(noteEl)noteEl.textContent=methodNote;
  else{
    const p=document.createElement('p');
    p.className='ck-method-note';
    p.style.cssText='font-size:13px;color:var(--charcoal);font-weight:500;margin-bottom:12px';
    p.textContent=methodNote;
    display.insertAdjacentElement('afterend',p);
  }

  const btn=document.getElementById('ckPlaceBtn');
  if(btn){btn.disabled=false;btn.textContent='Place Order →';}
}

/* ══ WHATSAPP FLOATING BUTTON ══════════════════════════════ */
(function(){
  if(document.querySelector('.mobile-buy-bar'))return;
  const wa=document.createElement('a');
  wa.className='wa-float';
  wa.href='https://wa.me/919217555833';
  wa.target='_blank';
  wa.rel='noopener';
  wa.setAttribute('aria-label','Chat on WhatsApp');
  wa.innerHTML='<span class="wa-float-tip">Chat with us on WhatsApp</span><svg viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492l4.598-1.46A11.928 11.928 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75c-2.198 0-4.247-.6-6.012-1.647l-.43-.258-2.727.867.855-2.637-.283-.451A9.704 9.704 0 012.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75z"/></svg>';
  document.body.appendChild(wa);
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

/* Resilient Supabase insert for callback_requests — retries with minimal columns
   if the full row fails (e.g. missing columns in schema). */
async function _insertCallbackResilient(payload){
  const sb=getSB();
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

/* Shared async submit — usable from anywhere (custom.html etc.) */
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
    // Best-effort, fire-and-forget owner notification — never blocks the WA + inline flow.
    try {
      const API = window.location.hostname==='localhost' ? 'http://localhost:3000' : 'https://triakar.onrender.com';
      fetch(API+'/api/notify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'callback',data:{reference_id:reference_id,name:name,phone:phone,topic:topic,preferred_time:preferred_time}})}).catch(function(){});
    } catch(_){}
  }

  // WhatsApp pre-filled message — KEEP existing behaviour
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
      +(result.error||'Please try again, or call us directly at +91 92175 55833.'),
      'error'
    );
  }
}

/* ══ COPY TO CLIPBOARD ═════════════════════════════════════ */
function copyAddress(){
  const addr='Shop No. 25, Karan Singh Market, Chhoti Milak, Greater Noida West, Gautam Buddha Nagar, UP – 201318';
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

/* Resolve best display name — priority: profile.nickname > first word of full_name > email prefix */
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

    if(user){
      if(shopBtn) shopBtn.style.display='none';
      // Use cached profile for nickname — refresh happens async after render
      const profile=getProfileCache();
      const displayName=resolveDisplayName(user,profile);
      const wrap=document.createElement('div');
      wrap.className='nav-auth-wrap';
      wrap.innerHTML=`
        <button class="nav-profile-btn" id="navProfileBtn">Hi, ${displayName} ▾</button>
        <div class="nav-profile-dropdown">
          <a href="account.html#profile">My Account</a>
          <a href="account.html#orders">My Orders</a>
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

      // Async refresh profile — updates name if nickname changed
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
  });

  document.addEventListener('click',function(){
    document.querySelectorAll('.nav-auth-wrap.open').forEach(w=>w.classList.remove('open'));
  });
}

/* ══ PHONE VALIDATION ═════════════════════════════════════ */
const PHONE_RULES={'+91':{len:10,label:'Indian'},'+1':{len:10,label:'US/Canada'},'+44':{len:10,label:'UK'},'+971':{len:9,label:'UAE'},'+61':{len:9,label:'Australia'},'+65':{len:8,label:'Singapore'},'+49':{len:10,label:'Germany'}};
const COUNTRY_CODES=['+91','+1','+44','+971','+61','+65','+49'];

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
  COUNTRY_CODES.forEach(c=>{const o=document.createElement('option');o.value=c;o.textContent=c;prefix.appendChild(o)});
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
document.addEventListener('DOMContentLoaded',()=>{
  Cart.badge();Cart.render();Cart.loadFromServer();
  updateNavAuth();
  applyNavActiveState();
});

/* ══ IMAGE PROTECTION (prevent casual right-click / drag copy) ══ */
/* Note: determined users can still screenshot. True signed-URL protection
   available via Cloudinary — add signed delivery profile for full DRM. */
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
