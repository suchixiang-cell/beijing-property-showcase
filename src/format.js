const areaFormatter = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 });

export function formatBuildingArea(area) {
  return `${areaFormatter.format(area)}㎡`;
}
