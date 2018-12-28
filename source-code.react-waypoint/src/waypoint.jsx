import { addEventListener } from 'consolidated-events';
import PropTypes from 'prop-types';
import React from 'react';
import { isForwardRef } from 'react-is';

import computeOffsetPixels from './computeOffsetPixels';
import constants from './constants';
import debugLog from './debugLog';
import ensureChildrenIsValid from './ensureChildrenIsValid';
import ensureRefIsUsedByChild from './ensureRefIsUsedByChild';
import isDOMElement from './isDOMElement';
import getCurrentPosition from './getCurrentPosition';
import onNextTick from './onNextTick';
import resolveScrollableAncestorProp from './resolveScrollableAncestorProp';

const defaultProps = {
  topOffset: '0px',
  bottomOffset: '0px',
  horizontal: false,
  onEnter() { },
  onLeave() { },
  onPositionChange() { },
  fireOnRapidScroll: true,
};

// React.PureComponent was added in React 15.3.0
const BaseClass = typeof React.PureComponent !== 'undefined' ?
  React.PureComponent :
  React.Component;

// Calls a function when you scroll to the element.
export default class Waypoint extends BaseClass {
  constructor(props) {
    super(props);

    this.refElement = (e) => this._ref = e;
  }

  componentWillMount() {
    // 确认只有1个children，不可以是text
    ensureChildrenIsValid(this.props.children);
  }

  componentDidMount() {
    // 在window环境下
    if (!Waypoint.getWindow()) {
      return;
    }

    // this._ref may occasionally not be set at this time. To help ensure that
    // this works smoothly and to avoid layout thrashing, we want to delay the
    // initial execution until the next tick.
    // onNextTick的作用是将任务放入任务队列，保证任务执行不冲突
    this.cancelOnNextTick = onNextTick(() => {
      this.cancelOnNextTick = null;

      // Berofe doing anything, we want to check that this._ref is avaliable in Waypoint
      // 确认ref有效(除非children是React组件，并且ref获取不到值)
      ensureRefIsUsedByChild(this.props.children, this._ref);

      this._handleScroll = this._handleScroll.bind(this);
      // 找父级元素，用户自定或者通过判断 overflow 属性查找
      this.scrollableAncestor = this._findScrollableAncestor();

      // 开启log
      if (process.env.NODE_ENV !== 'production' && this.props.debug) {
        debugLog('scrollableAncestor', this.scrollableAncestor);
      }
      // 绑定scroll
      // passive 让浏览器滑动时 不去检测 preventDefault，更加顺滑
      this.scrollEventListenerUnsubscribe = addEventListener(
        this.scrollableAncestor,
        'scroll',
        this._handleScroll,
        { passive: true }
      );

      this.resizeEventListenerUnsubscribe = addEventListener(
        window,
        'resize',
        this._handleScroll,
        { passive: true }
      );

      this._handleScroll(null);
    });
  }

  componentWillReceiveProps(newProps) {
    // 检测children
    ensureChildrenIsValid(newProps.children);
  }

  componentDidUpdate() {
    if (!Waypoint.getWindow()) {
      return;
    }

    if (!this.scrollableAncestor) {
      // The Waypoint has not yet initialized.
      return;
    }

    // The element may have moved, so we need to recompute its position on the
    // page. This happens via handleScroll in a way that forces layout to be
    // computed.
    //
    // We want this to be deferred to avoid forcing layout during render, which
    // causes layout thrashing. And, if we already have this work enqueued, we
    // can just wait for that to happen instead of enqueueing again.
    // 每次更新完毕，原来的元素都有可能不存在，因此需要重新计算数据
    if (this.cancelOnNextTick) {
      return;
    }

    this.cancelOnNextTick = onNextTick(() => {
      this.cancelOnNextTick = null;
      this._handleScroll(null);
    });
  }

  componentWillUnmount() {
    if (!Waypoint.getWindow()) {
      return;
    }
    // 解绑
    if (this.scrollEventListenerUnsubscribe) {
      this.scrollEventListenerUnsubscribe();
    }
    if (this.resizeEventListenerUnsubscribe) {
      this.resizeEventListenerUnsubscribe();
    }

    if (this.cancelOnNextTick) {
      this.cancelOnNextTick();
    }
  }

