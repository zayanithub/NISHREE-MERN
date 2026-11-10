import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, Bookmark, CalendarDays, Clock3, Eye, Share2 } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { Link, useParams } from 'react-router-dom';
import { blogApi } from '../api/blogApi';
import { useSavedBlogPosts, readingTime, shareBlogPost } from '../utils/blogExperience';
import { formatDate } from '../utils/format';
import { absoluteSiteUrl, SITE_ORIGIN, useSeoMeta } from '../utils/seo';
import './BlogPostPage.css';

function ContentBlock({ block, index, imageAlt }) {
  if (block.type === 'heading') return <h2 key={index}>{block.text}</h2>;
  if (block.type === 'quote') return <blockquote key={index}>{block.text}</blockquote>;
  if (block.type === 'image') return <figure className="journal-article-media" key={index}><img src={block.url} alt={block.altText || imageAlt} loading="lazy" decoding="async" /><figcaption>{block.altText}</figcaption></figure>;
  if (block.type === 'video') return <figure className="journal-article-media" key={index}><video controls playsInline preload="none" aria-label={block.altText || 'Journal film'}><source src={block.url} type="video/mp4" />Your browser does not support embedded videos.</video><figcaption>{block.altText}</figcaption></figure>;
  if (block.type === 'link') return <p key={index}><a href={block.url} target={block.url.startsWith('http') ? '_blank' : undefined} rel={block.url.startsWith('http') ? 'noopener noreferrer' : undefined}>{block.text || block.url}<ArrowUpRight size={14} aria-hidden="true" /></a></p>;
  return <p key={index}>{block.text}</p>;
}

function RelatedStory({ post }) {
  return <Link to={`/blogs/${post.slug}`} className="journal-related-card"><img src={post.heroImage} alt={post.heroImageAlt || post.title} loading="lazy" decoding="async" /><span><small>{post.category}</small><strong>{post.title}</strong><i>Read story <ArrowRight size={13} aria-hidden="true" /></i></span></Link>;
}

