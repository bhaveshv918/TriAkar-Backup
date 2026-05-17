/* TRIAKAR shared.js v6 */

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
      drawer.classList.remove('open');
      toggle.classList.remove('open');
    }));
  }
  const path=window.location.pathname.split('/').pop()||'index.html';
  document.querySelectorAll('.nav-links a,.nav-drawer a').forEach(a=>{
    if(a.getAttribute('href')===path) a.style.cssText='color:var(--charcoal);font-weight:700';
  });
})();

(function(){
  const obs=new IntersectionObserver(entries=>entries.forEach(e=>{
    if(e.isIntersecting){e.target.classList.add('on');obs.unobserve(e.target)}
  }),{threshold:.05,rootMargin:'0px 0px -24px 0px'});
  document.querySelectorAll('.r').forEach(el=>obs.observe(el));
})();

/* ══ CART ════════════════════════════════════════════════════════════════ */
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

/* ══ CHECKOUT MODAL ══════════════════════════════════════════════════════ */

const _coAPI=window.location.hostname==='localhost'?'http://localhost:3000':'https://triakar.onrender.com';
let _coSavedAddress=null;
let _coCurrentAddress=null;

function _coInjectModal(){
  if(document.getElementById('coModal'))return;
  const div=document.createElement('div');
  div.innerHTML=`
<div id="coModal" class="co-overlay" onclick="if(event.target===this)_coClose()">
  <div class="co-box">

    <div class="co-hdr">
      <div class="co-hdr-left">
        <div class="co-brand">Checkout</div>
        <div class="co-steps">
          <span class="co-step-dot active" id="csDot1">1</span>
          <span class="co-step-arr">→</span>
          <span class="co-step-dot" id="csDot2">2</span>
          <span class="co-step-label active" id="csLbl1">Address</span>
          <span class="co-step-arr" id="csArr" style="display:none">→</span>
          <span class="co-step-label" id="csLbl2" style="display:none">Review</span>
        </div>
      </div>
      <button class="co-close" onclick="_coClose()" aria-label="Close">&#x2715;</button>
    </div>

    <!-- Step 1: Address -->
    <div id="coS1" class="co-body">
      <div class="co-step-title">Shipping Address</div>

      <div id="coSavedCard" class="co-saved-card" style="display:none">
        <div>
          <div class="co-saved-tag">Saved</div>
          <div class="co-saved-name" id="coSavedName"></div>
          <div class="co-saved-city" id="coSavedCity"></div>
        </div>
        <button class="co-use-btn" onclick="_coUseSaved()">Use this →</button>
      </div>

      <form id="coForm" class="co-form" onsubmit="_coSubmitAddress(event)">
        <div class="co-row2">
          <div class="co-fld"><label>Full Name *</label><input name="full_name" placeholder="Your full name" required></div>
          <div class="co-fld"><label>Phone *</label><input name="phone" placeholder="+91 98765 43210" required></div>
        </div>
        <div class="co-fld"><label>Address Line 1 *</label><input name="address_line1" placeholder="House / Flat no., Street, Area" required></div>
        <div class="co-fld"><label>Address Line 2</label><input name="address_line2" placeholder="Landmark (optional)"></div>
        <div class="co-row3">
          <div class="co-fld"><label>City *</label><input name="city" placeholder="Mumbai" required></div>
          <div class="co-fld"><label>State *</label><input name="state" placeholder="Maharashtra" required></div>
          <div class="co-fld"><label>Pincode *</label><input name="pincode" placeholder="400001" required></div>
        </div>
        <div class="co-fld"><label>Country</label><input name="country" value="India"></div>
        <button type="submit" class="co-btn-primary" id="coAddrBtn">Continue to Review →</button>
      </form>
    </div>

    <!-- Step 2: Review & Pay -->
    <div id="coS2" class="co-body" style="display:none">
      <div class="co-step-title">Review &amp; Pay</div>
      <div class="co-rv-items" id="coRvItems"></div>
      <div class="co-rv-total">
        <span class="co-rv-total-label">Total</span>
        <span class="co-rv-total-val" id="coRvTotal"></span>
      </div>
      <div class="co-addr-block">
        <div>
          <div class="co-addr-label">Delivering to</div>
          <div class="co-addr-val" id="coRvAddr"></div>
        </div>
        <button class="co-edit-btn" onclick="_coBackToAddr()">Edit</button>
      </div>
      <button class="co-btn-primary" id="coPayBtn" onclick="_coPlaceOrder()">Pay <span id="coPayAmt"></span> →</button>
      <div class="co-secure">🔒 Secured by Razorpay</div>
    </div>

    <!-- Loading -->
    <div id="coLoadingBody" class="co-loading-body" style="display:none">Processing payment…</div>

  </div>
</div>`;
  document.body.appendChild(div.firstChild);
}

