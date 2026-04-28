import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { LoginCard } from "@/features/auth/LoginCard"
import { AdminPanel } from "@/features/panel/AdminPanel"
import { StatsCards } from "@/features/panel/StatsCards"
import { UserPanel } from "@/features/panel/UserPanel"
import {
  createMonitorItem,
  fetchAdminSummary,
  fetchAdminUsers,
  fetchMonitorItems,
  fetchPublicConfig,
  fetchSessionUser,
  loginWithTelegram,
  deleteMonitorItem,
  logoutSession,
  updateMonitorItem,
} from "@/lib/api"
import type { AdminSummary, ApiUser, TelegramAuthPayload } from "@/types/api"
import type { MonitorItem } from "@/types/monitor"

function App() {
  const widgetContainerRef = useRef<HTMLDivElement | null>(null)
  const [isBootLoading, setIsBootLoading] = useState(true)
  const [isLoginLoading, setIsLoginLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [widgetError, setWidgetError] = useState<string | null>(null)
  const [botUsername, setBotUsername] = useState<string>("")
  const [user, setUser] = useState<ApiUser | null>(null)
  const [adminUsers, setAdminUsers] = useState<ApiUser[]>([])
  const [adminSummary, setAdminSummary] = useState<AdminSummary | null>(null)
  const [monitorItems, setMonitorItems] = useState<MonitorItem[]>([])
  const [previewUserMode, setPreviewUserMode] = useState(false)

  const effectiveIsAdmin = Boolean(user?.isAdmin && !previewUserMode)

  const loadAdminData = async () => {
    const [users, summary, items] = await Promise.all([fetchAdminUsers(), fetchAdminSummary(), fetchMonitorItems()])
    setAdminUsers(users)
    setAdminSummary(summary)
    setMonitorItems(items)
  }

  useEffect(() => {
    const boot = async () => {
      try {
        const [configData, sessionUser] = await Promise.all([fetchPublicConfig(), fetchSessionUser()])
        setBotUsername(configData.botUsername)
        setUser(sessionUser)
        if (sessionUser?.isAdmin) {
          await loadAdminData()
        }
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
    if (!user?.isAdmin || previewUserMode) {
      return
    }

    const intervalId = window.setInterval(() => {
      void fetchMonitorItems().then(setMonitorItems).catch(() => undefined)
    }, 10000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [user?.isAdmin, previewUserMode])

  useEffect(() => {
    if (isBootLoading || !botUsername || user || !widgetContainerRef.current) {
      return
    }

    const safeBotUsername = botUsername.replace(/^@/, "")
    setWidgetError(null)
    widgetContainerRef.current.innerHTML = ""

    window.onTelegramAuth = (payload: TelegramAuthPayload) => {
      setIsLoginLoading(true)
      setError(null)

      void loginWithTelegram(payload)
        .then((loggedInUser) => {
          setUser(loggedInUser)
          setPreviewUserMode(false)
        })
        .catch((authError: unknown) => {
          setError(String(authError))
        })
        .finally(() => {
          setIsLoginLoading(false)
        })
    }

    const script = document.createElement("script")
    script.src = "https://telegram.org/js/telegram-widget.js?23"
    script.async = true
    script.setAttribute("data-telegram-login", safeBotUsername)
    script.setAttribute("data-size", "large")
    script.setAttribute("data-request-access", "write")
    script.setAttribute("data-onauth", "onTelegramAuth(user)")
    script.onerror = () => {
      setWidgetError("Не удалось загрузить Telegram widget script")
    }

    widgetContainerRef.current.appendChild(script)

    const checkTimer = window.setTimeout(() => {
      const hasWidget = Boolean(widgetContainerRef.current?.querySelector("iframe"))
      if (!hasWidget) {
        setWidgetError(
          "Telegram кнопка не отрисована. Проверьте BotFather /setdomain = silvert.software и отключите блокировщики скриптов.",
        )
      }
    }, 5000)

    return () => {
      window.clearTimeout(checkTimer)
      window.onTelegramAuth = undefined
    }
  }, [isBootLoading, botUsername, user])

  const handleLogout = async () => {
    await logoutSession()

    setUser(null)
    setAdminUsers([])
    setAdminSummary(null)
    setMonitorItems([])
    setPreviewUserMode(false)
  }

  const refreshMonitorItems = async () => {
    const items = await fetchMonitorItems()
    setMonitorItems(items)
  }

  const handleCreateMonitorItem = async (label: string) => {
    const created = await createMonitorItem(label)
    if (created) {
      setMonitorItems((current) => [...current, created].sort((left, right) => left.label.localeCompare(right.label)))
    }
  }

  const handleUpdateMonitorItem = async (id: number, patch: { label?: string; enabled?: boolean }) => {
    const updated = await updateMonitorItem(id, patch)
    if (updated) {
      setMonitorItems((current) =>
        current
          .map((item) => (item.id === id ? updated : item))
          .sort((left, right) => left.label.localeCompare(right.label)),
      )
    }
  }

  const handleDeleteMonitorItem = async (id: number) => {
    const deleted = await deleteMonitorItem(id)
    if (deleted) {
      setMonitorItems((current) => current.filter((item) => item.id !== id))
    }
  }

  if (isBootLoading) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center px-4">
        <p className="text-sm text-muted-foreground">Загрузка...</p>
      </main>
    )
  }

  if (!user) {
    return <LoginCard widgetContainerRef={widgetContainerRef} isLoginLoading={isLoginLoading} widgetError={widgetError} error={error} />
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

        <div className="flex items-center gap-2">
          {user.isAdmin ? (
            <Button variant="outline" onClick={() => setPreviewUserMode((value) => !value)}>
              {previewUserMode ? "Показать админку" : "Предпросмотр user-панели"}
            </Button>
          ) : null}

          <Button variant="outline" onClick={handleLogout}>
            Выйти
          </Button>
        </div>
      </header>

      <StatsCards isAdmin={effectiveIsAdmin} />

      {effectiveIsAdmin ? (
        <AdminPanel
          adminSummary={adminSummary}
          adminUsers={adminUsers}
          monitorItems={monitorItems}
          onRefreshMonitorItems={refreshMonitorItems}
          onCreateMonitorItem={handleCreateMonitorItem}
          onUpdateMonitorItem={handleUpdateMonitorItem}
          onDeleteMonitorItem={handleDeleteMonitorItem}
        />
      ) : (
        <UserPanel previewFromAdmin={Boolean(user.isAdmin && previewUserMode)} />
      )}
    </main>
  )
}

export default App
