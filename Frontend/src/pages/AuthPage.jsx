import { useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { normalizeApiError } from "../api/client";
import { authApi } from "../api/authApi";
import { useAuth } from "../auth/useAuth";
import { LoadingState } from "../components/States";
import authImage from "../assets/saree showromm images.jpg";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(254),
  password: z.string().min(1, "Enter your password.").max(72),
});

const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Enter at least 2 characters.").max(100),
    email: z.string().trim().email("Enter a valid email address.").max(254),
    phone: z
      .string()
      .trim()
      .max(20, "Phone number must be 20 characters or fewer.")
      .optional(),
    password: z
      .string()
      .min(8, "Use at least 8 characters.")
      .max(72, "Password must be 72 characters or fewer."),
  })
  .refine((data) => !data.phone || /^[+0-9()\s.-]+$/.test(data.phone), {
    path: ["phone"],
    message: "Use a valid phone number.",
  });

const inputShell =
  "auth-input-shell flex min-h-[3.35rem] items-center gap-3 rounded-2xl border border-[#eadfd4] bg-[#fffdfa] px-4 transition-all duration-300 focus-within:border-[#a45145] focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(164,81,69,0.09)]";
const inputClass =
  "auth-input h-12 min-w-0 flex-1 bg-transparent text-sm text-stone-800 outline-none placeholder:text-stone-400";

function FieldError({ error, id }) {
  if (!error) return null;
  return (
    <span
      id={id}
      className="mt-2 flex items-start gap-1.5 text-xs font-medium leading-5 text-[#a23631]"
      role="alert"
    >
      {error.message}
    </span>
  );
}

function AuthButton({
  children,
  submitting,
  disabled = false,
  type = "submit",
}) {
  return (
    <button
      className="auth-primary-button group relative mt-2 inline-flex h-[3.35rem] w-full items-center justify-center gap-2.5 overflow-hidden rounded-2xl bg-gradient-to-r from-[#641c1c] via-[#87342f] to-[#b66a54] px-5 text-sm font-semibold text-white shadow-[0_12px_26px_rgba(111,29,27,0.22)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_17px_32px_rgba(111,29,27,0.3)] focus:outline-none focus:ring-4 focus:ring-[#bb6c5c]/25 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
      type={type}
      disabled={submitting || disabled}
    >
      <span className="auth-button-shine pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <span className="relative">{submitting ? "Please wait…" : children}</span>
      {!submitting && (
        <ArrowRight
          className="relative transition-transform duration-300 group-hover:translate-x-1"
          size={17}
          aria-hidden="true"
        />
      )}
    </button>
  );
}