async function checkout(){
  const items=Cart.getItems();
  if(!items.length)return;
  const token=localStorage.getItem('ta_token');
  if(!token){closeCart();window.location.href='account.html';return;}

  _coInjectModal();
  document.getElementById('coModal').classList.add('open');
  document.body.style.overflow='hidden';
  _coShowStep(1);

  // Load saved address in background
  _coFetchSavedAddress();
}

function _coClose(){
  document.getElementById('coModal')?.classList.remove('open');
  document.body.style.overflow='';
}

function _coShowStep(n){
  document.getElementById('coS1').style.display=n===1?'':'none';
  document.getElementById('coS2').style.display=n===2?'':'none';
  document.getElementById('coLoadingBody').style.display='none';
  document.getElementById('csDot1').classList.toggle('active',true);
  document.getElementById('csDot2').classList.toggle('active',n===2);
  document.getElementById('csLbl1').classList.toggle('active',n===1);
  document.getElementById('csLbl2').classList.toggle('active',n===2);
  document.getElementById('csLbl2').style.display=n===2?'':'none';
  document.getElementById('csArr').style.display=n===2?'':'none';
}

async function _coFetchSavedAddress(){
  const token=localStorage.getItem('ta_token');
  try{
    const res=await fetch(_coAPI+'/api/addresses/default',{headers:{'Authorization':'Bearer '+token}});
    if(!res.ok)return;
    const {address}=await res.json();
    if(!address)return;
    _coSavedAddress=address;
    // Show saved banner and pre-fill form
    const card=document.getElementById('coSavedCard');
    if(card){
      document.getElementById('coSavedName').textContent=address.full_name;
      document.getElementById('coSavedCity').textContent=address.city+', '+address.state+' '+address.pincode;
      card.style.display='flex';
    }
    _coFillForm(address);
  }catch(_){}
}

function _coFillForm(addr){
  const form=document.getElementById('coForm');
  if(!form)return;
  ['full_name','phone','address_line1','address_line2','city','state','pincode','country'].forEach(k=>{
    if(form[k])form[k].value=addr[k]||'';
  });
}

function _coUseSaved(){
  if(_coSavedAddress)_coFillForm(_coSavedAddress);
  document.getElementById('coSavedCard')?.style.setProperty('display','none');
}

async function _coSubmitAddress(e){
  e.preventDefault();
  const form=document.getElementById('coForm');
  const btn=document.getElementById('coAddrBtn');
  btn.disabled=true;btn.textContent='Saving…';

  const data=Object.fromEntries(new FormData(form));
  const token=localStorage.getItem('ta_token');

  try{
    const res=await fetch(_coAPI+'/api/addresses',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
      body:JSON.stringify(data),
    });
    const result=await res.json();
    _coCurrentAddress=res.ok?result.address:{...data,id:null};
  }catch(_){
    _coCurrentAddress={...data,id:null};
  }

  btn.disabled=false;btn.textContent='Continue to Review →';
  _coShowStep(2);
  _coRenderReview();
}

function _coBackToAddr(){
  _coShowStep(1);
  if(_coCurrentAddress)_coFillForm(_coCurrentAddress);
}

function _coRenderReview(){
  const items=Cart.getItems();
  const addr=_coCurrentAddress;
  const total=Cart.total();

  document.getElementById('coRvItems').innerHTML=items.map(i=>`
    <div class="co-rv-item">
      <div><div class="co-rv-name">${i.name}</div><div class="co-rv-qty">Qty ${i.qty}</div></div>
      <div class="co-rv-price">₹${(i.price*i.qty).toLocaleString('en-IN')}</div>
    </div>`).join('');

  document.getElementById('coRvTotal').textContent='₹'+total.toLocaleString('en-IN');
  document.getElementById('coPayAmt').textContent='₹'+total.toLocaleString('en-IN');

  if(addr){
    document.getElementById('coRvAddr').innerHTML=
      `<strong>${addr.full_name}</strong><br>`+
      `${addr.address_line1}${addr.address_line2?', '+addr.address_line2:''}<br>`+
      `${addr.city}, ${addr.state} ${addr.pincode}<br>`+
      `${addr.phone}`;
  }
}

