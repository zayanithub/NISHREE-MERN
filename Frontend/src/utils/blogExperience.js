import { useState } from 'react';
import { toast } from 'sonner';

const STORAGE_KEY = 'nishree-journal-bookmarks';

const readBookmarks = () => {
  if (typeof window === 'undefined') return [];
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(stored) ? stored.filter((slug) => typeof slug === 'string') : [];
  } catch (error) {
    console.error('Saved journal stories could not be read:', error);
    toast.error('Saved stories are unavailable in this browser.');
    return [];
  }
};

export function useSavedBlogPosts() {
  const [savedPosts, setSavedPosts] = useState(readBookmarks);
  const toggleSavedPost = (slug) => {
    const next = savedPosts.includes(slug)
      ? savedPosts.filter((savedSlug) => savedSlug !== slug)
      : [...savedPosts, slug];
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setSavedPosts(next);
      toast.success(savedPosts.includes(slug) ? 'Removed from your saved stories.' : 'Saved for another time.');
    } catch (error) {
      console.error('Journal bookmark could not be saved:', error);
      toast.error('This story could not be saved in this browser.');
    }
  };
  return [savedPosts, toggleSavedPost];
}

export const readingTime = (blocks = []) => {
  const wordCount = blocks.reduce((total, block) => total + String(block.text || '').trim().split(/\s+/).filter(Boolean).length, 0);
  return Math.max(1, Math.ceil(wordCount / 220));
};

export const shareBlogPost = async (post) => {
  const shareData = { title: post.title, text: post.excerpt || post.title, url: window.location.href };
  if (navigator.share) {
    try {
      await navigator.share(shareData);
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Story could not be shared:', error);
        toast.error('This story could not be shared right now.');
      }
    }
    return;
  }
  if (!navigator.clipboard?.writeText) {
    toast.error('Link sharing is not available in this browser.');
    return;
  }
  try {
    await navigator.clipboard.writeText(shareData.url);
    toast.success('Story link copied.');
  } catch (error) {
    console.error('Story link could not be copied:', error);
    toast.error('Story link could not be copied.');
  }
};
