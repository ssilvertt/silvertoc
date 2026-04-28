import { useMemo, useState } from "react"
import { RefreshCcw, Save, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { MonitorItem } from "@/types/monitor"

type MeMonitorPanelProps = {
  items: MonitorItem[]
  onRefresh: () => Promise<void>
  onCreate: (itemId: string, displayName?: string) => Promise<void>
  onUpdate: (id: number, patch: { itemId?: string; displayName?: string; enabled?: boolean }) => Promise<void>
  onDelete: (id: number) => Promise<void>
}

export function MeMonitorPanel({ items, onRefresh, onCreate, onUpdate, onDelete }: MeMonitorPanelProps) {
  const [newItemId, setNewItemId] = useState("")
  const [newDisplayName, setNewDisplayName] = useState("")
  const [draftById, setDraftById] = useState<Record<number, { itemId: string; displayName: string }>>({})

  const enabledItems = useMemo(() => items.filter((item) => item.enabled).length, [items])

  const handleCreate = async () => {
    const itemId = newItemId.trim()
    if (!itemId) {
      return
    }

    await onCreate(itemId, newDisplayName.trim() || undefined)
    setNewItemId("")
    setNewDisplayName("")
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
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <Input value={newItemId} onChange={(event) => setNewItemId(event.target.value)} placeholder="ID предмета, например ducity:Materia" />
          <Input value={newDisplayName} onChange={(event) => setNewDisplayName(event.target.value)} placeholder="Имя в панели, например Материя" />
          <Button className="justify-self-end" onClick={() => void handleCreate()} aria-label="Добавить предмет">
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
                <TableHead>ID предмета</TableHead>
                <TableHead>Имя в панели</TableHead>
                <TableHead>Количество</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const draft = draftById[item.id] ?? { itemId: item.itemId, displayName: item.displayName }
                return (
                  <TableRow key={item.id}>
                    <TableCell className="min-w-56">
                      <Input
                        value={draft.itemId}
                        onChange={(event) =>
                          setDraftById((current) => ({
                            ...current,
                            [item.id]: {
                              itemId: event.target.value,
                              displayName: current[item.id]?.displayName ?? item.displayName,
                            },
                          }))
                        }
                      />
                    </TableCell>
                    <TableCell className="min-w-56">
                      <Input
                        value={draft.displayName}
                        onChange={(event) =>
                          setDraftById((current) => ({
                            ...current,
                            [item.id]: {
                              itemId: current[item.id]?.itemId ?? item.itemId,
                              displayName: event.target.value,
                            },
                          }))
                        }
                      />
                    </TableCell>
                    <TableCell>{item.currentAmount.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={item.enabled ? "default" : "secondary"}>{item.enabled ? "Активен" : "Выключен"}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant={item.enabled ? "secondary" : "default"}
                          size="sm"
                          onClick={() => void onUpdate(item.id, { enabled: !item.enabled })}
                        >
                          {item.enabled ? "Выключить" : "Включить"}
                        </Button>
                        <Button
                          variant="outline"
                          size="icon-sm"
                          onClick={() =>
                            void onUpdate(item.id, { itemId: draft.itemId.trim(), displayName: draft.displayName.trim() })
                          }
                          aria-label="Сохранить изменения"
                          title="Сохранить"
                        >
                          <Save className="size-4" />
                        </Button>
                        <Button variant="destructive" size="icon-sm" onClick={() => void onDelete(item.id)} aria-label="Удалить предмет">
                          <Trash2 className="size-4" />
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
