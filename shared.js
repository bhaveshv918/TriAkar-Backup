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
  const _API=(window.location.hostname==='localhost'||window.location.hostname==='127.0.0.1')?'http://localhost:3000':'';
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
            <button class="ci-qbtn" onclick="Cart.changeQty('${item.id}','${item.variant||''}', -1)">−</button>
            <span class="ci-qn">${item.qty}</span>
            <button class="ci-qbtn" onclick="Cart.changeQty('${item.id}','${item.variant||''}', 1)">+</button>
          </div>
        </div>
        <div class="ci-price">₹${(item.price*item.qty).toLocaleString('en-IN')}</div>
      </div>`).join('')
  }
  return{add,changeQty,total,getItems,clear,render,badge,loadFromServer};
})();

function openCart(){document.getElementById('cartSidebar')?.classList.add('open');document.getElementById('cartOverlay')?.classList.add('open');Cart.render()}
function closeCart(){document.getElementById('cartSidebar')?.classList.remove('open');document.getElementById('cartOverlay')?.classList.remove('open')}

async function checkout(){
  const items=Cart.getItems();
  if(!items.length)return;
  const token=localStorage.getItem('ta_token');
  if(!token){window.location.href='account.html';return;}
  const btns=document.querySelectorAll('[onclick*="checkout"]');
  btns.forEach(b=>{b.disabled=true;b._origText=b.textContent;b.textContent='Processing…';});
  try{
    const _API=(window.location.hostname==='localhost'||window.location.hostname==='127.0.0.1')?'http://localhost:3000':'';
    const cartItems=items.map(i=>({slug:i.id,quantity:i.qty,customization_notes:i.customization_notes||null}));
    const res=await fetch(_API+'/api/payments/checkout',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
      body:JSON.stringify({items:cartItems,shipping_address:{}}),
    });
    const data=await res.json();
    if(!res.ok)throw new Error(data.error||'Checkout failed');
    Cart.clear();
    window.location.href=data.url;
  }catch(err){
    btns.forEach(b=>{b.disabled=false;b.textContent=b._origText||'Checkout →';});
    alert('Checkout error: '+err.message);
  }
}
document.addEventListener('DOMContentLoaded',()=>{Cart.badge();Cart.render();Cart.loadFromServer();});

(function(){
  const token = localStorage.getItem('ta_token');
  let label = 'Login';
  if (token) {
    try {
      const user = JSON.parse(localStorage.getItem('ta_user') || '{}');
      const name = (user.user_metadata && user.user_metadata.full_name) || user.email || '';
      label = name.split(' ')[0] || 'Account';
    } catch(_) {}
  }
  document.querySelectorAll('.nav-links').forEach(function(nav) {
    const li = document.createElement('li');
    const a  = document.createElement('a');
    a.href = 'account.html'; a.textContent = label; a.className = 'nav-auth-link';
    li.appendChild(a); nav.appendChild(li);
  });
  document.querySelectorAll('.nav-drawer').forEach(function(nav) {
    const a = document.createElement('a');
    a.href = 'account.html'; a.textContent = label; a.className = 'nav-auth-link';
    nav.appendChild(a);
  });
})();