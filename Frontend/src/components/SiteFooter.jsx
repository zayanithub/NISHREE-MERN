import { ArrowUpRight, Mail, MapPin, Phone, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import logo from '../assets/Nishree Attire Navbar Logo.png';
import { useStoreSettings } from '../settings/useStoreSettings';
import ResponsiveImage from './ResponsiveImage';
import SocialLinks from './SocialLinks';

const exploreLinks = [
  ['The collection', '/shop'],
  ['New arrivals', '/shop?sort=newest'],
  ['About us', '/about'],
  ['Contact us', '/contact'],
];

const policyLinks = [
  ['Terms and conditions', '/policies/terms'],
  ['Privacy policy', '/policies/privacy'],
  ['Returns and refunds', '/policies/returns'],
  ['Shipping and delivery', '/policies/shipping'],
];

function FooterLinks({ title, links }) {
  return (
    <nav aria-label={title}>
      <h2 className="mb-5 flex items-center gap-2 text-[0.68rem] font-bold uppercase tracking-[0.22em] text-[#e8c697]">
        <span className="h-px w-5 bg-[#c69a67]/80" aria-hidden="true" />
        {title}
      </h2>
      <ul className="grid gap-3">
        {links.map(([label, to]) => (
          <li key={`${label}-${to}`}>
            <Link
              className="group/link inline-flex items-center gap-2 text-sm text-white/65 outline-none transition duration-300 hover:translate-x-1 hover:text-[#f5c6ad] focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-[#f5c6ad]/70 motion-reduce:transition-none"
              to={to}
            >
              <span className="h-px w-0 bg-[#e8c697] transition-all duration-300 group-hover/link:w-3 group-focus-visible/link:w-3 motion-reduce:transition-none" aria-hidden="true" />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default function SiteFooter() {
  const settings = useStoreSettings();
  const currentYear = new Date().getFullYear();
  const supportEmail = settings.supportEmail || '';
  const supportPhone = settings.supportPhone || '';
  const whatsappNumber = String(settings.whatsappNumber || '').replace(/[^0-9]/g, '');
  const businessAddress = settings.businessAddress || '';

  return (
    <footer className="relative isolate overflow-hidden bg-[#160706] text-white">
      {/* Warm ambient lighting and fine decorative details */}
      <div
        className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(ellipse_at_8%_0%,rgba(190,126,75,0.18),transparent_32%),radial-gradient(ellipse_at_92%_72%,rgba(133,39,36,0.22),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.025),transparent_45%)]"
        aria-hidden="true"
      />
      <div className="pointer-events-none absolute -right-24 top-20 -z-10 h-72 w-72 rounded-full bg-[#d9b47b]/10 blur-3xl motion-safe:animate-pulse" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-32 left-[28%] -z-10 h-80 w-80 rounded-full bg-[#eaa58f]/10 blur-3xl motion-safe:animate-pulse [animation-delay:900ms]" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#d7b17d]/80 to-transparent" aria-hidden="true" />

      <div className="relative mx-auto max-w-7xl px-5 pb-6 pt-12 sm:px-8 sm:pt-14 lg:px-10 lg:pt-16">
        {/* Collection callout */}
        <div className="mb-12 flex flex-col gap-5 rounded-2xl border border-[#d9b47b]/20 bg-white/[0.035] p-5 shadow-[0_18px_55px_rgba(0,0,0,0.12)] backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between sm:p-7 lg:mb-14 lg:px-9">
          <div className="flex items-start gap-4">
            <span className="mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#d9b47b]/25 bg-[#d9b47b]/10 text-[#f0c99a]">
              <Sparkles size={19} aria-hidden="true" />
            </span>
            <div>
              <p className="text-[0.62rem] font-bold uppercase tracking-[0.24em] text-[#e8c697]">Made for your moments</p>
              <h2 className="mt-1.5 font-serif text-2xl leading-tight text-[#fff2e5] sm:text-3xl">Find the piece that feels like you.</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-white/60">Timeless silhouettes, thoughtful details, and beauty woven into every occasion.</p>
            </div>
          </div>
          <Link
            className="group inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl border border-[#e5c18d]/60 bg-gradient-to-r from-[#d8b27d] to-[#efd5ad] px-5 py-3 text-sm font-bold text-[#351713] shadow-lg shadow-black/10 transition duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/20 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#f5c6ad]/40 motion-reduce:transition-none"
            to="/shop"
          >
            Explore the collection
            <ArrowUpRight className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transition-none" size={17} aria-hidden="true" />
          </Link>
        </div>

        <div className="grid gap-10 border-b border-white/10 pb-10 sm:grid-cols-2 sm:gap-x-8 sm:gap-y-12 lg:grid-cols-[1.35fr_0.8fr_0.9fr_1.1fr] lg:gap-10 lg:pb-12">
          <section className="max-w-sm">
            <Link
              className="group inline-flex items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#f5c6ad]/70"
              to="/"
              aria-label="Nishree Attire home"
            >
              <span className="relative grid h-[4.25rem] w-[4.25rem] shrink-0 place-items-center overflow-hidden rounded-2xl border border-[#e8c697]/40 bg-transparent p-1 shadow-[0_8px_24px_rgba(0,0,0,0.25)] transition duration-300 group-hover:-translate-y-0.5 group-hover:rotate-2 group-hover:border-[#f5c6ad]/80 motion-reduce:transition-none">
                <ResponsiveImage pictureClassName="block h-full w-full" className="footer-brand-mark h-full w-full object-contain" src={logo} responsiveKey="/assets/Nishree Attire Navbar Logo.png" alt="" loading="lazy" decoding="async" width="84" height="68" sizes="68px" />
              </span>
              <span>
                <span className="block font-serif text-xl tracking-wide text-[#fff0dd]">Nishree Attire</span>
                <span className="mt-1 block text-[0.6rem] font-bold uppercase tracking-[0.24em] text-[#d9b47b]">Elegance in every thread</span>
              </span>
            </Link>

            <p className="mt-5 max-w-xs text-sm leading-7 text-white/65">
              A considered collection for the celebrations, traditions, and little moments that stay with you.
            </p>
            <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#e8c697]/20 bg-[#e8c697]/[0.06] px-3 py-2 text-xs font-medium text-[#f0c3a9]">
              <Sparkles size={14} aria-hidden="true" /> Curated with care, for you.
            </p>
          </section>

          <FooterLinks title="Explore" links={exploreLinks} />
          <FooterLinks title="Policies" links={policyLinks} />

          <section>
            <h2 className="mb-5 flex items-center gap-2 text-[0.68rem] font-bold uppercase tracking-[0.22em] text-[#e8c697]">
              <span className="h-px w-5 bg-[#c69a67]/80" aria-hidden="true" />
              Get in touch
            </h2>
            <div className="grid gap-4 text-sm">
              {supportEmail && (
                <a
                  className="group/contact flex min-w-0 items-start gap-3 rounded-xl outline-none transition duration-200 hover:text-[#f5c6ad] focus-visible:ring-2 focus-visible:ring-[#f5c6ad]/70 motion-reduce:transition-none"
                  href={`mailto:${supportEmail}`}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[#e8c697]/20 bg-[#e8c697]/[0.07] text-[#e8c697] transition group-hover/contact:border-[#e8c697]/50 group-hover/contact:bg-[#e8c697]/[0.13]">
                    <Mail size={16} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 pt-1.5">
                    <span className="mb-1 block text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-white/40">Email us</span>
                    <span className="break-all text-white/75">{supportEmail}</span>
                  </span>
                </a>
              )}
              {supportPhone && (
                <a
                  className="group/contact flex min-w-0 items-start gap-3 rounded-xl outline-none transition duration-200 hover:text-[#f5c6ad] focus-visible:ring-2 focus-visible:ring-[#f5c6ad]/70 motion-reduce:transition-none"
                  href={whatsappNumber ? `tel:+${whatsappNumber}` : `tel:${supportPhone}`}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[#e8c697]/20 bg-[#e8c697]/[0.07] text-[#e8c697] transition group-hover/contact:border-[#e8c697]/50 group-hover/contact:bg-[#e8c697]/[0.13]">
                    <Phone size={16} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 pt-1.5">
                    <span className="mb-1 block text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-white/40">Call us</span>
                    <span className="text-white/75">{supportPhone}</span>
                  </span>
                </a>
              )}
              {businessAddress && (
                <div className="flex min-w-0 items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[#e8c697]/20 bg-[#e8c697]/[0.07] text-[#e8c697]">
                    <MapPin size={16} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 pt-1.5">
                    <span className="mb-1 block text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-white/40">Visit us</span>
                    <span className="block leading-6 text-white/75">{businessAddress}</span>
                  </span>
                </div>
              )}
            </div>
            <div className="mt-6 border-t border-white/10 pt-5 text-[#f4d9ba]">
              <SocialLinks settings={settings} />
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-4 pt-5 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between sm:gap-5 sm:pt-6">
          <span>© {currentYear} Nishree Attire. All rights reserved.</span>
          <span className="text-white/40">Made for the moments you keep.</span>
          <Link
            className="group inline-flex w-fit items-center gap-1.5 rounded-sm font-semibold text-[#f0c3a9] outline-none transition duration-200 hover:text-white focus-visible:ring-2 focus-visible:ring-[#f5c6ad]/70 motion-reduce:transition-none"
            to="/shop"
          >
            Discover the collection
            <ArrowUpRight className="transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transition-none" size={14} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </footer>
  );
}
