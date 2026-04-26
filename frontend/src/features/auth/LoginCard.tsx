import type { RefObject } from "react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type LoginCardProps = {
  widgetContainerRef: RefObject<HTMLDivElement | null>
  isLoginLoading: boolean
  widgetError: string | null
  error: string | null
}

export function LoginCard({ widgetContainerRef, isLoginLoading, widgetError, error }: LoginCardProps) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm items-center px-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Вход в админку</CardTitle>
          <CardDescription>Авторизация через Telegram</CardDescription>
        </CardHeader>
        <CardContent className="flex min-h-32 flex-col items-center justify-center gap-3">
          <div ref={widgetContainerRef} className="flex min-h-10 w-full justify-center" />
          {isLoginLoading ? <p className="text-sm text-muted-foreground">Проверяем вход...</p> : null}
          {widgetError ? <p className="text-center text-sm text-destructive">{widgetError}</p> : null}
          {error ? <p className="text-center text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>
    </main>
  )
}
