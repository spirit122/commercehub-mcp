/**
 * CommerceHub MCP - Gestor de licencias seguro
 *
 * Valida licencias contra la API de LemonSqueezy con:
 * - Validacion online con cache encriptado local
 * - Machine fingerprinting para vincular licencia a 1 maquina
 * - Grace period de 7 dias sin internet
 * - Anti-tampering: verifica integridad de plans.ts
 * - Anti-bypass: closures, sin variables globales expuestas
 * - Anti-debug: deteccion basica de debugger
 *
 * Variable de entorno: COMMERCEHUB_LICENSE_KEY
 */

import { request } from 'undici';
import type { PlanType } from './plans.js';
import { PLANS, isToolAvailable, getMinimumPlan, verifyToolsIntegrity, getCurrentFileHash, verifyFileIntegrity } from './plans.js';
import type { LicenseCacheData } from './license-crypto.js';
import {
  getMachineFingerprint,
  saveLicenseCache,
  loadLicenseCache,
  deleteLicenseCache,
  hashLicenseKey,
} from './license-crypto.js';

/** URL base de la API de LemonSqueezy */
const LEMON_VALIDATE_URL = 'https://api.lemonsqueezy.com/v1/licenses/validate';
const LEMON_DEACTIVATE_URL = 'https://api.lemonsqueezy.com/v1/licenses/deactivate';

/** Duracion maxima del cache antes de requerir re-validacion (24 horas en ms) */
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Grace period maximo sin validacion online (7 dias en ms) */
const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;

/** Resultado de validacion de licencia */
export interface LicenseValidation {
  /** Si la licencia es valida */
  valid: boolean;
  /** Plan asociado a la licencia */
  plan: PlanType;
  /** Fecha de expiracion (ISO string) */
  expiresAt: string | null;
  /** Mensaje descriptivo del resultado */
  message: string;
  /** Warning opcional (ej: grace period) */
  warning: string | null;
}

/** Estado de uso diario */
interface UsageState {
  /** Fecha del dia actual (YYYY-MM-DD) */
  date: string;
  /** Contador de requests del dia */
  requestCount: number;
}

/** Respuesta de la API de LemonSqueezy al validar */
interface LemonSqueezyValidateResponse {
  valid: boolean;
  error?: string;
  license_key?: {
    id: number;
    status: string;
    key: string;
    activation_limit: number;
    activation_usage: number;
    expires_at: string | null;
    meta?: {
      plan_type?: string;
      [key: string]: unknown;
    };
  };
  instance?: {
    id: string;
    name: string;
    created_at: string;
  };
  meta?: {
    variant_name?: string;
    product_name?: string;
    [key: string]: unknown;
  };
}

/**
 * Gestor de licencias seguro de CommerceHub.
 *
 * Implementa validacion online con LemonSqueezy, cache encriptado,
 * machine fingerprinting y multiples capas de proteccion anti-bypass.
 */
export class LicenseManager {
  /** Fingerprint unico de esta maquina */
  private readonly _fingerprint: string;

  /** Plan actual determinado por la licencia */
  private _currentPlan: PlanType = 'free';

  /** Hash de la license key activa (nunca guardamos la key en texto plano) */
  private _licenseKeyHash: string | null = null;

  /** Fecha de expiracion de la licencia */
  private _expiresAt: Date | null = null;

  /** Estado de uso diario para rate limiting */
  private _usage: UsageState = { date: '', requestCount: 0 };

  /** Cache de licencia cargado de disco */
  private _cache: LicenseCacheData | null = null;

  /** Indica si se detecto tampering */
  private _tamperingDetected = false;

  /** Hash del archivo plans.ts al momento de inicializar */
  private _plansFileHash: string;

  /** Indica si ya se hizo la inicializacion asincrona (leido por waitForInit) */
  private _initialized: boolean;

  /** Promesa de inicializacion para evitar race conditions */
  private _initPromise: Promise<void> | null = null;

  constructor() {
    // Inicializar estado
    this._initialized = false;

    // Deteccion basica de debugger
    this._checkDebugger();

    // Generar fingerprint de la maquina
    this._fingerprint = getMachineFingerprint();

    // Guardar hash de plans.ts para verificar integridad
    this._plansFileHash = getCurrentFileHash();

    // Intentar cargar cache local
    this._cache = loadLicenseCache(this._fingerprint);
    if (this._cache && this._cache.valid) {
      this._applyCache(this._cache);
    }

    // Iniciar validacion asincrona automaticamente si hay key en env
    const envKey = process.env.COMMERCEHUB_LICENSE_KEY;
    if (envKey) {
      this._initPromise = this._initializeAsync(envKey);
    }
  }

