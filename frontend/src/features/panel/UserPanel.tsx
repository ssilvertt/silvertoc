import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type UserPanelProps = {
  previewFromAdmin?: boolean
}

export function UserPanel({ previewFromAdmin = false }: UserPanelProps) {
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Панель пользователя</CardTitle>
        <CardDescription>
          {previewFromAdmin
            ? "Режим предпросмотра обычного пользователя для администратора."
            : "Доступ выдан, но админ-раздел доступен только для разрешенных Telegram ID."}
        </CardDescription>
      </CardHeader>
    </Card>
  )
}
