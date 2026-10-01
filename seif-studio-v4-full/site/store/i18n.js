/* ============================================================
   STOREFRONT WORDS — English and Arabic, Egypt's governorates, colour names.
   Plain data; shared by the server renderer, the dashboard preview and the
   storefront runtime.
   ============================================================ */
var SK_I18N = {
  en: {
    dir: 'ltr', shop: 'Shop', all: 'All', home: 'Home', about: 'About', contact: 'Contact', search: 'Search', cart: 'Cart', bag: 'Bag',
    addToCart: 'Add to bag', buyNow: 'Buy now', soldOut: 'Sold out', onlyLeft: 'Only {n} left', inStock: 'In stock',
    sale: 'Sale', new: 'New', from: 'From', size: 'Size', color: 'Colour', quantity: 'Quantity', sizeGuide: 'Size guide',
    description: 'Details', delivery: 'Delivery & returns', youMayLike: 'You may also like', viewAll: 'View all', shopNow: 'Shop now',
    emptyCart: 'Your bag is empty.', keepShopping: 'Keep shopping', subtotal: 'Subtotal', shipping: 'Shipping', discount: 'Discount',
    codFee: 'Cash on delivery fee', total: 'Total', checkout: 'Checkout', placeOrder: 'Place order', remove: 'Remove',
    contactInfo: 'Contact', fullName: 'Full name', phone: 'Mobile number', email: 'Email', optional: 'optional',
    deliveryAddress: 'Delivery address', governorate: 'Governorate', city: 'City / area', address: 'Street, building, floor, apartment',
    landmark: 'Landmark', notes: 'Notes for the order', discountCode: 'Discount code', apply: 'Apply', applied: 'Applied',
    payment: 'Payment', cod: 'Cash on delivery', codNote: 'Pay in cash when your order arrives.', free: 'Free',
    chooseGov: 'Choose your governorate', calcAtCheckout: 'Calculated at checkout', orderSummary: 'Order summary',
    thanks: 'Thank you, {name}.', orderPlaced: 'Your order is placed.', orderNumber: 'Order', weWillCall: 'We will call or message you on {phone} to confirm, then it ships. Pay in cash on delivery.',
    trackOrder: 'Track your order', trackHint: 'Enter your order number and the mobile number you ordered with.', track: 'Track',
    status: { new: 'Received', confirmed: 'Confirmed', shipped: 'On its way', delivered: 'Delivered', cancelled: 'Cancelled' },
    messageUs: 'Message us on WhatsApp', notFound: 'This page does not exist.', backHome: 'Back to the shop',
    closedTitle: 'Opening soon.', closedText: 'This store is getting ready. Come back shortly.', previewBar: 'Preview — only you can see this store until it goes live.',
    policies: 'Policies', returns: 'Returns', privacy: 'Privacy', terms: 'Terms', poweredBy: 'Made with Design by Seif',
    sortNewest: 'Newest', sortLow: 'Price: low to high', sortHigh: 'Price: high to low', results: '{n} products', noResults: 'Nothing here yet.',
    required: 'Required', badPhone: 'Enter an Egyptian mobile number (01xxxxxxxxx).', placing: 'Placing your order…',
    dropIn: 'Drops in', dropOut: 'Out now', days: 'd', hours: 'h', mins: 'm', secs: 's', chooseOption: 'Choose a {o}',
    added: 'Added to your bag', qtyMax: 'Only {n} available', perItem: 'each', items: '{n} items', item: '1 item',
    freeLeft: 'Add {x} more for free delivery', freeOk: 'Free delivery unlocked', copied: 'Copied', previewOff: 'This is a preview — checkout works on the live store.',
    stockChanged: 'Some items just sold out, so we updated your bag.', noDelivery: 'Delivery to this governorate is not available yet.', orderFailed: 'We could not place the order. Please try again.',
    trackNone: 'No order found with these details.', badCode: 'This code is not valid.', minOrder: 'This code needs an order of {x} or more.', freeShipCode: 'Free delivery', placed: 'Placed {d}',
    shippingTo: 'Delivery to {g}', chooseGovFirst: 'Choose your governorate to see delivery.', tooMany: 'Too many attempts. Wait a minute and try again.', closedOrders: 'This store is not taking orders right now.'
  },
  ar: {
    dir: 'rtl', shop: 'المتجر', all: 'الكل', home: 'الرئيسية', about: 'من نحن', contact: 'تواصل معنا', search: 'بحث', cart: 'السلة', bag: 'السلة',
    addToCart: 'أضف إلى السلة', buyNow: 'اشترِ الآن', soldOut: 'نفدت الكمية', onlyLeft: 'باقي {n} فقط', inStock: 'متوفر',
    sale: 'خصم', new: 'جديد', from: 'من', size: 'المقاس', color: 'اللون', quantity: 'الكمية', sizeGuide: 'دليل المقاسات',
    description: 'التفاصيل', delivery: 'التوصيل والاسترجاع', youMayLike: 'قد يعجبك أيضًا', viewAll: 'عرض الكل', shopNow: 'تسوّق الآن',
    emptyCart: 'سلتك فاضية.', keepShopping: 'كمّل تسوّق', subtotal: 'المجموع الفرعي', shipping: 'الشحن', discount: 'الخصم',
    codFee: 'رسوم الدفع عند الاستلام', total: 'الإجمالي', checkout: 'إتمام الطلب', placeOrder: 'تأكيد الطلب', remove: 'حذف',
    contactInfo: 'بيانات التواصل', fullName: 'الاسم بالكامل', phone: 'رقم الموبايل', email: 'البريد الإلكتروني', optional: 'اختياري',
    deliveryAddress: 'عنوان التوصيل', governorate: 'المحافظة', city: 'المدينة / المنطقة', address: 'الشارع، العمارة، الدور، الشقة',
    landmark: 'علامة مميزة', notes: 'ملاحظات على الطلب', discountCode: 'كود الخصم', apply: 'تطبيق', applied: 'تم التطبيق',
    payment: 'الدفع', cod: 'الدفع عند الاستلام', codNote: 'ادفع كاش لما الطلب يوصلك.', free: 'مجاني',
    chooseGov: 'اختر المحافظة', calcAtCheckout: 'يُحسب عند إتمام الطلب', orderSummary: 'ملخص الطلب',
    thanks: 'شكرًا يا {name}.', orderPlaced: 'تم استلام طلبك.', orderNumber: 'طلب رقم', weWillCall: 'هنكلمك أو نبعتلك على {phone} عشان نأكد الطلب وبعدها يتشحن. الدفع كاش عند الاستلام.',
    trackOrder: 'تتبّع طلبك', trackHint: 'اكتب رقم الطلب ورقم الموبايل اللي طلبت بيه.', track: 'تتبّع',
    status: { new: 'تم الاستلام', confirmed: 'تم التأكيد', shipped: 'في الطريق', delivered: 'تم التوصيل', cancelled: 'ملغي' },
    messageUs: 'كلّمنا على واتساب', notFound: 'الصفحة دي مش موجودة.', backHome: 'ارجع للمتجر',
    closedTitle: 'قريبًا.', closedText: 'المتجر بيتجهّز. ارجع بعد شوية.', previewBar: 'معاينة — محدش يقدر يشوف المتجر غيرك لحد ما يتنشر.',
    policies: 'السياسات', returns: 'الاسترجاع', privacy: 'الخصوصية', terms: 'الشروط', poweredBy: 'صُنع بـ Design by Seif',
    sortNewest: 'الأحدث', sortLow: 'السعر: من الأقل', sortHigh: 'السعر: من الأعلى', results: '{n} منتج', noResults: 'مفيش منتجات هنا لسه.',
    required: 'مطلوب', badPhone: 'اكتب رقم موبايل مصري (01xxxxxxxxx).', placing: 'بنأكد طلبك…',
    dropIn: 'ينزل خلال', dropOut: 'متاح الآن', days: 'ي', hours: 'س', mins: 'د', secs: 'ث', chooseOption: 'اختر {o}',
    added: 'اتضاف للسلة', qtyMax: 'متاح {n} بس', perItem: 'للقطعة', items: '{n} قطع', item: 'قطعة واحدة',
    freeLeft: 'زوّد {x} والتوصيل يبقى مجاني', freeOk: 'التوصيل بقى مجاني', copied: 'اتنسخ', previewOff: 'دي معاينة — إتمام الطلب بيشتغل على المتجر المنشور.',
    stockChanged: 'في منتجات خلصت دلوقتي، فحدّثنا سلتك.', noDelivery: 'التوصيل للمحافظة دي مش متاح لسه.', orderFailed: 'معرفناش نأكد الطلب. جرّب تاني.',
    trackNone: 'مفيش طلب بالبيانات دي.', badCode: 'الكود ده مش صالح.', minOrder: 'الكود ده محتاج طلب بـ {x} أو أكتر.', freeShipCode: 'توصيل مجاني', placed: 'اتطلب {d}',
    shippingTo: 'التوصيل لـ {g}', chooseGovFirst: 'اختار المحافظة عشان تعرف سعر التوصيل.', tooMany: 'محاولات كتير. استنى دقيقة وجرّب تاني.', closedOrders: 'المتجر مش بياخد طلبات دلوقتي.'
  }
};
/* Egypt's 27 governorates, English and Arabic */
var SK_GOVS = [
  ['Cairo', 'القاهرة'], ['Giza', 'الجيزة'], ['Alexandria', 'الإسكندرية'], ['Qalyubia', 'القليوبية'], ['Sharqia', 'الشرقية'],
  ['Dakahlia', 'الدقهلية'], ['Gharbia', 'الغربية'], ['Monufia', 'المنوفية'], ['Beheira', 'البحيرة'], ['Kafr El Sheikh', 'كفر الشيخ'],
  ['Damietta', 'دمياط'], ['Port Said', 'بورسعيد'], ['Ismailia', 'الإسماعيلية'], ['Suez', 'السويس'], ['North Sinai', 'شمال سيناء'],
  ['South Sinai', 'جنوب سيناء'], ['Red Sea', 'البحر الأحمر'], ['Faiyum', 'الفيوم'], ['Beni Suef', 'بني سويف'], ['Minya', 'المنيا'],
  ['Asyut', 'أسيوط'], ['Sohag', 'سوهاج'], ['Qena', 'قنا'], ['Luxor', 'الأقصر'], ['Aswan', 'أسوان'], ['New Valley', 'الوادي الجديد'], ['Matrouh', 'مطروح']
];
/* apparel colour names -> swatch colours (English, Arabic and the studio's dye names) */
var SK_COLORS = {
  black: '#141414', white: '#FAFAF7', 'off-white': '#F1ECE1', offwhite: '#F1ECE1', ivory: '#F3EEDF', cream: '#EFE6D2', beige: '#DCCBAE', sand: '#D9C7A3',
  stone: '#B7B4AC', heather: '#B7B4AC', royal: '#2E4FA3', forest: '#274D3D', butter: '#EFDF9C', grey: '#8E8E8E', gray: '#8E8E8E', 'heather grey': '#B2B2B0', charcoal: '#3A3A3C', graphite: '#3A3A3C', navy: '#1D2A44', 'midnight navy': '#1D2A44',
  blue: '#2E4FA3', 'royal blue': '#2E4FA3', 'cobalt': '#2E4FA3', sky: '#A9C6EA', 'sky blue': '#A9C6EA', 'baby blue': '#A9C6EA', teal: '#1F6F6B',
  green: '#274D3D', 'forest green': '#274D3D', olive: '#6B6B45', 'olive drab': '#6B6B45', sage: '#A3B18A', khaki: '#BFAE7E', mint: '#BFE3CF',
  brown: '#6A4A33', chocolate: '#4A3326', camel: '#C19A6B', tan: '#D2B48C', burgundy: '#6E2A35', maroon: '#6E2A35', wine: '#6E2A35',
  red: '#C3423F', 'tomato red': '#C3423F', coral: '#F08A6C', pink: '#E8AFC2', 'dusty pink': '#E8AFC2', rose: '#D9A0A6', lilac: '#B7A6D9', lavender: '#B7A6D9',
  purple: '#6E4C9E', yellow: '#EFDF9C', 'butter yellow': '#EFDF9C', mustard: '#D4A23A', orange: '#E07A3F', 'burnt orange': '#E07A3F', rust: '#B5522E',
  'أسود': '#141414', 'أبيض': '#FAFAF7', 'اوف وايت': '#F1ECE1', 'أوف وايت': '#F1ECE1', 'كريمي': '#EFE6D2', 'بيج': '#DCCBAE', 'رملي': '#D9C7A3',
  'رمادي': '#8E8E8E', 'فحمي': '#3A3A3C', 'كحلي': '#1D2A44', 'أزرق': '#2E4FA3', 'لبني': '#A9C6EA', 'أخضر': '#274D3D', 'زيتي': '#6B6B45',
  'بني': '#6A4A33', 'نبيتي': '#6E2A35', 'عنابي': '#6E2A35', 'أحمر': '#C3423F', 'بينك': '#E8AFC2', 'وردي': '#E8AFC2', 'بنفسجي': '#6E4C9E',
  'موف': '#B7A6D9', 'أصفر': '#EFDF9C', 'مستردة': '#D4A23A', 'برتقالي': '#E07A3F', 'كافيه': '#6A4A33', 'هافان': '#C19A6B'
};
function skColor(name){
  if(!name) return null;
  var s = String(name).trim();
  if(/^#[0-9a-f]{3,8}$/i.test(s)) return s;
  var hit = SK_COLORS[s.toLowerCase()] || SK_COLORS[s];
  if(hit) return hit;
  var m = /#([0-9a-f]{6})\b/i.exec(s);          /* "Custom #A1B2C3" from the studio */
  return m ? '#' + m[1].toUpperCase() : null;
}
function skT(lang, key, vars){
  var d = SK_I18N[lang] || SK_I18N.en, v = d[key];
  if(v === undefined) v = SK_I18N.en[key];
  if(v === undefined) return key;
  if(vars) Object.keys(vars).forEach(function(k){ v = String(v).split('{' + k + '}').join(vars[k]); });
  return v;
}
