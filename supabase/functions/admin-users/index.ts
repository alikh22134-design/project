import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const url = Deno.env.get('SUPABASE_URL') ?? '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const adminEmails = (Deno.env.get('ADMIN_EMAILS') ?? '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);
const ownerEmails = (Deno.env.get('OWNER_EMAILS') ?? '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

const service = createClient(url, serviceRoleKey);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    if (!url || !anonKey || !serviceRoleKey) {
      throw new Error('Admin function is missing Supabase environment variables.');
    }

    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    if (!token) return json({ error: 'Unauthorized' }, 401);

    const { data: authData, error: authError } = await service.auth.getUser(token);
    if (authError || !authData.user) return json({ error: 'Unauthorized' }, 401);
    const actorRole = getRole(authData.user);

    const body = await req.json().catch(() => ({}));
    const action = body.action as string | undefined;

    if (action === 'status') {
      const target = await getTargetUser(authData.user.id);

      return json({
        banned_until: target.user.banned_until,
        role: getRole(target.user),
      });
    }

    if (!canUseAdminPanel(authData.user)) return json({ error: 'Forbidden' }, 403);

    if (action === 'list') {
      const { data, error } = await service.auth.admin.listUsers({
        page: Number(body.page ?? 1),
        perPage: Number(body.perPage ?? 100),
      });
      if (error) throw error;

      return json({
        users: data.users.map((user) => ({
          id: user.id,
          email: user.email,
          created_at: user.created_at,
          last_sign_in_at: user.last_sign_in_at,
          banned_until: user.banned_until,
          role: getRole(user),
        })),
      });
    }

    if (action === 'ban' || action === 'unban') {
      const userId = requireUserId(body.userId);
      const target = await getTargetUser(userId);
      assertOwnerProtected(target.user, action);

      const { error } = await service.auth.admin.updateUserById(userId, {
        ban_duration: action === 'ban' ? '876000h' : 'none',
      });
      if (error) throw error;

      return json({ ok: true });
    }

    if (action === 'setRole') {
      const userId = requireUserId(body.userId);
      const role = normalizeRole(body.role);
      if (actorRole !== 'owner') {
        return json({ error: 'Only owner can change roles.' }, 403);
      }

      const target = await getTargetUser(userId);
      assertOwnerProtected(target.user, action);

      const { error } = await service.auth.admin.updateUserById(userId, {
        app_metadata: {
          ...(target.user.app_metadata ?? {}),
          role,
        },
      });
      if (error) throw error;

      return json({ ok: true });
    }

    if (action === 'resetPassword') {
      const userId = requireUserId(body.userId);
      const target = await getTargetUser(userId);
      assertOwnerProtected(target.user, action);
      if (!target.user.email) throw new Error('User has no email.');

      const { data, error } = await service.auth.admin.generateLink({
        type: 'recovery',
        email: target.user.email,
      });
      if (error) throw error;

      const resetLink = data.properties?.action_link ?? '';
      if (!resetLink) throw new Error('Supabase did not return a password reset link.');

      return json({ resetLink });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (error) {
    if (error instanceof ProtectedOwnerError) {
      return json({ error: error.message }, 403);
    }

    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

type AuthUser = {
  email?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
};

type Role = 'owner' | 'admin' | 'user';

function canUseAdminPanel(user: AuthUser) {
  return getRole(user) === 'owner' || getRole(user) === 'admin';
}

function getRole(user: AuthUser): Role {
  const email = user.email?.toLowerCase() ?? '';
  const role = user.app_metadata?.role ?? user.user_metadata?.role;

  if (role === 'owner' || ownerEmails.includes(email)) return 'owner';
  if (role === 'admin' || adminEmails.includes(email)) return 'admin';

  return 'user';
}

function normalizeRole(role: unknown): Role {
  return role === 'admin' ? 'admin' : 'user';
}

async function getTargetUser(userId: string) {
  const { data, error } = await service.auth.admin.getUserById(userId);
  if (error) throw error;
  if (!data.user) throw new Error('User not found.');

  return data;
}

function assertOwnerProtected(user: AuthUser, action: string) {
  if (getRole(user) === 'owner') {
    throw new ProtectedOwnerError(`Owner is protected from ${action}.`);
  }
}

class ProtectedOwnerError extends Error {}

function requireUserId(userId: unknown) {
  if (typeof userId !== 'string' || !userId) {
    throw new Error('Missing userId.');
  }

  return userId;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
