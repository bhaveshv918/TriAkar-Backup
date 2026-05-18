/* TRIAKAR shared.js v6 */

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
  let items=[];
  try{items=JSON.parse(localStorage.getItem('ta_cart')||'[]')}catch(e){items=[]}

  function _syncServer(){
    const tok=localStorage.getItem('ta_token');
    if(!tok)return;
    fetch(_API+'/api/cart',{method:'PUT',headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok},body:JSON.stringify({items})}).catch(()=>{});
  }

  function save(){try{localStorage.setItem('ta_cart',JSON.stringify(items))}catch(e){}badge();_syncServer();}
  function badge(){const n=items.reduce((s,i)=>s+i.qty,0);document.querySelectorAll('.cart-badge').forEach(b=>{b.textContent=n;b.classList.toggle('on',n>0)})}
  function add(p){const idx=items.findIndex(i=>i.id===p.id&&i.variant===p.variant);idx>-1?items[idx].qty++:items.push({...p,qty:1});save();render();openCart()}
  function changeQty(id,variant,d){const idx=items.findIndex(i=>i.id===id&&i.variant===variant);if(idx<0)return;items[idx].qty+=d;if(items[idx].qty<=0)items.splice(idx,1);save();render()}
  function total(){return items.reduce((s,i)=>s+i.price*i.qty,0)}
  function getItems(){return[...items]}
  function clear(){items=[];save();render()}

  async function loadFromServer(){
    const tok=localStorage.getItem('ta_token');
    if(!tok)return;
    try{
      const res=await fetch(_API+'/api/cart',{headers:{'Authorization':'Bearer '+tok}});
      if(!res.ok)return;
      const {items:srv}=await res.json();
      if(srv&&srv.length){items=srv;try{localStorage.setItem('ta_cart',JSON.stringify(items))}catch(e){}}
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
        <div><div class="ci-name">${item.name}</div><div class="ci-var">${item.variant||''}</div>
          <div class="ci-qty">
            <button class="ci-qbtn" onclick="Cart.changeQty('${item.id}','${item.variant||''}',-1)">−</button>
            <span class="ci-qn">${item.qty}</span>
            <button class="ci-qbtn" onclick="Cart.changeQty('${item.id}','${item.variant||''}',1)">+</button>
          </div>
        </div>
        <div class="ci-price">₹${(item.price*item.qty).toLocaleString('en-IN')}</div>
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
  // Refresh cart display
  renderCheckoutCart();
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

    <!-- STEP 2: Customer Details -->
    <div class="ck-step" data-step="2">
      <h3 style="font-size:17px;font-weight:700;margin-bottom:16px">Delivery Details</h3>
      <div class="ck-field"><label>Full Name *</label><input type="text" id="ckName" required></div>
      <div class="ck-field"><label>Phone Number *</label><input type="tel" id="ckPhone" required></div>
      <div class="ck-field"><label>Email *</label><input type="email" id="ckEmail" required></div>
      <div class="ck-field"><label>Delivery Address *</label><textarea id="ckAddress" placeholder="Complete address with landmarks"></textarea></div>
      <div class="ck-field"><label>State *</label>
        <div class="sd-wrap" id="ckStateWrap">
          <input class="sd-input" id="ckState" placeholder="Select state" readonly>
          <div class="sd-dropdown"><input class="sd-search" placeholder="Search state...">${stateOptions}</div>
        </div>
      </div>
      <div class="ck-field"><label>PIN Code *</label><input type="text" id="ckPincode" maxlength="6" pattern="[0-9]{6}" placeholder="6 digits"></div>
      <div class="ck-field"><label>Special Instructions (optional)</label><textarea id="ckNotes" placeholder="Any special requests"></textarea></div>
      <div style="display:flex;gap:10px;margin-top:16px">
        <button class="btn btn-outline" onclick="showCheckoutStep(1)">← Back</button>
        <button class="btn btn-dark" style="flex:1;justify-content:center" onclick="validateAndNext()">Choose Payment →</button>
      </div>
    </div>

    <!-- STEP 3: Payment -->
    <div class="ck-step" data-step="3">
      <h3 style="font-size:17px;font-weight:700;margin-bottom:16px">Payment Method</h3>
      <div class="ck-radio-group" id="ckPaymentGroup">
        <label class="ck-radio selected"><input type="radio" name="ckPay" value="upi" checked><div><div class="ck-radio-label">UPI / GPay / PhonePe</div><div class="ck-radio-desc">Pay via any UPI app</div></div></label>
        <label class="ck-radio"><input type="radio" name="ckPay" value="cod"><div><div class="ck-radio-label">Cash on Delivery</div><div class="ck-radio-desc">Noida orders only</div></div></label>
        <label class="ck-radio"><input type="radio" name="ckPay" value="bank"><div><div class="ck-radio-label">Bank Transfer / NEFT</div><div class="ck-radio-desc">Details shared on WhatsApp</div></div></label>
        <label class="ck-radio"><input type="radio" name="ckPay" value="whatsapp"><div><div class="ck-radio-label">Confirm via WhatsApp</div><div class="ck-radio-desc">We'll message you payment details</div></div></label>
      </div>
      <div style="display:flex;gap:10px;margin-top:16px">
        <button class="btn btn-outline" onclick="showCheckoutStep(2)">← Back</button>
        <button class="btn btn-accent" style="flex:1;justify-content:center" onclick="placeOrder()">Place Order →</button>
      </div>
    </div>

    <!-- STEP 4: Confirmation -->
    <div class="ck-step" data-step="4">
      <div style="text-align:center;padding:24px 0">
        <div style="font-size:48px;margin-bottom:16px">✓</div>
        <h3 style="font-size:20px;font-weight:700;margin-bottom:10px">Order Placed!</h3>
        <p style="font-size:14px;color:var(--warm);margin-bottom:20px">We'll contact you on WhatsApp to confirm.<br>Call us if you need anything:</p>
        <a href="tel:+919217555833" style="font-size:18px;font-weight:700;color:var(--accent);text-decoration:none">+91 92175 55833</a>
        <p style="font-size:12px;color:var(--stone);margin-top:6px">11 AM to 9 PM, all days</p>
        <button class="btn btn-dark" style="margin-top:24px" onclick="closeCheckoutModal()">Done</button>
      </div>
    </div>
  </div>`;
}

function initCheckoutModal(){
  // Init searchable dropdown for state
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
}

function showCheckoutStep(n){
  document.querySelectorAll('.ck-step').forEach(s=>s.classList.toggle('active',parseInt(s.dataset.step)===n));
  document.querySelectorAll('.ck-dot').forEach(d=>d.classList.toggle('active',parseInt(d.dataset.step)<=n));
}

function renderCheckoutCart(){
  const items=Cart.getItems();
  const el=document.getElementById('ckCartItems');
  const tot=document.getElementById('ckCartTotal');
  if(!el)return;
  el.innerHTML=items.map(i=>`<div class="ck-cart-item"><span>${i.name} × ${i.qty}</span><span>₹${(i.price*i.qty).toLocaleString('en-IN')}</span></div>`).join('');
  const shipping=Cart.total()>=999?0:49;
  if(shipping>0) el.innerHTML+=`<div class="ck-cart-item"><span>Shipping</span><span>₹${shipping}</span></div>`;
  if(tot) tot.textContent='₹'+(Cart.total()+shipping).toLocaleString('en-IN');
}

function validateAndNext(){
  const name=document.getElementById('ckName').value.trim();
  const phone=document.getElementById('ckPhone').value.trim();
  const email=document.getElementById('ckEmail').value.trim();
  const addr=document.getElementById('ckAddress').value.trim();
  const state=document.getElementById('ckState').value.trim();
  const pin=document.getElementById('ckPincode').value.trim();

  if(!name||!phone||!email||!addr||!state||!pin){alert('Please fill all required fields.');return;}
  if(!/^\d{6}$/.test(pin)){alert('Please enter a valid 6-digit PIN code.');return;}
  if(!/^\S+@\S+\.\S+$/.test(email)){alert('Please enter a valid email address.');return;}
  showCheckoutStep(3);
}

function placeOrder(){
  const items=Cart.getItems();
  const name=document.getElementById('ckName').value.trim();
  const phone=document.getElementById('ckPhone').value.trim();
  const email=document.getElementById('ckEmail').value.trim();
  const addr=document.getElementById('ckAddress').value.trim();
  const state=document.getElementById('ckState').value.trim();
  const pin=document.getElementById('ckPincode').value.trim();
  const notes=document.getElementById('ckNotes').value.trim();
  const payment=document.querySelector('input[name="ckPay"]:checked')?.value||'upi';
  const shipping=Cart.total()>=999?0:49;
  const total=Cart.total()+shipping;

  // Build order summary
  const itemLines=items.map(i=>`${i.name} x${i.qty} = ₹${(i.price*i.qty).toLocaleString('en-IN')}`).join('\n');
  const orderText=`*New Order - TriAkar*\n\n`
    +`*Items:*\n${itemLines}\n`
    +(shipping?`Shipping: ₹${shipping}\n`:'')
    +`*Total: ₹${total.toLocaleString('en-IN')}*\n\n`
    +`*Customer:* ${name}\n*Phone:* ${phone}\n*Email:* ${email}\n`
    +`*Address:* ${addr}, ${state} - ${pin}\n`
    +(notes?`*Notes:* ${notes}\n`:'')
    +`*Payment:* ${payment.toUpperCase()}`;

  if(payment==='whatsapp'){
    // Open WhatsApp with order
    const waUrl='https://wa.me/919217555833?text='+encodeURIComponent(orderText);
    window.open(waUrl,'_blank');
  } else {
    // Send WhatsApp notification to shop
    const shopUrl='https://wa.me/919217555833?text='+encodeURIComponent(orderText);
    window.open(shopUrl,'_blank');
  }

  Cart.clear();
  showCheckoutStep(4);
}

/* ══ WHATSAPP FLOATING BUTTON ══════════════════════════════ */
(function(){
  // Don't add if page has mobile buy bar (product detail)
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
      <div class="ck-field"><label>Phone Number *</label><input type="tel" id="cbPhone"></div>
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
}
function closeCallbackModal(){document.getElementById('cbOverlay')?.classList.remove('open')}
function submitCallback(){
  const name=document.getElementById('cbName').value.trim();
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

/* ══ DOM READY ══════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded',()=>{Cart.badge();Cart.render();Cart.loadFromServer();});
