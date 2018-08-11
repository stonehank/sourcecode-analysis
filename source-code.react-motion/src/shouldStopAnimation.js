/* @flow */
import type {PlainStyle, Style, Velocity} from './Types';

// usage assumption: currentStyle values have already been rendered but it says
// nothing of whether currentStyle is stale (see unreadPropStyle)

// 停止动画的条件：
// 1. 速度为0
// 2. 目标为当前位置
export default function shouldStopAnimation(
  currentStyle: PlainStyle,
  style: Style,
  currentVelocity: Velocity,
): boolean {
  for (let key in style) {
    // 原型链的属性跳过
    if (!Object.prototype.hasOwnProperty.call(style, key)) {
      continue;
    }
    if (currentVelocity[key] !== 0) {
      return false;
    }

    const styleValue = typeof style[key] === 'number'
      ? style[key]
      : style[key].val;
    // stepper will have already taken care of rounding precision errors, so
    // won't have such thing as 0.9999 !=== 1
    if (currentStyle[key] !== styleValue) {
      return false;
    }
  }

  return true;
}
