/* TRIAKAR shared.js v7 — Full Order Flow + Supabase */

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
  // Active page highlight
  const path=window.location.pathname.split('/').pop()||'index.html';
  document.querySelectorAll('.nav-links a,.nav-drawer a').forEach(a=>{
    if(a.getAttribute('href')===path){
      a.classList.add('active');
      a.style.cssText='color:var(--accent);font-weight:700';
    }
  });
})();

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
    el.innerHTML=items.map(item=>`
      <div class="cart-item">
        <div class="ci-img"><svg viewBox="0 0 56 56" fill="none" style="width:32px"><rect x="6" y="6" width="44" height="44" rx="3" fill="#E8E4DC"/></svg></div>
        <div><div class="ci-name">${item.name}</div><div class="ci-var">${item.color||''}</div>
          <div class="ci-qty">
            <button class="ci-qbtn" onclick="Cart.changeQty('${item.id}','${item.color||''}',-1)">−</button>
            <span class="ci-qn">${item.quantity}</span>
            <button class="ci-qbtn" onclick="Cart.changeQty('${item.id}','${item.color||''}',1)">+</button>
          </div>
        </div>
        <div class="ci-price">₹${(item.price*item.quantity).toLocaleString('en-IN')}</div>
      </div>`).join('')
  }
  return{add,changeQty,total,getItems,clear,render,badge,loadFromServer};
})();

function openCart(){document.getElementById('cartSidebar')?.classList.add('open');document.getElementById('cartOverlay')?.classList.add('open');Cart.render()}
function closeCart(){document.getElementById('cartSidebar')?.classList.remove('open');document.getElementById('cartOverlay')?.classList.remove('open')}

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
function generateTRKId(){
  const d=new Date();
  const yyyy=d.getFullYear();
  const mm=String(d.getMonth()+1).padStart(2,'0');
  const dd=String(d.getDate()).padStart(2,'0');
  const rand=String(Math.floor(1000+Math.random()*9000));
  return 'TRK-'+yyyy+mm+dd+'-'+rand;
}

