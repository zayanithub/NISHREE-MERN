import { CARE_FAQS, FABRIC_GUIDE, QUICK_ACTIONS } from './faqDatabase.js';

const copy = (language, values) => values[language] || values.en;

export const normalizeAssistantText = (value) => String(value || '')
  .toLowerCase()
  .normalize('NFKC')
  .replace(/[’']/g, '')
  .replace(/₹/g, ' ')
  .replace(/,/g, '')
  .replace(/[\p{P}\p{S}]/gu, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .replace(/\b(kanjivaram|kanjeevaram|kanchi)\b/g, 'kanchipuram')
  .replace(/\b(sari|sarees)\b/g, 'saree')
  .replace(/\b(venum|venumnu)\b/g, 'want')
  .replace(/\b(iruka|irukaa|irukuma)\b/g, 'available')
  .replace(/\b(evlo|evalo|evvalavu)\b/g, 'price')
  .replace(/\b(kulla|ullaa)\b/g, 'under')
  .replace(/\b(panna mudiyuma|panna mudiyumaa)\b/g, 'can return');
const normalize = normalizeAssistantText;

const RULES = [
  { intent: 'returns', patterns: [/\b(return|return policy|return panna)\b/, /\b(exchange|replace)\b/, /\b(refund|money back)\b/, /\b(cancel|cancellation)\b/, /\b(damaged|defective|broken)\b/, /\b(wrong item|wrong product|incorrect product)\b/, /\b(return window|return period)\b/, /\b(return request|request a return)\b/] },
  { intent: 'shipping', patterns: [/\b(shipping|ship|shipping charges|shipping cost)\b/, /\b(delivery|deliver|delivery days|delivery time|delivery charge)\b/, /\b(dispatch|processing time)\b/, /\b(tracking|track order|track my order)\b/, /\b(address change|change address|update address)\b/, /\b(international|overseas|outside india)\b/, /\b(courier|shipment|PIN code|pincode)\b/, /\b(delayed|delay|late delivery)\b/] },
  { intent: 'orders', patterns: [/\b(order|orders|order help|order assistance)\b/, /\b(checkout|place an order|how to order)\b/, /\b(payment|pay|paid|payment issue|transaction)\b/, /\b(confirmation|order email|confirmation email)\b/, /\b(cod|cash on delivery)\b/, /\b(order status|my order)\b/, /\b(address update|change my address)\b/] },
  { intent: 'contact', patterns: [/\b(contact|contact us|contact team)\b/, /\b(support|customer care|customer service)\b/, /\b(whatsapp|wahtsapp|watsapp)\b/, /\b(email|mail the team)\b/, /\b(call|phone|talk to|speak to)\b/, /\b(help me|need help|team)\b/] },
  { intent: 'offer', patterns: [/\b(offer|offers|current offer)\b/, /\b(discount|discounts|sale)\b/, /\b(coupon|promo|promo code)\b/, /\b(deal|special price)\b/] },
  { intent: 'price', patterns: [/\b(price|price evlo|cost|how much)\b/, /\b(budget|under|below|within)\b/, /\b(starting|starting price|lowest price)\b/, /\b(affordable|cheap|economical)\b/, /\b(rupees|rs|inr|5000|10000|2000)\b/] },
  { intent: 'care', patterns: [/\b(care|care guide|care instructions)\b/, /\b(wash|washing|clean|dry clean)\b/, /\b(store|storage|store silk)\b/, /\b(fold|folding|crease)\b/, /\b(zari|zardosi)\b/, /\b(colour damage|color damage|fade|fading)\b/, /\b(maintain|maintenance)\b/] },
  { intent: 'fabricInfo', patterns: [/\b(what is|difference|compare|texture|feel)\b/, /\b(fabric|material|composition)\b/, /\b(kanchipuram|kanjivaram|kanjeevaram)\b/, /\b(pure silk|soft silk|silk)\b/, /\b(banarasi|banarasi silk)\b/, /\b(georgette|chiffon|organza|cotton)\b/, /\b(silk blend|blend|zari)\b/] },
  { intent: 'bridal', patterns: [/\b(bridal|bride|bridal wear|bridal collection)\b/, /\b(wedding saree|wedding wear|marriage saree)\b/, /\b(kalyanam|muhurtham)\b/] },
  { intent: 'occasion', patterns: [/\b(engagement|reception)\b/, /\b(festival|festive|diwali|pongal)\b/, /\b(pooja|puja|temple)\b/, /\b(office wear|work wear)\b/, /\b(casual wear|everyday wear)\b/, /\b(gift|gifting|present)\b/, /\b(wedding guest|guest wear)\b/] },
  { intent: 'color', patterns: [/\b(red|maroon|wine)\b/, /\b(pink|rose|blush)\b/, /\b(blue|navy|teal)\b/, /\b(green|emerald)\b/, /\b(black|white|ivory)\b/, /\b(golden|yellow|mustard)\b/, /\b(purple|orange)\b/] },
  { intent: 'discovery', patterns: [/\b(show|show me|explore|browse)\b/, /\b(collection|catalog|catalogue|saree collection)\b/, /\b(saree|sarees|available|have|traditional)\b/, /\b(lightweight|light weight|easy to wear)\b/, /\b(want|looking for|find me|do you have)\b/] },
];

const TAMIL_RULES = [
  { intent: 'returns', pattern: /திரும்ப|மாற்றம்|ரிட்டர்ன்|எக்ஸ்சேஞ்ச்|பணம் திரும்ப/ },
  { intent: 'shipping', pattern: /விநியோகம்|டெலிவரி|அனுப்புதல்|அனுப்பு|கூரியர்|நாட்கள்/ },
  { intent: 'orders', pattern: /ஆர்டர்|கட்டணம்|பணம் செலுத்த|பணம்|காசு/ },
  { intent: 'contact', pattern: /தொடர்பு|உதவி|அழைக்க/ },
  { intent: 'offer', pattern: /சலுகை|தள்ளுபடி|கூப்பன்/ },
  { intent: 'price', pattern: /விலை|எவ்வளவு|ரூபாய்|பட்ஜெட்/ },
  { intent: 'care', pattern: /பராமரிப்பு|துவைக்க|சலவை|மடிக்க/ },
  { intent: 'bridal', pattern: /திருமண|மணப்பெண்|கல்யாணம்/ },
  { intent: 'fabricInfo', pattern: /பட்டு|துணி|ஜார்ஜெட்|சிஃபான்|ஆர்கன்சா|பருத்தி/ },
  { intent: 'discovery', pattern: /சேலை|புடவை|கலெக்ஷன்/ },
];

export const RULE_PATTERN_COUNT = RULES.reduce((count, rule) => count + rule.patterns.length, 0);

const baseResponse = (text, extra = {}) => ({ text, ...extra });

const menuResponse = (language) => baseResponse(copy(language, {
  en: 'Namaste! Welcome to Nishree Attire. I’m Nishree Assistant, your personal saree shopping companion. I can help you explore our current collection, understand fabrics and care, or find store information. How may I assist you today?',
  ta: 'வணக்கம்! Nishree Attire-க்கு வரவேற்கிறோம். நான் Nishree Assistant — சேலைத் தேர்வில் உங்களுக்கு உதவுகிறேன். தற்போதைய சேலைகள், துணி வகைகள், பராமரிப்பு மற்றும் கடைத் தகவல்களைப் பற்றி கேளுங்கள். இன்று நான் எவ்வாறு உதவலாம்?',
  tanglish: 'Namaste! Nishree Attire-ku welcome. Naan Nishree Assistant, unga personal saree shopping companion. Current collection, fabrics, care, store details pathi help pannuren. Eppadi help pannattum?',
}), { quickActions: true });

const fabricAnswer = (question, language) => {
  const normalized = normalize(question);
  const entry = FABRIC_GUIDE.find((item) => normalize(item.question).split(' ').some((word) => word.length > 3 && normalized.includes(word)));
  if (!entry) {
    return baseResponse(copy(language, {
      en: 'Fabric feel and care can vary by weave and finish. Open a product page for its confirmed material details, or choose a fabric guide below.',
      ta: 'நெசவு மற்றும் முடிப்பைப் பொறுத்து துணியின் தன்மையும் பராமரிப்பும் மாறலாம். உறுதியான துணி விவரங்களுக்கு தயாரிப்பு பக்கத்தைப் பாருங்கள்.',
      tanglish: 'Weave and finish poruthu fabric feel/care maaralaam. Confirmed details-ku product page paarunga; illa fabric guide select pannunga.',
    }), { faqItems: FABRIC_GUIDE.map((item) => ({ question: item.question, answer: item[language === 'ta' ? 'tamil' : language === 'tanglish' ? 'tanglish' : 'answer'] })) });
  }
  return baseResponse(entry[language === 'ta' ? 'tamil' : language === 'tanglish' ? 'tanglish' : 'answer'], {
    suggestions: ['Show silk sarees', 'Saree care', 'Explore sarees'],
    faqItems: language === 'en' ? [entry, ...CARE_FAQS.slice(0, 2)] : undefined,
  });
};

const getBudget = (value) => {
  const match = value.match(/(?:under|below|within|budget)\s*(?:rs\s*)?(\d+(?:\.\d+)?)\s*(k)?/);
  if (!match) return null;
  const amount = Number(match[1]) * (match[2] ? 1000 : 1);
  return Number.isFinite(amount) ? amount : null;
};

const intentResponse = (intent, question, language, context = {}) => {
  if (intent === 'menu') return menuResponse(language);
  if (intent === 'explore') {
    return baseResponse(copy(language, {
      en: 'Explore what is currently listed in the Nishree collection. Product names, images, prices and availability below come from the live catalogue.',
      ta: 'Nishree-யின் தற்போதைய சேலைத் தொகுப்பைப் பாருங்கள். பெயர், படம், விலை மற்றும் கிடைக்கும் நிலை தற்போதைய பட்டியலிலிருந்து காட்டப்படும்.',
      tanglish: 'Nishree collection-la ippo irukkura sarees paarunga. Names, photos, prices, availability current catalogue-la irundhu varum.',
    }), { productQuery: { sort: 'featured', available: true }, suggestions: ['Bridal sarees', 'Red sarees', 'Saree under 5000'] });
  }
  if (intent === 'perfect') {
    return baseResponse(copy(language, {
      en: 'Let’s find a saree for your occasion. What are you dressing for?',
      ta: 'உங்கள் நிகழ்ச்சிக்கான சேலையைத் தேர்வு செய்வோம். எந்த நிகழ்ச்சிக்காகத் தேடுகிறீர்கள்?',
      tanglish: 'Unga occasion-ku oru saree kandupidikkalaam. Enna occasion?',
    }), { suggestions: ['Wedding', 'Bridal', 'Festive', 'Pooja', 'Office wear', 'Gifting'], flow: 'occasion' });
  }
  if (intent === 'wedding') {
    return baseResponse(copy(language, {
      en: 'For a wedding, which look feels most like you?',
      ta: 'திருமணத்திற்கு எந்த தோற்றம் உங்களுக்கு ஏற்றது?',
      tanglish: 'Wedding-ku endha look unga style?',
    }), { suggestions: ['Traditional bridal', 'Elegant minimal', 'Rich festive', 'Lightweight celebration'], flow: 'wedding-look' });
  }
  if (intent === 'fabricMenu') {
    return baseResponse(copy(language, {
      en: 'Choose a fabric to learn about it. Product material claims are always taken from each listing, not guessed.',
      ta: 'துணி வகையைத் தேர்வு செய்யுங்கள். தயாரிப்பின் துணி விவரம் அதன் பட்டியலிலிருந்து மட்டுமே காட்டப்படும்.',
      tanglish: 'Fabric details therinjukka select pannunga. Product fabric claims listing-la irundhu mattum edukkapadum.',
    }), { suggestions: FABRIC_GUIDE.map((item) => item.question), faqItems: FABRIC_GUIDE.map((item) => ({ question: item.question, answer: item[language === 'ta' ? 'tamil' : language === 'tanglish' ? 'tanglish' : 'answer'] })) });
  }
  if (intent === 'care') {
    return baseResponse(copy(language, {
      en: 'Saree care depends on the fabric, dye and embellishment. Start with the product care label; here are a few gentle general guidelines.',
      ta: 'சேலை பராமரிப்பு துணி, நிறம் மற்றும் அலங்காரத்தைப் பொறுத்தது. முதலில் தயாரிப்பு பராமரிப்பு குறிப்பைப் பாருங்கள்.',
      tanglish: 'Fabric, dye, embellishment poruthu care maarum. Product care label first check pannunga; sila general tips:',
    }), { faqItems: CARE_FAQS, suggestions: ['Silk sarees', 'Georgette sarees', 'Zari care'] });
  }
  if (intent === 'fabricInfo') return fabricAnswer(question, language);
  if (intent === 'shipping') {
    return baseResponse(copy(language, {
      en: 'Orders are generally processed within 1–3 business days; estimated delivery is 5–10 business days after dispatch. Delivery estimates and serviceability can vary by PIN code. For shipping charges, address changes, international delivery, or a delay, please check the policy or contact our team.',
      ta: 'ஆர்டர்கள் பொதுவாக 1–3 வேலை நாட்களில் செயலாக்கப்படும்; அனுப்பிய பிறகு விநியோக மதிப்பீடு 5–10 வேலை நாட்கள். PIN code-ஐப் பொறுத்து மாறலாம். கட்டணம், முகவரி மாற்றம், சர்வதேச அனுப்புதல் அல்லது தாமதத்திற்கு எங்கள் குழுவைத் தொடர்புகொள்ளுங்கள்.',
      tanglish: 'Orders usually 1–3 business days-la process aagum; dispatch apram estimated delivery 5–10 business days. PIN code poruthu vary aagalaam. Charges, address change, international delivery, delay-ku team-a contact pannunga.',
    }), { links: [{ label: 'Shipping policy', to: '/policies/shipping' }, { label: 'Contact support', to: '/contact' }], suggestions: ['Track my order', 'Shipping charges', 'International shipping'] });
  }
  if (intent === 'returns') {
    if (/\b(cancel|cancellation)\b/.test(normalize(question))) {
      return baseResponse('Cancellation depends on the order’s current status. Please review Your orders and contact the team promptly so they can confirm whether a change is still possible. The published policy has the current terms.', {
        links: [{ label: 'Your orders', to: '/account/orders' }, { label: 'Terms and conditions', to: '/policies/terms' }, { label: 'Contact support', to: '/contact' }],
      });
    }
    return baseResponse(copy(language, {
      en: 'Eligible return requests may be made within 7 days of receiving the product. For a damaged item, contact the team within 48 hours with order details and supporting photos or video. Refunds and exchanges are subject to the published policy and item eligibility.',
      ta: 'தகுதியுள்ள பொருளுக்கு பெற்ற 7 நாட்களுக்குள் return request செய்யலாம். சேதமடைந்த பொருளுக்கு order விவரங்கள் மற்றும் புகைப்படம்/வீடியோவுடன் 48 மணிநேரத்திற்குள் குழுவைத் தொடர்புகொள்ளுங்கள். Refund/exchange விதிகள் policy-க்கு உட்பட்டவை.',
      tanglish: 'Eligible item-ku receive pannina 7 days-kulla return request pannalaam. Damaged item-na order details + photos/video-oda 48 hours-kulla team-a contact pannunga. Refund/exchange published policy and eligibility-ku subject.',
    }), { links: [{ label: 'Return policy', to: '/policies/returns' }, { label: 'Start a return request', to: '/account/returns' }, { label: 'Contact support', to: '/contact' }], suggestions: ['Damaged product', 'How do refunds work?', 'Cancel my order'] });
  }
  if (intent === 'orders') {
    const normalized = normalize(question);
    if (/\b(track|tracking|status|follow)\b/.test(normalized)) {
      return baseResponse('Sign in and open Your orders to see the latest order status recorded by the store. I cannot access private order details here.', { links: [{ label: 'Your orders', to: '/account/orders' }, { label: 'Contact support', to: '/contact' }] });
    }
    if (/\b(payment|paid|transaction|failed)\b/.test(normalized)) {
      return baseResponse('Payment options are shown securely at checkout. For a failed or uncertain payment, check your order history first and contact support if the status is unclear. Never share your password, OTP or full card/bank details in chat.', { links: [{ label: 'Your orders', to: '/account/orders' }, { label: 'Contact support', to: '/contact' }] });
    }
    if (/\b(confirm|confirmation|email)\b/.test(normalized)) {
      return baseResponse('Check your email inbox and spam folder, then review Your orders for the latest status. If the order is not listed, contact the team. Please do not share passwords or OTPs here.', { links: [{ label: 'Your orders', to: '/account/orders' }, { label: 'Contact support', to: '/contact' }] });
    }
    if (/\b(cod|cash on delivery)\b/.test(normalized)) {
      const limit = Number(context.codLimit);
      const limitText = Number.isFinite(limit) && limit > 0 ? ` The configured COD order limit is ₹${limit.toLocaleString('en-IN')}; final eligibility is confirmed at checkout.` : '';
      return baseResponse(`Available payment methods and COD eligibility are confirmed at checkout.${limitText} Please do not share payment credentials in chat.`, { links: [{ label: 'Shop sarees', to: '/shop' }, { label: 'Contact support', to: '/contact' }] });
    }
    return baseResponse('To place an order, open a saree, review its confirmed product details and options, then choose Add to Bag and continue to checkout. For order status, sign in to Your orders. I cannot access private order data.', { links: [{ label: 'Shop sarees', to: '/shop' }, { label: 'Your orders', to: '/account/orders' }, { label: 'Contact support', to: '/contact' }] });
  }
  if (intent === 'contact') {
    return baseResponse(copy(language, {
      en: 'For a question I cannot confirm, our team will be happy to help. Choose the contact option that works for you.',
      ta: 'உறுதியாக பதிலளிக்க முடியாத கேள்விகளுக்கு எங்கள் குழு உதவும். உங்களுக்கு வசதியான தொடர்பு முறையைத் தேர்வு செய்யுங்கள்.',
      tanglish: 'Naan confirm panna mudiyadha question-na, enga team help pannuvaanga. Ungalukku convenient-aana contact option choose pannunga.',
    }), { contact: true });
  }
  if (intent === 'offer') {
    return baseResponse(copy(language, {
      en: 'I’ll check the offers currently published by Nishree Attire. Any offer details shown will come from the store’s live offer list.',
      ta: 'Nishree Attire தற்போது வெளியிட்டுள்ள சலுகைகளைப் பார்க்கிறேன். காட்டப்படும் விவரங்கள் கடையின் தற்போதைய சலுகைப் பட்டியலிலிருந்து வரும்.',
      tanglish: 'Nishree Attire ippo publish pannirukkura offers check pannuren. Details current offer list-la irundhu varum.',
    }), { offerQuery: true });
  }
  if (intent === 'price') {
    const budget = getBudget(normalize(question));
    const query = { sort: 'price-asc', available: true };
    if (budget) query.maxPrice = budget;
    return baseResponse(budget
      ? `I’ll look for currently available sarees priced up to ₹${budget.toLocaleString('en-IN')}.`
      : 'I’ll check the lowest-priced currently available pieces and their live listed prices. Offers, if any, are shown separately from the product price.', {
      productQuery: query,
      offerQuery: question === 'price' || /\b(offer|discount|coupon|sale)\b/.test(normalize(question)),
      suggestions: ['Under 5000', 'Under 10000', 'Current offers'],
    });
  }
  if (intent === 'bridal' || intent === 'occasion' || intent === 'discovery' || intent === 'color') {
    const normalized = normalize(question);
    let query = { sort: 'featured', available: true };
    if (intent === 'bridal') query = { ...query, occasion: 'bridal' };
    if (intent === 'occasion') {
      if (/\b(guest|attending|engagement|reception)\b/.test(normalized)) query.occasion = 'wedding';
      else if (/\b(office)\b/.test(normalized)) query.occasion = 'office';
      else if (/\b(pooja|puja)\b/.test(normalized)) query.occasion = 'pooja';
      else if (/\b(casual)\b/.test(normalized)) query.occasion = 'casual';
      else if (/\b(gift|gifting)\b/.test(normalized)) query.occasion = 'gifting';
      else query.occasion = 'festive';
    }
    if (/\b(lightweight|light weight|traditional)\b/.test(normalized)) {
      query.search = /\b(lightweight|light weight)\b/.test(normalized) ? 'lightweight' : 'traditional';
    }
    const budget = getBudget(normalized);
    if (budget) query.maxPrice = budget;
    if (intent === 'color') {
      const color = ['red', 'maroon', 'wine', 'pink', 'blue', 'green', 'black', 'white', 'ivory', 'golden', 'yellow', 'purple', 'orange'].find((item) => normalized.includes(item));
      if (color) query.color = color;
    }
    if (/\b(kanchipuram|silk|georgette|chiffon|organza|cotton|banarasi)\b/.test(normalized)) {
      const material = ['kanchipuram silk', 'banarasi silk', 'soft silk', 'pure silk', 'georgette', 'chiffon', 'organza', 'cotton', 'silk'].find((item) => normalized.includes(item));
      if (material) query.material = material;
    }
    const responseText = intent === 'bridal'
      ? 'Here are available pieces listed for bridal occasions. Please open each product page to confirm its fabric, colour, price and details.'
      : intent === 'color'
        ? 'Here are current catalogue matches for that colour. Colour names and availability are taken from the product listings.'
        : 'Here are current catalogue matches. Open a product to see its confirmed details and availability.';
    return baseResponse(responseText, { productQuery: query, links: [{ label: 'Browse all sarees', to: '/shop' }] });
  }

  return baseResponse(copy(language, {
    en: 'I’m sorry, I couldn’t find an exact answer for that question. Please choose one of the options below or contact our team.',
    ta: 'மன்னிக்கவும், இந்தக் கேள்விக்கான சரியான பதில் கிடைக்கவில்லை. கீழே உள்ள விருப்பத்தைத் தேர்வு செய்யுங்கள் அல்லது எங்கள் குழுவைத் தொடர்புகொள்ளுங்கள்.',
    tanglish: 'Sorry, indha question-ku exact answer kidaikkala. Keela irukkura option choose pannunga illa team-a contact pannunga.',
  }), { suggestions: ['Explore sarees', 'Shipping & delivery', 'Returns & exchanges', 'Contact our team'], contact: true });
};

export function processAssistantMessage(question, { language = 'en', flow = '', codLimit } = {}) {
  const normalized = normalize(question);
  const action = QUICK_ACTIONS.find((item) => item.id === question);

  if (question === 'menu') return menuResponse(language);

  if (action) {
    const actionIntents = {
      explore: 'explore',
      perfect: 'perfect',
      fabrics: 'fabricMenu',
      price: 'price',
      shipping: 'shipping',
      returns: 'returns',
      orders: 'orders',
      contact: 'contact',
    };
    return intentResponse(actionIntents[action.id], question, language, { codLimit });
  }

  if (flow === 'wedding-look') {
    const query = /\b(traditional|bridal)\b/.test(normalized)
      ? { occasion: 'bridal' }
      : /\b(minimal|elegant)\b/.test(normalized)
        ? { occasion: 'wedding' }
        : /\b(lightweight|light weight)\b/.test(normalized)
          ? { occasion: 'wedding' }
          : { occasion: 'festive' };
    return baseResponse('I’ll show available pieces that fit this wedding look. Please check the individual listing for confirmed fabric, price and details.', {
      productQuery: { ...query, available: true, sort: 'featured' },
      flow: '',
    });
  }
  if (flow === 'occasion') {
    if (/\b(wedding|bridal|marriage|kalyanam)\b/.test(normalized)) return intentResponse('wedding', question, language);
    if (/\b(festive|festival|pooja|puja|engagement|reception)\b/.test(normalized)) {
      return baseResponse('For a celebration, would you prefer a rich traditional look or something light and easy to wear?', { suggestions: ['Rich festive', 'Lightweight celebration'], flow: 'wedding-look' });
    }
    if (/\b(gift|gifting)\b/.test(normalized)) return intentResponse('occasion', 'gifting', language);
    if (/\b(office|casual)\b/.test(normalized)) return intentResponse('occasion', question, language);
  }

  const tamilProductQuery = /சேலை|புடவை/.test(normalized);
  const tamilProductColor = [
    { pattern: /சிவப்பு|சிகப்பு/, color: 'red' },
    { pattern: /மெரூன்|அடர் சிவப்பு/, color: 'maroon' },
    { pattern: /இளஞ்சிவப்பு/, color: 'pink' },
    { pattern: /நீலம்|நீல/, color: 'blue' },
    { pattern: /பச்சை/, color: 'green' },
    { pattern: /கருப்பு/, color: 'black' },
    { pattern: /வெள்ளை|வெண்மை/, color: 'white' },
    { pattern: /மஞ்சள்|தங்க நிறம்/, color: 'yellow' },
  ].find((entry) => entry.pattern.test(normalized));
  const tamilPolicyIntent = TAMIL_RULES.find((rule) => rule.intent !== 'bridal' && rule.intent !== 'fabricInfo' && rule.intent !== 'discovery' && rule.pattern.test(normalized));
  if (tamilProductQuery && !tamilPolicyIntent) {
    const query = { sort: 'featured', available: true };
    if (/காஞ்சிபுரம்/.test(normalized)) query.material = 'kanchipuram silk';
    else if (/பட்டு/.test(normalized)) query.material = 'silk';
    if (tamilProductColor) query.color = tamilProductColor.color;
    if (/திருமண|மணப்பெண்|கல்யாணம்/.test(normalized)) query.occasion = 'bridal';
    else if (/பண்டிகை|திருவிழா|பூஜை/.test(normalized)) query.occasion = 'festive';
    else if (/அலுவலகம்/.test(normalized)) query.occasion = 'office';
    else if (/பரிசு/.test(normalized)) query.occasion = 'gifting';
    return baseResponse(copy(language, {
      en: 'Here are current catalogue matches. Open a product page to confirm its listed details, price and availability.',
      ta: 'தற்போதைய பட்டியலில் உள்ள பொருத்தமான சேலைகள் இங்கே. துணி, விலை மற்றும் கிடைக்கும் நிலையை தயாரிப்பு பக்கத்தில் உறுதிப்படுத்துங்கள்.',
      tanglish: 'Current catalogue-la irukkura matching sarees inga. Fabric, price, availability product page-la confirm pannunga.',
    }), { productQuery: query, links: [{ label: 'Browse all sarees', to: '/shop' }] });
  }

  if (/\b(wedding|marriage|kalyanam)\b/.test(normalized) && !/\b(guest|attending)\b/.test(normalized)) {
    return intentResponse('wedding', question, language);
  }
  const tamilMatched = TAMIL_RULES.find((rule) => rule.pattern.test(normalized));
  if (tamilMatched) return intentResponse(tamilMatched.intent, question, language, { codLimit });

  const materialQuery = /\b(kanchipuram|silk|georgette|chiffon|organza|cotton|banarasi)\b/.test(normalized);
  const asksForExplanation = /\b(what is|difference|compare|texture|fabric|material|care)\b/.test(normalized);
  const isProductRequest = /\b(available|show|want|have|looking|find|buy|purchase|collection|under)\b/.test(normalized)
    || /\bsaree\b/.test(normalized);
  const hasProductFilters = materialQuery || /\b(bridal|bride|wedding|marriage|kalyanam|red|maroon|wine|pink|blue|green|black|white|ivory|golden|yellow|purple|orange|office|casual|festive|festival|pooja|puja|gift|gifting|traditional|lightweight)\b/.test(normalized);
  const productIntent = /\b(bridal|bride|wedding|marriage|kalyanam)\b/.test(normalized)
    ? 'bridal'
    : /\b(red|maroon|wine|pink|blue|green|black|white|ivory|golden|yellow|purple|orange)\b/.test(normalized)
      ? 'color'
      : /\b(office|casual|festive|festival|pooja|puja|gift|gifting|engagement|reception)\b/.test(normalized)
        ? 'occasion'
        : 'discovery';
  const matched = hasProductFilters && isProductRequest && !asksForExplanation
    ? { intent: productIntent }
    : RULES.find((rule) => rule.patterns.some((pattern) => pattern.test(normalized)));
  if (!matched) return intentResponse('unknown', question, language, { codLimit });
  return intentResponse(matched.intent, question, language, { codLimit });
}

export function getMainMenuMessage(language = 'en') {
  return menuResponse(language);
}
