const MOD_KEY = 'gaw_dash_mod_token';
const LEAD_KEY = 'gaw_dash_lead_token';

export function saveTokens(tokens: { mod: string; lead?: string }): void {
  localStorage.setItem(MOD_KEY, tokens.mod);
  if (tokens.lead && tokens.lead.length > 0) {
    localStorage.setItem(LEAD_KEY, tokens.lead);
  }
}

export function clearTokens(): void {
  localStorage.removeItem(MOD_KEY);
  localStorage.removeItem(LEAD_KEY);
}

export function getModToken(): string | null {
  return localStorage.getItem(MOD_KEY);
}

export function getLeadToken(): string | null {
  return localStorage.getItem(LEAD_KEY);
}

export function isLead(): boolean {
  const t = getLeadToken();
  return t !== null && t.length > 0;
}
