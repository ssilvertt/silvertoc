import { Pool } from "pg";

export type AppUser = {
  id: number;
  telegramId: number;
  firstName: string;
  lastName: string | null;
  username: string | null;
  photoUrl: string | null;
  isAdmin: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string;
};

type UserRow = {
  id: number;
  telegram_id: string;
  first_name: string;
  last_name: string | null;
  username: string | null;
  photo_url: string | null;
  is_admin: boolean;
  created_at: Date;
  updated_at: Date;
  last_login_at: Date;
};

export type TelegramLoginInput = {
  telegramId: number;
  firstName: string;
  lastName: string | null;
  username: string | null;
  photoUrl: string | null;
};

function mapUser(row: UserRow): AppUser {
  return {
    id: row.id,
    telegramId: Number(row.telegram_id),
    firstName: row.first_name,
    lastName: row.last_name,
    username: row.username,
    photoUrl: row.photo_url,
    isAdmin: row.is_admin,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    lastLoginAt: row.last_login_at.toISOString(),
  };
}

export function createDatabasePool(connectionString: string): Pool {
  return new Pool({ connectionString });
}

export async function initDatabase(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_users (
      id SERIAL PRIMARY KEY,
      telegram_id BIGINT UNIQUE NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT,
      username TEXT,
      photo_url TEXT,
      is_admin BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_login_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS app_users_last_login_idx
    ON app_users(last_login_at DESC)
  `);
}

export async function upsertUser(
  pool: Pool,
  input: TelegramLoginInput,
  isAdmin: boolean,
): Promise<AppUser> {
  const result = await pool.query<UserRow>(
    `
      INSERT INTO app_users (
        telegram_id,
        first_name,
        last_name,
        username,
        photo_url,
        is_admin,
        last_login_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      ON CONFLICT (telegram_id)
      DO UPDATE SET
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        username = EXCLUDED.username,
        photo_url = EXCLUDED.photo_url,
        is_admin = EXCLUDED.is_admin,
        last_login_at = NOW(),
        updated_at = NOW()
      RETURNING *
    `,
    [
      input.telegramId,
      input.firstName,
      input.lastName,
      input.username,
      input.photoUrl,
      isAdmin,
    ],
  );

  return mapUser(result.rows[0]);
}

export async function findUserByTelegramId(pool: Pool, telegramId: number): Promise<AppUser | null> {
  const result = await pool.query<UserRow>("SELECT * FROM app_users WHERE telegram_id = $1 LIMIT 1", [telegramId]);

  if (result.rows.length === 0) {
    return null;
  }

  return mapUser(result.rows[0]);
}

export async function listUsers(pool: Pool): Promise<AppUser[]> {
  const result = await pool.query<UserRow>("SELECT * FROM app_users ORDER BY last_login_at DESC");
  return result.rows.map(mapUser);
}

export async function getUserSummary(pool: Pool): Promise<{ total: number; active24h: number }> {
  const totalResult = await pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM app_users");
  const activeResult = await pool.query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM app_users WHERE last_login_at >= NOW() - INTERVAL '24 hours'",
  );

  return {
    total: Number(totalResult.rows[0]?.count ?? 0),
    active24h: Number(activeResult.rows[0]?.count ?? 0),
  };
}
