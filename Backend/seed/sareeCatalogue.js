import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const seedDirectory = dirname(fileURLToPath(import.meta.url));
const commonsImages = JSON.parse(
  readFileSync(join(seedDirectory, 'sareeProductImages.json'), 'utf8').replace(/^\uFEFF/, ''),
);

export const sareeCategories = [
  { name: 'Kanchipuram Silk Sarees', slug: 'kanchipuram-silk-sarees', description: 'Traditional silk saree catalogue previews inspired by Kanchipuram zari borders.', sortOrder: 1 },
  { name: 'Banarasi Sarees', slug: 'banarasi-sarees', description: 'Banarasi-inspired silk and brocade saree catalogue previews.', sortOrder: 2 },
  { name: 'Silk Sarees', slug: 'silk-sarees', description: 'Silk saree catalogue previews across colour, weave and occasion.', sortOrder: 3 },
  { name: 'Cotton Sarees', slug: 'cotton-sarees', description: 'Cotton and handloom saree catalogue previews for everyday and festive wear.', sortOrder: 4 },
  { name: 'Soft Silk Sarees', slug: 'soft-silk-sarees', description: 'Soft silk saree catalogue previews with lightweight drapes and woven borders.', sortOrder: 5 },
  { name: 'Organza Sarees', slug: 'organza-sarees', description: 'Organza saree catalogue previews with light, airy styling.', sortOrder: 6 },
  { name: 'Chiffon Sarees', slug: 'chiffon-sarees', description: 'Chiffon saree catalogue previews with soft, fluid drapes.', sortOrder: 7 },
  { name: 'Georgette Sarees', slug: 'georgette-sarees', description: 'Georgette saree catalogue previews for contemporary occasions.', sortOrder: 8 },
  { name: 'Designer and Festive Sarees', slug: 'designer-festive-sarees', description: 'Designer and festive saree catalogue previews in traditional and contemporary styles.', sortOrder: 9 },
];

