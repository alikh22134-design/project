import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AdminPanel } from './components/AdminPanel';
import { Auth } from './components/Auth';
import { supabase } from './lib/supabase';
import CharacterGuessPage from './pages/CharacterGuessPage';

const guestGameLimit = 2;
const guestGamesUsedKey = 'guestGuessGamesUsedTest3';
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
  const [guest, setGuest] = useState(() => {
    const gamesUsed = Number(localStorage.getItem(guestGamesUsedKey) || '0');
    return gamesUsed < guestGameLimit;
  });

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;

      setSession(data.session);
      if (!data.session?.user) {
        enterAsGuest();
      }
      setLoadingSession(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession?.user) {
        enterAsGuest();
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
    const gamesUsed = Number(localStorage.getItem(guestGamesUsedKey) || '0');

    if (gamesUsed >= guestGameLimit) {
      setGuest(false);
      setAuthNotice('Вы уже попробовали игру. Хотите создать аккаунт, чтобы продолжить?');
      return;
    }

    setAuthNotice('');
    setGuest(true);
  }

  function endGuestAccess() {
    setGuest(false);
    setAuthNotice('Вы уже попробовали игру. Хотите создать аккаунт, чтобы продолжить?');
  }

  const userEmail = session?.user.email?.toLowerCase() ?? '';
  const userRole = session?.user.app_metadata?.role;
  const isAdmin =
    userRole === 'owner' ||
    userRole === 'admin' ||
    ownerEmails.includes(userEmail) ||
    adminEmails.includes(userEmail);
  const shouldShowRegistrationPrompt =
    !session?.user &&
    !guest &&
    Number(localStorage.getItem(guestGamesUsedKey) || '0') >= guestGameLimit;
  const authPromptNotice = shouldShowRegistrationPrompt
    ? 'Вы уже попробовали игру. Хотите создать аккаунт, чтобы продолжить?'
    : authNotice;

  if (loadingSession) {
    return (
      <main className="auth-gate">
        <div className="auth-loading">Проверяем вход...</div>
      </main>
    );
  }

  if (!session?.user && !guest) {
    return (
      <main className="auth-gate">
        <Auth notice={authPromptNotice} session={session} />
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
        <CharacterGuessPage isGuest={guest && !session?.user} onGuestLimitEnd={endGuestAccess} />
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
