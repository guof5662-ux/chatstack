/**
 * 侧边栏筛选与日期选择器模块
 * 职责：日期范围、平台筛选、日期选择器 UI
 */
(function (global) {
  class SidebarFilters {
    constructor(sidebar) {
      this.sidebar = sidebar;
    }

    get _t() { return (key, params) => this.sidebar._t(key, params); }
    get shadowRoot() { return this.sidebar.shadowRoot; }
    get container() { return this.sidebar.container; }

    get tocFilterDateRange() { return this.sidebar.tocFilterDateRange; }
    set tocFilterDateRange(v) { this.sidebar.tocFilterDateRange = v; }
    get tocFilterStartDate() { return this.sidebar.tocFilterStartDate; }
    set tocFilterStartDate(v) { this.sidebar.tocFilterStartDate = v; }
    get tocFilterEndDate() { return this.sidebar.tocFilterEndDate; }
    set tocFilterEndDate(v) { this.sidebar.tocFilterEndDate = v; }
    get tocFilterPlatforms() { return this.sidebar.tocFilterPlatforms; }
    set tocFilterPlatforms(v) { this.sidebar.tocFilterPlatforms = v; }

    ensureDatePickerPopup() {
      if (this.sidebar.datePickerPopup) return;
      const popup = document.createElement('div');
      popup.id = 'filter-date-picker-popup';
      popup.className = 'date-picker-popup';
      const weekdays = this._t('datePicker.weekdays').split(',');
      const weekdaysHtml = weekdays.map((d) => `<span>${this.sidebar.escapeHtml(d)}</span>`).join('');
      popup.innerHTML = `
      <div class="date-picker-header">
        <button type="button" class="date-picker-nav" data-delta="-12" title="${this.sidebar.escapeHtml(this._t('datePicker.prevYear'))}" aria-label="${this.sidebar.escapeHtml(this._t('datePicker.prevYear'))}"><<</button>
        <button type="button" class="date-picker-nav" data-delta="-1" title="${this.sidebar.escapeHtml(this._t('datePicker.prevMonth'))}" aria-label="${this.sidebar.escapeHtml(this._t('datePicker.prevMonth'))}"><</button>
        <span class="date-picker-title"></span>
        <button type="button" class="date-picker-nav" data-delta="1" title="${this.sidebar.escapeHtml(this._t('datePicker.nextMonth'))}" aria-label="${this.sidebar.escapeHtml(this._t('datePicker.nextMonth'))}">></button>
        <button type="button" class="date-picker-nav" data-delta="12" title="${this.sidebar.escapeHtml(this._t('datePicker.nextYear'))}" aria-label="${this.sidebar.escapeHtml(this._t('datePicker.nextYear'))}">>></button>
      </div>
      <div class="date-picker-weekdays">${weekdaysHtml}</div>
      <div class="date-picker-grid"></div>
      <div class="date-picker-footer"><button type="button" class="btn btn-link date-picker-today">${this.sidebar.escapeHtml(this._t('datePicker.today'))}</button></div>`;
      popup.style.display = 'none';
      this.container.appendChild(popup);
      this.sidebar.datePickerPopup = popup;
      this.sidebar.datePickerCurrentInputId = null;
      this.sidebar.datePickerYear = new Date().getFullYear();
      this.sidebar.datePickerMonth = new Date().getMonth() + 1;

      popup.querySelectorAll('.date-picker-nav').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const delta = parseInt(btn.getAttribute('data-delta'), 10);
          if (Math.abs(delta) === 12) {
            this.sidebar.datePickerYear += delta;
          } else {
            this.sidebar.datePickerMonth += delta;
            if (this.sidebar.datePickerMonth > 12) { this.sidebar.datePickerMonth = 1; this.sidebar.datePickerYear++; }
            if (this.sidebar.datePickerMonth < 1) { this.sidebar.datePickerMonth = 12; this.sidebar.datePickerYear--; }
          }
          this.renderDatePickerGrid();
        });
      });
      popup.querySelector('.date-picker-today').addEventListener('click', (e) => {
        e.stopPropagation();
        const id = this.sidebar.datePickerCurrentInputId;
        if (id) {
          const el = this.shadowRoot.getElementById(id);
          if (el) {
            el.value = this.formatDateForInput(Date.now());
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
        this.tocFilterDateRange = 'custom';
        popup.style.display = 'none';
      });
      this.shadowRoot.addEventListener('click', (e) => {
        if (popup.style.display === 'block' && !popup.contains(e.target) && !e.target.closest('.filter-date-calendar-btn')) {
          popup.style.display = 'none';
        }
      });
    }

    renderDatePickerGrid() {
      const popup = this.sidebar.datePickerPopup;
      if (!popup) return;
      const titleEl = popup.querySelector('.date-picker-title');
      const gridEl = popup.querySelector('.date-picker-grid');
      if (titleEl) titleEl.textContent = this._t('datePicker.titleFormat', { year: this.sidebar.datePickerYear, month: this.sidebar.datePickerMonth });
      const y = this.sidebar.datePickerYear;
      const m = this.sidebar.datePickerMonth - 1;
      const first = new Date(y, m, 1);
      const firstDay = first.getDay();
      const daysInMonth = new Date(y, m + 1, 0).getDate();
      const prevMonthDays = new Date(y, m, 0).getDate();
      const prevMonth1Based = m === 0 ? 12 : m;
      const prevYear = m === 0 ? y - 1 : y;
      const cells = [];
      for (let i = 0; i < firstDay; i++) {
        const d = prevMonthDays - firstDay + 1 + i;
        cells.push(`<button type="button" class="date-picker-cell other-month" data-year="${prevYear}" data-month="${prevMonth1Based}" data-day="${d}">${d}</button>`);
      }
      for (let d = 1; d <= daysInMonth; d++) {
        cells.push(`<button type="button" class="date-picker-cell" data-year="${y}" data-month="${m + 1}" data-day="${d}">${d}</button>`);
      }
      const total = cells.length;
      const remainder = total % 7;
      const nextMonthCount = remainder === 0 ? 0 : 7 - remainder;
      for (let i = 1; i <= nextMonthCount; i++) {
        const nextM = m + 2;
        const nextY = nextM > 12 ? y + 1 : y;
        const nextMo = nextM > 12 ? 1 : nextM;
        cells.push(`<button type="button" class="date-picker-cell other-month" data-year="${nextY}" data-month="${nextMo}" data-day="${i}">${i}</button>`);
      }
      gridEl.innerHTML = cells.join('');
      const today = new Date();
      gridEl.querySelectorAll('.date-picker-cell').forEach((cell) => {
        const yr = parseInt(cell.getAttribute('data-year'), 10);
        const mo = parseInt(cell.getAttribute('data-month'), 10);
        const day = parseInt(cell.getAttribute('data-day'), 10);
        if (yr === today.getFullYear() && mo === today.getMonth() + 1 && day === today.getDate()) {
          cell.classList.add('today');
        }
        cell.addEventListener('click', (e) => {
          e.stopPropagation();
          const inputId = this.sidebar.datePickerCurrentInputId;
          if (inputId) {
            const mm = String(mo).padStart(2, '0');
            const dd = String(day).padStart(2, '0');
            const val = `${yr}/${mm}/${dd}`;
            const el = this.shadowRoot.getElementById(inputId);
            if (el) {
              el.value = val;
              el.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }
          this.tocFilterDateRange = 'custom';
          this.sidebar.datePickerPopup.style.display = 'none';
        });
      });
    }

    openDatePickerForInput(inputId, anchorButton) {
      this.ensureDatePickerPopup();
      const inputEl = this.shadowRoot.getElementById(inputId);
      const popup = this.sidebar.datePickerPopup;
      this.sidebar.datePickerCurrentInputId = inputId;
      let y = new Date().getFullYear();
      let m = new Date().getMonth() + 1;
      if (inputEl && inputEl.value.trim()) {
        const parsed = this.parseDateInput(inputEl.value);
        if (parsed) {
          const d = new Date(parsed);
          y = d.getFullYear();
          m = d.getMonth() + 1;
        }
      }
      this.sidebar.datePickerYear = y;
      this.sidebar.datePickerMonth = m;
      this.renderDatePickerGrid();
      popup.style.display = 'block';
      const rect = anchorButton.getBoundingClientRect();
      const containerRect = this.container.getBoundingClientRect();
      const gap = 4;
      let left = rect.left - containerRect.left;
      let top = rect.bottom - containerRect.top + gap;
      const popupWidth = popup.offsetWidth;
      const popupHeight = popup.offsetHeight;
      const containerWidth = containerRect.width;
      const containerHeight = containerRect.height;
      if (left + popupWidth > containerWidth - 8) left = Math.max(8, containerWidth - popupWidth - 8);
      if (left < 8) left = 8;
      if (top + popupHeight > containerHeight - 8) top = Math.max(8, containerHeight - popupHeight - 8);
      if (top < 8) top = 8;
      popup.style.left = left + 'px';
      popup.style.top = top + 'px';
    }

    getFilterDateRange() {
      const now = Date.now();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayStartMs = todayStart.getTime();
      if (this.tocFilterDateRange === 'today') return { start: todayStartMs, end: now };
      if (this.tocFilterDateRange === 'last3Days') {
        const end = todayStartMs - 1;
        const start = todayStartMs - 3 * 86400 * 1000;
        return { start, end };
      }
      if (this.tocFilterDateRange === 'last7Days') {
        const end = todayStartMs - 1;
        const start = todayStartMs - 7 * 86400 * 1000;
        return { start, end };
      }
      if (this.tocFilterDateRange === 'custom') return { start: this.tocFilterStartDate || 0, end: this.tocFilterEndDate || now };
      return { start: null, end: null };
    }

    formatDateForInput(ms) {
      if (!ms) return '';
      const d = new Date(ms);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}/${m}/${day}`;
    }

    parseDateInput(str) {
      if (!str || !str.trim()) return null;
      const normalized = str.trim().replace(/-/g, '/');
      const d = new Date(normalized);
      if (isNaN(d.getTime())) return null;
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    }

    hasActiveFilter() {
      if (this.tocFilterDateRange) return true;
      if ((this.tocFilterStartDate || this.tocFilterEndDate)) return true;
      if (this.tocFilterPlatforms && this.tocFilterPlatforms.length > 0) return true;
      return false;
    }

    applyFilterFromPanel(startInputId = 'filter-start-date', endInputId = 'filter-end-date') {
      const startEl = this.shadowRoot.getElementById(startInputId);
      const endEl = this.shadowRoot.getElementById(endInputId);
      if (startEl && startEl.value.trim()) this.sidebar.tocFilterStartDate = this.parseDateInput(startEl.value);
      if (endEl && endEl.value.trim()) this.sidebar.tocFilterEndDate = this.parseDateInput(endEl.value);
    }

    clearTocFilter() {
      this.sidebar.tocFilterDateRange = null;
      this.sidebar.tocFilterStartDate = null;
      this.sidebar.tocFilterEndDate = null;
      this.sidebar.tocFilterPlatforms = [];
    }

    syncFilterPanelUI(panelScope = 'conversations') {
      if (panelScope !== 'conversations' && panelScope !== 'projects') return;
      const rangeSelector = panelScope === 'conversations' ? '#conversations-filter-panel .filter-range-btn' : '#projects-filter-panel .filter-range-btn';
      this.shadowRoot.querySelectorAll(rangeSelector).forEach((btn) => {
        btn.classList.toggle('active', btn.getAttribute('data-range') === this.tocFilterDateRange);
      });
      const startId = panelScope === 'conversations' ? 'conv-filter-start-date' : 'projects-filter-start-date';
      const endId = panelScope === 'conversations' ? 'conv-filter-end-date' : 'projects-filter-end-date';
      const startEl = this.shadowRoot.getElementById(startId);
      const endEl = this.shadowRoot.getElementById(endId);
      if (startEl) startEl.value = this.tocFilterStartDate ? this.formatDateForInput(this.tocFilterStartDate) : '';
      if (endEl) endEl.value = this.tocFilterEndDate ? this.formatDateForInput(this.tocFilterEndDate) : '';
      const optsId = panelScope === 'conversations' ? 'conv-filter-platform-options' : 'projects-filter-platform-options';
      const opts = this.shadowRoot.getElementById(optsId);
      if (opts) opts.querySelectorAll('input[type="checkbox"]').forEach((cb) => { cb.checked = (this.tocFilterPlatforms || []).includes(cb.value); });
      const triggerId = panelScope === 'conversations' ? 'conv-filter-platform-trigger' : 'projects-filter-platform-trigger';
      this.updateFilterPlatformTriggerText(triggerId);
    }

    updateFilterPlatformTriggerText(triggerId = 'filter-platform-trigger') {
      const trigger = this.shadowRoot.getElementById(triggerId);
      if (!trigger) return;
      const n = (this.tocFilterPlatforms || []).length;
      if (n === 0) trigger.textContent = this._t('filter.selectPlatform');
      else if (n === 3) trigger.textContent = this._t('filter.allPlatforms');
      else trigger.textContent = this._t('filter.selectedPlatforms', { n: String(n) });
    }
  }

  global.SidebarFilters = SidebarFilters;
})(typeof globalThis !== 'undefined' ? globalThis : window);
