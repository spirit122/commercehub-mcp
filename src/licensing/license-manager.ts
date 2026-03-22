/**
 * CommerceHub MCP - Gestor de licencias
 *
 * Valida licencias y controla acceso a herramientas según el plan.
 * Las licencias se validan contra un servidor remoto o localmente con una key.
 *
 * Formato de license key: CHUB-XXXX-XXXX-XXXX-XXXX
 */

import { createHash } from 'crypto';
import type { PlanType } from './plans.js';
import { PLANS, isToolAvailable, getMinimumPlan } from './plans.js';

/** Resultado de validación de licencia */
export interface LicenseValidation {
  valid: boolean;
  plan: PlanType;
  expiresAt: string | null;
  email: string | null;
  message: string;
}

/** Estado de uso diario */
interface UsageState {
  date: string;
  requestCount: number;
}

/**
 * Gestor de licencias de CommerceHub.
 */
export class LicenseManager {
  private currentPlan: PlanType = 'free';
  private licenseKey: string | null = null;
  private expiresAt: Date | null = null;
  private email: string | null = null;
  private usage: UsageState = { date: '', requestCount: 0 };

  constructor() {
    // Intentar cargar licencia desde variable de entorno
    const envKey = process.env.COMMERCEHUB_LICENSE_KEY;
    if (envKey) {
      this.validateKeyOffline(envKey);
    }
  }

  /**
   * Obtiene el plan actual.
   */
  getPlan(): PlanType {
    // Verificar expiración
    if (this.expiresAt && new Date() > this.expiresAt) {
      this.currentPlan = 'free';
      this.licenseKey = null;
      this.expiresAt = null;
    }
    return this.currentPlan;
  }

  /**
   * Obtiene información completa del plan actual.
   */
  getPlanInfo() {
    return PLANS[this.getPlan()];
  }

  /**
   * Verifica si una herramienta está disponible en el plan actual.
   * Retorna un objeto con el resultado y mensaje de upgrade si es necesario.
   */
  checkToolAccess(toolName: string): { allowed: boolean; message: string } {
    const plan = this.getPlan();

    if (isToolAvailable(toolName, plan)) {
      // Verificar límite de requests diarios
      const dailyCheck = this.checkDailyLimit();
      if (!dailyCheck.allowed) return dailyCheck;
      return { allowed: true, message: '' };
    }

    const requiredPlan = getMinimumPlan(toolName);
    const requiredInfo = PLANS[requiredPlan];

    return {
      allowed: false,
      message: [
        `La herramienta "${toolName}" requiere el plan ${requiredInfo.displayName} (${requiredInfo.price}).`,
        '',
        `Tu plan actual: ${PLANS[plan].displayName} (${PLANS[plan].price})`,
        '',
        'Para hacer upgrade:',
        '  1. Visita: https://commercehub.gumroad.com',
        '  2. Compra el plan ' + requiredInfo.displayName,
        '  3. Agrega tu license key en la variable de entorno:',
        '     COMMERCEHUB_LICENSE_KEY=CHUB-XXXX-XXXX-XXXX-XXXX',
        '',
        `Herramientas incluidas en ${requiredInfo.displayName}:`,
        ...requiredInfo.features.map((f) => `  - ${f}`),
      ].join('\n'),
    };
  }

  /**
   * Verifica el límite diario de requests.
   */
  private checkDailyLimit(): { allowed: boolean; message: string } {
    const today = new Date().toISOString().split('T')[0];
    const plan = PLANS[this.currentPlan];

    if (this.usage.date !== today) {
      this.usage = { date: today, requestCount: 0 };
    }

    this.usage.requestCount++;

    if (this.usage.requestCount > plan.maxRequestsPerDay) {
      return {
        allowed: false,
        message: [
          `Has alcanzado el limite diario de ${plan.maxRequestsPerDay} requests para el plan ${plan.displayName}.`,
          '',
          'Opciones:',
          '  - Espera hasta manana para continuar',
          `  - Upgrade a ${this.currentPlan === 'free' ? 'Pro ($49/mes)' : 'Business ($199/mes)'} para mas requests`,
          '  - Visita: https://commercehub.gumroad.com',
        ].join('\n'),
      };
    }

    return { allowed: true, message: '' };
  }

