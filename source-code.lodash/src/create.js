/**
 * Creates an object that inherits from the `prototype` object. If a
 * `properties` object is given, its own enumerable string keyed properties
 * are assigned to the created object.
 *
 * @since 2.3.0
 * @category Object
 * @param {Object} prototype The object to inherit from.
 * @param {Object} [properties] The properties to assign to the object.
 * @returns {Object} Returns the new object.
 * @example
 *
 * function Shape() {
 *   this.x = 0
 *   this.y = 0
 * }
 * Circle 继承 Shape
 * function Circle() {
 *   Shape.call(this)
 * }
 *
 * // 重写Circle的prototype为一个新对象
 * Circle.prototype = create(Shape.prototype, {
 *   'constructor': Circle
 * })
 *
 * const circle = new Circle
 * circle instanceof Circle
 * // => true
 *
 * circle instanceof Shape
 * // => true
 */
// 创建非引用对象
function create(prototype, properties) {
  prototype = prototype === null ? null : Object(prototype)
  // prototype作为新对象的prototype
  const result = Object.create(prototype)
  // properties浅合并
  return properties == null ? result : Object.assign(result, properties)
}

export default create
