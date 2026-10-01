/* ============================================================
   STORE THEMES — six looks, each a full set of settings and sections.
   A store's theme is {id, s: settings, sections: [...]}: start from a
   theme, then change anything. Remix shuffles colours, fonts and shapes
   within what suits the theme.
   ============================================================ */
var SK_FONTS = {
  display: ['Instrument Serif', 'Playfair Display', 'Cormorant Garamond', 'Fraunces', 'DM Serif Display', 'Bodoni Moda', 'Italiana',
            'Anton', 'Bebas Neue', 'Archivo Black', 'Big Shoulders Display', 'Unbounded', 'Syne', 'Space Grotesk', 'Bricolage Grotesque',
            'Righteous', 'Permanent Marker', 'Caveat', 'Geist'],
  body: ['Geist', 'Inter', 'DM Sans', 'Manrope', 'Work Sans', 'Space Grotesk', 'IBM Plex Sans', 'Karla', 'Outfit', 'Nunito', 'Archivo', 'Geist Mono'],
  arabic: ['Cairo', 'Tajawal', 'Almarai', 'IBM Plex Sans Arabic', 'Readex Pro', 'Noto Kufi Arabic', 'Reem Kufi', 'El Messiri', 'Lalezar',
           'Rakkas', 'Aref Ruqaa', 'Amiri', 'Marhey', 'Changa']
};
/* weights to load per family (Google Fonts) */
var SK_FONT_W = {
  'Instrument Serif': 'ital@0;1', 'Playfair Display': 'ital,wght@0,400;0,600;0,800;1,400', 'Cormorant Garamond': 'ital,wght@0,400;0,500;0,600;1,400',
  'Fraunces': 'ital,wght@0,400;0,600;0,800;1,400', 'DM Serif Display': 'ital@0;1', 'Bodoni Moda': 'ital,wght@0,400;0,600;0,800;1,400', 'Italiana': '',
  'Anton': '', 'Bebas Neue': '', 'Archivo Black': '', 'Big Shoulders Display': 'wght@500;700;900', 'Unbounded': 'wght@400;600;800',
  'Syne': 'wght@500;700;800', 'Space Grotesk': 'wght@400;500;700', 'Bricolage Grotesque': 'wght@400;600;800', 'Righteous': '', 'Permanent Marker': '',
  'Caveat': 'wght@500;700', 'Geist': 'wght@300..700', 'Inter': 'wght@400;500;600;700', 'DM Sans': 'wght@400;500;700', 'Manrope': 'wght@400;500;700;800',
  'Work Sans': 'wght@400;500;700', 'IBM Plex Sans': 'wght@400;500;700', 'Karla': 'wght@400;500;700', 'Outfit': 'wght@400;500;700', 'Nunito': 'wght@400;600;800',
  'Archivo': 'wght@400;500;700;800', 'Geist Mono': 'wght@400;500', 'Cairo': 'wght@400;600;800', 'Tajawal': 'wght@400;500;700;800', 'Almarai': 'wght@400;700;800',
  'IBM Plex Sans Arabic': 'wght@400;500;700', 'Readex Pro': 'wght@400;500;700', 'Noto Kufi Arabic': 'wght@400;600;800', 'Reem Kufi': 'wght@400;600;700',
  'El Messiri': 'wght@400;600;700', 'Lalezar': '', 'Rakkas': '', 'Aref Ruqaa': 'wght@400;700', 'Amiri': 'ital,wght@0,400;0,700;1,400', 'Marhey': 'wght@400;600',
  'Changa': 'wght@400;600;800'
};
function skFontsUrl(families){
  var seen = {}, parts = [];
  families.forEach(function(f){
    if(!f || seen[f] || SK_FONT_W[f] === undefined) return; seen[f] = 1;
    parts.push('family=' + encodeURIComponent(f).replace(/%20/g, '+') + (SK_FONT_W[f] ? ':' + SK_FONT_W[f] : ''));
  });
  return parts.length ? 'https://fonts.googleapis.com/css2?' + parts.join('&') + '&display=swap' : '';
}
var SK_FALLBACK = { serif: "Georgia, 'Times New Roman', serif", sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", ar: "'Segoe UI', Tahoma, sans-serif" };
var SK_SERIFS = { 'Instrument Serif': 1, 'Playfair Display': 1, 'Cormorant Garamond': 1, 'Fraunces': 1, 'DM Serif Display': 1, 'Bodoni Moda': 1, 'Italiana': 1, 'Amiri': 1, 'Aref Ruqaa': 1 };
function skFontStack(f, arabic){ return "'" + f + "', " + (arabic ? SK_FALLBACK.ar : (SK_SERIFS[f] ? SK_FALLBACK.serif : SK_FALLBACK.sans)); }

/* curated palettes: bg, surface, text, muted, accent, accentText, line, sale */
var SK_PALETTES = [
  { id: 'linen', name: 'Linen', c: { bg: '#F2EBDF', surface: '#FBF7F0', text: '#2A2119', muted: '#7A6D5C', accent: '#9A6A3C', accentText: '#FFFFFF', line: 'rgba(42,33,25,.12)', sale: '#B5482B' } },
  { id: 'espresso', name: 'Espresso', c: { bg: '#E9DFD0', surface: '#F7F1E7', text: '#1F160F', muted: '#6E5E4C', accent: '#1F160F', accentText: '#F7F1E7', line: 'rgba(31,22,15,.14)', sale: '#B5482B' } },
  { id: 'concrete', name: 'Concrete', c: { bg: '#EDEDEA', surface: '#FFFFFF', text: '#0E0E0E', muted: '#5C5C5C', accent: '#D7FF3A', accentText: '#0E0E0E', line: 'rgba(14,14,14,.9)', sale: '#FF3B1F' } },
  { id: 'acid', name: 'Acid', c: { bg: '#0E0E0E', surface: '#1A1A1A', text: '#F2F2EE', muted: '#9A9A95', accent: '#D7FF3A', accentText: '#0E0E0E', line: 'rgba(242,242,238,.18)', sale: '#FF5C39' } },
  { id: 'peach', name: 'Peach', c: { bg: '#FFF1E8', surface: '#FFFFFF', text: '#2B2240', muted: '#7B6F8C', accent: '#7C5CFF', accentText: '#FFFFFF', line: 'rgba(43,34,64,.12)', sale: '#FF5C8A' } },
  { id: 'mint', name: 'Mint', c: { bg: '#EAF6EF', surface: '#FFFFFF', text: '#173A2F', muted: '#5E7C71', accent: '#FF7A59', accentText: '#FFFFFF', line: 'rgba(23,58,47,.12)', sale: '#E5484D' } },
  { id: 'bubblegum', name: 'Bubblegum', c: { bg: '#FFE9F3', surface: '#FFFFFF', text: '#3A1230', muted: '#8C5F7F', accent: '#2D6BFF', accentText: '#FFFFFF', line: 'rgba(58,18,48,.12)', sale: '#FF3D7F' } },
  { id: 'noir', name: 'Noir', c: { bg: '#0F0E0D', surface: '#181715', text: '#EDE6DA', muted: '#9B9284', accent: '#C9A86A', accentText: '#0F0E0D', line: 'rgba(237,230,218,.14)', sale: '#D98E73' } },
  { id: 'oxblood', name: 'Oxblood', c: { bg: '#1A0E0E', surface: '#251515', text: '#F3E7DF', muted: '#B39C92', accent: '#E8C9A0', accentText: '#1A0E0E', line: 'rgba(243,231,223,.14)', sale: '#FF8A6B' } },
  { id: 'sand', name: 'Sand & Clay', c: { bg: '#F4E7D6', surface: '#FFF8EE', text: '#2D1E14', muted: '#80695A', accent: '#B5482B', accentText: '#FFF8EE', line: 'rgba(45,30,20,.13)', sale: '#B5482B' } },
  { id: 'nile', name: 'Nile', c: { bg: '#EEF1EC', surface: '#FFFFFF', text: '#12312F', muted: '#5E7472', accent: '#1F5E5B', accentText: '#FFFFFF', line: 'rgba(18,49,47,.13)', sale: '#C2573A' } },
  { id: 'paper', name: 'Paper', c: { bg: '#FFFFFF', surface: '#F5F5F3', text: '#111111', muted: '#6B6B6B', accent: '#111111', accentText: '#FFFFFF', line: 'rgba(17,17,17,.12)', sale: '#E5484D' } },
  { id: 'cobalt', name: 'Cobalt', c: { bg: '#F4F5F9', surface: '#FFFFFF', text: '#0B1A3D', muted: '#5A6789', accent: '#1F4BFF', accentText: '#FFFFFF', line: 'rgba(11,26,61,.12)', sale: '#FF4D2E' } },
  { id: 'butter', name: 'Butter', c: { bg: '#FFF6D9', surface: '#FFFCF0', text: '#1B1B3A', muted: '#6B6A80', accent: '#FF5C39', accentText: '#FFFFFF', line: 'rgba(27,27,58,.14)', sale: '#2D6BFF' } },
  { id: 'olive', name: 'Olive Grove', c: { bg: '#ECE9DC', surface: '#F8F6EE', text: '#22261A', muted: '#6E715E', accent: '#5C6B3A', accentText: '#F8F6EE', line: 'rgba(34,38,26,.14)', sale: '#B5482B' } },
  { id: 'lavender', name: 'Lavender', c: { bg: '#F1EEFA', surface: '#FFFFFF', text: '#231B3B', muted: '#736A8E', accent: '#231B3B', accentText: '#FFFFFF', line: 'rgba(35,27,59,.12)', sale: '#E5484D' } }
];

function skDeep(o){ return JSON.parse(JSON.stringify(o)); }
var SK_BASE_S = {
  colors: SK_PALETTES[0].c,
  font: { heading: 'Instrument Serif', body: 'Geist', headingAr: 'El Messiri', bodyAr: 'Cairo', weight: 400, upper: false, track: -0.02, scale: 1 },
  radius: 16, button: 'pill', card: { ratio: '3/4', style: 'plain', hover: 'swap', align: 'left' },
  header: { layout: 'center', style: 'glass', sticky: true, logoText: '', logoMedia: null, logoScale: 1 },
  announce: { on: true, text: 'Cash on delivery all over Egypt', style: 'solid' },
  density: 'regular', texture: 'none', decor: 'none', width: 'normal', grid: { d: 4, m: 2 }, motion: true
};
var SK_THEMES = {
  atelier: {
    name: 'Atelier', tag: 'Editorial, warm, unhurried', lang: 'en',
    s: { colors: SK_PALETTES[0].c, font: { heading: 'Instrument Serif', body: 'Geist', headingAr: 'El Messiri', bodyAr: 'Cairo', weight: 400, upper: false, track: -0.02, scale: 1.05 },
         radius: 18, button: 'pill', card: { ratio: '3/4', style: 'plain', hover: 'swap', align: 'left' },
         header: { layout: 'center', style: 'glass', sticky: true, logoText: '', logoMedia: null, logoScale: 1 },
         announce: { on: true, text: 'Cash on delivery all over Egypt · Free exchange within 14 days', style: 'solid' },
         density: 'airy', texture: 'paper', decor: 'none', width: 'normal', grid: { d: 4, m: 2 }, motion: true },
    sections: [
      { type: 'hero', layout: 'split', eyebrow: 'New collection', title: 'Made slowly. *Worn often.*', text: 'Heavyweight cotton, cut in Cairo, designed to last longer than a season.', cta: 'Shop the collection', ctaHref: 'shop', image: null, height: 'tall' },
      { type: 'usp', style: 'row', items: [{ icon: 'cash', title: 'Cash on delivery', text: 'Pay when it arrives' }, { icon: 'truck', title: 'Delivery in 2–4 days', text: 'All 27 governorates' }, { icon: 'return', title: '14-day exchange', text: 'Wrong size? We swap it' }] },
      { type: 'products', title: 'The edit', subtitle: 'Pieces we keep reaching for.', source: 'featured', limit: 8, layout: 'editorial' },
      { type: 'imageText', title: 'Designed in 3D, *made by hand.*', text: 'Every piece starts as a sketch on a 3D model, then goes to a small workshop where it is cut, printed and sewn.', image: null, side: 'right', cta: 'Our story', ctaHref: 'page:about' },
      { type: 'testimonials', title: 'Worn and loved', items: [{ quote: 'The fabric is heavier than anything I have bought online. Fits exactly like the size guide said.', name: 'Nour', meta: 'Cairo' }, { quote: 'Ordered at night, it was at my door two days later. Paid cash, no stress.', name: 'Youssef', meta: 'Alexandria' }, { quote: 'My go-to gift shop now.', name: 'Mariam', meta: 'Giza' }] },
      { type: 'faq', title: 'Good to know', items: [{ q: 'How long does delivery take?', a: '2 to 4 working days in Cairo and Giza, up to 6 elsewhere.' }, { q: 'Can I pay by cash?', a: 'Yes — every order is cash on delivery.' }, { q: 'What if the size is wrong?', a: 'Message us within 14 days and we exchange it.' }] }
    ]
  },
  concrete: {
    name: 'Concrete', tag: 'Streetwear, loud, unapologetic', lang: 'en',
    s: { colors: SK_PALETTES[2].c, font: { heading: 'Anton', body: 'Space Grotesk', headingAr: 'Lalezar', bodyAr: 'Cairo', weight: 400, upper: true, track: 0.005, scale: 1.25 },
         radius: 0, button: 'brutal', card: { ratio: '4/5', style: 'brutal', hover: 'swap', align: 'left' },
         header: { layout: 'left', style: 'solid', sticky: true, logoText: '', logoMedia: null, logoScale: 1.1 },
         announce: { on: true, text: 'NEW DROP LIVE · CASH ON DELIVERY · FREE SHIPPING OVER 1500 EGP', style: 'marquee' },
         density: 'compact', texture: 'grid', decor: 'none', width: 'wide', grid: { d: 4, m: 2 }, motion: true },
    sections: [
      { type: 'hero', layout: 'poster', eyebrow: 'DROP 07', title: 'NO SECOND *TAKES.*', text: 'Limited run. When it is gone, it is gone.', cta: 'SHOP THE DROP', ctaHref: 'shop', image: null, height: 'screen' },
      { type: 'marquee', text: 'LIMITED RUN — HEAVYWEIGHT 280GSM — PRINTED IN CAIRO — ', style: 'accent' },
      { type: 'products', title: 'LATEST', subtitle: '', source: 'newest', limit: 8, layout: 'grid' },
      { type: 'drop', title: 'NEXT DROP', text: 'Set a reminder. It sells out in hours.', endsAt: '' },
      { type: 'categories', title: 'SHOP BY', style: 'big-type' },
      { type: 'gallery', title: 'ON THE STREET', images: [], style: 'strip' }
    ]
  },
  bloom: {
    name: 'Bloom', tag: 'Playful, soft, full of colour', lang: 'en',
    s: { colors: SK_PALETTES[4].c, font: { heading: 'Bricolage Grotesque', body: 'DM Sans', headingAr: 'Marhey', bodyAr: 'Tajawal', weight: 800, upper: false, track: -0.035, scale: 1.05 },
         radius: 28, button: 'pill', card: { ratio: '1/1', style: 'raised', hover: 'lift', align: 'center' },
         header: { layout: 'center', style: 'boxed', sticky: true, logoText: '', logoMedia: null, logoScale: 1 },
         announce: { on: true, text: '✿ Free gift wrap on every order ✿ Cash on delivery ✿', style: 'marquee' },
         density: 'regular', texture: 'dots', decor: 'stickers', width: 'normal', grid: { d: 3, m: 2 }, motion: true },
    sections: [
      { type: 'hero', layout: 'collage', eyebrow: 'Hello, sunshine', title: 'Tees that make *you smile.*', text: 'Soft cotton, happy prints, made for every mood.', cta: 'Pick your favourite', ctaHref: 'shop', image: null, height: 'medium' },
      { type: 'marquee', text: 'soft cotton ✿ happy prints ✿ made in egypt ✿ ', style: 'soft' },
      { type: 'products', title: 'Fresh picks', subtitle: 'New this week.', source: 'newest', limit: 6, layout: 'grid' },
      { type: 'usp', style: 'cards', items: [{ icon: 'heart', title: 'Made with love', text: 'Small batches, big care' }, { icon: 'cash', title: 'Pay on delivery', text: 'Cash when it arrives' }, { icon: 'sparkle', title: 'Gift ready', text: 'Wrapped for free' }] },
      { type: 'testimonials', title: 'Happy people', items: [{ quote: 'Obsessed with the colours!!', name: 'Salma', meta: '★★★★★' }, { quote: 'Bought one, came back for three.', name: 'Omar', meta: '★★★★★' }] },
      { type: 'whatsapp', title: 'Questions? Say hi.', text: 'We answer on WhatsApp in minutes.', button: 'Chat with us' }
    ]
  },
  noir: {
    name: 'Noir', tag: 'Dark, quiet luxury', lang: 'en',
    s: { colors: SK_PALETTES[7].c, font: { heading: 'Cormorant Garamond', body: 'Manrope', headingAr: 'Amiri', bodyAr: 'Tajawal', weight: 500, upper: false, track: -0.01, scale: 1.12 },
         radius: 2, button: 'outline', card: { ratio: '4/5', style: 'plain', hover: 'zoom', align: 'center' },
         header: { layout: 'center', style: 'transparent', sticky: true, logoText: '', logoMedia: null, logoScale: 1.1 },
         announce: { on: true, text: 'Complimentary delivery on orders over 2000 EGP', style: 'solid' },
         density: 'airy', texture: 'grain', decor: 'none', width: 'normal', grid: { d: 3, m: 2 }, motion: true },
    sections: [
      { type: 'hero', layout: 'full', eyebrow: 'Autumn / Winter', title: 'The art of *less.*', text: 'A capsule of essentials, cut to be kept.', cta: 'Discover', ctaHref: 'shop', image: null, height: 'screen' },
      { type: 'story', eyebrow: 'Maison', title: 'Every stitch is a decision.', text: 'We make fewer pieces, in better cloth, in a single workshop in Cairo. Nothing is rushed.', align: 'center' },
      { type: 'products', title: 'The collection', subtitle: '', source: 'featured', limit: 6, layout: 'editorial' },
      { type: 'gallery', title: 'Lookbook', images: [], style: 'masonry' },
      { type: 'faq', title: 'Client care', items: [{ q: 'Delivery', a: 'Hand-delivered within 3 working days. Cash on delivery.' }, { q: 'Exchanges', a: 'Within 14 days, in original condition.' }] }
    ]
  },
  souk: {
    name: 'Souk', tag: 'عربي أولًا — دافئ ومحلي', lang: 'ar',
    s: { colors: SK_PALETTES[9].c, font: { heading: 'Fraunces', body: 'DM Sans', headingAr: 'Reem Kufi', bodyAr: 'Cairo', weight: 700, upper: false, track: 0, scale: 1.05 },
         radius: 12, button: 'rounded', card: { ratio: '3/4', style: 'framed', hover: 'swap', align: 'right' },
         header: { layout: 'left', style: 'solid', sticky: true, logoText: '', logoMedia: null, logoScale: 1 },
         announce: { on: true, text: 'الدفع عند الاستلام في كل محافظات مصر · استبدال خلال ١٤ يوم', style: 'solid' },
         density: 'regular', texture: 'none', decor: 'arabesque', width: 'normal', grid: { d: 4, m: 2 }, motion: true },
    sections: [
      { type: 'hero', layout: 'split', eyebrow: 'كوليكشن جديد', title: 'لبس مصري *بروح النهارده.*', text: 'قطن تقيل، طباعة محلية، ومقاسات مظبوطة على الجسم.', cta: 'تسوّق دلوقتي', ctaHref: 'shop', image: null, height: 'tall' },
      { type: 'usp', style: 'row', items: [{ icon: 'cash', title: 'الدفع عند الاستلام', text: 'ادفع لما الطلب يوصلك' }, { icon: 'truck', title: 'توصيل لكل مصر', text: 'من ٢ لـ ٥ أيام' }, { icon: 'return', title: 'استبدال سهل', text: 'خلال ١٤ يوم' }] },
      { type: 'products', title: 'الأكثر طلبًا', subtitle: '', source: 'featured', limit: 8, layout: 'grid' },
      { type: 'categories', title: 'تسوّق حسب القسم', style: 'tiles' },
      { type: 'testimonials', title: 'قالوا عننا', items: [{ quote: 'القماشة تحفة والمقاس مظبوط.', name: 'منة', meta: 'القاهرة' }, { quote: 'الطلب وصل في يومين ودفعت كاش.', name: 'كريم', meta: 'المنصورة' }] },
      { type: 'whatsapp', title: 'محتاج تسأل؟', text: 'كلّمنا على واتساب وهنرد عليك بسرعة.', button: 'كلّمنا على واتساب' }
    ]
  },
  gallery: {
    name: 'Gallery', tag: 'Swiss minimal, product first', lang: 'en',
    s: { colors: SK_PALETTES[11].c, font: { heading: 'Geist', body: 'Geist', headingAr: 'IBM Plex Sans Arabic', bodyAr: 'IBM Plex Sans Arabic', weight: 600, upper: false, track: -0.045, scale: 1.1 },
         radius: 0, button: 'square', card: { ratio: '1/1', style: 'plain', hover: 'swap', align: 'left' },
         header: { layout: 'left', style: 'solid', sticky: true, logoText: '', logoMedia: null, logoScale: 1 },
         announce: { on: false, text: 'Free delivery over 1500 EGP', style: 'solid' },
         density: 'compact', texture: 'none', decor: 'none', width: 'full', grid: { d: 4, m: 2 }, motion: false },
    sections: [
      { type: 'hero', layout: 'center', eyebrow: 'Index — 2026', title: 'Objects for *everyday.*', text: '', cta: 'View all', ctaHref: 'shop', image: null, height: 'medium' },
      { type: 'products', title: 'All products', subtitle: '', source: 'all', limit: 12, layout: 'grid' },
      { type: 'imageText', title: 'Specifications matter.', text: '280 GSM combed cotton. Pre-shrunk. Garment dyed. Printed with water-based inks.', image: null, side: 'left', cta: '', ctaHref: '' },
      { type: 'story', eyebrow: 'About', title: 'A small studio making a few things well.', text: '', align: 'left' }
    ]
  }
};
var SK_THEME_ORDER = ['atelier', 'concrete', 'bloom', 'noir', 'souk', 'gallery'];

/* section types the editor can add, with their starting settings */
var SK_SECTION_TYPES = {
  hero: { label: 'Hero', d: { layout: 'split', eyebrow: 'New in', title: 'Your headline *goes here.*', text: 'A line about what makes your pieces special.', cta: 'Shop now', ctaHref: 'shop', image: null, height: 'tall' } },
  marquee: { label: 'Moving text', d: { text: 'NEW DROP — CASH ON DELIVERY — ', style: 'accent' } },
  products: { label: 'Products', d: { title: 'Featured', subtitle: '', source: 'featured', limit: 8, layout: 'grid' } },
  categories: { label: 'Categories', d: { title: 'Shop by category', style: 'tiles' } },
  imageText: { label: 'Image with text', d: { title: 'Tell your story', text: 'What you make, how and why.', image: null, side: 'right', cta: '', ctaHref: '' } },
  usp: { label: 'Selling points', d: { style: 'row', items: [{ icon: 'cash', title: 'Cash on delivery', text: 'Pay when it arrives' }, { icon: 'truck', title: 'Fast delivery', text: 'All over Egypt' }, { icon: 'return', title: 'Easy exchange', text: 'Within 14 days' }] } },
  testimonials: { label: 'Reviews', d: { title: 'What customers say', items: [{ quote: 'Love it.', name: 'A happy customer', meta: '' }] } },
  story: { label: 'Text', d: { eyebrow: '', title: 'A few words', text: 'Write anything here.', align: 'center' } },
  gallery: { label: 'Lookbook', d: { title: 'Lookbook', images: [], style: 'masonry' } },
  faq: { label: 'Questions', d: { title: 'Questions', items: [{ q: 'Do you deliver everywhere?', a: 'Yes, to all 27 governorates.' }] } },
  banner: { label: 'Promo banner', d: { title: '20% off this week', text: 'Use the code at checkout.', code: 'WELCOME20', cta: 'Shop now', ctaHref: 'shop' } },
  drop: { label: 'Drop countdown', d: { title: 'Next drop', text: 'Be first in line.', endsAt: '' } },
  whatsapp: { label: 'WhatsApp', d: { title: 'Questions?', text: 'Message us on WhatsApp.', button: 'Chat with us' } }
};
var SK_ICONS = ['cash', 'truck', 'return', 'heart', 'sparkle', 'shield', 'leaf', 'clock', 'star', 'gift', 'ruler', 'phone'];

/* a store's theme from a theme id, keeping nothing of the old one */
function skNewTheme(id){
  var t = SK_THEMES[id] || SK_THEMES.atelier;
  return { id: SK_THEMES[id] ? id : 'atelier', s: skDeep(t.s), sections: skDeep(t.sections).map(function(x, i){
    x.id = 's' + (i + 1) + Math.random().toString(36).slice(2, 6); x.on = true;
    /* a countdown needs a date: start a new store's drop a week out */
    if(x.type === 'drop' && !x.endsAt){ var d = new Date(Date.now() + 7 * 864e5); d.setMinutes(0, 0, 0); x.endsAt = d.toISOString().slice(0, 16); }
    return x;
  }) };
}
/* fill anything missing from a stored theme (older saves, partial edits) */
function skNormTheme(th){
  th = th && typeof th === 'object' ? th : skNewTheme('atelier');
  var base = (SK_THEMES[th.id] || SK_THEMES.atelier).s;
  function fill(dst, src){ Object.keys(src).forEach(function(k){
    if(dst[k] === undefined || dst[k] === null && src[k] !== null) dst[k] = skDeep(src[k]);
    else if(src[k] && typeof src[k] === 'object' && !Array.isArray(src[k]) && dst[k] && typeof dst[k] === 'object') fill(dst[k], src[k]);
  }); }
  if(!SK_THEMES[th.id]) th.id = 'atelier';
  th.s = th.s && typeof th.s === 'object' ? th.s : {}; fill(th.s, base); fill(th.s, SK_BASE_S);
  skCleanSettings(th.s, base);
  th.sections = Array.isArray(th.sections) ? th.sections.filter(function(x){ return x && SK_SECTION_TYPES[x.type]; }) : [];
  th.sections.forEach(function(x, i){ if(!x.id) x.id = 's' + i + Math.random().toString(36).slice(2, 6); if(x.on === undefined) x.on = true; });
  return th;
}
/* settings land inside CSS, so every value is checked against what the editor can produce */
var SK_COLOR_RE = /^(#[0-9a-f]{3,8}|rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(,\s*[\d.]+\s*)?\))$/i;
var SK_CHOICES = { button: ['pill', 'rounded', 'square', 'brutal', 'outline', 'underline'], ratio: ['3/4', '4/5', '1/1', '2/3', '16/9'], cardStyle: ['plain', 'framed', 'raised', 'brutal', 'polaroid'],
  hover: ['swap', 'zoom', 'lift', 'none'], align: ['left', 'center', 'right'], hlayout: ['left', 'center', 'stack'], hstyle: ['solid', 'glass', 'transparent', 'boxed'],
  texture: ['none', 'paper', 'grain', 'grid', 'dots'], decor: ['none', 'stickers', 'arabesque'], density: ['airy', 'regular', 'compact'], width: ['normal', 'wide', 'full'], announce: ['solid', 'marquee'] };
function skNum(v, lo, hi, d){ v = +v; return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; }
function skOne(v, list, d){ return list.indexOf(v) >= 0 ? v : d; }
function skCleanSettings(S, base){
  var C = SK_CHOICES, bc = base.colors || SK_BASE_S.colors, colors = {};
  Object.keys(bc).forEach(function(k){ var v = String(S.colors && S.colors[k] || '').trim(); colors[k] = SK_COLOR_RE.test(v) ? v : bc[k]; });
  S.colors = colors;
  ['heading', 'body', 'headingAr', 'bodyAr'].forEach(function(k){ if(SK_FONT_W[S.font[k]] === undefined) S.font[k] = base.font[k] || SK_BASE_S.font[k]; });
  S.font.weight = Math.round(skNum(S.font.weight, 100, 900, 400) / 100) * 100;
  S.font.upper = !!S.font.upper; S.font.track = skNum(S.font.track, -0.1, 0.3, 0); S.font.scale = skNum(S.font.scale, 0.7, 1.6, 1);
  S.radius = Math.round(skNum(S.radius, 0, 40, 16));
  S.button = skOne(S.button, C.button, 'pill');
  S.card.ratio = skOne(S.card.ratio, C.ratio, '3/4'); S.card.style = skOne(S.card.style, C.cardStyle, 'plain');
  S.card.hover = skOne(S.card.hover, C.hover, 'swap'); S.card.align = skOne(S.card.align, C.align, 'left');
  S.header.layout = skOne(S.header.layout, C.hlayout, 'center'); S.header.style = skOne(S.header.style, C.hstyle, 'solid');
  S.header.logoScale = skNum(S.header.logoScale, 0.5, 2.5, 1); S.header.sticky = S.header.sticky !== false;
  S.header.logoText = String(S.header.logoText || '').slice(0, 40);
  S.announce.on = !!S.announce.on; S.announce.text = String(S.announce.text || '').slice(0, 200); S.announce.style = skOne(S.announce.style, C.announce, 'solid');
  S.texture = skOne(S.texture, C.texture, 'none'); S.decor = skOne(S.decor, C.decor, 'none');
  S.density = skOne(S.density, C.density, 'regular'); S.width = skOne(S.width, C.width, 'normal');
  S.grid = { d: Math.round(skNum(S.grid && S.grid.d, 2, 6, 4)), m: Math.round(skNum(S.grid && S.grid.m, 1, 2, 2)) };
  S.motion = S.motion !== false;
  return S;
}
/* Remix: a new combination that still feels like the theme */
var SK_REMIX = {
  atelier: { palettes: ['linen', 'espresso', 'olive', 'sand', 'lavender', 'nile'], heads: ['Instrument Serif', 'Fraunces', 'DM Serif Display', 'Playfair Display', 'Bodoni Moda', 'Italiana'], bodies: ['Geist', 'Manrope', 'Work Sans', 'DM Sans', 'Karla'], buttons: ['pill', 'rounded', 'outline', 'underline'], cards: ['plain', 'framed', 'polaroid'] },
  concrete: { palettes: ['concrete', 'acid', 'cobalt', 'butter', 'paper'], heads: ['Anton', 'Bebas Neue', 'Archivo Black', 'Big Shoulders Display', 'Unbounded'], bodies: ['Space Grotesk', 'Archivo', 'Inter', 'Geist Mono', 'IBM Plex Sans'], buttons: ['brutal', 'square'], cards: ['brutal', 'plain', 'framed'] },
  bloom: { palettes: ['peach', 'mint', 'bubblegum', 'butter', 'lavender'], heads: ['Bricolage Grotesque', 'Unbounded', 'Righteous', 'Syne', 'Caveat'], bodies: ['DM Sans', 'Nunito', 'Outfit', 'Karla'], buttons: ['pill', 'brutal', 'rounded'], cards: ['raised', 'polaroid', 'brutal'] },
  noir: { palettes: ['noir', 'oxblood', 'acid', 'espresso'], heads: ['Cormorant Garamond', 'Bodoni Moda', 'Italiana', 'Playfair Display', 'Instrument Serif'], bodies: ['Manrope', 'Inter', 'Work Sans', 'Geist'], buttons: ['outline', 'underline', 'square'], cards: ['plain', 'framed'] },
  souk: { palettes: ['sand', 'nile', 'linen', 'olive', 'espresso'], heads: ['Fraunces', 'DM Serif Display', 'Playfair Display'], bodies: ['DM Sans', 'Manrope'], buttons: ['rounded', 'pill', 'square'], cards: ['framed', 'plain', 'raised'], headsAr: ['Reem Kufi', 'El Messiri', 'Lalezar', 'Rakkas', 'Aref Ruqaa', 'Marhey', 'Changa'], bodiesAr: ['Cairo', 'Tajawal', 'Almarai', 'IBM Plex Sans Arabic', 'Readex Pro'] },
  gallery: { palettes: ['paper', 'concrete', 'cobalt', 'lavender', 'linen'], heads: ['Geist', 'Space Grotesk', 'Syne', 'Inter', 'Unbounded'], bodies: ['Geist', 'Inter', 'IBM Plex Sans', 'Geist Mono'], buttons: ['square', 'underline', 'outline'], cards: ['plain', 'framed'] }
};
function skPick(a){ return a[Math.floor(Math.random() * a.length)]; }
function skRemix(th){
  th = skNormTheme(skDeep(th));
  var r = SK_REMIX[th.id] || SK_REMIX.atelier, pal = SK_PALETTES.filter(function(p){ return r.palettes.indexOf(p.id) >= 0; });
  var cur = JSON.stringify(th.s.colors), next = skPick(pal);
  for(var i = 0; i < 4 && JSON.stringify(next.c) === cur; i++) next = skPick(pal);
  th.s.colors = skDeep(next.c);
  th.s.font.heading = skPick(r.heads); th.s.font.body = skPick(r.bodies);
  if(r.headsAr){ th.s.font.headingAr = skPick(r.headsAr); th.s.font.bodyAr = skPick(r.bodiesAr); }
  th.s.button = skPick(r.buttons); th.s.card.style = skPick(r.cards);
  th.s.card.ratio = skPick(['3/4', '4/5', '1/1', '2/3']);
  th.s.radius = th.s.button === 'brutal' || th.s.button === 'square' ? skPick([0, 0, 4]) : skPick([8, 14, 18, 24, 28]);
  return th;
}
/* readable text on a colour */
function skInk(hex){
  var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim()); if(!m) return '#111111';
  var n = parseInt(m[1], 16), r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#111111' : '#FFFFFF';
}