  /**
   * Traverses up the DOM to find an ancestor container which has an overflow
   * style that allows for scrolling.
   *
   * @return {Object} the closest ancestor element with an overflow style that
   *   allows for scrolling. If none is found, the `window` object is returned
   *   as a fallback.
   */
  _findScrollableAncestor() {
    const {
      horizontal,
      scrollableAncestor,
    } = this.props;

    // 存在指定的父级元素，直接返回
    if (scrollableAncestor) {
      return resolveScrollableAncestorProp(scrollableAncestor);
    }

    let node = this._ref;

    // 未指定，开始沿父级遍历查找
    // 查找style中包含overflow的
    while (node.parentNode) {
      node = node.parentNode;

      // 最终返回window
      if (node === document.body) {
        // We've reached all the way to the root node.
        return window;
      }

      const style = window.getComputedStyle(node);
      // 根据是否定义方向，判断style
      const overflowDirec = horizontal ?
        style.getPropertyValue('overflow-x') :
        style.getPropertyValue('overflow-y');
      // 未设定方向，直接查找overflow
      const overflow = overflowDirec || style.getPropertyValue('overflow');

      if (overflow === 'auto' || overflow === 'scroll') {
        return node;
      }
    }

    // A scrollable ancestor element was not found, which means that we need to
    // do stuff on window.
    return window;
  }

  /**
   * @param {Object} event the native scroll event coming from the scrollable
   *   ancestor, or resize event coming from the window. Will be undefined if
   *   called by a React lifecyle method
   */
  // 这里的event 可能是scroll的ev，resize的ev，甚至是undefined，因为是在生命周期函数内调用
  _handleScroll(event) {
    // ref不存在直接退出
    if (!this._ref) {
      // There's a chance we end up here after the component has been unmounted.
      return;
    }

    // 计算出
    // waypoint：元素的上下边到视口边的距离
    // viewpoint：用户自定义的上下边界
    const bounds = this._getBounds();
    // 根据上面的数据判断当前元素所在位置
    const currentPosition = getCurrentPosition(bounds);
    // 获取上一次的位置
    const previousPosition = this._previousPosition;

    if (process.env.NODE_ENV !== 'production' && this.props.debug) {
      debugLog('currentPosition', currentPosition);
      debugLog('previousPosition', previousPosition);
    }

    // Save previous position as early as possible to prevent cycles
    this._previousPosition = currentPosition;

    // 相同的位置关系，无变化，返回
    if (previousPosition === currentPosition) {
      // No change since last trigger
      return;
    }

    // 将刚才所得的数据和位置作为参数
    const callbackArg = {
      currentPosition,
      previousPosition,
      event,
      waypointTop: bounds.waypointTop,
      waypointBottom: bounds.waypointBottom,
      viewportTop: bounds.viewportTop,
      viewportBottom: bounds.viewportBottom,
    };
    // 执行钩子函数
    this.props.onPositionChange.call(this, callbackArg);

    // 当前位置是 inside （原来不是inside）
    if (currentPosition === constants.inside) {
      this.props.onEnter.call(this, callbackArg);
      // 原来是inside，当前不是inside
    } else if (previousPosition === constants.inside) {
      this.props.onLeave.call(this, callbackArg);
    }

    // 判断是否急速滑动 （上一次below，下一次above）
    const isRapidScrollDown = previousPosition === constants.below &&
      currentPosition === constants.above;
    const isRapidScrollUp = previousPosition === constants.above &&
      currentPosition === constants.below;

    if (this.props.fireOnRapidScroll && (isRapidScrollDown || isRapidScrollUp)) {
      // If the scroll event isn't fired often enough to occur while the
      // waypoint was visible, we trigger both callbacks anyway.
      // 存在急速滑动的情况，enter和leave都要执行一次
      this.props.onEnter.call(this, {
        currentPosition: constants.inside,
        previousPosition,
        event,
        waypointTop: bounds.waypointTop,
        waypointBottom: bounds.waypointBottom,
        viewportTop: bounds.viewportTop,
        viewportBottom: bounds.viewportBottom,
      });
      this.props.onLeave.call(this, {
        currentPosition,
        previousPosition: constants.inside,
        event,
        waypointTop: bounds.waypointTop,
        waypointBottom: bounds.waypointBottom,
        viewportTop: bounds.viewportTop,
        viewportBottom: bounds.viewportBottom,
      });
    }
  }

