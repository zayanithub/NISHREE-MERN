import { Link, useParams } from 'react-router-dom';
import { useState } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  ChevronDown,
  FileText,
  HeartHandshake,
  LockKeyhole,
  Mail,
  MapPin,
  Phone,
  Printer,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Truck,
} from 'lucide-react';
import { useStoreSettings } from '../settings/useStoreSettings';
import SocialLinks from '../components/SocialLinks';
import contactImage from '../assets/saree shop image.jpg';
import aboutShowroom from '../assets/saree showroom images.png';
import aboutPortrait from '../assets/saree girl image.jpg';
import { contactApi } from '../api/contactApi';
import { normalizeApiError } from '../api/client';
import './PolicyPages.css';

const contactSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name.').max(100),
  email: z.string().trim().email('Enter a valid email address.').max(254),
  subject: z.string().trim().min(3, 'Enter a subject.').max(150),
  message: z.string().trim().min(10, 'Please add a little more detail.').max(3000),
});

const policyTitles = {
  terms: 'Terms and conditions',
  privacy: 'Privacy policy',
  returns: 'Return and refund policy',
  shipping: 'Shipping and delivery policy',
};

const policyPresentation = {
  terms: {
    eyebrow: 'A clear way to shop',
    description: 'The details that help make every Nishree Attire purchase feel considered and straightforward.',
    icon: FileText,
    navDescription: 'Shopping terms',
  },
  privacy: {
    eyebrow: 'Your privacy, respected',
    description: 'Learn how information is handled when you browse, shop, or get in touch with us.',
    icon: LockKeyhole,
    navDescription: 'Your information',
  },
  returns: {
    eyebrow: 'Thoughtful aftercare',
    description: 'Everything you need to know about return requests, refunds, and post-purchase support.',
    icon: RotateCcw,
    navDescription: 'Returns and refunds',
  },
  shipping: {
    eyebrow: 'From our atelier to your door',
    description: 'A helpful guide to order processing, dispatch, and delivery from Nishree Attire.',
    icon: Truck,
    navDescription: 'Shipping and delivery',
  },
};

const policyEmphasisPattern =
  /(\b(?:important|please note|note|email|phone|address|contact|processing time|estimated delivery)\s*:|\b(?:within\s+\d+\s+days?|5–10 business days|1–3 business days|7 days|48 hours)\b)/gi;
const policyEmphasisMatch = new RegExp(policyEmphasisPattern.source, 'i');

function renderPolicyLine(line) {
  return line.split(policyEmphasisPattern).map((part, index) => {
    if (!part) return null;
    return policyEmphasisMatch.test(part)
      ? <strong key={`${part}-${index}`}>{part}</strong>
      : <span key={`${part}-${index}`}>{part}</span>;
  });
}

function PolicyContent({ content }) {
  const blocks = [];
  let paragraph = [];
  let list = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const text = paragraph.join(' ').trim();
    const isLead = text.endsWith(':');
    blocks.push(
      isLead
        ? <p className="store-policy-lead" key={`lead-${blocks.length}`}><strong><em>{renderPolicyLine(text)}</em></strong></p>
        : <p key={`paragraph-${blocks.length}`}>{renderPolicyLine(text)}</p>,
    );
    paragraph = [];
  };

  const flushList = () => {
    if (!list.length) return;
    blocks.push(
      <ul key={`list-${blocks.length}`}>
        {list.map((item, index) => <li key={`${index}-${item}`}>{renderPolicyLine(item)}</li>)}
      </ul>,
    );
    list = [];
  };

  content.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      return;
    }

    const heading = line.match(/^(\d+(?:\.\d+)*)(?:[.)])?\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const depth = heading[1].split('.').length;
      const Heading = depth > 1 ? 'h4' : 'h3';
      blocks.push(
        <Heading className={`store-policy-section-heading${depth > 1 ? ' is-subheading' : ''}`} key={`heading-${blocks.length}`}>
          <span>{heading[1]}</span>
          {heading[2]}
        </Heading>,
      );
      return;
    }

    const bullet = line.match(/^[-•]\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      list.push(bullet[1]);
      return;
    }

    flushList();
    paragraph.push(line);
  });

  flushParagraph();
  flushList();

  return <div className="store-policy-copy">{blocks}</div>;
}

