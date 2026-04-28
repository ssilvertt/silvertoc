export type MonitorItem = {
  id: number
  label: string
  currentAmount: number
  enabled: boolean
  lastReportedAt: string | null
  createdAt: string
  updatedAt: string
}
