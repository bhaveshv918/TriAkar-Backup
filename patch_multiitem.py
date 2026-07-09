import sys, re
sys.stdout.reconfigure(encoding='utf-8')
content = open('admin-biz.html', encoding='utf-8').read()

# ── 1. Replace Product + Pricing sections with multi-item UI ──────────────
OLD_BLOCK = '''        <!-- ── Product ──────────────────────────── -->
        <div style="font-size:10px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--text-3);margin-bottom:8px;margin-top:4px">Product</div>
        <div class="form-grid">
          <div class="form-group" style="grid-column:span 2">
            <label>Product from catalog</label>
            <select id="qa_product" onchange="onProductSelect()">
              <option value="">— select or enter manually below —</option>
              <option value="__custom">— Enter manually —</option>
            </select>
          </div>
          <div class="form-group" id="qa_customNameGroup" style="grid-column:span 2">
            <label>Product Name</label>
            <input type="text" id="qa_customName" placeholder="Product name">
          </div>
          <div class="form-group">
            <label>Size</label>
            <input type="text" id="qa_size" placeholder="e.g. Small, 6 inch, A4">
          </div>
          <div class="form-group">
            <label>Color</label>
            <input type="text" id="qa_color" placeholder="e.g. Black, White">
          </div>
          <div class="form-group">
            <label>Variant / Customization</label>
            <input type="text" id="qa_variant" placeholder="e.g. Name engraved, Logo print">
          </div>
          <div class="form-group">
            <label>Qty</label>
            <input type="number" id="qa_qty" value="1" min="1" onchange="recalc()">
          </div>
          <div class="form-group">
            <label>Weight (grams)</label>
            <input type="number" id="qa_weight" placeholder="e.g. 250">
          </div>
        </div>

        <!-- ── Pricing ──────────────────────────── -->
        <div style="font-size:10px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--text-3);margin-bottom:8px;margin-top:4px">Pricing</div>
        <div class="form-grid">
          <div class="form-group">
            <label>Selling Price (₹, incl. GST)</label>
            <input type="number" id="qa_price" step="0.01" placeholder="0.00" onchange="recalc()">
          </div>
          <div class="form-group">
            <label>Discount / Coupon (₹)</label>
            <input type="number" id="qa_discount" step="0.01" value="0" onchange="recalc()">
          </div>
          <div class="form-group">
            <label>Platform Fee (₹)</label>
            <input type="number" id="qa_platformfee" step="0.01" value="0" onchange="recalc()">
          </div>
          <div class="form-group">
            <label>Outward Shipping Cost (₹)</label>
            <input type="number" id="qa_shipping" step="0.01" value="0" onchange="recalc()">
          </div>
          <div class="form-group">
            <label>GST Rate (%)</label>
            <select id="qa_gst" onchange="recalc()">
              <option value="0">0%</option>
              <option value="5">5%</option>
              <option value="12">12%</option>
              <option value="18" selected>18%</option>
              <option value="28">28%</option>
            </select>
          </div>
        </div>

        <!-- COGS breakdown -->'''

NEW_BLOCK = '''        <!-- ── Items ────────────────────────────── -->
        <div style="font-size:10px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--text-3);margin-bottom:8px;margin-top:4px">Items</div>
        <div style="display:grid;grid-template-columns:1.8fr 1.5fr 60px 90px 80px 36px;gap:5px;margin-bottom:4px;padding:0 1px">
          <span style="font-size:10px;color:var(--text-3)">Product (catalog)</span>
          <span style="font-size:10px;color:var(--text-3)">Name / Variant</span>
          <span style="font-size:10px;color:var(--text-3);text-align:right">Qty</span>
          <span style="font-size:10px;color:var(--text-3);text-align:right">Price ₹</span>
          <span style="font-size:10px;color:var(--text-3);text-align:right">COGS ₹</span>
          <span></span>
        </div>
        <div id="qa_itemRows"></div>
        <button type="button" class="btn btn-ghost btn-sm" onclick="addQAItem()" style="margin-top:4px;margin-bottom:12px">+ Add Item</button>

        <!-- ── Order-level Pricing ──────────────── -->
        <div style="font-size:10px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--text-3);margin-bottom:8px">Fees &amp; Deductions</div>
        <div class="form-grid">
          <div class="form-group">
            <label>Platform Fee %</label>
            <input type="number" id="qa_platformfee_pct" step="0.1" placeholder="0" value="">
          </div>
          <div class="form-group">
            <label>Shipping Fee ₹</label>
            <input type="number" id="qa_shipping" step="0.01" value="0">
          </div>
          <div class="form-group">
            <label>Other Deductions ₹</label>
            <input type="number" id="qa_other" step="0.01" value="0">
          </div>
          <div class="form-group">
            <label>Default GST %</label>
            <select id="qa_gst">
              <option value="0">0%</option>
              <option value="5">5%</option>
              <option value="12">12%</option>
              <option value="18" selected>18%</option>
              <option value="28">28%</option>
            </select>
          </div>
        </div>

        <!-- COGS breakdown -->'''