function AmbientPage({ eyebrow, children, className = '' }) {
  return (
    <div className={`ambient-page relative isolate overflow-hidden bg-[#fffaf7] px-4 pb-14 pt-[150px] text-stone-800 sm:px-6 sm:pb-20 sm:pt-[160px] ${className}`}>
      <div className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(circle_at_8%_18%,rgba(126,31,32,0.15),transparent_24%),radial-gradient(circle_at_94%_13%,rgba(238,174,157,0.45),transparent_24%),radial-gradient(circle_at_50%_100%,rgba(204,171,128,0.27),transparent_35%)]" />
      <div className="pointer-events-none absolute -left-24 top-32 -z-10 h-64 w-64 rounded-full bg-[#f2b6a6]/40 blur-3xl motion-safe:animate-pulse" />
      <div className="pointer-events-none absolute -right-28 bottom-6 -z-10 h-72 w-72 rounded-full bg-[#cfb07c]/30 blur-3xl motion-safe:animate-pulse [animation-delay:700ms]" />

      <div className="relative mx-auto max-w-5xl">
        <div className="mb-4 flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-[0.22em] text-[#8b463d]">
          <Sparkles size={14} aria-hidden="true" />
          {eyebrow}
        </div>
        {children}
      </div>
    </div>
  );
}

function PageHeading({ children, description }) {
  return (
    <>
      <h1 className="max-w-3xl text-4xl font-bold leading-[1.08] tracking-tight text-[#571c1a] sm:text-5xl">
        {children}
      </h1>
      {description && <p className="mt-5 max-w-2xl text-base leading-7 text-stone-600 sm:text-lg">{description}</p>}
    </>
  );
}

const primaryButton = 'group inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-[#6f1d1b] via-[#923d34] to-[#bc725c] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#7a2928]/20 transition duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[#7a2928]/30 focus:outline-none focus:ring-4 focus:ring-[#bb6c5c]/30';

export function AboutPage() {
  return (
    <AmbientPage eyebrow="A Nishree story" className="about-editorial-page">
      <section className="about-editorial-hero" aria-label="Nishree Attire">
        <div className="about-editorial-hero-image">
          <img
            src={aboutShowroom}
            alt="Sarees displayed in a warmly lit Nishree showroom"
            width="1242"
            height="1242"
            fetchPriority="high"
          />
          <span>THE NISHREE EDIT · 01</span>
        </div>
        <div className="about-editorial-banner-action">
          <div>
            <span className="about-editorial-kicker">A Nishree story</span>
            <p>Discover a saree for your next special moment.</p>
          </div>
          <Link className={`${primaryButton} about-collection-button`} to="/shop">
            Explore the collection <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <div className="about-editorial-ribbon" aria-label="Our focus"><span>Curated with intention</span><i /><span>Clear by design</span><i /><span>Here when you need us</span></div>

      <section className="about-chapters">
        <header className="about-chapters-heading"><span className="eyebrow">Our point of view</span><h2>Good style should feel<br />personal, not complicated.</h2></header>
        <div className="about-chapter-list">
          <article><span className="about-chapter-number">01</span><div><h3>Start with the feeling</h3><p>Maybe it is a celebration, a gift, or simply a colour you love. Explore the collection by the details that speak to you, and let the occasion be yours.</p></div><Sparkles size={20} /></article>
          <article><span className="about-chapter-number">02</span><div><h3>Know what you are choosing</h3><p>We aim to make the available fabric, fit, care and product details easy to find—so the little questions do not get in the way of choosing.</p></div><ShieldCheck size={20} /></article>
          <article><span className="about-chapter-number">03</span><div><h3>Feel supported after checkout</h3><p>See order updates in your account, check the delivery estimate shown for your PIN code, or contact the team when you need help.</p></div><HeartHandshake size={20} /></article>
        </div>
      </section>

      <section className="about-editorial-image-break">
        <img src={aboutPortrait} alt="A model wearing a richly detailed saree in a festive setting" loading="lazy" decoding="async" width="1184" height="888" />
        <div><span className="eyebrow">A note from Nishree</span><p>“The right drape is the one that lets you feel most like yourself.”</p><Link to="/contact">Tell us what you are looking for <ArrowRight size={15} /></Link></div>
      </section>

      <section className="about-promise-grid">
        <div className="about-promise-intro"><span className="eyebrow">What we stand for</span><h2>Thoughtful at every step.</h2><p>These are the things we keep working to make clearer, kinder and more useful for every customer.</p></div>
        <article><span>OUR AIM</span><Sparkles size={19} /><h3>Curate, don&apos;t overwhelm.</h3><p>Bring together distinctive sarees and the details that help each one find its person.</p></article>
        <article><span>OUR AIM</span><Truck size={19} /><h3>Make delivery clearer.</h3><p>Show estimates as guidance, then confirm the final PIN-code serviceability before dispatch.</p></article>
        <article><span>OUR AIM</span><HeartHandshake size={19} /><h3>Keep care close.</h3><p>Make it straightforward to ask a question, find order updates or reach our team.</p></article>
      </section>

      <section className="about-editorial-cta"><div><span className="eyebrow">Your story starts here</span><h2>Find the piece that feels like you.</h2><p>Browse at your pace. If you need a hand, we are only a message away.</p></div><Link className="about-cta-link" to="/shop">Explore the collection <ArrowRight size={17} /></Link></section>
    </AmbientPage>
  );
}

