// front/src/components/Questionnaire/areaOptions.ts
import { areaList } from '@vant/area-data';

interface CascaderOption {
  value: string;
  label: string;
  children?: CascaderOption[];
}

// 缓存转换结果，避免重复计算
let cachedAreaOptions: CascaderOption[] | null = null;

function convertVantToCascader(list: Record<string, string>, level = 1): CascaderOption[] {
  if (!list) return [];
  return Object.entries(list).map(([code, name]) => {
    let children: CascaderOption[] | undefined;
    if (level === 1) {
      // 省 -> 市
      const cities = Object.entries(areaList.city_list).filter(([cityCode]) => cityCode.startsWith(code.slice(0, 2)));
      children = convertVantToCascader(Object.fromEntries(cities), 2);
    } else if (level === 2) {
      // 市 -> 区
      const counties = Object.entries(areaList.county_list).filter(([countyCode]) => countyCode.startsWith(code.slice(0, 4)));
      children = convertVantToCascader(Object.fromEntries(counties), 3);
    }
    return {
      value: code,
      label: name,
      ...(children && children.length > 0 ? { children } : {})
    };
  });
}

// 延迟初始化，使用缓存
function getAreaOptions(): CascaderOption[] {
  if (cachedAreaOptions === null) {
    cachedAreaOptions = convertVantToCascader(areaList.province_list, 1);
  }
  return cachedAreaOptions;
}

// 导出函数而不是直接计算的结果
export default getAreaOptions();
