import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';

import { getSession, onAuthStateChange, signOut as endSession } from '@/backend/auth';
import { getCurrentClient, isPlatformAdmin } from '@/backend/clients';
import { listEntitlements } from '@/backend/entitlements';
import { toBackendError, type BackendError } from '@/backend/errors';
import { listEvents } from '@/backend/events';
import type { BackendEvent, ClientAccount, ClientEntitlement } from '@/backend/types';
import { accountBootstrapError, createAuthBootstrapScheduler, startAccountBootstrap } from './bootstrap';

type AuthContextValue = {
  session: Session | null;
  client: ClientAccount | null;
  entitlements: ClientEntitlement[];
  events: BackendEvent[];
  admin: boolean;
  loading: boolean;
  dataLoading: boolean;
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
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<BackendError | null>(null);
  const requestRef = useRef(0);
  const activeUserRef = useRef<string | null>(null);

  const hydrate = useCallback(async (nextSession: Session | null) => {
    const request = ++requestRef.current;
    setSession(nextSession);
    setLoading(true);
    setDataLoading(Boolean(nextSession));
    setError(null);
    if (!nextSession) {
      activeUserRef.current = null;
      setClient(null); setEntitlements([]); setEvents([]); setAdmin(false); setLoading(false); setDataLoading(false);
      return;
    }
    activeUserRef.current = nextSession.user.id;
    try {
      const bootstrap = await startAccountBootstrap({ client: getCurrentClient, entitlements: listEntitlements, events: listEvents, admin: isPlatformAdmin });
      if (request !== requestRef.current) return;
      setClient(bootstrap.client);
      setLoading(false);
      const optional = await bootstrap.optional;
      if (request !== requestRef.current) return;
      if (optional.entitlements) setEntitlements(optional.entitlements);
      if (optional.events) setEvents(optional.events);
      if (optional.admin !== undefined) setAdmin(optional.admin);
      setDataLoading(false);
    } catch (caught) {
      if (request !== requestRef.current) return;
      activeUserRef.current = null;
      if (import.meta.env.DEV) console.error('QuickRSVP account bootstrap failed.', caught);
      setError(accountBootstrapError(caught));
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const scheduler = createAuthBootstrapScheduler((session) => { if (active) void hydrate(session); });
    let subscription: ReturnType<typeof onAuthStateChange> | undefined;
    try {
      subscription = onAuthStateChange((_event, nextSession) => {
        if (nextSession && activeUserRef.current === nextSession.user.id) setSession(nextSession);
        else scheduler.schedule(nextSession);
      });
    } catch (caught) {
      setError(toBackendError(caught)); setLoading(false);
    }
    return () => { active = false; scheduler.cancel(); subscription?.unsubscribe(); };
  }, [hydrate]);

  const refresh = useCallback(async () => hydrate(await getSession()), [hydrate]);
  const signOut = useCallback(async () => {
    try { await endSession(); }
    catch (caught) { setError(toBackendError(caught)); }
  }, []);
  const value = useMemo(() => ({ session, client, entitlements, events, admin, loading, dataLoading, error, refresh, signOut }), [session, client, entitlements, events, admin, loading, dataLoading, error, refresh, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('Auth context unavailable');
  return value;
}