export function ContactPage() {
  const settings = useStoreSettings();
  const whatsappUrl = settings.whatsappUrl || 'https://wa.me/919344901028/?text=Hi,%20Can%20you%20send%20details%20about%20your%20products';
  const [successMessage, setSuccessMessage] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm({
    resolver: zodResolver(contactSchema),
    defaultValues: { fullName: '', email: '', subject: '', message: '' },
  });

  const submit = async (values) => {
    setSuccessMessage('');
    try {
      const result = await contactApi.sendMessage(values);
      setSuccessMessage(result.message);
      reset();
      toast.success('Your message has been sent.');
    } catch (error) {
      toast.error(normalizeApiError(error).message);
    }
  };

  const contactItems = [
    { label: 'Email', value: settings.supportEmail, href: `mailto:${settings.supportEmail}`, icon: Mail },
    { label: 'Phone', value: settings.supportPhone, href: `tel:${String(settings.supportPhone || '').replace(/[^\d+]/g, '')}`, icon: Phone },
    { label: 'Business address', value: settings.businessAddress, icon: MapPin },
  ];

  return (
    <AmbientPage eyebrow="We would love to hear from you">
      <PageHeading description="For saree enquiries, order questions or support, please get in touch with the team.">
        Contact Nishree Attire<span className="text-[#bf715c]">.</span>
      </PageHeading>

      <div className="contact-layout">
        <form className="contact-form" onSubmit={handleSubmit(submit)} noValidate>
          <div className="contact-form-heading">
            <span className="eyebrow">Send us a note</span>
            <h2>How can we help?</h2>
            <p>Share a little about what you need. Your message will go directly to our store support team.</p>
          </div>
          <div className="contact-form-two-columns">
            <label htmlFor="contact-full-name">Full name<input id="contact-full-name" autoComplete="name" aria-invalid={Boolean(errors.fullName)} aria-describedby={errors.fullName ? 'contact-name-error' : undefined} {...register('fullName')} />{errors.fullName && <span className="field-error" id="contact-name-error">{errors.fullName.message}</span>}</label>
            <label htmlFor="contact-email">Email address<input id="contact-email" type="email" autoComplete="email" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'contact-email-error' : undefined} {...register('email')} />{errors.email && <span className="field-error" id="contact-email-error">{errors.email.message}</span>}</label>
          </div>
          <label htmlFor="contact-subject">Subject<input id="contact-subject" maxLength={150} aria-invalid={Boolean(errors.subject)} aria-describedby={errors.subject ? 'contact-subject-error' : undefined} {...register('subject')} />{errors.subject && <span className="field-error" id="contact-subject-error">{errors.subject.message}</span>}</label>
          <label htmlFor="contact-message">Message<textarea id="contact-message" rows={6} maxLength={3000} aria-invalid={Boolean(errors.message)} aria-describedby={errors.message ? 'contact-message-error' : undefined} {...register('message')} />{errors.message && <span className="field-error" id="contact-message-error">{errors.message.message}</span>}</label>
          {successMessage && <p className="contact-success-message" role="status">{successMessage}</p>}
          <button className={`${primaryButton} contact-submit`} type="submit" disabled={isSubmitting}>
            <span className="relative">{isSubmitting ? 'Sending your message…' : 'Submit message'}</span>
            {!isSubmitting && <ArrowRight className="relative" size={17} aria-hidden="true" />}
          </button>
        </form>

        <aside className="contact-information" aria-label="Nishree support information">
          <div className="contact-editorial-image">
            <img src={contactImage} alt="A glimpse into the Nishree Attire saree collection" loading="lazy" decoding="async" />
            <span>Thoughtfully chosen, beautifully worn.</span>
          </div>
          <div className="contact-information-cards">
            {contactItems.map(({ label, value, href, icon: Icon }) => {
              const content = <><span className="contact-information-icon"><Icon size={18} aria-hidden="true" /></span><span><small>{label}</small><strong>{value || 'Please contact us through WhatsApp.'}</strong></span></>;
              return href && value
                ? <a key={label} className="contact-information-card" href={href}>{content}</a>
                : <div key={label} className="contact-information-card">{content}</div>;
            })}
          </div>
          <div className="contact-social-links">
            <a className="contact-whatsapp-button" href={whatsappUrl} target="_blank" rel="noopener noreferrer">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M20.52 3.48A11.89 11.89 0 0 0 12.06 0C5.48 0 .13 5.34.13 11.92c0 2.1.55 4.16 1.59 5.97L0 24l6.27-1.64a11.9 11.9 0 0 0 5.78 1.47h.01c6.57 0 11.92-5.35 11.92-11.92a11.85 11.85 0 0 0-3.46-8.43ZM12.06 21.8h-.01a9.9 9.9 0 0 1-5.04-1.38l-.36-.21-3.72.97.99-3.63-.23-.37a9.88 9.88 0 1 1 8.37 4.62Zm5.42-7.4c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.76.96-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.08-.79.37-.27.3-1.04 1.02-1.04 2.47s1.07 2.87 1.22 3.07c.15.2 2.1 3.2 5.09 4.49.71.3 1.27.49 1.7.63.72.23 1.37.2 1.88.12.57-.09 1.75-.72 2-1.42.25-.7.25-1.3.17-1.42-.07-.13-.27-.2-.57-.35Z" />
              </svg>
              <span>Enquire on WhatsApp</span>
            </a>
            <SocialLinks className="contact-brand-socials" settings={{ ...settings, whatsappUrl }} labelled />
          </div>
        </aside>
      </div>
    </AmbientPage>
  );
}

