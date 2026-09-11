import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle, Camera, CameraOff, Check, CheckCircle2,
  Clock, Copy, Eye, EyeOff, KeyRound, Lock, Plus, QrCode, RefreshCw, Search, ShieldCheck, Sparkles, UserCheck, Users, X, XCircle
} from 'lucide-react';

import { listGuests } from '@/backend/phase2';
import {
  checkInPartyMembers, resolveCheckin, scannerCameraFailure,
  type CheckinResolution
} from '@/backend/phase3';
import {
  createEventStaffToken,
  listEventStaffTokens,
  listStaffGuests,
  resolveStaffCheckin,
  revokeEventStaffToken,
  staffCheckInPartyMembers,
  type EventStaffToken,
  type StaffCheckinResolution
} from '@/backend/staff-scanner';
import type { EventGuest } from '@/backend/types';
import { useAppLocale } from '@/i18n/app-locale';

export interface EventScannerProps {
  project: { id?: string; name: string };
  isStaffMode?: boolean;
  staffToken?: string;
  staffPin?: string;
  onStaffRevokedOrExpired?: () => void;
}

export function EventScanner({
  project,
  isStaffMode = false,
  staffToken,
  staffPin,
  onStaffRevokedOrExpired,
}: EventScannerProps) {
  const { t } = useAppLocale();
  const [activeTab, setActiveTab] = useState<'scan' | 'manual'>('scan');
  const [manualQuery, setManualQuery] = useState('');
  const [guests, setGuests] = useState<EventGuest[]>([]);
  const [value, setValue] = useState('');
  const [result, setResult] = useState<CheckinResolution | StaffCheckinResolution | null>(null);
  const [arriving, setArriving] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Camera states
  const [cameraState, setCameraState] = useState<'idle' | 'starting' | 'active' | 'decoded' | 'error'>('idle');
  const [cameraError, setCameraError] = useState<string>('');

  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraControlsRef = useRef<{ stop: () => void } | undefined>(undefined);
  const cameraRequestRef = useRef(0);
  const scanLockedRef = useRef(false);

  // Load guests for manual lookup fallback
  useEffect(() => {
    if (isStaffMode && staffToken) {
      listStaffGuests(staffToken, staffPin || '')
        .then((items) => {
          setGuests(
            items.map((g) => ({
              id: g.id,
              event_id: '',
              name: g.name,
              phone: g.phone,
              allowed_companions: g.allowed_companions,
              rsvp_status: g.rsvp_status,
              confirmed_party_size: g.confirmed_party_size,
              checked_in_count: g.checked_in_count,
              first_checked_in_at: g.first_checked_in_at,
            } as EventGuest))
          );
        })
        .catch((err) => {
          if (err instanceof Error && (err.message.includes('42501') || err.message.toLowerCase().includes('expired') || err.message.toLowerCase().includes('invalid') || err.message.toLowerCase().includes('not_authorized'))) {
            onStaffRevokedOrExpired?.();
          }
        });
    } else if (project.id) {
      listGuests(project.id).then(setGuests).catch(() => []);
    }
  }, [isStaffMode, staffToken, staffPin, project.id, onStaffRevokedOrExpired]);

  // Strict verification step (NO AUTOMATIC CHECK-IN)
  const verifyToken = useCallback(
    async (tokenCandidate: string) => {
      const trimmed = tokenCandidate.trim();
      if (!trimmed) return;

      setBusy(true);
      setError('');
      try {
        if (isStaffMode && staffToken) {
          const res = await resolveStaffCheckin(staffToken, staffPin || '', trimmed);
          if (res.status === 'not_authorized') {
            setError(t('accessExpired'));
            onStaffRevokedOrExpired?.();
            return;
          }
          setResult(res);
          setArriving(Math.min(1, res.remaining_expected ?? 1));
        } else if (project.id) {
          const res = await resolveCheckin(trimmed, project.id);
          setResult(res);
          setArriving(Math.min(1, res.remaining_expected ?? 1));
        }
      } catch (caught) {
        if (isStaffMode && caught instanceof Error && (caught.message.includes('42501') || caught.message.toLowerCase().includes('expired') || caught.message.toLowerCase().includes('invalid') || caught.message.toLowerCase().includes('not_authorized'))) {
          setError(t('accessExpired'));
          onStaffRevokedOrExpired?.();
        } else {
          setError(t('networkError') || t('operationFailed'));
        }
      } finally {
        setBusy(false);
      }
    },
    [isStaffMode, staffToken, staffPin, project.id, t, onStaffRevokedOrExpired]
  );

  // Explicit check-in step
  const executeCheckIn = async () => {
    if (!value.trim() || busy) return;

    setBusy(true);
    setError('');
    try {
      if (isStaffMode && staffToken) {
        const updated = await staffCheckInPartyMembers(staffToken, staffPin || '', value.trim(), arriving);
        setResult(updated);
      } else if (project.id) {
        const updated = await checkInPartyMembers(value.trim(), project.id, arriving);
        setResult(updated);
      }
    } catch (caught) {
      if (isStaffMode && caught instanceof Error && (caught.message.includes('42501') || caught.message.toLowerCase().includes('expired') || caught.message.toLowerCase().includes('invalid') || caught.message.toLowerCase().includes('not_authorized'))) {
        setError(t('accessExpired'));
        onStaffRevokedOrExpired?.();
      } else {
        setError(t('checkinRejected'));
      }
    } finally {
      setBusy(false);
    }
  };

  const stopCamera = useCallback(() => {
    cameraRequestRef.current += 1;
    cameraControlsRef.current?.stop();
    cameraControlsRef.current = undefined;
    setCameraState('idle');
  }, []);

  useEffect(() => {
    return () => {
      cameraRequestRef.current += 1;
      cameraControlsRef.current?.stop();
    };
  }, []);

  const startCamera = async () => {
    setCameraError('');
    setError('');
    setResult(null);

    if (!window.isSecureContext) {
      setCameraState('error');
      setCameraError(t('cameraSecureContext'));
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState('error');
      setCameraError(t('cameraUnsupported'));
      return;
    }

    const request = ++cameraRequestRef.current;
    setCameraState('starting');
    scanLockedRef.current = false;

    try {
      const { BrowserQRCodeReader } = await import('@zxing/browser');
      if (!videoRef.current || request !== cameraRequestRef.current) return;

      const reader = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 250 });
      const controls = await reader.decodeFromConstraints(
        { audio: false, video: { facingMode: { ideal: 'environment' } } },
        videoRef.current,
        (decoded, _decodeError, activeControls) => {
          if (request !== cameraRequestRef.current || !decoded || scanLockedRef.current) return;
          const text = decoded.getText().trim();
          if (!text) return;

          scanLockedRef.current = true;
          activeControls.stop();
          cameraControlsRef.current = undefined;
          setValue(text);
          setCameraState('decoded');
          void verifyToken(text);
        }
      );

      if (request !== cameraRequestRef.current) {
        controls.stop();
        return;
      }
      cameraControlsRef.current = controls;
      if (!scanLockedRef.current) setCameraState('active');
    } catch (caught) {
      if (request !== cameraRequestRef.current) return;
      cameraControlsRef.current?.stop();
      cameraControlsRef.current = undefined;
      setCameraState('error');
      const errType = scannerCameraFailure(caught);
      setCameraError(errType === 'permission' ? t('cameraPermissionDenied') : t('cameraUnavailable'));
    }
  };

  const resetScan = () => {
    stopCamera();
    setValue('');
    setResult(null);
    setError('');
    setCameraError('');
    setArriving(1);
  };

  const found = Boolean(result?.guest_id);
  const remaining = result?.remaining_expected ?? 0;
  const isAccepted = result?.rsvp_status === 'accepted';
  const isComplete = result?.status === 'complete' || remaining === 0;
  const canCheckIn = found && isAccepted && !isComplete && remaining > 0;

  // Filtered guests for manual search
  const manualMatches = guests.filter((g) => {
    const q = manualQuery.trim().toLowerCase();
    return q && (g.name.toLowerCase().includes(q) || (g.phone && g.phone.includes(q)));
  });

  return (
    <div className="mx-auto max-w-xl space-y-5 pb-16">
      {/* 1. Header Card (Dark Emerald) */}
      <section className="rounded-3xl bg-[#0C2D24] p-6 sm:p-8 text-white shadow-md text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-[#D4B363]">
          <QrCode size={30} aria-hidden="true" />
        </div>
        <h1 className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight">
          {t('doorScanner')}
        </h1>
        <p className="mt-1 text-xs text-white/70">
          {t('scannerHelp')} <bdi className="font-semibold text-white">{project.name}</bdi>
        </p>

        {/* Tab switch between Camera QR and Manual Search */}
        <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-white/10 p-1">
          <button
            type="button"
            onClick={() => {
              setActiveTab('scan');
              resetScan();
            }}
            className={`min-h-10 rounded-lg text-xs font-bold transition ${
              activeTab === 'scan'
                ? 'bg-white text-[#0C2D24] shadow-xs'
                : 'text-white/80 hover:text-white'
            }`}
          >
            <Camera size={14} className="inline me-1.5" aria-hidden="true" />
            {t('startCamera')}
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('manual');
              stopCamera();
              resetScan();
            }}
            className={`min-h-10 rounded-lg text-xs font-bold transition ${
              activeTab === 'manual'
                ? 'bg-white text-[#0C2D24] shadow-xs'
                : 'text-white/80 hover:text-white'
            }`}
          >
            <Search size={14} className="inline me-1.5" aria-hidden="true" />
            {t('manualLookupTab')}
          </button>
        </div>
      </section>

      {/* 2. Camera View & Scanner Controls */}
      {activeTab === 'scan' && (
        <section className="rounded-3xl border border-[#E8E2D8] bg-white p-5 sm:p-6 shadow-xs space-y-4">
          {/* Camera preview video */}
          <div className="overflow-hidden rounded-2xl bg-black aspect-[4/3] flex items-center justify-center relative">
            <video
              ref={videoRef}
              muted
              playsInline
              className={`h-full w-full object-cover ${
                cameraState === 'starting' || cameraState === 'active' ? 'block' : 'hidden'
              }`}
              aria-label={t('cameraPreview')}
            />

            {cameraState === 'idle' && (
              <div className="text-center p-6 text-white/60">
                <Camera size={44} className="mx-auto mb-2 text-white/30" />
                <p className="text-xs">{t('scanDoesNotCheckIn')}</p>
              </div>
            )}

            {cameraState === 'starting' && (
              <p className="text-xs text-white animate-pulse">{t('cameraStarting')}</p>
            )}

            {cameraState === 'active' && (
              <div className="absolute inset-0 border-2 border-[#D4B363]/80 pointer-events-none flex items-center justify-center">
                <div className="h-48 w-48 border-2 border-dashed border-white/60 rounded-xl" />
              </div>
            )}
          </div>

          {/* Camera control buttons */}
          <div className="flex flex-col sm:flex-row gap-2">
            {cameraState !== 'starting' && cameraState !== 'active' ? (
              <button
                type="button"
                data-testid="button-start-camera"
                onClick={() => void startCamera()}
                className="qr-button qr-button--primary min-h-12 flex-1 justify-center text-xs font-bold"
              >
                <Camera size={16} aria-hidden="true" />
                <span>{cameraState === 'decoded' ? t('scanAnotherQr') : t('startCamera')}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={stopCamera}
                className="qr-button qr-button--secondary min-h-12 flex-1 justify-center text-xs font-bold text-[#9C382A]"
              >
                <CameraOff size={16} aria-hidden="true" />
                <span>{t('stopCamera')}</span>
              </button>
            )}
          </div>

          {cameraError && (
            <p className="rounded-xl bg-[#FDF0ED] p-3 text-xs text-[#9C382A] border border-[#F8D8D3]">
              {cameraError}
            </p>
          )}

          {/* Manual Token Input alternative */}
          <div className="pt-2">
            <label className="block text-xs font-bold text-[#17251F] mb-1" htmlFor="token-manual-input">
              {t('scannerPlaceholder')}
            </label>
            <div className="flex gap-2">
              <input
                id="token-manual-input"
                ref={inputRef}
                type="text"
                dir="ltr"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setResult(null);
                }}
                onKeyDown={(e) => e.key === 'Enter' && void verifyToken(value)}
                placeholder="INV-..."
                className="qr-field-inline min-h-11 flex-1 rounded-xl px-3 text-xs border border-[#D9D2C5]"
              />
              <button
                type="button"
                data-testid="button-verify-token"
                disabled={!value.trim() || busy}
                onClick={() => void verifyToken(value)}
                className="qr-button qr-button--primary min-h-11 px-5 text-xs font-bold disabled:opacity-50"
              >
                {busy ? t('loading') : t('verify')}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* 3. Manual Guest Search Tab Fallback */}
      {activeTab === 'manual' && (
        <section className="rounded-3xl border border-[#E8E2D8] bg-white p-5 sm:p-6 shadow-xs space-y-4">
          <div className="relative">
            <span className="absolute inset-y-0 start-0 flex items-center ps-3.5 pointer-events-none text-[#9E988D]">
              <Search size={16} aria-hidden="true" />
            </span>
            <input
              type="search"
              autoFocus
              value={manualQuery}
              onChange={(e) => setManualQuery(e.target.value)}
              placeholder={t('manualSearchPlaceholder')}
              className="qr-field-inline min-h-12 w-full rounded-2xl bg-white ps-10 pe-4 text-xs text-[#17251F] border border-[#E8E2D8]"
            />
          </div>

          {manualMatches.length > 0 && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {manualMatches.map((guest) => (
                <button
                  key={guest.id}
                  type="button"
                  onClick={async () => {
                    const personalInv = guest.personal_invitations?.[0];
                    const token = (guest as unknown as { token?: string }).token || personalInv?.id || guest.id;
                    setValue(token);
                    await verifyToken(token);
                  }}
                  className="flex w-full items-center justify-between rounded-xl border border-[#E8E2D8] p-3 text-start hover:border-[var(--qr-primary)] hover:bg-[#FAF8F4] transition"
                >
                  <div>
                    <p className="text-sm font-bold text-[#17251F]">{guest.name}</p>
                    <p className="text-xs text-[#756F66]" dir="ltr">{guest.phone || t('missingPhone')}</p>
                  </div>
                  <span className="rounded-md bg-[#F5F2EC] px-2 py-1 text-[10px] font-bold text-[#564F46]">
                    {t(guest.rsvp_status)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* 4. Verification Result Card (Details first, Check-in second) */}
      {(result || error) && (
        <section
          aria-live="polite"
          className={`rounded-3xl border p-5 sm:p-6 shadow-xs ${
            found
              ? 'border-[#D5EADF] bg-[#FAFDFB]'
              : 'border-[#F8D8D3] bg-[#FDF0ED]'
          }`}
        >
          {found && result ? (
            <div className="space-y-4">
              {/* Guest Details */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#8B7040]">
                    {t(result.status)}
                  </span>
                  <h2 className="text-xl sm:text-2xl font-bold text-[#17251F] mt-0.5">
                    {result.guest_name}
                  </h2>
                </div>

                {/* RSVP badge */}
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    result.rsvp_status === 'accepted'
                      ? 'bg-[#EBF5F0] text-[#1B6344]'
                      : 'bg-[#FDF0ED] text-[#9C382A]'
                  }`}
                >
                  {t(result.rsvp_status || 'pending')}
                </span>
              </div>

              {/* Headcount Breakdown */}
              <div className="grid grid-cols-3 gap-2 rounded-2xl bg-white p-3.5 border border-[#E8E2D8] text-center text-xs">
                <div>
                  <span className="text-[#756F66]">{t('confirmedHeadcount')}</span>
                  <p className="text-base font-bold text-[#17251F] mt-0.5">{result.confirmed_party_size}</p>
                </div>
                <div>
                  <span className="text-[#756F66]">{t('checkedInHeadcount')}</span>
                  <p className="text-base font-bold text-[#1B6344] mt-0.5">{result.checked_in_count}</p>
                </div>
                <div>
                  <span className="text-[#756F66]">{t('remainingExpected')}</span>
                  <p className="text-base font-bold text-[#8B7040] mt-0.5">{remaining}</p>
                </div>
              </div>

              {/* Companions list if any */}
              {result.companion_names && result.companion_names.length > 0 && (
                <div className="text-xs text-[#564F46] bg-white p-3 rounded-xl border border-[#E8E2D8]">
                  <span className="font-semibold text-[#17251F]">{t('companionAllowance')}: </span>
                  {result.companion_names.join(' · ')}
                </div>
              )}

              {/* Already Checked In Warning */}
              {isComplete && (
                <div className="flex items-center gap-2 rounded-xl bg-[#EBF5F0] p-3 text-xs font-bold text-[#1B6344]">
                  <CheckCircle2 size={16} aria-hidden="true" />
                  <span>{t('alreadyCheckedInBadge')}</span>
                </div>
              )}

              {/* Not Accepted Warning */}
              {!isAccepted && (
                <div className="flex items-center gap-2 rounded-xl bg-[#FDF0ED] p-3 text-xs font-bold text-[#9C382A]">
                  <AlertCircle size={16} aria-hidden="true" />
                  <span>{t('acceptedRequired')}</span>
                </div>
              )}

              {/* Explicit Check-in Controls */}
              {canCheckIn && (
                <div className="pt-2 border-t border-[#E8E2D8] flex flex-col sm:flex-row items-center gap-3">
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <label htmlFor="arriving-count" className="text-xs font-bold text-[#17251F] shrink-0">
                      {t('arrivingNow')}:
                    </label>
                    <input
                      id="arriving-count"
                      type="number"
                      min="1"
                      max={remaining}
                      value={arriving}
                      onChange={(e) => setArriving(Math.max(1, Math.min(remaining, Number(e.target.value))))}
                      className="qr-field-inline min-h-12 w-20 rounded-xl px-3 text-center text-sm font-bold border border-[#D9D2C5]"
                    />
                  </div>

                  <button
                    type="button"
                    data-testid="button-execute-checkin"
                    disabled={busy || arriving < 1 || arriving > remaining}
                    onClick={() => void executeCheckIn()}
                    className="qr-button qr-button--primary min-h-12 flex-1 w-full justify-center text-xs font-bold rounded-xl disabled:opacity-50"
                  >
                    <UserCheck size={16} aria-hidden="true" />
                    <span>{busy ? t('loading') : t('recordCheckinBtn')}</span>
                  </button>
                </div>
              )}

              {/* Scan next guest button */}
              <button
                type="button"
                onClick={resetScan}
                className="w-full rounded-xl border border-[#D9D2C5] py-2.5 text-xs font-semibold text-[#564F46] hover:bg-white"
              >
                {t('scanNextGuest')}
              </button>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <XCircle className="shrink-0 text-[#9C382A] mt-0.5" size={20} />
              <div className="flex-1">
                <p className="font-bold text-sm text-[#9C382A]">
                  {error || t(result?.status ?? 'invalid')}
                </p>
                <p className="mt-1 text-xs text-[#564F46]">{t('tryAgain')}</p>
                <button
                  type="button"
                  onClick={resetScan}
                  className="mt-3 rounded-lg border border-[#D9D2C5] bg-white px-3 py-1.5 text-xs font-semibold text-[#17251F]"
                >
                  {t('scanNextGuest')}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Helper Note */}
      {!result && !error && (
        <p className="text-center text-xs text-[#756F66]">
          {t('scannerBoundary')}
        </p>
      )}

      {/* 5. Host Staff Access Management Card */}
      {!isStaffMode && project.id && (
        <StaffAccessSection projectId={project.id} projectName={project.name} />
      )}
    </div>
  );
}

function StaffAccessSection({ projectId, projectName }: { projectId: string; projectName: string }) {
  const { t } = useAppLocale();
  const [tokens, setTokens] = useState<EventStaffToken[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState('Main Entrance');
  const [pin, setPin] = useState('');
  const [expiryOption, setExpiryOption] = useState<'24h' | '48h' | '7d' | 'none'>('24h');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [showPin, setShowPin] = useState(false);

  // Latest created token in this browser session
  const [latestCreated, setLatestCreated] = useState<{
    id: string;
    label: string;
    pin: string;
    expiresAt: string | null;
    link: string;
  } | null>(null);

  const loadTokens = useCallback(async () => {
    try {
      const data = await listEventStaffTokens(projectId);
      setTokens(data);
    } catch {
      // Ignored
    }
  }, [projectId]);

  useEffect(() => {
    void loadTokens();
  }, [loadTokens]);

  const handleCreate = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    setError('');

    let expiresAt: string | null = null;
    if (expiryOption === '24h') expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    else if (expiryOption === '48h') expiresAt = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
    else if (expiryOption === '7d') expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

    try {
      const res = await createEventStaffToken(projectId, label, expiresAt, pin);

      const fullLink = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}/staff/${res.token}`;

      setLatestCreated({
        id: res.id,
        label: res.label,
        pin: pin.trim(),
        expiresAt,
        link: fullLink,
      });

      setShowForm(false);
      setPin('');
      await loadTokens();
    } catch {
      setError(t('operationFailed'));
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async (tokenId: string) => {
    try {
      await revokeEventStaffToken(tokenId);
      if (latestCreated?.id === tokenId) {
        setLatestCreated(null);
      }
      await loadTokens();
    } catch {
      setError(t('operationFailed'));
    }
  };

  const copyLink = async () => {
    if (!latestCreated) return;
    try {
      await navigator.clipboard.writeText(latestCreated.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback
    }
  };

  const generatePin = () => {
    const num = Math.floor(1000 + Math.random() * 9000).toString();
    setPin(num);
  };

  return (
    <section
      aria-label={t('staffAccess')}
      className="rounded-3xl border border-[#E8E2D8] bg-white p-5 sm:p-6 shadow-xs space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#E8E2D8] pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0C2D24]/10 text-[#0C2D24]">
            <KeyRound size={20} />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#17251F]">{t('staffAccess')}</h2>
            <p className="text-xs text-[#756F66]">{t('staffAccessSubtitle')}</p>
          </div>
        </div>

        {!showForm && !latestCreated && (
          <button
            type="button"
            data-testid="button-create-staff-access"
            onClick={() => setShowForm(true)}
            className="qr-button qr-button--primary min-h-10 text-xs font-bold px-4 self-start sm:self-auto"
          >
            <Plus size={14} aria-hidden="true" />
            <span>{t('createAccess')}</span>
          </button>
        )}
      </div>

      {/* 1. Newly created token card */}
      {latestCreated && (
        <div className="rounded-2xl border border-[#D5EADF] bg-[#FAFDFB] p-4 sm:p-5 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="rounded-full bg-[#EBF5F0] px-2.5 py-0.5 text-[10px] font-bold text-[#1B6344]">
                {t('active')}
              </span>
              <h3 className="mt-1 text-sm font-bold text-[#17251F]">{latestCreated.label}</h3>
              {latestCreated.expiresAt && (
                <p className="text-[11px] text-[#756F66]">
                  {t('expires')}: {new Date(latestCreated.expiresAt).toLocaleDateString()}
                </p>
              )}
            </div>

            {latestCreated.pin && (
              <div className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 border border-[#D5EADF] text-xs">
                <span className="text-[#756F66] font-semibold">{t('pin')}:</span>
                <span className="font-mono font-bold text-[#17251F]">
                  {showPin ? latestCreated.pin : '••••'}
                </span>
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="ms-1 text-[#756F66] hover:text-[#17251F]"
                  aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
                >
                  {showPin ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              dir="ltr"
              value={latestCreated.link}
              className="qr-field-inline min-h-11 flex-1 rounded-xl px-3 text-xs bg-white border border-[#D5EADF] text-[#17251F]"
            />
            <button
              type="button"
              data-testid="button-copy-staff-link"
              onClick={() => void copyLink()}
              className="qr-button qr-button--primary min-h-11 px-4 text-xs font-bold"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              <span>{copied ? t('linkCopied') : t('copyStaffLink')}</span>
            </button>
          </div>

          <p className="text-[11px] font-semibold text-[#8B7040]">
            {t('copyLinkNowWarning')}
          </p>

          <div className="flex justify-between items-center pt-2 border-t border-[#D5EADF]">
            <button
              type="button"
              data-testid="button-revoke-staff-access"
              onClick={() => void handleRevoke(latestCreated.id)}
              className="text-xs font-bold text-[#9C382A] hover:underline"
            >
              {t('revokeAccess')}
            </button>

            <button
              type="button"
              onClick={() => {
                setLatestCreated(null);
                setShowForm(true);
              }}
              className="text-xs font-bold text-[#0C2D24] hover:underline"
            >
              {t('regenerateAccess')}
            </button>
          </div>
        </div>
      )}

      {/* 2. Create staff access form */}
      {showForm && (
        <form onSubmit={handleCreate} className="rounded-2xl border border-[#E8E2D8] bg-[#FAF8F4] p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#17251F] uppercase tracking-wider">{t('createAccess')}</h3>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-[#756F66] hover:text-[#17251F]"
            >
              <X size={16} />
            </button>
          </div>

          {/* Label field & suggestion chips */}
          <div>
            <label className="block text-xs font-bold text-[#17251F] mb-1">{t('staffLabel')}</label>
            <input
              type="text"
              required
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Main Entrance"
              className="qr-field-inline min-h-11 w-full rounded-xl px-3 text-xs bg-white border border-[#D9D2C5]"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {['Main Entrance', 'Reception Desk', 'Door Team'].map((suggested) => (
                <button
                  key={suggested}
                  type="button"
                  onClick={() => setLabel(suggested)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold border transition ${
                    label === suggested
                      ? 'bg-[#0C2D24] text-white border-[#0C2D24]'
                      : 'bg-white text-[#564F46] border-[#D9D2C5] hover:bg-white/80'
                  }`}
                >
                  {suggested}
                </button>
              ))}
            </div>
          </div>

          {/* PIN field + Generator */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-[#17251F]">{t('pin')}</label>
              <button
                type="button"
                onClick={generatePin}
                className="text-[11px] font-bold text-[#8B7040] hover:underline flex items-center gap-1"
              >
                <Sparkles size={12} />
                <span>{t('generatePin')}</span>
              </button>
            </div>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={8}
              dir="ltr"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder={t('pinPlaceholder')}
              className="qr-field-inline min-h-11 w-full rounded-xl px-3 text-xs bg-white border border-[#D9D2C5] font-mono"
            />
          </div>

          {/* Expiry selector */}
          <div>
            <label className="block text-xs font-bold text-[#17251F] mb-1">{t('expires')}</label>
            <select
              value={expiryOption}
              onChange={(e) => setExpiryOption(e.target.value as typeof expiryOption)}
              className="qr-field-inline min-h-11 w-full rounded-xl px-3 text-xs bg-white border border-[#D9D2C5]"
            >
              <option value="24h">{t('hours24')}</option>
              <option value="48h">{t('hours48')}</option>
              <option value="7d">{t('days7')}</option>
              <option value="none">{t('noExpiry')}</option>
            </select>
          </div>

          {error && (
            <p className="text-xs text-[#9C382A] font-semibold">{error}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              data-testid="button-submit-create-staff"
              disabled={busy || !label.trim()}
              className="qr-button qr-button--primary min-h-11 flex-1 justify-center text-xs font-bold rounded-xl"
            >
              {busy ? t('loading') : t('createAccess')}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="qr-button qr-button--secondary min-h-11 px-4 text-xs font-bold rounded-xl"
            >
              {t('cancel')}
            </button>
          </div>
        </form>
      )}

      {/* 3. Existing tokens list */}
      {tokens.length > 0 && (
        <div className="space-y-2 pt-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#756F66]">
            {t('staffAccess')} ({tokens.length})
          </p>
          <div className="divide-y divide-[#E8E2D8] rounded-xl border border-[#E8E2D8] bg-white overflow-hidden">
            {tokens.map((tk) => {
              const isRevoked = Boolean(tk.revoked_at);
              const isExpired = tk.expires_at ? new Date(tk.expires_at) < new Date() : false;
              const isActive = !isRevoked && !isExpired;

              return (
                <div key={tk.id} className="flex items-center justify-between p-3 text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#17251F]">{tk.label}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                          isActive
                            ? 'bg-[#EBF5F0] text-[#1B6344]'
                            : 'bg-[#F5F2EC] text-[#756F66]'
                        }`}
                      >
                        {isActive ? t('active') : t('revoked')}
                      </span>
                    </div>
                    <p className="text-[10px] text-[#756F66] mt-0.5">
                      {new Date(tk.created_at).toLocaleDateString()}
                      {tk.expires_at && ` · ${t('expires')}: ${new Date(tk.expires_at).toLocaleDateString()}`}
                    </p>
                  </div>

                  {isActive && (
                    <button
                      type="button"
                      onClick={() => void handleRevoke(tk.id)}
                      className="text-[11px] font-bold text-[#9C382A] hover:underline"
                    >
                      {t('revokeAccess')}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
