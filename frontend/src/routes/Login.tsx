import { ArrowLeft } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';

import { ApiError } from '@/api/client';
import * as authApi from '@/api/endpoints/auth';
import { useAuth } from '@/auth/AuthProvider';
import { InlineError } from '@/components/domain/States';
import { Button } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/Input';

// Mirrors the backend's own rules so a typo is caught before it costs a
// round trip. The backend still validates authoritatively.
const emailSchema = z.string().trim().min(1, 'Enter your email').pipe(z.email('Enter a valid email address'));
const nameSchema = z.string().trim().min(1, 'Enter your name').max(100, 'That name is too long');
const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, 'Include the country code, e.g. +919876543210');

// Backend defaults: OTP_TTL_SECONDS 300, OTP_RESEND_COOLDOWN_SECONDS 60.
const RESEND_COOLDOWN_SECONDS = 60;

type Step = 'email' | 'code';

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, status } = useAuth();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  // Revealed only after the backend says this email has no account
  // (SIGNUP_DETAILS_REQUIRED). Because that check runs *before* the OTP is
  // consumed, the same code can be resubmitted — so returning users never see
  // these fields, and new users never have to ask for a second code.
  const [needsSignupDetails, setNeedsSignupDetails] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<unknown>(undefined);
  const [pending, setPending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const otpInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Where to land after signing in — set by RequireAuth when it bounced the
  // user here, so a search typed on the landing page survives the detour.
  const redirectTo = (location.state as { from?: { pathname: string; search: string } } | null)
    ?.from;

  useEffect(() => {
    if (status === 'authenticated') {
      navigate(redirectTo ? `${redirectTo.pathname}${redirectTo.search}` : '/', { replace: true });
    }
  }, [status, navigate, redirectTo]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => {
      setCooldown((current) => current - 1);
    }, 1000);
    return () => {
      window.clearTimeout(timer);
    };
  }, [cooldown]);

  // Move focus to whatever the user now has to fill in.
  useEffect(() => {
    if (step === 'code') otpInputRef.current?.focus();
  }, [step]);
  useEffect(() => {
    if (needsSignupDetails) nameInputRef.current?.focus();
  }, [needsSignupDetails]);

  // Shared by the initial send and the resend link.
  async function sendOtp(target: string) {
    setFieldErrors({});
    setError(undefined);
    setPending(true);
    try {
      await authApi.requestOtp(target);
      setEmail(target);
      setStep('code');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (caught) {
      // The backend answers request-otp identically whether or not the
      // account exists, so nothing here can leak which emails are registered.
      if (caught instanceof ApiError && caught.code === 'OTP_RESEND_COOLDOWN') {
        setStep('code');
        setCooldown(RESEND_COOLDOWN_SECONDS);
      } else {
        setError(caught);
      }
    } finally {
      setPending(false);
    }
  }

  async function handleRequestOtp(event: FormEvent) {
    event.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setFieldErrors({ email: parsed.error.issues[0]?.message ?? 'Enter a valid email address' });
      return;
    }
    await sendOtp(parsed.data);
  }

  async function handleVerify(event: FormEvent) {
    event.preventDefault();
    const errors: Record<string, string> = {};

    if (!/^\d{6}$/.test(otp)) errors.otp = 'Enter the 6-digit code';

    if (needsSignupDetails) {
      const parsedName = nameSchema.safeParse(name);
      if (!parsedName.success) errors.name = parsedName.error.issues[0]?.message ?? 'Enter your name';
      const parsedPhone = phoneSchema.safeParse(phone);
      if (!parsedPhone.success)
        errors.phone = parsedPhone.error.issues[0]?.message ?? 'Enter a valid phone number';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setError(undefined);
    setPending(true);
    try {
      const tokens = await authApi.verifyOtp({
        email,
        otp,
        ...(needsSignupDetails ? { name: name.trim(), phone: phone.trim() } : {}),
      });
      await signIn(tokens);
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'SIGNUP_DETAILS_REQUIRED') {
        // First time this email has been seen. The code is still valid.
        setNeedsSignupDetails(true);
        setError(undefined);
      } else if (
        caught instanceof ApiError &&
        (caught.code === 'OTP_EXPIRED' || caught.code === 'OTP_TOO_MANY_ATTEMPTS')
      ) {
        // Both destroy the stored code, so there is nothing left to retry
        // against — send the user back to request a fresh one.
        setError(caught);
        setStep('email');
        setOtp('');
        setCooldown(0);
      } else {
        setError(caught);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <div className="mb-8">
        <p className="text-xl font-semibold tracking-tight text-accent-700">Rydex</p>
        <h1 className="mt-6 text-2xl font-semibold text-ink">
          {step === 'email' ? 'Sign in or create an account' : 'Enter your code'}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {step === 'email'
            ? 'We’ll email you a 6-digit code. No password needed.'
            : `Sent to ${email}. It expires in 5 minutes.`}
        </p>
      </div>

      {step === 'email' ? (
        <form onSubmit={(event) => void handleRequestOtp(event)} className="space-y-4">
          <Field label="Email" error={fieldErrors.email} required>
            {({ id, describedBy }) => (
              <TextInput
                id={id}
                aria-describedby={describedBy}
                invalid={fieldErrors.email !== undefined}
                type="email"
                autoComplete="email"
                autoFocus
                placeholder="you@example.com"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                }}
              />
            )}
          </Field>

          {error !== undefined && <InlineError error={error} />}

          <Button type="submit" size="lg" loading={pending} className="w-full">
            Send code
          </Button>
        </form>
      ) : (
        <form onSubmit={(event) => void handleVerify(event)} className="space-y-4">
          <Field label="6-digit code" error={fieldErrors.otp} required>
            {({ id, describedBy }) => (
              <TextInput
                id={id}
                ref={otpInputRef}
                aria-describedby={describedBy}
                invalid={fieldErrors.otp !== undefined}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                className="text-center text-lg tracking-[0.5em]"
                value={otp}
                onChange={(event) => {
                  setOtp(event.target.value.replace(/\D/g, '').slice(0, 6));
                }}
              />
            )}
          </Field>

          {needsSignupDetails && (
            <div className="space-y-4 rounded-card border border-border-subtle bg-canvas p-4">
              <p className="text-sm text-ink-muted">
                Looks like you’re new here — just two more things.
              </p>
              <Field label="Full name" error={fieldErrors.name} required>
                {({ id, describedBy }) => (
                  <TextInput
                    id={id}
                    ref={nameInputRef}
                    aria-describedby={describedBy}
                    invalid={fieldErrors.name !== undefined}
                    autoComplete="name"
                    placeholder="Priya Sharma"
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value);
                    }}
                  />
                )}
              </Field>
              <Field
                label="Phone number"
                error={fieldErrors.phone}
                hint="Drivers use this to coordinate pickup once you’ve booked."
                required
              >
                {({ id, describedBy }) => (
                  <TextInput
                    id={id}
                    aria-describedby={describedBy}
                    invalid={fieldErrors.phone !== undefined}
                    type="tel"
                    autoComplete="tel"
                    placeholder="+919876543210"
                    value={phone}
                    onChange={(event) => {
                      setPhone(event.target.value);
                    }}
                  />
                )}
              </Field>
            </div>
          )}

          {error !== undefined && <InlineError error={error} />}

          <Button type="submit" size="lg" loading={pending} className="w-full">
            {needsSignupDetails ? 'Create account' : 'Sign in'}
          </Button>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => {
                setStep('email');
                setOtp('');
                setNeedsSignupDetails(false);
                setError(undefined);
              }}
              className="inline-flex items-center gap-1 text-sm text-ink-muted transition-colors hover:text-ink"
            >
              <ArrowLeft className="size-3.5" aria-hidden />
              Use a different email
            </button>

            <button
              type="button"
              disabled={cooldown > 0 || pending}
              onClick={() => void sendOtp(email)}
              className="text-sm text-accent-700 transition-colors hover:text-accent-800 disabled:cursor-not-allowed disabled:text-ink-faint"
            >
              {cooldown > 0 ? `Resend in ${String(cooldown)}s` : 'Resend code'}
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
