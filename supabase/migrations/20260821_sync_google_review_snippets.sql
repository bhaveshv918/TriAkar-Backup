-- reviews.html fetches site_settings.google_snippets at runtime and, if set,
-- it REPLACES the hardcoded GOOGLE_REVIEWS array entirely (see the "takes
-- priority at runtime" comment in reviews.html). The 4 new reviews (Kartik
-- Raha, devesh mohan, Luna Lovegood, Shampi Singhal) were added to the
-- hardcoded array but never showed on the live site because this DB row
-- still held the old 24-review list and silently overrode them. This syncs
-- google_snippets with the full, current 28-review list so both match.
-- Rating stays untouched (4.9 / 39, per prior instruction not to change it).

INSERT INTO site_settings (key, value, updated_at) VALUES
('google_snippets', '[
  {"author":"Tejasvi Vishwakarma","rating":5,"text":"Really happy with my experience at TriAkar. They have a huge variety of products and can also create custom products exactly as per your requirements. The quality is excellent, and everything was delivered on time as promised. One thing I truly appreciated was how supportive and knowledgeable the owner is. He takes the time to understand your needs and provides valuable suggestions. It''s rare to find such a combination of quality products, good service, and a customer-focused approach."},
  {"author":"dileep pathak","rating":5,"text":"I needed a customized gift for my wife on our anniversary. He helped me a lot and got the delivery at the right time."},
  {"author":"Purnima Thakur","rating":5,"text":"Excellent customer support and attention to the details."},
  {"author":"ANIMESH SINGH","rating":5,"text":"Awesome experience for a customised 3D printing gift at a reasonable price. Thank you!"},
  {"author":"Himani b","rating":5,"text":"Very nice. Unique items for gifting purpose at very reasonable price."},
  {"author":"ADITYA","rating":5,"text":"It''s really trustworthy."},
  {"author":"ekta chauhan","rating":5,"text":"Great experience with them."},
  {"author":"Bhavna Arora","rating":5,"text":"It''s wonderful."},
  {"author":"Aryan Verma","rating":5,"text":"Good service."},
  {"author":"Abhishek Gupta","rating":5,"text":"Awesome customization done for fish by Triakar."},
  {"author":"V sharma","rating":5,"text":"Very good shop, they try their best to get the job done on time. They have lots of designs."},
  {"author":"Tarun Aggarwal","rating":5,"text":"Very prompt and genuine service with ease of dealing with."},
  {"author":"Suparn","rating":5,"text":"Custom batman figure turned into a GPU support. Good work."},
  {"author":"Shivani Prajapati","rating":5,"text":"I got good 3D printing service from them."},
  {"author":"Tej Gautam","rating":5,"text":"I felt very good working with TriAkar. I got the best and quietest service from him. I will always work with him because he got my work done at my last moment due to which I was saved from any loss. Many thanks to TriAkar."},
  {"author":"The Chemical Brains","rating":4,"text":"Collections are good, work quality is good, but near shop area is still in development so a little hard to find."},
  {"author":"The Fry Guy","rating":5,"text":"I saw this bird on Instagram, but the major issue was they don''t stick, so I told him my problem and they made a perfect fit for my laptop. It''s very cute."},
  {"author":"Deepak Pandey","rating":5,"text":"Very nice design, really impressive."},
  {"author":"wishcraft Ms","rating":5,"text":"Perfect custom gift, great quality, smooth finish."},
  {"author":"Akhil Sharma","rating":5,"text":"Custom 3D printed gift, as a customer my experience was very satisfying. Must recommend."},
  {"author":"Himansu Gyala","rating":5,"text":"If you''re looking for a great 3D printing spot near Ek Murti Chowk, you have to check out TriAkar Studio in Choti Milak. I had such an amazing experience getting a custom product designed there. The quality is incredible. You should definitely pay them a visit and bring your own 3D ideas to life."},
  {"author":"Shyam Sunder","rating":5,"text":"Bahut sundar products hai inke. Mujhe bahut pasand aaye. Unique items."},
  {"author":"Sarunjay","rating":5,"text":"Best service, service on time hai. And staff boht cooperative hai."},
  {"author":"Nishchaya Kumar","rating":5,"text":"Tried two other local 3D printing shops before this one, both had visible layer lines and color mismatch. TriAkar''s finish was noticeably smoother, and the blue and purple combo matched exactly what I asked for."},
  {"author":"Kartik Raha","rating":5,"text":"Had a great experience with Triakar 3D Printing! The staff were really friendly and helpful. I designed my 3D model myself, and they guided me with useful suggestions to improve it before printing. The print quality was also great. Definitely recommend them!"},
  {"author":"devesh mohan","rating":5,"text":"The 3D printed product still needs to improve. As it''s a new technology I am sure it will get better with time and TriAkar will provide much better product. But full marks to the owner. He was consistent in his inputs about the product, setting right expectation and accordingly delivering it."},
  {"author":"Luna Lovegood","rating":5,"text":"What an amazing studio! Built what I required very efficiently and beautifully"},
  {"author":"Shampi Singhal","rating":5,"text":"Absolutely loved the 3D model! The detailing, finishing, and overall quality are amazing. It looks even better than I expected. Beautifully made and highly recommended!"}
]', now())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;
