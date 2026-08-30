# Gurugram (Sohna) Branch, Setup and Go-Live

Everything in the code is done. This file is the list of things only you can do,
in the order they have to happen.

**Branch:** Sohna Branch, Gurugram
**Address:** Flora Avenue 33 by Breez, Sector 33, Dhunela, Sohna, Haryana 122103
**Run by:** your jiju, from the apartment. No studio, no walk-ins.
**Fulfilment:** home delivery across Gurugram (Porter and similar), pickup only after
the order is ready and a time is confirmed on WhatsApp.

---

## 1. Run the migration (do this first, everything else depends on it)

Supabase SQL Editor, paste and run:

```
supabase/migrations/20260830_branches.sql
```

Then run the VERIFY block at the bottom of that file. You should see:

- two rows in `biz_branches`, `noida` and `gurugram`
- `branch_for_pincode('122103')` returns `gurugram`, `('201307')` returns `noida`
- every `biz_*` table has a `branch_id` column, all existing rows set to `noida`
- policies named `biz_branch_scoped` instead of the old `biz_staff_or_admin`
- triggers `trg_stamp_branch` and `trg_biz_audit` attached

**Until this runs:** the branch picker in Business OS will not appear, the Branches
card in Site Content will say the migration has not been run, and Team Activity will
show only the old admin log. Nothing breaks, but nothing branch-related works either.

> **Do not create jiju's staff account before this migration.** Under the old rules a
> staff account could read the whole Noida ledger and balance sheet. The branch
> scoping in this migration is what stops that.

## 2. Redeploy the backend

A git push does not deploy Render on its own. Trigger the deploy, then check
`/health` reports the new commit. The backend changes are:

- `server/services/branch.js`, new, routes an incoming order to a branch by pincode
- `server/controllers/paymentController.js` and `orderController.js`, stamp `branch_id`
  on checkout orders and WhatsApp orders
- `server/controllers/adminUserController.js`, accepts a branch for a staff account
- `server/controllers/adminController.js`, the merged Team Activity feed

## 3. Create jiju's account

1. He signs up on triakar.com like any customer (his own email and password).
2. Admin Panel, Customers, open his row.
3. Set **Role** to `staff`.
4. Set **Branch** to `Sohna Branch, Gurugram`. This is required. A staff account with
   no branch signs in fine and then sees a completely empty Business OS, which looks
   like a broken app rather than a missing setting.
5. Tick the tabs he needs. Suggested starting set:

   Task · Add Order · All Orders · Website Orders · Customers · Stock · Rack / Shelf ·
   Spool Tracker · Expenses

   Leave off: Balance Sheet, Money In/Out, Purchases, GST anything, Settings. Those
   are whole-business views, and the point of a branch account is that it is not one.
6. Press **Set**. Have him sign in at `/admin-biz.html` and confirm he sees the
   Gurugram chip in the header and no Noida orders anywhere.

**What he can and cannot do, in plain terms:** he sees and edits only Gurugram rows.
He cannot read another branch's data and he cannot write into it, even if someone
edits the page's JavaScript in his browser, because the database enforces it and
overwrites the branch on every record he creates. He has no access to the Admin Panel
at all. Everything he adds, edits or deletes lands in your Team Activity feed with his
email against it.

## 4. Google Business Profile for the branch

**The listing already exists and the pin is now live on the site.** You sent
`https://maps.app.goo.gl/29p3kMqwkbJomNk58`, which resolves to a real place:

- **Name on Google:** TriAkar - 3D Printing Services
- **Coordinates:** 28.283748, 77.0751219

Those coordinates are now in the `LocalBusiness` schema on the Gurugram page, the Sohna
page and the homepage, in `biz_branches`, and in every "Get Directions" link and map
embed across the site. Nothing further is needed for the pin.

Three things still worth doing on the profile itself:

1. **Make it a Service Area Business.** In the profile, when asked whether customers
   visit you at this address, answer **no**, and set service areas to Gurugram, Sohna,
   Sohna Road, Badshahpur, Bhondsi, Manesar. The flat address then stops showing on the
   Maps listing while the local ranking stays. The address is still on the website
   because you asked for it there; this only keeps it off Maps.
2. **Check the two listings are named consistently.** The Noida one is currently
   "Triakar" and the Sohna one is "TriAkar - 3D Printing Services". Google's naming
   guidelines want the same brand name at every location, with a descriptor only where
   it is part of the real-world name. Mismatched names make Google slower to connect
   the two as one business, and the trailing service descriptor is the kind of thing
   that occasionally gets flagged. Safest is "TriAkar" on both, or "TriAkar" and
   "TriAkar Sohna" if you want them distinguishable in the dashboard.
3. **Link them under one business account** if they are not already, so the two
   locations reinforce each other instead of competing.

