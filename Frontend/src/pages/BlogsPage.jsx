import { useEffect, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, Bookmark, CalendarDays, Clock3, Eye, Search, Sparkles } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { Link, useSearchParams } from 'react-router-dom';
import { blogApi } from '../api/blogApi';
import NewsletterSection from '../components/home/NewsletterSection';
import { formatDate } from '../utils/format';
import { useSavedBlogPosts, readingTime } from '../utils/blogExperience';
import { useSeoMeta } from '../utils/seo';
import './BlogsPage.css';

function SearchForm({ initialValue, onSearch }) {
  const [value, setValue] = useState(initialValue);
  return (
    <form className="journal-search" role="search" onSubmit={(event) => { event.preventDefault(); onSearch(value.trim()); }}>
      <Search size={16} aria-hidden="true" />
      <label className="sr-only" htmlFor="journal-search-input">Search stories</label>
      <input id="journal-search-input" type="search" value={value} onChange={(event) => setValue(event.target.value)} placeholder="Search stories, ideas and collections" />
      {value && <button type="button" className="journal-search-clear" onClick={() => { setValue(''); onSearch(''); }}>Clear</button>}
      <button type="submit" className="journal-search-submit" aria-label="Search stories"><ArrowRight size={16} aria-hidden="true" /></button>
    </form>
  );
}

function SaveButton({ post, saved, onToggle, compact = false }) {
  return (
    <button className={`journal-save${compact ? ' is-compact' : ''}${saved ? ' is-saved' : ''}`} type="button" onClick={() => onToggle(post)} aria-pressed={saved} aria-label={`${saved ? 'Remove' : 'Save'} ${post.title}${saved ? ' from' : ' to'} saved stories`}>
      <Bookmark size={15} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />
      {!compact && <span>{saved ? 'Saved' : 'Save story'}</span>}
    </button>
  );
}

function StoryCard({ post, index, saved, onToggle, reduceMotion }) {
  const readMinutes = post.readingMinutes || readingTime(post.contentBlocks);
  return (
    <motion.article className="journal-card" initial={reduceMotion ? false : { opacity: 0, y: 18 }} whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.14 }} transition={{ duration: 0.46, delay: (index % 3) * 0.055 }}>
      <Link to={`/blogs/${post.slug}`} className="journal-card-image" aria-label={`Read ${post.title}`}>
        <img src={post.heroImage} alt={post.heroImageAlt || post.title} loading="lazy" decoding="async" />
        <span className={`journal-type-chip is-${post.contentType}`}>{post.category}</span>
        {post.mediaType === 'video' && <span className="journal-play-mark" aria-label="Video story"><span /></span>}
        <span className="journal-card-arrow"><ArrowUpRight size={17} aria-hidden="true" /></span>
      </Link>
      <div className="journal-card-copy">
        <div className="journal-card-meta"><time dateTime={post.publishAt}>{formatDate(post.publishAt)}</time><span><Clock3 size={12} aria-hidden="true" /> {readMinutes} min read</span></div>
        <Link to={`/blogs/${post.slug}`} className="journal-card-title"><h3>{post.title}</h3></Link>
        <p>{post.excerpt}</p>
        <div className="journal-card-bottom"><Link to={`/blogs/${post.slug}`} className="journal-read-link">Read story <ArrowRight size={14} aria-hidden="true" /></Link><SaveButton post={post} saved={saved} onToggle={onToggle} compact /></div>
      </div>
    </motion.article>
  );
}

function StoryGrid({ posts, savedPosts, onToggle, reduceMotion, className = '' }) {
  return <div className={`journal-card-grid ${className}`}>{posts.map((post, index) => <StoryCard key={post._id || post.slug} post={post} index={index} saved={savedPosts.includes(post.slug)} onToggle={onToggle} reduceMotion={reduceMotion} />)}</div>;
}

function JournalSkeleton() {
  return <div className="journal-card-grid" aria-label="Loading journal posts">{Array.from({ length: 6 }, (_, index) => <div className="journal-skeleton" key={index}><span /><i /><i /></div>)}</div>;
}

