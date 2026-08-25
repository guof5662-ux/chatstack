import { describe, expect, it } from 'vitest';

describe('sidebar split wiring', () => {
  it('SidebarUI split methods are attached after extension scripts load', async () => {
    await import('../../content/sidebar.js');
    await import('../../content/sidebar-ui-icons.js');
    await import('../../content/sidebar-ui-content.js');

    expect(window.SidebarUI).toBeTruthy();
    expect(window.sidebarUI).toBeTruthy();
    expect(typeof window.SidebarUI.prototype.getIcon).toBe('function');
    expect(typeof window.SidebarUI.prototype.renderTOC).toBe('function');
    expect(typeof window.SidebarUI.prototype.getSystemLanguageCode).toBe('function');
    expect(typeof window.SidebarUI.prototype.applyProjectSectionCollapsed).toBe('function');
    expect(typeof window.sidebarUI.showToast).toBe('function');
  });

  it('SidebarProjects detail methods are attached after split script loads', async () => {
    await import('../../content/sidebar-projects.js');
    await import('../../content/sidebar-projects-detail.js');

    expect(window.SidebarProjects).toBeTruthy();
    expect(typeof window.SidebarProjects.prototype.restoreProjectsViewState).toBe('function');
    expect(typeof window.SidebarProjects.prototype.renderProjectConversationMessages).toBe('function');
    expect(typeof window.SidebarProjects.prototype.handleProjectDetailSearch).toBe('function');
  });
});
