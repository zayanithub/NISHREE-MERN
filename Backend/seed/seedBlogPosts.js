import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "../config/DBconfig.js";
import BlogPost from "../models/BlogPost.js";

const starterStories = [
  {
    slug: "the-saree-in-motion",
    title: "The saree, in motion",
    category: "Saree Stories",
    contentType: "story",
    excerpt: "A closer look at the fluid silhouette, finishing details, and quiet character of a drape.",
    image: "blog-showroom-1.jpg",
    video: "blog-film-1.mp4",
    blocks: [
      { type: "paragraph", text: "A saree is never only a still image. Its character comes into view with each fold, each turn, and the way its edge catches the light." },
      { type: "quote", text: "The most beautiful detail is often the one that moves with you." },
      { type: "paragraph", text: "This short film is a small invitation to notice those details at your own pace." },
    ],
  },
  {
    slug: "a-study-in-blue",
    title: "A study in blue",
    category: "Colour Notes",
    contentType: "guide",
    excerpt: "An editorial colour story about blue, considered through light, texture, and silhouette.",
    image: "blog-model-blue.jpg",
    video: "blog-film-2.mp4",
    blocks: [
      { type: "paragraph", text: "Blue shifts beautifully with its surroundings: deep and composed in shade, bright and open when the light finds it." },
      { type: "heading", text: "A colour with many moods" },
      { type: "paragraph", text: "When choosing a blue drape, notice the undertone and how it sits beside the jewellery and blouse you already love." },
    ],
  },
  {
    slug: "softness-in-peach",
    title: "Softness in peach",
    category: "Styling Guides",
    contentType: "guide",
    excerpt: "A gentle styling reference for an easy, expressive drape in a softer palette.",
    image: "blog-model-peach.jpg",
    video: "blog-film-3.mp4",
    blocks: [
      { type: "paragraph", text: "A soft palette can feel quietly festive or beautifully at home in the daytime. Let the occasion and your own comfort guide the styling." },
      { type: "paragraph", text: "Try a restrained blouse, a favourite pair of earrings, and a drape that lets you move with ease." },
    ],
  },
  {
    slug: "red-with-presence",
    title: "Red, with presence",
    category: "Colour Notes",
    contentType: "story",
    excerpt: "A vivid portrait that lets colour and movement take the lead.",
    image: "blog-model-red.jpg",
    video: "blog-film-4.mp4",
    blocks: [
      { type: "paragraph", text: "Red carries a room without needing much around it. Small choices in texture and finish can make the same colour feel entirely personal." },
      { type: "quote", text: "Wear the colour in the way that feels most like you." },
    ],
  },
  {
    slug: "a-little-festive-feeling",
    title: "A little festive feeling",
    category: "Occasion Notes",
    contentType: "festival",
    excerpt: "An evergreen note on choosing a special-occasion drape that still feels like your own.",
    image: "blog-model-red-green.jpg",
    video: "blog-film-5.mp4",
    blocks: [
      { type: "paragraph", text: "For a celebration, begin with the feeling you want to carry through the day. A familiar colour, a meaningful detail, or a comfortable silhouette can be a lovely place to start." },
      { type: "paragraph", text: "The occasion may change through the year; your own sense of ease is always a good guide." },
    ],
  },
  {
    slug: "violet-afterglow",
    title: "Violet afterglow",
    category: "Colour Notes",
    contentType: "story",
    excerpt: "A quiet play of colour and drape, captured in a few fleeting frames.",
    image: "blog-model-violet.jpg",
    video: "blog-film-6.mp4",
    blocks: [
      { type: "paragraph", text: "Violet can feel understated or luminous depending on its depth. This little visual note follows its changing character as the light moves." },
    ],
  },
  {
    slug: "inside-the-showroom",
    title: "Inside the showroom",
    category: "From the Atelier",
    contentType: "announcement",
    excerpt: "A glimpse of the sarees, spaces, and small details that inspire our evolving edits.",
    image: "blog-showroom-2.jpg",
    video: "blog-film-7.mp4",
    blocks: [
      { type: "paragraph", text: "Every edit begins with looking closely: at colour, at texture, and at the little details that make a piece feel worth returning to." },
      { type: "paragraph", text: "Come in for a moment and explore the space behind our collection." },
    ],
  },
];

export const seedBlogCatalogue = async ({ dryRun = false } = {}) => {
  if (dryRun) return { dryRun: true, posts: starterStories.length, categories: new Set(starterStories.map((post) => post.category)).size };
  if (!process.env.MONGO_URL) throw new Error("MONGO_URL is missing from the backend environment.");

  await connectDB();
  let inserted = 0;
  for (const [index, story] of starterStories.entries()) {
    const exists = await BlogPost.exists({ slug: story.slug });
    if (exists) continue;
    await BlogPost.create({
      title: story.title,
      slug: story.slug,
      category: story.category,
      contentType: story.contentType,
      excerpt: story.excerpt,
      heroImage: `/blog-media/${story.image}`,
      heroImageAlt: story.title,
      mediaUrl: `/blog-media/${story.video}`,
      mediaType: "video",
      contentBlocks: story.blocks,
      author: "Nishree Attire",
      tags: ["journal", story.category.toLowerCase().replaceAll(" ", "-")],
      status: "published",
      isFeatured: index === 0 || index === 6,
      publishAt: new Date(Date.now() - index * 86_400_000),
    });
    inserted += 1;
  }
  return { dryRun: false, inserted, existing: starterStories.length - inserted };
};

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replaceAll("\\", "/")}`).href) {
  try {
    const result = await seedBlogCatalogue({ dryRun: process.argv.includes("--dry-run") });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Blog seed failed:", error.message);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  }
}