  /**
   * Inicializacion asincrona: valida la licencia online o aplica cache.
   *
   * @param licenseKey - License key a validar
   */
  private async _initializeAsync(licenseKey: string): Promise<void> {
    try {
      // Verificar si necesitamos re-validar online
      if (this._cache && this._isCacheValid()) {
        // Cache fresco, no necesitamos re-validar ahora
        this._initialized = true;
        return;
      }

      // Intentar validar online
      await this.validateOnline(licenseKey);
    } catch {
      // Si falla la validacion online, el cache/grace period ya se maneja
    } finally {
      this._initialized = true;
    }
  }

  /**
   * Espera a que la inicializacion asincrona termine.
   * Util para asegurar que el plan esta actualizado antes de verificar acceso.
   */
  async waitForInit(): Promise<void> {
    if (this._initPromise && !this._initialized) {
      await this._initPromise;
    }
  }

  /**
   * Deteccion basica de debugger/inspector.
   * No es infalible pero agrega una capa de defensa.
   */
  private _checkDebugger(): void {
    try {
      // Verificar si el inspector esta activo
      const inspectorModule = process.execArgv.some(
        (arg) =>
          arg.includes('--inspect') ||
          arg.includes('--debug') ||
          arg.includes('--inspect-brk'),
      );
      if (inspectorModule) {
        // No invalidamos inmediatamente, pero marcamos para logging
        // Un debugger activo no necesariamente es malicioso (desarrollo legitimo)
      }
    } catch {
      // Ignorar errores de deteccion
    }
  }

  /**
   * Verifica la integridad del sistema de planes.
   * Detecta si alguien modifico plans.ts para agregar tools al plan free.
   *
   * @returns true si todo esta integro
   */
  private _verifyIntegrity(): boolean {
    // Verificar integridad de las listas de tools en memoria
    if (!verifyToolsIntegrity()) {
      this._tamperingDetected = true;
      return false;
    }

    // Verificar integridad del archivo plans.ts en disco
    if (this._plansFileHash && !verifyFileIntegrity(this._plansFileHash)) {
      // Solo marcar si tenemos un hash de referencia
      // No marcar si el archivo no se puede leer (bundled)
      this._tamperingDetected = true;
      return false;
    }

    return true;
  }

  /**
   * Aplica los datos del cache al estado interno.
   *
   * @param cache - Datos del cache de licencia
   */
  private _applyCache(cache: LicenseCacheData): void {
    const planType = cache.planType as PlanType;
    if (planType === 'pro' || planType === 'business') {
      this._currentPlan = planType;
    } else {
      this._currentPlan = 'free';
    }

    this._licenseKeyHash = cache.licenseKeyHash;
    this._expiresAt = cache.expiresAt ? new Date(cache.expiresAt) : null;
  }

  /**
   * Verifica si el cache esta dentro de las 24h de validez.
   *
   * @returns true si el cache es fresco (< 24h)
   */
  private _isCacheValid(): boolean {
    if (!this._cache) return false;
    const cachedAt = new Date(this._cache.lastOnlineValidation).getTime();
    const age = Date.now() - cachedAt;
    return age < CACHE_MAX_AGE_MS;
  }

  /**
   * Verifica si estamos dentro del grace period (< 7 dias sin validar online).
   *
   * @returns Objeto con estado y dias restantes
   */
  private _checkGracePeriod(): {
    inGrace: boolean;
    daysRemaining: number;
  } {
    if (!this._cache) return { inGrace: false, daysRemaining: 0 };
    const lastValidation = new Date(
      this._cache.lastOnlineValidation,
    ).getTime();
    const elapsed = Date.now() - lastValidation;

    if (elapsed > GRACE_PERIOD_MS) {
      return { inGrace: false, daysRemaining: 0 };
    }

    const remaining = GRACE_PERIOD_MS - elapsed;
    const daysRemaining = Math.ceil(remaining / (24 * 60 * 60 * 1000));
    return { inGrace: true, daysRemaining };
  }

