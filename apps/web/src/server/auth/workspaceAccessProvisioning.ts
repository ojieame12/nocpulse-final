import type { User } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "./createSupabaseAdminClient";

const SUPABASE_USERS_PAGE_SIZE = 1000;

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

export async function findSupabaseAuthUserByEmail(
  client: SupabaseAdminClient,
  email: string,
) {
  const normalizedEmail = email.trim().toLowerCase();
  let page = 1;

  while (true) {
    const result = await client.auth.admin.listUsers({
      page,
      perPage: SUPABASE_USERS_PAGE_SIZE,
    });

    if (result.error) {
      throw result.error;
    }

    const matchedUser =
      result.data.users.find(
        (user) => user.email?.trim().toLowerCase() === normalizedEmail,
      ) ?? null;

    if (matchedUser) {
      return matchedUser;
    }

    if (result.data.users.length < SUPABASE_USERS_PAGE_SIZE) {
      return null;
    }

    page += 1;
  }
}

export async function ensureSupabaseAuthUser(
  client: SupabaseAdminClient,
  email: string,
) {
  const existingUser = await findSupabaseAuthUserByEmail(client, email);

  if (existingUser) {
    return {
      user: existingUser,
      created: false,
    };
  }

  const createdUser = await client.auth.admin.createUser({
    email,
    email_confirm: false,
  });

  if (!createdUser.error && createdUser.data.user) {
    return {
      user: createdUser.data.user,
      created: true,
    };
  }

  const racedUser = await findSupabaseAuthUserByEmail(client, email);

  if (racedUser) {
    return {
      user: racedUser,
      created: false,
    };
  }

  throw createdUser.error ?? new Error("Supabase user provisioning failed.");
}

export async function loadSupabaseAuthUsersById(
  client: SupabaseAdminClient,
  userIds: readonly string[],
) {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  const entries = await Promise.all(
    uniqueUserIds.map(async (userId) => {
      const result = await client.auth.admin.getUserById(userId);

      if (result.error || !result.data.user) {
        return [userId, null] as const;
      }

      return [userId, result.data.user] as const;
    }),
  );

  return new Map<string, User | null>(entries);
}
