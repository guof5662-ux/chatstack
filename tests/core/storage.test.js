/**
 * core/storage.js 单元测试（需 setup 中 mock chrome.storage.local）
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { resetChromeStore } from '../setup.js';

import '../../core/storage.js';

describe('StorageManager', () => {
  beforeEach(() => {
    resetChromeStore();
  });

  it('get 无 key 时返回空或默认', async () => {
    const result = await window.storageManager.get('missing');
    expect(result).toHaveProperty('missing');
    expect(result.missing == null).toBe(true);
  });

  it('set 后 get 可读到', async () => {
    await window.storageManager.set({ foo: 'bar' });
    const result = await window.storageManager.get('foo');
    expect(result.foo).toBe('bar');
  });

  it('remove 后 get 读不到', async () => {
    await window.storageManager.set({ a: 1 });
    await window.storageManager.remove('a');
    const result = await window.storageManager.get('a');
    expect(result.a == null).toBe(true);
  });

  it('getConversation 无数据时返回默认结构', async () => {
    const conv = await window.storageManager.getConversation('id1');
    expect(conv).toHaveProperty('id', 'id1');
    expect(conv).toHaveProperty('messages', []);
    expect(conv).toHaveProperty('platform', null);
  });

  it('saveConversation / getConversation  roundtrip', async () => {
    const data = { id: 'c1', platform: 'ChatGPT', messages: [{ id: 'm1', role: 'user', content: 'hi' }], title: 'Test' };
    await window.storageManager.saveConversation('c1', data);
    const conv = await window.storageManager.getConversation('c1');
    expect(conv.id).toBe('c1');
    expect(conv.platform).toBe('ChatGPT');
    expect(conv.messages).toHaveLength(1);
    expect(conv.title).toBe('Test');
  });

  it('getConversationList 无数据时返回空数组', async () => {
    const list = await window.storageManager.getConversationList();
    expect(list).toEqual([]);
  });

  it('saveConversationList / getConversationList roundtrip', async () => {
    const list = [{ id: 'c1', title: 'A', snippet: 's', messageCount: 1, lastSeenAt: Date.now() }];
    await window.storageManager.saveConversationList(list);
    const out = await window.storageManager.getConversationList();
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe('A');
  });

  it('getConfig 无数据时返回空对象或默认', async () => {
    const config = await window.storageManager.getConfig();
    expect(config).toBeDefined();
    expect(typeof config).toBe('object');
  });

  it('saveConfig / getConfig roundtrip', async () => {
    const config = { language: 'zh', theme: 'dark' };
    await window.storageManager.saveConfig(config);
    const out = await window.storageManager.getConfig();
    expect(out.language).toBe('zh');
    expect(out.theme).toBe('dark');
  });
});
