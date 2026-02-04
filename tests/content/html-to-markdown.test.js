/**
 * content/html-to-markdown.js 单元测试（需 happy-dom 提供 document）
 */
import { describe, expect, it } from 'vitest';

import '../../content/html-to-markdown.js';

const { toMarkdown, toText } = globalThis.HtmlToMarkdown;

describe('HtmlToMarkdown', () => {
  it('toMarkdown 简单段落', () => {
    expect(toMarkdown('<p>hello</p>')).toContain('hello');
  });

  it('toMarkdown 空字符串返回空', () => {
    expect(toMarkdown('')).toBe('');
    expect(toMarkdown('   ')).toBe('');
  });

  it('toText 简单段落', () => {
    expect(toText('<p>hello world</p>')).toContain('hello world');
  });

  it('toMarkdown 标题', () => {
    const md = toMarkdown('<h2>Title</h2>');
    expect(md).toMatch(/^#+\s*Title/);
  });

  it('toMarkdown 多段落', () => {
    const md = toMarkdown('<p>one</p><p>two</p>');
    expect(md).toContain('one');
    expect(md).toContain('two');
  });

  it('toText 空字符串返回空', () => {
    expect(toText('')).toBe('');
  });
});