/* ══ PINCODE AUTO-FILL ════════════════════════════════════ */
async function lookupPincode(pin){
  if(!/^\d{6}$/.test(pin))return null;
  try{
    const res=await fetch('https://api.postalpincode.in/pincode/'+pin);
    const data=await res.json();
    if(data&&data[0]&&data[0].Status==='Success'&&data[0].PostOffice&&data[0].PostOffice.length){
      const po=data[0].PostOffice[0];
      return{city:po.Block||po.Division||po.Name,district:po.District,state:po.State};
    }
  }catch(e){}
  return null;
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
function checkout(){
  const items=Cart.getItems();
  if(!items.length)return;
  closeCart();
  openCheckoutModal();
}

function openCheckoutModal(){
  let overlay=document.getElementById('ckOverlay');
  if(!overlay){
    overlay=document.createElement('div');
    overlay.id='ckOverlay';
    overlay.className='ck-overlay';
    overlay.innerHTML=buildCheckoutHTML();
    document.body.appendChild(overlay);
    initCheckoutModal();
  }
  renderCheckoutCart();
  prefillCheckout();
  showCheckoutStep(1);
  overlay.classList.add('open');
}

function closeCheckoutModal(){
  document.getElementById('ckOverlay')?.classList.remove('open');
}

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
          <div class="ck-field" style="flex:1"><label>PIN Code *</label><input type="text" id="ckPincode" maxlength="6" pattern="[0-9]{6}" placeholder="6 digits"></div>
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
      <div class="ck-radio-group" id="ckPaymentGroup">
        <label class="ck-radio selected"><input type="radio" name="ckPay" value="online" checked><div><div class="ck-radio-label">Pay Online</div><div class="ck-radio-desc">UPI, Cards, NetBanking, Wallets via Razorpay</div></div></label>
        <label class="ck-radio"><input type="radio" name="ckPay" value="cod"><div><div class="ck-radio-label">Cash on Delivery</div><div class="ck-radio-desc">Pay when you receive your order</div></div></label>
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

  // Pincode auto-fill
  const pinEl=document.getElementById('ckPincode');
  if(pinEl){
    pinEl.addEventListener('input',async function(){
      const val=this.value.trim();
      if(val.length===6){
        const info=await lookupPincode(val);
        if(info){
          const cityEl=document.getElementById('ckCity');
          const distEl=document.getElementById('ckDistrict');
          const stateEl=document.getElementById('ckState');
          if(cityEl&&!cityEl.value)cityEl.value=info.city||'';
          if(distEl)distEl.value=info.district||'';
          if(stateEl&&info.state){
            stateEl.value=info.state;
            stateEl.dataset.value=info.state;
            // Highlight matching option
            const wrap=document.getElementById('ckStateWrap');
            if(wrap){
              wrap.querySelectorAll('.sd-option').forEach(o=>{
                o.classList.toggle('selected',o.textContent===info.state);
              });
            }
          }
        }
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
  list.innerHTML=addresses.map((a,i)=>`
    <div class="ck-saved-addr ${a.is_default?'selected':''}" onclick="selectSavedAddress(${i})" data-idx="${i}">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <strong style="font-size:13px">${a.full_name}</strong>
        <span style="font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--stone);font-weight:600">${a.address_label||a.address_type||'Home'}</span>
      </div>
      <div style="font-size:12px;color:var(--warm);margin-top:4px;line-height:1.5">
        ${a.address_line1}${a.address_line2?', '+a.address_line2:''}${a.landmark?', Near '+a.landmark:''}<br>
        ${a.city}, ${a.state} - ${a.pincode}
      </div>
      <div style="font-size:12px;color:var(--stone);margin-top:2px">${a.phone||a.mobile||''}</div>
    </div>
  `).join('');

  // Store addresses data
  window._savedAddresses=addresses;
  // Auto-select default
  const defIdx=addresses.findIndex(a=>a.is_default);
  if(defIdx>=0)selectSavedAddress(defIdx);
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
  // If saved address is selected, build from that
  if(window._selectedAddress){
    const a=window._selectedAddress;
    const user=(typeof Auth!=='undefined'&&Auth.getUser)?Auth.getUser():null;
    return{
      name:a.full_name,
      phone:a.phone||a.mobile||'',
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

function validateAndNext(){
  const d=getCheckoutData();
  const phoneInp=document.getElementById('ckPhone');
  if(phoneInp&&phoneInp._validatePhone&&!phoneInp._validatePhone())return;
  if(!d.name||!d.phone||!d.email){alert('Please fill name, phone and email.');return;}
  if(!window._selectedAddress){
    if(!d.address_line1||!d.city||!d.state||!d.pincode){alert('Please fill all required address fields.');return;}
    if(!/^\d{6}$/.test(d.pincode)){alert('Please enter a valid 6-digit PIN code.');return;}
  }
  if(!/^\S+@\S+\.\S+$/.test(d.email)){alert('Please enter a valid email address.');return;}
  showCheckoutStep(3);
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
      const res=await fetch(API+'/api/payments/create-order',{
        method:'POST',headers,
        body:JSON.stringify({items:cartItems,customer:{name:d.name,phone:d.phone,email:d.email,address:d.address_line1,state:d.state,pincode:d.pincode}})
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

            // Save to Supabase
            await saveOrderToSupabase(trkId,d,orderItems,subtotal,shipping,total,'online','paid');

            // Send WhatsApp notification to shop
            sendShopWhatsApp(trkId,d,items,total,'Online (Paid)');

            Cart.clear();
            showOrderConfirmation(trkId,'online','paid');
          }catch(e){
            alert('Payment verified but order save issue. Your order ID: '+trkId+'. Contact us.');
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

  // ── COD — Save order with pending payment ──
  if(payment==='cod'){
    btn.disabled=true;btn.textContent='Placing order...';
    try{
      await saveOrderToSupabase(trkId,d,orderItems,subtotal,shipping,total,'cod','pending');
      sendShopWhatsApp(trkId,d,items,total,'Cash on Delivery');
      Cart.clear();
      showOrderConfirmation(trkId,'cod','pending');
    }catch(err){
      btn.disabled=false;btn.textContent='Place Order →';
      alert('Could not place order. Please try again.');
    }
    return;
  }

  // ── WhatsApp Order ──
  if(payment==='whatsapp'){
    btn.disabled=true;btn.textContent='Placing order...';
    try{
      await saveOrderToSupabase(trkId,d,orderItems,subtotal,shipping,total,'whatsapp','pending');
    }catch(e){}
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
function sendShopWhatsApp(trkId,d,items,total,payLabel){
  const itemLines=items.map(i=>i.name+' x'+i.quantity).join(', ');
  const msg='🔔 *New Order!*\n'
    +'*'+trkId+'*\n'
    +itemLines+'\n'
    +'*₹'+total.toLocaleString('en-IN')+'* · '+payLabel+'\n'
    +d.name+' · '+d.phone+'\n'
    +d.city+', '+d.state;
  // Open in background — user sees their confirmation, shop gets notified
  const waUrl='https://wa.me/919217555833?text='+encodeURIComponent(msg);
  // Use an invisible iframe approach or just let the WhatsApp order handle it
  // For COD/Online, we silently notify (no popup) — only WhatsApp order opens chat
  try{
    const a=document.createElement('a');
    a.href=waUrl;a.target='_blank';a.rel='noopener';
    a.style.display='none';
    document.body.appendChild(a);
    // Don't auto-click to avoid popup blockers — only WhatsApp payment opens chat
    // For COD and Online, the shop monitors the admin panel instead
    document.body.removeChild(a);
  }catch(e){}
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
  if(method==='cod') methodNote='Your order will be delivered with Cash on Delivery.';
  else if(method==='whatsapp') methodNote='We\'ll message you on WhatsApp with payment details.';
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
      <button class="btn btn-accent" style="width:100%;margin-top:14px;justify-content:center" onclick="submitCallback()">Send Request →</button>
    </div>`;
    document.body.appendChild(ov);
  }
  ov.classList.add('open');
  setTimeout(function(){initPhoneField('cbPhone')},50);
}
function closeCallbackModal(){document.getElementById('cbOverlay')?.classList.remove('open')}
function submitCallback(){
  const name=document.getElementById('cbName').value.trim();
  const phoneInp=document.getElementById('cbPhone');
  if(phoneInp&&phoneInp._validatePhone&&!phoneInp._validatePhone())return;
  const phone=document.getElementById('cbPhone').value.trim();
  const topic=document.getElementById('cbTopic').value;
  const time=document.getElementById('cbTime').value;
  if(!name||!phone){alert('Please enter your name and phone number.');return;}
  const msg=`*Callback Request*\nName: ${name}\nPhone: ${phone}\nTopic: ${topic}\nBest time: ${time}`;
  window.open('https://wa.me/919217555833?text='+encodeURIComponent(msg),'_blank');
  closeCallbackModal();
}

/* ══ COPY TO CLIPBOARD ═════════════════════════════════════ */
function copyAddress(){
  const addr='Shop No. 25, Karan Singh Market, Chhoti Milak, Greater Noida West, Gautam Buddha Nagar, UP – 201318';
  navigator.clipboard.writeText(addr).then(()=>{
    const btn=document.querySelector('.copy-btn');
    if(btn){const old=btn.textContent;btn.textContent='Copied!';setTimeout(()=>btn.textContent=old,2000)}
  });
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
      // Hide the static Login/Shop button when logged in
      if(shopBtn) shopBtn.style.display='none';
      // Priority: nickname > first name from full_name > email
      const meta=user.user_metadata||{};
      const displayName=meta.nickname||meta.full_name?.split(' ')[0]||'Account';
      const wrap=document.createElement('div');
      wrap.className='nav-auth-wrap';
      wrap.innerHTML=`
        <button class="nav-profile-btn">Hi, ${displayName} ▾</button>
        <div class="nav-profile-dropdown">
          <a href="account.html">My Account</a>
          <a href="account.html#orders">My Orders</a>
          <button class="nav-logout-btn" id="navLogoutBtn">Logout</button>
        </div>`;
      nr.insertBefore(wrap,cartBtn);

      wrap.querySelector('.nav-profile-btn').addEventListener('click',function(e){
        e.stopPropagation();
        wrap.classList.toggle('open');
      });
      wrap.querySelector('#navLogoutBtn').addEventListener('click',function(){
        if(typeof Auth!=='undefined'&&Auth.logout)Auth.logout();
        else{localStorage.removeItem('ta_token');localStorage.removeItem('ta_user');window.location.href='index.html';}
      });
    }
    // When not logged in, the static nav-shop Login button is already in HTML — no dynamic button needed
  });

  // Drawer = menu links only. Login/account lives in the nav bar, same as desktop.
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
function prefillCheckout(){
  try{
    const user=JSON.parse(localStorage.getItem('ta_user'));
    if(!user)return;
    const nameEl=document.getElementById('ckName');
    const emailEl=document.getElementById('ckEmail');
    const phoneEl=document.getElementById('ckPhone');
    if(nameEl&&!nameEl.value&&user.user_metadata?.full_name)nameEl.value=user.user_metadata.full_name;
    if(emailEl&&!emailEl.value&&user.email)emailEl.value=user.email;
    if(phoneEl&&!phoneEl.value&&user.user_metadata?.phone){
      phoneEl.value=user.user_metadata.phone;
      // Trigger phone component autofill split
      const numEl=document.getElementById('ckPhone_num');
      const ccEl=document.getElementById('ckPhone_cc');
      if(numEl&&ccEl){
        const v=user.user_metadata.phone;
        for(const cc of COUNTRY_CODES){
          if(v.startsWith(cc)){ccEl.value=cc;numEl.value=v.slice(cc.length).replace(/\D/g,'');break}
        }
        if(!numEl.value)numEl.value=v.replace(/\D/g,'');
      }
    }
  }catch(e){}
}

/* ══ DOM READY ══════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded',()=>{
  Cart.badge();Cart.render();Cart.loadFromServer();
  updateNavAuth();
});
