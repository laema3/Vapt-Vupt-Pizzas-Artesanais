import { ZipRange } from '../types';

export interface ZipCoverageResult {
  isCovered: boolean;
  fee: number;
  matchedRange?: ZipRange;
}

/**
 * Checks if a given CEP is within any of the store's configured delivery ranges.
 * Handles 8-digit full CEPs, formatted strings (e.g. 38010-000), 5-digit prefixes,
 * and numeric range checks.
 */
export function checkZipCoverage(zipCode: string | undefined | null, zipRanges: ZipRange[]): ZipCoverageResult {
  // If the store hasn't configured any ranges yet, allow delivery with fee 0
  if (!zipRanges || zipRanges.length === 0) {
    return { isCovered: true, fee: 0 };
  }

  if (!zipCode) {
    return { isCovered: false, fee: 0 };
  }

  const cleanUserZip = zipCode.replace(/\D/g, '');
  if (!cleanUserZip || cleanUserZip.length < 5) {
    return { isCovered: false, fee: 0 };
  }

  for (const range of zipRanges) {
    if (!range.start || !range.end) continue;

    const cleanStart = range.start.replace(/\D/g, '');
    const cleanEnd = range.end.replace(/\D/g, '');

    if (!cleanStart || !cleanEnd) continue;

    // Direct numeric match for 8-digit full CEPs (normalized to 8 digits)
    const userNum = parseInt(cleanUserZip.padEnd(8, '0').slice(0, 8), 10);
    const startNum = parseInt(cleanStart.padEnd(8, '0').slice(0, 8), 10);
    const endNum = parseInt(cleanEnd.padEnd(8, '9').slice(0, 8), 10);

    if (!isNaN(userNum) && !isNaN(startNum) && !isNaN(endNum)) {
      if (userNum >= startNum && userNum <= endNum) {
        return { isCovered: true, fee: Number(range.fee) || 0, matchedRange: range };
      }
    }

    // 5-digit prefix comparison (only if both start and end define a prefix)
    if (cleanUserZip.length >= 5 && cleanStart.length >= 5 && cleanEnd.length >= 5) {
      const userPrefix = parseInt(cleanUserZip.slice(0, 5), 10);
      const startPrefix = parseInt(cleanStart.slice(0, 5), 10);
      const endPrefix = parseInt(cleanEnd.slice(0, 5), 10);

      if (!isNaN(userPrefix) && !isNaN(startPrefix) && !isNaN(endPrefix)) {
        if (userPrefix >= startPrefix && userPrefix <= endPrefix) {
          return { isCovered: true, fee: Number(range.fee) || 0, matchedRange: range };
        }
      }
    }
  }

  return { isCovered: false, fee: 0 };
}

/**
 * Returns true if the CEP is inside authorized delivery ranges, or if no ranges are configured.
 */
export function isZipAllowed(zipCode: string | undefined | null, zipRanges: ZipRange[]): boolean {
  return checkZipCoverage(zipCode, zipRanges).isCovered;
}

/**
 * Calculates the delivery fee based on user CEP and configured zip ranges.
 * If out of coverage, returns 0. (Always check isZipAllowed or checkZipCoverage before using for checkout)
 */
export function calculateDeliveryFeeForZip(zipCode: string | undefined | null, zipRanges: ZipRange[]): number {
  return checkZipCoverage(zipCode, zipRanges).fee;
}

/**
 * Fetches address details (logradouro, bairro, localidade) from ViaCEP API.
 */
export async function fetchAddressByCep(zipCode: string): Promise<{ address?: string; neighborhood?: string; city?: string; error?: string } | null> {
  const clean = zipCode.replace(/\D/g, '');
  if (clean.length !== 8) return null;

  try {
    const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.erro) return { error: 'CEP não encontrado' };

    const addressParts = [];
    if (data.logradouro) addressParts.push(data.logradouro);
    
    return {
      address: addressParts.join(', '),
      neighborhood: data.bairro || '',
      city: `${data.localidade || ''} - ${data.uf || ''}`.trim()
    };
  } catch (err) {
    console.error('Erro ao buscar CEP via ViaCEP:', err);
    return null;
  }
}