const concepts = [
  { name: 'Bengal Loom Vermilion Tant Saree', category: 'cotton-sarees', material: 'Handloom cotton', color: 'Ivory and vermilion', price: 2290, detail: 'A light woven body is paired with a crisp red border and a simple contrast pallu, suited to a sample festive handloom edit.', occasions: ['Everyday', 'Festive'] },
  { name: 'Bishnupur Crimson Baluchari Saree', category: 'silk-sarees', material: 'Silk', color: 'Crimson and antique gold', price: 8490, detail: 'The concept pairs a rich crimson ground with a woven pallu inspired by narrative Baluchari motifs.', occasions: ['Wedding', 'Festive'] },
  { name: 'Bishnupur Peacock Baluchari Saree', category: 'silk-sarees', material: 'Silk', color: 'Peacock blue and gold', price: 8990, detail: 'A jewel-toned body and decorative pallu give this sample concept a formal, occasion-led finish.', occasions: ['Wedding', 'Celebration'] },
  { name: 'Baluchari Lotus Motif Silk Saree', category: 'silk-sarees', material: 'Silk', color: 'Ruby red', price: 8290, detail: 'The illustrative design centres on a traditional motif layout with a contrasting woven border.', occasions: ['Festive', 'Family gathering'] },
  { name: 'Baluchari Temple Border Saree', category: 'silk-sarees', material: 'Silk', color: 'Deep maroon and gold', price: 8690, detail: 'A temple-inspired border and richly coloured pallu define this sample traditional edit.', occasions: ['Wedding', 'Festive'] },
  { name: 'Baluchari Garden Pallu Saree', category: 'silk-sarees', material: 'Silk', color: 'Forest green and gold', price: 8890, detail: 'The concept combines a deep green field with a patterned pallu for a composed festive silhouette.', occasions: ['Celebration', 'Evening'] },
  { name: 'Baluchari Heritage Motif Saree', category: 'silk-sarees', material: 'Silk', color: 'Plum and antique gold', price: 9190, detail: 'A heritage-style motif and broad pallu create a stately sample look for special gatherings.', occasions: ['Wedding', 'Reception'] },
  { name: 'Bishnupur Swarnachari Blue Saree', category: 'silk-sarees', material: 'Silk', color: 'Sapphire blue and gold', price: 8990, detail: 'A blue ground with a warm gold border gives this sample concept a vivid, traditional profile.', occasions: ['Festive', 'Wedding'] },
  { name: 'Kanchipuram Bridal Mango Silk Saree', category: 'kanchipuram-silk-sarees', material: 'Silk', color: 'Leaf green and gold', price: 15990, detail: 'The sample bridal concept pairs a saturated silk body with a generous zari-inspired border and ceremonial pallu.', occasions: ['Bridal', 'Wedding'] },
  { name: 'Chanderi Rose-Gold Tissue Saree', category: 'silk-sarees', material: 'Chanderi silk blend', color: 'Champagne and rose gold', price: 6290, detail: 'An airy, lightly lustrous body and fine border give this concept an understated occasion finish.', occasions: ['Day celebration', 'Festive'] },
  { name: 'Chanderi Sandalwood Butta Saree', category: 'silk-sarees', material: 'Chanderi silk blend', color: 'Sandalwood beige', price: 6490, detail: 'Small woven butta details and a restrained border keep this sample design light and versatile.', occasions: ['Puja', 'Day gathering'] },
  { name: 'Ruby Tissue Bridal Silk Saree', category: 'kanchipuram-silk-sarees', material: 'Tissue silk', color: 'Ruby red with silver and gold', price: 13990, detail: 'A luminous red body and metallic-looking border shape this illustrative bridal edit.', occasions: ['Bridal', 'Reception'] },
  { name: 'Chinnalampati Indigo Cotton Saree', category: 'cotton-sarees', material: 'Handloom cotton', color: 'Indigo and ivory', price: 2490, detail: 'A breathable cotton concept with a compact geometric border for a relaxed handloom look.', occasions: ['Everyday', 'Work'] },
  { name: 'Koorai Wedding Red and Gold Saree', category: 'kanchipuram-silk-sarees', material: 'Silk-cotton blend', color: 'Vermilion and gold', price: 6890, detail: 'A traditional red-and-gold palette anchors this sample wedding saree concept.', occasions: ['Wedding', 'Temple visit'] },
  { name: 'Koorai Lotus Green Saree', category: 'kanchipuram-silk-sarees', material: 'Silk-cotton blend', color: 'Lotus green and pink', price: 6590, detail: 'A fresh green field with a contrasting pallu gives this sample a bright ceremonial feel.', occasions: ['Festive', 'Family gathering'] },
  { name: 'Koorai Peacock Blue Saree', category: 'kanchipuram-silk-sarees', material: 'Silk-cotton blend', color: 'Peacock blue and magenta', price: 6790, detail: 'A saturated blue body is balanced by a vivid contrast border in this illustrative regional style.', occasions: ['Festive', 'Wedding'] },
  { name: 'Koorai Marigold Border Saree', category: 'kanchipuram-silk-sarees', material: 'Silk-cotton blend', color: 'Marigold and deep red', price: 6390, detail: 'The concept uses a warm yellow body and a darker woven edge for a recognisable festive drape.', occasions: ['Puja', 'Festive'] },
  { name: 'Koorai Rosewood Checks Saree', category: 'kanchipuram-silk-sarees', material: 'Silk-cotton blend', color: 'Rosewood and gold', price: 6990, detail: 'A checked body and traditional contrast pallu form the basis of this sample regional edit.', occasions: ['Wedding', 'Celebration'] },
  { name: 'Koorai Classic Contrast Saree', category: 'kanchipuram-silk-sarees', material: 'Silk-cotton blend', color: 'Purple and antique gold', price: 7190, detail: 'A contrast border and repeating woven accents make this a classic-looking festive sample.', occasions: ['Festive', 'Evening'] },
  { name: 'Kota Doria Sky-Check Saree', category: 'cotton-sarees', material: 'Kota doria cotton', color: 'Sky blue and white', price: 2890, detail: 'The light check pattern and airy weave-inspired styling make this sample suitable for warm-weather wear.', occasions: ['Day wear', 'Work'] },
  { name: 'Laal Paar Bengali Cotton Saree', category: 'cotton-sarees', material: 'Cotton', color: 'Ivory and red', price: 2190, detail: 'A clean ivory field with a strong red edge creates a familiar Bengali festive colour story.', occasions: ['Festive', 'Puja'] },
  { name: 'Manamedu Handloom Teal Saree', category: 'cotton-sarees', material: 'Handloom cotton', color: 'Teal and copper', price: 3190, detail: 'A grounded teal body and earthy border give this handloom sample a distinctive regional character.', occasions: ['Everyday', 'Gathering'] },
  { name: 'Mangalagiri Temple Stripe Saree', category: 'cotton-sarees', material: 'Mangalagiri cotton', color: 'Black and antique gold', price: 2690, detail: 'A simple body and disciplined border lines shape this illustrative Mangalagiri-inspired design.', occasions: ['Work', 'Puja'] },
  { name: 'Mulmul Cotton Blossom Saree', category: 'cotton-sarees', material: 'Mulmul cotton', color: 'Soft pink and ivory', price: 1890, detail: 'A gentle pastel palette and light cotton styling make this sample an easy daytime option.', occasions: ['Everyday', 'Day gathering'] },
  { name: 'Kanchipuram Lotus Weave Silk Saree', category: 'kanchipuram-silk-sarees', material: 'Silk', color: 'Royal purple and antique gold', price: 14990, detail: 'A folded silk reference shows a rich purple field and broad woven borders for this traditional Kanchipuram-inspired sample.', occasions: ['Wedding', 'Festive'] },
  { name: 'Original Pattu Bridal Silk Saree', category: 'kanchipuram-silk-sarees', material: 'Pure silk', color: 'Deep red and gold', price: 16990, detail: 'A broad ceremonial border and saturated silk palette give this sample bridal concept a traditional profile.', occasions: ['Bridal', 'Wedding'] },
  { name: 'Peach Organza Garden Saree', category: 'organza-sarees', material: 'Organza', color: 'Peach and rose', price: 4290, detail: 'An airy silhouette with delicate floral styling gives this sample organza concept a light occasion feel.', occasions: ['Engagement', 'Day celebration'] },
  { name: 'Sambalpuri Blue Ikat Saree', category: 'cotton-sarees', material: 'Handloom cotton', color: 'Indigo and cream', price: 3890, detail: 'A geometric ikat-inspired field makes this blue sample a striking handloom-led choice.', occasions: ['Work', 'Everyday'] },
  { name: 'Sambalpuri Red Ikat Saree', category: 'cotton-sarees', material: 'Handloom cotton', color: 'Red and black', price: 4190, detail: 'Bold geometric motifs and a vivid ground define this sample Sambalpuri-inspired edit.', occasions: ['Festive', 'Gathering'] },
  { name: 'Mysore Silk Evening Saree', category: 'silk-sarees', material: 'Silk', color: 'Mustard gold and magenta', price: 7890, detail: 'A smooth-looking silk body with a contrasting border gives this sample an elegant evening profile.', occasions: ['Evening', 'Festive'] },
  { name: 'Tussar Pallu Heritage Saree', category: 'silk-sarees', material: 'Tussar silk', color: 'Natural gold and rust', price: 7290, detail: 'A textured-looking body and statement pallu create a composed heritage-style sample.', occasions: ['Puja', 'Celebration'] },
  { name: 'Silver Zari Border Designer Saree', category: 'designer-festive-sarees', material: 'Georgette', color: 'Midnight blue and silver', price: 5690, detail: 'A fluid sample base with a bright border gives the design a contemporary festive line.', occasions: ['Reception', 'Evening'] },
  { name: 'Red Gold Temple Border Kanchipuram', category: 'kanchipuram-silk-sarees', material: 'Silk', color: 'Ruby red and gold', price: 14990, detail: 'A traditional red body with a substantial temple-style border anchors this illustrative Kanchipuram edit.', occasions: ['Wedding', 'Festive'] },
  { name: 'Crimson Draped Designer Saree', category: 'designer-festive-sarees', material: 'Chiffon', color: 'Crimson and antique gold', price: 4990, detail: 'A softly draped sample silhouette is paired with a refined border for an evening look.', occasions: ['Cocktail', 'Evening'] },
  { name: 'Soft Silk Peacock Border Saree', category: 'soft-silk-sarees', material: 'Soft silk', color: 'Peacock blue and gold', price: 5990, detail: 'A gentle sheen and traditional border make this sample easy to style for a family celebration.', occasions: ['Festive', 'Family gathering'] },
  { name: 'Soft Silk Rosewood Classic Saree', category: 'soft-silk-sarees', material: 'Soft silk', color: 'Rosewood and copper', price: 5390, detail: 'A warm rosewood tone and restrained zari-inspired accents give this illustrative classic a quiet finish.', occasions: ['Celebration', 'Dinner'] },
  { name: 'Soft Silk Marigold Woven Saree', category: 'soft-silk-sarees', material: 'Soft silk', color: 'Marigold and purple', price: 5790, detail: 'A golden body and contrasting pallu create a bright sample look for festive dressing.', occasions: ['Puja', 'Festive'] },
  { name: 'Kanchipuram Bridal Lotus Saree', category: 'kanchipuram-silk-sarees', material: 'Silk', color: 'Rose pink and antique gold', price: 17990, detail: 'A broad zari-inspired pallu and a rose-pink colour story shape this sample bridal concept.', occasions: ['Bridal', 'Wedding'] },
  { name: 'Forest Green Banarasi Brocade Saree', category: 'banarasi-sarees', material: 'Brocade silk', color: 'Forest green, maroon and gold', price: 12990, detail: 'A brocade-inspired surface and deep contrast border give this Banarasi-style sample a rich festive character.', occasions: ['Wedding', 'Reception'] },
  { name: 'Timeless Kanchipuram Peacock Saree', category: 'kanchipuram-silk-sarees', material: 'Silk', color: 'Peacock blue, purple and gold', price: 15990, detail: 'A jewel-toned body and traditional border motifs form this illustrative Kanchipuram-inspired design.', occasions: ['Wedding', 'Festive'] },
  { name: 'Timeless Kanchipuram Heritage Silk Saree', category: 'kanchipuram-silk-sarees', material: 'Silk', color: 'Purple, teal and gold', price: 15990, detail: 'A jewel-toned folded silk reference pairs a decorated body with a broad traditional border for this festive sample.', occasions: ['Wedding', 'Festive'] },
  { name: 'Kanchipuram Red Gold Brocade Saree', category: 'kanchipuram-silk-sarees', material: 'Silk', color: 'Ruby red and antique gold', price: 14990, detail: 'A red-and-gold woven reference anchors this illustrative Kanchipuram brocade concept for special occasions.', occasions: ['Wedding', 'Reception'] },
  { name: 'Ruby Temple Kanchipuram Silk Saree', category: 'kanchipuram-silk-sarees', material: 'Silk', color: 'Ruby red and gold', price: 11990, detail: 'A folded red silk reference image accompanies a sample design with a wide temple-inspired border.', occasions: ['Festive', 'Wedding'] },
  { name: 'Ruby Red Kanchipuram Silk Saree', category: 'kanchipuram-silk-sarees', material: 'Silk', color: 'Ruby red and antique gold', price: 11990, detail: 'A folded crimson saree reference shows a traditional gold border for this illustrative Kanchipuram sample.', occasions: ['Festive', 'Wedding'] },
  { name: 'Turmeric Gold Kanchipuram Saree', category: 'kanchipuram-silk-sarees', material: 'Silk', color: 'Turmeric yellow and magenta', price: 13990, detail: 'A vivid golden field and magenta contrast border make this sample a bright traditional statement.', occasions: ['Festive', 'Wedding'] },
  { name: 'Mint Green Soft Silk Saree', category: 'soft-silk-sarees', material: 'Soft silk', color: 'Mint green and maroon', price: 6190, detail: 'A fresh mint body and richly coloured border create an elegant sample for daytime festivities.', occasions: ['Day celebration', 'Festive'] },
  { name: 'Peacock Teal Banarasi Pallu Saree', category: 'banarasi-sarees', material: 'Brocade silk', color: 'Peacock teal and purple', price: 13990, detail: 'A dramatic pallu and jewel-toned border give this Banarasi-inspired sample a formal presence.', occasions: ['Wedding', 'Reception'] },
  { name: 'Maroon Heirloom Banarasi Saree', category: 'banarasi-sarees', material: 'Brocade silk', color: 'Maroon and antique gold', price: 14990, detail: 'A classic maroon palette and ornate border make this illustrative brocade concept suitable for milestone occasions.', occasions: ['Wedding', 'Festive'] },
  { name: 'Rosewood Zari Festive Saree', category: 'designer-festive-sarees', material: 'Georgette', color: 'Rosewood and gold', price: 6890, detail: 'A deep rosewood drape and delicate zari-inspired accents finish this sample contemporary festive design.', occasions: ['Evening', 'Celebration'] },
  { name: 'Crimson Boutique Georgette Saree', category: 'georgette-sarees', material: 'Georgette', color: 'Crimson and rose gold', price: 6290, detail: 'A mannequin-styled reference highlights a crimson drape and contrasting border for this illustrative georgette evening edit.', occasions: ['Evening', 'Reception'] },
];

