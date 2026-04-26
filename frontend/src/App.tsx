import { useMemo, useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"

const TEST_PASSWORD = "admin123"
const STORAGE_KEY = "silvertoc_admin_auth"

function App() {
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isAuth, setIsAuth] = useState<boolean>(() => {
    return localStorage.getItem(STORAGE_KEY) === "1"
  })

  const stats = useMemo(
    () => [
      { label: "Статус", value: "Онлайн" },
      { label: "Bridge", value: "/bridge/health" },
      { label: "Режим", value: "Dark" },
    ],
    [],
  )

  const handleLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (password !== TEST_PASSWORD) {
      setError("Неверный пароль")
      return
    }

    localStorage.setItem(STORAGE_KEY, "1")
    setError("")
    setPassword("")
    setIsAuth(true)
  }

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEY)
    setIsAuth(false)
    setPassword("")
  }

  if (!isAuth) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-4">
        <section className="w-full rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm">
          <h1 className="mb-1 text-2xl font-semibold">Вход в админку</h1>
          <p className="mb-4 text-sm text-muted-foreground">Тестовый пароль: admin123</p>

          <form className="space-y-3" onSubmit={handleLogin}>
            <label className="block text-sm">
              Пароль
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Введите пароль"
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-0 focus:border-ring"
              />
            </label>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <Button type="submit" className="w-full">
              Войти
            </Button>
          </form>
        </section>
      </main>
    )
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Простая админка</h1>
          <p className="text-sm text-muted-foreground">silvert.software</p>
        </div>

        <Button variant="outline" onClick={handleLogout}>
          Выйти
        </Button>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        {stats.map((item) => (
          <article key={item.label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className="mt-1 text-base font-medium">{item.value}</p>
          </article>
        ))}
      </section>

      <section className="mt-6 rounded-xl border border-border bg-card p-4">
        <h2 className="text-lg font-medium">Действия</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Это базовая админка-заглушка. Сюда можно добавить реальные кнопки управления ботом.
        </p>
      </section>
    </main>
  )
}

export default App
