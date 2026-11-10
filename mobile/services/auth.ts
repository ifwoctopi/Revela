import { isSupabaseConfigured, supabase } from './supabase';

export type AuthResult = { ok: true; needsConfirmation?: boolean } | { ok: false; message: string };

// Mirrors the Supabase session so isSignedIn() stays synchronous for render-time checks.
let signedIn = false;
let restored: Promise<boolean> | null = null;

supabase.auth.onAuthStateChange((_event, session) => {
  signedIn = Boolean(session);
});

export function isSignedIn() {
  return signedIn;
}

/** Loads any persisted session once; resolves true when the user is already signed in. */
export function restoreSession(): Promise<boolean> {
  if (!restored) {
    restored = (async () => {
      if (!isSupabaseConfigured) return false;
      try {
        const { data } = await supabase.auth.getSession();
        signedIn = Boolean(data.session);
      } catch {
        signedIn = false;
      }
      return signedIn;
    })();
  }
  return restored;
}

function validate(email: string, password: string): string | null {
  if (!email.trim() || !password) return 'Enter both an email and password.';
  return null;
}

const NOT_CONFIGURED = 'Sign-in is not configured. Add the Supabase URL and anon key to .env.local.';

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const invalid = validate(email, password);
  if (invalid) return { ok: false, message: invalid };
  if (!isSupabaseConfigured) return { ok: false, message: NOT_CONFIGURED };

  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) return { ok: false, message: error.message };
  signedIn = true;
  return { ok: true };
}

export async function signUp(email: string, password: string): Promise<AuthResult> {
  const invalid = validate(email, password);
  if (invalid) return { ok: false, message: invalid };
  if (password.length < 8) return { ok: false, message: 'Use a password of at least 8 characters.' };
  if (!isSupabaseConfigured) return { ok: false, message: NOT_CONFIGURED };

  const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
  if (error) return { ok: false, message: error.message };
  // With email confirmation enabled Supabase returns a user but no session.
  if (!data.session) return { ok: true, needsConfirmation: true };
  signedIn = true;
  return { ok: true };
}

export async function signOut() {
  signedIn = false;
  if (isSupabaseConfigured) await supabase.auth.signOut();
}
