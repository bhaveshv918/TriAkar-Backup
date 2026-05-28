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
      <a href="#" class="cart-btn" onclick="openCart();return false;">
        <svg width="17" height="17" viewBox="0 0 18 18" fill="none"><path d="M1 1h2.5l1.6 8h8.4l1.5-5.5H5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="7.5" cy="14.5" r="1.2" fill="currentColor"/><circle cx="13" cy="14.5" r="1.2" fill="currentColor"/></svg>
        Cart <span class="cart-badge" id="cartBadge">0</span>
      </a>
      <a href="/account.html" class="nav-shop">Login</a>
      <button class="nav-toggle" aria-label="Menu" aria-expanded="false"><span></span><span></span><span></span></button>
    </div>
  </div>
</nav>`;

window._DRAWER_HTML = `<nav class="nav-drawer"><a href="/products.html">Shop</a><a href="/custom.html">Custom Order</a><a href="/stories.html">Our Stories</a><a href="/about.html">About</a><a href="/contact.html">Contact</a><a href="/track-order.html">Track Order</a></nav>`;

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