if OLD_BLOCK in content:
    content = content.replace(OLD_BLOCK, NEW_BLOCK, 1)
    print('HTML block replaced')
else:
    # try CRLF
    if OLD_BLOCK.replace('\n','\r\n') in content:
        content = content.replace(OLD_BLOCK.replace('\n','\r\n'), NEW_BLOCK, 1)
        print('HTML block replaced CRLF')
    else:
        print('BLOCK NOT FOUND')
        exit(1)

# ── 2. Replace submitQuickAdd ─────────────────────────────────────────────
idx_submit = content.find('async function submitQuickAdd(e){')
idx_next   = content.find('\nasync function saveAndPrint', idx_submit)
if idx_next == -1:
    idx_next = content.find('\nfunction resetQuickAdd', idx_submit)
print(f'submitQuickAdd spans {idx_submit}..{idx_next}')

NEW_SUBMIT = '''async function submitQuickAdd(e){
  e.preventDefault();
  const items=getQAItems();
  if(!items.length){toast('Add at least one item','error');return;}
  if(items.some(it=>!it.productName)){toast('All items need a product name','error');return;}
  const g=id=>{const el=document.getElementById(id);return el?el.value.trim()||null:null;};
  const gn=id=>parseFloat(document.getElementById(id)?.value)||0;
  const sharedOrderId=g('qa_orderid')||genOrderId();
  const feePct=gn('qa_platformfee_pct');
  const shippingFee=gn('qa_shipping');
  const otherDed=gn('qa_other');
  const shared={
    channel_id:g('qa_channel'),
    order_id:sharedOrderId,
    order_date:g('qa_date')||today(),
    delivery_date:g('qa_delivery_date')||null,
    dispatch_date:g('qa_dispatch_date')||null,
    payment_mode:g('qa_payment'),
    status:g('qa_status')||'completed',
    customer_name:g('qa_cname'),
    customer_phone:g('qa_phone'),
    customer_city:g('qa_city'),
    customer_state:g('qa_state'),
    customer_pincode:g('qa_pin'),
    tracking_number:g('qa_tracking'),
    courier_partner:g('qa_courier'),
    notes:g('qa_notes'),
    import_source:'manual',
    is_paid:false,
  };
  const rows=items.map((it,i)=>({
    ...shared,
    product_id:it.productId||null,
    product_name:it.productName,
    sku:it.sku||null,
    qty:it.qty,
    selling_price:it.price,
    platform_fee:feePct?+(it.price*feePct/100).toFixed(2):0,
    shipping_fee:i===0?shippingFee:0,
    other_deductions:i===0?otherDed:0,
    cogs:it.cogs,
    gst_rate:it.gst,
  }));
  const {error}=await sb.from('biz_sales').insert(rows);
  if(error){toast('Error: '+error.message,'error');return;}
  // Auto-save new custom product names to catalog
  for(const it of items){
    if(!it.productId&&it.productName&&it.productName!=='—'){
      const exists=_products.find(p=>p.name.trim().toLowerCase()===it.productName.trim().toLowerCase());
      if(!exists){
        const {data:np}=await sb.from('biz_products').insert({name:it.productName,product_type:'own',is_active:true}).select().single();
        if(np) _products.push(np);
      }
    }
  }
  toast(rows.length===1?'Sale saved!':rows.length+' items saved!');
  resetQuickAdd();
  loadSalesBadge();
  await loadProducts();
}

'''
content = content[:idx_submit] + NEW_SUBMIT + content[idx_next:]
print('submitQuickAdd replaced')

# ── 3. Replace resetQuickAdd ──────────────────────────────────────────────
OLD_RESET = "function resetQuickAdd(){ document.getElementById('quickAddForm').reset(); _cogsItems=[]; renderCogsRows(); document.getElementById('qa_date').value=today(); document.getElementById('qa_delivery_date').value=today(); document.getElementById('qa_state').value='Uttar Pradesh'; document.getElementById('qa_channel').value='shop'; }"
NEW_RESET = """function resetQuickAdd(){
  document.getElementById('quickAddForm').reset();
  _cogsItems=[]; renderCogsRows();
  document.getElementById('qa_date').value=today();
  document.getElementById('qa_delivery_date').value=today();
  document.getElementById('qa_state').value='Uttar Pradesh';
  document.getElementById('qa_channel').value='shop';
  _qaItems=[{productId:'',productName:'',sku:'',qty:1,price:0,cogs:0,gst:18}];
  renderQAItems();
}"""
if OLD_RESET in content:
    content = content.replace(OLD_RESET, NEW_RESET, 1)
    print('resetQuickAdd replaced')
else:
    OLD_RESET2 = OLD_RESET.replace('\n','\r\n')
    if OLD_RESET2 in content:
        content = content.replace(OLD_RESET2, NEW_RESET, 1)
        print('resetQuickAdd replaced CRLF')
    else:
        print('WARNING: resetQuickAdd not found')

