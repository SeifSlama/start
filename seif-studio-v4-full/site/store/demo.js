/* ============================================================
   SAMPLE PRODUCTS — what a store shows in previews before it has its own
   (the landing page's theme gallery, a new store's editor). Every one shows
   the same placeholder — a plain white tee on white (tools/render-placeholder.mjs)
   — so the sample photos read as "your product goes here".
   ============================================================ */
var SK_DEMO = (function(){
  var PH = '/demo/placeholder.jpg';
  var sizes = ['S', 'M', 'L', 'XL'];
  function tee(pid, title, titleAr, price, color, colorAr, cat, catAr, extra){
    var p = { pid: pid, handle: pid, title: title, titleAr: titleAr, price: price, compareAt: 0, category: cat, categoryAr: catAr, status: 'active', featured: true,
              images: [PH], options: [{ name: 'Size', values: sizes }],
              variants: sizes.map(function(s){ return { id: pid + '-' + s, o: [s], price: null, stock: 12 }; }), trackStock: true, stock: null,
              description: 'Heavyweight 240gsm cotton, garment-dyed for a soft, lived-in feel. Printed in Cairo. Relaxed fit — take your usual size.',
              descriptionAr: 'قطن تقيل ٢٤٠ جرام، مصبوغ بعد الخياطة عشان يبقى ناعم من أول لبسة. مطبوع في القاهرة. قصّة مريحة — خد مقاسك العادي.',
              sizeGuide: 'S — chest 104 cm, length 70 cm\nM — chest 110 cm, length 72 cm\nL — chest 116 cm, length 74 cm\nXL — chest 122 cm, length 76 cm',
              color: color, colorAr: colorAr, createdAt: 0 };
    Object.keys(extra || {}).forEach(function(k){ p[k] = extra[k]; });
    return p;
  }
  var list = [
    tee('cairo-tee', 'Cairo Tee', 'تيشيرت القاهرة', 650, 'Sand', 'رملي', 'Essentials', 'أساسيات', { compareAt: 800 }),
    tee('saif-black', 'Seif Kufi Tee', 'تيشيرت سيف كوفي', 750, 'Black', 'أسود', 'Graphic', 'جرافيك', { isNew: true }),
    tee('nile-club', 'Nile Club Tee', 'تيشيرت نادي النيل', 700, 'Off-white', 'أوف وايت', 'Graphic', 'جرافيك'),
    tee('soft-club', 'Soft Club Tee', 'تيشيرت سوفت كلوب', 600, 'Olive', 'زيتي', 'Essentials', 'أساسيات'),
    tee('seif-bolt', 'Bolt Tee', 'تيشيرت البرق', 720, 'Navy', 'كحلي', 'Graphic', 'جرافيك', { isNew: true }),
    tee('habibi', 'Habibi Tee', 'تيشيرت حبيبي', 650, 'Pink', 'بينك', 'Essentials', 'أساسيات', { compareAt: 750 }),
    tee('sunday', 'Sunday Tee', 'تيشيرت الأحد', 680, 'Butter yellow', 'أصفر', 'Graphic', 'جرافيك'),
    tee('athletic', 'Athletic Dept. Tee', 'تيشيرت أثلتيك', 700, 'Heather grey', 'رمادي', 'Sport', 'سبور'),
    tee('ahwa', 'Ahwa Tee', 'تيشيرت قهوة', 690, 'Chocolate', 'بني', 'Graphic', 'جرافيك'),
    tee('daydream', 'Daydream Tee', 'تيشيرت حلم', 620, 'Sky blue', 'لبني', 'Essentials', 'أساسيات')
  ];
  list.forEach(function(p, i){ p.createdAt = 1760000000000 - i * 86400000; });
  /* products in the store's language */
  function products(lang){
    return list.map(function(p){
      var q = JSON.parse(JSON.stringify(p));
      if(lang === 'ar'){ q.title = p.titleAr; q.category = p.categoryAr; q.description = p.descriptionAr; q.options = [{ name: 'المقاس', values: sizes }]; }
      return q;
    });
  }
  return { products: products, image: PH, wide: '/demo/placeholder-wide.jpg' };
})();
