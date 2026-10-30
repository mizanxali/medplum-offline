// Where Medplum lives comes from src/config.local.ts, which is gitignored
// (copy src/config.local.example.ts). It holds no secret: a phone proves who
// it is by signing, after one sign-in that registers it. Without the file the
// app runs fully offline and says so.
let local: string | null = null;
try {
  // Optional: Metro and Jest both tolerate a missing module inside try/catch.
  local = require('./config.local').MEDPLUM_URL;
} catch {}

export const MEDPLUM_URL: string | null = local || null;
