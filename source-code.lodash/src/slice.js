/**
 * Creates a slice of `array` from `start` up to, but not including, `end`.
 *
 * **Note:** This method is used instead of
 * [`Array#slice`](https://mdn.io/Array/slice) to ensure dense arrays are
 * returned.
 *
 * @since 3.0.0
 * @category Array
 * @param {Array} array The array to slice.
 * @param {number} [start=0] The start position. A negative index will be treated as an offset from the end.
 * @param {number} [end=array.length] The end position. A negative index will be treated as an offset from the end.
 * @returns {Array} Returns the slice of `array`.
 * @example
 *
 * var array = [1, 2, 3, 4]
 *
 * _.slice(array, 2)
 * // => [3, 4]
 */
// 比原生更快
// https://jsperf.com/hank-test-slice
function slice(array, start, end) {
  let length = array == null ? 0 : array.length
  if (!length) {
    return []
  }
  // 设定start和end默认值
  start = start == null ? 0 : start
  end = end === undefined ? length : end

  // start为负数，相当于倒序，绝对值不能超过length(不允许负数，因为后面要用 >>> )
  if (start < 0) {
    start = -start > length ? 0 : (length + start)
  }
  // end负数为倒序
  end = end > length ? length : end
  if (end < 0) {
    end += length
  }
  // x>>>0 相当于 Math.floor(x)向下取整(这里start一定大于等于0)
  length = start > end ? 0 : ((end - start) >>> 0)
  start >>>= 0

  let index = -1
  const result = new Array(length)
  // 逐个添加进result，返回result
  while (++index < length) {
    result[index] = array[index + start]
  }
  return result
}

export default slice
