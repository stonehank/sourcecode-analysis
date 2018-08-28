/**
 * Clamps `number` within the inclusive `lower` and `upper` bounds.
 *
 * @since 4.0.0
 * @category Number
 * @param {number} number The number to clamp.
 * @param {number} lower The lower bound.
 * @param {number} upper The upper bound.
 * @returns {number} Returns the clamped number.
 * @example
 *
 * clamp(-10, -5, 5)
 * // => -5
 *
 * clamp(10, -5, 5)
 * // => 5
 */
// 取中间值
function clamp(number, lower, upper) {
  // 通过+ 转化为数字
  number = +number
  lower = +lower
  upper = +upper
  // 如果非数字，则为0
  lower = lower === lower ? lower : 0
  upper = upper === upper ? upper : 0

  // number必须是数字
  if (number === number) {
    // 设定number为中间值
    number = number <= upper ? number : upper
    number = number >= lower ? number : lower
  }
  return number
}

export default clamp