# ── 4. Insert multi-item JS before submitQuickAdd ─────────────────────────
ITEM_JS = r"""// ── Quick Add multi-item ─────────────────────────────────────
let _qaItems=[{productId:'',productName:'',sku:'',qty:1,price:0,cogs:0,gst:18}];

function renderQAItems(){
  const wrap=document.getElementById('qa_itemRows');
  if(!wrap) return;
  const defGst=parseInt(document.getElementById('qa_gst')?.value||18);
  const gstOpts=[0,5,12,18,28].map(v=>`<option value="${v}"${v===defGst?'':''}>` + v + '%</option>').join('');
  const prodOpts=_products.map(p=>`<option value="${p.id}" data-sku="${p.sku||''}" data-cost="${p.base_cost||0}" data-gst="${p.gst_rate||18}">${esc(p.name)}${p.sku?' ('+p.sku+')':''}</option>`).join('');
  const inpStyle='background:var(--bg-2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);padding:5px 7px;font-size:12px;width:100%';
  wrap.innerHTML=_qaItems.map((it,i)=>{
    const selOpts=`<option value="">— catalog —</option><option value="__custom"${!it.productId?' selected':''}>— manual —</option>`+prodOpts.replace(`value="${it.productId}"`,`value="${it.productId}" selected`);
    return `<div style="display:grid;grid-template-columns:1.8fr 1.5fr 60px 90px 80px 36px;gap:5px;margin-bottom:6px;align-items:center">
      <select onchange="onQAItemProduct(${i},this)" style="${inpStyle};">${selOpts}</select>
      <input type="text" value="${esc(it.productName)}" placeholder="Name / variant" oninput="_qaItems[${i}].productName=this.value" style="${inpStyle}">
      <input type="number" value="${it.qty}" min="1" onchange="_qaItems[${i}].qty=parseInt(this.value)||1" style="${inpStyle};text-align:right">
      <input type="number" value="${it.price||''}" step="0.01" placeholder="0.00" onchange="_qaItems[${i}].price=parseFloat(this.value)||0" style="${inpStyle};text-align:right;font-family:var(--mono)">
      <input type="number" value="${it.cogs||''}" step="0.01" placeholder="0.00" onchange="_qaItems[${i}].cogs=parseFloat(this.value)||0" style="${inpStyle};text-align:right;font-family:var(--mono)">
      <button type="button" onclick="removeQAItem(${i})" style="background:none;border:1px solid var(--border);border-radius:var(--radius);color:var(--text-3);cursor:pointer;padding:4px 8px;font-size:13px;width:36px"${_qaItems.length<=1?' disabled':''}>✕</button>
    </div>`;
  }).join('');
}
function addQAItem(){
  const defGst=parseInt(document.getElementById('qa_gst')?.value||18);
  _qaItems.push({productId:'',productName:'',sku:'',qty:1,price:0,cogs:0,gst:defGst});
  renderQAItems();
}
function removeQAItem(i){
  if(_qaItems.length<=1) return;
  _qaItems.splice(i,1);
  renderQAItems();
}
function onQAItemProduct(i,sel){
  const val=sel.value;
  if(val&&val!=='__custom'){
    const opt=sel.options[sel.selectedIndex];
    _qaItems[i].productId=val;
    _qaItems[i].sku=opt.dataset.sku||'';
    _qaItems[i].cogs=parseFloat(opt.dataset.cost)||0;
    _qaItems[i].gst=parseFloat(opt.dataset.gst)||18;
    _qaItems[i].productName=opt.textContent.replace(/\s*\(.*\)$/,'').trim();
  } else {
    _qaItems[i].productId='';
    _qaItems[i].sku='';
    if(val==='__custom') _qaItems[i].productName='';
  }
  renderQAItems();
}
function getQAItems(){
  return _qaItems.filter(it=>it.productName||(it.price>0));
}

"""
idx_before = content.find('async function submitQuickAdd(e){')
content = content[:idx_before] + ITEM_JS + content[idx_before:]
print('Multi-item JS inserted')

# ── 5. populateProductSelects: call renderQAItems at end ─────────────────
OLD_PPS_END = "  document.getElementById('sm_product').innerHTML = `<option value=\"\">Select product</option>${opts}`;\n}"
NEW_PPS_END = "  document.getElementById('sm_product').innerHTML = `<option value=\"\">Select product</option>${opts}`;\n  renderQAItems();\n}"
if OLD_PPS_END in content:
    content = content.replace(OLD_PPS_END, NEW_PPS_END, 1)
    print('populateProductSelects updated')
else:
    print('WARNING: populateProductSelects end not found')

# ── 6. Init: call renderQAItems after page load ───────────────────────────
INIT_TARGET = "document.getElementById('qa_state').value='Uttar Pradesh';"
INIT_REPLACE = "document.getElementById('qa_state').value='Uttar Pradesh';\n  renderQAItems();"
if INIT_TARGET in content:
    # Only replace the FIRST occurrence (init block)
    idx_t = content.find(INIT_TARGET)
    content = content[:idx_t] + INIT_REPLACE + content[idx_t+len(INIT_TARGET):]
    print('Init renderQAItems added')
else:
    print('WARNING: init target not found')

open('admin-biz.html', 'w', encoding='utf-8').write(content)
print('ALL DONE')
