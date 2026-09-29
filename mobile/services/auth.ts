type AuthResult = { ok: true } | { ok: false; message: string };

export async function signIn(email: string, password: string): Promise<AuthResult> {
  await new Promise((resolve) => setTimeout(resolve, 250));

  if (!email.trim() || !password.trim()) {
    return { ok: false, message: 'Enter both an email and password.' };
  }

  // Prototype only. Replace with Supabase Auth later.
  return { ok: true };
}
