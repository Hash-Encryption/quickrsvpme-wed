export type ProductId = 'wedding' | 'party';
export type EntitlementStatus = 'active' | 'suspended' | 'cancelled' | 'expired';
export type EventLifecycle = 'planning' | 'active' | 'ended' | 'archived' | 'cancelled';

export type ClientAccount = {
  id: string;
  display_name: string;
  status: 'active' | 'suspended';
  created_at: string;
  updated_at: string;
};

export type ClientEntitlement = {
  id: string;
  client_id: string;
  product_id: ProductId;
  status: EntitlementStatus;
  starts_at: string;
  ends_at: string | null;
  policy_overrides: Record<string, unknown>;
};

export type BackendEvent = {
  id: string;
  client_id: string;
  product_id: ProductId;
  title: string;
  lifecycle_status: EventLifecycle;
  invitation_locale: 'ar' | 'en';
  starts_at: string | null;
  ends_at: string | null;
  rsvp_deadline: string | null;
  venue_name: string | null;
  city: string | null;
  request_companion_names: boolean;
  allow_custom_messages: boolean;
  allow_rsvp_changes: boolean;
  general_invite_allowed_companions: number;
  archived_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  source_draft_id?: string | null;
};

export type EventGuest = {
  id: string;
  event_id: string;
  name: string;
  phone: string | null;
  source: 'client' | 'general_invite';
  allowed_companions: number;
  invitation_variant_override: 'women' | 'men' | 'both' | 'family' | 'custom' | null;
  rsvp_status: 'pending' | 'accepted' | 'declined';
  confirmed_party_size: number;
  companion_names: string[];
  custom_message: string | null;
  responded_at: string | null;
  checked_in_count: number;
  first_checked_in_at: string | null;
  last_checkin_activity_at: string | null;
  personal_invitations?: Array<{ id: string; open_count: number; first_opened_at: string | null; last_opened_at: string | null; revoked_at: string | null }>;
  event_guest_tag_assignments?: Array<{ event_guest_tags: Array<{ name: string }> }>;
};

export type InvitationResolution = {
  status: 'active' | 'archived_read_only' | 'invalid' | 'unavailable' | 'cancelled' | 'planning' | 'ended' | 'subscription_unavailable';
  kind?: 'personal' | 'general';
  event?: Pick<BackendEvent, 'product_id' | 'title' | 'invitation_locale' | 'starts_at' | 'ends_at' | 'rsvp_deadline' | 'venue_name' | 'city' | 'request_companion_names' | 'allow_custom_messages' | 'allow_rsvp_changes' | 'general_invite_allowed_companions'>;
  configuration?: Record<string, unknown>;
  guest?: { name: string; allowed_companions: number; invitation_variant_override: EventGuest['invitation_variant_override']; rsvp_status: EventGuest['rsvp_status']; confirmed_party_size: number; companion_names: string[]; custom_message: string | null };
};

export type CreateEventInput = {
  productId: ProductId;
  title: string;
  invitationLocale?: 'ar' | 'en';
  startsAt?: string | null;
  endsAt?: string | null;
  rsvpDeadline?: string | null;
  venueName?: string | null;
  city?: string | null;
  targetClientId?: string | null;
};
