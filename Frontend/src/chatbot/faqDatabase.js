export const SUPPORTED_LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'ta', label: 'தமிழ்' },
  { value: 'tanglish', label: 'Tanglish' },
];

export const QUICK_ACTIONS = [
  { id: 'explore', icon: 'sparkles', label: { en: 'Explore sarees', ta: 'சேலைகளைப் பாருங்கள்', tanglish: 'Saree explore pannalaam' } },
  { id: 'perfect', icon: 'heart', label: { en: 'Find my perfect saree', ta: 'எனக்கான சேலையைத் தேர்வு செய்ய', tanglish: 'Enakku sariyana saree' } },
  { id: 'fabrics', icon: 'fabric', label: { en: 'Fabrics & care', ta: 'துணி வகைகள் மற்றும் பராமரிப்பு', tanglish: 'Fabric & care' } },
  { id: 'price', icon: 'tag', label: { en: 'Price & offers', ta: 'விலை மற்றும் சலுகைகள்', tanglish: 'Price & offers' } },
  { id: 'shipping', icon: 'truck', label: { en: 'Shipping & delivery', ta: 'அனுப்புதல் மற்றும் விநியோகம்', tanglish: 'Delivery details' } },
  { id: 'returns', icon: 'return', label: { en: 'Returns & exchanges', ta: 'திரும்பப்பெறுதல் மற்றும் மாற்றம்', tanglish: 'Return / exchange' } },
  { id: 'orders', icon: 'package', label: { en: 'Order assistance', ta: 'ஆர்டர் உதவி', tanglish: 'Order help' } },
  { id: 'contact', icon: 'message', label: { en: 'Contact our team', ta: 'எங்கள் குழுவைத் தொடர்புகொள்ள', tanglish: 'Team-a contact pannunga' } },
];

export const FABRIC_GUIDE = [
  {
    question: 'Kanchipuram silk',
    answer: 'Traditionally known for a substantial silk drape and richly woven borders. Check each product page for the exact material and craftsmanship details.',
    tamil: 'காஞ்சிபுரம் பட்டு பொதுவாக செறிவான நெசவு மற்றும் அழகிய பார்டருக்காக அறியப்படுகிறது. ஒவ்வொரு சேலையின் சரியான துணி விவரத்தையும் அதன் தயாரிப்பு பக்கத்தில் உறுதிப்படுத்துங்கள்.',
    tanglish: 'Kanchipuram silk usually rich weave-um bold border-um kondirukkum. Exact fabric details product page-la check pannunga.',
  },
  {
    question: 'Pure silk & soft silk',
    answer: '“Pure silk” and “soft silk” describe different material and finish claims. Please rely on the material description shown on each product; I will not label a piece unless its listing confirms it.',
    tamil: '“Pure silk” மற்றும் “soft silk” வேறுபட்ட துணி மற்றும் முடிப்பு விவரங்கள். தயாரிப்பு பக்கத்தில் குறிப்பிடப்பட்டுள்ள துணி விவரத்தையே உறுதியாகப் பார்க்கவும்.',
    tanglish: '“Pure silk” and “soft silk” different material details. Product listing confirm pannina details mattum nambunga.',
  },
  {
    question: 'Banarasi silk',
    answer: 'Banarasi styles are known for ornate woven motifs and decorative borders. Product-specific material claims are listed on the individual product page.',
    tamil: 'பனாரசி பாணி அலங்கார நெசவு வடிவங்கள் மற்றும் பார்டர்களுக்காக அறியப்படுகிறது. தயாரிப்பு விவரங்களுக்கு தனிப்பட்ட பக்கத்தைப் பாருங்கள்.',
    tanglish: 'Banarasi style ornate woven motifs-ku famous. Andha product-oda exact fabric details listing-la irukkum.',
  },
  {
    question: 'Georgette & chiffon',
    answer: 'Both are usually light, fluid fabrics. Georgette often has a subtly textured feel, while chiffon is typically finer and more sheer. Always check the listed material and care notes.',
    tamil: 'இரண்டும் பொதுவாக இலகுவான, மென்மையாக விழும் துணிகள். ஜார்ஜெட் சிறிது தானியத் தன்மையுடன் இருக்கும்; சிஃபான் பொதுவாக மெல்லியதாகவும் ஒளி ஊடுருவக்கூடியதாகவும் இருக்கும். தயாரிப்பு பராமரிப்பு குறிப்புகளைப் பாருங்கள்.',
    tanglish: 'Rendum light, flowy fabrics. Georgette konjam textured; chiffon usually finer and sheer. Product care notes check pannunga.',
  },
  {
    question: 'Organza',
    answer: 'Organza is a light, crisp fabric with a structured, airy appearance. Handle it gently and follow the care instructions provided with the specific saree.',
    tamil: 'ஆர்கன்சா இலகுவான, சற்றே உறுதியான தோற்றமுள்ள துணி. மெதுவாக கையாளவும்; குறிப்பிட்ட சேலையின் பராமரிப்பு வழிமுறைகளைப் பின்பற்றவும்.',
    tanglish: 'Organza light-a irukkum, konjam crisp structured look kudukkum. Gentle-a handle pannitu product care instructions follow pannunga.',
  },
  {
    question: 'Cotton & silk blends',
    answer: 'Cotton is often breathable and comfortable for longer wear. Blends combine characteristics of more than one fibre; check the product page for the exact composition.',
    tamil: 'பருத்தி பொதுவாக காற்றோட்டமாகவும் நீண்ட நேரம் அணிய வசதியாகவும் இருக்கும். கலவைத் துணிகளில் ஒன்றுக்கும் மேற்பட்ட நார்களின் தன்மைகள் இருக்கும்; சரியான கலவையை தயாரிப்பு பக்கத்தில் பாருங்கள்.',
    tanglish: 'Cotton breathable-a irukkum. Blends-la multiple fibres irukkalaam; exact composition product page-la check pannunga.',
  },
];

export const CARE_FAQS = [
  { question: 'How should I store a silk saree?', answer: 'Store it clean and completely dry in a cool, dry place. Refold it occasionally along different creases; use a breathable cotton cover and avoid direct sunlight.' },
  { question: 'How do I care for zari?', answer: 'Keep zari dry and away from perfume, moisture and harsh chemicals. Fold gently with a soft cloth between folds, and follow the product’s care label.' },
  { question: 'How should I wash georgette or chiffon?', answer: 'Care varies by weave, dye and embellishment. Check the product care label first; when unsure, choose a trusted professional cleaner rather than machine washing.' },
  { question: 'How can I prevent colour damage?', answer: 'Avoid prolonged direct sunlight, strong detergents and damp storage. Follow the specific product care instructions and test no cleaning method on the saree itself.' },
];

export const FAQ_SUGGESTIONS = [
  'Show silk sarees',
  'Bridal sarees iruka?',
  'Budget 5000 kulla',
  'Delivery evalo days?',
  'Return panna mudiyuma?',
];
