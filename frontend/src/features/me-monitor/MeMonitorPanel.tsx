import { useMemo, useState } from "react"
import { Trash2, Save, Plus, RefreshCcw } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { MonitorItem } from "@/types/monitor"

type MeMonitorPanelProps = {
  items: MonitorItem[]
  onRefresh: () => Promise<void>
  onCreate: (label: string) => Promise<void>
  onUpdate: (id: number, patch: { label?: string; enabled?: boolean }) => Promise<void>
  onDelete: (id: number) => Promise<void>
}

export function MeMonitorPanel({ items, onRefresh, onCreate, onUpdate, onDelete }: MeMonitorPanelProps) {
  const [newLabel, setNewLabel] = useState("")
  const [draftById, setDraftById] = useState<Record<number, string>>({})

  const enabledItems = useMemo(() => items.filter((item) => item.enabled).length, [items])

  const handleCreate = async () => {
    const label = newLabel.trim()
    if (!label) {
      return
    }

    await onCreate(label)
    setNewLabel("")
  }

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>ME монитор</CardTitle>
          <CardDescription>Список предметов берется с сайта, а OC-скрипт отправляет текущие количества назад</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void onRefresh()}>
            <RefreshCcw className="mr-2 size-4" />
            Обновить
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Input value={newLabel} onChange={(event) => setNewLabel(event.target.value)} placeholder="Например: Iron Ingot" />
          <Button onClick={() => void handleCreate()}>
            <Plus className="mr-2 size-4" />
            Добавить
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          <span>Всего: {items.length}</span>
          <span>Включено: {enabledItems}</span>
          <span>Лимиты убраны</span>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Предмет</TableHead>
                <TableHead>Количество</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Изменить</TableHead>
                <TableHead>Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const draftLabel = draftById[item.id] ?? item.label
                return (
                  <TableRow key={item.id}>
                    <TableCell className="min-w-56">
                      <Input
                        value={draftLabel}
                        onChange={(event) =>
                          setDraftById((current) => ({
                            ...current,
                            [item.id]: event.target.value,
                          }))
                        }
                      />
                    </TableCell>
                    <TableCell>{item.currentAmount.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={item.enabled ? "default" : "secondary"}>{item.enabled ? "Активен" : "Выключен"}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => void onUpdate(item.id, { label: draftLabel.trim() })}>
                        <Save className="mr-2 size-4" />
                        Сохранить
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant={item.enabled ? "secondary" : "default"}
                          size="sm"
                          onClick={() => void onUpdate(item.id, { enabled: !item.enabled })}
                        >
                          {item.enabled ? "Выключить" : "Включить"}
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => void onDelete(item.id)}>
                          <Trash2 className="mr-2 size-4" />
                          Удалить
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
