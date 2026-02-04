/**
 * core/toc-manager.js 单元测试（TOCManager 纯逻辑：generateTitle、buildTOC）
 */
import { beforeEach, describe, expect, it } from 'vitest';

import '../../core/toc-manager.js';

describe('TOCManager', () => {
  let tocManager;

  beforeEach(() => {
    tocManager = window.tocManager;
  });

  it('generateTitle 取前 36 字', () => {
    const short = 'hello';
    expect(tocManager.generateTitle(short)).toBe('hello');
    const long = 'a'.repeat(40);
    expect(tocManager.generateTitle(long)).toBe('a'.repeat(36) + '...');
  });

  it('generateTitle 合并空白', () => {
    expect(tocManager.generateTitle('  a  b  c  ')).toBe('a b c');
  });

  it('buildTOC 根据 messages 生成条目', () => {
    const messages = [
      { id: 'm1', role: 'user', content: 'First question', element: null },
      { id: 'm2', role: 'assistant', content: 'Answer', element: null },
    ];
    const items = tocManager.buildTOC(messages);
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe('First question');
    expect(items[0].role).toBe('user');
    expect(items[0].messageId).toBe('m1');
    expect(items[1].role).toBe('assistant');
    // messageIdToElement 仅在有 element 时写入，无 element 时为空
    expect(tocManager.messageIdToElement).toBeDefined();
    expect(typeof tocManager.messageIdToElement).toBe('object');
  });
});
