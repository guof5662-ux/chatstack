/**
 * HTML → Markdown / Text 转换模块（纯逻辑，无 DOM 依赖）
 * 供 sidebar TOC 与 export 使用。
 */
(function (global) {
  function normalizeInlineText(text) {
    if (!text) return '';
    return text.replace(/\s+/g, ' ');
  }

  function hasInlineContent(tokens) {
    return tokens.some((t) => (t.type === 'text' && t.value.trim()) || t.type === 'code' || t.type === 'link');
  }

  function parseInlineTokens(root) {
    const collect = (node) => {
      if (!node) return [];
      if (node.nodeType === Node.TEXT_NODE) {
        const text = normalizeInlineText(node.textContent || '');
        return text ? [{ type: 'text', value: text }] : [];
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return [];
      const tag = node.tagName.toLowerCase();
      if (tag === 'br') return [{ type: 'br' }];
      if (tag === 'strong' || tag === 'b') {
        const children = [];
        Array.from(node.childNodes).forEach((child) => children.push(...collect(child)));
        return children.length ? [{ type: 'strong', children }] : [];
      }
      if (tag === 'em' || tag === 'i') {
        const children = [];
        Array.from(node.childNodes).forEach((child) => children.push(...collect(child)));
        return children.length ? [{ type: 'em', children }] : [];
      }
      if (tag === 'code') {
        const text = (node.textContent || '').replace(/\n/g, ' ').trim();
        return text ? [{ type: 'code', value: text }] : [];
      }
      if (tag === 'a') {
        const href = node.getAttribute('href') || '';
        const children = [];
        Array.from(node.childNodes).forEach((child) => children.push(...collect(child)));
        return children.length ? [{ type: 'link', href, children }] : [];
      }
      if (tag === 'mark' || tag === 'span') {
        const tokens = [];
        Array.from(node.childNodes).forEach((child) => tokens.push(...collect(child)));
        return tokens;
      }
      const tokens = [];
      Array.from(node.childNodes).forEach((child) => tokens.push(...collect(child)));
      return tokens;
    };
    const tokens = [];
    Array.from(root.childNodes).forEach((child) => tokens.push(...collect(child)));
    return tokens;
  }

  function nodeToBlocks(node) {
    if (!node) return [];
    if (node.nodeType === Node.TEXT_NODE) {
      const text = normalizeInlineText(node.textContent || '');
      if (!text.trim()) return [];
      return [{ type: 'paragraph', inlines: [{ type: 'text', value: text }] }];
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return [];
    const tag = node.tagName.toLowerCase();
    if (tag === 'p') {
      const inlines = parseInlineTokens(node);
      if (!hasInlineContent(inlines)) return [];
      return [{ type: 'paragraph', inlines }];
    }
    if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4' || tag === 'h5' || tag === 'h6') {
      const inlines = parseInlineTokens(node);
      if (!hasInlineContent(inlines)) return [];
      return [{ type: 'heading', level: parseInt(tag[1], 10), inlines }];
    }
    if (tag === 'ul' || tag === 'ol') {
      return [parseList(node)];
    }
    if (tag === 'pre') {
      const codeEl = node.querySelector('code');
      const text = (codeEl || node).textContent || '';
      const langClass = codeEl && codeEl.className ? codeEl.className : node.className || '';
      const langMatch = langClass.match(/language-([a-z0-9_-]+)/i);
      const lang = langMatch ? langMatch[1] : '';
      return [{ type: 'code', lang, text: text.replace(/\n$/, '') }];
    }
    if (tag === 'blockquote') {
      const inner = collectBlocks(node);
      if (!inner.length) return [];
      return [{ type: 'blockquote', blocks: inner }];
    }
    if (tag === 'table') {
      return [parseTable(node)];
    }
    if (tag === 'hr') {
      return [{ type: 'hr' }];
    }
    if (tag === 'div' || tag === 'section' || tag === 'article') {
      return collectBlocks(node);
    }
    if (tag === 'br') {
      return [{ type: 'paragraph', inlines: [{ type: 'br' }] }];
    }
    const inlines = parseInlineTokens(node);
    if (hasInlineContent(inlines)) {
      return [{ type: 'paragraph', inlines }];
    }
    return [];
  }

  function collectBlocks(root) {
    const blocks = [];
    root.childNodes.forEach((node) => {
      blocks.push(...nodeToBlocks(node));
    });
    return blocks.filter((b) => b && b.type);
  }

  function parseList(listEl) {
    const ordered = listEl.tagName.toLowerCase() === 'ol';
    const items = [];
    Array.from(listEl.children).forEach((li) => {
      if (li.tagName && li.tagName.toLowerCase() === 'li') {
        items.push(parseListItem(li));
      }
    });
    return { type: 'list', ordered, items };
  }

  function parseListItem(li) {
    const clone = li.cloneNode(true);
    clone.querySelectorAll('ul, ol').forEach((n) => n.remove());
    const inlines = parseInlineTokens(clone);
    const children = [];
    li.querySelectorAll(':scope > ul, :scope > ol').forEach((sub) => {
      children.push(parseList(sub));
    });
    return { type: 'listItem', inlines, children };
  }

  function parseTable(tableEl) {
    const rows = [];
    let hasHeader = false;
    Array.from(tableEl.querySelectorAll('tr')).forEach((tr) => {
      const cells = [];
      Array.from(tr.children).forEach((cell) => {
        const tag = cell.tagName ? cell.tagName.toLowerCase() : '';
        if (tag === 'th') hasHeader = true;
        if (tag === 'td' || tag === 'th') {
          const inlines = parseInlineTokens(cell);
          const text = renderInlineToText(inlines).trim();
          cells.push(text);
        }
      });
      if (cells.length) rows.push(cells);
    });
    return { type: 'table', rows, hasHeader };
  }

  function renderInlineToMarkdown(tokens) {
    const parts = tokens.map((t) => {
      if (t.type === 'text') return t.value;
      if (t.type === 'br') return '\n';
      if (t.type === 'code') return t.value;
      if (t.type === 'strong') return '**' + renderInlineToMarkdown(t.children) + '**';
      if (t.type === 'em') return '*' + renderInlineToMarkdown(t.children) + '*';
      if (t.type === 'link') {
        const text = renderInlineToMarkdown(t.children);
        return text ? `[${text}](${t.href})` : t.href;
      }
      return '';
    });
    return parts.join('').replace(/\n{3,}/g, '\n\n').trim();
  }

  function renderInlineToText(tokens) {
    const parts = tokens.map((t) => {
      if (t.type === 'text') return t.value;
      if (t.type === 'br') return '\n';
      if (t.type === 'code') return t.value;
      if (t.type === 'strong' || t.type === 'em') return renderInlineToText(t.children);
      if (t.type === 'link') {
        const text = renderInlineToText(t.children);
        return t.href ? `${text} (${t.href})` : text;
      }
      return '';
    });
    return parts.join('').replace(/\n{3,}/g, '\n\n').trim();
  }

  function renderBlockToMarkdown(block, depth) {
    if (!block) return '';
    if (block.type === 'paragraph') {
      return renderInlineToMarkdown(block.inlines);
    }
    if (block.type === 'heading') {
      const level = Math.min(6, Math.max(4, block.level + 3));
      const text = renderInlineToMarkdown(block.inlines);
      return `${'#'.repeat(level)} ${text}`;
    }
    if (block.type === 'list') {
      return renderListToMarkdown(block, depth);
    }
    if (block.type === 'code') {
      const lang = block.lang ? block.lang : '';
      return `\n\`\`\`${lang}\n${block.text}\n\`\`\``.trim();
    }
    if (block.type === 'blockquote') {
      const inner = renderBlocksToMarkdown(block.blocks);
      return inner.split('\n').map((line) => (line.trim() ? `> ${line}` : '>')).join('\n');
    }
    if (block.type === 'table') {
      return renderTableToMarkdown(block);
    }
    if (block.type === 'hr') {
      return '---';
    }
    return '';
  }

  function renderListToMarkdown(list, depth) {
    const lines = [];
    list.items.forEach((item, idx) => {
      const indent = '  '.repeat(depth);
      const prefix = list.ordered ? `${idx + 1}. ` : '- ';
      const text = renderInlineToMarkdown(item.inlines);
      lines.push(`${indent}${prefix}${text}`.trimEnd());
      if (item.children && item.children.length) {
        item.children.forEach((child) => {
          const childText = renderListToMarkdown(child, depth + 1);
          if (childText) lines.push(childText);
        });
      }
    });
    return lines.join('\n');
  }

  function renderTableToMarkdown(table) {
    if (!table.rows || !table.rows.length) return '';
    const rows = table.rows;
    const header = table.hasHeader ? rows[0] : rows[0].map((_, i) => `列${i + 1}`);
    const bodyRows = table.hasHeader ? rows.slice(1) : rows;
    const headerLine = `| ${header.join(' | ')} |`;
    const sepLine = `| ${header.map(() => '---').join(' | ')} |`;
    const bodyLines = bodyRows.map((row) => `| ${row.join(' | ')} |`);
    return [headerLine, sepLine].concat(bodyLines).join('\n');
  }

  function renderBlocksToMarkdown(blocks) {
    const parts = blocks.map((block) => renderBlockToMarkdown(block, 0)).filter(Boolean);
    return parts.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  function renderBlockToText(block, depth) {
    if (!block) return '';
    if (block.type === 'paragraph') {
      return renderInlineToText(block.inlines);
    }
    if (block.type === 'heading') {
      const level = Math.min(4, Math.max(2, block.level));
      const text = renderInlineToText(block.inlines);
      return `${'#'.repeat(level)} ${text}`;
    }
    if (block.type === 'list') {
      return renderListToText(block, depth);
    }
    if (block.type === 'code') {
      return `\n\`\`\`\n${block.text}\n\`\`\``.trim();
    }
    if (block.type === 'blockquote') {
      const inner = renderBlocksToText(block.blocks);
      return inner.split('\n').map((line) => (line.trim() ? `> ${line}` : '>')).join('\n');
    }
    if (block.type === 'table') {
      return renderTableToText(block);
    }
    if (block.type === 'hr') {
      return '-'.repeat(24);
    }
    return '';
  }

  function renderListToText(list, depth) {
    const lines = [];
    list.items.forEach((item, idx) => {
      const indent = '  '.repeat(depth);
      const prefix = list.ordered ? `${idx + 1}. ` : '- ';
      const text = renderInlineToText(item.inlines);
      lines.push(`${indent}${prefix}${text}`.trimEnd());
      if (item.children && item.children.length) {
        item.children.forEach((child) => {
          const childText = renderListToText(child, depth + 1);
          if (childText) lines.push(childText);
        });
      }
    });
    return lines.join('\n');
  }

  function renderTableToText(table) {
    if (!table.rows || !table.rows.length) return '';
    return table.rows.map((row) => row.join(' | ')).join('\n');
  }

  function renderBlocksToText(blocks) {
    const parts = blocks.map((block) => renderBlockToText(block, 0)).filter(Boolean);
    return parts.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  function parse(html) {
    if (!html || !html.trim()) return [];
    const container = document.createElement('div');
    container.innerHTML = html;
    return collectBlocks(container);
  }

  function toMarkdown(html) {
    const blocks = parse(html);
    return renderBlocksToMarkdown(blocks);
  }

  function toText(html) {
    const blocks = parse(html);
    return renderBlocksToText(blocks);
  }

  global.HtmlToMarkdown = {
    parse,
    toMarkdown,
    toText
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
