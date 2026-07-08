import { FormEvent, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

const disposableEmailDomains = new Set([
  '10minutemail.com',
  'guerrillamail.com',
  'mailinator.com',
  'temp-mail.org',
  'tempmail.com',
  'yopmail.com',
]);

const emailPattern = /^[a-z0-9](?:[a-z0-9._%+-]{1,62}[a-z0-9])@[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])(?:\.[a-z]{2,24})+$/i;

function isLikelyRealEmail(value: string) {
  const normalizedEmail = value.trim().toLowerCase();
  const [localPart, domain = ''] = normalizedEmail.split('@');
  const domainLabels = domain.split('.');
  const mainDomain = domainLabels[0] ?? '';

  if (!emailPattern.test(normalizedEmail)) return false;
  if (disposableEmailDomains.has(domain)) return false;
  if (!/[a-z]/.test(localPart) || !/[a-z]/.test(mainDomain)) return false;
  if (/^(\d+|[a-z])$/i.test(localPart)) return false;
  if (/^(\d+|[a-z])$/i.test(mainDomain)) return false;

  return true;
}

type AuthProps = {
  initialMode?: 'signin' | 'signup';
  isAdmin?: boolean;
  notice?: string;
  onContinueWithoutAccount?: () => void;
  onOpenAdmin?: () => void;
  session: Session | null;
};

export function Auth({
  initialMode = 'signin',
  isAdmin = false,
  notice = '',
  onContinueWithoutAccount,
  onOpenAdmin,
  session,
}: AuthProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setMode(initialMode);
    setMessage('');
  }, [initialMode]);

  async function signInWithGoogle() {
    setBusy(true);
    setMessage('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) {
      setMessage(error.message);
      setBusy(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');

    const cleanEmail = email.trim().toLowerCase();
    if (!isLikelyRealEmail(cleanEmail)) {
      setMessage('Введи настоящую почту, например name@gmail.com. Фейковые адреса не проходят.');
      return;
    }

    setBusy(true);

    try {
      const result =
        mode === 'signup'
          ? await supabase.auth.signUp({
              email: cleanEmail,
              password,
              options: { emailRedirectTo: window.location.origin },
            })
          : await supabase.auth.signInWithPassword({ email: cleanEmail, password });

      if (result.error) {
        setMessage(result.error.message);
      } else if (mode === 'signup') {
        setMessage('Аккаунт создан. Проверь почту и подтверди email.');
      }
    } catch {
      setMessage('Не получилось войти. Попробуй еще раз.');
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    await supabase.auth.signOut();
    setBusy(false);
  }

  if (session?.user) {
    const name =
      session?.user.user_metadata?.full_name ||
      session?.user.user_metadata?.name ||
      session?.user.email ||
      '';

    return (
      <div className="auth-bar">
        <div className="auth-user">
          <span className="auth-dot" />
          <span>{name}</span>
        </div>
        <div className="auth-actions">
          {isAdmin && (
            <button className="auth-button auth-button--ghost" onClick={onOpenAdmin} type="button">
              Админ
            </button>
          )}
          <button
            className="auth-button auth-button--ghost"
            disabled={busy}
            onClick={signOut}
            type="button"
          >
            Выйти
          </button>
        </div>
      </div>
    );
  }

  return (
    <section className="auth-panel">
      <div className="auth-panel__top">
        <div className="auth-panel__title">
          <span>{mode === 'signin' ? 'С возвращением' : 'Новый аккаунт'}</span>
          <strong>{mode === 'signin' ? 'Войди в аккаунт' : 'Создай аккаунт'}</strong>
        </div>

        <button className="auth-button auth-button--google" disabled={busy} onClick={signInWithGoogle} type="button">
          Войти через Google
        </button>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        <input
          onChange={(event) => setEmail(event.target.value)}
          placeholder="email"
          required
          title="Введи настоящую почту, например name@gmail.com"
          type="email"
          value={email}
        />
        <input
          minLength={6}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="пароль"
          required
          type="password"
          value={password}
        />
        <button className="auth-button" disabled={busy} type="submit">
          {busy ? 'Подожди...' : mode === 'signin' ? 'Войти' : 'Зарегистрироваться'}
        </button>
      </form>

      {(message || notice) && <p className="auth-message">{message || notice}</p>}

      {onContinueWithoutAccount && (
        <button className="auth-button auth-button--guest" disabled={busy} onClick={onContinueWithoutAccount} type="button">
          Продолжить без аккаунта
        </button>
      )}

      <p className="auth-help">
        {mode === 'signin' ? 'Нет аккаунта?' : 'Уже есть аккаунт?'}
        <button
          className="auth-link"
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin');
            setMessage('');
          }}
          type="button"
        >
          {mode === 'signin' ? 'Создать аккаунт' : 'Войти'}
        </button>
      </p>
    </section>
  );
}