const localImages = [
  { id: 'NIA-SAMPLE-044', fileName: 'NIA-SAMPLE-044.jpg', title: 'Ruby red folded saree reference', credit: 'Nishree Attire project image asset', license: 'Project asset', sourceUrl: '' },
  { id: 'NIA-SAMPLE-046', fileName: 'NIA-SAMPLE-046.jpg', title: 'Turmeric yellow folded saree reference', credit: 'Nishree Attire project image asset', license: 'Project asset', sourceUrl: '' },
  { id: 'NIA-SAMPLE-047', fileName: 'NIA-SAMPLE-047.jpg', title: 'Mint green folded saree reference', credit: 'Nishree Attire project image asset', license: 'Project asset', sourceUrl: '' },
  { id: 'NIA-SAMPLE-048', fileName: 'NIA-SAMPLE-048.jpg', title: 'Peacock teal draped saree reference', credit: 'Nishree Attire project image asset', license: 'Project asset', sourceUrl: '' },
  { id: 'NIA-SAMPLE-049', fileName: 'NIA-SAMPLE-049.jpg', title: 'Maroon saree boutique styling reference', credit: 'Nishree Attire project image asset', license: 'Project asset', sourceUrl: '' },
  { id: 'NIA-SAMPLE-050', fileName: 'NIA-SAMPLE-050.jpg', title: 'Deep maroon saree boutique styling reference', credit: 'Nishree Attire project image asset', license: 'Project asset', sourceUrl: '' },
  { id: 'NIA-SAMPLE-045', fileName: 'NIA-SAMPLE-045.jpg', title: 'Crimson saree on a mannequin reference', credit: 'Nishree Attire project image asset', license: 'Project asset', sourceUrl: '' },
];

