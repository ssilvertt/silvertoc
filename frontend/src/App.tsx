import { useEffect, useMemo, useRef, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type ApiUser = {
  id: number
  telegramId: number
  firstName: string
  lastName: string | null
  username: string | null
  photoUrl: string | null
  isAdmin: boolean
  createdAt: string
  updatedAt: string
  lastLoginAt: string
}

type AdminSummary = {
  total: number
  active24h: number
  bridgeEnabledChats: number
  bridgeQueuedMessages: number
}

type TelegramAuthPayload = {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
}

declare global {
  interface Window {
    onTelegramAuth?: (payload: TelegramAuthPayload) => void
  }
}

const API_BASE = "/bridge/api"

async function readJsonOrThrow(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? ""

  if (!contentType.includes("application/json")) {
    const text = await response.text()
    throw new Error(`API ${response.status}: ожидался JSON, получено: ${text.slice(0, 160)}`)
  }

  return response.json()
}

function App() {
  const widgetContainerRef = useRef<HTMLDivElement | null>(null)
  const [isBootLoading, setIsBootLoading] = useState(true)
  const [isLoginLoading, setIsLoginLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [botUsername, setBotUsername] = useState<string>("")
  const [user, setUser] = useState<ApiUser | null>(null)
  const [adminUsers, setAdminUsers] = useState<ApiUser[]>([])
  const [adminSummary, setAdminSummary] = useState<AdminSummary | null>(null)

  const loadSession = async () => {
    const response = await fetch(`${API_BASE}/auth/me`, {
      credentials: "include",
    })

    if (!response.ok) {
      setUser(null)
      return
    }

    const data = (await readJsonOrThrow(response)) as { ok: boolean; user: ApiUser }
    if (data.ok) {
      setUser(data.user)
    }
  }

  const loadAdminData = async () => {
    const [usersResponse, summaryResponse] = await Promise.all([
      fetch(`${API_BASE}/admin/users`, { credentials: "include" }),
      fetch(`${API_BASE}/admin/summary`, { credentials: "include" }),
    ])

    if (usersResponse.ok) {
      const usersData = (await usersResponse.json()) as { ok: boolean; users: ApiUser[] }
      if (usersData.ok) {
        setAdminUsers(usersData.users)
      }
    }

    if (summaryResponse.ok) {
      const summaryData = (await summaryResponse.json()) as { ok: boolean; summary: AdminSummary }
      if (summaryData.ok) {
        setAdminSummary(summaryData.summary)
      }
    }
  }

  useEffect(() => {
    const boot = async () => {
      try {
        const configResponse = await fetch(`${API_BASE}/public/config`, { credentials: "include" })
        if (!configResponse.ok) {
          const text = await configResponse.text()
          throw new Error(`Не удалось получить публичную конфигурацию: ${configResponse.status} ${text.slice(0, 120)}`)
        }

        const configData = (await readJsonOrThrow(configResponse)) as { ok: boolean; botUsername: string }
        setBotUsername(configData.botUsername)

        await loadSession()
      } catch (bootError) {
        setError(String(bootError))
      } finally {
        setIsBootLoading(false)
      }
    }

    void boot()
  }, [])

  useEffect(() => {
    if (!user?.isAdmin) {
      return
    }

    void loadAdminData()
  }, [user?.isAdmin])

  useEffect(() => {
    if (!botUsername || user || !widgetContainerRef.current) {
      return
    }

    widgetContainerRef.current.innerHTML = ""

    window.onTelegramAuth = (payload: TelegramAuthPayload) => {
      setIsLoginLoading(true)
      setError(null)

      void fetch(`${API_BASE}/auth/telegram`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      })
        .then(async (response) => {
          if (!response.ok) {
            const failed = (await response.json().catch(() => ({ error: "Ошибка авторизации" }))) as {
              error?: string
            }
            throw new Error(failed.error ?? "Ошибка авторизации")
          }
          return readJsonOrThrow(response) as Promise<{ ok: boolean; user: ApiUser }>
        })
        .then((data) => {
          if (data.ok) {
            setUser(data.user)
          }
        })
        .catch((authError: unknown) => {
          setError(String(authError))
        })
        .finally(() => {
          setIsLoginLoading(false)
        })
    }

    const script = document.createElement("script")
    script.src = "https://telegram.org/js/telegram-widget.js?22"
    script.async = true
    script.setAttribute("data-telegram-login", botUsername)
    script.setAttribute("data-size", "large")
    script.setAttribute("data-userpic", "false")
    script.setAttribute("data-radius", "8")
    script.setAttribute("data-request-access", "write")
    script.setAttribute("data-onauth", "onTelegramAuth(user)")

    widgetContainerRef.current.appendChild(script)

    return () => {
      window.onTelegramAuth = undefined
    }
  }, [botUsername, user])

  const handleLogout = async () => {
    await fetch(`${API_BASE}/auth/logout`, {
      method: "POST",
      credentials: "include",
    })

    setUser(null)
    setAdminUsers([])
    setAdminSummary(null)
  }

  const stats = useMemo(
    () => [
      { label: "Статус", value: "Онлайн" },
      { label: "Bridge", value: "/bridge/health" },
      { label: "Режим", value: "Dark" },
    ],
    [],
  )

  if (isBootLoading) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center px-4">
        <p className="text-sm text-muted-foreground">Загрузка...</p>
      </main>
    )
  }

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Вход через Telegram</CardTitle>
            <CardDescription>Авторизуйтесь через официальный Telegram Login Widget</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div ref={widgetContainerRef} className="min-h-10" />
            {isLoginLoading ? <p className="text-sm text-muted-foreground">Проверяем вход...</p> : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Silvertoc Panel</h1>
          <p className="text-sm text-muted-foreground">
            @{user.username ?? user.firstName} · ID {user.telegramId}
          </p>
        </div>

        <Button variant="outline" onClick={handleLogout}>
          Выйти
        </Button>
      </header>

      <section className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {stats.map((item) => (
          <Card key={item.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="mt-1 text-base font-medium">{item.value}</p>
            </CardContent>
          </Card>
        ))}

        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Роль</p>
            <div className="mt-1">
              <Badge variant={user.isAdmin ? "default" : "secondary"}>{user.isAdmin ? "Admin" : "User"}</Badge>
            </div>
          </CardContent>
        </Card>
      </section>

      {user.isAdmin ? (
        <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_2fr]">
          <Card>
            <CardHeader>
              <CardTitle>Сводка</CardTitle>
              <CardDescription>Оперативная информация системы</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>Пользователей: {adminSummary?.total ?? "-"}</p>
              <p>Активных за 24ч: {adminSummary?.active24h ?? "-"}</p>
              <p>Включенных bridge-чатов: {adminSummary?.bridgeEnabledChats ?? "-"}</p>
              <p>Сообщений в очередях: {adminSummary?.bridgeQueuedMessages ?? "-"}</p>
              <p className="text-muted-foreground">Agents: данные не найдены в текущем frontend-проекте.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Список пользователей</CardTitle>
              <CardDescription>Все Telegram-пользователи, входившие в систему</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Имя</TableHead>
                      <TableHead>Username</TableHead>
                      <TableHead>Роль</TableHead>
                      <TableHead>Последний вход</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {adminUsers.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.telegramId}</TableCell>
                        <TableCell>{[row.firstName, row.lastName].filter(Boolean).join(" ")}</TableCell>
                        <TableCell>{row.username ? `@${row.username}` : "—"}</TableCell>
                        <TableCell>
                          <Badge variant={row.isAdmin ? "default" : "outline"}>{row.isAdmin ? "Admin" : "User"}</Badge>
                        </TableCell>
                        <TableCell>{new Date(row.lastLoginAt).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </section>
      ) : (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Панель пользователя</CardTitle>
            <CardDescription>Доступ выдан, но админ-раздел доступен только для разрешенных Telegram ID.</CardDescription>
          </CardHeader>
        </Card>
      )}
    </main>
  )
}

export default App
