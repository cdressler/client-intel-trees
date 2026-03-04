import { useState } from 'react';
import Dashboard from './Dashboard';
import BriefManagementConsole from './BriefManagementConsole';
import SettingsPage from './SettingsPage';

export type Section = 'trees' | 'briefs' | 'settings';

export const NAV_ITEMS: { key: Section; label: string }[] = [
  { key: 'trees', label: 'Trees' },
  { key: 'briefs', label: 'Research Briefs' },
  { key: 'settings', label: 'Settings' },
];

export const DEFAULT_SECTION: Section = 'trees';

export const SECTION_LABELS: Record<Section, string> = {
  trees: 'Trees',
  briefs: 'Research Briefs',
  settings: 'Settings',
};

export default function NavigationMenu() {
  const [activeSection, setActiveSection] = useState<Section>(DEFAULT_SECTION);

  return (
    <div className="min-h-screen bg-base-200">
      {/* Top navbar */}
      <div className="navbar bg-primary text-primary-content shadow-md px-6">
        <span className="text-xl font-bold tracking-tight mr-8">🌳 Client Intelligence</span>
        <nav aria-label="Main navigation">
          <ul className="flex gap-1 list-none m-0 p-0">
            {NAV_ITEMS.map((item) => (
              <li key={item.key}>
                <button
                  onClick={() => setActiveSection(item.key)}
                  aria-current={activeSection === item.key ? 'page' : undefined}
                  className={`btn btn-sm ${
                    activeSection === item.key
                      ? 'btn-secondary'
                      : 'btn-ghost text-primary-content'
                  }`}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* Section content */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        {activeSection === 'trees' && <Dashboard />}
        {activeSection === 'briefs' && <BriefManagementConsole />}
        {activeSection === 'settings' && <SettingsPage />}
      </div>
    </div>
  );
}
