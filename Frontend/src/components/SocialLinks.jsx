import { useId } from 'react';

const socialPlatforms = [
  {
    label: 'Instagram',
    settingKey: 'instagramUrl',
    Icon: InstagramIcon,
    description: 'Follow us on Instagram',
  },
  {
    label: 'Facebook',
    settingKey: 'facebookUrl',
    Icon: FacebookIcon,
    description: 'Follow us on Facebook',
  },
  {
    label: 'WhatsApp',
    settingKey: 'whatsappUrl',
    Icon: WhatsAppIcon,
    description: 'Chat with us on WhatsApp',
  },
];

const variantClasses = {
  /** Burgundy controls for light backgrounds. */
  default: {
    text: 'text-[#782724]',
    button:
      'border-[#782724]/20 bg-white/75 hover:border-[#782724]/45 hover:bg-[#f8e9e2] hover:shadow-[#782724]/10 focus-visible:ring-[#a95148]',
    label: 'text-stone-600',
  },
  /** High-contrast controls for dark footers and image overlays. */
  light: {
    text: 'text-[#f4d9ba]',
    button:
      'border-[#f4d9ba]/30 bg-white/[0.06] hover:border-[#f4d9ba]/65 hover:bg-white/[0.13] hover:shadow-black/20 focus-visible:ring-[#f4d9ba]',
    label: 'text-white/75',
  },
  /** Champagne-gold controls for burgundy surfaces. */
  gold: {
    text: 'text-[#e8c697]',
    button:
      'border-[#e8c697]/35 bg-[#e8c697]/[0.07] hover:border-[#e8c697]/70 hover:bg-[#e8c697]/[0.15] hover:shadow-black/20 focus-visible:ring-[#e8c697]',
    label: 'text-[#f4d9ba]',
  },
};

const sizeClasses = {
  sm: {
    wrapper: 'gap-1.5',
    button: 'h-8 w-8 rounded-lg',
    icon: 'h-4 w-4',
  },
  md: {
    wrapper: 'gap-2',
    button: 'h-10 w-10 rounded-xl',
    icon: 'h-[1.125rem] w-[1.125rem]',
  },
  lg: {
    wrapper: 'gap-2.5',
    button: 'h-11 w-11 rounded-xl',
    icon: 'h-5 w-5',
  },
};

function InstagramIcon() {
  const gradientId = `instagram-gradient-${useId().replaceAll(':', '')}`;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke={`url(#${gradientId})`}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x1="3" y1="21" x2="21" y2="3" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFC107" />
          <stop offset=".48" stopColor="#F56040" />
          <stop offset="1" stopColor="#C13584" />
        </linearGradient>
      </defs>
      <rect x="3.25" y="3.25" width="17.5" height="17.5" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.65" cy="6.45" r="1" fill="#C13584" stroke="none" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="#1877F2"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M13.45 21v-8.2h2.76l.41-3.2h-3.17V7.56c0-.93.26-1.56 1.6-1.56h1.7V3.14A22.4 22.4 0 0 0 14.28 3c-2.45 0-4.13 1.5-4.13 4.25V9.6H7.38v3.2h2.77V21h3.3Z" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="#25D366"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M20.1 11.7a8.05 8.05 0 0 1-11.9 7.05L3.6 20l1.15-4.35A8.05 8.05 0 1 1 20.1 11.7Z" />
      <path d="M8.15 7.75c.2-.4.42-.44.68-.44h.44c.18 0 .37.06.5.37l.67 1.66c.1.24.08.43-.05.6l-.5.65c-.17.2-.2.4-.07.63.63 1.1 1.42 1.9 2.52 2.53.23.13.43.1.62-.06l.65-.52c.18-.14.37-.16.6-.06l1.68.68c.3.13.37.31.36.49-.02.54-.26 1.06-.65 1.45-.45.46-1.1.68-1.75.6-1.03-.12-2.53-.75-4.1-2.16-1.46-1.32-2.42-2.94-2.7-3.98-.2-.7-.1-1.52.28-2.06.2-.28.45-.55.82-.78Z" />
    </svg>
  );
}

function getSafeHttpsUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;

  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * Responsive, accessible social links for Nishree Creations.
 *
 * Props:
 * - settings: object containing instagramUrl, facebookUrl and whatsappUrl
 * - className: extra classes for the nav wrapper
 * - labelled: show a visible "Follow ..." label
 * - brandName: brand name used in accessible labels
 * - variant: "default" | "light" | "gold"
 * - size: "sm" | "md" | "lg"
 */
export default function SocialLinks({
  settings,
  className = '',
  labelled = false,
  brandName = 'Nishree Creations',
  variant = 'default',
  size = 'md',
}) {
  const theme = variantClasses[variant] ?? variantClasses.default;
  const sizing = sizeClasses[size] ?? sizeClasses.md;

  const links = socialPlatforms
    .map((platform) => ({
      ...platform,
      url: getSafeHttpsUrl(settings?.[platform.settingKey]),
    }))
    .filter((platform) => platform.url);

  if (links.length === 0) return null;

  return (
    <nav
      className={`flex min-w-0 flex-wrap items-center ${sizing.wrapper} ${theme.text} ${className}`.trim()}
      aria-label={`${brandName} social media links`}
    >
      {labelled && (
        <span className={`mr-1 text-xs font-semibold tracking-wide ${theme.label}`}>
          Follow {brandName}
        </span>
      )}

      {links.map(({ label, url, Icon, description }) => (
        <a
          key={label}
          className={`social-brand-link social-brand-${label.toLowerCase()} group relative grid shrink-0 place-items-center border ${sizing.button} ${theme.button} transition-[transform,background-color,border-color,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent motion-reduce:transform-none motion-reduce:transition-none`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${brandName}: ${description}`}
          title={label}
        >
          <span className={`${sizing.icon} transition-transform duration-200 group-hover:scale-110 motion-reduce:transform-none motion-reduce:transition-none`}>
            <Icon />
          </span>
          <span className="sr-only">Opens in a new tab</span>
        </a>
      ))}
    </nav>
  );
}
