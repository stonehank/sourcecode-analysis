import parseOffsetAsPercentage from './parseOffsetAsPercentage';
import parseOffsetAsPixels from './parseOffsetAsPixels';

/**
 * @param {string|number} offset
 * @param {number} contextHeight
 * @return {number} A number representing `offset` converted into pixels.
 */
export default function computeOffsetPixels(offset, contextHeight) {
  // 转化用户输入字符串offset
  const pixelOffset = parseOffsetAsPixels(offset);
  // 转化为数字直接返回
  if (typeof pixelOffset === 'number') {
    return pixelOffset;
  }
  // 处理带百分号的情况
  const percentOffset = parseOffsetAsPercentage(offset);
  if (typeof percentOffset === 'number') {
    return percentOffset * contextHeight;
  }
}
