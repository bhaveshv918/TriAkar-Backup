// TriAkar — Product Studio prompt engine. Pure string templating, no external
// AI call: fills the 6 fixed image-prompt templates from product field values,
// dropping any clause whose data is missing instead of leaving it blank.

function formatDimensions(p) {
  if (p.dim_length && p.dim_width && p.dim_height) {
    return `${p.dim_length} x ${p.dim_width} x ${p.dim_height} ${p.dim_unit || 'cm'}`;
  }
  return p.dimensions || '';
}

function primaryColor(p) {
  if (p.primary_color) return p.primary_color;
  const colors = Array.isArray(p.colors) ? p.colors : [];
  return colors[0] || '';
}

function keyFeatures(p, count) {
  const raw = p.key_features || '';
  return raw.split(/\r?\n|,/).map(f => f.trim()).filter(Boolean).slice(0, count);
}

export function generatePrompts(product) {
  const p = product || {};
  const name = p.name || 'the product';
  const material = p.material || '';
  const color = primaryColor(p);
  const dims = formatDimensions(p);
  const useCase = p.use_case || '';
  const [f1, f2, f3] = keyFeatures(p, 3);

  const madeFrom = material ? `, made from ${material}` : '';
  const inColor = color ? `, in ${color} color` : '';
  const showingMaterial = material ? `, showing craftsmanship and surface detail of ${material}` : '';
  const forUseCase = useCase ? ` relevant to ${useCase}` : '';
  const callouts = [f1, f2, f3].filter(Boolean);
  const calloutClause = callouts.length
    ? `, ready for adding labeled arrows pointing to: ${callouts.join(', ')}`
    : '';
  const dimsClause = dims
    ? `, with a thin black horizontal dimension line placed below the product with small end caps, labeled with the exact measurement '${dims}'`
    : '';

  return {
    hero: `Professional product photography of ${name}${madeFrom}${inColor}, centered on pure white seamless background, soft studio lighting, subtle shadow beneath product, high detail, commercial e-commerce style, TriAkar brand aesthetic (clean, premium, minimal), no text overlay, 4k quality.`,

    angle45: `Product photography of ${name} shot from a 45-degree elevated angle, pure white background${showingMaterial}, soft even lighting, no harsh shadows, premium minimal aesthetic, high resolution commercial shot.`,

    feature_callout: `Product photography of ${name} on pure white background, styled for a feature-highlight graphic with clean empty space around the product for text callouts, product positioned slightly off-center, soft studio lighting, minimal shadow${calloutClause}.`,

    lifestyle: `Product photography of ${name} shown in a realistic use-case setting${forUseCase}, natural but clean environment, soft natural lighting, product remains the clear focal point, background softly blurred, premium lifestyle commercial photography style.`,

    scale_line: `Product photography of ${name} on pure white background, photographed straight-on from the front${dimsClause}, clean minimal technical/spec-sheet style, no other text, no clutter, sharp focus, even lighting.`,

    scale_iphone: `Product photography of ${name} placed next to a plain iPhone (no case, screen off, generic silhouette, no visible logo or brand text) for scale reference, both objects on pure white seamless background, front-facing straight-on angle, even soft studio lighting, minimal shadow, clean commercial comparison shot, no added text or labels.`,
  };
}
