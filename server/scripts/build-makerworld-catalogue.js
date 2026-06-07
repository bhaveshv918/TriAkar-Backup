// ═══════════════════════════════════════════════════════════════════
// TriAkar — MakerWorld-sourced catalogue builder
//
//   node server/scripts/build-makerworld-catalogue.js
//
// Writes catalogue/batch-{1..4}.csv (15 each) + all.csv from REAL MakerWorld
// models. For each product the name, designer and source URL are real
// (gathered from MakerWorld search). Deliberately left BLANK:
//   • est_grams / est_print_hours / size_class — you fill these from YOUR
//     slicer when you print each model, so the pricing engine computes a
//     real price (no guessed prices).
//   • images — upload your own print photos to Cloudinary as triakar/<slug>-N.
//
// Every row is license='unknown' + commercial_ok=false, so the importer keeps
// them as DRAFTS and the admin panel flags each for your licence review before
// you sell. Verify each model's MakerWorld licence (source_url) first.
// ═══════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const MW = (p) => 'https://makerworld.com/en/models/' + p;

// [ name, designer, modelPath, category, occasions(|), customizable, short ]
const P = [
  // ── DESK (17) ─────────────────────────────────────────────────────
  ['Kumiko Design Desk Organizer','KL Worx','1275973-kumiko-design-desk-organizer','desk','corporate|housewarming',false,'A Kumiko-inspired modular desk organiser with inserts for pens and stationery.'],
  ['Modular Desk Organiser','patricksnitjer01','1397248-modular-desk-organiser','desk','corporate',true,'A modern modular organiser with removable bins and optional magnets.'],
  ['Stepped Desk Organizer','HpInvent','710122-stepped-desk-organizer','desk','corporate|housewarming',false,'A tiered organiser with round inserts in varied heights that double as small pots.'],
  ['Simple Desk Organizer','3D Print Masters Hub','120659-simple-desk-organizer','desk','corporate',false,'An easy-print organiser for tools and office supplies.'],
  ['Configurable Desk Organizer','Carmelart_','636301-desk-organizer-make-your-own-configuration','desk','corporate',true,'A no-supports organiser you configure for notebooks, tools, pens and cards.'],
  ['Poly-Desk Organizer','3D Paint Lab','1820511-poly-desk-organizer','desk','corporate',false,'A compact, clean-geometry modular desk accessory.'],
  ['Organizer with Gadget','The Big Greek','140497-organizer-with-gadget','desk','corporate|birthday',false,'A timeless desk organiser with a central gadget space and card/USB holders.'],
  ['Modern Headphone Holder','ngprint','231863-headphone-holder-modern-design','desk','corporate|last-minute',false,'An adjustable, no-supports headphone holder with a rotatable scratch-free cap.'],
  ['Headphone Holder with Cable Hook','thinksolid','2418420-headphone-holder-with-cable-hook-headset-holder','desk','corporate|last-minute',false,'A dual-hook headset mount with a reverse cable hook; clamps to desks up to 30mm.'],
  ['Under-Desk Headphone Hanger','M3 Makes','824494-headphone-hanger-underware','desk','last-minute',false,'An under-desk headphone hanger for the Underware cable-management system.'],
  ['Desk-Side Headphone Clamp','SimplePrints','941155-desk-side-headphone-hanger-clamp-headset-stand','desk','corporate',false,'A space-saving clamp-on headset holder with a rear charging-cable hook.'],
  ['Wall-Mounted Headphone Stand','TomBarry','641482-wall-mounted-headphones-stand-w-cable-hooks','desk','corporate',false,'A wall-mounted headphone stand with integrated cable hooks.'],
  ['Pen & Business Card Organizer','peppinerus','113617-pencil-pen-business-card-desktop-organizer-pen-and','desk','corporate',false,'A large-capacity desktop organiser for pens, pencils and business cards.'],
  ['Modular Pen & Card Holder','modano.emidio','106770-modular-pen-holder-with-business-card-holder','desk','corporate',false,'A modular holder for up to 12 pens with an integrated business-card slot.'],
  ['Ribbed Pencil Cup','Deltaprints','633863-modern-design-ribbed-pencil-holder-pencil-cup','desk','corporate|housewarming',false,'A modern ribbed pencil cup with a clean cylindrical profile.'],
  ['Snap-On Business Card Holder','JakeSurprenant','868219-snap-on-business-card-holder','desk','corporate',false,'A compact snap-on holder sized for standard business cards.'],
  ['Dum-E Desk Buddy','NoycePrints','195554-dum-e-the-handy-desk-buddy-lamp-stand-holder','desk','birthday|corporate',false,'A characterful desk buddy that works as a phone stand, webcam mount and card holder.'],

  // ── HOME / DECOR (28) ─────────────────────────────────────────────
  ['Happy Face Planter Vase','A*i*m*e*e*','1133136-happy-face-planter-vase','home','housewarming|birthday',false,'A smiley-face planter that doubles as a candle holder.'],
  ['Organic Vase (No AMS)','Cipriani 3Design Studio','1925651-organic-vase-no-ams','home','housewarming|anniversary',false,'A single-colour vase blending modern geometry with organic form.'],
  ['Knitted Chunky-Yarn Vase','Fluid Prints','2113721-knitted-vase-chunky-yarn-planter-home-decor','home','housewarming|anniversary',false,'A vase with a high-definition chunky-knit texture that looks hand-made in wool.'],
  ['Japandi Vases','SabreDesign','964016-japandi-vases','home','housewarming|anniversary',false,'Minimal vases where Japanese and Scandinavian styles meet.'],
  ['True Moon Tea-Light Holder','Square3D','757304','home','anniversary|housewarming',false,'A decorative moon tea-light holder with space for small flowers.'],
  ['Designer Vase #1','3dnetic','105303','home','housewarming|anniversary',false,'A sculptural vase with unique geometric patterning.'],
  ['Modular Wall Art Panels','Creative Electronics','796160-modular-background-panels-wall-art','home','housewarming',false,'Lightweight, sturdy modular wall panels, great as a backdrop.'],
  ['Wall Art Organizer','3D Paint Lab','2713282-wall-art-organizer','home','housewarming',false,'Wall art that turns ordinary storage into a living gallery.'],
  ['Plug-In Wall Panels','3D_aniel','827511-wall-panels','home','housewarming',false,'A plug-in wall-panel system; add any number of panels to a backplate.'],
  ['KYRO Modular Wall System','Yousuf Zakaria','2786208-kyro-modular-wall-system','home','housewarming|corporate',true,'A Bauhaus-inspired modular wall organisation system.'],
  ['Family Mountain Wall Decor','Ziken','2512093-family-mountain-art-wall-decor','home','housewarming|anniversary',true,'A 315mm mountain wall piece customisable with family names.'],
  ['Kitchen Utensil Holder','UniversalMaker','1107388-kitchen-utensil-holder','home','housewarming',false,'Holds utensils and pot lids while keeping counters clear.'],
  ['Spiral Utensils Holder','Vostok Labs','1285132-kitchen-utensils-holder','home','housewarming',false,'A minimal cylindrical holder with a clean spiral texture.'],
  ['Draining Cutlery Holder','Cipriani 3Design Studio','1876460-modern-utensil-holder-draining-cutlery-organizer','home','housewarming',false,'An openwork cutlery holder that drains water efficiently.'],
  ['PanPal Pans & Lids Organizer','Raul Molina','519634-panpal-pans-lids-organizer','home','housewarming',false,'A stylish, functional organiser for pans and lids.'],
  ['Sink Rack with Cloth Holder','Tomik s Cuprou','2458143-kitchen-organizer-with-cloth-holder-sink-rack','home','housewarming',false,'A minimalist sink organiser with a drip tray and dishcloth rails.'],
  ['Gridfinity Drawer Organizer','Valorian','608048-ultimate-gridfinity-kitchen-drawer-organizer','home','housewarming',false,'A Gridfinity-based system to organise kitchen drawers.'],
  ['Kitchen Utility Bar','6p14y3r','770712-kitchen-utility-holder-bar','home','housewarming',false,'A simple kitchen holder that fits an 8mm rod.'],
  ['Coquette Bow Jewelry Stand','TheHexArtist','2190807-coquette-bow-jewelry-stand-trinket-dish','home','anniversary|birthday',false,'A bow stand for necklaces with an integrated ring-and-earring dish.'],
  ['Minimalist Jewelry Organizer','Deltaprints','2069104-jewelry-organizer-for-earrings-rings-necklaces','home','anniversary|housewarming',false,'A minimalist organiser for earrings, necklaces and rings.'],
  ['Jewelry Accessories Stand','Printing3Design','1582368-jewelry-stand-for-earrings-necklaces-bracelets-etc','home','anniversary|birthday',false,'A modern stand for earrings, necklaces, bracelets, rings and watches.'],
  ['Lotus Ring & Jewelry Tray','Cy-Bea','401786-lotus-ring-jewelry-holder-tray','home','anniversary|birthday',false,'Lotus trays that stack or stand alone for rings and jewellery.'],
  ['Minimalist Round Coaster','Deltaprints','688070-minimalist-round-design-coaster-for-drinks','home','housewarming|last-minute',false,'A minimalist round drinks coaster that prints without supports.'],
  ['D&D Drink Coasters + Holder','JP.Potter','17268-d-d-inspired-drink-coasters-and-holder','home','birthday|housewarming',false,'Themed drink coasters with a holder for four.'],
  ['Music DJ Coaster Set','3DPrintCraft','106192','home','birthday|housewarming',false,'Four DJ-themed coasters with a matching holder.'],
  ['Low-Profile Coaster Holder','TERRAIN 3D','124012-drink-coaster-holder','home','housewarming|last-minute',false,'A simple low-profile holder for four 100mm coasters.'],
  ['Parametric Coaster Set','JohnBCS','1788388-customizable-parametric-coaster-holder-sets','home','housewarming',true,'A customisable coaster set in square or round shapes.'],
  ['Design Lamp – The Wave','JANBERRY DESIGN','2571932-design-lamp-the-wave','home','housewarming|anniversary',false,'A modern design lamp with a captivating wave light effect (Bambu LED kit).'],

  // ── GIFTING (8) ───────────────────────────────────────────────────
  ['Dad Cap Keepsake Box','CAD&Chaos','2878918-flat-bill-cap-storage-box-collection-no-ams','gifting','birthday|anniversary',false,'A trucker-cap-shaped keepsake box for keys, watches and small treasures.'],
  ['Twelve-in-One Fidget Set','YEZAO','881223-version-2-0-twelve-in-one-fidget-toy-set','gifting','birthday|last-minute',false,'A twelve-in-one fidget toy set in a single print.'],
  ['Fidget Toy Phone','Milo','619089-fidget-toy-phone','gifting','birthday|last-minute',false,'A playful fidget toy styled as a phone.'],
  ['EDC Phone Stand + Fidget','Joywent','912144-phone-stand-edc-fidget-toy-energy-core','gifting','birthday|last-minute',false,'A mecha-style phone stand and EDC fidget with a tactile click knob.'],
  ['Pinky Buddy Phone Grip & Fidget','G3D Printlab','1763502-pinky-buddy-ergonomic-phone-grip-fidget','gifting','birthday|last-minute',false,'An ergonomic phone grip with free-moving gyro rings that double as a fidget.'],
  ['Photo Frame Ornament','chemistbyday','120466-photo-frame-ornament-wallet-parametric','gifting','anniversary|birthday',true,'A wallet-photo frame ornament; parametric and resizable.'],
  ['Instax Mini Frame & Ornament','JamesD','841698-instax-mini-frame-and-ornament','gifting','birthday|anniversary',false,'A frame for Instax Mini photos; stands on a table or hangs as an ornament.'],
  ['Christmas Tea-Light Ornament','Maxx Design','2080596-designer-christmas-tea-light-ornament','gifting','anniversary|housewarming',false,'An openwork tea-light ornament that casts elegant patterns.'],

  // ── CUSTOM / PERSONALISED (7) ─────────────────────────────────────
  ['Custom Name Desk Organizer','Voy_Zoro','2812978-custom-name-desk-organizer-the-perfect-3d-gift','custom','birthday|corporate',true,'Turn any name or word into a functional 3D-letter desk organiser.'],
  ['Customizable Name Keychain','Mia Germansen','1934276-customizable-name-keychain','custom','birthday|last-minute',true,'Add any name or text in fun fonts via the parametric maker.'],
  ['Name Keychain Generator','busterblake27','480136-custom-name-keychain-generator','custom','birthday|last-minute',true,'Generate a keychain for any name with adjustable settings and fonts.'],
  ['Parametric Name Keychains','Vanessa','2679660-customizable-name-keychains','custom','birthday|last-minute',true,'A fully parametric keychain with control over every detail.'],
  ['Sweeping 2-Line Name Plate','Makkuro','436531-sweeping-2-line-name-plate-customizable','custom','corporate|housewarming',true,'A desktop nameplate that sweeps around in a circle.'],
  ['Customizable 3D Name Plate','Makkuro','436628-customizable-3d-name-plate','custom','corporate|housewarming',true,'A configurable nameplate of extruded letters.'],
  ['Personalized Initial & Name Sign','Kasperzi','2845165-personalized-initial-name-sign-customizable','custom','birthday|housewarming',true,'A bold oversized initial paired with a scripted name; great for kids’ rooms.'],
];

