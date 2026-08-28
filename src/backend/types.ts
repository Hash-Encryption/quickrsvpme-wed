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
  archived_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
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