  /**
   * Valida una license key offline usando hash.
   *
   * Formato: CHUB-{plan}-{hash}-{expiry}-{check}
   * Ejemplo: CHUB-PRO-A1B2-2612-C3D4
   */
  private validateKeyOffline(key: string): LicenseValidation {
    if (!key || !key.startsWith('CHUB-')) {
      return {
        valid: false,
        plan: 'free',
        expiresAt: null,
        email: null,
        message: 'License key invalida. Formato esperado: CHUB-XXXX-XXXX-XXXX-XXXX',
      };
    }

    const parts = key.split('-');
    if (parts.length < 5) {
      return {
        valid: false,
        plan: 'free',
        expiresAt: null,
        email: null,
        message: 'License key invalida. Formato incorrecto.',
      };
    }

    // Extraer plan del key
    const planCode = parts[1].toUpperCase();
    let plan: PlanType = 'free';

    if (planCode === 'PRO' || planCode === 'P') {
      plan = 'pro';
    } else if (planCode === 'BIZ' || planCode === 'B' || planCode === 'BUSINESS') {
      plan = 'business';
    }

    // Extraer fecha de expiración (YYMM format)
    const expiryCode = parts[3];
    let expiresAt: Date | null = null;

    if (expiryCode && expiryCode.length === 4) {
      const year = 2000 + parseInt(expiryCode.slice(0, 2), 10);
      const month = parseInt(expiryCode.slice(2, 4), 10);
      if (!isNaN(year) && !isNaN(month) && month >= 1 && month <= 12) {
        expiresAt = new Date(year, month, 0); // Último día del mes
      }
    }

    // Verificar checksum simple
    const payload = parts.slice(0, 4).join('-');
    const expectedCheck = createHash('md5')
      .update(payload + 'commercehub-salt-2026')
      .digest('hex')
      .slice(0, 4)
      .toUpperCase();
    const actualCheck = parts[4].toUpperCase();

    if (actualCheck !== expectedCheck) {
      // En modo development, aceptar cualquier key válida en formato
      if (process.env.NODE_ENV !== 'production') {
        // Aceptar en dev
      } else {
        return {
          valid: false,
          plan: 'free',
          expiresAt: null,
          email: null,
          message: 'License key invalida. Checksum incorrecto.',
        };
      }
    }

    // Verificar expiración
    if (expiresAt && new Date() > expiresAt) {
      return {
        valid: false,
        plan: 'free',
        expiresAt: expiresAt.toISOString(),
        email: null,
        message: `Tu licencia ${PLANS[plan].displayName} expiro el ${expiresAt.toLocaleDateString()}. Renueva en https://commercehub.gumroad.com`,
      };
    }

    // Licencia válida
    this.currentPlan = plan;
    this.licenseKey = key;
    this.expiresAt = expiresAt;

    return {
      valid: true,
      plan,
      expiresAt: expiresAt?.toISOString() ?? null,
      email: this.email,
      message: `Licencia ${PLANS[plan].displayName} activada correctamente.`,
    };
  }

  /**
   * Activa una licencia manualmente.
   */
  activate(key: string): LicenseValidation {
    return this.validateKeyOffline(key);
  }

  /**
   * Retorna el estado actual de la licencia.
   */
  getStatus(): {
    plan: PlanType;
    planInfo: typeof PLANS[PlanType];
    licenseKey: string | null;
    expiresAt: string | null;
    requestsToday: number;
    requestsLimit: number;
  } {
    const plan = this.getPlan();
    const planInfo = PLANS[plan];
    const today = new Date().toISOString().split('T')[0];

    return {
      plan,
      planInfo,
      licenseKey: this.licenseKey
        ? this.licenseKey.slice(0, 9) + '****-****'
        : null,
      expiresAt: this.expiresAt?.toISOString() ?? null,
      requestsToday: this.usage.date === today ? this.usage.requestCount : 0,
      requestsLimit: planInfo.maxRequestsPerDay,
    };
  }
}

/** Instancia global del license manager */
let _instance: LicenseManager | null = null;

/**
 * Obtiene la instancia singleton del LicenseManager.
 */
export function getLicenseManager(): LicenseManager {
  if (!_instance) {
    _instance = new LicenseManager();
  }
  return _instance;
}
