import { useState } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { ArrowRight, Mail, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { normalizeApiError } from '../../api/client';
import { newsletterApi } from '../../api/newsletterApi';
import './NewsletterSection.css';

const newsletterSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.').max(254),
  consent: z.literal(true, { error: 'Please consent to receive email updates.' }),
});

export default function NewsletterSection() {
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(newsletterSchema),
    defaultValues: { email: '', consent: false },
  });

  const subscribe = async (values) => {
    setSubmitting(true);
    try {
      const result = await newsletterApi.subscribe({ email: values.email, consent: values.consent });
      toast.success(result.message || 'You are subscribed to Nishree Attire updates.');
      reset();
    } catch (error) {
      toast.error(normalizeApiError(error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="nishree-newsletter" aria-labelledby="nishree-newsletter-title">
      <div className="nishree-newsletter-inner">
        <div className="nishree-newsletter-copy">
          <span className="nishree-newsletter-mark" aria-hidden="true"><Mail size={19} strokeWidth={1.35} /></span>
          <span className="nishree-newsletter-eyebrow"><Sparkles size={12} aria-hidden="true" /> A note from Nishree</span>
          <h2 id="nishree-newsletter-title">Stories worth keeping,<br /><em>sent with care.</em></h2>
          <p>Thoughtful collection notes, styling ideas and stories from our world of drapes.</p>
        </div>
        <div className="nishree-newsletter-panel">
          <span className="nishree-newsletter-panel-title">A little inspiration, now and then.</span>
          <form className="nishree-newsletter-form" onSubmit={handleSubmit(subscribe)} noValidate>
            <div className="nishree-newsletter-field">
              <label className="sr-only" htmlFor="nishree-newsletter-email">Email address</label>
              <input
                id="nishree-newsletter-email"
                type="email"
                autoComplete="email"
                placeholder="Enter your email address"
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? 'nishree-newsletter-email-error' : undefined}
                {...register('email')}
              />
              <button type="submit" disabled={submitting} aria-label="Subscribe to Nishree Attire updates">
                {submitting ? 'Subscribing…' : <>Subscribe <ArrowRight size={16} aria-hidden="true" /></>}
              </button>
            </div>
            {errors.email && <span className="nishree-newsletter-error" id="nishree-newsletter-email-error" role="alert">{errors.email.message}</span>}
            <label className="nishree-newsletter-consent">
              <input type="checkbox" {...register('consent')} aria-invalid={Boolean(errors.consent)} aria-describedby={errors.consent ? 'nishree-newsletter-consent-error' : undefined} />
              <span>Yes, email me updates from Nishree Attire.</span>
            </label>
            {errors.consent && <span className="nishree-newsletter-error" id="nishree-newsletter-consent-error" role="alert">{errors.consent.message}</span>}
          </form>
          <span className="nishree-newsletter-note">Occasional stories, new edits and updates from our atelier.</span>
        </div>
      </div>
    </section>
  );
}