export const sareeProductImageSources = [
  ...commonsImages.map((image) => ({ ...image, storefrontUrl: `/catalogue-preview/${image.fileName}` })),
  ...localImages.map((image) => ({ ...image, storefrontUrl: `/catalogue-preview/${image.fileName}` })),
];

const slugify = (value) => value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const sareeCatalogueProducts = concepts.map((concept, index) => {
  const image = sareeProductImageSources[index];
  const sku = `NIA-SAMPLE-${String(index + 1).padStart(3, '0')}`;
  const imageTitle = image.title.replace(/^File:/, '').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
  const isNewArrival = [2, 14, 23, 37, 48].includes(index);
  const isFeatured = [8, 19, 32, 42].includes(index);

  return {
    ...concept,
    sku,
    slug: slugify(concept.name),
    shortDescription: `${concept.material} in ${concept.color.toLowerCase()}. ${concept.detail}`,
    description: `${concept.detail} This is an illustrative catalogue sample. The exact weave, fabric composition, colour, measurements, blouse details and current inventory have not been confirmed by Nishree Attire. Please verify and update these details before offering the item for sale.`,
    fabricCare: `Care guidance for this sample ${concept.material.toLowerCase()} listing is not confirmed. Verify the supplier's care instructions before publishing the product.`,
    occasion: concept.occasions,
    tags: ['catalogue-preview', 'stock-unverified', slugify(concept.material), concept.category, ...(isNewArrival ? ['new-arrival'] : [])],
    basePrice: concept.price,
    salePrice: index % 5 === 2 ? Math.round(concept.price * 0.9) : null,
    currency: 'INR',
    categorySlug: concept.category,
    imageUrl: image.storefrontUrl,
    imageAltText: `Illustrative saree reference image: ${imageTitle}. Product match and shade are not verified.`,
    imageCredit: image.sourceUrl ? `${image.credit || 'Wikimedia Commons contributor'} · Wikimedia Commons · ${image.license}` : image.credit,
    imageLicense: image.license,
    imageSourceUrl: image.sourceUrl,
    availableQuantity: 0,
    stockIsVerified: false,
    status: 'active',
    isFeatured,
    isNewArrival,
    brand: 'Nishree Attire',
    sareeLength: '5.5 m + 0.8 m blouse piece (sample specification)',
    blouseIncluded: false,
    blouseType: 'none',
  };
});

export const validateSareeCatalogue = () => {
  const unique = (values) => new Set(values).size === values.length;
  if (sareeCatalogueProducts.length !== 50) throw new Error(`Expected 50 catalogue products, received ${sareeCatalogueProducts.length}.`);
  if (!unique(sareeCatalogueProducts.map((product) => product.sku))) throw new Error('Catalogue SKUs must be unique.');
  if (!unique(sareeCatalogueProducts.map((product) => product.slug))) throw new Error('Catalogue slugs must be unique.');
  if (!unique(sareeProductImageSources.map((image) => image.storefrontUrl))) throw new Error('Catalogue image URLs must be unique.');
  for (const product of sareeCatalogueProducts) {
    if (!product.name || !product.description || !product.shortDescription || !product.imageAltText) throw new Error(`Product ${product.sku} is missing required catalogue copy.`);
    if (product.basePrice <= 0 || (product.salePrice != null && product.salePrice > product.basePrice)) throw new Error(`Product ${product.sku} has an invalid price.`);
    if (product.availableQuantity !== 0 || product.stockIsVerified) throw new Error(`Sample product ${product.sku} must not claim verified stock.`);
  }
  return true;
};

validateSareeCatalogue();
