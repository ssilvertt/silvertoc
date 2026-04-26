export type ApiUser = {
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

export type AdminSummary = {
  total: number
  active24h: number
  bridgeEnabledChats: number
  bridgeQueuedMessages: number
}

export type TelegramAuthPayload = {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
}
