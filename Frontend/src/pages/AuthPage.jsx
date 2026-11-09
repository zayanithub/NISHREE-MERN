import { useEffect, useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Mail,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { authApi } from "../api/authApi";
import { normalizeApiError } from "../api/client";
import { useAuth } from "../auth/useAuth";
import { LoadingState } from "../components/States";
import authImage from "../assets/saree showromm images.jpg";
import "./AuthPage.css";

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
    confirmPassword: z.string().min(1, "Confirm your password."),
    acceptedTerms: z.boolean().refine(Boolean, "Please accept the terms to continue."),
  })
  .refine((data) => !data.phone || /^[+0-9()\s.-]+$/.test(data.phone), {
    path: ["phone"],
    message: "Use a valid phone number.",
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

const inputShell = "auth-field-control";

function FieldError({ error, id }) {
  if (!error) return null;
  return (
    <span id={id} className="auth-field-error" role="alert">
      {error.message}
    </span>
  );
}

function AuthButton({ children, submitting, disabled = false, type = "submit" }) {
  return (
    <button
      className="auth-submit-button"
      type={type}
      disabled={submitting || disabled}
    >
      {submitting ? (
        <LoaderCircle className="auth-spinner" size={18} aria-hidden="true" />
      ) : null}
      <span>{submitting ? "Please wait…" : children}</span>
      {!submitting ? <ArrowRight size={17} aria-hidden="true" /> : null}
    </button>
  );
}

function BrandMark({ light = false }) {
  return (
    <span className={`auth-brand-mark${light ? " is-light" : ""}`}>
      <span>N</span>
    </span>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" transform="translate(2 2)" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.73 7.18l7.58 5.89c4.42-4.08 7.19-10.08 7.19-17.54Z" transform="translate(0 0)" />
      <path fill="#FBBC05" d="M10.53 28.59a14.4 14.4 0 0 1 0-9.18l-7.98-6.19a23.9 23.9 0 0 0 0 21.56l7.98-6.19Z" transform="translate(2 2)" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.8l-7.58-5.89c-2.1 1.41-4.79 2.25-8.32 2.25-6.26 0-11.57-4.22-13.46-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" transform="translate(2 0)" />
      <path fill="none" d="M0 0h48v48H0z" />
    </svg>
  );
}

function formatCountdown(seconds) {
  const minutes = Math.floor(Math.max(0, seconds) / 60);
  const remaining = Math.max(0, seconds) % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}

function passwordScore(password) {
  return [
    password.length >= 8,
    /[a-z]/i.test(password) && /[0-9]/.test(password),
    /[^a-z0-9]/i.test(password),
  ].filter(Boolean).length;
}

export default function AuthPage({ mode }) {
  const isRegister = mode === "register";
  const isForgot = mode === "forgot";
  const initialGoogleChallenge =
    new URLSearchParams(window.location.search).get("googleChallenge") || "";
  const {
    user,
    loading: sessionLoading,
    login,
    register,
    verifyRegistrationEmail,
    resendRegistrationOtp,
    verifyGoogleOtp,
    resendGoogleOtp,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState(() =>
    initialGoogleChallenge ? "verify-google" : isForgot ? "forgot-email" : "credentials",
  );
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [challengeId, setChallengeId] = useState(initialGoogleChallenge);
  const [challengeEmail, setChallengeEmail] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [resendAvailableAt, setResendAvailableAt] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const schema = isRegister ? registerSchema : loginSchema;
  const {
    register: field,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      acceptedTerms: false,
    },
  });
  const passwordValue = useWatch({
    control,
    name: "password",
    defaultValue: "",
  });
  const strength = passwordScore(passwordValue);
  const destination =
    location.state?.from ||
    new URLSearchParams(location.search).get("returnTo") ||
    "/product_hub";
  const safeDestination =
    typeof destination === "string" &&
    destination.startsWith("/") &&
    !destination.startsWith("//")
      ? destination
      : "/product_hub";
  const switchTo = `${isRegister ? "/login" : "/register"}${location.search}`;

  useEffect(() => {
    if (isForgot) return undefined;
    let active = true;
    authApi
      .googleStatus()
      .then(({ enabled }) => {
        if (active) setGoogleEnabled(enabled === true);
      })
      .catch((error) => {
        console.error("Google sign-in availability check failed:", normalizeApiError(error).message);
        if (active) setGoogleEnabled(false);
      });
    return () => {
      active = false;
    };
  }, [isForgot]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const googleChallengeId = params.get("googleChallenge");
    const googleError = params.get("googleError");
    if (!googleChallengeId && !googleError) return;

    if (googleChallengeId) {
      authApi
        .googleChallenge(googleChallengeId)
        .then((challenge) => {
          setMaskedEmail(challenge.maskedEmail);
          setExpiresAt(challenge.expiresAt);
          setResendAvailableAt(challenge.resendAvailableAt);
        })
        .catch((error) => {
          toast.error(normalizeApiError(error).message);
          setStep("credentials");
        });
    } else {
      toast.error(
        googleError === "cancelled"
          ? "Google sign-in was cancelled."
          : googleError === "delivery"
            ? "Google verified your email, but we couldn't send the sign-in code. Please try again."
            : googleError === "unavailable"
              ? "This account is not available for sign-in."
          : "Google sign-in could not be completed. Please try again.",
      );
    }

    const returnTo = params.get("returnTo");
    const nextSearch = returnTo
      ? `?returnTo=${encodeURIComponent(returnTo)}`
      : "";
    navigate(
      { pathname: location.pathname, search: nextSearch },
      { replace: true, state: location.state },
    );
  }, [location.pathname, location.search, location.state, navigate]);

  useEffect(() => {
    if (step !== "verify-google") return undefined;
    const updateCountdowns = () => {
      const now = Date.now();
      setCountdown(expiresAt ? Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 1000)) : 0);
      setResendCountdown(
        resendAvailableAt
          ? Math.max(0, Math.ceil((Date.parse(resendAvailableAt) - now) / 1000))
          : 0,
      );
    };
    updateCountdowns();
    const timer = window.setInterval(updateCountdowns, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt, resendAvailableAt, step]);

  const submit = async (values) => {
    setSubmitting(true);
    try {
      if (isRegister) {
        const result = await register({
          name: values.name,
          email: values.email,
          phone: values.phone || undefined,
          password: values.password,
        });
        setChallengeId(result.challengeId);
        setChallengeEmail(values.email);
        setOtp("");
        setStep("verify-registration");
        toast.success("A verification code has been sent to your email.");
      } else {
        await login({ email: values.email, password: values.password });
        toast.success("Welcome back to Nishree Creations.");
        navigate(safeDestination, { replace: true });
      }
    } catch (error) {
      toast.error(normalizeApiError(error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const submitRegistrationOtp = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await verifyRegistrationEmail({ challengeId, otp });
      toast.success("Your account is verified.");
      navigate(safeDestination, { replace: true });
    } catch (error) {
      toast.error(normalizeApiError(error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const submitGoogleOtp = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await verifyGoogleOtp({ challengeId, otp });
      toast.success("Signed in securely with Google.");
      navigate(safeDestination, { replace: true });
    } catch (error) {
      toast.error(normalizeApiError(error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const resendRegistrationCode = async () => {
    setSubmitting(true);
    try {
      await resendRegistrationOtp({ challengeId });
      setOtp("");
      toast.success("A new verification code has been sent to your email.");
    } catch (error) {
      toast.error(normalizeApiError(error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const resendGoogleCode = async () => {
    setSubmitting(true);
    try {
      const result = await resendGoogleOtp({ challengeId });
      setOtp("");
      setExpiresAt(result.expiresAt);
      setResendAvailableAt(result.resendAvailableAt);
      toast.success("A new sign-in code has been sent to your email.");
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
      if (result.emailSent === false) {
        toast.warning(
          "Your password changed, but the confirmation email could not be sent. Contact support if you did not request this change.",
        );
      } else {
        toast.success("Your password has been reset. Please sign in.");
      }
      navigate("/login", { replace: true });
    } catch (error) {
      toast.error(normalizeApiError(error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const beginGoogleLogin = () => {
    setGoogleLoading(true);
    authApi.startGoogleLogin(safeDestination);
  };

  const title =
    step === "verify-registration"
      ? "Check your email"
      : step === "verify-google"
        ? "One last step"
        : step === "forgot-email"
          ? "Reset your password"
          : step === "verify-reset"
            ? "Check your inbox"
            : step === "reset-password"
              ? "Choose a new password"
              : isRegister
                ? "Create Your Account"
                : "Welcome Back";
  const description =
    step === "verify-registration"
      ? `We sent a six-digit verification code to ${challengeEmail}.`
      : step === "verify-google"
        ? "Enter the code we sent to your verified Google email to finish signing in."
        : step === "forgot-email"
          ? "Enter your account email and we’ll send a secure password reset code."
          : step === "verify-reset"
            ? `Enter the password reset code sent to ${challengeEmail}.`
            : step === "reset-password"
              ? "Choose a unique password between 8 and 72 characters."
              : isRegister
                ? "Join us and get started today."
                : "Sign in to continue your journey.";

  if (sessionLoading) {
    return (
      <div className="auth-session-loading">
        <LoadingState label="Restoring your account…" />
      </div>
    );
  }
  if (user && !submitting) return <Navigate to={safeDestination} replace />;

  const isGoogleStep = step === "verify-google";
  const isOtpStep =
    step === "verify-registration" || step === "verify-google" || step === "verify-reset";

  return (
    <section className="nishree-auth" aria-label="Account access">
      <div className="auth-page-glow" aria-hidden="true" />
      <div className="auth-experience">
        <aside className="auth-story">
          <img
            src={authImage}
            alt="Traditional silk sarees displayed in the Nishree Creations boutique"
            className="auth-story-image"
            loading="eager"
            decoding="async"
          />
          <div className="auth-story-shade" />
          <div className="auth-story-content">
            <Link to="/" className="auth-brand auth-brand-light" aria-label="Nishree Attire home">
              <BrandMark light />
              <span><strong>NISHREE</strong><small>ATTIRE</small></span>
            </Link>
            <div className="auth-story-copy">
              <span className="auth-story-kicker"><span /> ELEGANCE IN EVERY THREAD</span>
              <h2>Tradition, made <em>personal.</em></h2>
              <p>Discover thoughtfully chosen pieces, crafted for the moments that become memories.</p>
            </div>
            <div className="auth-story-foot">
              <span className="auth-story-line" />
              <span>Thoughtfully curated, timelessly yours</span>
            </div>
          </div>
        </aside>

        <div className="auth-main">
          <Link to="/" className="auth-brand auth-brand-mobile" aria-label="Nishree Attire home">
            <BrandMark />
            <span><strong>NISHREE</strong><small>ATTIRE</small></span>
          </Link>

          <div className="auth-form-wrap">
            <header className="auth-heading" key={step}>
              <span className="auth-eyebrow">
                {isForgot ? "ACCOUNT RECOVERY" : isRegister ? "YOUR NISHREE ACCOUNT" : "WELCOME TO NISHREE"}
              </span>
              <h1>{title}</h1>
              <p>{description}</p>
            </header>

            {step === "credentials" && (
              <>
                {googleEnabled && (
                  <>
                    <button
                      className="auth-google-button"
                      type="button"
                      onClick={beginGoogleLogin}
                      disabled={googleLoading || submitting}
                    >
                      {googleLoading ? (
                        <LoaderCircle className="auth-spinner" size={19} aria-hidden="true" />
                      ) : (
                        <GoogleMark />
                      )}
                      <span>{googleLoading ? "Connecting to Google…" : "Continue with Google"}</span>
                    </button>
                    <div className="auth-divider"><span>or continue with email</span></div>
                  </>
                )}

                <form className="auth-form" onSubmit={handleSubmit(submit)} noValidate>
                  {isRegister && (
                    <div className="auth-field">
                      <label htmlFor="auth-name">Full name</label>
                      <div className={inputShell}>
                        <UserRound size={18} aria-hidden="true" />
                        <input
                          id="auth-name"
                          autoComplete="name"
                          placeholder="Your full name"
                          aria-invalid={Boolean(errors.name)}
                          aria-describedby={errors.name ? "auth-name-error" : undefined}
                          {...field("name")}
                        />
                      </div>
                      <FieldError error={errors.name} id="auth-name-error" />
                    </div>
                  )}

                  <div className="auth-field">
                    <label htmlFor="auth-email">Email address</label>
                    <div className={inputShell}>
                      <Mail size={18} aria-hidden="true" />
                      <input
                        id="auth-email"
                        type="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        aria-invalid={Boolean(errors.email)}
                        aria-describedby={errors.email ? "auth-email-error" : undefined}
                        {...field("email")}
                      />
                    </div>
                    <FieldError error={errors.email} id="auth-email-error" />
                  </div>

                  {isRegister && (
                    <div className="auth-field">
                      <label htmlFor="auth-phone">
                        Phone number <span className="auth-optional">Optional</span>
                      </label>
                      <div className={inputShell}>
                        <span className="auth-country-code">+91</span>
                        <input
                          id="auth-phone"
                          type="tel"
                          autoComplete="tel"
                          placeholder="98765 43210"
                          aria-invalid={Boolean(errors.phone)}
                          aria-describedby={errors.phone ? "auth-phone-error" : undefined}
                          {...field("phone")}
                        />
                      </div>
                      <FieldError error={errors.phone} id="auth-phone-error" />
                    </div>
                  )}

                  <div className="auth-field">
                    <div className="auth-label-row">
                      <label htmlFor="auth-password">Password</label>
                      {!isRegister && (
                        <Link className="auth-text-link" to="/forgot-password">Forgot password?</Link>
                      )}
                    </div>
                    <div className={inputShell}>
                      <LockKeyhole size={18} aria-hidden="true" />
                      <input
                        id="auth-password"
                        type={showPassword ? "text" : "password"}
                        autoComplete={isRegister ? "new-password" : "current-password"}
                        placeholder={isRegister ? "At least 8 characters" : "Enter your password"}
                        aria-invalid={Boolean(errors.password)}
                        aria-describedby={errors.password ? "auth-password-error" : undefined}
                        {...field("password")}
                      />
                      <button
                        className="auth-visibility-button"
                        type="button"
                        onClick={() => setShowPassword((shown) => !shown)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    <FieldError error={errors.password} id="auth-password-error" />
                    {isRegister && passwordValue && (
                      <div className="auth-password-strength" aria-live="polite">
                        <span className="auth-strength-bars" aria-hidden="true">
                          {[1, 2, 3].map((bar) => (
                            <span
                              className={bar <= strength ? `is-level-${strength}` : ""}
                              key={bar}
                            />
                          ))}
                        </span>
                        <span>{["Add a little more strength", "Fair password", "Good password", "Strong password"][strength]}</span>
                      </div>
                    )}
                  </div>

                  {isRegister && (
                    <>
                      <div className="auth-field">
                        <label htmlFor="auth-confirm-password">Confirm password</label>
                        <div className={inputShell}>
                          <KeyRound size={18} aria-hidden="true" />
                          <input
                            id="auth-confirm-password"
                            type={showConfirmPassword ? "text" : "password"}
                            autoComplete="new-password"
                            placeholder="Enter your password again"
                            aria-invalid={Boolean(errors.confirmPassword)}
                            aria-describedby={errors.confirmPassword ? "auth-confirm-password-error" : undefined}
                            {...field("confirmPassword")}
                          />
                          <button
                            className="auth-visibility-button"
                            type="button"
                            onClick={() => setShowConfirmPassword((shown) => !shown)}
                            aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                          >
                            {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                        <FieldError error={errors.confirmPassword} id="auth-confirm-password-error" />
                      </div>
                      <label className="auth-terms">
                        <input
                          type="checkbox"
                          aria-invalid={Boolean(errors.acceptedTerms)}
                          aria-describedby={errors.acceptedTerms ? "auth-terms-error" : undefined}
                          {...field("acceptedTerms")}
                        />
                        <span className="auth-checkbox" aria-hidden="true"><Check size={13} /></span>
                        <span>I agree to the <Link to="/policies/terms" target="_blank" rel="noreferrer">Terms and Conditions</Link>.</span>
                      </label>
                      <FieldError error={errors.acceptedTerms} id="auth-terms-error" />
                    </>
                  )}

                  <AuthButton submitting={submitting}>
                    {isRegister ? "Create account" : "Sign in"}
                  </AuthButton>
                </form>
              </>
            )}

            {isOtpStep && (
              <form
                className="auth-form auth-otp-form"
                onSubmit={isGoogleStep ? submitGoogleOtp : step === "verify-reset" ? verifyResetCode : submitRegistrationOtp}
              >
                {isGoogleStep && (
                  <div className="auth-verified-email">
                    <span className="auth-email-icon"><Mail size={17} /></span>
                    <span><small>Verification code sent to</small><strong>{maskedEmail || "your Google email"}</strong></span>
                    <ShieldCheck size={18} aria-label="Google email verified" />
                  </div>
                )}
                <div className="auth-field">
                  <label htmlFor="auth-otp">Six-digit verification code</label>
                  <div className={`${inputShell} auth-otp-control`}>
                    <ShieldCheck size={18} aria-hidden="true" />
                    <input
                      id="auth-otp"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      value={otp}
                      onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="000000"
                      aria-label="Six-digit verification code"
                      required
                    />
                  </div>
                </div>
                {isGoogleStep && (
                  <div className="auth-otp-meta" role="status">
                    {countdown > 0 ? (
                      <span>Code expires in <strong>{formatCountdown(countdown)}</strong></span>
                    ) : (
                      <span className="auth-expired-message">This code has expired. Start Google sign-in again.</span>
                    )}
                  </div>
                )}
                <AuthButton submitting={submitting} disabled={otp.length !== 6}>
                  {isGoogleStep ? "Verify and sign in" : "Verify code"}
                </AuthButton>
                {step === "verify-registration" && (
                  <button
                    className="auth-secondary-action"
                    type="button"
                    onClick={resendRegistrationCode}
                    disabled={submitting}
                  >
                    <RefreshCw size={15} /> Send a new code
                  </button>
                )}
                {isGoogleStep && countdown > 0 && (
                  <button
                    className="auth-secondary-action"
                    type="button"
                    onClick={resendGoogleCode}
                    disabled={submitting || resendCountdown > 0}
                  >
                    <RefreshCw size={15} />
                    {resendCountdown > 0 ? `Resend code in ${formatCountdown(resendCountdown)}` : "Resend code"}
                  </button>
                )}
                <button
                  className="auth-back-action"
                  type="button"
                  onClick={() => {
                    if (isGoogleStep) {
                      setStep("credentials");
                      setOtp("");
                    } else if (step === "verify-reset") {
                      setStep("forgot-email");
                    } else {
                      setStep("credentials");
                    }
                  }}
                >
                  <ArrowLeft size={15} />
                  {isGoogleStep ? "Back to sign in" : step === "verify-reset" ? "Use a different email" : "Return to account details"}
                </button>
              </form>
            )}

            {step === "forgot-email" && (
              <form className="auth-form" onSubmit={requestResetCode}>
                <div className="auth-field">
                  <label htmlFor="recovery-email">Email address</label>
                  <div className={inputShell}>
                    <Mail size={18} aria-hidden="true" />
                    <input
                      id="recovery-email"
                      type="email"
                      autoComplete="email"
                      maxLength={254}
                      value={recoveryEmail}
                      onChange={(event) => setRecoveryEmail(event.target.value)}
                      placeholder="you@example.com"
                      required
                    />
                  </div>
                </div>
                <AuthButton submitting={submitting} disabled={!recoveryEmail.trim()}>
                  Send reset code
                </AuthButton>
              </form>
            )}

            {step === "reset-password" && (
              <form className="auth-form" onSubmit={submitNewPassword}>
                <div className="auth-field">
                  <label htmlFor="new-password">New password</label>
                  <div className={inputShell}>
                    <LockKeyhole size={18} aria-hidden="true" />
                    <input
                      id="new-password"
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
                <div className="auth-field">
                  <label htmlFor="confirm-new-password">Confirm new password</label>
                  <div className={inputShell}>
                    <LockKeyhole size={18} aria-hidden="true" />
                    <input
                      id="confirm-new-password"
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      maxLength={72}
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder="Enter it once more"
                      required
                    />
                  </div>
                  {confirmPassword && (
                    <span className={`auth-match-message${confirmPassword === newPassword ? " is-match" : ""}`}>
                      {confirmPassword === newPassword ? "Passwords match" : "Passwords do not match yet"}
                    </span>
                  )}
                </div>
                <AuthButton submitting={submitting} disabled={!newPassword || !confirmPassword}>
                  Reset password
                </AuthButton>
              </form>
            )}

            <footer className="auth-form-footer">
              {step === "credentials" && (
                <p>
                  {isRegister ? "Already have an account?" : "New to Nishree Creations?"}{" "}
                  <Link to={switchTo} state={location.state}>
                    {isRegister ? "Sign in" : "Create account"}
                  </Link>
                </p>
              )}
              {isForgot && step === "forgot-email" && (
                <p>Remembered your password? <Link to="/login">Sign in</Link></p>
              )}
              {step !== "credentials" && step !== "forgot-email" && step !== "reset-password" && (
                <p><Link to="/login">Return to sign in</Link></p>
              )}
              {step === "reset-password" && (
                <p><Link to="/login">Return to sign in</Link></p>
              )}
              <div className="auth-security-note">
                <ShieldCheck size={16} aria-hidden="true" />
                <span>Your account is protected with secure session handling.</span>
              </div>
            </footer>
          </div>
        </div>
      </div>
      <p className="auth-copyright">© {new Date().getFullYear()} Nishree Attire <span>·</span> Elegance in every thread</p>
    </section>
  );
}