export default function BlogsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState(null);
  const [loadedKey, setLoadedKey] = useState('');
  const [error, setError] = useState('');
  const [savedPosts, toggleSavedPost] = useSavedBlogPosts();
  const reduceMotion = useReducedMotion();
  const category = searchParams.get('category') || 'all';
  const search = searchParams.get('q') || '';
  const sort = searchParams.get('sort') || 'latest';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const requestKey = JSON.stringify({ category, search, sort, page, retry });
  const isLoading = loadedKey !== requestKey;

  useEffect(() => {
    const controller = new AbortController();
    blogApi.posts({ category, search, sort, page, limit: 9 }, controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return;
        setResult(response);
        setError('');
        setLoadedKey(requestKey);
      })
      .catch((requestError) => {
        if (controller.signal.aborted || requestError.name === 'CanceledError' || requestError.name === 'AbortError') return;
        setError(requestError.response?.data?.message || 'The journal could not be reached. Please try again.');
        setLoadedKey(requestKey);
      });
    return () => controller.abort();
  }, [category, page, requestKey, retry, search, sort]);

  useSeoMeta({
    title: 'Saree Stories, Guides & Journal | Nishree Attire',
    description: 'Read the Nishree Attire journal for saree guides, styling ideas, stories of craft and inspiration for special occasions.',
    path: '/blogs',
    robots: searchParams.toString() ? 'noindex,follow' : 'index,follow',
  });

  const updateQuery = (changes) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([key, value]) => {
      if (value && value !== 'all') next.set(key, String(value));
      else next.delete(key);
    });
    next.delete('page');
    setSearchParams(next);
  };
  const toggleSaved = (post) => toggleSavedPost(post.slug);
  const posts = result?.posts || [];
  const isDefaultView = !search && category === 'all' && page === 1;
  const hero = isLoading || !isDefaultView ? null : result?.featured?.[0] || posts[0] || null;
  const otherFeatured = (result?.featured || []).filter((post) => post.slug !== hero?.slug);
  const highlightedSlugs = new Set([hero?.slug, ...otherFeatured.map((post) => post.slug)].filter(Boolean));
  const listPosts = posts.filter((post) => !highlightedSlugs.has(post.slug));
  const saveStory = (post) => void toggleSaved(post);

  return (
    <div className="journal-page">
      <div className="journal-container">
        <header className="journal-masthead">
          <div className="journal-masthead-copy">
            <span className="eyebrow"><Sparkles size={13} aria-hidden="true" /> THE NISHREE JOURNAL</span>
            <h1>Stories that stay<br /><em>with you.</em></h1>
            <p>Thoughtful notes on the drape, the detail and all the moments in between.</p>
            <a href="#journal-explore" className="journal-hero-link">Find a story to settle into <ArrowDown size={15} aria-hidden="true" /></a>
          </div>
          <aside className="journal-masthead-note" aria-label="About the Nishree journal">
            <span className="journal-masthead-rule" />
            <span className="eyebrow">A LIVING COLLECTION OF IDEAS</span>
            <p>From the hand behind a weave to the feeling of finding your own style.</p>
            <div className="journal-masthead-count">
              <strong>{result ? String(result.pagination?.total || 0).padStart(2, '0') : '—'}</strong>
              <span>stories to explore</span>
            </div>
            {result?.categories?.length > 0 && <div className="journal-masthead-categories" aria-label="Journal topics">{result.categories.slice(0, 3).map((name) => <span key={name}>{name}</span>)}</div>}
          </aside>
        </header>

        {isDefaultView && (
          <section className="journal-featured" aria-label="Featured journal story">
            <div className="journal-featured-heading"><span>THE JOURNAL · A STORY TO BEGIN WITH</span><span>01 / FEATURED</span></div>
            {hero ? (
              <motion.article className="journal-cover-story" initial={reduceMotion ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .55, ease: [0.22, 1, 0.36, 1] }}>
                <Link to={`/blogs/${hero.slug}`} className="journal-cover-image" aria-label={`Read featured story: ${hero.title}`}>
                  <img src={hero.heroImage} alt={hero.heroImageAlt || hero.title} fetchPriority="high" />
                  {hero.mediaType === 'video' && <span className="journal-play-mark" aria-label="Video story"><span /></span>}
                </Link>
                <SaveButton post={hero} saved={savedPosts.includes(hero.slug)} onToggle={saveStory} />
                <div className="journal-cover-content">
                  <div className="journal-cover-meta"><span className={`journal-type-chip is-${hero.contentType}`}>{hero.category}</span><time dateTime={hero.publishAt}>{formatDate(hero.publishAt)}</time><span><Clock3 size={13} aria-hidden="true" /> {hero.readingMinutes || readingTime(hero.contentBlocks)} min read</span></div>
                  <h2>{hero.title}</h2>
                  <p>{hero.excerpt}</p>
                  <Link to={`/blogs/${hero.slug}`} className="journal-cover-link">Read the story <ArrowRight size={15} aria-hidden="true" /></Link>
                </div>
              </motion.article>
            ) : isLoading ? <div className="journal-featured-loading" role="status">Finding a story for you…</div> : (
              <div className="journal-featured-empty"><Sparkles size={22} aria-hidden="true" /><p>{error ? 'The journal is taking a brief pause.' : 'A new story will find its way here soon.'}</p></div>
            )}
          </section>
        )}
      </div>

      <section className="journal-discovery" id="journal-explore">
        <div className="journal-container">
          <header className="journal-discovery-heading">
            <div><span className="eyebrow">{search ? 'A new way through the journal' : category === 'all' ? 'Browse at your own pace' : 'A closer look'}</span><h2>{search ? 'Your search.' : category === 'all' ? <>Find your next <em>read.</em></> : <>Stories about <em>{category}.</em></>}</h2></div>
            <span>{result?.pagination?.total ?? 0} STORIES IN THIS VIEW</span>
          </header>
          <div className="journal-tools">
            <nav className="journal-category-nav" aria-label="Filter journal by category">
              <button type="button" className={category === 'all' ? 'is-active' : ''} aria-pressed={category === 'all'} onClick={() => updateQuery({ category: 'all' })}>Everything</button>
              {(result?.categories || []).map((name) => <button type="button" key={name} className={category === name ? 'is-active' : ''} aria-pressed={category === name} onClick={() => updateQuery({ category: name })}>{name}</button>)}
            </nav>
            <div className="journal-search-sort"><SearchForm key={search} initialValue={search} onSearch={(value) => updateQuery({ q: value })} /><label className="journal-sort">Sort <select value={sort} onChange={(event) => updateQuery({ sort: event.target.value })}><option value="latest">Latest</option><option value="popular">Popular</option><option value="featured">Featured</option></select></label></div>
          </div>

          {isDefaultView && otherFeatured.length > 0 && (
            <section className="journal-featured-strip" aria-labelledby="journal-featured-title">
              <div className="journal-mini-heading"><span id="journal-featured-title">Another point of view</span><span>MORE TO EXPLORE</span></div>
              <StoryGrid posts={otherFeatured} savedPosts={savedPosts} onToggle={saveStory} reduceMotion={reduceMotion} />
            </section>
          )}

          {!search && category === 'all' && result?.campaigns?.length > 0 && (
            <section className="journal-content-band journal-campaign-band" aria-labelledby="journal-campaign-heading">
              <div className="journal-band-heading"><div><span className="eyebrow">A timely note from our journal</span><h2 id="journal-campaign-heading">In this <em>moment.</em></h2></div><span>CAMPAIGNS & COLLECTION NOTES</span></div>
              <StoryGrid posts={result.campaigns} savedPosts={savedPosts} onToggle={saveStory} reduceMotion={reduceMotion} />
            </section>
          )}

          {!search && category === 'all' && result?.productHighlights?.length > 0 && (
            <section className="journal-content-band journal-product-band" aria-labelledby="journal-product-heading">
              <div className="journal-band-heading"><div><span className="eyebrow">Meet the pieces</span><h2 id="journal-product-heading">Details worth <em>discovering.</em></h2></div><span>PRODUCT NOTES & NEW EDITS</span></div>
              <StoryGrid posts={result.productHighlights} savedPosts={savedPosts} onToggle={saveStory} reduceMotion={reduceMotion} />
            </section>
          )}

          {!search && category === 'all' && result?.upcomingEvents?.length > 0 && (
            <section className="journal-events" aria-labelledby="journal-events-heading">
              <div className="journal-mini-heading"><span id="journal-events-heading">On the horizon</span><span>UPCOMING MOMENTS</span></div>
              <div className="journal-event-grid">{result.upcomingEvents.map((event) => <Link className="journal-event-card" to={`/blogs/${event.slug}`} key={event.slug}><span className="journal-event-date"><CalendarDays size={16} aria-hidden="true" />{formatDate(event.eventDate)}</span><strong>{event.title}</strong><span>{event.eventLocation || event.excerpt}</span><ArrowUpRight size={16} aria-hidden="true" /></Link>)}</div>
            </section>
          )}

          <section className="journal-latest" aria-labelledby="journal-latest-heading">
            <div className="journal-list-heading"><div><span className="eyebrow">{search ? 'Your search results' : category === 'all' ? 'From the journal' : category}</span><h2 id="journal-latest-heading">{search ? `Stories for “${search}”` : category === 'all' ? 'The latest stories' : `Explore ${category}`}</h2></div><span>{result?.pagination?.total ?? 0} STORIES</span></div>
            {isLoading ? <JournalSkeleton /> : error ? (
              <div className="journal-state journal-error" role="alert"><span className="eyebrow">A momentary pause</span><h3>The journal is taking a breather.</h3><p>{error}</p><button className="button button-outline" type="button" onClick={() => setRetry((value) => value + 1)}>Try again</button></div>
            ) : listPosts.length ? (
              <>
                <StoryGrid posts={listPosts} savedPosts={savedPosts} onToggle={saveStory} reduceMotion={reduceMotion} />
                {result.pagination.totalPages > 1 && <nav className="journal-pagination" aria-label="Journal pages"><button type="button" className="button button-quiet" onClick={() => setSearchParams((current) => { const next = new URLSearchParams(current); if (page <= 2) next.delete('page'); else next.set('page', String(page - 1)); return next; })} disabled={page <= 1}><ArrowLeft size={15} /> Previous</button><span>Page {result.pagination.page} of {result.pagination.totalPages}</span><button type="button" className="button button-quiet" onClick={() => setSearchParams((current) => { const next = new URLSearchParams(current); next.set('page', String(page + 1)); return next; })} disabled={page >= result.pagination.totalPages}>Next <ArrowRight size={15} /></button></nav>}
              </>
            ) : <div className="journal-state"><span className="eyebrow">A fresh page</span><h3>No stories in this edit just yet.</h3><p>Try a different search or category. We’re always gathering something new.</p><button type="button" className="button button-outline" onClick={() => setSearchParams({})}>Explore all stories</button></div>}
          </section>

          {!search && category === 'all' && result?.trending?.length > 0 && (
            <section className="journal-trending" aria-labelledby="journal-trending-heading">
              <div className="journal-mini-heading"><span id="journal-trending-heading"><Eye size={14} aria-hidden="true" /> Readers are exploring</span><span>TRENDING NOW</span></div>
              <div className="journal-trending-list">{result.trending.map((post, index) => <Link to={`/blogs/${post.slug}`} className="journal-trending-item" key={post.slug}><span>{String(index + 1).padStart(2, '0')}</span><img src={post.heroImage} alt="" loading="lazy" /><div><small>{post.category}</small><strong>{post.title}</strong></div><ArrowUpRight size={16} aria-hidden="true" /></Link>)}</div>
            </section>
          )}
        </div>
      </section>

      <div className="journal-newsletter"><NewsletterSection /></div>
    </div>
  );
}
