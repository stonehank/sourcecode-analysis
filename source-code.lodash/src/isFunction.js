import baseGetTag from './.internal/baseGetTag.js'
import isObject from './isObject.js'

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a function, else `false`.
 * @example
 *
 * isFunction(_)
 * // => true
 *
 * isFunction(/abc/)
 * // => false
 */
function isFunction(value) {
  // 不是object并且不是function
  if (!isObject(value)) {
    return false
  }
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 9 which returns 'object' for typed arrays and other constructors.
  // 除了symbol和undefined和null，都是toString.call()
  const tag = baseGetTag(value)
  return tag == '[object Function]' || tag == '[object AsyncFunction]' ||
    tag == '[object GeneratorFunction]' || tag == '[object Proxy]'
}

export default isFunction
