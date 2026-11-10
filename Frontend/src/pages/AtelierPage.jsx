import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { homepageApi } from '../api/homepageApi';
import { Reveal } from '../components/Reveal';
import ResponsiveImage from '../components/ResponsiveImage';
import './AtelierPage.css';

const fallbackImage = {
  url: '/homepage-images/showroom.png',
  altText: 'A warm boutique interior with sarees displayed throughout',
};

export default function AtelierPage() {
  const [image, setImage] = useState(fallbackImage);

  useEffect(() => {
    const controller = new AbortController();
    homepageApi.images(controller.signal)
      .then((images) => {
        if (controller.signal.aborted) return;
        const atelierImage = images.find((item) => item.section === 'atelier');
        if (atelierImage) setImage(atelierImage);
      })
      .catch((error) => {
        if (!controller.signal.aborted && error?.code !== 'ERR_CANCELED' && error?.name !== 'AbortError') {
          console.error('Atelier image could not be loaded:', error.message);
        }
      });
    return () => controller.abort();
  }, []);

  return (
    <main className="atelier-page">
      <h1 className="sr-only">Our atelier</h1>
      <section className="atelier-section">
        <div className="atelier-visual">
          <div className="atelier-photo-frame">
            <ResponsiveImage
              src={image.url || fallbackImage.url}
              responsiveKey={image.url || fallbackImage.url}
              alt={image.altText || fallbackImage.altText}
              loading="eager"
              fetchPriority="high"
              decoding="async"
              width="1672"
              height="941"
              sizes="(max-width: 800px) 100vw, 50vw"
              onError={(event) => {
                event.currentTarget.onerror = null;
                event.currentTarget.src = fallbackImage.url;
              }}
            />
            <span className="atelier-image-caption">
              <span>THE NISHREE ATELIER</span>
              <span>A PLACE FOR THE BEAUTIFUL</span>
            </span>
            <div className="atelier-medallion" aria-label="Thoughtfully chosen, beautifully yours">
              <span>N</span>
              <small>CHOSEN<br />WITH CARE</small>
            </div>
          </div>
        </div>

        <Reveal className="atelier-copy">
          <span className="eyebrow">A little more personal</span>
          <h2>Find the one that feels <em>like you.</em></h2>
          <p className="atelier-lead">
            Some sarees simply feel right. Find yours in a space made for taking your time, exploring every detail, and enjoying the moment.
          </p>
          <p className="atelier-description">
            At Nishree, thoughtful edits and a warm welcome make choosing something special feel effortless—from the first look to the final drape.
          </p>
          <div className="atelier-promises" aria-label="The Nishree atelier experience">
            <span><i aria-hidden="true">01</i> Considered collections</span>
            <span><i aria-hidden="true">02</i> A warm, personal welcome</span>
          </div>
          <div className="atelier-actions">
            <Link to="/shop" className="button button-primary">
              Explore the collection
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link to="/contact" className="atelier-contact-link">Get in touch</Link>
          </div>
        </Reveal>
      </section>
    </main>
  );
}