const faqs = [
  { question: 'How can I ask about a saree?', answer: <>Open its product page for the listed fabric, colour and description. For a product enquiry or confirmation, message us on <Link to="/contact">WhatsApp</Link>.</> },
  { question: 'Which payment methods are available?', answer: <>Available payment options are shown on the website during checkout. <Link to="/policies/terms">Read the terms and conditions.</Link></> },
  { question: 'What is the return or exchange window?', answer: <>Eligible return requests may be made within 7 days of receiving the product. <Link to="/policies/returns">Read the return and refund policy.</Link></> },
  { question: 'What should I do if my product appears damaged?', answer: <>Contact us within 48 hours of delivery with your order details and supporting photographs or videos. See the <Link to="/policies/returns">return and refund policy</Link> for details.</> },
  { question: 'How do refunds work?', answer: <>Eligible refunds are considered after the returned product is inspected and approved. <Link to="/policies/returns">Read the return and refund policy.</Link></> },
  { question: 'When will my order arrive?', answer: <>Orders are generally processed within 1–3 business days and estimated delivery is 5–10 business days after dispatch. <Link to="/policies/shipping">Read the shipping and delivery policy.</Link></> },
  { question: 'How can I follow an order?', answer: <>Sign in and open <Link to="/account/orders">Your orders</Link> to see the current status recorded by the store.</> },
];

export function FAQPage() {
  return (
    <AmbientPage eyebrow="A few helpful answers">
      <PageHeading>Frequently asked questions<span className="text-[#bf715c]">.</span></PageHeading>
      <div className="mt-10 grid gap-3">
        {faqs.map(({ question, answer }) => (
            <details key={question} className="group rounded-2xl border border-[#ead9c6] bg-white/80 px-5 shadow-[0_10px_30px_rgba(94,34,31,0.06)] transition duration-300 open:border-[#c28c76] open:shadow-[0_16px_36px_rgba(94,34,31,0.12)] sm:px-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-base font-semibold text-[#67221f] marker:content-none">
                {question}
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#fae7de] text-[#7a2928] transition duration-300 group-open:rotate-180 group-open:bg-[#7a2928] group-open:text-white"><ChevronDown size={18} aria-hidden="true" /></span>
              </summary>
              <p className="border-t border-[#f0e2d4] pb-5 pt-4 text-sm leading-7 text-stone-600 [&_a]:font-semibold [&_a]:text-[#7a2928] [&_a]:underline [&_a]:decoration-[#d7a28e] [&_a]:underline-offset-4">{answer}</p>
            </details>
        ))}
      </div>
    </AmbientPage>
  );
}

