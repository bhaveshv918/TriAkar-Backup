import supabase from '../db/supabaseClient.js';
import { generatePrompts } from '../lib/promptTemplates.js';
import { logActivity } from '../services/activityLog.js';

// ── Custom Field Definitions (Product Studio's dynamic-field manager) ──────────

export async function listCustomFields(req, res, next) {
  try {
    const { category } = req.query;
    let q = supabase.from('custom_field_definitions').select('*').order('sort_order', { ascending: true });
    if (category) q = q.in('category', [category, 'all']);
    const { data, error } = await q;
    if (error) throw error;
    res.json({ fields: data || [] });
  } catch (err) { next(err); }
}

export async function createCustomField(req, res, next) {
  try {
    const b = req.body || {};
    if (!b.category || !b.field_key || !b.field_label || !b.field_type) {
      return res.status(400).json({ error: 'category, field_key, field_label, and field_type are required' });
    }
    const { data, error } = await supabase.from('custom_field_definitions').insert({
      category: b.category,
      field_key: b.field_key,
      field_label: b.field_label,
      field_type: b.field_type,
      field_options: b.field_options || null,
      is_active: b.is_active !== false,
      sort_order: b.sort_order || 0,
    }).select().single();
    if (error) throw error;
    logActivity(req.user?.email, 'custom_field.create', 'custom_field', data.id, b.field_label);
    res.status(201).json({ field: data });
  } catch (err) { next(err); }
}

export async function updateCustomField(req, res, next) {
  try {
    const { id } = req.params;
    const b = req.body || {};
    const payload = {};
    for (const k of ['category', 'field_key', 'field_label', 'field_type', 'field_options', 'is_active', 'sort_order']) {
      if (b[k] !== undefined) payload[k] = b[k];
    }
    const { data, error } = await supabase.from('custom_field_definitions').update(payload).eq('id', id).select().single();
    if (error) throw error;
    res.json({ field: data });
  } catch (err) { next(err); }
}

export async function deleteCustomField(req, res, next) {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('custom_field_definitions').delete().eq('id', id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) { next(err); }
}

// ── Image prompt generation ─────────────────────────────────────────────────

export async function generateProductPrompts(req, res, next) {
  try {
    const { id } = req.params;
    const { data: product, error } = await supabase.from('products').select('*').eq('id', id).single();
    if (error) throw error;
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const prompts = generatePrompts(product);

    const { data: entry, error: histErr } = await supabase.from('product_prompt_history').insert({
      product_id: id,
      prompts,
      source_snapshot: product,
      created_by: req.user?.id || null,
    }).select().single();
    if (histErr) throw histErr;

    logActivity(req.user?.email, 'product.generate_prompts', 'product', id, product.name);
    res.json({ prompts, history_id: entry.id });
  } catch (err) { next(err); }
}

export async function getProductPromptHistory(req, res, next) {
  try {
    const { id } = req.params;
    const { data, error } = await supabase.from('product_prompt_history')
      .select('id, prompts, created_at')
      .eq('product_id', id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) throw error;
    res.json({ history: data || [] });
  } catch (err) { next(err); }
}
