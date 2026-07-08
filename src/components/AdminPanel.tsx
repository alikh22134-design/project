import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type AdminUser = {
  id: string;
  email?: string;
  created_at?: string;
  last_sign_in_at?: string;
  banned_until?: string;
  role: 'owner' | 'admin' | 'user' | string;
};

type AdminResponse = {
  users?: AdminUser[];
  resetLink?: string;
  error?: string;
};

type AdminPanelProps = {
  onClose: () => void;
};

export function AdminPanel({ onClose }: AdminPanelProps) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [message, setMessage] = useState('');
  const [resetLink, setResetLink] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void loadUsers();
  }, []);

  async function callAdmin(body: Record<string, unknown>) {
    const { data, error } = await supabase.functions.invoke<AdminResponse>('admin-users', { body });

    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);

    return data ?? {};
  }

  async function loadUsers() {
    setLoading(true);
    setMessage('');
    setResetLink('');

    try {
      const data = await callAdmin({ action: 'list' });
      setUsers(data.users ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не получилось загрузить аккаунты.');
    } finally {
      setLoading(false);
    }
  }

  async function runAction(userId: string, action: 'ban' | 'unban' | 'setRole' | 'resetPassword', role?: 'admin' | 'user') {
    setLoading(true);
    setMessage('');
    setResetLink('');

    try {
      const data = await callAdmin({ action, userId, role });
      if (data.resetLink) {
        setResetLink(data.resetLink);
        setMessage('Ссылка сброса пароля готова.');
      } else {
        setMessage('Готово.');
      }
      if (action !== 'resetPassword') {
        await loadUsers();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Действие не выполнено.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="admin-page">
      <section className="admin-panel">
        <header className="admin-header">
          <div>
            <p>Owner tools</p>
            <h1>Админ панель</h1>
          </div>
          <div className="admin-actions">
            <button className="auth-button auth-button--ghost" disabled={loading} onClick={loadUsers} type="button">
              Обновить
            </button>
            <button className="auth-button auth-button--ghost" onClick={onClose} type="button">
              Назад
            </button>
          </div>
        </header>

        {message && <p className="auth-message">{message}</p>}
        {resetLink && (
          <textarea className="admin-reset-link" readOnly value={resetLink} />
        )}

        <div className="admin-table">
          <div className="admin-row admin-row--head">
            <span>Email</span>
            <span>Роль</span>
            <span>Статус</span>
            <span>Действия</span>
          </div>

          {users.map((user) => {
            const banned = Boolean(user.banned_until && new Date(user.banned_until) > new Date());
            const isOwner = user.role === 'owner';
            const nextRole = user.role === 'admin' ? 'user' : 'admin';

            return (
              <div className="admin-row" key={user.id}>
                <span>
                  <strong>{user.email || 'Без email'}</strong>
                  <small>{user.id}</small>
                </span>
                <span>{user.role}</span>
                <span>{banned ? 'Бан' : 'Активен'}</span>
                <span className="admin-user-actions">
                  <button disabled={loading || isOwner} onClick={() => runAction(user.id, banned ? 'unban' : 'ban')} type="button">
                    {banned ? 'Разбанить' : 'Бан'}
                  </button>
                  <button disabled={loading || isOwner} onClick={() => runAction(user.id, 'resetPassword')} type="button">
                    Сброс
                  </button>
                  <button
                    disabled={loading || isOwner}
                    onClick={() => runAction(user.id, 'setRole', nextRole)}
                    type="button"
                  >
                    {user.role === 'admin' ? 'Снять admin' : 'Дать admin'}
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