  _getBounds() {
    const horizontal = this.props.horizontal;
    const { left, top, right, bottom } = this._ref.getBoundingClientRect();
    // 元素顶端/左边 到 视口顶端/左边的距离
    const waypointTop = horizontal ? left : top;
    // 元素底端/右边 到 视口顶端/左边的距离
    const waypointBottom = horizontal ? right : bottom;

    let contextHeight;
    let contextScrollTop;
    if (this.scrollableAncestor === window) {
      // 父元素是window，通过inner计算
      contextHeight = horizontal ? window.innerWidth : window.innerHeight;
      contextScrollTop = 0;
    } else {
      contextHeight = horizontal ? this.scrollableAncestor.offsetWidth :
        this.scrollableAncestor.offsetHeight;
      // 纵向：父元素顶端到视口顶端的高度
      // todo
      contextScrollTop = horizontal ?
        this.scrollableAncestor.getBoundingClientRect().left :
        this.scrollableAncestor.getBoundingClientRect().top;
    }

    if (process.env.NODE_ENV !== 'production' && this.props.debug) {
      debugLog('waypoint top', waypointTop);
      debugLog('waypoint bottom', waypointBottom);
      debugLog('scrollableAncestor height', contextHeight);
      debugLog('scrollableAncestor scrollTop', contextScrollTop);
    }

    const { bottomOffset, topOffset } = this.props;
    // 处理用户输入offset（字符串，百分比）
    const topOffsetPx = computeOffsetPixels(topOffset, contextHeight);
    const bottomOffsetPx = computeOffsetPixels(bottomOffset, contextHeight);
    const contextBottom = contextScrollTop + contextHeight;

    return {
      waypointTop,
      waypointBottom,
      viewportTop: contextScrollTop + topOffsetPx,
      viewportBottom: contextBottom - bottomOffsetPx,
    };
  }

  /**
   * @return {Object}
   */
  render() {
    const { children } = this.props;

    if (!children) {
      // We need an element that we can locate in the DOM to determine where it is
      // rendered relative to the top of its context.
      // 如果未提供children或者children未正确获取，默认使用span
      return <span ref={this.refElement} style={{ fontSize: 0 }} />;
    }

    // children是DOM 或者 children是ForwardRef
    if (isDOMElement(children) || isForwardRef(children.type)) {
      const ref = (node) => {
        // 通过ForwardRef获取到实际的DOM
        this.refElement(node);
        // 如果children组件需要获取当前的ref
        if (children.ref) {
          if (typeof children.ref === 'function') {
            children.ref(node);
          } else {
            children.ref.current = node;
          }
        }
      };

      // 通过cloneElement改变children组件的属性
      return React.cloneElement(children, { ref });
    }

    return React.cloneElement(children, { innerRef: this.refElement });
  }
}

Waypoint.propTypes = {
  children: PropTypes.node,
  debug: PropTypes.bool,
  onEnter: PropTypes.func,
  onLeave: PropTypes.func,
  onPositionChange: PropTypes.func,
  fireOnRapidScroll: PropTypes.bool,
  scrollableAncestor: PropTypes.any,
  horizontal: PropTypes.bool,

  // `topOffset` can either be a number, in which case its a distance from the
  // top of the container in pixels, or a string value. Valid string values are
  // of the form "20px", which is parsed as pixels, or "20%", which is parsed
  // as a percentage of the height of the containing element.
  // For instance, if you pass "-20%", and the containing element is 100px tall,
  // then the waypoint will be triggered when it has been scrolled 20px beyond
  // the top of the containing element.
  topOffset: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
  ]),

  // `bottomOffset` is like `topOffset`, but for the bottom of the container.
  bottomOffset: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
  ]),
};

Waypoint.above = constants.above;
Waypoint.below = constants.below;
Waypoint.inside = constants.inside;
Waypoint.invisible = constants.invisible;
// 判断是否window
Waypoint.getWindow = () => {
  if (typeof window !== 'undefined') {
    return window;
  }
};
Waypoint.defaultProps = defaultProps;
Waypoint.displayName = 'Waypoint';
