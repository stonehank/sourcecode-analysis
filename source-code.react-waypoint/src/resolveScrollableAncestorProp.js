export default function resolveScrollableAncestorProp(scrollableAncestor) {
  // When Waypoint is rendered on the server, `window` is not available.
  // To make Waypoint easier to work with, we allow this to be specified in
  // string form and safely convert to `window` here.
  // 当传入字符串`window`，返回server-rendering的window
  if (scrollableAncestor === 'window') {
    return global.window;
  }

  return scrollableAncestor;
}
