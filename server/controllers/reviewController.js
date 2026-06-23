import supabase from '../db/supabaseClient.js';
import { uploadBufferToCloudinary } from '../services/cloudinaryService.js';

/* ─────────────────────────────────────────────────────────────────────────
   PUBLIC — GET /api/reviews/:slug
   Returns approved reviews for a product slug.
───────────────────────────────────────────────────────────────────────── */
export async function getReviews(req, res) {
  try {
    const { slug } = req.params;
    const { data, error } = await supabase
      .from('reviews')
      .select('id,reviewer_name,rating,review,images,verified_purchase,city,source,created_at,admin_reply')
      .eq('product_slug', slug)
      .eq('status', 'approved')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ reviews: data || [] });
  } catch (e) {
    console.error('getReviews:', e);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}

/* ─────────────────────────────────────────────────────────────────────────
   ADMIN — GET /api/reviews/
   Returns all reviews with optional ?status= and ?slug= filters.
───────────────────────────────────────────────────────────────────────── */
export async function getAllReviews(req, res) {
  try {
    const { status, slug, page = 1, limit = 100 } = req.query;
    const from = (Number(page) - 1) * Number(limit);
    const to   = from + Number(limit) - 1;

    let query = supabase
      .from('reviews')
      .select('*', { count: 'exact' })
      .is('deleted_at', null)            // soft-deleted reviews live in the Recycle Bin
      .order('created_at', { ascending: false })
      .range(from, to);

    if (status) query = query.eq('status', status);
    if (slug)   query = query.eq('product_slug', slug);

    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ reviews: data || [], total: count || 0 });
  } catch (e) {
    console.error('getAllReviews:', e);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}

/* ─────────────────────────────────────────────────────────────────────────
   AUTHENTICATED — POST /api/reviews/
   Submits a new review. Handles image uploads via multipart.
   Status defaults to 'pending' (admin must approve).
───────────────────────────────────────────────────────────────────────── */
export async function createReview(req, res) {
  try {
    const { slug, rating, review, reviewer_name, city, source } = req.body;

    if (!slug || !rating || !review) {
      return res.status(400).json({ error: 'slug, rating, and review are required' });
    }
    if (Number(rating) < 1 || Number(rating) > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    // Upload up to 3 images to Cloudinary (non-blocking — review saves even if upload fails)
    let imageUrls = [];
    if (req.files && req.files.length > 0) {
      try {
        const uploads = await Promise.all(
          req.files.slice(0, 3).map(f =>
            uploadBufferToCloudinary(f.buffer, { folder: 'triakar/reviews' })
          )
        );
        imageUrls = uploads.map(u => u.secure_url);
      } catch (uploadErr) {
        console.error('Cloudinary upload failed — saving review without images:', uploadErr.message);
        // Review still gets saved, just without images
      }
    }

    // Determine verified purchase status
    let verified_purchase = false;
    if (req.user) {
      const { data: prod } = await supabase
        .from('products')
        .select('id')
        .eq('slug', slug)
        .single();

      if (prod) {
        const { data: matchItems } = await supabase
          .from('order_items')
          .select('id, orders!inner(user_id, status)')
          .eq('product_id', prod.id)
          .eq('orders.user_id', req.user.id);

        verified_purchase = !!(matchItems && matchItems.length > 0);
      }
    }

    const name = reviewer_name?.trim()
      || req.user?.user_metadata?.full_name
      || 'Customer';

    const { data, error } = await supabase
      .from('reviews')
      .insert({
        product_slug:      slug,
        user_id:           req.user?.id || null,
        reviewer_name:     name,
        reviewer_email:    req.user?.email || null,
        rating:            Number(rating),
        review,
        images:            imageUrls,
        verified_purchase,
        status:            'pending',
        source:            source || 'website',
        city:              city?.trim() || null,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ review: data, message: 'Review submitted — it will appear after approval.' });
  } catch (e) {
    console.error('createReview:', e);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}

/* ─────────────────────────────────────────────────────────────────────────
   ADMIN — POST /api/reviews/admin
   Create a review by hand from the admin panel. Runs on the service-role client
   so it is NOT blocked by RLS (the old admin "Add Review" did sb.from('reviews')
   .insert() in the browser, which RLS silently rejected).
───────────────────────────────────────────────────────────────────────── */
export async function createReviewAdmin(req, res) {
  try {
    const b = req.body || {};
    if (!b.product_slug || !b.reviewer_name || !b.rating || !b.review) {
      return res.status(400).json({ error: 'product_slug, reviewer_name, rating and review are required' });
    }
    const rating = Number(b.rating);
    if (rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be 1–5' });

    const row = {
      product_slug:      b.product_slug,
      product_name:      b.product_name || null,
      reviewer_name:     b.reviewer_name,
      rating,
      review:            b.review,
      status:            ['pending','approved','rejected','flagged'].includes(b.status) ? b.status : 'approved',
      verified_purchase: !!b.verified_purchase,
      source:            b.source || 'website',
      city:              b.city || null,
      admin_note:        b.admin_note  || null,
      admin_reply:       b.admin_reply || null,
      images:            Array.isArray(b.images) ? b.images : [],
    };
    if (b.created_at) row.created_at = b.created_at;

    const { data, error } = await supabase.from('reviews').insert(row).select().single();
    if (error) throw error;
    res.status(201).json({ review: data });
  } catch (e) {
    console.error('createReviewAdmin:', e);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}

/* ─────────────────────────────────────────────────────────────────────────
   ADMIN — PUT /api/reviews/:id
   Full update (edit any field).
───────────────────────────────────────────────────────────────────────── */
export async function updateReview(req, res) {
  try {
    const { id } = req.params;
    const allowed = [
      'reviewer_name','rating','review','images','verified_purchase',
      'status','admin_note','admin_reply','city','source',
      'product_slug','product_name','created_at',
    ];
    const updates = {};
    allowed.forEach(k => {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    });
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('reviews')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ review: data });
  } catch (e) {
    console.error('updateReview:', e);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}

/* ─────────────────────────────────────────────────────────────────────────
   ADMIN — PATCH /api/reviews/:id/status
   Quick approve / reject / set pending.
───────────────────────────────────────────────────────────────────────── */
export async function patchStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['pending', 'approved', 'rejected', 'flagged'].includes(status)) {
      return res.status(400).json({ error: 'status must be pending, approved, rejected, or flagged' });
    }
    const { data, error } = await supabase
      .from('reviews')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ review: data });
  } catch (e) {
    console.error('patchStatus:', e);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}

/* ─────────────────────────────────────────────────────────────────────────
   ADMIN — DELETE /api/reviews/:id
   Soft-delete → Recycle Bin (recoverable). Permanent removal happens from the
   bin (adminRecycleController) or via the 30-day auto-purge.
───────────────────────────────────────────────────────────────────────── */
export async function deleteReview(req, res) {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('reviews')
      .update({ deleted_at: new Date().toISOString(), deleted_by: req.user?.email || 'admin' })
      .eq('id', id);

    if (error) throw error;
    res.json({ message: 'Review moved to Recycle Bin' });
  } catch (e) {
    console.error('deleteReview:', e);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
