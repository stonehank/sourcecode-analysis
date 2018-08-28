import baseGetTag from './.internal/baseGetTag.js'
import isObjectLike from './isObjectLike.js'

/**
 * Checks if `value` is a plain object, that is, an object created by the
 * `Object` constructor or one with a `[[Prototype]]` of `null`.
 *
 * @since 0.8.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a plain object, else `false`.
 * @example
 *
 * function Foo() {
 *   this.a = 1
 * }
 *
 * isPlainObject(new Foo)
 * // => false
 *
 * isPlainObject([1, 2, 3])
 * // => false
 *
 * isPlainObject({ 'x': 0, 'y': 0 })
 * // => true
 *
 * isPlainObject(Object.create(null))
 * // => true
 */
function isPlainObject(value) {
  // typeof 为object不为null 并且 toString为[object Object]，才继续处理
  if (!isObjectLike(value) || baseGetTag(value) != '[object Object]') {
    return false
  }
  // 无prototype
  if (Object.getPrototypeOf(value) === null) {
    return true
  }
  let proto = value

  while (Object.getPrototypeOf(proto) !== null) {
    // 找到原型链最顶端(非null)，也就是 Object
    proto = Object.getPrototypeOf(proto)
  }
  // 判断prototype是否为Object
  return Object.getPrototypeOf(value) === proto
}

export default isPlainObject
