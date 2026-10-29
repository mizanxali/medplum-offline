import type { MedplumConfig } from './config';

// Copy to src/config.local.ts. Use a Medplum project that holds synthetic data
// only: a ClientApplication's secret ships inside the app bundle.
export const MEDPLUM: MedplumConfig = {
  baseUrl: 'https://api.medplum.com/',
  clientId: '',
  clientSecret: '',
};
