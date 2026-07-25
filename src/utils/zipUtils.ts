import { ZipRange } from '../types';

/**
 * Calculates the delivery fee based on user CEP and configured zip ranges.
 * Handles 5-digit prefixes, 8-digit full CEPs, formatted strings (e.g. 38010-000),
 * and numeric range checks seamlessly.
 */
export function calculateDeliveryFeeForZip(zipCode: string | undefined | null, zipRanges: ZipRange[]): number {
  if (!zipCode || !zipRanges || zipRanges.length === 0) return 0;

  const cleanUserZip = zipCode.replace(/\D/g, '');
  if (!cleanUserZip) return 0;

  for (const range of zipRanges) {
    if (!range.start || !range.end) continue;

    const cleanStart = range.start.replace(/\D/g, '');
    const cleanEnd = range.end.replace(/\D/g, '');

    if (!cleanStart || !cleanEnd) continue;

    // 1. Direct numeric match for 8-digit CEPs
    const userNum = parseInt(cleanUserZip, 10);
    const startNum = parseInt(cleanStart, 10);
    const endNum = parseInt(cleanEnd, 10);

    if (!isNaN(userNum) && !isNaN(startNum) && !isNaN(endNum)) {
      // If both start and end are 8-digit numbers (or user CEP length matches start/end length)
      if (userNum >= startNum && userNum <= endNum) {
        return Number(range.fee) || 0;
      }
    }

    // 2. Pad to 8 digits if start/end are 5 digits (e.g., 38000 -> 38000000, 38099 -> 38099999)
    const userPadded = cleanUserZip.padEnd(8, '0').slice(0, 8);
    const startPadded = cleanStart.padEnd(8, '0').slice(0, 8);
    const endPadded = cleanEnd.padEnd(8, '9').slice(0, 8);

    const uPad = parseInt(userPadded, 10);
    const sPad = parseInt(startPadded, 10);
    const ePad = parseInt(endPadded, 10);

    if (!isNaN(uPad) && !isNaN(sPad) && !isNaN(ePad)) {
      if (uPad >= sPad && uPad <= ePad) {
        return Number(range.fee) || 0;
      }
    }

    // 3. Compare 5-digit prefix (e.g., user "38010123" -> "38010" vs start "38000" and end "38099")
    if (cleanUserZip.length >= 5) {
      const userPrefix = parseInt(cleanUserZip.slice(0, 5), 10);
      const startPrefix = parseInt(cleanStart.slice(0, 5), 10);
      const endPrefix = parseInt(cleanEnd.slice(0, 5), 10);

      if (!isNaN(userPrefix) && !isNaN(startPrefix) && !isNaN(endPrefix)) {
        if (userPrefix >= startPrefix && userPrefix <= endPrefix) {
          return Number(range.fee) || 0;
        }
      }
    }
  }

  return 0;
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
