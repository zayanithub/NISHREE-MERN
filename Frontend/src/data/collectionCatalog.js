import sareeGirl from '../assets/saree girl image.jpg';
import sareeGirls from '../assets/saree girls image.jpg';
import sareeImages from '../assets/saree images.jpg';
import sareeImagess from '../assets/saree imagess.jpg';
import sareeImagesss from '../assets/saree imagesss.jpg';
import sareeShop from '../assets/saree shop image.jpg';
import showroom from '../assets/saree showromm images.jpg';
import showroomWide from '../assets/saree showroom images.webp';
import designGirlOne from '../assets/saree design girl 1.jpg';
import designGirlTwo from '../assets/saree design girl 2.jpg';
import designGirlThree from '../assets/saree design girl 3.jpg';
import designGirlFour from '../assets/saree design girl 4.jpg';
import designGirlFive from '../assets/saree design girl 5.webp';
import designGirlSix from '../assets/saree design girl 6.webp';
import royalBlue from '../assets/Royal Blue and Ivory Palace Wedding Editorial.webp';
import regalBlush from '../assets/Regal Blush Saree in a Floral Arch.webp';
import maroonShowroom from '../assets/Maroon Saree in a Festive Bridal Showroom.webp';

const banners = [
  sareeShop, sareeImagesss, sareeGirl, showroom, royalBlue, sareeImages,
  designGirlOne, regalBlush, sareeGirls, designGirlTwo, showroomWide,
  designGirlThree, maroonShowroom, sareeImagess, designGirlFour,
  designGirlFive, designGirlSix,
];

const categoryImages = [
  sareeGirl, sareeGirls, sareeImages, sareeImagess, sareeImagesss,
  designGirlOne, designGirlTwo, designGirlThree, designGirlFour,
  designGirlFive, designGirlSix, showroom, showroomWide, royalBlue,
  regalBlush, maroonShowroom,
];

let imageIndex = 0;

function collection({ slug, name, description, query, children = [], menuEnabled = children.length > 0 }) {
  const index = imageIndex++;
  return {
    slug,
    name,
    description,
    seoTitle: `${name} Sarees | Nishree Attire`,
    seoDescription: description.slice(0, 200),
    bannerImage: banners[index % banners.length],
    image: categoryImages[index % categoryImages.length],
    query,
    children,
    menuEnabled,
  };
}

const silkCottonCategories = [
  collection({
    slug: 'silk-cotton-raagam',
    name: 'Silk Cotton Raagam',
    description: 'Explore the Raagam edit of silk cotton sarees, selected for their graceful drape and considered detail.',
    query: { search: 'Raagam' },
  }),
  collection({
    slug: 'kanchi-silk-cotton',
    name: 'Kanchi Silk Cotton',
    description: 'Kanchi silk cotton sarees bring the character of a traditional weave to a lighter, versatile drape.',
    query: { categories: ['kanchipuram-silk-sarees'], material: 'Silk-cotton blend' },
  }),
  collection({
    slug: 'maheshwari-silk-cotton',
    name: 'Maheshwari Silk Cotton',
    description: 'A refined edit of Maheshwari-inspired silk cotton sarees with an easy, elegant finish.',
    query: { search: 'Maheshwari Silk Cotton' },
  }),
  collection({
    slug: 'ikat-silk-cotton',
    name: 'Ikat Silk Cotton',
    description: 'Discover the expressive geometry of Ikat in a silk cotton saree edit.',
    query: { search: 'Ikat Silk Cotton' },
  }),
  collection({
    slug: 'kuppadam-silk-cotton',
    name: 'Kuppadam Silk Cotton',
    description: 'Kuppadam-inspired silk cotton sarees celebrate a distinctive balance of colour and weave.',
    query: { search: 'Kuppadam Silk Cotton' },
  }),
  collection({
    slug: 'mangalgiri-silk-cotton',
    name: 'Mangalgiri Silk Cotton',
    description: 'A considered selection of Mangalgiri silk cotton sarees, chosen for their clean lines and timeless appeal.',
    query: { search: 'Mangalgiri Silk Cotton' },
  }),
  collection({
    slug: 'kora-silk-cotton',
    name: 'Kora Silk Cotton',
    description: 'Browse the light, subtly textured character of Kora silk cotton sarees.',
    query: { search: 'Kora Silk Cotton' },
  }),
];

