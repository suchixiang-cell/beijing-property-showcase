import { formatBuildingArea } from './format.js';
import { countActiveFilters, LOCATION_STATUS_LABELS, MISSING_OWNERSHIP } from './query.js';

function createPropertyCard(property, location, selected, index) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'property-card';
  card.dataset.propertyId = property.property_id;
  card.setAttribute('aria-pressed', String(selected));
  const number = document.createElement('span');
  number.className = 'property-card-number';
  number.textContent = String(index + 1).padStart(2, '0');
  const name = document.createElement('strong');
  name.className = 'property-card-name';
  name.textContent = property.property_name;
  const district = document.createElement('span');
  district.className = 'property-card-district';
  district.textContent = property.district;
  const summary = document.createElement('span');
  summary.className = 'property-card-summary';
  summary.textContent = `${property.property_type} · ${formatBuildingArea(property.building_area)}`;
  const status = document.createElement('span');
  status.className = `property-card-location is-${location.status}`;
  status.textContent = location.label;
  card.append(number, name, district, summary, status);
  card.setAttribute('aria-label', `第 ${index + 1} 项，${property.property_name}，${location.label}`);
  card.classList.toggle('is-selected', selected);
  return card;
}

export function createPropertyList(container, onSelect, onClearAll, getLocationState) {
  let selectedId = null;
  container.addEventListener('click', event => {
    const card = event.target.closest('.property-card');
    if (card) onSelect(card.dataset.propertyId, card, event);
  });

  function render(properties) {
    const fragment = document.createDocumentFragment();
    if (properties.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty-result';
      empty.setAttribute('role', 'status');
      empty.textContent = '当前条件下暂无匹配房产';
      const clear = document.createElement('button');
      clear.type = 'button';
      clear.className = 'empty-clear';
      clear.textContent = '清除全部条件';
      clear.addEventListener('click', onClearAll);
      fragment.append(empty, clear);
    } else {
      properties.forEach((property, index) => {
        fragment.append(createPropertyCard(property, getLocationState(property), property.property_id === selectedId, index));
      });
    }
    container.replaceChildren(fragment);
  }

  function setSelected(propertyId, scrollIntoView = false) {
    selectedId = propertyId;
    container.querySelectorAll('.property-card').forEach(card => {
      const selected = card.dataset.propertyId === propertyId;
      card.classList.toggle('is-selected', selected);
      card.setAttribute('aria-pressed', String(selected));
      if (!selected || !scrollIntoView) return;
      // 只滚动列表容器，避免带动整个页面
      const top = card.offsetTop;
      const bottom = top + card.offsetHeight;
      if (top < container.scrollTop) container.scrollTo({ top, behavior: 'smooth' });
      else if (bottom > container.scrollTop + container.clientHeight) {
        container.scrollTo({ top: bottom - container.clientHeight, behavior: 'smooth' });
      }
    });
  }

  return { render, setSelected };
}

export function createSearch(input, onSearch, delay = 240) {
  let timer = null;
  const apply = () => { clearTimeout(timer); onSearch(input.value); };
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(apply, delay);
  });
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); apply(); }
    if (event.key === 'Escape') {
      clearTimeout(timer);
      input.value = '';
      onSearch('');
      input.focus();
    }
  });
}

const GROUPS = Object.freeze([
  ['districts', '行政区'], ['ownershipUnits', '产权单位'], ['propertyTypes', '房产类型'],
  ['usageStatuses', '使用状态'], ['locationStatuses', '定位状态'], ['area', '建筑面积'],
]);

function emptyState() {
  return {
    districts: new Set(), ownershipUnits: new Set(), propertyTypes: new Set(), usageStatuses: new Set(), locationStatuses: new Set(),
    draftAreaMin: '', draftAreaMax: '', areaDraftError: null, appliedAreaMin: null, appliedAreaMax: null,
  };
}

function cloneState(state) {
  return {
    ...state,
    districts: new Set(state.districts), ownershipUnits: new Set(state.ownershipUnits),
    propertyTypes: new Set(state.propertyTypes), usageStatuses: new Set(state.usageStatuses),
    locationStatuses: new Set(state.locationStatuses),
  };
}

function labelFor(group, value) {
  if (group === 'ownershipUnits' && value === MISSING_OWNERSHIP) return '待补充';
  if (group === 'locationStatuses') return LOCATION_STATUS_LABELS[value];
  return value;
}

