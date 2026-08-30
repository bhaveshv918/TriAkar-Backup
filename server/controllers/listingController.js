import Anthropic from '@anthropic-ai/sdk';

// ═══════════════════════════════════════════════════════════
// MakerWorld Listing Generator — admin-only Claude API proxy.
// The Anthropic key lives server-side only; admin.html calls
// POST /api/admin/generate-listing with the print inputs.
// ═══════════════════════════════════════════════════════════

const MODEL = 'claude-sonnet-4-6'; // claude-sonnet-4-20250514 retires 15 Jun 2026

const SYSTEM_PROMPT = `You are a product listing writer for TriAkar, a 3D printing service based in India. Your job is to create compelling, honest product listings for items we print and sell.
Rules:

* No em dashes
* No dollar prices — only ₹ INR
* No Hindi copy
* No generic AI-sounding content
* Descriptions should sound like a real Indian maker talking to a customer
* Focus on utility, quality, and what problem the product solves
* "7-Day Reprint Guarantee" is our policy (not "returns")
* Shop hours: Monday–Saturday, 11 AM–9 PM
* WhatsApp ordering available
Respond ONLY with a valid JSON object. No preamble, no markdown backticks. Example shape: { "title": "...", "short_description": "...", "long_description": "...", "tags": ["...", "..."], "category": "...", "suggested_price_inr": 0, "shipping_note": "...", "production_note": "..." }`;

const LISTING_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Under 60 chars, punchy, no em dashes' },
    short_description: { type: 'string', description: '2 lines max, for the product card' },
    long_description: { type: 'string', description: 'Full product detail page description: material, use case, finish, benefits' },
    tags: { type: 'array', items: { type: 'string' }, description: '5-7 keywords' },
    category: { type: 'string', description: 'Best guess, e.g. "Home & Office", "Replacement Parts", "Hobby & Decor", "Tools", "Educational"' },
    suggested_price_inr: { type: 'number' },
    shipping_note: { type: 'string' },
    production_note: { type: 'string' },
  },
  required: ['title', 'short_description', 'long_description', 'tags', 'category', 'suggested_price_inr', 'shipping_note', 'production_note'],
  additionalProperties: false,
};

export async function generateListing(req, res, next) {
  try {
    // The key lives on the server only. It used to be accepted per-request from the
    // admin panel, which meant a real secret sat in the browser's localStorage where
    // any XSS could read it. Nothing about the key ever reaches the browser now.
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'No Anthropic key. Set ANTHROPIC_API_KEY on the server.' });
    }

    const { url, material, print_hours, filament_cost, markup } = req.body;
    if (!url || !material || !print_hours || !filament_cost || !markup) {
      return res.status(400).json({ error: 'url, material, print_hours, filament_cost, and markup are required' });
    }
    if (!/^https?:\/\/(www\.)?makerworld\.com\//i.test(String(url))) {
      return res.status(400).json({ error: 'url must be a MakerWorld model URL' });
    }
    const hours = Number(print_hours);
    const cost = Number(filament_cost);
    const mult = Number(markup);
    if (!(hours > 0) || !(cost > 0) || !(mult > 0)) {
      return res.status(400).json({ error: 'print_hours, filament_cost, and markup must be positive numbers' });
    }

    // Price is deterministic — computed here, never left to the model:
    // (filament cost + print hours × ₹40 machine rate) × 1.15 overhead × markup, to nearest ₹10
    const suggestedPrice = Math.round(((cost + hours * 40) * 1.15 * mult) / 10) * 10;

    const userPrompt =
      `MakerWorld URL: ${url} Material: ${material} Print time: ${hours} hours Filament cost: ₹${cost} Target markup: ${mult}x\n` +
      `Please generate a TriAkar product listing for this item. Use the URL to infer the product name and use case (you cannot fetch URLs, so work from the URL slug and any context in it). Write as if you have printed this item and are describing it from experience.`;

    const anthropic = new Anthropic();   // reads ANTHROPIC_API_KEY from the environment
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      output_config: { format: { type: 'json_schema', schema: LISTING_SCHEMA } },
      messages: [{ role: 'user', content: userPrompt }],
    });

    if (response.stop_reason === 'refusal') {
      return res.status(422).json({ error: 'The model declined to generate this listing' });
    }

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock) {
      return res.status(502).json({ error: 'Empty response from the Claude API' });
    }

    let listing;
    try {
      listing = JSON.parse(textBlock.text);
    } catch {
      console.error('[generate-listing] non-JSON model output:', textBlock.text.slice(0, 500));
      return res.status(502).json({ error: 'Model returned invalid JSON' });
    }

    listing.suggested_price_inr = suggestedPrice;
    listing.shipping_note = listing.shipping_note || 'Standard: ₹99 / Express available';
    listing.production_note = listing.production_note || '72hr average production time';

    res.json({ listing });
  } catch (err) {
    console.error('[generate-listing] failed:', err.message);
    next(err);
  }
}