async function _coPlaceOrder(){
  const items=Cart.getItems();
  const token=localStorage.getItem('ta_token');
  const addr=_coCurrentAddress;
  const payBtn=document.getElementById('coPayBtn');

  payBtn.disabled=true;payBtn.textContent='Processing…';

  try{
    const cartItems=items.map(i=>({slug:i.id,quantity:i.qty,customization_notes:i.customization_notes||null}));

    const res=await fetch(_coAPI+'/api/payments/create-order',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
      body:JSON.stringify({items:cartItems,shipping_address:addr||{},address_id:addr?.id||null}),
    });
    const data=await res.json();
    if(!res.ok)throw new Error(data.error||'Could not initiate payment');

    // Load Razorpay SDK
    await new Promise((resolve,reject)=>{
      if(window.Razorpay){resolve();return;}
      const s=document.createElement('script');
      s.src='https://checkout.razorpay.com/v1/checkout.js';
      s.onload=resolve;
      s.onerror=()=>reject(new Error('Could not load payment gateway'));
      document.head.appendChild(s);
    });

    const rzp=new window.Razorpay({
      key:data.key_id,
      amount:data.amount,
      currency:data.currency,
      name:'TriAkar',
      description:'Premium 3D Printed Products',
      order_id:data.razorpay_order_id,
      prefill:addr?{name:addr.full_name,contact:addr.phone}:{},
      theme:{color:'#161614'},
      handler:async function(response){
        document.getElementById('coS2').style.display='none';
        document.getElementById('coLoadingBody').style.display='';

        const vRes=await fetch(_coAPI+'/api/payments/verify',{
          method:'POST',
          headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
          body:JSON.stringify({
            razorpay_order_id:response.razorpay_order_id,
            razorpay_payment_id:response.razorpay_payment_id,
            razorpay_signature:response.razorpay_signature,
            order_id:data.order_id,
          }),
        });
        const vData=await vRes.json();
        if(!vRes.ok)throw new Error(vData.error||'Payment verification failed');
        Cart.clear();
        _coClose();
        window.location.href='order-confirmation.html?order_id='+data.order_id;
      },
      modal:{
        ondismiss:function(){
          payBtn.disabled=false;
          payBtn.textContent='Pay ₹'+Cart.total().toLocaleString('en-IN')+' →';
          document.getElementById('coPayAmt').textContent='₹'+Cart.total().toLocaleString('en-IN');
        }
      }
    });
    rzp.on('payment.failed',function(r){
      payBtn.disabled=false;
      payBtn.textContent='Pay ₹'+Cart.total().toLocaleString('en-IN')+' →';
      alert('Payment failed: '+r.error.description);
    });
    rzp.open();

  }catch(err){
    payBtn.disabled=false;
    payBtn.textContent='Pay ₹'+Cart.total().toLocaleString('en-IN')+' →';
    document.getElementById('coS2').style.display='';
    document.getElementById('coLoadingBody').style.display='none';
    alert('Checkout error: '+err.message);
  }
}

/* ══ DOM READY ═══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded',()=>{
  Cart.badge();
  Cart.render();
  Cart.loadFromServer();
});

/* ══ AUTH NAV LINK ═══════════════════════════════════════════════════════ */
(function(){
  const token=localStorage.getItem('ta_token');
  let label='Login';
  if(token){
    try{
      const user=JSON.parse(localStorage.getItem('ta_user')||'{}');
      const name=(user.user_metadata&&user.user_metadata.full_name)||user.email||'';
      label=name.split(' ')[0]||'Account';
    }catch(_){}
  }
  document.querySelectorAll('.nav-links').forEach(function(nav){
    const li=document.createElement('li');
    const a=document.createElement('a');
    a.href='account.html';a.textContent=label;a.className='nav-auth-link';
    li.appendChild(a);nav.appendChild(li);
  });
  document.querySelectorAll('.nav-drawer').forEach(function(nav){
    const a=document.createElement('a');
    a.href='account.html';a.textContent=label;a.className='nav-auth-link';
    nav.appendChild(a);
  });
})();
