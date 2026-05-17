/* TRIAKAR shared.js v5 */

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

const Cart=(function(){
  let items=[];
  try{items=JSON.parse(localStorage.getItem('ta_cart')||'[]')}catch(e){items=[]}
  function save(){try{localStorage.setItem('ta_cart',JSON.stringify(items))}catch(e){}badge()}
  function badge(){const n=items.reduce((s,i)=>s+i.qty,0);document.querySelectorAll('.cart-badge').forEach(b=>{b.textContent=n;b.classList.toggle('on',n>0)})}
  function add(p){const idx=items.findIndex(i=>i.id===p.id&&i.variant===p.variant);idx>-1?items[idx].qty++:items.push({...p,qty:1});save();render();openCart()}
  function changeQty(id,variant,d){const idx=items.findIndex(i=>i.id===id&&i.variant===variant);if(idx<0)return;items[idx].qty+=d;if(items[idx].qty<=0)items.splice(idx,1);save();render()}
  function total(){return items.reduce((s,i)=>s+i.price*i.qty,0)}
  function getItems(){return[...items]}
  function clear(){items=[];save();render()}
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
            <button class="ci-qbtn" onclick="Cart.changeQty('${item.id}','${item.variant||''}', -1)">−</button>
            <span class="ci-qn">${item.qty}</span>
            <button class="ci-qbtn" onclick="Cart.changeQty('${item.id}','${item.variant||''}', 1)">+</button>
          </div>
        </div>
        <div class="ci-price">₹${(item.price*item.qty).toLocaleString('en-IN')}</div>
      </div>`).join('')
  }
  return{add,changeQty,total,getItems,clear,render,badge};
})();

function openCart(){document.getElementById('cartSidebar')?.classList.add('open');document.getElementById('cartOverlay')?.classList.add('open');Cart.render()}
function closeCart(){document.getElementById('cartSidebar')?.classList.remove('open');document.getElementById('cartOverlay')?.classList.remove('open')}

function checkout(){
  const items=Cart.getItems();if(!items.length)return;
  const amount=Cart.total();
  const opts={
    key:'rzp_live_SQfXl2pEG4hZki',
    amount:amount*100,
    currency:'INR',
    name:'TriAkar',
    description:items.length+' item(s)',
    theme:{color:'#C4622A'},
    handler:function(res){
      Cart.clear();closeCart();
      const div=document.createElement('div');
      div.style='position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center';
      div.innerHTML=`<div style="background:white;padding:44px 36px;max-width:400px;width:92%;text-align:center;border-top:4px solid #C4622A">
        <div style="font-size:40px;margin-bottom:14px">✓</div>
        <h3 style="font-size:18px;font-weight:700;margin-bottom:10px">Order Confirmed</h3>
        <p style="font-size:13px;color:#645F59;line-height:1.7;margin-bottom:8px">We'll start making your items right away. Tracking details will be sent by email.</p>
        <p style="font-size:11px;color:#88847E">Payment ID: ${res.razorpay_payment_id}</p>
        <button onclick="this.closest('div[style]').remove()" style="margin-top:20px;padding:12px 28px;background:#161614;color:white;border:none;font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;cursor:pointer;width:100%">Continue Shopping</button>
      </div>`;
      document.body.appendChild(div);
    }
  };
  if(typeof Razorpay==='undefined'){
    const s=document.createElement('script');
    s.src='https://checkout.razorpay.com/v1/checkout.js';
    s.onload=()=>new Razorpay(opts).open();
    document.head.appendChild(s);
  } else new Razorpay(opts).open();
}
document.addEventListener('DOMContentLoaded',()=>{Cart.badge();Cart.render()});