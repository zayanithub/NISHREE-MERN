import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  LoaderCircle,
  Mail,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { normalizeApiError } from '../api/client';
import { useAdminAuth } from './useAdminAuth';
import companyLogo from '../assets/Nishree Attaire Company Logo HD_640x640.png';
import authImage from '../assets/saree shop image.jpg';
import { ThemeToggle } from '../theme/ThemeContext';
import './AdminLoginPage.css';

const REMEMBERED_ADMIN_EMAIL_KEY = 'nishree-admin-remembered-email';

export default function AdminLoginPage() {
  const { admin, loading, login, verifyLoginOtp, resendLoginOtp } = useAdminAuth();
  const [rememberEmail, setRememberEmail] = useState(() => {
    const rememberedEmail = window.localStorage.getItem(REMEMBERED_ADMIN_EMAIL_KEY);
    return Boolean(rememberedEmail);
  });
  const [email, setEmail] = useState(
    () => window.localStorage.getItem(REMEMBERED_ADMIN_EMAIL_KEY) || '',
  );
  const [password, setPassword] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [challengeEmail, setChallengeEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('credentials');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const timer = window.setTimeout(() => setResendCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  if (!loading && admin) return <Navigate to="/admin" replace />;

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      if (rememberEmail) {
        window.localStorage.setItem(REMEMBERED_ADMIN_EMAIL_KEY, normalizedEmail);
      } else {
        window.localStorage.removeItem(REMEMBERED_ADMIN_EMAIL_KEY);
      }
      const challenge = await login({ email: normalizedEmail, password });
      if (!challenge?.otpRequired || !challenge.challengeId) {
        throw new Error('Admin sign-in could not start verification. Please try again.');
      }
      setChallengeId(challenge.challengeId);
      setChallengeEmail(challenge.email || normalizedEmail);
      setOtp('');
      setResendCooldown(60);
      setStep('otp');
    } catch (requestError) {
      setError(
        normalizeApiError(requestError).message ||
          'Sign in could not be completed. Check your details and try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const submitOtp = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const verifiedAdmin = await verifyLoginOtp({ challengeId, otp });
      if (!verifiedAdmin) throw new Error('Admin session could not be established. Please sign in again.');
      navigate(location.state?.from || '/admin', { replace: true });
    } catch (requestError) {
      setError(normalizeApiError(requestError).message || 'The verification code could not be confirmed.');
    } finally {
      setSubmitting(false);
    }
  };

  const resendOtp = async () => {
    setError('');
    setSubmitting(true);
    try {
      const challenge = await resendLoginOtp({ challengeId });
      setChallengeId(challenge.challengeId);
      setResendCooldown(60);
      setOtp('');
    } catch (requestError) {
      setError(normalizeApiError(requestError).message || 'A new verification code could not be sent.');
    } finally {
      setSubmitting(false);
    }
  };

  const changeAdmin = () => {
    setStep('credentials');
    setChallengeId('');
    setChallengeEmail('');
    setOtp('');
    setError('');
  };

  return (
    <main className="admin-auth-page">
      <div className="admin-auth-ambient admin-auth-ambient-one" aria-hidden="true" />
      <div className="admin-auth-ambient admin-auth-ambient-two" aria-hidden="true" />
      <div className="admin-auth-topbar">
        <Link className="admin-auth-mobile-brand" to="/" aria-label="Nishree Attire home">
          <img src={companyLogo} alt="" width="38" height="38" />
          <span>NISHREE <small>ATTIRE</small></span>
        </Link>
        <div className="admin-auth-theme"><ThemeToggle /></div>
      </div>

      <section className="admin-auth-layout" aria-label="Administrator sign in">
        <aside className="admin-auth-visual">
          <img
            className="admin-auth-visual-image"
            src={authImage}
            alt="An elegant traditional saree boutique interior"
            loading="eager"
            decoding="async"
          />
          <div className="admin-auth-visual-shade" />
          <div className="admin-auth-visual-content">
            <Link className="admin-auth-brand" to="/" aria-label="Nishree Attire home">
              <img src={companyLogo} alt="" width="48" height="48" />
              <span>NISHREE <small>ATTIRE</small></span>
            </Link>
            <div className="admin-auth-story">
              <span className="admin-auth-eyebrow"><span /> THE ATELIER CONSOLE</span>
              <h2>Every detail,<br />beautifully <em>in hand.</em></h2>
              <p>A considered space to care for your store, your craft, and every customer who visits.</p>
            </div>
            <div className="admin-auth-visual-foot">
              <span className="admin-auth-foot-line" />
              <span>Elegance in every thread</span>
            </div>
          </div>
        </aside>

        <div className="admin-auth-panel">
          <div className="admin-auth-mobile-lockup">
            <img src={companyLogo} alt="Nishree Attire" width="56" height="56" />
            <span>ADMIN PORTAL</span>
          </div>

          <div className="admin-auth-form-wrap">
            <div className="admin-auth-security-badge">
              <span className="admin-auth-security-icon"><ShieldCheck size={16} aria-hidden="true" /></span>
              <span>SECURE ADMIN ACCESS</span>
            </div>
            <header className="admin-auth-heading" key={step}>
              <p className="admin-auth-kicker">{step === 'otp' ? 'IDENTITY CHECK' : 'WELCOME BACK'}</p>
              <h1>{step === 'otp' ? <>Verify it&apos;s you.</> : 'Admin portal'}</h1>
              <p>
                {step === 'otp'
                  ? `Enter the six-digit code sent to ${challengeEmail}. It expires in 10 minutes.`
                  : 'Sign in to manage your store, orders, products and customer experience.'}
              </p>
            </header>

            {step === 'credentials' && (
              <form className="admin-auth-form" onSubmit={submit}>
                <div className="admin-auth-field">
                  <label htmlFor="admin-email">Email address</label>
                  <div className="admin-auth-input-shell">
                    <Mail size={18} aria-hidden="true" />
                    <input
                      id="admin-email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="admin@nishree.com"
                      autoComplete="username"
                      required
                      maxLength={254}
                    />
                  </div>
                </div>

                <div className="admin-auth-field">
                  <div className="admin-auth-label-row">
                    <label htmlFor="admin-password">Password</label>
                    <span><KeyRound size={12} aria-hidden="true" /> Encrypted</span>
                  </div>
                  <div className="admin-auth-input-shell">
                    <LockKeyhole size={18} aria-hidden="true" />
                    <input
                      id="admin-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      required
                      maxLength={72}
                    />
                    <button
                      className="admin-auth-password-toggle"
                      type="button"
                      onClick={() => setShowPassword((visible) => !visible)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>

                <div className="admin-auth-options">
                  <label className="admin-auth-remember">
                    <input
                      type="checkbox"
                      checked={rememberEmail}
                      onChange={(event) => setRememberEmail(event.target.checked)}
                    />
                    <span className="admin-auth-checkmark"><Check size={12} aria-hidden="true" /></span>
                    Remember email on this device
                  </label>
                </div>

                {error && <p className="admin-auth-error" role="alert">{error}</p>}

                <button className="admin-auth-submit" type="submit" disabled={submitting || loading}>
                  <span>{submitting ? 'Signing in securely…' : loading ? 'Checking session…' : 'Sign in to portal'}</span>
                  {submitting || loading
                    ? <LoaderCircle className="admin-auth-spinner" size={18} aria-hidden="true" />
                    : <ArrowRight className="admin-auth-submit-arrow" size={18} aria-hidden="true" />}
                </button>

                <p className="admin-auth-recovery">
                  Forgot your password? <span>Contact your system administrator to reset access.</span>
                </p>
              </form>
            )}

            {step === 'otp' && (
              <form className="admin-auth-form" onSubmit={submitOtp}>
                <div className="admin-auth-otp-destination">
                  <span><Mail size={18} aria-hidden="true" /></span>
                  <div><small>CODE SENT TO</small><strong>{challengeEmail}</strong></div>
                </div>
                <div className="admin-auth-field">
                  <label htmlFor="admin-otp">Verification code</label>
                  <div className="admin-auth-input-shell admin-auth-otp-shell">
                    <ShieldCheck size={18} aria-hidden="true" />
                    <input
                      id="admin-otp"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6}"
                      value={otp}
                      onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      required
                      aria-describedby="admin-otp-help"
                    />
                  </div>
                  <span id="admin-otp-help" className="admin-auth-field-help">A single-use code protects your administrator session.</span>
                </div>
                <p className="admin-auth-delivery-note">
                  Not seeing it? Check spam and promotions, then resend when the timer ends.
                </p>
                {error && <p className="admin-auth-error" role="alert">{error}</p>}
                <button className="admin-auth-submit" type="submit" disabled={submitting || otp.length !== 6}>
                  <span>{submitting ? 'Verifying securely…' : 'Verify and continue'}</span>
                  {submitting
                    ? <LoaderCircle className="admin-auth-spinner" size={18} aria-hidden="true" />
                    : <ArrowRight className="admin-auth-submit-arrow" size={18} aria-hidden="true" />}
                </button>
                <div className="admin-auth-otp-actions">
                  <button type="button" onClick={() => void resendOtp()} disabled={submitting || resendCooldown > 0}>
                    <RefreshCw size={14} aria-hidden="true" />
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
                  </button>
                  <button type="button" onClick={changeAdmin} disabled={submitting}>
                    <ArrowLeft size={14} aria-hidden="true" /> Use another account
                  </button>
                </div>
              </form>
            )}

            <footer className="admin-auth-footer">
              <ShieldCheck size={16} aria-hidden="true" />
              <span>Protected administrator session. Customer accounts cannot access this workspace.</span>
            </footer>
          </div>
          <p className="admin-auth-copyright">© Nishree Attire <span>·</span> Crafted with care, managed with confidence.</p>
        </div>
      </section>
    </main>
  );
}