export default function AuthPage({ mode }) {
  const isRegister = mode === "register";
  const isForgot = mode === "forgot";
  const {
    user,
    loading: sessionLoading,
    login,
    register,
    verifyLoginOtp,
    verifyRegistrationEmail,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState(isForgot ? "forgot-email" : "credentials");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [challengeId, setChallengeId] = useState("");
  const [challengeEmail, setChallengeEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const schema = isRegister ? registerSchema : loginSchema;
  const {
    register: field,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", phone: "", password: "" },
  });
  const destination =
    location.state?.from ||
    new URLSearchParams(location.search).get("returnTo") ||
    "/shop";
  const safeDestination =
    typeof destination === "string" &&
    destination.startsWith("/") &&
    !destination.startsWith("//")
      ? destination
      : "/shop";
  const switchTo = `${isRegister ? "/login" : "/register"}${location.search}`;

  if (sessionLoading) {
    return (
      <div className="grid min-h-[60vh] place-items-center bg-[#fffaf6]">
        <LoadingState label="Restoring your account…" />
      </div>
    );
  }
  if (user && !submitting) return <Navigate to={safeDestination} replace />;

  const submit = async (values) => {
    setSubmitting(true);
    try {
      const result = isRegister
        ? await register({
            name: values.name,
            email: values.email,
            phone: values.phone || undefined,
            password: values.password,
          })
        : await login({ email: values.email, password: values.password });
      setChallengeId(result.challengeId);
      setChallengeEmail(values.email);
      setOtp("");
      setStep("verify-login");
      toast.success("A verification code has been sent to your email.");
    } catch (error) {
      toast.error(normalizeApiError(error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const submitLoginOtp = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const payload = { challengeId, otp };
      if (isRegister) await verifyRegistrationEmail(payload);
      else await verifyLoginOtp(payload);
      toast.success(
        isRegister
          ? "Your account is verified."
          : "Welcome back to Nishree Creations.",
      );
      navigate(safeDestination, { replace: true });
    } catch (error) {
      toast.error(normalizeApiError(error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const requestResetCode = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const result = await authApi.requestPasswordReset({
        email: recoveryEmail.trim(),
      });
      setChallengeId(result.challengeId);
      setChallengeEmail(recoveryEmail.trim());
      setOtp("");
      setStep("verify-reset");
      toast.success(result.message);
    } catch (error) {
      toast.error(normalizeApiError(error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const verifyResetCode = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const result = await authApi.verifyPasswordResetOtp({ challengeId, otp });
      setResetToken(result.resetToken);
      setStep("reset-password");
    } catch (error) {
      toast.error(normalizeApiError(error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const submitNewPassword = async (event) => {
    event.preventDefault();
    if (newPassword.length < 8 || newPassword.length > 72) {
      toast.error("Use a password between 8 and 72 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("The passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await authApi.resetPassword({
        resetToken,
        password: newPassword,
      });
      if (result.emailSent === false)
        toast.warning(
          "Your password changed, but the confirmation email could not be sent. Contact support if you did not request this change.",
        );
      else toast.success("Your password has been reset. Please sign in.");
      navigate("/login", { replace: true });
    } catch (error) {
      toast.error(normalizeApiError(error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const title =
    step === "verify-login"
      ? "Check your email."
      : step === "forgot-email"
        ? "Let’s get you back."
        : step === "verify-reset"
          ? "Verify it’s you."
          : step === "reset-password"
            ? "Choose a new password."
            : isRegister
              ? "Your next favourite starts here."
              : "Welcome back.";

  const description =
    step === "verify-login"
      ? `Enter the six-digit code sent to ${challengeEmail}.`
      : step === "forgot-email"
        ? "Enter the email address linked to your account. We’ll send a reset code if the account exists."
        : step === "verify-reset"
          ? `Enter the six-digit password-reset code sent to ${challengeEmail}.`
          : step === "reset-password"
            ? "Choose a unique password between 8 and 72 characters to secure your account."
            : isRegister
              ? "Create an account to keep your favourite pieces close, track orders and enjoy a smoother checkout."
              : "Sign in to discover your saved pieces, manage addresses and keep up with your orders.";

  return (
    <div className="auth-flow-page relative isolate min-h-screen overflow-hidden bg-[#fffaf6] px-3 py-5 text-stone-800 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <style>{`
        @keyframes auth-fade-up { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes auth-float { 0%, 100% { transform: translate3d(0,0,0); } 50% { transform: translate3d(0,-13px,0); } }
        @keyframes auth-drift { 0%, 100% { transform: translate(0,0) scale(1); } 50% { transform: translate(14px,-10px) scale(1.04); } }
        @keyframes auth-shine { 0% { transform: translateX(-130%); } 100% { transform: translateX(130%); } }
        @keyframes auth-soft-pulse { 0%, 100% { opacity: .48; } 50% { opacity: .82; } }
        .auth-fade-up { animation: auth-fade-up .65s cubic-bezier(.2,.75,.25,1) both; }
        .auth-fade-up-delay { animation: auth-fade-up .75s cubic-bezier(.2,.75,.25,1) .12s both; }
        .auth-float { animation: auth-float 7s ease-in-out infinite; }
        .auth-drift { animation: auth-drift 12s ease-in-out infinite; }
        .auth-button-shine { transition: transform .7s ease; }
        .auth-primary-button:hover .auth-button-shine { transform: translateX(130%); }
        .auth-input-shell:focus-within svg { transform: scale(1.06); }
        .auth-form-panel { animation: auth-fade-up .7s cubic-bezier(.2,.75,.25,1) .08s both; }
        @media (prefers-reduced-motion: reduce) {
          .auth-fade-up, .auth-fade-up-delay, .auth-float, .auth-drift, .auth-form-panel { animation: none !important; }
          .auth-primary-button, .auth-input-shell, .auth-button-shine { transition: none !important; }
        }
      `}</style>

      <div className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(ellipse_at_7%_8%,rgba(126,31,32,0.12),transparent_32%),radial-gradient(ellipse_at_93%_15%,rgba(238,174,157,0.34),transparent_27%),radial-gradient(ellipse_at_52%_100%,rgba(204,171,128,0.23),transparent_38%)]" />
      <div className="auth-drift pointer-events-none absolute -left-24 top-[24%] -z-10 h-64 w-64 rounded-full bg-[#efb4a4]/35 blur-3xl" />
      <div className="auth-float pointer-events-none absolute -right-24 bottom-[9%] -z-10 h-80 w-80 rounded-full bg-[#cfb07c]/25 blur-3xl" />

      <section className="auth-flow-card auth-fade-up relative mx-auto grid w-full max-w-[1200px] overflow-hidden rounded-[1.75rem] border border-white/90 bg-white/75 shadow-[0_30px_100px_rgba(94,34,31,0.16)] backdrop-blur-2xl sm:rounded-[2.25rem] lg:min-h-[700px] lg:grid-cols-[0.94fr_1.06fr]">
        {/* Brand / campaign panel */}
        <aside className="group relative min-h-[19rem] overflow-hidden bg-[#54201c] p-6 sm:min-h-[24rem] sm:p-9 lg:min-h-[700px] lg:p-11 xl:p-12">
          <img
            className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-[1400ms] ease-out group-hover:scale-[1.035]"
            src={authImage}
            alt="Traditional silk sarees displayed in the Nishree Creations boutique"
            loading="eager"
            decoding="async"
            width="1024"
            height="1024"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#2d1211]/55 via-[#431713]/15 to-[#2b1011]/95" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#4c1716]/40 via-transparent to-[#2d1211]/10" />
          <div className="absolute -left-16 top-1/3 h-64 w-64 rounded-full bg-[#f7c5a1]/20 blur-3xl transition duration-1000 group-hover:bg-[#f7c5a1]/30" />
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#2d1012]/60 to-transparent" />

          <div className="relative flex min-h-[16rem] flex-col justify-between text-white sm:min-h-[19rem] lg:min-h-[604px]">
            <Link
              className="inline-flex w-fit items-center gap-2.5 rounded-full border border-white/25 bg-black/10 px-3.5 py-2 text-xs font-semibold uppercase tracking-[0.17em] text-white/95 backdrop-blur-md transition hover:border-white/50 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/80"
              to="/"
              aria-label="Nishree Creations home"
            >
              <span className="grid h-7 w-7 place-items-center rounded-full bg-[#f3d4b4]/20 text-[#f5d5b4]">
                <Sparkles size={15} aria-hidden="true" />
              </span>
              Nishree Creations
            </Link>

            <div className="auth-fade-up-delay mt-12 max-w-lg pb-2 sm:mt-16 lg:mt-0 lg:pb-3">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-[#ffddc5] backdrop-blur-md">
                <span className="h-1.5 w-1.5 rounded-full bg-[#e8bd91] shadow-[0_0_12px_rgba(232,189,145,.8)]" />{" "}
                Thoughtfully curated, timelessly yours
              </div>
              <p className="max-w-md font-serif text-4xl leading-[1.04] tracking-[-0.035em] sm:text-5xl lg:text-[3.65rem] xl:text-[4rem]">
                Every thread
                <br />
                holds a <em className="font-normal text-[#f3c6a7]">story.</em>
              </p>
              <p className="mt-5 max-w-sm text-sm leading-6 text-white/80 sm:text-[0.95rem] sm:leading-7">
                Discover the beauty of tradition, crafted for the moments that
                become memories.
              </p>
              <div className="mt-7 flex items-center gap-3 text-xs font-medium tracking-wide text-white/80 sm:mt-9">
                <span className="h-px w-10 bg-gradient-to-r from-[#edc39e] to-transparent" />{" "}
                Elegance in every thread
              </div>
            </div>
          </div>

          <div className="auth-float absolute bottom-7 right-6 hidden rounded-2xl border border-white/25 bg-[#3f1717]/35 p-3.5 text-white shadow-xl backdrop-blur-xl sm:block lg:bottom-10 lg:right-8">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e9c59f]/15 text-[#f3c6a7]">
                <Sparkles size={19} aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-semibold">Made for your moments</p>
                <p className="mt-1 text-[0.68rem] text-white/65">
                  Tradition meets today
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* Form panel */}
        <div className="auth-form-panel relative flex items-center justify-center p-5 sm:p-9 lg:px-12 lg:py-12 xl:px-[4.25rem]">
          <div className="pointer-events-none absolute inset-x-14 top-0 h-px bg-gradient-to-r from-transparent via-[#d3b184] to-transparent" />
          <div className="pointer-events-none absolute right-0 top-0 h-52 w-52 rounded-full bg-[#f7e6d8]/55 blur-3xl" />

          <div className="relative w-full max-w-[440px] py-2 sm:py-4">
            <nav
              className="flex items-center gap-2 text-xs font-medium text-stone-400"
              aria-label="Breadcrumb"
            >
              <Link
                className="transition-colors hover:text-[#7a2928] focus:outline-none focus:ring-2 focus:ring-[#bb6c5c]/40"
                to="/"
              >
                Home
              </Link>
              <span className="text-stone-300" aria-hidden="true">
                /
              </span>
              <span className="text-[#8c4238]">
                {isForgot
                  ? "Password recovery"
                  : isRegister
                    ? "Create account"
                    : "Sign in"}
              </span>
            </nav>

            <div className="mt-7 flex items-center gap-3 sm:mt-9">
              <span className="grid h-11 w-11 place-items-center rounded-2xl border border-[#ead7c8] bg-[#fff7f0] text-[#8b4036] shadow-sm">
                <Sparkles size={18} aria-hidden="true" />
              </span>
              <div>
                <p className="text-[0.66rem] font-bold uppercase tracking-[0.22em] text-[#99584c]">
                  Your Nishree account
                </p>
                <p className="mt-1 text-xs text-stone-500">
                  A more personal shopping experience
                </p>
              </div>
            </div>

            <div key={step} className="auth-fade-up mt-6 sm:mt-7">
              <h1 className="max-w-[420px] text-[2rem] font-semibold leading-[1.08] tracking-[-0.045em] text-[#4d1919] sm:text-[2.6rem]">
                {title}
              </h1>
              <p className="mt-3 max-w-[390px] text-sm leading-6 text-stone-500 sm:mt-4 sm:leading-7">
                {description}
              </p>
            </div>

            {step === "credentials" && (
              <form
                className="auth-fade-up mt-7 space-y-4 sm:mt-8 sm:space-y-[1.1rem]"
                onSubmit={handleSubmit(submit)}
                noValidate
              >
                {isRegister && (
                  <div className="group">
                    <label
                      htmlFor="auth-name"
                      className="mb-2 block text-[0.78rem] font-semibold text-stone-700"
                    >
                      Full name
                    </label>
                    <div className={inputShell}>
                      <UserRound
                        className="shrink-0 text-[#b18470] transition-transform duration-200 group-focus-within:text-[#7a2928]"
                        size={18}
                        aria-hidden="true"
                      />
                      <input
                        id="auth-name"
                        className={inputClass}
                        autoComplete="name"
                        placeholder="Enter your full name"
                        aria-invalid={Boolean(errors.name)}
                        aria-describedby={
                          errors.name ? "auth-name-error" : undefined
                        }
                        {...field("name")}
                      />
                    </div>
                    <FieldError error={errors.name} id="auth-name-error" />
                  </div>
                )}

                <div className="group">
                  <label
                    htmlFor="auth-email"
                    className="mb-2 block text-[0.78rem] font-semibold text-stone-700"
                  >
                    Email address
                  </label>
                  <div className={inputShell}>
                    <Mail
                      className="shrink-0 text-[#b18470] transition-transform duration-200 group-focus-within:text-[#7a2928]"
                      size={18}
                      aria-hidden="true"
                    />
                    <input
                      id="auth-email"
                      className={inputClass}
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      aria-invalid={Boolean(errors.email)}
                      aria-describedby={
                        errors.email ? "auth-email-error" : undefined
                      }
                      {...field("email")}
                    />
                  </div>
                  <FieldError error={errors.email} id="auth-email-error" />
                </div>

                {isRegister && (
                  <div className="group">
                    <label
                      htmlFor="auth-phone"
                      className="mb-2 block text-[0.78rem] font-semibold text-stone-700"
                    >
                      Phone number{" "}
                      <span className="ml-1 font-normal text-stone-400">
                        Optional
                      </span>
                    </label>
                    <div className={inputShell}>
                      <span
                        className="grid h-6 w-8 shrink-0 place-items-center rounded-md bg-[#f7ebe2] text-[0.63rem] font-bold text-[#a36c5c]"
                        aria-hidden="true"
                      >
                        +91
                      </span>
                      <input
                        id="auth-phone"
                        className={inputClass}
                        type="tel"
                        autoComplete="tel"
                        placeholder="98765 43210"
                        aria-invalid={Boolean(errors.phone)}
                        aria-describedby={
                          errors.phone ? "auth-phone-error" : undefined
                        }
                        {...field("phone")}
                      />
                    </div>
                    <FieldError error={errors.phone} id="auth-phone-error" />
                  </div>
                )}

                <div className="group">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label
                      htmlFor="auth-password"
                      className="block text-[0.78rem] font-semibold text-stone-700"
                    >
                      Password
                    </label>
                    {!isRegister && (
                      <Link
                        className="text-xs font-semibold text-[#8b4036] decoration-[#d7a28e] underline-offset-4 transition hover:underline"
                        to="/forgot-password"
                      >
                        Forgot password?
                      </Link>
                    )}
                  </div>
                  <div className={inputShell}>
                    <LockKeyhole
                      className="shrink-0 text-[#b18470] transition-transform duration-200 group-focus-within:text-[#7a2928]"
                      size={18}
                      aria-hidden="true"
                    />
                    <input
                      id="auth-password"
                      className={inputClass}
                      type={showPassword ? "text" : "password"}
                      autoComplete={
                        isRegister ? "new-password" : "current-password"
                      }
                      placeholder={
                        isRegister
                          ? "At least 8 characters"
                          : "Enter your password"
                      }
                      aria-invalid={Boolean(errors.password)}
                      aria-describedby={
                        errors.password ? "auth-password-error" : undefined
                      }
                      {...field("password")}
                    />
                    <button
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-stone-400 transition-all hover:bg-[#f8eae2] hover:text-[#7a2928] focus:outline-none focus:ring-2 focus:ring-[#b66758]/60"
                      type="button"
                      onClick={() => setShowPassword((shown) => !shown)}
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                  <FieldError
                    error={errors.password}
                    id="auth-password-error"
                  />
                  {isRegister && (
                    <p className="mt-2 text-[0.7rem] leading-5 text-stone-400">
                      Use 8–72 characters. A unique password helps keep your
                      account safe.
                    </p>
                  )}
                </div>

                <AuthButton submitting={submitting}>
                  {isRegister
                    ? "Create your account"
                    : "Sign in to your account"}
                </AuthButton>
              </form>
            )}

            {step === "verify-login" && (
              <form
                className="auth-fade-up mt-8 space-y-4"
                onSubmit={submitLoginOtp}
              >
                <label
                  htmlFor="login-otp"
                  className="mb-2 block text-[0.78rem] font-semibold text-stone-700"
                >
                  Six-digit verification code
                </label>
                <div className={inputShell}>
                  <ShieldCheck
                    className="shrink-0 text-[#b18470]"
                    size={18}
                    aria-hidden="true"
                  />
                  <input
                    id="login-otp"
                    className={`${inputClass} text-base tracking-[0.35em]`}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={otp}
                    onChange={(event) =>
                      setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    placeholder="000000"
                    required
                  />
                </div>
                <p className="text-xs leading-5 text-stone-400">
                  For your security, the code can only be used to complete this
                  verification.
                </p>
                <AuthButton submitting={submitting} disabled={otp.length !== 6}>
                  {submitting ? "Verifying…" : "Verify and continue"}
                </AuthButton>
                <button
                  className="flex w-full items-center justify-center gap-2 py-2 text-sm font-semibold text-[#854037] transition hover:text-[#4d1919]"
                  type="button"
                  onClick={() => {
                    setStep("credentials");
                    setOtp("");
                  }}
                >
                  <ArrowLeft size={15} /> Use a different email or password
                </button>
              </form>
            )}

            {step === "forgot-email" && (
              <form
                className="auth-fade-up mt-8 space-y-4"
                onSubmit={requestResetCode}
              >
                <label
                  htmlFor="recovery-email"
                  className="mb-2 block text-[0.78rem] font-semibold text-stone-700"
                >
                  Email address
                </label>
                <div className={inputShell}>
                  <Mail
                    className="shrink-0 text-[#b18470]"
                    size={18}
                    aria-hidden="true"
                  />
                  <input
                    id="recovery-email"
                    className={inputClass}
                    type="email"
                    autoComplete="email"
                    maxLength={254}
                    value={recoveryEmail}
                    onChange={(event) => setRecoveryEmail(event.target.value)}
                    placeholder="you@example.com"
                    required
                  />
                </div>
                <AuthButton
                  submitting={submitting}
                  disabled={!recoveryEmail.trim()}
                >
                  {submitting ? "Sending code…" : "Send password reset code"}
                </AuthButton>
              </form>
            )}

            {step === "verify-reset" && (
              <form
                className="auth-fade-up mt-8 space-y-4"
                onSubmit={verifyResetCode}
              >
                <label
                  htmlFor="reset-otp"
                  className="mb-2 block text-[0.78rem] font-semibold text-stone-700"
                >
                  Six-digit verification code
                </label>
                <div className={inputShell}>
                  <ShieldCheck
                    className="shrink-0 text-[#b18470]"
                    size={18}
                    aria-hidden="true"
                  />
                  <input
                    id="reset-otp"
                    className={`${inputClass} text-base tracking-[0.35em]`}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={otp}
                    onChange={(event) =>
                      setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    placeholder="000000"
                    required
                  />
                </div>
                <AuthButton submitting={submitting} disabled={otp.length !== 6}>
                  {submitting ? "Verifying…" : "Verify code"}
                </AuthButton>
                <button
                  className="flex w-full items-center justify-center gap-2 py-2 text-sm font-semibold text-[#854037] transition hover:text-[#4d1919]"
                  type="button"
                  onClick={() => setStep("forgot-email")}
                >
                  <ArrowLeft size={15} /> Use a different email address
                </button>
              </form>
            )}

            {step === "reset-password" && (
              <form
                className="auth-fade-up mt-8 space-y-4"
                onSubmit={submitNewPassword}
              >
                <div>
                  <label
                    htmlFor="new-password"
                    className="mb-2 block text-[0.78rem] font-semibold text-stone-700"
                  >
                    New password
                  </label>
                  <div className={inputShell}>
                    <LockKeyhole
                      className="shrink-0 text-[#b18470]"
                      size={18}
                      aria-hidden="true"
                    />
                    <input
                      id="new-password"
                      className={inputClass}
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      maxLength={72}
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      placeholder="Choose a new password"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="confirm-password"
                    className="mb-2 block text-[0.78rem] font-semibold text-stone-700"
                  >
                    Confirm new password
                  </label>
                  <div className={inputShell}>
                    <LockKeyhole
                      className="shrink-0 text-[#b18470]"
                      size={18}
                      aria-hidden="true"
                    />
                    <input
                      id="confirm-password"
                      className={inputClass}
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      maxLength={72}
                      value={confirmPassword}
                      onChange={(event) =>
                        setConfirmPassword(event.target.value)
                      }
                      placeholder="Enter it once more"
                      required
                    />
                  </div>
                  {confirmPassword && (
                    <p
                      className={`mt-2 flex items-center gap-1.5 text-xs ${confirmPassword === newPassword ? "text-emerald-700" : "text-[#a23631]"}`}
                    >
                      {confirmPassword === newPassword ? (
                        <CheckCircle2 size={14} />
                      ) : null}
                      {confirmPassword === newPassword
                        ? "Passwords match"
                        : "Passwords do not match yet"}
                    </p>
                  )}
                </div>
                <AuthButton
                  submitting={submitting}
                  disabled={!newPassword || !confirmPassword}
                >
                  {submitting ? "Updating password…" : "Reset password"}
                </AuthButton>
              </form>
            )}

            <div className="mt-6 border-t border-[#eee2d8] pt-5 sm:mt-7 sm:pt-6">
              {step === "credentials" && (
                <p className="text-center text-sm text-stone-500">
                  {isRegister
                    ? "Already have an account?"
                    : "New to Nishree Creations?"}{" "}
                  <Link
                    className="font-semibold text-[#80372f] decoration-[#d7a28e] underline-offset-4 transition hover:text-[#4d1919] hover:underline"
                    to={switchTo}
                    state={location.state}
                  >
                    {isRegister ? "Sign in instead" : "Create an account"}
                  </Link>
                </p>
              )}
              {isForgot && (
                <p className="text-center text-sm text-stone-500">
                  Remembered your password?{" "}
                  <Link
                    className="font-semibold text-[#80372f] decoration-[#d7a28e] underline-offset-4 hover:underline"
                    to="/login"
                  >
                    Sign in
                  </Link>
                </p>
              )}
              {step !== "credentials" && step !== "forgot-email" && (
                <p className="text-center text-sm text-stone-500">
                  <Link
                    className="font-semibold text-[#80372f] decoration-[#d7a28e] underline-offset-4 hover:underline"
                    to="/login"
                  >
                    Return to sign in
                  </Link>
                </p>
              )}
              <div className="mt-5 flex items-center justify-center gap-2.5 text-[0.7rem] leading-5 text-stone-400 sm:mt-6">
                <ShieldCheck
                  className="shrink-0 text-[#9b6a58]"
                  size={15}
                  aria-hidden="true"
                />
                <span>
                  Your account is protected with secure session handling.
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
      <p className="auth-fade-up mt-5 text-center text-[0.68rem] tracking-wide text-stone-400 sm:mt-6">
        © {new Date().getFullYear()} Nishree Creations{" "}
        <span className="mx-1.5 text-[#c7a18d]">·</span> Crafted with care
      </p>
    </div>
  );
}
