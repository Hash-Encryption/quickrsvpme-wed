import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, CameraOff, Check, CircleAlert, Clock3, QrCode, Search, Users, XCircle } from 'lucide-react';

import { createGuest, listGuests, tagGuest, updateGuest } from '@/backend/phase2';
import {
  checkInPartyMembers,
  checkinStatus,
  getEventOperationalSummary,
  resolveCheckin,
  scannerCameraFailure,
  setGuestCheckinCount,
  type CheckinResolution,
  type CheckinStatus,
  type EventOperationalSummary,
} from '@/backend/phase3';
import type { EventGuest } from '@/backend/types';
import { useAppLocale } from '@/i18n/app-locale';
import type { ProjectSummary } from './projects';

const emptySummary: EventOperationalSummary = { guest_records: 0, invitation_not_opened: 0, opened_no_rsvp: 0, accepted: 0, declined: 0, pending: 0, confirmed_headcount: 0, checked_in_headcount: 0, remaining_expected: 0, custom_messages: 0 };

export function EventOperationsOverview({ project, rsvpDeadline }: { project: ProjectSummary; rsvpDeadline: string }) {
  const { t } = useAppLocale();
  const [summary, setSummary] = useState<EventOperationalSummary>(emptySummary);
  const [error, setError] = useState('');
  useEffect(() => { setError(''); void getEventOperationalSummary(project.id).then(setSummary).catch(() => setError(t('operationFailed'))); }, [project.id, t]);
  const ledger = [[t('confirmedHeadcount'), summary.confirmed_headcount], [t('checkedInHeadcount'), summary.checked_in_headcount], [t('remainingExpected'), summary.remaining_expected]] as const;
  const states = [[t('guestRecords'), summary.guest_records], [t('notOpened'), summary.invitation_not_opened], [t('openedNoRsvp'), summary.opened_no_rsvp], [t('accepted'), summary.accepted], [t('declined'), summary.declined], [t('pending'), summary.pending], [t('customMessages'), summary.custom_messages]] as const;
  return <div>
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#8B7040]">{t('eventOperations')}</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.04em] sm:text-5xl">{project.name}</h1><p className="mt-2 text-sm text-[#756F66]"><bdi>{project.date} · {project.venue}</bdi>{rsvpDeadline && <> · {t('rsvpDeadline')}: <bdi>{rsvpDeadline}</bdi></>}</p></div><span className="w-fit rounded-full bg-[#0C2D24] px-4 py-2 text-[10px] font-bold uppercase tracking-[.12em] text-white">{t('backendAuthoritative')}</span></div>
    {error && <p className="mt-5 rounded-2xl bg-[#8c302b]/10 p-4 text-sm text-[#8c302b]" role="alert">{error}</p>}
    <section className="mt-7 overflow-hidden rounded-3xl bg-[#0C2D24] text-white"><div className="grid sm:grid-cols-3">{ledger.map(([label, value], index) => <div key={label} className={`p-6 sm:p-8 ${index ? 'border-t border-white/10 sm:border-s' : ''}`}><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#D4B363]">{label}</p><p className="mt-3 text-5xl font-semibold tracking-[-.06em]">{value}</p></div>)}</div></section>
    <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{states.map(([label, value]) => <div key={label} className="rounded-2xl border border-[#D9D2C5] bg-white p-5"><p className="text-xs text-[#756F66]">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>)}</section>
  </div>;
}

type GuestFilter = 'all' | 'not_opened' | 'opened_no_rsvp' | EventGuest['rsvp_status'] | CheckinStatus;

export function BackendGuestManager({ project }: { project: ProjectSummary }) {
  const { t } = useAppLocale();
  const [guests, setGuests] = useState<EventGuest[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<GuestFilter>('all');
  const [drafts, setDrafts] = useState<Record<string, number>>({});
  const [tags, setTags] = useState<Record<string, string>>({});
  const [newGuest, setNewGuest] = useState({ name: '', phone: '', companions: 0 });
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const refresh = async () => { const next = await listGuests(project.id); setGuests(next); setDrafts(Object.fromEntries(next.map((guest) => [guest.id, guest.checked_in_count]))); };
  useEffect(() => { setError(''); void refresh().catch(() => setError(t('operationFailed'))); }, [project.id]);
  const visible = useMemo(() => guests.filter((guest) => {
    const opened = (guest.personal_invitations?.[0]?.open_count ?? 0) > 0;
    const state = checkinStatus(guest.checked_in_count, guest.confirmed_party_size);
    const matchesFilter = filter === 'all' || guest.rsvp_status === filter || state === filter || (filter === 'not_opened' && !opened) || (filter === 'opened_no_rsvp' && opened && guest.rsvp_status === 'pending');
    return matchesFilter && `${guest.name} ${guest.phone ?? ''}`.toLowerCase().includes(query.trim().toLowerCase());
  }), [filter, guests, query]);
  const saveCount = async (guest: EventGuest, next: number) => {
    if (next < guest.checked_in_count && !window.confirm(t('confirmCheckinCorrection'))) return;
    setBusy(guest.id); setError('');
    try { await setGuestCheckinCount(guest.id, next); await refresh(); }
    catch { setError(t('operationFailed')); }
    finally { setBusy(''); }
  };
  return <div>
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#8B7040]">{t('guestOperations')}</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.04em] sm:text-5xl">{t('guestListTitle')}</h1></div><span className="w-fit rounded-full border border-[#D9D2C5] bg-white px-3 py-2 text-[10px] font-semibold">{guests.length} {t('guestRecords')}</span></div>
    <div className="mt-6 grid gap-2 rounded-2xl border border-[#D9D2C5] bg-white p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_110px_auto]"><input value={newGuest.name} onChange={(event) => setNewGuest({ ...newGuest, name: event.target.value })} placeholder={t('guest')} className="min-h-11 rounded-xl border px-3" /><input value={newGuest.phone} onChange={(event) => setNewGuest({ ...newGuest, phone: event.target.value })} placeholder={t('missingPhone')} className="min-h-11 rounded-xl border px-3" /><input type="number" min="0" max="50" value={newGuest.companions} onChange={(event) => setNewGuest({ ...newGuest, companions: Number(event.target.value) })} aria-label={t('companionAllowance')} className="min-h-11 rounded-xl border px-3" /><button disabled={!newGuest.name.trim() || busy === 'create'} onClick={() => { setBusy('create'); void createGuest(project.id, newGuest.name.trim(), newGuest.phone.trim(), newGuest.companions).then(() => { setNewGuest({ name: '', phone: '', companions: 0 }); return refresh(); }).catch(() => setError(t('operationFailed'))).finally(() => setBusy('')); }} className="min-h-11 rounded-xl bg-[#0C2D24] px-5 text-xs font-bold text-white disabled:opacity-40">{t('addGuest')}</button></div>
    <div className="mt-6 grid gap-2 sm:grid-cols-[minmax(0,1fr)_220px]"><label className="sr-only" htmlFor="phase3-guest-search">{t('searchGuests')}</label><input id="phase3-guest-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('searchGuests')} className="focus-ring min-h-12 rounded-xl border border-[#D9D2C5] bg-white px-4" /><label className="sr-only" htmlFor="phase3-guest-filter">{t('filter')}</label><select id="phase3-guest-filter" value={filter} onChange={(event) => setFilter(event.target.value as GuestFilter)} className="focus-ring min-h-12 rounded-xl border border-[#D9D2C5] bg-white px-4"><option value="all">{t('allResponses')}</option><option value="not_opened">{t('notOpened')}</option><option value="opened_no_rsvp">{t('openedNoRsvp')}</option><option value="accepted">{t('accepted')}</option><option value="declined">{t('declined')}</option><option value="pending">{t('pending')}</option><option value="not_arrived">{t('notArrived')}</option><option value="partial">{t('partiallyCheckedIn')}</option><option value="complete">{t('fullyCheckedIn')}</option></select></div>
    {error && <p className="mt-4 rounded-2xl bg-[#8c302b]/10 p-4 text-sm text-[#8c302b]" role="alert">{error}</p>}
    {visible.length === 0 ? <div className="mt-6 rounded-3xl border border-dashed border-[#C8BCA8] bg-white p-10 text-center text-sm text-[#756F66]">{t('noGuests')}</div> : <div className="mt-6 grid gap-3">{visible.map((guest) => {
      const state = checkinStatus(guest.checked_in_count, guest.confirmed_party_size);
      const remaining = Math.max(guest.confirmed_party_size - guest.checked_in_count, 0);
      const opened = guest.personal_invitations?.[0]?.open_count ?? 0;
      const guestTags = guest.event_guest_tag_assignments?.flatMap((item) => Array.isArray(item.event_guest_tags)
        ? item.event_guest_tags.map((tag) => tag.name)
        : item.event_guest_tags ? [item.event_guest_tags.name] : []) ?? [];
      return <article key={guest.id} className="rounded-3xl border border-[#D9D2C5] bg-white p-5 sm:p-6"><div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]"><div><div className="flex flex-wrap items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#0C2D24] text-[#D4B363]"><Users size={18} /></span><div className="min-w-0 flex-1"><input defaultValue={guest.name} aria-label={t('operationName')} onBlur={(event) => { if (event.target.value.trim() && event.target.value !== guest.name) void updateGuest(guest.id, { name: event.target.value.trim() }).then(refresh); }} className="min-h-9 w-full rounded-lg border border-transparent px-2 font-semibold hover:border-[#D9D2C5]" /><p className="px-2 text-xs text-[#756F66]"><bdi>{guest.phone || t('missingPhone')}</bdi> · {opened ? `${t('openedCount')} ${opened}` : t('notOpened')}</p></div><span className="rounded-full bg-[#F0E9DB] px-3 py-2 text-[10px] font-bold uppercase text-[#6D5727]">{t(guest.rsvp_status)}</span></div><div className="mt-4 flex flex-wrap gap-2 text-xs text-[#756F66]"><span>{t('confirmedHeadcount')}: <b>{guest.confirmed_party_size}</b></span><span>·</span><span>{t('companionAllowance')}: <b>{guest.allowed_companions}</b></span>{guest.companion_names.map((name) => <span key={name} className="rounded-full bg-[#F5F2EC] px-2 py-1">{name}</span>)}{guestTags.map((name) => <span key={name} className="rounded-full border px-2 py-1">#{name}</span>)}</div>{guest.custom_message && <p className="mt-4 rounded-2xl bg-[#F5F2EC] p-3 text-sm text-[#564F46]">{guest.custom_message}</p>}<div className="mt-4 flex gap-2"><input value={tags[guest.id] ?? ''} onChange={(event) => setTags({ ...tags, [guest.id]: event.target.value })} placeholder={t('tag')} className="min-h-10 min-w-0 rounded-xl border px-3 text-xs" /><button disabled={!tags[guest.id]?.trim()} onClick={() => void tagGuest(project.id, guest.id, tags[guest.id]).then(() => { setTags({ ...tags, [guest.id]: '' }); return refresh(); })} className="min-h-10 rounded-full border px-4 text-xs disabled:opacity-40">{t('tag')}</button></div></div><div className="rounded-2xl bg-[#0C2D24] p-5 text-white"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#D4B363]">{t(state)}</p><p className="mt-1 text-3xl font-semibold">{guest.checked_in_count} / {guest.confirmed_party_size}</p></div><Clock3 className="text-[#D4B363]" /></div><p className="mt-2 text-xs text-white/60">{t('remainingExpected')}: {remaining}</p><div className="mt-4 flex gap-2"><input type="number" min="0" max={guest.confirmed_party_size} value={drafts[guest.id] ?? guest.checked_in_count} onChange={(event) => setDrafts({ ...drafts, [guest.id]: Number(event.target.value) })} aria-label={t('checkedInHeadcount')} className="min-h-12 min-w-0 flex-1 rounded-xl border border-white/20 bg-white/10 px-3 text-white" /><button disabled={busy === guest.id || guest.rsvp_status !== 'accepted' || drafts[guest.id] === guest.checked_in_count} onClick={() => void saveCount(guest, drafts[guest.id] ?? guest.checked_in_count)} className="min-h-12 rounded-xl bg-[#D4B363] px-4 text-xs font-bold text-[#10271F] disabled:opacity-40">{t('updateCheckin')}</button></div>{guest.rsvp_status !== 'accepted' && <p className="mt-3 text-xs text-[#F2C6B8]">{t('acceptedRequired')}</p>}</div></div></article>;
    })}</div>}
  </div>;
}

export function BackendScanner({ project }: { project: ProjectSummary }) {
  const { t } = useAppLocale();
  const [value, setValue] = useState('');
  const [result, setResult] = useState<CheckinResolution | null>(null);
  const [arriving, setArriving] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cameraState, setCameraState] = useState<'idle' | 'starting' | 'active' | 'decoded' | 'error'>('idle');
  const [cameraError, setCameraError] = useState<'cameraPermissionDenied' | 'cameraUnavailable' | 'cameraUnsupported' | 'cameraSecureContext' | ''>('');
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraControlsRef = useRef<{ stop: () => void } | undefined>(undefined);
  const cameraRequestRef = useRef(0);
  const scanLockedRef = useRef(false);
  const verify = useCallback(async (candidate = value) => { setBusy(true); setError(''); try { const next = await resolveCheckin(candidate, project.id); setResult(next); setArriving(Math.min(1, next.remaining_expected ?? 1)); } catch { setError(t('networkError')); } finally { setBusy(false); } }, [project.id, t, value]);
  const checkIn = async () => { setBusy(true); setError(''); try { setResult(await checkInPartyMembers(value, project.id, arriving)); } catch { setError(t('checkinRejected')); } finally { setBusy(false); } };
  const stopCamera = useCallback(() => { cameraRequestRef.current += 1; cameraControlsRef.current?.stop(); cameraControlsRef.current = undefined; setCameraState('idle'); }, []);
  useEffect(() => () => { cameraRequestRef.current += 1; cameraControlsRef.current?.stop(); }, []);
  const startCamera = async () => {
    setCameraError(''); setError(''); setResult(null);
    if (!window.isSecureContext) { setCameraState('error'); setCameraError('cameraSecureContext'); return; }
    if (!navigator.mediaDevices?.getUserMedia) { setCameraState('error'); setCameraError('cameraUnsupported'); return; }
    const request = ++cameraRequestRef.current;
    setCameraState('starting'); scanLockedRef.current = false;
    try {
      const { BrowserQRCodeReader } = await import('@zxing/browser');
      if (!videoRef.current || request !== cameraRequestRef.current) return;
      const reader = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 250 });
      const controls = await reader.decodeFromConstraints({ audio: false, video: { facingMode: { ideal: 'environment' } } }, videoRef.current, (decoded, _decodeError, activeControls) => {
        if (request !== cameraRequestRef.current || !decoded || scanLockedRef.current) return;
        const decodedValue = decoded.getText().trim();
        if (!decodedValue) return;
        scanLockedRef.current = true; activeControls.stop(); cameraControlsRef.current = undefined;
        setValue(decodedValue); setCameraState('decoded'); void verify(decodedValue);
      });
      if (request !== cameraRequestRef.current) { controls.stop(); return; }
      cameraControlsRef.current = controls;
      if (!scanLockedRef.current) setCameraState('active');
    } catch (caught) {
      if (request !== cameraRequestRef.current) return;
      cameraControlsRef.current?.stop(); cameraControlsRef.current = undefined; setCameraState('error');
      setCameraError(scannerCameraFailure(caught) === 'permission' ? 'cameraPermissionDenied' : 'cameraUnavailable');
    }
  };
  const reset = () => { stopCamera(); setValue(''); setResult(null); setError(''); setCameraError(''); setArriving(1); requestAnimationFrame(() => inputRef.current?.focus()); };
  const found = Boolean(result?.guest_id);
  const remaining = result?.remaining_expected ?? 0;
  const eligible = found && result?.rsvp_status === 'accepted' && result.status !== 'complete' && remaining > 0;
  return <div className="mx-auto max-w-3xl"><section className="overflow-hidden rounded-[32px] bg-[#0C2D24] text-white shadow-[0_24px_70px_rgba(12,45,36,.18)]"><div className="border-b border-white/10 p-6 text-center sm:p-10"><QrCode className="mx-auto text-[#D4B363]" size={42} /><p className="mt-5 text-[10px] font-bold uppercase tracking-[.18em] text-[#D4B363]">{t('eventDayScanner')}</p><h1 className="mt-2 text-4xl font-semibold tracking-[-.05em] sm:text-6xl">{t('scannerTitle')}</h1><p className="mx-auto mt-3 max-w-md text-sm text-white/60">{t('scannerHelp')} <bdi>{project.name}</bdi></p></div><div className="p-5 sm:p-8"><div className="mb-5 rounded-3xl border border-white/10 bg-black/20 p-3"><video ref={videoRef} muted playsInline className={`${cameraState === 'starting' || cameraState === 'active' ? 'block' : 'hidden'} aspect-[4/3] w-full rounded-2xl bg-black object-cover`} aria-label={t('cameraPreview')} /><div className="flex flex-col gap-2 sm:flex-row"><button disabled={cameraState === 'starting' || cameraState === 'active'} onClick={() => void startCamera()} className="min-h-14 flex-1 rounded-2xl bg-white px-5 text-sm font-bold text-[#10271F] disabled:opacity-40"><Camera className="me-2 inline" size={18} />{cameraState === 'starting' ? t('cameraStarting') : cameraState === 'decoded' ? t('scanAnotherQr') : t('startCamera')}</button>{(cameraState === 'starting' || cameraState === 'active') && <button onClick={stopCamera} className="min-h-14 rounded-2xl border border-white/25 px-5 text-sm font-semibold"><CameraOff className="me-2 inline" size={18} />{t('stopCamera')}</button>}</div>{cameraState === 'active' && <p className="mt-3 text-center text-xs text-white/60" aria-live="polite">{t('cameraScanning')}</p>}{cameraError && <p className="mt-3 rounded-2xl bg-[#d58c78]/15 p-3 text-sm text-[#F2C6B8]" role="alert">{t(cameraError)}</p>}</div><div className="flex flex-col gap-2 sm:flex-row"><label className="sr-only" htmlFor="backend-scanner-token">{t('scannerPlaceholder')}</label><input id="backend-scanner-token" ref={inputRef} value={value} onChange={(event) => { setValue(event.target.value); setResult(null); }} onKeyDown={(event) => event.key === 'Enter' && void verify()} placeholder={t('scannerPlaceholder')} dir="ltr" className="focus-ring min-h-14 min-w-0 flex-1 rounded-2xl border border-white/20 bg-white/10 px-5 text-base text-white placeholder:text-white/35" /><button disabled={!value.trim() || busy} onClick={() => void verify()} className="min-h-14 rounded-2xl bg-[#D4B363] px-6 text-sm font-bold text-[#10271F] disabled:opacity-40"><Search className="me-2 inline" size={16} />{t('verify')}</button></div><p className="mt-3 text-center text-xs text-white/45">{t('scannerBoundary')}</p>
        {(result || error) && <div className={`mt-6 rounded-3xl border p-5 sm:p-6 ${found ? 'border-[#D4B363]/60 bg-white/[.06]' : 'border-[#d58c78]/60 bg-[#d58c78]/10'}`} aria-live="polite">{found ? <div><div className="flex items-start gap-3"><Check className="mt-1 shrink-0 text-[#D4B363]" /><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#D4B363]">{t(result!.status)}</p><h2 className="mt-1 text-2xl font-semibold">{result!.guest_name}</h2><p className="mt-2 text-sm text-white/65">{t(result!.rsvp_status!)} · {t('confirmedHeadcount')} {result!.confirmed_party_size} · {t('checkedInHeadcount')} {result!.checked_in_count} · {t('remainingExpected')} {remaining}</p>{result!.companion_names?.length ? <p className="mt-2 text-xs text-white/55">{result!.companion_names.join(' · ')}</p> : null}</div></div>{eligible && <div className="mt-5 grid gap-2 sm:grid-cols-[120px_minmax(0,1fr)]"><input type="number" min="1" max={remaining} value={arriving} onChange={(event) => setArriving(Number(event.target.value))} aria-label={t('arrivingNow')} className="min-h-14 rounded-2xl border border-white/20 bg-white/10 px-4" /><button disabled={busy || arriving < 1 || arriving > remaining} onClick={() => void checkIn()} className="min-h-14 rounded-2xl bg-[#D4B363] px-5 text-sm font-bold text-[#10271F] disabled:opacity-40">{t('recordArrivals')}</button></div>}{result!.rsvp_status !== 'accepted' && <p className="mt-4 rounded-2xl bg-[#d58c78]/10 p-3 text-sm text-[#F2C6B8]">{t('acceptedRequired')}</p>}</div> : <div className="flex items-start gap-3"><XCircle className="mt-0.5 shrink-0 text-[#d58c78]" /><div><p className="font-semibold">{error || t(result?.status ?? 'invalid')}</p><p className="mt-1 text-sm text-white/60">{t('tryAgain')}</p></div></div>}<button onClick={reset} className="mt-5 min-h-12 w-full rounded-2xl border border-white/20 text-sm font-semibold">{t('scanNextGuest')}</button></div>}
        {!result && !error && <div className="mt-6 flex items-center gap-3 rounded-2xl border border-white/10 p-4 text-sm text-white/50"><CircleAlert size={18} /><p>{t('scanDoesNotCheckIn')}</p></div>}
      </div></section></div>;
}
