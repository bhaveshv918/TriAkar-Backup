/* Rendered-contrast auditor, run in the page via the browser tools.
   Walks every element that owns text, resolves its real background by blending
   the ancestor stack (glass surfaces are semi-transparent, so the nearest
   background-color is not the whole story), and reports anything under the WCAG
   AA threshold for its size. Dedupes by class+colour so one bad rule is one row. */
window.__taContrast = function(){
  var L=function(r,g,b){var f=function(v){v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};return .2126*f(r)+.7152*f(g)+.0722*f(b)};
  var parse=function(c){var m=/rgba?\(([^)]+)\)/.exec(c);if(!m)return null;var p=m[1].split(',').map(parseFloat);return {r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1}};
  var blend=function(f,b){return {r:f.r*f.a+b.r*(1-f.a),g:f.g*f.a+b.g*(1-f.a),b:f.b*f.a+b.b*(1-f.a),a:1}};
  /* A gradient used to return null here, which skipped the element entirely. The
     footer and every .page-hero paint gradients, so that one line hid the whole
     footer from the audit, and a site-wide grey darkening shipped with footer
     links at 2.9:1. A gradient is not unknowable: its own colour stops are in the
     computed value. Take them, judge the text against each, and keep the worst.
     Returns null only for a real image, where the backdrop genuinely is unknown. */
  function stopsOf(bi){
    var m=bi.match(/rgba?\([^)]*\)/g);
    if(!m) return null;
    var s=m.map(parse).filter(Boolean);
    return s.length?s:null;
  }
  function bgOf(el){
    var stack=[],n=el,bases=null;
    while(n&&n!==document.documentElement){
      var cs=getComputedStyle(n);
      var bi=cs.backgroundImage;
      if(bi&&bi!=='none'){
        var st=stopsOf(bi);
        if(!st) return null;   // url(), a real image, backdrop unknown
        if(st.some(function(s){return s.a===1})){
          bases=st.map(function(s){return {r:s.r,g:s.g,b:s.b,a:1}});
          break;               // an opaque gradient is the backdrop
        }
        /* A gradient whose stops are all translucent is a tint over whatever is
           behind it, not a backdrop. Treating it as one turned the glass panel on
           the About hero into "white", and reported its white text as 1:1. Keep
           the most opaque stop as another layer and carry on up the chain. */
        st.sort(function(a,b){return b.a-a.a});
        stack.push(st[0]);
      }
      /* A glass card in normal flow sits over its own section, so blending it
         down the ancestor chain is right and the whole liquid-glass UI stays in
         scope. A *fixed* glass surface (cart drawer, modals) floats over
         arbitrary page content instead, and reading the ancestors through it
         reported the cart drawer's dark-on-light heading as 1:1. Only that case
         is unmeasurable. */
      if(cs.position==='fixed'&&
         ((cs.backdropFilter&&cs.backdropFilter!=='none')||
          (cs.webkitBackdropFilter&&cs.webkitBackdropFilter!=='none'))) return null;
      var c=parse(cs.backgroundColor);
      if(c&&c.a>0){stack.push(c); if(c.a===1)break;}
      n=n.parentElement;
    }
    if(!bases) bases=[{r:255,g:255,b:255,a:1}];
    return bases.map(function(base){
      var b=base;
      for(var i=stack.length-1;i>=0;i--) b=blend(stack[i],b);
      return b;
    });
  }
  var out=[],seen={};
  [].forEach.call(document.querySelectorAll('body *'),function(el){
    var own='';
    for(var i=0;i<el.childNodes.length;i++) if(el.childNodes[i].nodeType===3) own+=el.childNodes[i].textContent.trim();
    if(!own) return;
    var cs=getComputedStyle(el);
    if(cs.visibility==='hidden'||cs.display==='none'||parseFloat(cs.opacity)===0) return;
    if(cs.webkitTextFillColor==='rgba(0, 0, 0, 0)') return;  // gradient-clipped headings
    var r=el.getBoundingClientRect(); if(!r.width||!r.height) return;
    /* SVG text is painted with fill, not color. Reading color reported the ivory
       label on the track-order illustration as dark-on-dark. */
    var isSvgText=(el.ownerSVGElement||el.namespaceURI==='http://www.w3.org/2000/svg');
    var fgc=parse(isSvgText?(cs.fill||cs.color):cs.color); if(!fgc) return;
    var bgs=bgOf(el); if(!bgs) return;
    /* Over a gradient the text has to hold up against every stop, so the worst
       one is the honest score. */
    var ratio=Infinity, bg=null;
    bgs.forEach(function(b){
      var fg=blend(fgc,b);
      var l1=L(fg.r,fg.g,fg.b), l2=L(b.r,b.g,b.b);
      var ra=(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);
      if(ra<ratio){ratio=ra;bg=b;}
    });
    var size=parseFloat(cs.fontSize), bold=parseInt(cs.fontWeight,10)>=700;
    var need=(size>=24||(size>=18.66&&bold))?3:4.5;
    if(ratio>=need) return;
    var key=el.tagName+'|'+(el.className||'')+'|'+cs.color;
    if(seen[key]){seen[key].n++;return}
    seen[key]={tag:el.tagName,cls:String(el.className||'').slice(0,60),color:cs.color,
      bg:'rgb('+Math.round(bg.r)+','+Math.round(bg.g)+','+Math.round(bg.b)+')',
      ratio:Math.round(ratio*100)/100,need:need,size:size,text:own.slice(0,44),n:1};
    out.push(seen[key]);
  });
  out.sort(function(a,b){return a.ratio-b.ratio});
  return {fails:out.length,instances:out.reduce(function(s,o){return s+o.n},0),items:out.slice(0,25)};
};