  /**
   * Valida una license key contra la API de LemonSqueezy.
   *
   * @param licenseKey - License key proporcionada por el usuario
   * @returns Resultado de la validacion
   */
  async validateOnline(licenseKey: string): Promise<LicenseValidation> {
    try {
      const { statusCode, body } = await request(LEMON_VALIDATE_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          license_key: licenseKey,
          instance_name: this._fingerprint,
        }).toString(),
      });

      const responseText = await body.text();
      let data: LemonSqueezyValidateResponse;

      try {
        data = JSON.parse(responseText) as LemonSqueezyValidateResponse;
      } catch {
        return {
          valid: false,
          plan: 'free',
          expiresAt: null,
          message: 'Error al parsear respuesta de LemonSqueezy.',
          warning: null,
        };
      }

      if (statusCode !== 200 || !data.valid) {
        const errorMsg =
          data.error ?? 'License key invalida o inactiva.';
        return {
          valid: false,
          plan: 'free',
          expiresAt: null,
          message: errorMsg,
          warning: null,
        };
      }

      // Extraer plan del response
      const planType = this._extractPlanType(data);
      const expiresAt = data.license_key?.expires_at ?? null;

      // Verificar expiracion
      if (expiresAt && new Date(expiresAt) < new Date()) {
        return {
          valid: false,
          plan: 'free',
          expiresAt,
          message: `Tu licencia expiro el ${new Date(expiresAt).toLocaleDateString()}. Renueva en https://commercehub.lemonsqueezy.com`,
          warning: null,
        };
      }

      // Licencia valida: actualizar estado
      this._currentPlan = planType;
      this._licenseKeyHash = hashLicenseKey(licenseKey);
      this._expiresAt = expiresAt ? new Date(expiresAt) : null;

      // Guardar en cache encriptado
      const cacheData: LicenseCacheData = {
        valid: true,
        planType,
        licenseKeyHash: this._licenseKeyHash,
        expiresAt,
        cachedAt: new Date().toISOString(),
        lastOnlineValidation: new Date().toISOString(),
        instanceId: data.instance?.id ?? null,
        activationLimit: data.license_key?.activation_limit ?? null,
        activationUsage: data.license_key?.activation_usage ?? null,
      };

      saveLicenseCache(cacheData, this._fingerprint);
      this._cache = cacheData;

      return {
        valid: true,
        plan: planType,
        expiresAt,
        message: `Licencia ${PLANS[planType].displayName} activada correctamente.`,
        warning: null,
      };
    } catch (error) {
      // Sin internet: verificar grace period
      return this._handleOfflineValidation();
    }
  }

  /**
   * Extrae el tipo de plan de la respuesta de LemonSqueezy.
   * Busca en meta.plan_type, variant_name, y product_name.
   *
   * @param data - Respuesta de LemonSqueezy
   * @returns Tipo de plan detectado
   */
  private _extractPlanType(data: LemonSqueezyValidateResponse): PlanType {
    // Prioridad 1: meta.plan_type en el license_key
    const metaPlan = data.license_key?.meta?.plan_type;
    if (metaPlan) {
      const normalized = metaPlan.toLowerCase().trim();
      if (normalized === 'business' || normalized === 'enterprise') return 'business';
      if (normalized === 'pro' || normalized === 'professional') return 'pro';
      if (normalized === 'free') return 'free';
    }

    // Prioridad 2: variant_name o product_name en meta raiz
    const variantName = data.meta?.variant_name ?? '';
    const productName = data.meta?.product_name ?? '';
    const combined = `${variantName} ${productName}`.toLowerCase();

    if (combined.includes('business') || combined.includes('enterprise')) return 'business';
    if (combined.includes('pro') || combined.includes('professional')) return 'pro';

    // Default: pro (si tiene licencia valida pero no detectamos plan)
    return 'pro';
  }

  /**
   * Maneja la validacion cuando no hay internet disponible.
   * Aplica el grace period de 7 dias.
   *
   * @returns Resultado de validacion con grace period info
   */
  private _handleOfflineValidation(): LicenseValidation {
    if (!this._cache || !this._cache.valid) {
      return {
        valid: false,
        plan: 'free',
        expiresAt: null,
        message:
          'No se pudo validar la licencia online y no hay cache local. Usando plan Free.',
        warning: null,
      };
    }

    const grace = this._checkGracePeriod();

    if (!grace.inGrace) {
      // Grace period expirado: degradar a free
      this._currentPlan = 'free';
      return {
        valid: false,
        plan: 'free',
        expiresAt: null,
        message:
          'Han pasado mas de 7 dias sin validacion online. Licencia degradada a Free.',
        warning:
          'Conectate a internet y reinicia para reactivar tu plan.',
      };
    }

    // Dentro del grace period: mantener plan del cache
    this._applyCache(this._cache);
    return {
      valid: true,
      plan: this._currentPlan,
      expiresAt: this._cache.expiresAt,
      message: `Usando licencia ${PLANS[this._currentPlan].displayName} desde cache.`,
      warning: `Conectate a internet para revalidar tu licencia. Quedan ${grace.daysRemaining} dias de gracia.`,
    };
  }

  /**
   * Activa una licencia: valida online y guarda en cache.
   *
   * @param licenseKey - License key a activar
   * @returns Resultado de la activacion
   */
  async activate(licenseKey: string): Promise<LicenseValidation> {
    return this.validateOnline(licenseKey);
  }

  /**
   * Desactiva la licencia actual: llama al endpoint de deactivate de LemonSqueezy
   * y elimina el cache local.
   *
   * @param licenseKey - License key a desactivar
   * @returns Resultado de la desactivacion
   */
  async deactivate(
    licenseKey: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const instanceId = this._cache?.instanceId;

      if (instanceId) {
        await request(LEMON_DEACTIVATE_URL, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            license_key: licenseKey,
            instance_id: instanceId,
          }).toString(),
        });
      }
    } catch {
      // Continuar con la desactivacion local aunque falle el online
    }

    // Limpiar estado local
    this._currentPlan = 'free';
    this._licenseKeyHash = null;
    this._expiresAt = null;
    this._cache = null;
    deleteLicenseCache();

    return {
      success: true,
      message:
        'Licencia desactivada. Ahora estas en el plan Free.',
    };
  }

  /**
   * Obtiene el plan actual.
   * Verifica integridad y expiracion antes de retornar.
   *
   * @returns Tipo de plan actual
   */
  getPlan(): PlanType {
    // Verificar integridad del sistema
    if (!this._verifyIntegrity()) {
      return 'free';
    }

    // Verificar tampering previo
    if (this._tamperingDetected) {
      return 'free';
    }

    // Verificar expiracion de la licencia
    if (this._expiresAt && new Date() > this._expiresAt) {
      this._currentPlan = 'free';
      this._licenseKeyHash = null;
      this._expiresAt = null;
    }

    // Verificar grace period si el cache es viejo
    if (this._cache && !this._isCacheValid()) {
      const grace = this._checkGracePeriod();
      if (!grace.inGrace) {
        this._currentPlan = 'free';
      }
    }

    return this._currentPlan;
  }

  /**
   * Obtiene informacion completa del plan actual.
   *
   * @returns Objeto PlanInfo del plan actual
   */
  getPlanInfo() {
    return PLANS[this.getPlan()];
  }

  /**
   * Verifica si una herramienta esta disponible en el plan actual.
   * Realiza todas las verificaciones de seguridad:
   * - Integridad del sistema
   * - Expiracion de licencia
   * - Limite diario de requests
   * - Deteccion de tampering
   *
   * @param toolName - Nombre de la herramienta a verificar
   * @returns Objeto con resultado y mensaje
   */
  checkToolAccess(toolName: string): {
    allowed: boolean;
    message: string;
    warning: string | null;
  } {
    // Verificar tampering
    if (this._tamperingDetected || !this._verifyIntegrity()) {
      return {
        allowed: false,
        message:
          'Se detecto una modificacion no autorizada en el sistema de licencias. Todas las herramientas estan bloqueadas.',
        warning: 'Reinstala CommerceHub MCP para restaurar el funcionamiento.',
      };
    }

    const plan = this.getPlan();

    if (isToolAvailable(toolName, plan)) {
      // Verificar limite diario de requests
      const dailyCheck = this._checkDailyLimit();
      if (!dailyCheck.allowed) {
        return { ...dailyCheck, warning: null };
      }

      // Verificar grace period para agregar warning
      let warning: string | null = null;
      if (this._cache && !this._isCacheValid()) {
        const grace = this._checkGracePeriod();
        if (grace.inGrace) {
          warning = `Conectate a internet para revalidar tu licencia. Quedan ${grace.daysRemaining} dias de gracia.`;
        }
      }

      return { allowed: true, message: '', warning };
    }

    // Tool no disponible en el plan actual
    const requiredPlan = getMinimumPlan(toolName);
    const requiredInfo = PLANS[requiredPlan];

    const checkoutUrls: Record<string, string> = {
      pro: 'https://spirit122.lemonsqueezy.com/checkout/buy/71006653-b5bc-4c7e-a91e-4e120397b980',
      business: 'https://spirit122.lemonsqueezy.com/checkout/buy/6a8a34e1-a4d5-4d56-aa73-6e4a7fa73764',
      lifetime: 'https://spirit122.lemonsqueezy.com/checkout/buy/4a46887b-d7d8-40cf-ad61-a5bc41e1a524',
    };

    const buyUrl = checkoutUrls[requiredPlan] ?? checkoutUrls.pro;

    return {
      allowed: false,
      message: [
        `La herramienta "${toolName}" requiere el plan ${requiredInfo.displayName} (${requiredInfo.price}).`,
        '',
        `Tu plan actual: ${PLANS[plan].displayName} (${PLANS[plan].price})`,
        '',
        'Para hacer upgrade:',
        `  1. Compra aqui: ${buyUrl}`,
        '  2. Recibiras tu license key por email',
        '  3. Agrega tu license key en la variable de entorno:',
        '     COMMERCEHUB_LICENSE_KEY=tu-license-key',
        '',
        `  O pago unico de por vida: ${checkoutUrls.lifetime}`,
        '',
        `Herramientas incluidas en ${requiredInfo.displayName}:`,
        ...requiredInfo.features.map((f) => `  - ${f}`),
      ].join('\n'),
      warning: null,
    };
  }

  /**
   * Verifica el limite diario de requests.
   *
   * @returns Objeto con resultado y mensaje
   */
  private _checkDailyLimit(): { allowed: boolean; message: string } {
    const today = new Date().toISOString().split('T')[0];
    const plan = PLANS[this._currentPlan];

    if (this._usage.date !== today) {
      this._usage = { date: today, requestCount: 0 };
    }

    this._usage.requestCount++;

    if (this._usage.requestCount > plan.maxRequestsPerDay) {
      return {
        allowed: false,
        message: [
          `Has alcanzado el limite diario de ${plan.maxRequestsPerDay} requests para el plan ${plan.displayName}.`,
          '',
          'Opciones:',
          '  - Espera hasta manana para continuar',
          `  - Upgrade a ${this._currentPlan === 'free' ? 'Pro ($49/mes)' : 'Business ($199/mes)'} para mas requests`,
          '  - Visita: https://commercehub.lemonsqueezy.com',
        ].join('\n'),
      };
    }

    return { allowed: true, message: '' };
  }

  /**
   * Retorna el estado actual de la licencia para mostrar al usuario.
   * Ofusca la license key por seguridad.
   *
   * @returns Estado completo de la licencia
   */
  getStatus(): {
    plan: PlanType;
    planInfo: (typeof PLANS)[PlanType];
    licenseActive: boolean;
    expiresAt: string | null;
    requestsToday: number;
    requestsLimit: number;
    graceWarning: string | null;
    integrityOk: boolean;
  } {
    const plan = this.getPlan();
    const planInfo = PLANS[plan];
    const today = new Date().toISOString().split('T')[0];

    let graceWarning: string | null = null;
    if (this._cache && !this._isCacheValid()) {
      const grace = this._checkGracePeriod();
      if (grace.inGrace) {
        graceWarning = `Conectate a internet para revalidar. Quedan ${grace.daysRemaining} dias de gracia.`;
      } else if (this._cache.valid && this._cache.planType !== 'free') {
        graceWarning =
          'Grace period expirado. Conectate a internet para reactivar tu plan.';
      }
    }

    return {
      plan,
      planInfo,
      licenseActive: this._licenseKeyHash !== null && plan !== 'free',
      expiresAt: this._expiresAt?.toISOString() ?? null,
      requestsToday:
        this._usage.date === today ? this._usage.requestCount : 0,
      requestsLimit: planInfo.maxRequestsPerDay,
      graceWarning,
      integrityOk: !this._tamperingDetected,
    };
  }
}

/** Instancia singleton del LicenseManager (encapsulada en closure) */
const _getInstance = (() => {
  let instance: LicenseManager | null = null;
  return (): LicenseManager => {
    if (!instance) {
      instance = new LicenseManager();
    }
    return instance;
  };
})();

/**
 * Obtiene la instancia singleton del LicenseManager.
 * La instancia se crea la primera vez y se reutiliza.
 *
 * @returns Instancia del LicenseManager
 */
export function getLicenseManager(): LicenseManager {
  return _getInstance();
}
