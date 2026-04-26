import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

type StatsCardsProps = {
  isAdmin: boolean
}

const stats = [
  { label: "Статус", value: "Онлайн" },
  { label: "Bridge", value: "/bridge/health" },
  { label: "Режим", value: "Dark" },
]

export function StatsCards({ isAdmin }: StatsCardsProps) {
  return (
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
            <Badge variant={isAdmin ? "default" : "secondary"}>{isAdmin ? "Admin" : "User"}</Badge>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
