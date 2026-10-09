type AuthResult = { ok: true } | { ok: false; message: string };

// In-memory for the prototype: every launch starts at the welcome screen.
let signedIn = false;

export function isSignedIn() {
  return signedIn;
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  await new Promise((resolve) => setTimeout(resolve, 250));

  if (!email.trim() || !password.trim()) {
    return { ok: false, message: 'Enter both an email and password.' };
  }

  // Prototype only. Replace with Supabase Auth later.
  signedIn = true;
  return { ok: true };
}