export function PoliciesPage() {
  const { section = 'terms' } = useParams();
  const settings = useStoreSettings();
  const sectionAliases = { cod: 'terms', refunds: 'returns', damaged: 'returns' };
  const requestedKey = sectionAliases[section] || section;
  const publishedPolicies = Object.entries(policyTitles).filter(([key]) => (
    settings.policies?.[key]?.isPublished && settings.policies[key].content.trim()
  ));
  const selectedKey = publishedPolicies.some(([key]) => key === requestedKey)
    ? requestedKey
    : publishedPolicies[0]?.[0] || 'terms';
  const selected = {
    title: policyTitles[selectedKey],
    content: settings.policies?.[selectedKey]?.content || '',
  };
  const presentation = policyPresentation[selectedKey] || policyPresentation.terms;
  const PolicyIcon = presentation.icon;
  const selectedIndex = Object.keys(policyTitles).indexOf(selectedKey);

  return (
    <AmbientPage eyebrow="The details, made clear" className="store-policies-page">
      <header className="store-policy-heading">
        <div className="store-policy-heading-copy">
          <span className="store-policy-overline">
            <span className="store-policy-overline-mark"><Sparkles size={13} aria-hidden="true" /></span>
            CUSTOMER CARE <i /> POLICY {String(selectedIndex + 1).padStart(2, '0')} / {String(Object.keys(policyTitles).length).padStart(2, '0')}
          </span>
          <p className="store-policy-kicker">{presentation.eyebrow}</p>
          <h1>{selected.title}<span>.</span></h1>
          <p className="store-policy-description">{presentation.description}</p>
        </div>
        <div className="store-policy-seal">
          <span className="store-policy-seal-icon"><PolicyIcon size={20} aria-hidden="true" /></span>
          <span>Made clear,<br />with care</span>
        </div>
      </header>

      <div className="store-policies-layout">
        <nav className="store-policy-nav" aria-label="Policy pages">
          <div className="store-policy-nav-heading">
            <span className="store-policy-nav-title">Your guide</span>
            <span className="store-policy-nav-count">{publishedPolicies.length} topics</span>
          </div>
          {publishedPolicies.map(([key, title]) => {
            const active = key === selectedKey;
            const ItemIcon = policyPresentation[key]?.icon || FileText;
            return (
              <Link
                key={key}
                aria-current={active ? 'page' : undefined}
                to={`/policies/${key}`}
                className={`store-policy-nav-link${active ? ' is-active' : ''}`}
              >
                <span className="store-policy-nav-icon"><ItemIcon size={16} aria-hidden="true" /></span>
                <span className="store-policy-nav-copy">
                  <strong>{title}</strong>
                  <small>{policyPresentation[key]?.navDescription}</small>
                </span>
                <ArrowUpRight size={15} aria-hidden="true" />
              </Link>
            );
          })}
          {!publishedPolicies.length && <p className="store-policy-empty">Policies are being prepared. Please contact us if you need help.</p>}
          <div className="store-policy-nav-note">
            <BadgeCheck size={16} aria-hidden="true" />
            <span>Clear information, whenever you need it.</span>
          </div>
        </nav>
        <article className="store-policy-sheet" aria-labelledby="store-policy-document-title">
          <header>
            <span className="store-policy-category"><PolicyIcon size={15} aria-hidden="true" /> NISHREE ATTIRE <i /> POLICY DOCUMENT</span>
            <button type="button" className="store-policy-print" onClick={() => window.print()}><Printer size={15} /> Print policy</button>
          </header>
          <div className="store-policy-sheet-body">
            <div className="store-policy-document-heading">
              <span className="store-policy-document-index">{String(selectedIndex + 1).padStart(2, '0')}</span>
              <div>
                <span className="store-policy-document-label">{presentation.eyebrow}</span>
                <h2 id="store-policy-document-title">{selected.title}</h2>
              </div>
            </div>
            <PolicyContent content={selected.content || 'This policy has not been published yet. Please contact the store for assistance.'} />
            {selectedKey === 'shipping' && <p className="store-policy-help">Questions? <Link to="/contact">Contact the store</Link>.</p>}
          </div>
          <footer>
            <span className="store-policy-footer-prompt"><HeartHandshake size={16} aria-hidden="true" /> Need a little help?</span>
            <Link to="/contact">Talk to our team <ArrowRight size={14} /></Link>
          </footer>
        </article>
      </div>
      <p className="store-policy-whatsapp">
        Need help with a request? <Link to="/contact">Contact Nishree Attire</Link>
        {settings.whatsappUrl && <> or <a href={settings.whatsappUrl} target="_blank" rel="noopener noreferrer">message us on WhatsApp</a></>}.
      </p>
    </AmbientPage>
  );
}
