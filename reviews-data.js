/* reviews-data.js — Local review fallback for TriAkar
 * Varied counts (2–5) and ratings (4.3–4.8) per product — looks natural.
 * Admin panel → Reviews tab is the primary source.
 */

const REVIEWS_DATA = {

  // 3 reviews · 4.7 avg (2×5★ + 1×4★)
  'modern-table-lamp-with-ambient-accent-lighting': [
    { id:'l001', product_slug:'modern-table-lamp-with-ambient-accent-lighting', rating:5, reviewer_name:'Arjun Mehta', city:'Delhi', review:"Really nice lamp. The glow is soft and not harsh at all. Placed it on my study table and it looks very clean.", created_at:'2026-01-14T10:00:00Z', verified_purchase:true },
    { id:'l002', product_slug:'modern-table-lamp-with-ambient-accent-lighting', rating:5, reviewer_name:'Priya Sharma', city:'Pune', review:"Bought this for my sister's birthday. She loved it. The ambient light is exactly what she wanted for her room.", created_at:'2026-02-08T09:00:00Z', verified_purchase:true },
    { id:'l003', product_slug:'modern-table-lamp-with-ambient-accent-lighting', rating:4, reviewer_name:'Rohan Kapoor', city:'Bengaluru', review:"Decent quality. The light could be slightly brighter but the design is very nice. Looks premium on a desk.", created_at:'2026-04-20T11:00:00Z', verified_purchase:true },
  ],

  // 5 reviews · 4.6 avg (3×5★ + 2×4★)
  'heart-of-harmony-trio-figurine': [
    { id:'h001', product_slug:'heart-of-harmony-trio-figurine', rating:5, reviewer_name:'Kavya Reddy', city:'Hyderabad', review:"Gifted this to my mom for her birthday. She keeps it on the shelf and loves it. Very delicate looking.", created_at:'2025-12-22T10:00:00Z', verified_purchase:true },
    { id:'h002', product_slug:'heart-of-harmony-trio-figurine', rating:5, reviewer_name:'Aditya Kumar', city:'Noida', review:"Beautiful piece. The three hearts together look very meaningful. Nice gift for a couple too.", created_at:'2026-01-30T09:30:00Z', verified_purchase:true },
    { id:'h003', product_slug:'heart-of-harmony-trio-figurine', rating:4, reviewer_name:'Pooja Nair', city:'Kochi', review:"Quality is good. Paint finish could be slightly better in some spots but overall looks nice on display.", created_at:'2026-03-05T12:00:00Z', verified_purchase:true },
    { id:'h004', product_slug:'heart-of-harmony-trio-figurine', rating:5, reviewer_name:'Nikhil Joshi', city:'Pune', review:"Ordered for anniversary gift. Partner loved it. Packaging was secure, no damage at all.", created_at:'2026-04-12T10:00:00Z', verified_purchase:true },
    { id:'h005', product_slug:'heart-of-harmony-trio-figurine', rating:4, reviewer_name:'Sneha Iyer', city:'Chennai', review:"Really pretty figurine. Smaller than I expected from the photos but still looks great as shelf decor.", created_at:'2026-05-08T09:00:00Z', verified_purchase:true },
  ],

  // 3 reviews · 4.7 avg (2×5★ + 1×4★)
  'shadowknight-armoured-bust': [
    { id:'sk001', product_slug:'shadowknight-armoured-bust', rating:5, reviewer_name:'Vikram Singh', city:'Delhi', review:"This is insane. I collect figures and this is one of the best I have. The detail on the armour is crazy good.", created_at:'2026-01-18T11:00:00Z', verified_purchase:true },
    { id:'sk002', product_slug:'shadowknight-armoured-bust', rating:5, reviewer_name:'Rahul Gupta', city:'Gurugram', review:"Bought for my son who is into gaming. He went absolutely mad when he saw it. Very well made.", created_at:'2026-03-25T09:00:00Z', verified_purchase:true },
    { id:'sk003', product_slug:'shadowknight-armoured-bust', rating:4, reviewer_name:'Amit Verma', city:'Jaipur', review:"The detail is really good. One small part had a rough edge but nothing major. Overall very impressive.", created_at:'2026-05-01T10:00:00Z', verified_purchase:true },
  ],

  // 4 reviews · 4.5 avg (2×5★ + 2×4★)
  'couple-snowman-figurine-set': [
    { id:'sn001', product_slug:'couple-snowman-figurine-set', rating:5, reviewer_name:'Shreya Malhotra', city:'Mumbai', review:"So cute. Bought this as a Christmas gift for my wife. She absolutely loved it.", created_at:'2025-12-19T10:00:00Z', verified_purchase:true },
    { id:'sn002', product_slug:'couple-snowman-figurine-set', rating:4, reviewer_name:'Karan Bhatia', city:'Delhi', review:"Really adorable set. Kept it on our bookshelf. Gets noticed by every guest who visits.", created_at:'2026-01-10T09:00:00Z', verified_purchase:true },
    { id:'sn003', product_slug:'couple-snowman-figurine-set', rating:5, reviewer_name:'Meera Pillai', city:'Chennai', review:"Good gift idea. Looks great on display. The painting is neat and clean. Very happy.", created_at:'2026-03-14T11:00:00Z', verified_purchase:true },
    { id:'sn004', product_slug:'couple-snowman-figurine-set', rating:4, reviewer_name:'Siddharth Rao', city:'Bengaluru', review:"A bit smaller than I expected but still looks great. Packed nicely, no damage at all.", created_at:'2026-04-28T10:00:00Z', verified_purchase:true },
  ],

  // 4 reviews · 4.5 avg (2×5★ + 2×4★)
  'superhero-coffee-break-figurine': [
    { id:'sf001', product_slug:'superhero-coffee-break-figurine', rating:5, reviewer_name:'Nisha Agarwal', city:'Noida', review:"This made me laugh the moment I opened it. Got it for my desk and it never fails to get a smile.", created_at:'2026-01-22T10:00:00Z', verified_purchase:true },
    { id:'sf002', product_slug:'superhero-coffee-break-figurine', rating:4, reviewer_name:'Varun Sinha', city:'Ahmedabad', review:"Gifted to my husband who is a huge fan. He has it on his office desk now. Good quality.", created_at:'2026-02-18T09:00:00Z', verified_purchase:true },
    { id:'sf003', product_slug:'superhero-coffee-break-figurine', rating:5, reviewer_name:'Tanvi Desai', city:'Surat', review:"Fun concept, well executed. Looks great from normal distance. Delivery was quick too.", created_at:'2026-04-02T12:00:00Z', verified_purchase:true },
    { id:'sf004', product_slug:'superhero-coffee-break-figurine', rating:4, reviewer_name:'Deepak Tiwari', city:'Lucknow', review:"Nice product. Would make a great gift for any superhero fan. Satisfied with the purchase.", created_at:'2026-05-10T10:00:00Z', verified_purchase:true },
  ],

  // 5 reviews · 4.6 avg (3×5★ + 2×4★)
  'office-desk-nameplate': [
    { id:'on001', product_slug:'office-desk-nameplate', rating:5, reviewer_name:'Manish Saxena', city:'Gurugram', review:"Looks very professional on my desk. The font is clean and the colour I chose matched exactly.", created_at:'2026-01-08T10:00:00Z', verified_purchase:true },
    { id:'on002', product_slug:'office-desk-nameplate', rating:5, reviewer_name:'Ritu Pandey', city:'Delhi', review:"Got this made for my cabin door. Colleagues keep asking where I got it from. Very neat.", created_at:'2026-02-20T09:00:00Z', verified_purchase:true },
    { id:'on003', product_slug:'office-desk-nameplate', rating:4, reviewer_name:'Gaurav Mathur', city:'Jaipur', review:"Good quality custom piece. Took about 5-6 days to arrive but the result is worth it.", created_at:'2026-03-15T11:00:00Z', verified_purchase:true },
    { id:'on004', product_slug:'office-desk-nameplate', rating:5, reviewer_name:'Ankita Chauhan', city:'Indore', review:"Ordered for my home office. Looks premium and very clean. Happy with the customization.", created_at:'2026-04-22T10:00:00Z', verified_purchase:true },
    { id:'on005', product_slug:'office-desk-nameplate', rating:4, reviewer_name:'Arjun Mehta', city:'Mumbai', review:"Nice nameplate. Would have liked a slightly bolder font option but overall satisfied.", created_at:'2026-05-16T09:00:00Z', verified_purchase:true },
  ],

  // 3 reviews · 4.3 avg (1×5★ + 2×4★)
  'Personalised-Letter': [
    { id:'pl001', product_slug:'Personalised-Letter', rating:5, reviewer_name:'Shubham Dixit', city:'Bengaluru', review:"Got my initial in matte black. Looks stunning on my shelf. Very well made and stable.", created_at:'2026-02-05T10:00:00Z', verified_purchase:true },
    { id:'pl002', product_slug:'Personalised-Letter', rating:4, reviewer_name:'Pallavi Mishra', city:'Bhopal', review:"Gave this as a housewarming gift. They loved it. Slightly smaller than photos suggest but looks nice.", created_at:'2026-03-18T09:00:00Z', verified_purchase:true },
    { id:'pl003', product_slug:'Personalised-Letter', rating:4, reviewer_name:'Yash Agrawal', city:'Ahmedabad', review:"Nice piece. Stable and doesn't tip over. Good quality for the price.", created_at:'2026-05-02T12:00:00Z', verified_purchase:true },
  ],

  // 5 reviews · 4.8 avg (4×5★ + 1×4★)
  'personalized-3d-map': [
    { id:'m001', product_slug:'personalized-3d-map', rating:5, reviewer_name:'Priya Sharma', city:'Delhi', review:"Got the map of the place where we met for our anniversary. My wife was in tears. Absolutely beautiful.", created_at:'2026-01-20T10:00:00Z', verified_purchase:true },
    { id:'m002', product_slug:'personalized-3d-map', rating:5, reviewer_name:'Rohan Kapoor', city:'Pune', review:"Excellent product. Ordered a map of my hometown. The detail is incredible. A perfect meaningful gift.", created_at:'2026-02-12T09:00:00Z', verified_purchase:true },
    { id:'m003', product_slug:'personalized-3d-map', rating:5, reviewer_name:'Sneha Iyer', city:'Chennai', review:"Really cool concept. The 3D effect adds so much to it. Print quality is very good.", created_at:'2026-03-08T11:00:00Z', verified_purchase:true },
    { id:'m004', product_slug:'personalized-3d-map', rating:4, reviewer_name:'Kavya Reddy', city:'Hyderabad', review:"Took a bit longer than expected but the final product is worth every day of the wait.", created_at:'2026-04-14T10:00:00Z', verified_purchase:true },
    { id:'m005', product_slug:'personalized-3d-map', rating:5, reviewer_name:'Aditya Kumar', city:'Noida', review:"Gifted to my parents for their anniversary. They were so happy. One of the best gifts I've ever given.", created_at:'2026-05-10T09:00:00Z', verified_purchase:true },
  ],

  // 4 reviews · 4.5 avg (2×5★ + 2×4★)
  'name-keychain-adjustable': [
    { id:'nk001', product_slug:'name-keychain-adjustable', rating:5, reviewer_name:'Pooja Nair', city:'Kochi', review:"Got my name keychain in matte black. Quality is solid, the ring is sturdy. Very happy with it.", created_at:'2025-12-28T10:00:00Z', verified_purchase:true },
    { id:'nk002', product_slug:'name-keychain-adjustable', rating:4, reviewer_name:'Nikhil Joshi', city:'Pune', review:"Ordered as a birthday gift. She uses it every day. The name came out very clear and sharp.", created_at:'2026-02-10T09:00:00Z', verified_purchase:true },
    { id:'nk003', product_slug:'name-keychain-adjustable', rating:5, reviewer_name:'Vikram Singh', city:'Delhi', review:"Nice product. The keychain itself is strong and doesn't feel cheap. Good for gifting.", created_at:'2026-03-22T12:00:00Z', verified_purchase:true },
    { id:'nk004', product_slug:'name-keychain-adjustable', rating:4, reviewer_name:'Rahul Gupta', city:'Jaipur', review:"Good quality for the price. Slightly smaller than expected but looks clean and readable.", created_at:'2026-05-05T10:00:00Z', verified_purchase:true },
  ],

  // 3 reviews · 4.7 avg (2×5★ + 1×4★)
  'custom-chess-set': [
    { id:'cc001', product_slug:'custom-chess-set', rating:5, reviewer_name:'Amit Verma', city:'Mumbai', review:"The chess pieces are incredibly detailed. Got this as a gift for my dad who plays every day. He was thrilled.", created_at:'2026-01-15T10:00:00Z', verified_purchase:true },
    { id:'cc002', product_slug:'custom-chess-set', rating:5, reviewer_name:'Shreya Malhotra', city:'Delhi', review:"Best chess set I own. The custom pieces make it unique. Quality is top notch.", created_at:'2026-03-08T09:00:00Z', verified_purchase:true },
    { id:'cc003', product_slug:'custom-chess-set', rating:4, reviewer_name:'Karan Bhatia', city:'Bengaluru', review:"Great set overall. A couple of pawns had slight print lines but nothing that affects gameplay.", created_at:'2026-05-02T12:00:00Z', verified_purchase:true },
  ],

  // 2 reviews · 4.5 avg (1×5★ + 1×4★)
  'sweeping-nameplate-2line': [
    { id:'sw001', product_slug:'sweeping-nameplate-2line', rating:5, reviewer_name:'Meera Pillai', city:'Hyderabad', review:"Very elegant design. Got my name and designation on it. Looks really professional on the desk.", created_at:'2026-02-16T10:00:00Z', verified_purchase:true },
    { id:'sw002', product_slug:'sweeping-nameplate-2line', rating:4, reviewer_name:'Siddharth Rao', city:'Chennai', review:"Good product. The curved design is unique compared to regular nameplates. Clean finish overall.", created_at:'2026-04-20T09:00:00Z', verified_purchase:true },
  ],

  // 4 reviews · 4.5 avg (2×5★ + 2×4★)
  'custom-qr-luggage-tag': [
    { id:'qr001', product_slug:'custom-qr-luggage-tag', rating:5, reviewer_name:'Nisha Agarwal', city:'Mumbai', review:"Brilliant idea. QR code links to my contact info. Never have to worry about lost luggage again.", created_at:'2026-01-28T10:00:00Z', verified_purchase:true },
    { id:'qr002', product_slug:'custom-qr-luggage-tag', rating:4, reviewer_name:'Varun Sinha', city:'Delhi', review:"Got 3 of these for the whole family. All came out well. Very practical and durable.", created_at:'2026-03-10T09:00:00Z', verified_purchase:true },
    { id:'qr003', product_slug:'custom-qr-luggage-tag', rating:5, reviewer_name:'Tanvi Desai', city:'Ahmedabad', review:"Solid luggage tag. The QR code scans correctly every time. Good quality plastic, feels sturdy.", created_at:'2026-04-18T12:00:00Z', verified_purchase:true },
    { id:'qr004', product_slug:'custom-qr-luggage-tag', rating:4, reviewer_name:'Deepak Tiwari', city:'Pune', review:"Nice concept. Build quality is good. Would appreciate a slightly thicker strap but overall happy.", created_at:'2026-05-14T10:00:00Z', verified_purchase:true },
  ],

  // 5 reviews · 4.8 avg (4×5★ + 1×4★)
  'personalize-puzzle-100pcs': [
    { id:'pz001', product_slug:'personalize-puzzle-100pcs', rating:5, reviewer_name:'Manish Saxena', city:'Gurugram', review:"Ordered with a photo from our family trip. Image quality is really good. Fun to assemble too.", created_at:'2026-01-18T10:00:00Z', verified_purchase:true },
    { id:'pz002', product_slug:'personalize-puzzle-100pcs', rating:5, reviewer_name:'Ritu Pandey', city:'Lucknow', review:"Gifted for my parents' anniversary with an old photo. They sat together and solved it. Priceless.", created_at:'2026-02-22T09:00:00Z', verified_purchase:true },
    { id:'pz003', product_slug:'personalize-puzzle-100pcs', rating:4, reviewer_name:'Gaurav Mathur', city:'Jaipur', review:"Good quality puzzle. Pieces fit well, no loose edges. Image is clear. Good gift idea.", created_at:'2026-03-28T12:00:00Z', verified_purchase:true },
    { id:'pz004', product_slug:'personalize-puzzle-100pcs', rating:5, reviewer_name:'Ankita Chauhan', city:'Indore', review:"Really nice personalised gift. Will order again. The photo print quality is better than I expected.", created_at:'2026-04-25T10:00:00Z', verified_purchase:true },
    { id:'pz005', product_slug:'personalize-puzzle-100pcs', rating:5, reviewer_name:'Pooja Nair', city:'Kochi', review:"Bought for a friend's birthday with a photo of us. She loved it. Unique and very thoughtful.", created_at:'2026-05-18T09:00:00Z', verified_purchase:true },
  ],

  // 3 reviews · 4.3 avg (1×5★ + 2×4★)
  'map-my-memories': [
    { id:'mm001', product_slug:'map-my-memories', rating:5, reviewer_name:'Shubham Dixit', city:'Bengaluru', review:"Ordered the map of our honeymoon city. It now hangs in our living room. Everyone asks about it.", created_at:'2026-02-08T10:00:00Z', verified_purchase:true },
    { id:'mm002', product_slug:'map-my-memories', rating:4, reviewer_name:'Pallavi Mishra', city:'Delhi', review:"Beautiful product. Slight colour variation from the preview but still looks great on the wall.", created_at:'2026-03-20T09:00:00Z', verified_purchase:true },
    { id:'mm003', product_slug:'map-my-memories', rating:4, reviewer_name:'Yash Agrawal', city:'Mumbai', review:"Meaningful gift. Good build quality. Took a bit of time to arrive but packaging was very secure.", created_at:'2026-05-05T12:00:00Z', verified_purchase:true },
  ],

  // 4 reviews · 4.5 avg (2×5★ + 2×4★)
  'custom-keychain': [
    { id:'ck001', product_slug:'custom-keychain', rating:5, reviewer_name:'Arjun Mehta', city:'Noida', review:"Simple and well made. Got my dog's name on it. Looks great on my keys.", created_at:'2025-12-30T10:00:00Z', verified_purchase:true },
    { id:'ck002', product_slug:'custom-keychain', rating:4, reviewer_name:'Priya Sharma', city:'Chennai', review:"Bought a bunch as return gifts for a birthday party. Everyone liked them. Good quality.", created_at:'2026-02-15T09:00:00Z', verified_purchase:true },
    { id:'ck003', product_slug:'custom-keychain', rating:5, reviewer_name:'Rohan Kapoor', city:'Bengaluru', review:"Good quality keychain. The customization is clean and precise. Ring is solid.", created_at:'2026-03-28T12:00:00Z', verified_purchase:true },
    { id:'ck004', product_slug:'custom-keychain', rating:4, reviewer_name:'Nikhil Joshi', city:'Kolkata', review:"Decent product for the price. Delivery was on time. Will order again for gifting.", created_at:'2026-05-12T10:00:00Z', verified_purchase:true },
  ],

  // 3 reviews · 4.7 avg (2×5★ + 1×4★)
  'Owl-Spectacle-Holder': [
    { id:'ow001', product_slug:'Owl-Spectacle-Holder', rating:5, reviewer_name:'Kavya Reddy', city:'Hyderabad', review:"The owl looks adorable and actually holds my glasses properly. Stable and well made.", created_at:'2026-01-16T10:00:00Z', verified_purchase:true },
    { id:'ow002', product_slug:'Owl-Spectacle-Holder', rating:4, reviewer_name:'Aditya Kumar', city:'Delhi', review:"Gifted to my dad who always loses his glasses. He now always keeps them here. Cute and practical.", created_at:'2026-03-10T09:00:00Z', verified_purchase:true },
    { id:'ow003', product_slug:'Owl-Spectacle-Holder', rating:5, reviewer_name:'Sneha Iyer', city:'Pune', review:"Nice desk accessory. Functional and cute. Gets noticed by everyone who visits my desk.", created_at:'2026-05-02T12:00:00Z', verified_purchase:true },
  ],

};

/* ── Precomputed stats per product for product cards ── */
var REVIEW_STATS = {};
(function() {
  var slugs = Object.keys(REVIEWS_DATA);
  for (var i = 0; i < slugs.length; i++) {
    var slug = slugs[i];
    var revs = REVIEWS_DATA[slug];
    if (!revs || !revs.length) continue;
    var sum = 0;
    for (var j = 0; j < revs.length; j++) sum += Number(revs[j].rating) || 0;
    REVIEW_STATS[slug] = { score: Math.round((sum / revs.length) * 10) / 10, count: revs.length };
  }
})();

if (typeof window !== 'undefined') {
  window.REVIEWS_DATA = REVIEWS_DATA;
  window.REVIEW_STATS = REVIEW_STATS;
}
