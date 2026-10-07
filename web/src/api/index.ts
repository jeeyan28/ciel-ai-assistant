import type { CielApi } from './client'
import { DemoApi } from './demo/DemoApi'
export const api: CielApi = new DemoApi()
