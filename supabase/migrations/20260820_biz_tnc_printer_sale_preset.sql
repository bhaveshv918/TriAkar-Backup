-- Adds a "Printer / Machine Sale" Terms & Conditions preset for the Order
-- Acknowledgement document (doc_type='record'), for when TriAkar sells a 3D
-- printer/machine rather than a custom-printed product. Adapted from the
-- supplier-side terms TriAkar itself receives on printer purchases (delivery
-- timeline, warranty scope/exclusions, paid service visits, installation,
-- no-return-after-demo policy, certified-engineer-only servicing, non-
-- refundable advance payment, jurisdiction), rewritten in TriAkar's own
-- voice/wording rather than copied verbatim, and NOT set as default, so it
-- sits alongside the existing general/custom-order preset and staff pick
-- whichever fits the order from the Terms & Conditions dropdown in
-- Document Settings -> Order Acknowledgement, or right on the order itself.
-- Safe, additive. Run once in Supabase SQL Editor.

INSERT INTO biz_tnc_presets (name, body, doc_type, is_default)
VALUES (
  'Printer / Machine Sale',
  'This is an order acknowledgement and not a tax invoice.

1. This confirms that the order and payment mentioned above have been received by TriAkar.
2. Delivery will be completed within 7 working days of receiving 100% advance payment, unless a different timeline has been agreed in writing.
3. The product carries the standard warranty period stated for that item (typically 6 months to 1 year) from the date of purchase. Warranty excludes consumables, wear-and-tear parts, and damage caused by mishandling, power fluctuations, or the use of unauthorized spare parts. Bundled accessories (reflective markers, Type-C adapter, etc.) are not covered under warranty.
4. Any service visit outside warranty coverage will be charged at Rs. 4,500 plus GST, with travel charges billed separately if an onsite visit is required.
5. Installation and basic demonstration are provided by our certified team at the time of delivery. Any training beyond this is chargeable, and travel charges apply separately if required.
6. Once the product has been delivered and demonstrated in working condition, it cannot be returned. Manufacturing defects, once verified by our team, will be handled per the warranty terms above.
7. All service and repairs must be carried out only by TriAkar''s certified engineers or authorized partners. Work done by unauthorized technicians is not covered and may void the warranty.
8. Common spare parts are usually available with us; rare or uncommon spares may take longer depending on availability. Consumables are not covered under warranty.
9. Payment once made against this order is non-refundable.
10. Any disputes will be handled under Gautam Buddha Nagar, UP jurisdiction.

We confirm that the above order and payment details are true and correct as per our records.',
  'record',
  false
)
ON CONFLICT DO NOTHING;

-- ── VERIFY ───────────────────────────────────────────────────────────────────────
-- SELECT name, doc_type, is_default FROM biz_tnc_presets WHERE doc_type='record';
-- ════════════════════════════════════════════════════════════════════════════════
