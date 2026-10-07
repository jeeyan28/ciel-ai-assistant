import type { Project } from '../../contract'
export function seedProjects(): Project[] {
  return [
    {
      id: 'p01',
      name: 'ciel-backend',
      language: 'Python',
      path: '/data/projects/ciel-backend',
      private: false,
      last_scan: '2 dependencies need attention',
      created_at: '2026-09-20T00:00:00Z',
    },
    {
      id: 'p02',
      name: 'ciel-web',
      language: 'TypeScript',
      path: '/data/projects/ciel-web',
      private: false,
      last_scan: 'No critical findings',
      created_at: '2026-09-21T00:00:00Z',
    },
    {
      id: 'p03',
      name: 'homelab-infra',
      language: 'YAML',
      path: '/data/projects/homelab-infra',
      private: true,
      last_scan: 'Local scan · no secrets found',
      created_at: '2026-09-22T00:00:00Z',
    },
  ]
}
