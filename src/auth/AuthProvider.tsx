import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';

import { getSession, onAuthStateChange, signOut as endSession } from '@/backend/auth';
import { getCurrentClient, isPlatformAdmin } from '@/backend/clients';
import { listEntitlements } from '@/backend/entitlements';
import { toBackendError, type BackendError } from '@/backend/errors';
import { listEvents } from '@/backend/events';
import type { BackendEvent, ClientAccount, ClientEntitlement } from '@/backend/types';

type AuthContextValue = {
  session: Session | null;
  client: ClientAccount | null;
  entitlements: ClientEntitlement[];
  events: BackendEvent[];
  admin: boolean;
  loading: boolean;
  error: BackendError | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [client, setClient] = useState<ClientAccount | null>(null);
  const [entitlements, setEntitlements] = useState<ClientEntitlement[]>([]);
  const [events, setEvents] = useState<BackendEvent[]>([]);
  const [admin, setAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<BackendError | null>(null);
  const requestRef = useRef(0);

  const hydrate = useCallback(async (nextSession: Session | null) => {
    const request = ++requestRef.current;
    setSession(nextSession);
    setLoading(true);
    setError(null);
    if (!nextSession) {
      setClient(null); setEntitlements([]); setEvents([]); setAdmin(false); setLoading(false);
      return;
    }
    try {
      const [nextClient, nextEntitlements, nextEvents, nextAdmin] = await Promise.all([
        getCurrentClient(), listEntitlements(), listEvents(), isPlatformAdmin(),
      ]);
      if (request !== requestRef.current) return;
      setClient(nextClient); setEntitlements(nextEntitlements); setEvents(nextEvents); setAdmin(nextAdmin);
    } catch (caught) {
      if (request !== requestRef.current) return;
      if (import.meta.env.DEV) console.error('QuickRSVP account bootstrap failed.', caught);
      setError(toBackendError(caught));
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void getSession().then((value) => { if (active) return hydrate(value); }).catch((caught) => {
      if (!active) return;
      setError(toBackendError(caught)); setLoading(false);
    });
    let subscription: ReturnType<typeof onAuthStateChange> | undefined;
    try {
      subscription = onAuthStateChange((_event, nextSession) => queueMicrotask(() => active && void hydrate(nextSession)));
    } catch (caught) {
      setError(toBackendError(caught)); setLoading(false);
    }
    return () => { active = false; subscription?.unsubscribe(); };
  }, [hydrate]);

  const refresh = useCallback(async () => hydrate(await getSession()), [hydrate]);
  const signOut = useCallback(async () => {
    try { await endSession(); }
    catch (caught) { setError(toBackendError(caught)); }
  }, []);
  const value = useMemo(() => ({ session, client, entitlements, events, admin, loading, error, refresh, signOut }), [session, client, entitlements, events, admin, loading, error, refresh, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('Auth context unavailable');
  return value;
}
