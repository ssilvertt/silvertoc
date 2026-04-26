import type { AdminSummary, ApiUser, TelegramAuthPayload } from "@/types/api"

const API_BASE = "/bridge/api"

async function readJsonOrThrow(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? ""

  if (!contentType.includes("application/json")) {
    const text = await response.text()
    throw new Error(`API ${response.status}: ожидался JSON, получено: ${text.slice(0, 160)}`)
  }

  return response.json()
}

export async function fetchPublicConfig(): Promise<{ botUsername: string }> {
  const response = await fetch(`${API_BASE}/public/config`, { credentials: "include" })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Не удалось получить публичную конфигурацию: ${response.status} ${text.slice(0, 120)}`)
  }

  const data = (await readJsonOrThrow(response)) as { ok: boolean; botUsername: string }
  return { botUsername: data.botUsername }
}

export async function fetchSessionUser(): Promise<ApiUser | null> {
  const response = await fetch(`${API_BASE}/auth/me`, { credentials: "include" })

  if (!response.ok) {
    return null
  }

  const data = (await readJsonOrThrow(response)) as { ok: boolean; user: ApiUser }
  return data.ok ? data.user : null
}

export async function loginWithTelegram(payload: TelegramAuthPayload): Promise<ApiUser> {
  const response = await fetch(`${API_BASE}/auth/telegram`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const failed = (await response.json().catch(() => ({ error: "Ошибка авторизации" }))) as {
      error?: string
    }

    throw new Error(failed.error ?? "Ошибка авторизации")
  }

  const data = (await readJsonOrThrow(response)) as { ok: boolean; user: ApiUser }
  if (!data.ok) {
    throw new Error("Ошибка авторизации")
  }

  return data.user
}

export async function logoutSession(): Promise<void> {
  await fetch(`${API_BASE}/auth/logout`, {
    method: "POST",
    credentials: "include",
  })
}

export async function fetchAdminUsers(): Promise<ApiUser[]> {
  const response = await fetch(`${API_BASE}/admin/users`, { credentials: "include" })
  if (!response.ok) {
    return []
  }

  const data = (await readJsonOrThrow(response)) as { ok: boolean; users: ApiUser[] }
  return data.ok ? data.users : []
}

export async function fetchAdminSummary(): Promise<AdminSummary | null> {
  const response = await fetch(`${API_BASE}/admin/summary`, { credentials: "include" })
  if (!response.ok) {
    return null
  }

  const data = (await readJsonOrThrow(response)) as { ok: boolean; summary: AdminSummary }
  return data.ok ? data.summary : null
}
