/**
 * 侧边栏导出模块 - 导出模式、勾选、构建文件、下载
 * 依赖: window.HtmlToMarkdown, window.storageManager, window.projectManager
 */
(function (global) {
  class SidebarExport {
    constructor(sidebar) {
      this.sidebar = sidebar;
    }

    get _t() { return (key, params) => this.sidebar._t(key, params); }
    get shadowRoot() { return this.sidebar.shadowRoot; }
    get container() { return this.sidebar.container; }
    get exportState() { return this.sidebar.exportState; }

    getExportBarHTML(scope) {
      const id = `export-bar-${scope}`;
      const countId = `export-count-${scope}`;
      return `
      <div class="export-bar" id="${id}" data-scope="${scope}" style="display: none;">
        <div class="export-formats">
          <span class="export-label" data-i18n="export.format">${this._t('export.format')}</span>
          <label class="export-format"><input type="checkbox" data-format="json"> JSON</label>
          <label class="export-format"><input type="checkbox" data-format="md"> MD</label>
          <label class="export-format"><input type="checkbox" data-format="txt"> TXT</label>
          <label class="export-format export-zip"><input type="checkbox" data-zip> ${this._t('export.zip')}</label>
          <span class="export-count" id="${countId}">${this._t('export.selected', { n: '0' })}</span>
        </div>
        <div class="export-actions">
          <button type="button" class="btn btn-secondary btn-small export-select-all-btn" data-action="select-all" data-i18n="export.selectAll">${this._t('export.selectAll')}</button>
          <button type="button" class="btn btn-secondary btn-small" data-action="clear" data-i18n="export.clear">${this._t('export.clear')}</button>
          <button type="button" class="btn btn-secondary btn-small" data-action="cancel" data-i18n="export.cancel">${this._t('export.cancel')}</button>
          <button type="button" class="btn btn-primary btn-small" data-action="download" data-i18n="export.download">${this._t('export.download')}</button>
        </div>
        <div class="export-hint"></div>
      </div>
    `;
    }

    toggleExportMode(scope) {
      if (this.exportState.active) {
        if (this.exportState.scope === scope) {
          this.exitExportMode();
          return;
        }
        this.exitExportMode();
      }
      this.enterExportMode(scope);
    }

    enterExportMode(scope) {
      this.exportState.active = true;
      this.exportState.scope = scope;
      this.exportState.selected = new Set();
      if (this.container) {
        this.container.classList.add('export-mode');
        this.container.setAttribute('data-export-scope', scope);
      }
      if (scope === 'history') {
        const convFilterPanel = this.shadowRoot.getElementById('conversations-filter-panel');
        const btnConvFilter = this.shadowRoot.getElementById('btn-conversations-filter');
        if (convFilterPanel) {
          convFilterPanel.style.display = 'none';
          this.sidebar.conversationsFilterPanelOpen = false;
        }
        if (btnConvFilter) {
          btnConvFilter.classList.toggle('active', this.sidebar.hasActiveFilter());
        }
      } else if (scope === 'projects') {
        const projFilterPanel = this.shadowRoot.getElementById('projects-filter-panel');
        const btnProjFilter = this.shadowRoot.getElementById('btn-projects-filter');
        if (projFilterPanel) {
          projFilterPanel.style.display = 'none';
          this.sidebar.projectsFilterPanelOpen = false;
        }
        if (btnProjFilter) {
          btnProjFilter.classList.toggle('active', this.sidebar.hasActiveFilter());
        }
      }
      const bar = this.shadowRoot.getElementById(`export-bar-${scope}`);
      if (bar) bar.style.display = 'flex';
      this.syncExportFormatsToUI();
      this.updateExportHint();
      if (scope === 'toc') {
        this.selectAllInScope(scope);
      }
      this.updateExportCount();
    }

    exitExportMode() {
      if (this.container) {
        this.container.classList.remove('export-mode');
        this.container.removeAttribute('data-export-scope');
      }
      if (this.exportState.scope) {
        const bar = this.shadowRoot.getElementById(`export-bar-${this.exportState.scope}`);
        if (bar) bar.style.display = 'none';
      }
      this.exportState.active = false;
      this.exportState.scope = null;
      this.exportState.selected = new Set();
      this.syncExportSelectionUI();
    }

    syncExportFormatsToUI() {
      if (!this.exportState.scope) return;
      const bar = this.shadowRoot.getElementById(`export-bar-${this.exportState.scope}`);
      if (!bar) return;
      bar.querySelectorAll('input[data-format]').forEach((input) => {
        const fmt = input.getAttribute('data-format');
        input.checked = !!this.exportState.formats[fmt];
      });
      const zipInput = bar.querySelector('input[data-zip]');
      if (zipInput) zipInput.checked = !!this.exportState.zip;
    }

    updateExportHint() {
      const scope = this.exportState.scope;
      if (!scope) return;
      const bar = this.shadowRoot.getElementById(`export-bar-${scope}`);
      if (!bar) return;
      const hintEl = bar.querySelector('.export-hint');
      if (!hintEl) return;
      let key = 'export.hint.history';
      if (scope === 'toc') key = 'export.hint.toc';
      else if (scope === 'projects') key = 'export.hint.projects';
      hintEl.textContent = this._t(key);
    }

    updateExportCount() {
      if (!this.exportState.scope) return;
      const countEl = this.shadowRoot.getElementById(`export-count-${this.exportState.scope}`);
      if (countEl) {
        countEl.textContent = this._t('export.selected', { n: String(this.exportState.selected.size) });
      }
    }

    toggleExportSelectionFromDot(dot) {
      if (!this.exportState.active) return;
      const scope = dot.getAttribute('data-scope');
      if (scope !== this.exportState.scope) return;
      const key = this.getExportKeyFromDot(dot);
      if (!key) return;
      if (this.exportState.selected.has(key)) this.exportState.selected.delete(key);
      else this.exportState.selected.add(key);
      this.syncExportSelectionUI();
    }

    getExportKeyFromDot(dot) {
      const scope = dot.getAttribute('data-scope');
      const type = dot.getAttribute('data-type');
      if (!scope || !type) return null;
      if (type === 'project') {
        const pType = dot.getAttribute('data-project-type');
        const pKey = dot.getAttribute('data-project-key');
        if (!pType || !pKey) return null;
        return `${scope}:project:${pType}:${pKey}`;
      }
      const id = dot.getAttribute('data-id');
      if (!id) return null;
      return `${scope}:${type}:${id}`;
    }

    syncExportSelectionUI() {
      this.shadowRoot.querySelectorAll('.export-select-dot').forEach((dot) => {
        const key = this.getExportKeyFromDot(dot);
        const selected = key && this.exportState.selected.has(key);
        dot.classList.toggle('selected', !!selected);
        const container = dot.closest('.toc-item, .conv-card, .project-item-header');
        if (container) {
          container.classList.toggle('export-selected', !!selected);
          container.setAttribute('aria-selected', selected ? 'true' : 'false');
        }
      });
      this.updateExportCount();
      this.updateSelectAllButtonState();
    }

    selectAllInScope(scope) {
      const dots = this.shadowRoot.querySelectorAll(`.export-select-dot[data-scope="${scope}"]`);
      dots.forEach((dot) => {
        const key = this.getExportKeyFromDot(dot);
        if (key) this.exportState.selected.add(key);
      });
      this.syncExportSelectionUI();
    }

    isAllSelectedInScope(scope) {
      const dots = this.shadowRoot.querySelectorAll(`.export-select-dot[data-scope="${scope}"]`);
      if (!dots.length) return false;
      let selectedCount = 0;
      dots.forEach((dot) => {
        const key = this.getExportKeyFromDot(dot);
        if (key && this.exportState.selected.has(key)) selectedCount += 1;
      });
      return selectedCount === dots.length;
    }

    updateSelectAllButtonState() {
      const scope = this.exportState.scope;
      if (!scope) return;
      const bar = this.shadowRoot.getElementById(`export-bar-${scope}`);
      if (!bar) return;
      const btn = bar.querySelector('.export-select-all-btn');
      if (!btn) return;
      const isAllSelected = this.isAllSelectedInScope(scope);
      btn.classList.toggle('active', isAllSelected);
    }

    handleExportBarAction(btn) {
      if (!this.exportState.active) return;
      const action = btn.getAttribute('data-action');
      if (!action) return;
      if (action === 'cancel') {
        this.exitExportMode();
        return;
      }
      if (action === 'clear') {
        this.exportState.selected.clear();
        this.syncExportSelectionUI();
        return;
      }
      if (action === 'select-all') {
        const scope = this.exportState.scope;
        if (!scope) return;
        if (this.isAllSelectedInScope(scope)) {
          this.exportState.selected.clear();
          this.syncExportSelectionUI();
        } else {
          this.selectAllInScope(scope);
        }
        return;
      }
      if (action === 'download') {
        this.runExportDownload();
      }
    }

    async runExportDownload() {
      if (!this.exportState.active || !this.exportState.scope) return;
      const formats = Object.keys(this.exportState.formats).filter((f) => this.exportState.formats[f]);
      if (formats.length === 0) {
        this.sidebar.showToast(this._t('export.noFormat'));
        return;
      }
      if (this.exportState.selected.size === 0) {
        this.sidebar.showToast(this._t('export.noSelection'));
        return;
      }

      const files = await this.buildExportFiles(formats);
      if (!files.length) {
        this.sidebar.showToast(this._t('export.noSelection'));
        return;
      }

      const shouldZip = this.exportState.zip || files.length > 1;
      if (shouldZip) {
        if (typeof window.JSZip === 'undefined') {
          this.sidebar.showToast(this._t('export.zipUnavailable'));
          return;
        }
        const zip = new window.JSZip();
        files.forEach((f) => zip.file(f.name, f.content));
        const blob = await zip.generateAsync({ type: 'blob' });
        const zipName = `chatstack_export_${this.formatDateForFileName(Date.now())}.zip`;
        this.downloadBlob(blob, zipName);
        this.sidebar.showToast(this._t('export.done'));
        this.selectAllInScope(this.exportState.scope);
        this.resetExportDownloadButton();
        return;
      }

      for (const f of files) {
        const blob = new Blob([f.content], { type: f.mime });
        this.downloadBlob(blob, f.name);
      }
      this.sidebar.showToast(this._t('export.done'));
      this.selectAllInScope(this.exportState.scope);
      this.resetExportDownloadButton();
    }

    resetExportDownloadButton() {
      if (!this.exportState.scope) return;
      const bar = this.shadowRoot.getElementById(`export-bar-${this.exportState.scope}`);
      if (!bar) return;
      const downloadBtn = bar.querySelector('button[data-action="download"]');
      if (downloadBtn) {
        downloadBtn.removeAttribute('disabled');
        downloadBtn.blur();
      }
    }

    async buildExportFiles(formats) {
      const scope = this.exportState.scope;
      if (scope === 'toc') return this.buildTocExportFiles(formats);
      if (scope === 'history') return this.buildHistoryExportFiles(formats);
      if (scope === 'projects') return this.buildProjectsExportFiles(formats);
      return [];
    }

    async buildTocExportFiles(formats) {
      if (!this.sidebar.conversationId) return [];
      const selectedIds = Array.from(this.exportState.selected)
        .filter((k) => k.startsWith('toc:message:'))
        .map((k) => k.replace('toc:message:', ''));
      if (selectedIds.length === 0) return [];
      const idToIndex = new Map();
      this.sidebar.messages.forEach((m, i) => idToIndex.set(m.id, i));
      const selected = selectedIds
        .map((id) => {
          const msg = this.sidebar.messages.find((m) => m.id === id);
          if (!msg) return null;
          const index = (idToIndex.get(id) || 0) + 1;
          let contentHtml = msg.contentHtml || null;
          if (!contentHtml && msg.element) {
            try {
              contentHtml = this.sidebar.extractMessageHTMLForDisplay(msg.element);
            } catch (e) {
              this.sidebar.log('buildTocExportFiles contentHtml error:', e);
            }
          }
          return { index, role: msg.role, content: msg.content || '', contentHtml };
        })
        .filter(Boolean)
        .sort((a, b) => a.index - b.index);
      if (!selected.length) return [];

      const conv = await window.storageManager.getConversation(this.sidebar.conversationId);
      const title = (conv && conv.title) || this._t('conv.defaultTitle');
      const base = this.safeFilename(`current_${title}_${this.sidebar.conversationId.slice(0, 8)}_blocks`);
      return this.buildMessageFiles(base, title, this.sidebar.conversationId, selected, formats, undefined, conv);
    }

    async buildHistoryExportFiles(formats) {
      const selected = Array.from(this.exportState.selected);
      const projectKeys = selected.filter((k) => k.startsWith('history:project:'));
      const convIds = new Set(
        selected
          .filter((k) => k.startsWith('history:conversation:'))
          .map((k) => k.replace('history:conversation:', ''))
      );
      const folderMap = new Map();
      if (projectKeys.length) {
        const autoProjects = window.projectManager.getAutoProjects();
        projectKeys.forEach((k) => {
          const parts = k.split(':');
          const pType = parts[2];
          const pKey = parts.slice(3).join(':');
          if (pType !== 'auto') return;
          const project = autoProjects[pKey];
          if (!project) return;
          const projectName = project.name || pKey;
          (project.conversations || []).forEach((id) => {
            convIds.add(id);
            if (!folderMap.has(id)) folderMap.set(id, projectName);
          });
        });
      }
      if (!convIds.size) return [];
      const files = [];
      for (const id of convIds) {
        const conv = await window.storageManager.getConversation(id);
        const title = (conv && conv.title) || this._t('conv.defaultTitle');
        const messages = (conv.messages || []).map((m, i) => ({
          index: i + 1,
          role: m.role,
          content: m.content || '',
          contentHtml: m.contentHtml || null
        }));
        const base = this.safeFilename(`${title}_${id.slice(0, 8)}`);
        const folderName = folderMap.get(id);
        files.push(...this.buildMessageFiles(base, title, id, messages, formats, folderName, conv));
      }
      return files;
    }

    async buildProjectsExportFiles(formats) {
      const selected = Array.from(this.exportState.selected);
      const folderKeys = selected.filter((k) => k.startsWith('projects:project:'));
      const convIds = new Set(selected.filter((k) => k.startsWith('projects:conversation:')).map((k) => k.replace('projects:conversation:', '')));
      const folderMap = new Map();
      const chatgptProjects = window.projectManager.getChatGPTProjects();
      const myProjects = window.projectManager.getMyProjects();

      folderKeys.forEach((k) => {
        const parts = k.split(':');
        const pType = parts[2];
        const pKey = parts.slice(3).join(':');
        const project = pType === 'chatgpt' ? chatgptProjects[pKey] : myProjects[pKey];
        if (!project) return;
        const projectName = project.name || pKey;
        (project.conversations || []).forEach((id) => {
          if (!folderMap.has(id)) folderMap.set(id, projectName);
          convIds.add(id);
        });
      });

      const files = [];
      for (const id of convIds) {
        const conv = await window.storageManager.getConversation(id);
        const title = (conv && conv.title) || this._t('conv.defaultTitle');
        const messages = (conv.messages || []).map((m, i) => ({
          index: i + 1,
          role: m.role,
          content: m.content || '',
          contentHtml: m.contentHtml || null
        }));
        const base = this.safeFilename(`${title}_${id.slice(0, 8)}`);
        const folder = folderMap.get(id);
        files.push(...this.buildMessageFiles(base, title, id, messages, formats, folder, conv));
      }
      return files;
    }

    buildMessageFiles(baseName, title, conversationId, messages, formats, folderName, conv) {
      const files = [];
      const prefix = folderName ? this.safeFilename(folderName) + '/' : '';
      const platform = (conv && conv.platform) ? conv.platform : 'ChatGPT';
      const site = platform;
      const url = conversationId
        ? this.sidebar.getConversationOpenUrl(platform, conversationId, (conv && conv.link) ? conv.link : '')
        : '';
      const exportedAt = new Date().toISOString();
      if (formats.includes('json')) {
        const data = {
          id: conversationId,
          title,
          site,
          url,
          exported: exportedAt,
          messages: messages.map((m) => ({ index: m.index, role: m.role, content: m.content || '' }))
        };
        files.push({ name: `${prefix}${baseName}.json`, content: JSON.stringify(data, null, 2), mime: 'application/json' });
      }
      if (formats.includes('md')) {
        const mdHeader = [
          '# ChatStack Export', '', '## Metadata', '',
          `- Site: ${site}`, `- URL: ${url}`, `- Exported: ${exportedAt}`, '', '## Messages', ''
        ];
        const mdMessages = messages.map((m, idx) => {
          const body = this.renderMessageContent(m, 'md');
          const separator = idx === 0 ? '' : '\n\n---\n';
          return `${separator}### ${m.index}. ${m.role}\n\n${body}`;
        });
        const body = mdHeader.concat(mdMessages).join('\n\n');
        files.push({ name: `${prefix}${baseName}.md`, content: body, mime: 'text/markdown' });
      }
      if (formats.includes('txt')) {
        const txtHeader = [
          'ChatStack Export', '', 'Metadata',
          `Site: ${site}`, `URL: ${url}`, `Exported: ${exportedAt}`, '', 'Messages', ''
        ];
        const txtMessages = messages.map((m, idx) => {
          const body = this.renderMessageContent(m, 'txt').split('\n').map((line) => '  ' + line).join('\n');
          const separator = idx === 0 ? '' : '\n\n' + '-'.repeat(40) + '\n';
          return `${separator}${m.index}. ${m.role}\n${body}`;
        });
        const body = txtHeader.concat(txtMessages).join('\n\n');
        files.push({ name: `${prefix}${baseName}.txt`, content: body, mime: 'text/plain' });
      }
      return files;
    }

    stripHighlightMarkupForExport(html) {
      if (!html || typeof html !== 'string') return html || '';
      let cleaned = html;
      cleaned = cleaned.replace(/<mark[^>]*>([\s\S]*?)<\/mark>/gi, '$1');
      cleaned = cleaned.replace(/<span[^>]*class="[^"]*highlight[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, '$1');
      cleaned = cleaned.replace(/<span[^>]*style="[^"]*background[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, '$1');
      cleaned = cleaned.replace(/<span[^>]*>\s*<\/span>/gi, '');
      return cleaned;
    }

    getMessageHtmlForExport(message) {
      let html = '';
      if (message && message.contentHtml && message.contentHtml.trim()) html = message.contentHtml;
      else if (message && message.element) {
        try {
          const extracted = this.sidebar.extractMessageHTMLForDisplay(message.element);
          if (extracted && extracted.trim()) html = extracted;
        } catch (e) {
          this.sidebar.log('getMessageHtmlForExport error:', e);
        }
      }
      if (!html) return this.wrapPlainTextAsHtml((message && message.content) || '');
      return this.stripHighlightMarkupForExport(html);
    }

    wrapPlainTextAsHtml(text) {
      const safe = this.sidebar.escapeHtml((text || '').replace(/\r\n/g, '\n'));
      const parts = safe.split(/\n{2,}/).map((p) => p.replace(/\n/g, '<br>'));
      return parts.map((p) => `<p>${p}</p>`).join('');
    }

    renderMessageContent(message, format) {
      const html = this.getMessageHtmlForExport(message);
      if (!html || !html.trim()) return '';
      if (format === 'md') return (window.HtmlToMarkdown && window.HtmlToMarkdown.toMarkdown(html)) || '';
      return (window.HtmlToMarkdown && window.HtmlToMarkdown.toText(html)) || '';
    }

    safeFilename(name) {
      return (name || 'export')
        .replace(/[\\/:*?"<>|]+/g, '_')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 80) || 'export';
    }

    formatDateForFileName(ms) {
      const d = new Date(ms);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const h = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      return `${y}${m}${day}_${h}${min}`;
    }

    downloadBlob(blob, filename) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }
  }

  global.SidebarExport = SidebarExport;
})(typeof globalThis !== 'undefined' ? globalThis : window);
