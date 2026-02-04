/**
 * Vitest 测试环境：模拟 chrome.storage.local 供 core/storage.js 使用
 */
import { vi } from 'vitest';

const store = {};
globalThis.chrome = {
  storage: {
    local: {
      get: vi.fn().mockImplementation((keys) => {
        if (keys == null) return Promise.resolve({ ...store });
        if (Array.isArray(keys)) return Promise.resolve(keys.reduce((acc, k) => { acc[k] = store[k] ?? null; return acc; }, {}));
        return Promise.resolve({ [keys]: store[keys] ?? null });
      }),
      set: vi.fn().mockImplementation((items) => {
        Object.assign(store, items);
        return Promise.resolve();
      }),
      remove: vi.fn().mockImplementation((keys) => {
        const kk = Array.isArray(keys) ? keys : [keys];
        kk.forEach((k) => delete store[k]);
        return Promise.resolve();
      }),
      clear: vi.fn().mockImplementation(() => {
        Object.keys(store).forEach((k) => delete store[k]);
        return Promise.resolve();
      }),
    },
  },
};

export function resetChromeStore() {
  Object.keys(store).forEach((k) => delete store[k]);
}
