/**
 * CommerceHub MCP - Sistema de licencias
 *
 * Exports del modulo de licencias con validacion online via LemonSqueezy,
 * cache encriptado, machine fingerprinting y protecciones anti-tampering.
 */

// Planes y tipos
export {
  type PlanType,
  type PlanInfo,
  PLANS,
  getPlan,
  isToolAvailable,
  getBlockedTools,
  getMinimumPlan,
  verifyToolsIntegrity,
  verifyFileIntegrity,
  getCurrentFileHash,
} from './plans.js';

// Gestor de licencias
export {
  LicenseManager,
  getLicenseManager,
  type LicenseValidation,
} from './license-manager.js';

// Guards para herramientas
export {
  withLicenseGuard,
  withRuntimeGuard,
  guardTools,
} from './tool-guard.js';

// Criptografia y utilidades de seguridad
export {
  getMachineFingerprint,
  deriveKey,
  encryptData,
  decryptData,
  getLicenseCachePath,
  saveLicenseCache,
  loadLicenseCache,
  getFileIntegrityHash,
  hashLicenseKey,
  deleteLicenseCache,
  type LicenseCacheData,
} from './license-crypto.js';