const HEADER = ['name','slug','category','occasions','size_class','material','est_grams','est_print_hours','is_customizable','customization_fields','short_description','long_description','bullet_points','use_case','target_audience','stock_status','sku','tags','images','designer','source_url','license','commercial_ok'];

const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

function rowFor(item, i) {
  const [name, designer, modelPath, cat, occ, custom, short] = item;
  const slug = slugify(name);
  return {
    name, slug, category: cat,
    occasions: occ,
    size_class: '',                 // ← fill from your slicer
    material: 'PLA+',
    est_grams: '',                  // ← fill from your slicer (drives price)
    est_print_hours: '',            // ← fill from your slicer (drives price)
    is_customizable: custom ? 'true' : 'false',
    customization_fields: custom ? JSON.stringify([{ label: 'Personalisation (name / text)', type: 'text', required: false }]) : '',
    short_description: short,
    long_description: short,
    bullet_points: '',
    use_case: '', target_audience: '',
    stock_status: 'Made to Order',
    sku: 'TRK-M' + String(i + 1).padStart(3, '0'),
    tags: cat + ',3d printed',
    images: `triakar/${slug}-1|triakar/${slug}-2`,
    designer,                       // ← REAL MakerWorld designer
    source_url: MW(modelPath),      // ← REAL MakerWorld model link
    license: 'unknown',             // ← verify on the source page before selling
    commercial_ok: 'false',         // ← flagged in admin until you clear it
  };
}

function writeCSV(file, rows) {
  const lines = [HEADER.join(',')].concat(rows.map((r) => HEADER.map((h) => csvCell(r[h])).join(',')));
  fs.writeFileSync(file, lines.join('\n') + '\n', 'utf8');
}

// guard against accidental duplicate slugs
const seen = new Set();
P.forEach(([n]) => { const s = slugify(n); if (seen.has(s)) throw new Error('Duplicate slug: ' + s); seen.add(s); });

const outDir = path.resolve('catalogue');
fs.mkdirSync(outDir, { recursive: true });
const rows = P.map(rowFor);
const BATCH = 15;
for (let b = 0; b * BATCH < rows.length; b++) {
  const slice = rows.slice(b * BATCH, (b + 1) * BATCH);
  writeCSV(path.join(outDir, `batch-${b + 1}.csv`), slice);
  console.log(`  ✓ catalogue/batch-${b + 1}.csv  (${slice.length} products)`);
}
writeCSV(path.join(outDir, 'all.csv'), rows);
console.log(`\nWrote ${rows.length} REAL MakerWorld-sourced products (${Math.ceil(rows.length / BATCH)} batches) + all.csv.`);
console.log('Designers + source links are real. Fill grams/hours per model to price them; verify each licence before selling.');
