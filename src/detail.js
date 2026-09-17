import { formatBuildingArea } from './format.js';
import { formatShowcaseAddress } from './data.js';

function valueOrPending(value) {
  return value === null || value === undefined || value === '' ? '待补充' : String(value);
}

function row(label, value) {
  const item = document.createElement('div');
  item.className = 'detail-row';
  const term = document.createElement('dt');
  term.textContent = label;
  const description = document.createElement('dd');
  description.textContent = valueOrPending(value);
  item.append(term, description);
  return item;
}

function group(title, rows, open = false) {
  const section = document.createElement('details');
  section.className = 'detail-group';
  section.open = open;
  const heading = document.createElement('summary');
  heading.textContent = title;
  const list = document.createElement('dl');
  list.append(...rows);
  section.append(heading, list);
  return section;
}

function elevatorLabel(value) {
  return value === true ? '是' : value === false ? '否' : '不适用';
}

export function createShowcasePropertyDetail(container, onClose) {
  const content = container.querySelector('#property-detail-content');
  const heading = container.querySelector('#property-detail-heading');
  const summary = container.querySelector('#property-detail-summary');
  const closeButtons = container.querySelectorAll('#property-detail-close, #property-detail-back');
  let opener = null;

  function close() {
    container.hidden = true;
    content.replaceChildren();
    onClose?.();
    opener?.focus?.({ preventScroll: true });
    opener = null;
  }

  closeButtons.forEach(button => button.addEventListener('click', close));

  function render(property, location, nextOpener = null) {
    if (!property) { close(); return; }
    opener = nextOpener;
    heading.textContent = property.property_name;
    summary.textContent = `${property.property_type} · ${property.usage_status} · ${formatBuildingArea(property.building_area)}`;
    const groups = [
      group('核心信息', [
        row('房产编号', property.property_code),
        row('房产类型', property.property_type),
        row('建筑面积', formatBuildingArea(property.building_area)),
        row('使用状态', property.usage_status),
        row('产权单位', property.ownership_unit),
        row('定位状态', location.status === 'unlocated' ? '未定位' : '已定位 · 虚构演示坐标'),
      ], true),
      group('房屋位置', [
        row('行政区', property.district),
        row('地址概要', formatShowcaseAddress(property)),
        row('楼层', property.floor),
        row('房间', property.room_no),
      ], true),
    ];
    if (property.property_type === '住宅') {
      groups.push(group('住宅信息', [
        row('几居室', property.bedroom_count),
        row('是否有电梯', elevatorLabel(property.has_elevator)),
      ], true));
    }
    groups.push(group('运维责任', [
      row('责任部门', property.maintenance_department),
      row('维护责任人', property.maintenance_responsible_person),
    ], true));
    content.replaceChildren(...groups);
    if (location.status === 'unlocated') {
      const notice = document.createElement('p');
      notice.className = 'detail-unlocated';
      notice.textContent = '该虚构演示房产尚未设置展示坐标，因此地图上没有标记。';
      content.prepend(notice);
    }
    container.hidden = false;
  }

  return {
    render,
    close,
    focusHeading: () => heading.focus({ preventScroll: true }),
    get isOpen() { return !container.hidden; },
  };
}
