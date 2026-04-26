import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { AdminSummary, ApiUser } from "@/types/api"

type AdminPanelProps = {
  adminSummary: AdminSummary | null
  adminUsers: ApiUser[]
}

export function AdminPanel({ adminSummary, adminUsers }: AdminPanelProps) {
  return (
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
  )
}
