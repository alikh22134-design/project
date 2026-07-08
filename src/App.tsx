import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AdminPanel } from './components/AdminPanel';
import { Auth } from './components/Auth';
import { supabase } from './lib/supabase';
import CharacterGuessPage from './pages/CharacterGuessPage';

const ownerEmails = (import.meta.env.VITE_OWNER_EMAILS ?? '')
  .split(',')
  .map((email: string) => email.trim().toLowerCase())
  .filter(Boolean);
const adminEmails = (import.meta.env.VITE_ADMIN_EMAILS ?? '')
  .split(',')
  .map((email: string) => email.trim().toLowerCase())
  .filter(Boolean);
const banStatusCheckMs = 2000;

type UserStatusResponse = {
  banned_until?: string;
  error?: string;
};

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [authNotice, setAuthNotice] = useState('');
  const [showAdmin, setShowAdmin] = useState(false);
  const [guest, setGuest] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;

      setSession(data.session);
      if (!data.session?.user) {
        enterAsGuest();
      } else {
        setShowAuth(false);
      }
      setLoadingSession(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession?.user) {
        enterAsGuest();
      } else {
        setShowAuth(false);
      }
      setLoadingSession(false);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user) return;

    let cancelled = false;

    async function checkBanStatus() {
      const banned = await isCurrentUserBanned();
      if (!banned || cancelled) return;

      setGuest(false);
      setShowAdmin(false);
      setSession(null);
      setAuthNotice('Аккаунт забанен.');
      await supabase.auth.signOut();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void checkBanStatus();
      }
    }

    void checkBanStatus();
    const interval = window.setInterval(() => void checkBanStatus(), banStatusCheckMs);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [session?.user?.id]);

  function enterAsGuest() {
    setAuthNotice('');
    setShowAuth(false);
    setGuest(true);
  }

  function openAuth(mode: 'signin' | 'signup' = 'signup') {
    setAuthMode(mode);
    setShowAuth(true);
    setGuest(false);
  }

  const userEmail = session?.user.email?.toLowerCase() ?? '';
  const userRole = session?.user.app_metadata?.role;
  const isAdmin =
    userRole === 'owner' ||
    userRole === 'admin' ||
    ownerEmails.includes(userEmail) ||
    adminEmails.includes(userEmail);
  if (loadingSession) {
    return (
      <main className="auth-gate">
        <div className="auth-loading">Проверяем вход...</div>
      </main>
    );
  }

  if (!session?.user && (!guest || showAuth)) {
    return (
      <main className="auth-gate">
        <Auth
          initialMode={authMode}
          notice={authNotice}
          onContinueWithoutAccount={enterAsGuest}
          session={session}
        />
      </main>
    );
  }

  return (
    <>
      {session?.user && (
        <Auth
          isAdmin={isAdmin}
          notice={authNotice}
          onOpenAdmin={() => setShowAdmin(true)}
          session={session}
        />
      )}
      {showAdmin && isAdmin ? (
        <AdminPanel onClose={() => setShowAdmin(false)} />
      ) : (
        <CharacterGuessPage isGuest={guest && !session?.user} onOpenAuth={openAuth} />
      )}
    </>
  );
}

async function isCurrentUserBanned() {
  const { data, error } = await supabase.functions.invoke<UserStatusResponse>('admin-users', {
    body: { action: 'status' },
  });

  if (error || data?.error || !data?.banned_until) return false;

  return new Date(data.banned_until) > new Date();
}
