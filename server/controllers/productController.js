import supabase from '../db/supabaseClient.js';

export async function getAllProducts(req, res, next) {
  try {
    const { category, customizable } = req.query;

    let query = supabase
      .from('products')
      .select('id, name, slug, description, price, category, stock_qty, images, is_customizable')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (category) query = query.eq('category', category);
    if (customizable === 'true') query = query.eq('is_customizable', true);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ products: data });
  } catch (err) {
    next(err);
  }
}

export async function getProductBySlug(req, res, next) {
  try {
    const { slug } = req.params;

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ product: data });
  } catch (err) {
    next(err);
  }
}

export async function getProductsByCategory(req, res, next) {
  try {
    const { category } = req.params;

    const { data, error } = await supabase
      .from('products')
      .select('id, name, slug, price, category, images, stock_qty, is_customizable')
      .eq('category', category)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ products: data });
  } catch (err) {
    next(err);
  }
}
