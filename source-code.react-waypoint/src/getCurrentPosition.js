import constants from './constants';

/**
 * @param {object} bounds An object with bounds data for the waypoint and
 *   scrollable parent
 * @return {string} The current position of the waypoint in relation to the
 *   visible portion of the scrollable parent. One of `constants.above`,
 *   `constants.below`, or `constants.inside`.
 */
export default function getCurrentPosition(bounds) {
  // 如果下边线和上边线重合，说明元素不可见
  if (bounds.viewportBottom - bounds.viewportTop === 0) {
    return constants.invisible;
  }
  /*

                ___________ 视口顶端
               |           |
               |-----------|  上边线   viewportTop
               |           |
               |--△元素---| 下边线
               |___________|          viewportBottom
                            视口底端

*/
  // 头还在范围内
  // top is within the viewport
  if (bounds.viewportTop <= bounds.waypointTop &&
      bounds.waypointTop <= bounds.viewportBottom) {
    return constants.inside;
  }

  /*

                ___________ 视口顶端
               |           |
               |--△元素---|  上边线   viewportTop
               |           |
               |___________| 下边线
               |___________|          viewportBottom
                            视口底端

*/
  // 尾巴还在范围内
  // bottom is within the viewport
  if (bounds.viewportTop <= bounds.waypointBottom &&
      bounds.waypointBottom <= bounds.viewportBottom) {
    return constants.inside;
  }

  /*

                      waypointTop 元素顶端到视口距离___________ 视口顶端
                                |                | |___________| 上边线   viewportTop
                                |                | |           |
                                |                  |   △元素  |
           waypointBottom 元素底端到视口距离       |___________| 下边线
                                                   |___________|          viewportBottom
                                                                视口底端
 */
  // 完全处于范围内
  // 上边线到视口顶端的距离 <= 元素顶端到视口顶端的距离 并且
  // 下边线到视口顶端的距离 >= 元素底端到视口顶端的距离
  // top is above the viewport and bottom is below the viewport
  if (bounds.waypointTop <= bounds.viewportTop &&
      bounds.viewportBottom <= bounds.waypointBottom) {
    return constants.inside;
  }

  // 除了以上情况，元素顶端到视口顶端距离 > 下边线 说明在底下
  if (bounds.viewportBottom < bounds.waypointTop) {
    return constants.below;
  }

  // 元素顶端到视口顶端距离 < 上边线 说明在上面
  if (bounds.waypointTop < bounds.viewportTop) {
    return constants.above;
  }

  return constants.invisible;
}
