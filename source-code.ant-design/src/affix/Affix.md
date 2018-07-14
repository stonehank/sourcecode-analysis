## Affix组件

整体：
* Affix 挂载时会在target(API)上绑定 'scroll' 'resize' 'touch系列' 'load'事件，事件的触发函数就是 this.updatePosition
* 当固定状态被触发的时候，会在原来的位置，创建一个占位元素，width和height和原来的一致，保证结构不会塌陷
* Affix 的componentWillReceiveProps 会检查到props有变化，就重新注册事件，并且调用一次this.updatePosition
* this.updatePosition这个方法通过typescript的装饰，使用了requestAnimateFrame方法
* 方法内部计算了滚动值是否会触发固定模式，从而改变 需要固定的组件dom的style 和 占位符的style

注意：
1. clientHeight指元素高度，但不包括margin和border和滚动高度，此处对window使用window.innerHeight（当前可见窗口高度）
2. getBoundingClientRect()中，top指ele顶边到文档顶边的距离,bottom指ele底边到文档顶边的距离(不计算margin)
3. clientTop,clientLeft 元素的边框宽度


```jsx
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import addEventListener from 'rc-util/lib/Dom/addEventListener';
import classNames from 'classnames';
import shallowequal from 'shallowequal';
import omit from 'omit.js';
import getScroll from '../_util/getScroll';
import { throttleByAnimationFrameDecorator } from '../_util/throttleByAnimationFrame';

function getTargetRect(target: HTMLElement | Window | null): ClientRect {
  return target !== window ?
    // 非window
    (target as HTMLElement).getBoundingClientRect() :
    // window
    { top: 0, left: 0, bottom: 0 } as ClientRect;
}

function getOffset(element: HTMLElement, target: HTMLElement | Window | null) {
  // 组件dom的Rect属性
  const elemRect = element.getBoundingClientRect();
  // 容器的Rect属性
  const targetRect = getTargetRect(target);

  // 容器的纵向滚动值
  const scrollTop = getScroll(target, true);
  // 容器的横向滚动值
  const scrollLeft = getScroll(target, false);

  // 获取body
  const docElem = window.document.body;
  // body上边框的宽度
  const clientTop = docElem.clientTop || 0;
  // body左边框的宽度
  const clientLeft = docElem.clientLeft || 0;

  /*
  * top返回了 组件dom的上顶边到 容器实际顶边（包括滚动值）的高度
  * left返回了 组件dom的左侧边到 容器实际左侧边（包括滚动值）的高度
  * width,height 分别是 组件dom 宽和高
  *
  * top: ①elemRect.top - ②targetRect.top + ③scrollTop - ④clientTop
  *
  * ____________________________________________ 文档顶边(浏览器窗口顶边)
  * |__↑_________↑_______④clientTop_________|
  *    ↑         ↑
  *    ↑         ↑
  * ...↑.........↑...........................
  * :  ②         ↑          ↑               :
  * :  ↓         ↑          ↑target         :
  * :  ↓         ①          ③滚动高度        :
  * :__↓_________↓__________↓_______________:
  * |            ↓                          |
  * |            ↓     target               |
  * |            ↓                          |
  * |            ↓                          |
  * |          __↓_______________           |
  * |         |    element       |          |
  * |         |__________________|          |
  */
  return {
    top: elemRect.top - targetRect.top +
      scrollTop - clientTop,
    left: elemRect.left - targetRect.left +
      scrollLeft - clientLeft,
    width: elemRect.width,
    height: elemRect.height,
  };
}

function noop() {}

function getDefaultTarget() {
  return typeof window !== 'undefined' ? window : null;
}

// Affix
export interface AffixProps {
  /**
   * 距离窗口顶部达到指定偏移量后触发
   */
  offsetTop?: number;
  offset?: number;
  /** 距离窗口底部达到指定偏移量后触发 */
  offsetBottom?: number;
  style?: React.CSSProperties;
  /** 固定状态改变时触发的回调函数 */
  onChange?: (affixed?: boolean) => void;
  /** 设置 Affix 需要监听其滚动事件的元素，值为一个返回对应 DOM 元素的函数 */
  target?: () => Window | HTMLElement | null;
  prefixCls?: string;
}

export interface AffixState {
  affixStyle: React.CSSProperties | undefined;
  placeholderStyle: React.CSSProperties | undefined;
}

export default class Affix extends React.Component<AffixProps, AffixState> {
  static propTypes = {
    offsetTop: PropTypes.number,
    offsetBottom: PropTypes.number,
    target: PropTypes.func,
  };

  scrollEvent: any;
  resizeEvent: any;
  timeout: any;

  events = [
    'resize',
    'scroll',
    'touchstart',
    'touchmove',
    'touchend',
    'pageshow',
    'load',
  ];

  eventHandlers: {
    [key: string]: any;
  } = {};

  state: AffixState = {
    affixStyle: undefined,
    placeholderStyle: undefined,
  };

  private fixedNode: HTMLElement;
  private placeholderNode: HTMLElement;

  // 根据情况判断是否重设 this.state.affixStyle
  setAffixStyle(e: any, affixStyle: React.CSSProperties | null) {
    // 设置onchange默认值为空函数，target默认值为getDefaultTarget
    const { onChange = noop, target = getDefaultTarget } = this.props;

    const originalAffixStyle = this.state.affixStyle;
    const isWindow = target() === window;
    // 如果是scroll事件, isWindow,  originalAffixStyle有值, affixStyle有值 ，直接返回
    // 因为scroll的时候，affixStyle属性有 position(值为fixed不变),left(scroll时不变),width(scroll时不变),top/bottom(scroll时为0)
    if (e.type === 'scroll' && originalAffixStyle && affixStyle && isWindow) {
      return;
    }
    // 如果affixStyle和原来的style相等，则不需要改变
    if (shallowequal(affixStyle, originalAffixStyle)) {
      return;
    }
    // 重设affixStyle
    // affixStyle && !originalAffixStyle （从 无固定效果 到 有固定效果）
    // !affixStyle && originalAffixStyle （从 有固定效果 到 无固定效果）
    // 以上两种情况调用onChange
    this.setState({ affixStyle: affixStyle as React.CSSProperties }, () => {
      const affixed = !!this.state.affixStyle;
      if ((affixStyle && !originalAffixStyle) ||
          (!affixStyle && originalAffixStyle)) {
        // 当前最新的是否有固定效果
        onChange(affixed);
      }
    });
  }

  // 设置占位符，元素fixed后结构不塌陷
  setPlaceholderStyle(placeholderStyle: React.CSSProperties | null) {
    const originalPlaceholderStyle = this.state.placeholderStyle;
    if (shallowequal(placeholderStyle, originalPlaceholderStyle)) {
      return;
    }
    this.setState({ placeholderStyle: placeholderStyle as React.CSSProperties });
  }
  // 重设affixStyle和placeholder的width
  syncPlaceholderStyle(e: any) {
    const { affixStyle } = this.state;
    if (!affixStyle) {
      return;
    }
    this.placeholderNode.style.cssText = '';
    this.setAffixStyle(e, {
      ...affixStyle,
      width: this.placeholderNode.offsetWidth,
    });
    this.setPlaceholderStyle({
      width: this.placeholderNode.offsetWidth,
    });
  }

  // 装饰方法
  // 返回的this.updatePosition 都是通过raf调用
  @throttleByAnimationFrameDecorator()
  updatePosition(e: any) {
    let { offsetTop, offsetBottom, offset, target = getDefaultTarget } = this.props;
    //未传target则默认为window
    const targetNode = target();

    // Backwards support
    // Fix: if offsetTop === 0, it will get undefined,
    //   if offsetBottom is type of number, offsetMode will be { top: false, ... }
    offsetTop = typeof offsetTop === 'undefined' ? offset : offsetTop;
    // 获取targetNode的滚动高度
    const scrollTop = getScroll(targetNode, true);
    // 获取组件dom
    const affixNode = ReactDOM.findDOMNode(this) as HTMLElement;
    // 返回affixNode的宽高和到targetNode的顶边和左侧边的距离
    const elemOffset = getOffset(affixNode, targetNode);
    // 获取fixedNode(dom)的宽高
    // affixNode是fixedNode的parent,fixed属性是设置在fixedNode上
    const elemSize = {
      width: this.fixedNode.offsetWidth,
      height: this.fixedNode.offsetHeight,
    };
    const offsetMode = {
      top: false,
      bottom: false,
    };
    // Default to `offsetTop=0`.
    // 此处如果offsetTop和offsetBottom未定义，则默认只有offsetTop=0的效果
    if (typeof offsetTop !== 'number' && typeof offsetBottom !== 'number') {
      offsetMode.top = true;
      offsetTop = 0;
    // 28/6/2018 添加修复bug
    }else {
      offsetMode.top = typeof offsetTop === 'number';
      offsetMode.bottom = typeof offsetBottom === 'number';
    }
    // 返回容器的Rect属性
    const targetRect = getTargetRect(targetNode);
    // 获取容器高度(包括滚动的)，clientHeight只包括padding，不包括border和margin
    const targetInnerHeight =
      (targetNode as Window).innerHeight || (targetNode as HTMLElement).clientHeight;
    //  组件DOM的顶边(不计算offsetTop)已经进入滚动区域
    if (scrollTop > elemOffset.top - (offsetTop as number) && offsetMode.top) {
      // Fixed Top
      const width = elemOffset.width;
      // top设置为容器到文档顶边的距离+offsetTop
      const top = targetRect.top + (offsetTop as number);
      // 根据情况判断是否重设 affixStyle
      this.setAffixStyle(e, {
        position: 'fixed',
        top,
        left: targetRect.left + elemOffset.left,
        width,
      });
      // 给fixed 元素 设置占位符，防止结构塌陷
      // 此处 height为实际内容的height，而不是组件dom的height
      this.setPlaceholderStyle({
        width,
        height: elemSize.height,
      });
      // 组件DOM的底边进入滚动区域
    } else if (
      scrollTop < elemOffset.top + elemSize.height + (offsetBottom as number) - targetInnerHeight &&
        offsetMode.bottom
    ) {
      // Fixed Bottom
      // 获取容器底部到文档底部的高度
      const targetBottomOffet = targetNode === window ? 0 : (window.innerHeight - targetRect.bottom);
      const width = elemOffset.width;
      // 和上面差不多，判断是否更新affixStyle
      this.setAffixStyle(e, {
        position: 'fixed',
        bottom: targetBottomOffet + (offsetBottom as number),
        left: targetRect.left + elemOffset.left,
        width,
      });
      // 判断是否设置placeholder
      this.setPlaceholderStyle({
        width,
        height: elemOffset.height,
      });
      // 组件DOM不是scroll事件或者未进入滚动区域
    } else {
      const { affixStyle } = this.state;
      // 容器处于resize的事件中
      if (e.type === 'resize' && affixStyle && affixStyle.position === 'fixed' && affixNode.offsetWidth) {
        // 调整 组件dom的宽度
        this.setAffixStyle(e, { ...affixStyle, width: affixNode.offsetWidth });
      } else {
        this.setAffixStyle(e, null);
      }
      // 取消placeholder
      this.setPlaceholderStyle(null);
    }
     // 重设affixStyle和placeholder的宽度
    if (e.type === 'resize') {
      this.syncPlaceholderStyle(e);
    }
  }

  componentDidMount() {
    const target = this.props.target || getDefaultTarget;
    // Wait for parent component ref has its value
    this.timeout = setTimeout(() => {
      //给target上的所有this.events中的事件绑定 updatePosition
      this.setTargetEventListeners(target);
    });
  }

  componentWillReceiveProps(nextProps: AffixProps) {
    // target有变化，重新注册事件，执行updatePosition更新state
    if (this.props.target !== nextProps.target) {
      this.clearEventListeners();
      this.setTargetEventListeners(nextProps.target!);

      // Mock Event object.
      this.updatePosition({});
    }
  }

  componentWillUnmount() {
    this.clearEventListeners();
    clearTimeout(this.timeout);
    (this.updatePosition as any).cancel();
  }

  setTargetEventListeners(getTarget: () => HTMLElement | Window | null) {
    // 获取父元素
    const target = getTarget();
    if (!target) {
      return;
    }
    this.clearEventListeners();

    // 给events里所有事件注册updatePosition
    // 此处的updatePosition是装饰方法返回的，会通过 requestAnimateFrame调用
    this.events.forEach(eventName => {
      this.eventHandlers[eventName] = addEventListener(target, eventName, this.updatePosition);
    });
  }

  // 解绑所有事件
  clearEventListeners() {
    this.events.forEach(eventName => {
      const handler = this.eventHandlers[eventName];
      if (handler && handler.remove) {
        handler.remove();
      }
    });
  }

  // 获取真正的fixed DOM
  saveFixedNode = (node: HTMLDivElement) => {
    this.fixedNode = node;
  }

  // 获取占位符DOM，是fixedDOM的父元素
  savePlaceholderNode = (node: HTMLDivElement) => {
    this.placeholderNode = node;
  }

  render() {
    const className = classNames({
      [this.props.prefixCls || 'ant-affix']: this.state.affixStyle,
    });
    //从this.props里删除['prefixCls', 'offsetTop', 'offsetBottom', 'target', 'onChange']这些属性
    const props = omit(this.props, ['prefixCls', 'offsetTop', 'offsetBottom', 'target', 'onChange']);
    const placeholderStyle = { ...this.state.placeholderStyle, ...this.props.style };
    return (
      <div {...props} style={placeholderStyle} ref={this.savePlaceholderNode}>
        <div className={className} ref={this.saveFixedNode} style={this.state.affixStyle}>
          {this.props.children}
        </div>
      </div>
    );
  }
}

```
