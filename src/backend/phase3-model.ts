export type CheckinStatus = 'not_arrived' | 'partial' | 'complete';

export function checkinStatus(checkedIn: number, confirmed: number): CheckinStatus {
  if (checkedIn <= 0) return 'not_arrived';
  return confirmed > 0 && checkedIn >= confirmed ? 'complete' : 'partial';
}

export function extractScanToken(value: string): string {
  const clean = value.trim();
  if (!clean) return '';
  try {
    const url = new URL(clean);
    const parts = url.pathname.split('/').filter(Boolean);
    return decodeURIComponent(parts.at(-1) ?? '').trim();
  } catch {
    return clean;
  }
}

export function scannerCameraFailure(error: unknown): 'permission' | 'unavailable' {
  const name = error instanceof DOMException ? error.name : '';
  return name === 'NotAllowedError' || name === 'SecurityError' ? 'permission' : 'unavailable';
}
