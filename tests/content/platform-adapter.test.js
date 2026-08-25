import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import '../../content/platform-adapter.js';

class TestAdapter extends window.BasePlatformAdapter {
  getPlatformName() { return 'Test'; }
  getPlatformIcon() { return ''; }
  getConversationId() { return 'conv-1'; }
  parseMessages() { return []; }
  isConversationPage() { return true; }
}

describe('BasePlatformAdapter lifecycle', () => {
  let originalNavigation;

  beforeEach(() => {
    originalNavigation = window.navigation;
  });

  afterEach(() => {
    Object.defineProperty(window, 'navigation', {
      configurable: true,
      value: originalNavigation
    });
    vi.restoreAllMocks();
  });

  it('watchURLChanges 重复调用会清理旧 interval 和 navigation listener', () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    Object.defineProperty(window, 'navigation', {
      configurable: true,
      value: { addEventListener, removeEventListener }
    });

    const adapter = new TestAdapter();
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval').mockImplementation(() => {});
    setIntervalSpy.mockReturnValueOnce(11).mockReturnValueOnce(22);

    adapter.watchURLChanges();
    adapter.watchURLChanges();

    expect(clearIntervalSpy).toHaveBeenCalledWith(11);
    expect(removeEventListener).toHaveBeenCalledWith('navigate', expect.any(Function));
    expect(addEventListener).toHaveBeenCalledTimes(2);
  });

  it('stopObserving 会释放 observer/timer/url watcher/listener', () => {
    const removeEventListener = vi.fn();
    Object.defineProperty(window, 'navigation', {
      configurable: true,
      value: { addEventListener: vi.fn(), removeEventListener }
    });

    const adapter = new TestAdapter();
    const disconnect = vi.fn();
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout').mockImplementation(() => {});
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval').mockImplementation(() => {});

    adapter.observer = { disconnect };
    adapter.debounceTimer = setTimeout(() => {}, 1);
    adapter.urlWatchInterval = 77;
    adapter.navigationListener = () => {};

    adapter.stopObserving();

    expect(disconnect).toHaveBeenCalled();
    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(clearIntervalSpy).toHaveBeenCalledWith(77);
    expect(removeEventListener).toHaveBeenCalledWith('navigate', expect.any(Function));
    expect(adapter.observer).toBeNull();
    expect(adapter.debounceTimer).toBeNull();
    expect(adapter.urlWatchInterval).toBeNull();
    expect(adapter.navigationListener).toBeNull();
  });
});
