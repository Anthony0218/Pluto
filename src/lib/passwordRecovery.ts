export function passwordResetUrl(origin: string) {
  return new URL('/reset-password', origin).href;
}

export function passwordResetValidation(password: string, confirmation: string): 'short' | 'mismatch' | null {
  if (password.length < 8) return 'short';
  if (password !== confirmation) return 'mismatch';
  return null;
}

export function hasRecoveryError(search: string, hash: string) {
  const query = new URLSearchParams(search);
  const fragment = new URLSearchParams(hash.replace(/^#/, ''));
  return [query, fragment].some(params => params.has('error') || params.has('error_code'));
}