export default function BlogPostPage() {
  const { slug } = useParams();
  const [result, setResult] = useState(null);
  const [loadedKey, setLoadedKey] = useState('');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [savedPosts, toggleSavedPost] = useSavedBlogPosts();
  const reduceMotion = useReducedMotion();
  const requestKey = `${slug}:${retry}`;
  const isLoading = loadedKey !== requestKey;
  const post = result?.post;
  const structuredData = post ? (() => {
    const articleUrl = `${SITE_ORIGIN}/blogs/${encodeURIComponent(post.slug)}`;
    const imageUrl = absoluteSiteUrl(post.heroImage);
    const publishedAt = post.publishAt && Number.isFinite(Date.parse(post.publishAt))
      ? new Date(post.publishAt).toISOString()
      : undefined;
    const modifiedAt = post.updatedAt && Number.isFinite(Date.parse(post.updatedAt))
      ? new Date(post.updatedAt).toISOString()
      : publishedAt;
    const author = post.author
      ? { '@type': 'Person', name: post.author }
      : { '@type': 'Organization', name: 'Nishree Attire' };

    return {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Article',
          headline: post.title,
          ...(post.excerpt ? { description: post.excerpt } : {}),
          ...(imageUrl ? { image: [imageUrl] } : {}),
          ...(publishedAt ? { datePublished: publishedAt } : {}),
          ...(modifiedAt ? { dateModified: modifiedAt } : {}),
          author,
          publisher: {
            '@type': 'Organization',
            name: 'Nishree Attire',
            logo: {
              '@type': 'ImageObject',
              url: `${SITE_ORIGIN}/favicon.svg`,
            },
          },
          mainEntityOfPage: articleUrl,
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_ORIGIN}/` },
            { '@type': 'ListItem', position: 2, name: 'Journal', item: `${SITE_ORIGIN}/blogs` },
            { '@type': 'ListItem', position: 3, name: post.title, item: articleUrl },
          ],
        },
      ],
    };
  })() : undefined;

  useSeoMeta({
    title: post ? `${post.title} | Nishree Attire Journal` : 'Nishree Attire Journal',
    description: post?.excerpt || 'Read stories, guides and inspiration from Nishree Attire.',
    path: `/blogs/${encodeURIComponent(post?.slug || slug)}`,
    image: post?.heroImage || '/homepage-images/saree-flatlay.jpg',
    type: 'article',
    robots: post ? 'index,follow' : 'noindex,follow',
    structuredData,
  });

  useEffect(() => {
    const controller = new AbortController();
    blogApi.post(slug, controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return;
        setResult(response);
        setError('');
        setLoadedKey(requestKey);
      })
      .catch((requestError) => {
        if (controller.signal.aborted || requestError.name === 'CanceledError' || requestError.name === 'AbortError') return;
        setError(requestError.response?.data?.message || 'This story could not be loaded.');
        setLoadedKey(requestKey);
      });
    return () => controller.abort();
  }, [requestKey, slug]);

  if (isLoading) return <main className="journal-detail-page"><div className="journal-detail-state" role="status">Unfolding the story…</div></main>;
  if (error || !post) return <main className="journal-detail-page"><section className="journal-detail-state" role={error ? 'alert' : 'status'}><span className="eyebrow">A page turned</span><h1>{error || 'This story is not available.'}</h1>{error && <button className="button button-outline" type="button" onClick={() => setRetry((value) => value + 1)}>Try again</button>}<Link className="text-link" to="/blogs"><ArrowLeft size={15} /> Back to the journal</Link></section></main>;

  const saved = savedPosts.includes(post.slug);
  const share = () => { void shareBlogPost(post); };
  const toggleSaved = () => toggleSavedPost(post.slug);
  const contentBlocks = Array.isArray(post.contentBlocks) ? post.contentBlocks : [];

  return (
    <main className="journal-detail-page">
      <div className="journal-detail-shell">
        <nav className="journal-breadcrumbs" aria-label="Breadcrumb"><Link to="/blogs"><ArrowLeft size={14} aria-hidden="true" /> Back to stories</Link><span>/</span><span>{post.category}</span></nav>
        <motion.header className="journal-article-heading" initial={reduceMotion ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .5 }}>
          <span className={`journal-type-chip is-${post.contentType}`}>{post.category}</span>
          <h1>{post.title}</h1>
          <p>{post.excerpt}</p>
          <div className="journal-article-meta"><span>By {post.author || 'Nishree Attire'}</span><time dateTime={post.publishAt}>{formatDate(post.publishAt)}</time><span><Clock3 size={13} aria-hidden="true" /> {post.readingMinutes || readingTime(contentBlocks)} min read</span><span><Eye size={14} aria-hidden="true" /> {post.views || 0} reads</span></div>
        </motion.header>

        <figure className="journal-article-cover">
          {post.mediaType === 'video' && post.mediaUrl
            ? <video controls playsInline preload="none" poster={post.heroImage} aria-label={post.title}><source src={post.mediaUrl} type="video/mp4" />Your browser does not support embedded videos.</video>
            : <img src={post.heroImage} alt={post.heroImageAlt || post.title} fetchPriority="high" />}
          <figcaption>{post.heroImageAlt || post.title}</figcaption>
        </figure>

        {(post.contentType === 'event' && (post.eventDate || post.eventLocation)) && <aside className="journal-event-details"><span className="eyebrow">Event details</span>{post.eventDate && <span><CalendarDays size={16} aria-hidden="true" />{formatDate(post.eventDate)}</span>}{post.eventLocation && <span>{post.eventLocation}</span>}{post.eventRegistrationUrl && <a className="button button-primary" href={post.eventRegistrationUrl} target={post.eventRegistrationUrl.startsWith('http') ? '_blank' : undefined} rel={post.eventRegistrationUrl.startsWith('http') ? 'noopener noreferrer' : undefined}>Event details <ArrowUpRight size={15} /></a>}</aside>}
        {post.campaignLabel && <div className="journal-campaign-label"><span className="eyebrow">{post.contentType === 'promotion' || post.contentType === 'campaign' ? 'Campaign' : 'Collection note'}</span><strong>{post.campaignLabel}</strong>{post.expiresAt && <span>Until {formatDate(post.expiresAt)}</span>}</div>}

        <div className="journal-article-layout">
          <article className="journal-article-body">
            {contentBlocks.length ? contentBlocks.map((block, index) => <ContentBlock key={`${block.type}-${index}`} block={block} index={index} imageAlt={post.title} />) : <p>{post.excerpt}</p>}
            {post.ctaLabel && post.ctaUrl && <a className="journal-article-cta button button-primary" href={post.ctaUrl} target={post.ctaUrl.startsWith('http') ? '_blank' : undefined} rel={post.ctaUrl.startsWith('http') ? 'noopener noreferrer' : undefined}>{post.ctaLabel} <ArrowRight size={15} aria-hidden="true" /></a>}
            <div className="journal-article-actions"><button type="button" onClick={toggleSaved} aria-pressed={saved}><Bookmark size={15} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />{saved ? 'Saved for later' : 'Save story'}</button><button type="button" onClick={share}><Share2 size={15} aria-hidden="true" /> Share this story</button></div>
          </article>
          <aside className="journal-article-aside"><span className="eyebrow">A Nishree journal story</span><p>Thoughtful notes on the pieces, people and moments that shape our world.</p><Link to="/blogs">Explore more stories <ArrowUpRight size={14} aria-hidden="true" /></Link></aside>
        </div>

        {(result.previous || result.next) && <nav className="journal-story-nav" aria-label="More journal stories">
          {result.previous ? <Link to={`/blogs/${result.previous.slug}`}><small><ArrowLeft size={13} /> PREVIOUS STORY</small><strong>{result.previous.title}</strong></Link> : <span />}
          {result.next ? <Link to={`/blogs/${result.next.slug}`}><small>NEXT STORY <ArrowRight size={13} /></small><strong>{result.next.title}</strong></Link> : <span />}
        </nav>}

        {result.related?.length > 0 && <section className="journal-related" aria-labelledby="journal-related-heading"><div><span className="eyebrow">Keep exploring</span><h2 id="journal-related-heading">More from <em>{post.category}.</em></h2></div><div className="journal-related-grid">{result.related.map((story) => <RelatedStory key={story.slug} post={story} />)}</div></section>}
      </div>
    </main>
  );
}
