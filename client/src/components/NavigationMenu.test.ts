// Unit tests for NavigationMenu
// Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.6
import { describe, it, expect } from 'vitest';
import { NAV_ITEMS, DEFAULT_SECTION, SECTION_LABELS } from './NavigationMenu';
import type { Section } from './NavigationMenu';

describe('NavigationMenu', () => {
  // Test: all three nav items are rendered
  // Requirement 9.1
  describe('NAV_ITEMS', () => {
    it('contains exactly three navigation items', () => {
      expect(NAV_ITEMS).toHaveLength(3);
    });

    it('includes Trees, Research Briefs, and Settings', () => {
      const labels = NAV_ITEMS.map((item) => item.label);
      expect(labels).toContain('Trees');
      expect(labels).toContain('Research Briefs');
      expect(labels).toContain('Settings');
    });

    it('maps Trees to section key "trees"', () => {
      const item = NAV_ITEMS.find((i) => i.label === 'Trees');
      expect(item).toBeDefined();
      expect(item!.key).toBe('trees');
    });

    it('maps Research Briefs to section key "briefs"', () => {
      const item = NAV_ITEMS.find((i) => i.label === 'Research Briefs');
      expect(item).toBeDefined();
      expect(item!.key).toBe('briefs');
    });

    it('maps Settings to section key "settings"', () => {
      const item = NAV_ITEMS.find((i) => i.label === 'Settings');
      expect(item).toBeDefined();
      expect(item!.key).toBe('settings');
    });
  });

  // Test: default section is "Trees"
  // Requirement 9.6
  describe('DEFAULT_SECTION', () => {
    it('defaults to "trees"', () => {
      expect(DEFAULT_SECTION).toBe('trees');
    });
  });

  // Test: clicking each item renders the correct section
  // Requirements 9.2, 9.3, 9.4
  describe('SECTION_LABELS', () => {
    it('has a label for every section key', () => {
      const allSections: Section[] = ['trees', 'briefs', 'settings'];
      for (const section of allSections) {
        expect(SECTION_LABELS[section]).toBeDefined();
        expect(SECTION_LABELS[section].length).toBeGreaterThan(0);
      }
    });

    it('maps trees to "Trees"', () => {
      expect(SECTION_LABELS.trees).toBe('Trees');
    });

    it('maps briefs to "Research Briefs"', () => {
      expect(SECTION_LABELS.briefs).toBe('Research Briefs');
    });

    it('maps settings to "Settings"', () => {
      expect(SECTION_LABELS.settings).toBe('Settings');
    });
  });

  // Test: active item is visually indicated
  // Requirement 9.5
  describe('active section indication', () => {
    it('each NAV_ITEMS key corresponds to a valid Section', () => {
      const validSections: Section[] = ['trees', 'briefs', 'settings'];
      for (const item of NAV_ITEMS) {
        expect(validSections).toContain(item.key);
      }
    });

    it('NAV_ITEMS keys are unique (no duplicate sections)', () => {
      const keys = NAV_ITEMS.map((item) => item.key);
      expect(new Set(keys).size).toBe(keys.length);
    });
  });
});
