import type { TelegramAuthPayload } from "./api"

export {}

declare global {
  interface Window {
    onTelegramAuth?: (payload: TelegramAuthPayload) => void
  }
}
