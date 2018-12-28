import React from 'react';

export const errorMessage =
  '<Waypoint> expected to receive a single React element child.\n\n' +
  'See https://goo.gl/LrBNgw for more info.';

/**
 * Raise an error if more that one child was provided to "children"
 *
 * @param {?React.element} children
 * @return {undefined}
 */
export default function ensureChildrenIsValid(children) {
  // 确保
  // children存在
  // 只存在1个children，不是text
  if (children) {
    try {
      React.Children.only(children);
    } catch (e) {
      throw new Error(errorMessage);
    }
  }
}