const collections = [
  collection({
    slug: 'new-arrival',
    name: 'Just Arrived',
    description: 'Meet the latest sarees added to the Nishree Attire collection, selected for the season ahead.',
    query: { tags: 'new-arrival' },
  }),
  collection({
    slug: 'silk',
    name: 'Silk',
    description: 'Discover heirloom-minded silk sarees, from Kanchipuram and Banarasi weaves to other distinctive silks.',
    query: {
      categories: ['kanchipuram-silk-sarees', 'banarasi-sarees', 'silk-sarees', 'soft-silk-sarees'],
      excludeMaterial: 'Silk-cotton',
    },
    children: [
      collection({
        slug: 'kanjivaram-silk',
        name: 'Kanjivaram Silk',
        description: 'Explore Kanjivaram silk sarees with expressive colour, traditional borders and enduring craftsmanship.',
        query: { categories: ['kanchipuram-silk-sarees'], excludeMaterial: 'silk-cotton' },
      }),
      collection({
        slug: 'banarasi-silk',
        name: 'Banarasi Silk',
        description: 'A timeless collection of Banarasi silk sarees with the richness and artistry of brocade.',
        query: { categories: ['banarasi-sarees'] },
      }),
      collection({
        slug: 'other-silks',
        name: 'Other Silks',
        description: 'Find a considered mix of silk sarees, from soft silk to distinctive regional and contemporary weaves.',
        query: { categories: ['silk-sarees', 'soft-silk-sarees'] },
      }),
    ],
  }),
  collection({
    slug: 'cotton',
    name: 'Cotton',
    description: 'Discover breathable cotton and handloom sarees with thoughtful colour and easy everyday elegance.',
    query: { categories: ['cotton-sarees'] },
    menuEnabled: true,
  }),
  collection({
    slug: 'silk-cotton',
    name: 'Silk Cotton',
    description: 'Browse lightweight silk cotton sarees that pair a comfortable drape with the richness of traditional weaving.',
    query: { categories: ['kanchipuram-silk-sarees'], material: 'Silk-cotton blend' },
    children: silkCottonCategories,
  }),
  collection({
    slug: 'tussars',
    name: 'Tussars',
    description: 'Discover the natural texture and understated sheen of Tussar sarees.',
    query: { categories: ['silk-sarees'], material: 'Tussar' },
    children: [
      collection({
        slug: 'madhubani-saree',
        name: 'Madhubani Saree',
        description: 'Explore sarees inspired by the expressive forms and colour of Madhubani art.',
        query: { search: 'Madhubani' },
      }),
      collection({
        slug: 'matka-silk',
        name: 'Matka Silk',
        description: 'Browse the textured character of Matka silk in a considered saree edit.',
        query: { material: 'Matka' },
      }),
      collection({
        slug: 'tussar',
        name: 'Tussar',
        description: 'Shop Tussar sarees known for their natural texture, warm tones and graceful drape.',
        query: { categories: ['silk-sarees'], material: 'Tussar' },
      }),
    ],
  }),
  collection({
    slug: 'linens',
    name: 'Linens',
    description: 'Discover the relaxed texture and breathable elegance of linen sarees.',
    query: { material: 'Linen' },
    menuEnabled: true,
  }),
  collection({
    slug: 'fancy',
    name: 'Fancy',
    description: 'Explore occasion-ready sarees across luminous textures, modern drapes and distinctive finishes.',
    query: { categories: ['organza-sarees', 'designer-festive-sarees', 'georgette-sarees', 'silk-sarees'] },
    children: [
      collection({
        slug: 'dupion-silk',
        name: 'Dupion Silk',
        description: 'Discover the crisp texture and subtle lustre of Dupion silk sarees.',
        query: { search: 'Dupion' },
      }),
      collection({
        slug: 'semi-tissue-silks',
        name: 'Semi Tissue Silks',
        description: 'Explore the soft luminosity of tissue silk sarees for celebratory moments.',
        query: { search: 'Semi Tissue' },
      }),
      collection({
        slug: 'semi-mysore-silks',
        name: 'Semi Mysore Silks',
        description: 'A graceful edit inspired by the fluid drape and polish of Mysore silk.',
        query: { search: 'Mysore' },
      }),
      collection({
        slug: 'organza-sarees',
        name: 'Organza Sarees',
        description: 'Light-catching organza sarees bring an airy, contemporary note to occasion dressing.',
        query: { categories: ['organza-sarees'] },
      }),
      collection({
        slug: 'semi-patola-sarees',
        name: 'Semi Patola Sarees',
        description: 'Discover Patola-inspired pattern and colour in a distinctive saree edit.',
        query: { search: 'Patola' },
      }),
      collection({
        slug: 'jute-sarees',
        name: 'Jute Sarees',
        description: 'Browse sarees with the earthy texture and natural character of jute.',
        query: { material: 'Jute' },
      }),
      collection({
        slug: 'raw-silks',
        name: 'Raw Silks',
        description: 'Explore raw silk sarees with an expressive texture and understated sheen.',
        query: { search: 'Raw Silk' },
      }),
      collection({
        slug: 'modal-silks',
        name: 'Modal Silks',
        description: 'Discover the soft, fluid drape of modal silk sarees.',
        query: { material: 'Modal' },
      }),
      collection({
        slug: 'kota-sarees',
        name: 'Kota Sarees',
        description: 'Explore Kota sarees valued for their light hand and delicate woven character.',
        query: { search: 'Kota' },
      }),
      collection({
        slug: 'dola-silk',
        name: 'Dola Silk',
        description: 'Browse Dola silk sarees with a soft drape and polished finish.',
        query: { search: 'Dola' },
      }),
    ],
  }),
  collection({
    slug: 'designer',
    name: 'Designer',
    description: 'Discover statement sarees selected for a contemporary point of view and special occasions.',
    query: { categories: ['designer-festive-sarees'] },
    menuEnabled: true,
  }),
];

export const collectionNavigation = collections;

export const allCollections = collections.flatMap((parent) => [
  { ...parent, parent: null },
  ...parent.children.map((child) => ({ ...child, parent })),
]);

export const collectionBySlug = new Map(
  allCollections.map((item) => [item.slug, item]),
);
