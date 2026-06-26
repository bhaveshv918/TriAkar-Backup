-- ============================================================
-- One-time seed: import the static reviews-data.js entries into
-- the reviews table as APPROVED, so the live /reviews page (now
-- DB-driven) shows the same content. Run once in Supabase SQL Editor.
-- IDEMPOTENT: re-running will NOT create duplicates.
-- 60 reviews across 16 products.
-- ============================================================
INSERT INTO reviews (product_slug, reviewer_name, rating, review, city, verified_purchase, status, source, created_at)
SELECT v.product_slug, v.reviewer_name, v.rating, v.review, v.city, v.verified_purchase, v.status, v.source, v.created_at
FROM (VALUES
  ('modern-table-lamp-with-ambient-accent-lighting','Arjun Mehta',5,'Really nice lamp. The glow is soft and not harsh at all. Placed it on my study table and it looks very clean.','Delhi',true,'approved','website','2026-01-14T10:00:00Z'::timestamptz),
  ('modern-table-lamp-with-ambient-accent-lighting','Priya Sharma',5,'Bought this for my sister''s birthday. She loved it. The ambient light is exactly what she wanted for her room.','Pune',true,'approved','website','2026-02-08T09:00:00Z'::timestamptz),
  ('modern-table-lamp-with-ambient-accent-lighting','Rohan Kapoor',4,'Decent quality. The light could be slightly brighter but the design is very nice. Looks premium on a desk.','Bengaluru',true,'approved','website','2026-04-20T11:00:00Z'::timestamptz),
  ('heart-of-harmony-trio-figurine','Kavya Reddy',5,'Gifted this to my mom for her birthday. She keeps it on the shelf and loves it. Very delicate looking.','Hyderabad',true,'approved','website','2025-12-22T10:00:00Z'::timestamptz),
  ('heart-of-harmony-trio-figurine','Aditya Kumar',5,'Beautiful piece. The three hearts together look very meaningful. Nice gift for a couple too.','Noida',true,'approved','website','2026-01-30T09:30:00Z'::timestamptz),
  ('heart-of-harmony-trio-figurine','Pooja Nair',4,'Quality is good. Paint finish could be slightly better in some spots but overall looks nice on display.','Kochi',true,'approved','website','2026-03-05T12:00:00Z'::timestamptz),
  ('heart-of-harmony-trio-figurine','Nikhil Joshi',5,'Ordered for anniversary gift. Partner loved it. Packaging was secure, no damage at all.','Pune',true,'approved','website','2026-04-12T10:00:00Z'::timestamptz),
  ('heart-of-harmony-trio-figurine','Sneha Iyer',4,'Really pretty figurine. Smaller than I expected from the photos but still looks great as shelf decor.','Chennai',true,'approved','website','2026-05-08T09:00:00Z'::timestamptz),
  ('shadowknight-armoured-bust','Vikram Singh',5,'This is insane. I collect figures and this is one of the best I have. The detail on the armour is crazy good.','Delhi',true,'approved','website','2026-01-18T11:00:00Z'::timestamptz),
  ('shadowknight-armoured-bust','Rahul Gupta',5,'Bought for my son who is into gaming. He went absolutely mad when he saw it. Very well made.','Gurugram',true,'approved','website','2026-03-25T09:00:00Z'::timestamptz),
  ('shadowknight-armoured-bust','Amit Verma',4,'The detail is really good. One small part had a rough edge but nothing major. Overall very impressive.','Jaipur',true,'approved','website','2026-05-01T10:00:00Z'::timestamptz),
  ('couple-snowman-figurine-set','Shreya Malhotra',5,'So cute. Bought this as a Christmas gift for my wife. She absolutely loved it.','Mumbai',true,'approved','website','2025-12-19T10:00:00Z'::timestamptz),
  ('couple-snowman-figurine-set','Karan Bhatia',4,'Really adorable set. Kept it on our bookshelf. Gets noticed by every guest who visits.','Delhi',true,'approved','website','2026-01-10T09:00:00Z'::timestamptz),
  ('couple-snowman-figurine-set','Meera Pillai',5,'Good gift idea. Looks great on display. The painting is neat and clean. Very happy.','Chennai',true,'approved','website','2026-03-14T11:00:00Z'::timestamptz),
  ('couple-snowman-figurine-set','Siddharth Rao',4,'A bit smaller than I expected but still looks great. Packed nicely, no damage at all.','Bengaluru',true,'approved','website','2026-04-28T10:00:00Z'::timestamptz),
  ('superhero-coffee-break-figurine','Nisha Agarwal',5,'This made me laugh the moment I opened it. Got it for my desk and it never fails to get a smile.','Noida',true,'approved','website','2026-01-22T10:00:00Z'::timestamptz),
  ('superhero-coffee-break-figurine','Varun Sinha',4,'Gifted to my husband who is a huge fan. He has it on his office desk now. Good quality.','Ahmedabad',true,'approved','website','2026-02-18T09:00:00Z'::timestamptz),
  ('superhero-coffee-break-figurine','Tanvi Desai',5,'Fun concept, well executed. Looks great from normal distance. Delivery was quick too.','Surat',true,'approved','website','2026-04-02T12:00:00Z'::timestamptz),
  ('superhero-coffee-break-figurine','Deepak Tiwari',4,'Nice product. Would make a great gift for any superhero fan. Satisfied with the purchase.','Lucknow',true,'approved','website','2026-05-10T10:00:00Z'::timestamptz),
  ('office-desk-nameplate','Manish Saxena',5,'Looks very professional on my desk. The font is clean and the colour I chose matched exactly.','Gurugram',true,'approved','website','2026-01-08T10:00:00Z'::timestamptz),
  ('office-desk-nameplate','Ritu Pandey',5,'Got this made for my cabin door. Colleagues keep asking where I got it from. Very neat.','Delhi',true,'approved','website','2026-02-20T09:00:00Z'::timestamptz),
  ('office-desk-nameplate','Gaurav Mathur',4,'Good quality custom piece. Took about 5-6 days to arrive but the result is worth it.','Jaipur',true,'approved','website','2026-03-15T11:00:00Z'::timestamptz),
  ('office-desk-nameplate','Ankita Chauhan',5,'Ordered for my home office. Looks premium and very clean. Happy with the customization.','Indore',true,'approved','website','2026-04-22T10:00:00Z'::timestamptz),
  ('office-desk-nameplate','Arjun Mehta',4,'Nice nameplate. Would have liked a slightly bolder font option but overall satisfied.','Mumbai',true,'approved','website','2026-05-16T09:00:00Z'::timestamptz),
  ('Personalised-Letter','Shubham Dixit',5,'Got my initial in matte black. Looks stunning on my shelf. Very well made and stable.','Bengaluru',true,'approved','website','2026-02-05T10:00:00Z'::timestamptz),
  ('Personalised-Letter','Pallavi Mishra',4,'Gave this as a housewarming gift. They loved it. Slightly smaller than photos suggest but looks nice.','Bhopal',true,'approved','website','2026-03-18T09:00:00Z'::timestamptz),
  ('Personalised-Letter','Yash Agrawal',4,'Nice piece. Stable and doesn''t tip over. Good quality for the price.','Ahmedabad',true,'approved','website','2026-05-02T12:00:00Z'::timestamptz),
  ('personalized-3d-map','Priya Sharma',5,'Got the map of the place where we met for our anniversary. My wife was in tears. Absolutely beautiful.','Delhi',true,'approved','website','2026-01-20T10:00:00Z'::timestamptz),
  ('personalized-3d-map','Rohan Kapoor',5,'Excellent product. Ordered a map of my hometown. The detail is incredible. A perfect meaningful gift.','Pune',true,'approved','website','2026-02-12T09:00:00Z'::timestamptz),
  ('personalized-3d-map','Sneha Iyer',5,'Really cool concept. The 3D effect adds so much to it. Print quality is very good.','Chennai',true,'approved','website','2026-03-08T11:00:00Z'::timestamptz),
  ('personalized-3d-map','Kavya Reddy',4,'Took a bit longer than expected but the final product is worth every day of the wait.','Hyderabad',true,'approved','website','2026-04-14T10:00:00Z'::timestamptz),
  ('personalized-3d-map','Aditya Kumar',5,'Gifted to my parents for their anniversary. They were so happy. One of the best gifts I''ve ever given.','Noida',true,'approved','website','2026-05-10T09:00:00Z'::timestamptz),
  ('name-keychain-adjustable','Pooja Nair',5,'Got my name keychain in matte black. Quality is solid, the ring is sturdy. Very happy with it.','Kochi',true,'approved','website','2025-12-28T10:00:00Z'::timestamptz),
  ('name-keychain-adjustable','Nikhil Joshi',4,'Ordered as a birthday gift. She uses it every day. The name came out very clear and sharp.','Pune',true,'approved','website','2026-02-10T09:00:00Z'::timestamptz),
  ('name-keychain-adjustable','Vikram Singh',5,'Nice product. The keychain itself is strong and doesn''t feel cheap. Good for gifting.','Delhi',true,'approved','website','2026-03-22T12:00:00Z'::timestamptz),
  ('name-keychain-adjustable','Rahul Gupta',4,'Good quality for the price. Slightly smaller than expected but looks clean and readable.','Jaipur',true,'approved','website','2026-05-05T10:00:00Z'::timestamptz),
  ('custom-chess-set','Amit Verma',5,'The chess pieces are incredibly detailed. Got this as a gift for my dad who plays every day. He was thrilled.','Mumbai',true,'approved','website','2026-01-15T10:00:00Z'::timestamptz),
  ('custom-chess-set','Shreya Malhotra',5,'Best chess set I own. The custom pieces make it unique. Quality is top notch.','Delhi',true,'approved','website','2026-03-08T09:00:00Z'::timestamptz),
  ('custom-chess-set','Karan Bhatia',4,'Great set overall. A couple of pawns had slight print lines but nothing that affects gameplay.','Bengaluru',true,'approved','website','2026-05-02T12:00:00Z'::timestamptz),
  ('sweeping-nameplate-2line','Meera Pillai',5,'Very elegant design. Got my name and designation on it. Looks really professional on the desk.','Hyderabad',true,'approved','website','2026-02-16T10:00:00Z'::timestamptz),
  ('sweeping-nameplate-2line','Siddharth Rao',4,'Good product. The curved design is unique compared to regular nameplates. Clean finish overall.','Chennai',true,'approved','website','2026-04-20T09:00:00Z'::timestamptz),
  ('custom-qr-luggage-tag','Nisha Agarwal',5,'Brilliant idea. QR code links to my contact info. Never have to worry about lost luggage again.','Mumbai',true,'approved','website','2026-01-28T10:00:00Z'::timestamptz),
  ('custom-qr-luggage-tag','Varun Sinha',4,'Got 3 of these for the whole family. All came out well. Very practical and durable.','Delhi',true,'approved','website','2026-03-10T09:00:00Z'::timestamptz),
  ('custom-qr-luggage-tag','Tanvi Desai',5,'Solid luggage tag. The QR code scans correctly every time. Good quality plastic, feels sturdy.','Ahmedabad',true,'approved','website','2026-04-18T12:00:00Z'::timestamptz),
  ('custom-qr-luggage-tag','Deepak Tiwari',4,'Nice concept. Build quality is good. Would appreciate a slightly thicker strap but overall happy.','Pune',true,'approved','website','2026-05-14T10:00:00Z'::timestamptz),
  ('personalize-puzzle-100pcs','Manish Saxena',5,'Ordered with a photo from our family trip. Image quality is really good. Fun to assemble too.','Gurugram',true,'approved','website','2026-01-18T10:00:00Z'::timestamptz),
  ('personalize-puzzle-100pcs','Ritu Pandey',5,'Gifted for my parents'' anniversary with an old photo. They sat together and solved it. Priceless.','Lucknow',true,'approved','website','2026-02-22T09:00:00Z'::timestamptz),
  ('personalize-puzzle-100pcs','Gaurav Mathur',4,'Good quality puzzle. Pieces fit well, no loose edges. Image is clear. Good gift idea.','Jaipur',true,'approved','website','2026-03-28T12:00:00Z'::timestamptz),
  ('personalize-puzzle-100pcs','Ankita Chauhan',5,'Really nice personalised gift. Will order again. The photo print quality is better than I expected.','Indore',true,'approved','website','2026-04-25T10:00:00Z'::timestamptz),
  ('personalize-puzzle-100pcs','Pooja Nair',5,'Bought for a friend''s birthday with a photo of us. She loved it. Unique and very thoughtful.','Kochi',true,'approved','website','2026-05-18T09:00:00Z'::timestamptz),
  ('map-my-memories','Shubham Dixit',5,'Ordered the map of our honeymoon city. It now hangs in our living room. Everyone asks about it.','Bengaluru',true,'approved','website','2026-02-08T10:00:00Z'::timestamptz),
  ('map-my-memories','Pallavi Mishra',4,'Beautiful product. Slight colour variation from the preview but still looks great on the wall.','Delhi',true,'approved','website','2026-03-20T09:00:00Z'::timestamptz),
  ('map-my-memories','Yash Agrawal',4,'Meaningful gift. Good build quality. Took a bit of time to arrive but packaging was very secure.','Mumbai',true,'approved','website','2026-05-05T12:00:00Z'::timestamptz),
  ('custom-keychain','Arjun Mehta',5,'Simple and well made. Got my dog''s name on it. Looks great on my keys.','Noida',true,'approved','website','2025-12-30T10:00:00Z'::timestamptz),
  ('custom-keychain','Priya Sharma',4,'Bought a bunch as return gifts for a birthday party. Everyone liked them. Good quality.','Chennai',true,'approved','website','2026-02-15T09:00:00Z'::timestamptz),
  ('custom-keychain','Rohan Kapoor',5,'Good quality keychain. The customization is clean and precise. Ring is solid.','Bengaluru',true,'approved','website','2026-03-28T12:00:00Z'::timestamptz),
  ('custom-keychain','Nikhil Joshi',4,'Decent product for the price. Delivery was on time. Will order again for gifting.','Kolkata',true,'approved','website','2026-05-12T10:00:00Z'::timestamptz),
  ('Owl-Spectacle-Holder','Kavya Reddy',5,'The owl looks adorable and actually holds my glasses properly. Stable and well made.','Hyderabad',true,'approved','website','2026-01-16T10:00:00Z'::timestamptz),
  ('Owl-Spectacle-Holder','Aditya Kumar',4,'Gifted to my dad who always loses his glasses. He now always keeps them here. Cute and practical.','Delhi',true,'approved','website','2026-03-10T09:00:00Z'::timestamptz),
  ('Owl-Spectacle-Holder','Sneha Iyer',5,'Nice desk accessory. Functional and cute. Gets noticed by everyone who visits my desk.','Pune',true,'approved','website','2026-05-02T12:00:00Z'::timestamptz)
) AS v(product_slug, reviewer_name, rating, review, city, verified_purchase, status, source, created_at)
WHERE NOT EXISTS (
  SELECT 1 FROM reviews r
  WHERE r.product_slug = v.product_slug
    AND r.reviewer_name = v.reviewer_name
    AND r.review        = v.review
);