function parseArea(value) {
  if (!String(value).trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : NaN;
}

export function createPropertyFilters(container, onApply) {
  let applied = emptyState();
  let draft = cloneState(applied);
  let options = {};
  let activeGroup = null;

  container.innerHTML = `
    <div class="filter-toolbar" role="toolbar" aria-label="房产筛选条件">
      ${GROUPS.map(([key, label]) => `<button type="button" class="filter-trigger" data-filter-trigger="${key}" aria-expanded="false">${label}<span aria-hidden="true">⌄</span></button>`).join('')}
      <button id="filter-toggle" class="mobile-filter-toggle" type="button" aria-expanded="false">筛选（0）</button>
    </div>
    <div id="filter-panel" class="filter-panel" hidden></div>
    <div class="applied-filter-row"><span class="chip-prefix">已选：</span><div id="applied-filter-chips" class="applied-filter-chips"></div><button id="clear-filters" type="button" hidden>清除全部</button></div>`;

  const panel = container.querySelector('#filter-panel');
  const clear = container.querySelector('#clear-filters');
  const mobileToggle = container.querySelector('#filter-toggle');
  const notify = () => onApply(cloneState(applied));

  function closePanel() {
    activeGroup = null;
    panel.hidden = true;
    panel.replaceChildren();
    container.querySelectorAll('[data-filter-trigger]').forEach(button => button.setAttribute('aria-expanded', 'false'));
    mobileToggle.setAttribute('aria-expanded', 'false');
    container.classList.remove('mobile-filters-open');
  }

  function chip(label, remove) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'filter-chip';
    button.textContent = `${label} ×`;
    button.addEventListener('click', remove);
    return button;
  }

  function renderChips() {
    const holder = container.querySelector('#applied-filter-chips');
    const fragment = document.createDocumentFragment();
    GROUPS.filter(([group]) => group !== 'area').forEach(([group]) => applied[group].forEach(value => {
      fragment.append(chip(labelFor(group, value), () => {
        applied[group].delete(value);
        renderChips();
        notify();
      }));
    }));
    if (applied.appliedAreaMin !== null) fragment.append(chip(`${applied.appliedAreaMin}㎡以上`, () => {
      applied.appliedAreaMin = null; applied.draftAreaMin = ''; renderChips(); notify();
    }));
    if (applied.appliedAreaMax !== null) fragment.append(chip(`${applied.appliedAreaMax}㎡以下`, () => {
      applied.appliedAreaMax = null; applied.draftAreaMax = ''; renderChips(); notify();
    }));
    holder.replaceChildren(fragment);
    const count = countActiveFilters(applied);
    clear.hidden = count === 0;
    mobileToggle.textContent = `筛选（${count}）`;
    container.classList.toggle('has-applied-filters', count > 0);
  }

  function renderPanel(group) {
    panel.replaceChildren();
    const title = document.createElement('h2');
    title.className = 'filter-panel-title';
    title.textContent = GROUPS.find(([key]) => key === group)?.[1] ?? '筛选';
    const body = document.createElement('div');
    body.className = group === 'area' ? 'area-filter' : 'filter-options';
    body.dataset.filterGroup = group;
    if (group === 'area') {
      body.innerHTML = `<label>最小面积（㎡）<input id="area-min" type="number" min="0" step="any" inputmode="decimal"></label>
        <label>最大面积（㎡）<input id="area-max" type="number" min="0" step="any" inputmode="decimal"></label>
        <p id="applied-area" class="applied-area"></p><p id="area-error" class="area-error" role="status" hidden></p>`;
      body.querySelector('#area-min').value = draft.draftAreaMin;
      body.querySelector('#area-max').value = draft.draftAreaMax;
      const descriptions = [applied.appliedAreaMin === null ? null : `${applied.appliedAreaMin}㎡以上`, applied.appliedAreaMax === null ? null : `${applied.appliedAreaMax}㎡以下`].filter(Boolean);
      body.querySelector('#applied-area').textContent = `当前生效：${descriptions.join('，') || '不限面积'}`;
      body.querySelectorAll('input').forEach(input => input.addEventListener('input', () => {
        draft.draftAreaMin = body.querySelector('#area-min').value;
        draft.draftAreaMax = body.querySelector('#area-max').value;
        body.querySelector('#area-error').hidden = true;
      }));
    } else {
      (options[group] ?? []).forEach(value => {
        const option = document.createElement('label');
        option.className = 'filter-option';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = value;
        checkbox.checked = draft[group].has(value);
        checkbox.addEventListener('change', () => checkbox.checked ? draft[group].add(value) : draft[group].delete(value));
        option.append(checkbox, document.createTextNode(labelFor(group, value)));
        body.append(option);
      });
    }
    const actions = document.createElement('div');
    actions.className = 'filter-panel-actions';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = '取消';
    cancel.addEventListener('click', () => { draft = cloneState(applied); closePanel(); });
    const apply = document.createElement('button');
    apply.type = 'button';
    apply.textContent = '应用';
    apply.dataset.filterApply = '';
    apply.addEventListener('click', () => {
      if (group === 'area') {
        const minimum = parseArea(draft.draftAreaMin);
        const maximum = parseArea(draft.draftAreaMax);
        if (Number.isNaN(minimum) || Number.isNaN(maximum) || (minimum !== null && maximum !== null && minimum > maximum)) {
          const error = body.querySelector('#area-error');
          error.textContent = '面积输入无效；上一条有效面积条件仍在生效。';
          error.hidden = false;
          return;
        }
        draft.appliedAreaMin = minimum;
        draft.appliedAreaMax = maximum;
      }
      applied = cloneState(draft);
      closePanel();
      renderChips();
      notify();
    });
    actions.append(cancel, apply);
    panel.append(title, body, actions);
  }

  function openGroup(group) {
    if (activeGroup === group && !panel.hidden) { closePanel(); return; }
    activeGroup = group;
    draft = cloneState(applied);
    panel.hidden = false;
    renderPanel(group);
    container.querySelectorAll('[data-filter-trigger]').forEach(button => {
      button.setAttribute('aria-expanded', String(button.dataset.filterTrigger === group));
    });
    mobileToggle.setAttribute('aria-expanded', 'true');
  }

  container.querySelectorAll('[data-filter-trigger]').forEach(button => button.addEventListener('click', () => openGroup(button.dataset.filterTrigger)));
  mobileToggle.addEventListener('click', () => {
    const expanded = container.classList.toggle('mobile-filters-open');
    mobileToggle.setAttribute('aria-expanded', String(expanded));
    if (!expanded) closePanel();
  });
  clear.addEventListener('click', () => {
    applied = emptyState();
    draft = cloneState(applied);
    closePanel();
    renderChips();
    notify();
  });

  renderChips();
  return {
    getState: () => cloneState(applied),
    refreshOptions(nextOptions) { options = nextOptions; renderChips(); },
    clear() { clear.click(); },
  };
}
