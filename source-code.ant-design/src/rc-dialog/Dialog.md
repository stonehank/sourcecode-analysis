## rc-dialog

整体：

Dialog组件主要做了以下事情：
* 配置了键盘事件（包括esc，tab，shifit+tab)
* 配置了mask-wrap（能通过visible参数自动添加hidden的className)
* 配置了鼠标点击按钮打开dialog的位置，这个位置是执行dialog窗口由小变大动画的origin值
* 配置了自定义滚动条的位置（获取了滚动条的宽度），原因如下：
    当body需要滚动，而且dialog窗口也需要滚动时，隐藏body的滚动，只存在dialog窗口的滚动 todo 此处可能有bug 具体见bug
* 保存了打开dialog窗口之前的焦点，关闭时恢复焦点

 注意：
1. document.activeElement 获取当前焦点的元素
2. e.target 和 e.currentTarget 区别
3. document.defaultView 与 window区别


```tsx
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import KeyCode from 'rc-util/lib/KeyCode';
import Animate from 'rc-animate';
import LazyRenderBox from './LazyRenderBox';
import getScrollBarSize from 'rc-util/lib/getScrollBarSize';
import IDialogPropTypes from './IDialogPropTypes';


// title的id递增值(确保id不同)
let uuid = 0;
// 判断是否添加和删除自定义滚动条
let openCount = 0;

/* eslint react/no-is-mounted:0 */

// 获取文档的滚动值
function getScroll(w: any, top?: boolean) {
  // 获取window.pageYOffset或者window.pageXOffset
  // 分别为文档 上滚动和左滚动的距离(只读属性)
  let ret = w[`page${top ? 'Y' : 'X'}Offset`];
  const method = `scroll${top ? 'Top' : 'Left'}`;
  // 兼容写法1
  if (typeof ret !== 'number') {
    // 使用document.documentElement.scrollTop|scrollLeft 获取
    const d = w.document;
    ret = d.documentElement[method];
    // 兼容写法2
    if (typeof ret !== 'number') {
      // 使用document.body.scrollTop|scrollLeft
      ret = d.body[method];
    }
  }
  return ret;
}
// 设定 transform-origin 为鼠标点击位置
function setTransformOrigin(node: any, value: string) {
  const style = node.style;
  ['Webkit', 'Moz', 'Ms', 'ms'].forEach((prefix: string) => {
    style[`${prefix}TransformOrigin`] = value;
  });
  style[`transformOrigin`] = value;
}

// 获取参数el的left和top
function offset(el: any) {
  const rect = el.getBoundingClientRect();
  const pos = {
    left: rect.left,
    top: rect.top,
  };
  // document
  const doc = el.ownerDocument;
  // 当使用Firefox 3.6时，frame中需要使用document.defaultView去获取window对象
  // https://www.cnblogs.com/yuan-shuai/p/4125511.html
  // doc.defaultView兼容IE9以上，doc.parentWindow 兼容低版本IE
  const w = doc.defaultView || doc.parentWindow;
  // 获取文档的左滚动值
  pos.left += getScroll(w);
  // 获取文档的上滚动值
  pos.top += getScroll(w, true);
  return pos;
}

export default class Dialog extends React.Component<IDialogPropTypes, any> {
  static defaultProps = {
    className: '',
    mask: true,
    visible: false,
    keyboard: true,
    closable: true,
    maskClosable: true,
    destroyOnClose: false,
    prefixCls: 'rc-dialog',
  };

  private inTransition: boolean;
  private titleId: string;
  private openTime: number;
  private lastOutSideFocusNode: HTMLElement | null;
  private wrap: HTMLElement;
  private dialog: any;
  private sentinel: HTMLElement;
  private bodyIsOverflowing: boolean;
  private scrollbarWidth: number;

  componentWillMount() {
    // 检测是否动画中 默认为false
    this.inTransition = false;
    // 设置titleId
    this.titleId = `rcDialogTitle${uuid++}`;
  }
  componentDidMount() {
    this.componentDidUpdate({});
  }
  componentDidUpdate(prevProps: IDialogPropTypes) {
    const props = this.props;
    const mousePosition = this.props.mousePosition;
    // 如果可见
    if (props.visible) {
      // first show
      // 状态是从不可见变为可见
      if (!prevProps.visible) {
        // 保存当前时间
        this.openTime = Date.now();
        // 保存不可见时的焦点元素，当从可见变为不可见时，即可还原焦点
        this.lastOutSideFocusNode = document.activeElement as HTMLElement;
        // 将默认滚动条去掉，添加新的滚动条区域
        // todo bug 不断按enter和esc，openCount会不断增加,因为此处未判断是否在动画中，而unmount中有判断
        this.addScrollingEffect();
        // this.wrap 就是render中className为${prefixCls}-wrap 的div的引用
        // 让wrap获取焦点(方便键盘事件）
        this.wrap.focus();
        // 获取底下 LazyRenderBox 组件的原生dom
        const dialogNode = ReactDOM.findDOMNode(this.dialog);
        if (mousePosition) {
          // 获取 dialogNode 的left和top(含滚动值)
          const elOffset = offset(dialogNode);
          // 设定 transform-origin为参数2的位置（此处作用，让dialog动画是从鼠标点击的位置慢慢放大）
          // 参数2指 `鼠标点击位置到dialogNode左边的距离 鼠标点击位置到dialogNode右边的距离`
          setTransformOrigin(dialogNode,
            `${mousePosition.x - elOffset.left}px ${mousePosition.y - elOffset.top}px`);
        } else {
          setTransformOrigin(dialogNode, '');
        }
      }
      // 由可见变为不可见
    } else if (prevProps.visible) {
      // 动画flag为true
      this.inTransition = true;
      // 如果有遮罩(说明焦点被转移到遮罩上) 和 有保存的焦点元素
      if (props.mask && this.lastOutSideFocusNode) {
        // 尝试还原焦点，最后将this.lastOutSideFocusNode设为null
        try {
          this.lastOutSideFocusNode.focus();
        } catch (e) {
          this.lastOutSideFocusNode = null;
        }
        this.lastOutSideFocusNode = null;
      }
    }
  }


  componentWillUnmount() {
    // 还原默认滚动条
    if (this.props.visible || this.inTransition) {
      this.removeScrollingEffect();
    }
  }
  onAnimateLeave = () => {
    const { afterClose } = this.props;
    // need demo?
    // https://github.com/react-component/dialog/pull/28
    if (this.wrap) {
      this.wrap.style.display = 'none';
    }
    this.inTransition = false;
    this.removeScrollingEffect();
    if (afterClose) {
      afterClose();
    }
  }
  // 点击到mask事件判断
  onMaskClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // android trigger click on open (fastclick??)
    // 阻止点击穿透
    if (Date.now() - this.openTime < 300) {
      return;
    }
    // 点击的元素(e.target)和触发事件的元素(e.currentTarget)一致(即鼠标点到遮罩层上)
    if (e.target === e.currentTarget) {
      // 触发onClose事件
      this.close(e);
    }
  }
  // 添加键盘事件
  onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const props = this.props;
    if (props.keyboard && e.keyCode === KeyCode.ESC) {
      // 支持键盘 并且 按键为esc, 调用onClose
      this.close(e);
    }
    // keep focus inside dialog
    // 当前是可见的
    if (props.visible) {
      // 按下TAB时
      if (e.keyCode === KeyCode.TAB) {
        // 保存当前焦点元素
        const activeElement = document.activeElement;

        const dialogRoot = this.wrap;
        // 是否有按住shift键
        // this.sentinel 为 dialogElement底下的一个div（width:0,height:0，不可见）
        // todo 此处 sentinel 和 dialogRoot 互相换焦点作用？？
        if (e.shiftKey) {
          if (activeElement === dialogRoot) {
            this.sentinel.focus();
          }
        } else if (activeElement === this.sentinel) {
          dialogRoot.focus();
        }
      }
    }
  }
  // 获取主体元素
  getDialogElement = () => {
    const props = this.props;
    const closable = props.closable;
    const prefixCls = props.prefixCls;
    const dest: any = {};
    if (props.width !== undefined) {
      dest.width = props.width;
    }
    if (props.height !== undefined) {
      dest.height = props.height;
    }

    let footer;
    // footer是div添加class
    if (props.footer) {
      footer = (
        <div className={`${prefixCls}-footer`} ref={this.saveRef('footer')}>
          {props.footer}
        </div>
      );
    }

    // header 只放了title 关闭按钮不在header
    let header;
    if (props.title) {
      header = (
        <div className={`${prefixCls}-header`} ref={this.saveRef('header')}>
          <div className={`${prefixCls}-title`} id={this.titleId}>
            {props.title}
          </div>
        </div>
      );
    }
    // 关闭按钮
    let closer;
    if (closable) {
      closer = (
        <button
          onClick={this.close}
          aria-label="Close"
          className={`${prefixCls}-close`}
        >
          <span className={`${prefixCls}-close-x`} />
        </button>);
    }

    const style = { ... props.style, ...dest };
    // 获取dialog自定义的动画 className
    const transitionName = this.getTransitionName();
    const dialogElement = (
      <LazyRenderBox
        key="dialog-element"
        role="document"
        ref={this.saveRef('dialog')}
        style={style}
        className={`${prefixCls} ${props.className || ''}`}
        visible={props.visible}
      >
        <div className={`${prefixCls}-content`}>
          {closer}
          {header}
          {/*子元素，主体内容*/}
          <div
            className={`${prefixCls}-body`}
            style={props.bodyStyle}
            ref={this.saveRef('body')}
            {...props.bodyProps}
          >
            {props.children}
          </div>
          {footer}
        </div>
        <div tabIndex={0} ref={this.saveRef('sentinel')} style={{ width: 0, height: 0, overflow: 'hidden' }}>
          sentinel
        </div>
      </LazyRenderBox>
    );
    return (
      <Animate
        key="dialog"
        showProp="visible"
        onLeave={this.onAnimateLeave}
        transitionName={transitionName}
        // 设定animate组件的wrap，此处不需要wrap 因为child组件只有1个
        component=""
        transitionAppear
      >
        {/* children为可见的 或者 关闭后不需要销毁的(即使不可见，也会使用之前的dialogElement，
        如果关闭需要销毁，就一定会是null，之前dialogElement里的数据就消失)*/}
        {(props.visible || !props.destroyOnClose) ? dialogElement : null}
      </Animate>
    );
  }
  // 获取设定的z-index，无则返回{}
  getZIndexStyle = () => {
    const style: any = {};
    const props = this.props;
    if (props.zIndex !== undefined) {
      style.zIndex = props.zIndex;
    }
    return style;
  }
  // 配置wrap的style
  getWrapStyle = () : any => {
    return { ...this.getZIndexStyle(), ...this.props.wrapStyle };
  }
  getMaskStyle = () => {
    return { ...this.getZIndexStyle(), ...this.props.maskStyle };
  }
  // 获取一个mask组件(antd中是一个div(如果mask为true，能根据visible变更className是否带有hidden))
  getMaskElement = () => {
    const props = this.props;
    let maskElement;
    // mask存在(有遮罩)
    if (props.mask) {
      // 获取mask的动画的自定义className，未定义则返回undefined
      const maskTransition = this.getMaskTransitionName();
      //
      maskElement = (
        // 一个div，根据visible来判断是否需要添加hidden的className
        <LazyRenderBox
          style={this.getMaskStyle()}
          key="mask"
          // prefixCls 默认为rc-dialog
          className={`${props.prefixCls}-mask`}
          //
          hiddenClassName={`${props.prefixCls}-mask-hidden`}
          visible={props.visible}
          {...props.maskProps}
        />
      );
      // antd无此项
      if (maskTransition) {
        maskElement = (
          <Animate
            key="mask"
            showProp="visible"
            transitionAppear
            component=""
            transitionName={maskTransition}
          >
            {maskElement}
          </Animate>
        );
      }
    }
    return maskElement;
  }
  // 获取mask的动画className，未定义则返回undefined
  getMaskTransitionName = () => {
    const props = this.props;
    // 自定义的 mask 动画className（antd不会用到）
    let transitionName = props.maskTransitionName;
    // 自定义的一部分mask 动画className（不需要写前缀）
    const animation = props.maskAnimation;
    // 只有 animation 存在的时候
    if (!transitionName && animation) {
      // 自动添加前缀
      transitionName = `${props.prefixCls}-${animation}`;
    }
    return transitionName;
  }
  // 获取dialog自定义的动画 className
  getTransitionName = () => {
    const props = this.props;
    let transitionName = props.transitionName;
    const animation = props.animation;
    if (!transitionName && animation) {
      transitionName = `${props.prefixCls}-${animation}`;
    }
    return transitionName;
  }
  setScrollbar = () => {
      // body 高度超出窗口 并且 scrollbarWidth有值
    if (this.bodyIsOverflowing && this.scrollbarWidth !== undefined) {
        // 单独设定一块滚动条区域
      document.body.style.paddingRight = `${this.scrollbarWidth}px`;
    }
  }

   // 将默认滚动条去掉，添加新的滚动条区域
  addScrollingEffect = () => {
    openCount++;
    // 只有openCount为0时有效（多次打开同一个dialog则会返回）
    if (openCount !== 1) {
      return;
    }
    // openCount为0
    // 如果高超出窗口 计算出默认滚动条宽度 赋值给 this.scrollbarWidth
    this.checkScrollbar();
    // 单独给body 右侧设置一块新的滚动条区域
    this.setScrollbar();
    // 把默认的滚动条去掉
    document.body.style.overflow = 'hidden';
    // this.adjustDialog();
  }
  // 还原默认滚动条
  removeScrollingEffect = () => {
    openCount--;
    if (openCount !== 0) {
      return;
    }
    document.body.style.overflow = '';
    this.resetScrollbar();
    // this.resetAdjustments();
  }
  // 调用onClose
  close = (e: any) => {
    const { onClose } = this.props;
    if (onClose) {
      onClose(e);
    }
  }
  checkScrollbar = () => {
      // 获取窗口宽度
    let fullWindowWidth = window.innerWidth;
    // IE8兼容模式
    if (!fullWindowWidth) { // workaround for missing window.innerWidth in IE8
      const documentElementRect = document.documentElement.getBoundingClientRect();
      fullWindowWidth = documentElementRect.right - Math.abs(documentElementRect.left);
    }
    // body是否超出窗口(按变量意思，此处按1理解)
    // 1、body高度超出窗口触发滚动条，因此宽度比  fullWindowWidth 小
    // 2、body的宽度本身就比 fullWindowWidth 小
    this.bodyIsOverflowing = document.body.clientWidth < fullWindowWidth;
    // body超出窗口
    if (this.bodyIsOverflowing) {
        // 获取默认滚动条宽度
      this.scrollbarWidth = getScrollBarSize();
    }
  }
  // 取消自定义滚动条区域
  resetScrollbar = () => {
    document.body.style.paddingRight = '';
  }

  adjustDialog = () => {
    if (this.wrap && this.scrollbarWidth !== undefined) {
      const modalIsOverflowing =
        this.wrap.scrollHeight > document.documentElement.clientHeight;
      this.wrap.style.paddingLeft =
        `${!this.bodyIsOverflowing && modalIsOverflowing ? this.scrollbarWidth : ''}px`;
      this.wrap.style.paddingRight =
        `${this.bodyIsOverflowing && !modalIsOverflowing ? this.scrollbarWidth : ''}px`;
    }
  }
  resetAdjustments = () => {
    if (this.wrap) {
      this.wrap.style.paddingLeft = this.wrap.style.paddingLeft = '';
    }
  }

  saveRef = (name: string) => (node: any) => {
    (this as any)[name] = node;
  }

  render() {
    const { props } = this;
    const { prefixCls, maskClosable } = props;
    const style = this.getWrapStyle();
    // clear hide display
    // and only set display after async anim, not here for hide
    // 如果可见 清除display（恢复默认display），不可见不在这里隐藏而是等动画结束后再隐藏
    if (props.visible) {
      style.display = null;
    }
    return (
      <div>
        {/* 获取一个mask组件(antd中是一个div(如果mask为true，能根据visible变更className是否带有hidden))*/}
        {this.getMaskElement()}
        <div
          tabIndex={-1}
          // 添加键盘事件
          onKeyDown={this.onKeyDown}
          className={`${prefixCls}-wrap ${props.wrapClassName || ''}`}
          // 此处保存了wrap
          ref={this.saveRef('wrap')}
          // 点击到mask事件判断
          onClick={maskClosable ? this.onMaskClick : undefined}
          role="dialog"
          aria-labelledby={props.title ? this.titleId : null}
          style={style}
          {...props.wrapProps}
        >
          {this.getDialogElement()}
        </div>
      </div>
    );
  }
}

```