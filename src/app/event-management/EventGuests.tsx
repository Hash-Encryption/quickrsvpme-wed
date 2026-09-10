import { useEffect, useMemo, useState } from 'react';
import {
  Clock, Edit2, MessageCircle, MoreVertical, Plus, Search,
  Trash2, User, UserCheck, UserMinus, UserPlus, UserX, Users, X
} from 'lucide-react';

import {
  createGuest, listGeneralInvitationRequests, listGuests,
  reviewGeneralInvitationRequest, rotatePersonalInvitation, tagGuest, updateGuest
} from '@/backend/phase2';
import { checkinStatus, setGuestCheckinCount } from '@/backend/phase3';
import type { EventGuest, GeneralInvitationRequest } from '@/backend/types';
import { useAppLocale } from '@/i18n/app-locale';
import { getWhatsAppShareUrl } from '@/wedding/model';
import { invitationUrl } from '../operations';
import type { ProjectSummary } from '../projects';

type FilterType = 'all' | 'accepted' | 'pending' | 'declined';

export function EventGuests({ project }: { project: ProjectSummary }) {
  const { t } = useAppLocale();
  const [guests, setGuests] = useState<EventGuest[]>([]);
  const [requests, setRequests] = useState<GeneralInvitationRequest[]>([]);
  const [tokens, setTokens] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  // Add / Edit Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingGuest, setEditingGuest] = useState<EventGuest | null>(null);
  const [formData, setFormData] = useState({ name: '', phone: '', companions: 0, tag: '' });

  const refresh = async () => {
    try {
      const [nextGuests, nextRequests] = await Promise.all([
        listGuests(project.id),
        listGeneralInvitationRequests(project.id),
      ]);
      setGuests(nextGuests);
      setRequests(nextRequests);
    } catch {
      setError(t('operationFailed'));
    }
  };

  useEffect(() => {
    setLoading(true);
    setError('');
    void refresh().finally(() => setLoading(false));
  }, [project.id]);

  // Strict token isolation: retrieve or rotate personal token strictly keyed by guest.id
  const getGuestUrl = async (guest: EventGuest): Promise<string> => {
    let token = tokens[guest.id] || (guest as unknown as { token?: string }).token;
    if (!token) {
      token = await rotatePersonalInvitation(guest.id);
      if (token) {
        const resolvedToken = token;
        setTokens((prev) => ({ ...prev, [guest.id]: resolvedToken }));
      }
    }
    return token ? invitationUrl(window.location.origin, import.meta.env.BASE_URL, token) : '';
  };

  const openGuestWhatsApp = async (guest: EventGuest) => {
    setBusy(`wa-${guest.id}`);
    try {
      const url = await getGuestUrl(guest);
      const waUrl = getWhatsAppShareUrl(
        project.type === 'wedding' ? 'wedding' : 'standard',
        project.name,
        guest.phone || '',
        url
      );
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    } catch {
      setError(t('operationFailed'));
    } finally {
      setBusy('');
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setBusy('create');
    setError('');
    try {
      const created = await createGuest(
        project.id,
        formData.name.trim(),
        formData.phone.trim(),
        formData.companions
      );
      if (formData.tag.trim()) {
        await tagGuest(project.id, created.guest.id, formData.tag.trim());
      }
      setFormData({ name: '', phone: '', companions: 0, tag: '' });
      setShowAddModal(false);
      await refresh();
    } catch {
      setError(t('operationFailed'));
    } finally {
      setBusy('');
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGuest || !formData.name.trim()) return;

    setBusy(`edit-${editingGuest.id}`);
    setError('');
    try {
      await updateGuest(editingGuest.id, {
        name: formData.name.trim(),
        phone: formData.phone.trim() || null,
        allowed_companions: formData.companions,
      });
      if (formData.tag.trim()) {
        await tagGuest(project.id, editingGuest.id, formData.tag.trim());
      }
      setEditingGuest(null);
      await refresh();
    } catch {
      setError(t('operationFailed'));
    } finally {
      setBusy('');
    }
  };

  const openEditModal = (guest: EventGuest) => {
    const existingTag = guest.event_guest_tag_assignments?.[0]?.event_guest_tags;
    const tagName = Array.isArray(existingTag)
      ? existingTag[0]?.name
      : existingTag?.name;

    setEditingGuest(guest);
    setFormData({
      name: guest.name,
      phone: guest.phone || '',
      companions: guest.allowed_companions,
      tag: tagName || '',
    });
  };

  const reviewRequest = async (request: GeneralInvitationRequest, decision: 'approved' | 'rejected') => {
    setBusy(`req-${request.id}`);
    setError('');
    try {
      await reviewGeneralInvitationRequest(project.id, request.id, decision);
      await refresh();
    } catch {
      setError(t('operationFailed'));
    } finally {
      setBusy('');
    }
  };

  const visibleGuests = useMemo(() => {
    return guests.filter((guest) => {
      const matchesFilter = filter === 'all' || guest.rsvp_status === filter;
      const term = query.trim().toLowerCase();
      const matchesQuery =
        !term ||
        guest.name.toLowerCase().includes(term) ||
        (guest.phone && guest.phone.includes(term));

      return matchesFilter && matchesQuery;
    });
  }, [filter, guests, query]);

  const awaitingRequests = requests.filter((r) => r.state === 'awaiting');

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-24">
      {/* 1. Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--qr-primary)]">
            {t('guests')}
          </h1>
          <p className="mt-1 text-xs text-[#756F66]">
            {project.type === 'wedding'
              ? 'إدارة قائمة المدعوين لحفل الزفاف'
              : 'إدارة قائمة المدعوين للمناسبة'}
          </p>
        </div>
        <span className="rounded-full border border-[#D9D2C5] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#17251F]">
          {guests.length} {t('guestRecords')}
        </span>
      </div>

      {error && (
        <p className="rounded-2xl bg-[#8c302b]/10 p-4 text-sm text-[#8c302b]" role="alert">
          {error}
        </p>
      )}

      {/* 2. General Requests Banner (if any) */}
      {awaitingRequests.length > 0 && (
        <section className="rounded-2xl border border-[#E8DFC8] bg-[#FDFBF7] p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#8B7040]">
              {t('generalRequests')} ({awaitingRequests.length})
            </h2>
          </div>
          <div className="mt-3 space-y-2">
            {awaitingRequests.map((request) => (
              <div
                key={request.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl bg-white p-3 border border-[#E8E2D8]"
              >
                <div>
                  <p className="text-sm font-semibold text-[#17251F]">{request.name}</p>
                  <p className="text-xs text-[#756F66]" dir="ltr">{request.phone}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={busy === `req-${request.id}`}
                    onClick={() => void reviewRequest(request, 'approved')}
                    className="rounded-lg bg-[#0C2D24] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#174839] disabled:opacity-50"
                  >
                    {t('approve')}
                  </button>
                  <button
                    type="button"
                    disabled={busy === `req-${request.id}`}
                    onClick={() => void reviewRequest(request, 'rejected')}
                    className="rounded-lg border border-[#8c302b]/40 px-3 py-1.5 text-xs font-bold text-[#8c302b] transition hover:bg-[#8c302b]/10 disabled:opacity-50"
                  >
                    {t('reject')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 3. Search Bar */}
      <div className="relative">
        <span className="absolute inset-y-0 start-0 flex items-center ps-4 pointer-events-none text-[#9E988D]">
          <Search size={18} aria-hidden="true" />
        </span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('searchGuestsPlaceholder')}
          className="qr-field-inline min-h-12 w-full rounded-2xl bg-white ps-11 pe-4 text-sm text-[#17251F] border border-[#E8E2D8] placeholder:text-[#A8A196] focus:border-[var(--qr-primary)]"
          aria-label={t('searchGuests')}
        />
      </div>

      {/* 4. Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1" role="tablist">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`min-h-9 shrink-0 rounded-full px-4 text-xs font-bold transition ${
            filter === 'all'
              ? 'bg-[#0C2D24] text-white shadow-xs'
              : 'border border-[#E8E2D8] bg-white text-[#756F66] hover:border-[#0C2D24]/40'
          }`}
        >
          {t('allFilter')} ({guests.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('accepted')}
          className={`min-h-9 shrink-0 rounded-full px-4 text-xs font-bold transition ${
            filter === 'accepted'
              ? 'bg-[#1B6344] text-white shadow-xs'
              : 'border border-[#D5EADF] bg-[#EBF5F0] text-[#1B6344] hover:bg-[#E2F0E9]'
          }`}
        >
          {t('confirmedFilter')} ({guests.filter((g) => g.rsvp_status === 'accepted').length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('pending')}
          className={`min-h-9 shrink-0 rounded-full px-4 text-xs font-bold transition ${
            filter === 'pending'
              ? 'bg-[#8B7040] text-white shadow-xs'
              : 'border border-[#F6E9C8] bg-[#FDF6E2] text-[#8B7040] hover:bg-[#F9F0D6]'
          }`}
        >
          {t('pendingFilter')} ({guests.filter((g) => g.rsvp_status === 'pending').length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('declined')}
          className={`min-h-9 shrink-0 rounded-full px-4 text-xs font-bold transition ${
            filter === 'declined'
              ? 'bg-[#9C382A] text-white shadow-xs'
              : 'border border-[#F8D8D3] bg-[#FDF0ED] text-[#9C382A] hover:bg-[#FCE6E2]'
          }`}
        >
          {t('declinedFilter')} ({guests.filter((g) => g.rsvp_status === 'declined').length})
        </button>
      </div>

      {/* 5. Guests List */}
      {loading ? (
        <div className="py-12 text-center text-sm text-[#756F66]">
          {t('loading')}
        </div>
      ) : visibleGuests.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#D9D2C5] bg-white p-10 text-center">
          <p className="text-sm font-medium text-[#756F66]">
            {t('noGuests')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleGuests.map((guest) => {
            const hasCompanions = guest.allowed_companions > 0 || guest.confirmed_party_size > 1;
            const companionCount = guest.confirmed_party_size > 0 ? guest.confirmed_party_size : (1 + guest.allowed_companions);

            return (
              <article
                key={guest.id}
                data-testid={`guest-card-${guest.id}`}
                className="flex items-center justify-between rounded-2xl border border-[#E8E2D8] bg-white p-4 transition hover:border-[var(--qr-primary)] hover:shadow-xs"
              >
                {/* Guest Info */}
                <div className="min-w-0 flex-1 me-3">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm sm:text-base text-[#17251F] truncate">
                      {guest.name}
                    </h3>
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#756F66]">
                    {guest.phone ? (
                      <span dir="ltr" className="font-medium text-[#564F46]">
                        {guest.phone}
                      </span>
                    ) : (
                      <span className="text-[#A8A196]">{t('missingPhone')}</span>
                    )}

                    <span className="text-[#D9D2C5]">·</span>

                    {/* Companion count indicator */}
                    <span className="inline-flex items-center gap-1 font-medium">
                      <Users size={13} className="text-[#8B7040]" aria-hidden="true" />
                      {hasCompanions ? `${companionCount} ${t('companionPlural')}` : t('soloGuest')}
                    </span>
                  </div>

                  {/* RSVP status badge */}
                  <div className="mt-2">
                    {guest.rsvp_status === 'accepted' && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-[#EBF5F0] px-2 py-0.5 text-[11px] font-bold text-[#1B6344]">
                        <UserCheck size={12} aria-hidden="true" />
                        {t('accepted')}
                      </span>
                    )}
                    {guest.rsvp_status === 'pending' && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-[#FDF6E2] px-2 py-0.5 text-[11px] font-bold text-[#8B7040]">
                        <Clock size={12} aria-hidden="true" />
                        {t('pending')}
                      </span>
                    )}
                    {guest.rsvp_status === 'declined' && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-[#FDF0ED] px-2 py-0.5 text-[11px] font-bold text-[#9C382A]">
                        <UserX size={12} aria-hidden="true" />
                        {t('declined')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Quick Action Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* WhatsApp Direct Share */}
                  <button
                    type="button"
                    data-testid={`button-wa-guest-${guest.id}`}
                    aria-label={`${t('directWhatsApp')} - ${guest.name}`}
                    disabled={busy === `wa-${guest.id}`}
                    onClick={() => void openGuestWhatsApp(guest)}
                    className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-[#EBF5F0] text-[#1B6344] transition hover:bg-[#D5EADF] active:scale-95 disabled:opacity-50"
                  >
                    <MessageCircle size={18} aria-hidden="true" />
                  </button>

                  {/* Edit Guest Button */}
                  <button
                    type="button"
                    data-testid={`button-edit-guest-${guest.id}`}
                    aria-label={`${t('edit')} - ${guest.name}`}
                    onClick={() => openEditModal(guest)}
                    className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl border border-[#E8E2D8] bg-[#FAF8F4] text-[#564F46] transition hover:border-[#0C2D24] hover:text-[#0C2D24] active:scale-95"
                  >
                    <Edit2 size={16} aria-hidden="true" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* 6. Sticky Floating Add Guest Bottom Bar */}
      <div className="fixed inset-x-0 bottom-16 z-30 p-4 max-w-2xl mx-auto pointer-events-none">
        <button
          type="button"
          data-testid="button-floating-add-guest"
          onClick={() => {
            setFormData({ name: '', phone: '', companions: 0, tag: '' });
            setShowAddModal(true);
          }}
          className="pointer-events-auto flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#0C2D24] px-5 py-3.5 text-sm font-bold text-white shadow-[0_8px_25px_rgba(12,45,36,0.35)] transition hover:bg-[#174839] active:scale-[0.99]"
        >
          <Plus size={18} strokeWidth={2.4} aria-hidden="true" />
          <span>{t('addNewGuestAction')}</span>
        </button>
      </div>

      {/* 7. Add Guest Modal / Sheet */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4 backdrop-blur-xs">
          <div
            role="dialog"
            aria-labelledby="add-guest-title"
            aria-modal="true"
            className="w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-[#E8E2D8] bg-white p-6 shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#F0EBE1]">
              <h2 id="add-guest-title" className="text-lg font-bold text-[#17251F]">
                {t('addNewGuestAction')}
              </h2>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-[#756F66] hover:bg-[#F5F2EC]"
                aria-label={t('cancel')}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#17251F] mb-1.5" htmlFor="add-guest-name">
                  {t('operationName')} <span className="text-[#9C382A]">*</span>
                </label>
                <input
                  id="add-guest-name"
                  type="text"
                  required
                  autoFocus
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t('guest')}
                  className="qr-field-inline min-h-12 w-full rounded-xl px-3.5 text-sm border border-[#D9D2C5]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#17251F] mb-1.5" htmlFor="add-guest-phone">
                  {t('missingPhone')}
                </label>
                <input
                  id="add-guest-phone"
                  type="tel"
                  dir="ltr"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+966 5..."
                  className="qr-field-inline min-h-12 w-full rounded-xl px-3.5 text-sm border border-[#D9D2C5]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#17251F] mb-1.5" htmlFor="add-guest-companions">
                  {t('companionAllowance')}
                </label>
                <input
                  id="add-guest-companions"
                  type="number"
                  min="0"
                  max="50"
                  value={formData.companions}
                  onChange={(e) => setFormData({ ...formData, companions: Number(e.target.value) })}
                  className="qr-field-inline min-h-12 w-full rounded-xl px-3.5 text-sm border border-[#D9D2C5]"
                />
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="submit"
                  disabled={!formData.name.trim() || busy === 'create'}
                  className="min-h-12 flex-1 rounded-xl bg-[#0C2D24] text-xs font-bold text-white transition hover:bg-[#174839] disabled:opacity-50"
                >
                  {busy === 'create' ? t('loading') : t('addGuest')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="min-h-12 rounded-xl border border-[#D9D2C5] px-5 text-xs font-semibold text-[#564F46] hover:bg-[#F5F2EC]"
                >
                  {t('cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. Edit Guest Modal / Sheet */}
      {editingGuest && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4 backdrop-blur-xs">
          <div
            role="dialog"
            aria-labelledby="edit-guest-title"
            aria-modal="true"
            className="w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-[#E8E2D8] bg-white p-6 shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#F0EBE1]">
              <h2 id="edit-guest-title" className="text-lg font-bold text-[#17251F]">
                {t('editGuestTitle')}
              </h2>
              <button
                type="button"
                onClick={() => setEditingGuest(null)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-[#756F66] hover:bg-[#F5F2EC]"
                aria-label={t('cancel')}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#17251F] mb-1.5" htmlFor="edit-guest-name">
                  {t('operationName')} <span className="text-[#9C382A]">*</span>
                </label>
                <input
                  id="edit-guest-name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="qr-field-inline min-h-12 w-full rounded-xl px-3.5 text-sm border border-[#D9D2C5]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#17251F] mb-1.5" htmlFor="edit-guest-phone">
                  {t('missingPhone')}
                </label>
                <input
                  id="edit-guest-phone"
                  type="tel"
                  dir="ltr"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="qr-field-inline min-h-12 w-full rounded-xl px-3.5 text-sm border border-[#D9D2C5]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#17251F] mb-1.5" htmlFor="edit-guest-companions">
                  {t('companionAllowance')}
                </label>
                <input
                  id="edit-guest-companions"
                  type="number"
                  min="0"
                  max="50"
                  value={formData.companions}
                  onChange={(e) => setFormData({ ...formData, companions: Number(e.target.value) })}
                  className="qr-field-inline min-h-12 w-full rounded-xl px-3.5 text-sm border border-[#D9D2C5]"
                />
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="submit"
                  disabled={!formData.name.trim() || busy === `edit-${editingGuest.id}`}
                  className="min-h-12 flex-1 rounded-xl bg-[#0C2D24] text-xs font-bold text-white transition hover:bg-[#174839] disabled:opacity-50"
                >
                  {busy === `edit-${editingGuest.id}` ? t('loading') : t('saveChanges')}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingGuest(null)}
                  className="min-h-12 rounded-xl border border-[#D9D2C5] px-5 text-xs font-semibold text-[#564F46] hover:bg-[#F5F2EC]"
                >
                  {t('cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
