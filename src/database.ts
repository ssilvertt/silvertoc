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

export type MonitorItem = {
  id: number;
  label: string;
  currentAmount: number;
  enabled: boolean;
  lastReportedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type MonitorItemRow = {
  id: number;
  label: string;
  current_amount: string;
  enabled: boolean;
  last_reported_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

const defaultMonitorLabels = ["Iron Ingot", "Gold Ingot", "Diamond", "Cobblestone", "Glass"];

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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS me_monitor_items (
      id SERIAL PRIMARY KEY,
      label TEXT UNIQUE NOT NULL,
      current_amount BIGINT NOT NULL DEFAULT 0,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      last_reported_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const monitorCountResult = await pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM me_monitor_items");
  if (Number(monitorCountResult.rows[0]?.count ?? 0) === 0) {
    for (const label of defaultMonitorLabels) {
      await pool.query(
        `
          INSERT INTO me_monitor_items (label)
          VALUES ($1)
          ON CONFLICT (label) DO NOTHING
        `,
        [label],
      );
    }
  }
}

function mapMonitorItem(row: MonitorItemRow): MonitorItem {
  return {
    id: row.id,
    label: row.label,
    currentAmount: Number(row.current_amount),
    enabled: row.enabled,
    lastReportedAt: row.last_reported_at ? row.last_reported_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
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

export async function listMonitorItems(pool: Pool): Promise<MonitorItem[]> {
  const result = await pool.query<MonitorItemRow>("SELECT * FROM me_monitor_items ORDER BY label ASC");
  return result.rows.map(mapMonitorItem);
}

export async function listEnabledMonitorItems(pool: Pool): Promise<MonitorItem[]> {
  const result = await pool.query<MonitorItemRow>("SELECT * FROM me_monitor_items WHERE enabled = TRUE ORDER BY label ASC");
  return result.rows.map(mapMonitorItem);
}

export async function createMonitorItem(pool: Pool, label: string): Promise<MonitorItem> {
  const result = await pool.query<MonitorItemRow>(
    `
      INSERT INTO me_monitor_items (label)
      VALUES ($1)
      ON CONFLICT (label)
      DO UPDATE SET enabled = TRUE, updated_at = NOW()
      RETURNING *
    `,
    [label],
  );

  return mapMonitorItem(result.rows[0]);
}

export async function updateMonitorItem(
  pool: Pool,
  id: number,
  patch: { label?: string; enabled?: boolean },
): Promise<MonitorItem | null> {
  const current = await pool.query<MonitorItemRow>("SELECT * FROM me_monitor_items WHERE id = $1 LIMIT 1", [id]);
  if (current.rows.length === 0) {
    return null;
  }

  const nextLabel = patch.label?.trim() || current.rows[0].label;
  const nextEnabled = typeof patch.enabled === "boolean" ? patch.enabled : current.rows[0].enabled;

  const result = await pool.query<MonitorItemRow>(
    `
      UPDATE me_monitor_items
      SET label = $1,
          enabled = $2,
          updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `,
    [nextLabel, nextEnabled, id],
  );

  return mapMonitorItem(result.rows[0]);
}

export async function deleteMonitorItem(pool: Pool, id: number): Promise<boolean> {
  const result = await pool.query("DELETE FROM me_monitor_items WHERE id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
}

export async function updateMonitorAmounts(
  pool: Pool,
  entries: Array<{ label: string; amount: number }>,
): Promise<void> {
  for (const entry of entries) {
    await pool.query(
      `
        UPDATE me_monitor_items
        SET current_amount = $1,
            last_reported_at = NOW(),
            updated_at = NOW()
        WHERE label = $2 AND enabled = TRUE
      `,
      [entry.amount, entry.label],
    );
  }
}

export async function getMonitorSummary(pool: Pool): Promise<{ total: number; enabled: number }> {
  const totalResult = await pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM me_monitor_items");
  const enabledResult = await pool.query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM me_monitor_items WHERE enabled = TRUE",
  );

  return {
    total: Number(totalResult.rows[0]?.count ?? 0),
    enabled: Number(enabledResult.rows[0]?.count ?? 0),
  };
}
