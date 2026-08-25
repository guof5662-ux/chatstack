import { beforeEach, describe, expect, it, vi } from 'vitest';

import '../../core/project-manager.js';

function clone(data) {
  return JSON.parse(JSON.stringify(data));
}

describe('ProjectManager mapToAutoProject', () => {
  let storedProjects;

  beforeEach(() => {
    storedProjects = {
      auto: {},
      my: {}
    };

    window.storageManager = {
      getAllProjects: vi.fn().mockImplementation(async () => clone(storedProjects)),
      saveProjects: vi.fn().mockImplementation(async (projects) => {
        storedProjects = clone(projects);
      })
    };

    window.projectManager.projects = { auto: {}, my: {} };
    window.projectManager._mapQueue = Promise.resolve();
  });

  it('会基于最新存储合并映射，避免覆盖已有自动项目', async () => {
    storedProjects = {
      auto: {
        'Gemini:Inbox': {
          name: 'Inbox (Auto)',
          platform: 'Gemini',
          conversations: ['c2']
        }
      },
      my: {}
    };

    await window.projectManager.mapToAutoProject('c1', 'ChatGPT', null, null);

    expect(storedProjects.auto['Gemini:Inbox'].conversations).toEqual(['c2']);
    expect(storedProjects.auto['ChatGPT:Inbox'].conversations).toEqual(['c1']);
  });

  it('并发映射调用会串行执行并保留双方结果', async () => {
    await Promise.all([
      window.projectManager.mapToAutoProject('c1', 'ChatGPT', null, null),
      window.projectManager.mapToAutoProject('c2', 'Gemini', null, null)
    ]);

    expect(storedProjects.auto['ChatGPT:Inbox'].conversations).toEqual(['c1']);
    expect(storedProjects.auto['Gemini:Inbox'].conversations).toEqual(['c2']);
  });
});
