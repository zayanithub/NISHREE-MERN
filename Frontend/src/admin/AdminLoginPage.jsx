import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { normalizeApiError } from '../api/client';
import { useAdminAuth } from './useAdminAuth';
import companyLogo from '../assets/Nishree Attaire Company Logo HD_640x640.png';
import { ThemeToggle } from '../theme/ThemeContext';

export default function AdminLoginPage() {
  const { admin, loading, login, verifyLoginOtp, resendLoginOtp } = useAdminAuth();
  const [email, setEmail] = useState('');
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
      const challenge = await login({ email: email.trim().toLowerCase(), password });
      if (!challenge?.otpRequired || !challenge.challengeId) {
        throw new Error('Admin sign-in could not start verification. Please try again.');
      }
      setChallengeId(challenge.challengeId);
      setChallengeEmail(challenge.email || email.trim().toLowerCase());
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
    <main className="admin-login-page relative isolate grid min-h-screen place-items-center overflow-hidden bg-[#fffaf7] px-4 py-10 text-stone-800 sm:px-6">
      <div className="admin-login-theme"><ThemeToggle /></div>
      {/* Ambient animated background */}
      <div className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(circle_at_12%_18%,rgba(126,31,32,0.22),transparent_28%),radial-gradient(circle_at_86%_13%,rgba(238,174,157,0.48),transparent_26%),radial-gradient(circle_at_52%_96%,rgba(204,171,128,0.38),transparent_35%)]" />
      <div className="pointer-events-none absolute -left-16 top-14 -z-10 h-72 w-72 rounded-full bg-[#f3b5a5]/55 blur-3xl motion-safe:animate-pulse" />
      <div className="pointer-events-none absolute -right-20 bottom-0 -z-10 h-80 w-80 rounded-full bg-[#cfb07c]/40 blur-3xl motion-safe:animate-pulse [animation-delay:700ms]" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(rgba(126,31,32,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(126,31,32,0.045)_1px,transparent_1px)] bg-[size:42px_42px] [mask-image:radial-gradient(ellipse_90%_70%_at_50%_50%,black,transparent)]" />

      <section className="admin-login-body w-full max-w-md">
        <div className="admin-login-brand mb-5 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#7a2928]">
          <Sparkles size={14} aria-hidden="true" />
          Nishree Attire
        </div>

        <div className="admin-login-shell relative overflow-hidden rounded-[2rem] border border-white/80 bg-white/75 p-1 shadow-[0_28px_75px_rgba(94,34,31,0.18)] backdrop-blur-2xl">
          <div className="absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-[#cba574] to-transparent" />

          <div className="admin-login-inner rounded-[1.8rem] border border-[#eadbca] bg-[#fffdfb]/90 px-5 py-7 sm:px-8 sm:py-9">
            <div className="mb-7 flex items-start justify-between gap-4">
              <div>
                <img className="mb-3 h-16 w-16 rounded-2xl object-cover shadow-lg shadow-[#7a2928]/15 ring-1 ring-white/80" src={companyLogo} alt="Nishree Attire" width="64" height="64" />
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[#9a5b4f]">
                  Admin portal
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#dec6a5] bg-[#f8eadb] px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-wider text-[#7a2928]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#a65147] motion-safe:animate-pulse" />
                Secure access
              </span>
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-[#571c1a] sm:text-[2.15rem]">
              {step === 'otp' ? <>Verify it&apos;s you<span className="text-[#bf715c]">.</span></> : <>Welcome back<span className="text-[#bf715c]">.</span></>}
            </h1>
            <p className="mt-2.5 max-w-sm text-sm leading-6 text-stone-600">
              {step === 'otp'
                ? `Enter the six-digit code sent to ${challengeEmail}. The code expires in 10 minutes.`
                : 'Sign in to manage your store, orders, products and customer experience.'}
            </p>

            {step === 'credentials' && <form className="mt-7 space-y-4" onSubmit={submit}>
              <div className="group">
                <label htmlFor="admin-email" className="mb-2 block text-xs font-semibold tracking-wide text-stone-700">
                  Email address
                </label>
                <span className="flex items-center gap-3 rounded-xl border border-[#e5d7c8] bg-white px-3.5 transition duration-200 focus-within:border-[#a95148] focus-within:bg-[#fffdfa] focus-within:ring-4 focus-within:ring-[#ba6d5e]/15">
                  <Mail className="shrink-0 text-[#aa7764] transition group-focus-within:text-[#7a2928]" size={18} aria-hidden="true" />
                  <input
                    id="admin-email"
                    className="h-12 min-w-0 flex-1 bg-transparent text-sm text-stone-800 outline-none placeholder:text-stone-400"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="admin@nishree.com"
                    autoComplete="username"
                    required
                    maxLength={254}
                  />
                </span>
              </div>

              <div className="group">
                <label htmlFor="admin-password" className="mb-2 block text-xs font-semibold tracking-wide text-stone-700">
                  Password
                </label>
                <span className="flex items-center gap-3 rounded-xl border border-[#e5d7c8] bg-white px-3.5 transition duration-200 focus-within:border-[#a95148] focus-within:bg-[#fffdfa] focus-within:ring-4 focus-within:ring-[#ba6d5e]/15">
                  <LockKeyhole className="shrink-0 text-[#aa7764] transition group-focus-within:text-[#7a2928]" size={18} aria-hidden="true" />
                  <input
                    id="admin-password"
                    className="h-12 min-w-0 flex-1 bg-transparent text-sm text-stone-800 outline-none placeholder:text-stone-400"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                    maxLength={72}
                  />
                  <button
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-stone-400 transition hover:bg-[#f9e7df] hover:text-[#7a2928] focus:outline-none focus:ring-2 focus:ring-[#b66758]/60"
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </span>
              </div>

              {error && (
                <p className="rounded-xl border border-[#e9b7a6] bg-[#fff0ea] px-3.5 py-3 text-sm leading-5 text-[#812c28]" role="alert">
                  {error}
                </p>
              )}

              <button
                className="group relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-[#6f1d1b] via-[#923d34] to-[#bc725c] px-5 font-semibold text-white shadow-lg shadow-[#7a2928]/25 transition duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[#7a2928]/30 focus:outline-none focus:ring-4 focus:ring-[#bb6c5c]/30 disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60"
                type="submit"
                disabled={submitting || loading}
              >
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition duration-700 group-hover:translate-x-full" />
                <span className="relative">{submitting ? 'Signing in securely…' : loading ? 'Checking session…' : 'Sign in securely'}</span>
                {!submitting && <ArrowRight className="relative transition-transform duration-200 group-hover:translate-x-1" size={17} aria-hidden="true" />}
              </button>
            </form>}

            {step === 'otp' && <form className="mt-7 space-y-4" onSubmit={submitOtp}>
              <div className="group">
                <label htmlFor="admin-otp" className="mb-2 block text-xs font-semibold tracking-wide text-stone-700">
                  Verification code
                </label>
                <span className="flex items-center gap-3 rounded-xl border border-[#e5d7c8] bg-white px-3.5 transition duration-200 focus-within:border-[#a95148] focus-within:ring-4 focus-within:ring-[#ba6d5e]/15">
                  <ShieldCheck className="shrink-0 text-[#aa7764]" size={18} aria-hidden="true" />
                  <input
                    id="admin-otp"
                    className="h-12 min-w-0 flex-1 bg-transparent text-center text-lg font-semibold tracking-[0.35em] text-stone-800 outline-none placeholder:text-stone-400"
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
                </span>
                <span id="admin-otp-help" className="mt-2 block text-xs text-stone-500">A single-use code protects your administrator session.</span>
              </div>

              {error && (
                <p className="rounded-xl border border-[#e9b7a6] bg-[#fff0ea] px-3.5 py-3 text-sm leading-5 text-[#812c28]" role="alert">
                  {error}
                </p>
              )}

              <button
                className="group relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-[#4a1028] px-5 font-semibold text-white shadow-lg shadow-[#7a2928]/25 transition duration-300 hover:-translate-y-0.5 hover:bg-[#35101f] focus:outline-none focus:ring-4 focus:ring-[#bb6c5c]/30 disabled:cursor-not-allowed disabled:opacity-60"
                type="submit"
                disabled={submitting || otp.length !== 6}
              >
                <span>{submitting ? 'Verifying securely…' : 'Verify and continue'}</span>
                {!submitting && <ArrowRight size={17} aria-hidden="true" />}
              </button>
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                <button type="button" className="font-semibold text-[#7a2928] underline decoration-[#d7a28e] underline-offset-4 disabled:cursor-not-allowed disabled:text-stone-400" onClick={() => void resendOtp()} disabled={submitting || resendCooldown > 0}>
                  {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
                </button>
                <button type="button" className="text-stone-500 hover:text-[#7a2928]" onClick={changeAdmin} disabled={submitting}>Use another admin account</button>
              </div>
            </form>}

            <p className="mt-6 flex items-start gap-2 border-t border-[#eadbca] pt-5 text-xs leading-5 text-stone-500">
              <ShieldCheck className="mt-0.5 shrink-0 text-[#8e493f]" size={15} aria-hidden="true" />
              Protected administrator session. Customer accounts cannot access this workspace.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
