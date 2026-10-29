// Medplum client credentials come from src/config.local.ts, which is
// gitignored (copy src/config.local.example.ts). Without it the app runs
// fully offline and the sync button explains what is missing.
export type MedplumConfig = {
  baseUrl: string; // e.g. https://api.medplum.com/
  clientId: string;
  clientSecret: string;
};

let local: MedplumConfig | null = null;
try {
  // Optional: Metro and Jest both tolerate a missing module inside try/catch.
  local = require('./config.local').MEDPLUM;
} catch {}

export const MEDPLUM: MedplumConfig | null = local?.clientId ? local : null;
