export type ProjectType = 'wedding' | 'party';

export type ProjectSummary = {
  id: string;
  type: ProjectType;
  name: string;
  date: string;
  venue: string;
};

export type ProjectSection = 'overview' | 'invitation' | 'guests' | 'send' | 'scanner' | 'settings';
export type AdminSection = 'customers' | 'events' | 'templates' | 'usage' | 'support' | 'subscriptions';

export const partyProject: ProjectSummary = {
  id: 'party-demo',
  type: 'party',
  name: 'Maya & Liam Celebration',
  date: '14 October 2026',
  venue: 'The Grand Palace Hall, Jeddah',
};

export const projectSections: Record<ProjectType, readonly ProjectSection[]> = {
  wedding: ['overview', 'invitation', 'guests', 'send', 'scanner', 'settings'],
  party: ['overview', 'invitation', 'guests', 'send', 'scanner', 'settings'],
};

export const adminSections: readonly AdminSection[] = ['customers', 'events', 'templates', 'usage', 'support', 'subscriptions'];

export function buildProjectRoute(type: ProjectType, id: string, section: ProjectSection): string {
  return `/${type === 'wedding' ? 'weddings' : 'parties'}/${encodeURIComponent(id)}/${section}`;
}

export function resolveProjectSection(type: ProjectType, value: string | undefined): ProjectSection {
  return projectSections[type].includes(value as ProjectSection) ? value as ProjectSection : 'overview';
}

export function legacyProjectRoute(path: '/studio/wedding' | '/studio/party' | '/scanner', weddingId: string): string {
  if (path === '/studio/party') return buildProjectRoute('party', partyProject.id, 'invitation');
  return buildProjectRoute('wedding', weddingId, path === '/scanner' ? 'scanner' : 'invitation');
}

export const buildAdminRoute = (section: AdminSection): string => `/admin/${section}`;

export function resolveAdminSection(value: string | undefined): AdminSection {
  return adminSections.includes(value as AdminSection) ? value as AdminSection : 'customers';
}
