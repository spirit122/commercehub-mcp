/**
 * CommerceHub MCP - Criptografia del sistema de licencias
 *
 * Proporciona funciones de encriptacion, fingerprinting de maquina,
 * y cache seguro para el sistema de validacion de licencias.
 *
 * Usa crypto nativo de Node.js sin dependencias externas.
 * El cache se encripta con AES-256-GCM usando el fingerprint de la maquina
 * como base para derivar la clave, lo que impide copiar el archivo a otra maquina.
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
  scryptSync,
} from 'crypto';
import { hostname, userInfo, platform, arch, cpus, homedir } from 'os';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

/** Datos almacenados en el cache de licencia */
export interface LicenseCacheData {
  /** Si la licencia es valida */
  valid: boolean;
  /** Tipo de plan asociado */
  planType: string;
  /** Clave de licencia (ofuscada) */
  licenseKeyHash: string;
  /** Fecha de expiracion de la licencia (ISO string) */
  expiresAt: string | null;
  /** Momento en que se cacheo (ISO string) */
  cachedAt: string;
  /** Momento de la ultima validacion online exitosa (ISO string) */
  lastOnlineValidation: string;
  /** ID de la instancia en LemonSqueezy */
  instanceId: string | null;
  /** Limite de activaciones */
  activationLimit: number | null;
  /** Uso actual de activaciones */
  activationUsage: number | null;
}

/**
 * Genera un fingerprint unico de la maquina actual.
 * Combina multiples factores del sistema y los hashea con SHA-256.
 * Esto vincula la licencia a una maquina especifica.
 *
 * @returns Hash SHA-256 hexadecimal del fingerprint
 */
export function getMachineFingerprint(): string {
  const factors = [
    hostname(),
    userInfo().username,
    platform(),
    arch(),
    cpus()[0]?.model ?? 'unknown',
    cpus().length.toString(),
  ];
  return createHash('sha256').update(factors.join('|')).digest('hex');
}

/**
 * Deriva una clave de encriptacion AES-256 a partir del fingerprint.
 * Usa scrypt como KDF para resistir ataques de fuerza bruta.
 *
 * @param fingerprint - Hash del fingerprint de la maquina
 * @returns Buffer de 32 bytes para usar como clave AES-256
 */
export function deriveKey(fingerprint: string): Buffer {
  return scryptSync(fingerprint, 'commercehub-2026-salt', 32);
}

/**
 * Encripta datos con AES-256-GCM.
 * Genera un IV aleatorio por cada operacion.
 * El resultado incluye IV + authTag + datos cifrados en formato base64.
 *
 * @param data - Texto plano a encriptar
 * @param key - Clave de 32 bytes derivada del fingerprint
 * @returns String con formato "iv:authTag:encrypted" en base64
 */
export function encryptData(data: string, key: Buffer): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(data, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

/**
 * Desencripta datos previamente encriptados con encryptData.
 * Verifica la integridad con el authTag de GCM.
 *
 * @param encryptedStr - String con formato "iv:authTag:encrypted"
 * @param key - Clave de 32 bytes (debe ser la misma usada para encriptar)
 * @returns Texto plano desencriptado, o null si falla (tampered o maquina diferente)
 */
export function decryptData(encryptedStr: string, key: Buffer): string | null {
  try {
    const parts = encryptedStr.split(':');
    if (parts.length !== 3) return null;

    const iv = Buffer.from(parts[0], 'base64');
    const authTag = Buffer.from(parts[1], 'base64');
    const encrypted = Buffer.from(parts[2], 'base64');

    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}

/**
 * Obtiene la ruta del directorio de configuracion de CommerceHub.
 * Crea el directorio si no existe.
 *
 * @returns Ruta absoluta al directorio ~/.commercehub/
 */
export function getConfigDir(): string {
  const dir = join(homedir(), '.commercehub');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Obtiene la ruta del archivo de cache de licencia encriptado.
 *
 * @returns Ruta absoluta a ~/.commercehub/license.enc
 */
export function getLicenseCachePath(): string {
  return join(getConfigDir(), 'license.enc');
}

/**
 * Guarda el cache de licencia encriptado en disco.
 * El archivo solo puede ser leido en la misma maquina donde se creo.
 *
 * @param data - Datos de la licencia a cachear
 * @param fingerprint - Fingerprint de la maquina actual
 */
export function saveLicenseCache(
  data: LicenseCacheData,
  fingerprint: string,
): void {
  try {
    const key = deriveKey(fingerprint);
    const json = JSON.stringify(data);
    const encrypted = encryptData(json, key);
    writeFileSync(getLicenseCachePath(), encrypted, 'utf8');
  } catch {
    // No crashear si no se puede escribir el cache
  }
}

/**
 * Lee y desencripta el cache de licencia desde disco.
 * Retorna null si el archivo no existe, esta corrupto, o fue copiado
 * desde otra maquina (el fingerprint no coincide).
 *
 * @param fingerprint - Fingerprint de la maquina actual
 * @returns Datos cacheados o null
 */
export function loadLicenseCache(
  fingerprint: string,
): LicenseCacheData | null {
  const cachePath = getLicenseCachePath();
  if (!existsSync(cachePath)) return null;

  try {
    const encrypted = readFileSync(cachePath, 'utf8');
    const key = deriveKey(fingerprint);
    const json = decryptData(encrypted, key);
    if (!json) return null;
    const parsed = JSON.parse(json) as LicenseCacheData;

    // Validar estructura minima del cache
    if (
      typeof parsed.valid !== 'boolean' ||
      typeof parsed.planType !== 'string' ||
      typeof parsed.cachedAt !== 'string' ||
      typeof parsed.lastOnlineValidation !== 'string'
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

/**
 * Genera un hash SHA-256 del contenido de un archivo.
 * Se usa para verificar la integridad de plans.ts en runtime.
 *
 * @param filePath - Ruta absoluta al archivo
 * @returns Hash SHA-256 hexadecimal, o string vacio si falla
 */
export function getFileIntegrityHash(filePath: string): string {
  try {
    const content = readFileSync(filePath, 'utf8');
    return createHash('sha256').update(content).digest('hex');
  } catch {
    return '';
  }
}

/**
 * Hashea una license key con SHA-256 para almacenamiento seguro.
 * Nunca guardamos la key en texto plano en el cache.
 *
 * @param licenseKey - License key en texto plano
 * @returns Hash SHA-256 hexadecimal
 */
export function hashLicenseKey(licenseKey: string): string {
  return createHash('sha256').update(licenseKey).digest('hex');
}

/**
 * Elimina el archivo de cache de licencia si existe.
 * Se usa al desactivar una licencia.
 */
export function deleteLicenseCache(): void {
  const cachePath = getLicenseCachePath();
  try {
    if (existsSync(cachePath)) {
      // Sobreescribir con datos aleatorios antes de eliminar
      writeFileSync(cachePath, randomBytes(256).toString('base64'), 'utf8');
      const { unlinkSync } = require('fs');
      unlinkSync(cachePath);
    }
  } catch {
    // No crashear si no se puede eliminar
  }
}
