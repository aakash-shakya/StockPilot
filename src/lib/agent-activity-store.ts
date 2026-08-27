import { Store } from '@tanstack/react-store'

export type ActivityStatus = 'running' | 'done' | 'error'

export interface ActivityEntry {
  id: string
  toolName: string
  title: string
  status: ActivityStatus
  consequential: boolean
  detail?: string
  createdAt: number
}

export const agentActivityStore = new Store<ActivityEntry[]>([])

let counter = 0
function nextId() {
  counter += 1
  return `${Date.now()}-${counter}`
}

export function beginActivity(toolName: string, title: string, consequential: boolean) {
  const id = nextId()
  agentActivityStore.setState((entries) =>
    [{ id, toolName, title, status: 'running' as ActivityStatus, consequential, createdAt: Date.now() }, ...entries].slice(0, 50),
  )
  return id
}

export function completeActivity(id: string, detail: string) {
  agentActivityStore.setState((entries) =>
    entries.map((e) => (e.id === id ? { ...e, status: 'done', detail } : e)),
  )
}

export function failActivity(id: string, detail: string) {
  agentActivityStore.setState((entries) =>
    entries.map((e) => (e.id === id ? { ...e, status: 'error', detail } : e)),
  )
}