Hours on both should read Monday to Saturday, 11 AM to 8 PM, and the category should be
3D Printing Service.

## 5. Google Ads

The site already loads GA4. It has no Ads tag yet, so a campaign would be running
blind. The plumbing is in place and needs two values from you.

**Create the account and the conversions**

1. Create the Google Ads account and note the conversion ID, it looks like `AW-123456789`.
2. Create these conversion actions and note each one's label:

   | Conversion action | Type | Count | Value |
   |---|---|---|---|
   | Purchase | Website | Every | Use the value sent from the site |
   | WhatsApp click | Website | One | ₹0, or a small fixed lead value |
   | Call click | Website | One | ₹0, or a small fixed lead value |
   | Contact form | Website | One | ₹0 |
   | Instant quote | Website | One | ₹0 |

3. Open `shared.js`, find the CONVERSION TRACKING block near the top of the profile
   helpers, and fill in:

   ```js
   var TA_ADS_ID = 'AW-XXXXXXXXX';
   var TA_ADS_LABELS = {
     purchase:             'paste-purchase-label',
     whatsapp_click:       'paste-whatsapp-label',
     call_click:           'paste-call-label',
     contact_form_submit:  'paste-form-label',
     instant_quote_submit: 'paste-quote-label',
   };
   ```

4. Bump `CACHE_VER` in `sw.js` and deploy, otherwise returning visitors keep the old
   file and nothing is tracked.

**What already fires without any further work**

- `purchase` on the order confirmation page, with the real order value and order id.
  A WhatsApp order fires `generate_lead` instead, because the payment has not been
  collected yet and counting it as revenue would inflate your ROAS.
- `whatsapp_click` and `call_click` on every `wa.me` and `tel:` link on the site,
  automatically. Any new button gets it for free.

**Campaign shape**

- One Search campaign, separate from anything Noida, so the budgets do not fight.
- **Location targeting:** Gurugram district, plus a radius around Sohna. Set it to
  *"Presence: people in or regularly in your targeted locations"*, not the default
  "presence or interest". The default will spend your budget on people in Bengaluru
  reading about Gurugram.
- **Ad groups**, one theme each, so the ad can actually match the search:
  - 3D printing Gurugram / Gurgaon (broad service intent)
  - corporate gifting Gurugram (highest value, this is a corporate city)
  - personalised gifts and name plates Gurugram
  - 3D printed replacement parts Gurugram
  - 3D printing Sohna / Sohna Road (cheap, low competition, high intent)
- **Landing pages:** `/3d-printing-gurugram` for everything except the Sohna ad group,
  which goes to `/3d-printing-sohna`. Both have the WhatsApp CTA above the fold.
- **Negative keywords, add these on day one:** free, cheap, jobs, job, salary, course,
  training, learn, tutorial, wholesale printer, buy 3d printer, printer price,
  filament price, resin, second hand, repair 3d printer. Without these you will pay
  for people who want to buy a machine or get a job, not order a product.
- **Budget:** start small and split it, roughly 70 percent on the Gurugram ad groups
  and 30 percent on Sohna. Sohna has almost no competition, so it should show the
  cheaper cost per lead, and you want that comparison visible from week one.
- **Assets:** call asset with +91 9217-555-833, location asset once the Business
  Profile from step 4 is verified, and sitelinks to Products, Instant Quote,
  Corporate Gifting and Contact.

**Watch for this:** every conversion is a WhatsApp or call click at first, because
that is how this business actually converts. Do not let the account optimise purely on
website purchases early on, there will not be enough of them to learn from.

## 6. Tell the WhatsApp side about the branch

`WHATSAPP-AI-TRAINING.md` and `WHATSAPP-CHEATSHEET.md` are already updated with the
branch, the delivery areas, and the "it is a branch, not a showroom" rule. If you are
running the AI assistant, re-upload the training pack so it stops telling Gurugram
customers to come to Greater Noida.

---

## Still open, deliberately

**GST.** Everything still bills from the UP registration. `branch_id` is recorded
internally but no invoice, GSTIN, place of supply or GSTR-1 output has changed.

Worth knowing plainly: supplying goods from a premises in Haryana while registered
only in UP is a real exposure, because GST registration is state-wise and a place of
business in another state normally needs its own registration there. You chose to
defer this and tag branches first, which is a reasonable order to do it in. When you
want to deal with it, the branch column is what makes the split cheap: separate
invoice series, branch-wise GSTR-1, and Haryana place-of-supply logic all key off it.
Confirm the approach with your CA before you file the month where Sohna starts
dispatching.

**Visitors.** You asked for the full address published for SEO, and it is. Expect the
occasional person to turn up at the flat anyway. The copy on every page says pickup is
on prior confirmation and that browsing happens at the Noida studio, which is the most
the website can do about it.
