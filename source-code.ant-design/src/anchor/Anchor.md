## Anchor组件

 * 整体：
 * Anchor 挂载后会绑定handleScroll事件，事件作用是根据高度更新activeLink，当activeLink更新后，会触发componentDidUpdate，
   会执行updateInk方法，作用是根据activeClass 来更新anchor菜单的墨水指示条的位置，
   概况一下：根据当前滚动高度更新activeLink和更新墨水条
 * 当点击```AnchorLink```的元素，通过context调用此处的scrollTo方法，scrollTo计算需要滚动的高度，使用requestAnimateFrame方法，
   和easeInOutCubic缓动函数

 * 注意：
 1. anchor 计算的是target到container的距离，因此需要确定好container
 2. 动画是通过raf，更加流畅
 3. 在HTML里，element.ownerDocument始终是document
 4. clientTop:元素顶部只是边框宽度
 5. window.pageXOffset:只读属性，文档（x|y）方向滚动属性，比scrollTop性能更高
 6. window.scrollTo(x,y):文档左上角滚动到x,y的位置
 

```jsx
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import addEventListener from 'rc-util/lib/Dom/addEventListener';
import Affix from '../affix';
import AnchorLink from './AnchorLink';
import getScroll from '../_util/getScroll';
import raf from 'raf';

function getDefaultContainer() {
  return window;
}

// 这里计算的element顶部（不计算margin）到container的顶边（不计算margin和border）
function getOffsetTop(element: HTMLElement, container: AnchorContainer): number {
  if (!element) {
    return 0;
  }

  if (!element.getClientRects().length) {
    return 0;
  }


  const rect = element.getBoundingClientRect();

  // 元素有宽高（可见）
  if (rect.width || rect.height) {
    if (container === window) {
      // 在HTML里，element.ownerDocument始终是document
      container = element.ownerDocument.documentElement;
      // 计算element顶部到容器顶部的距离（getBoundingClientRect不计算margin，计算padding和border）
      // document.documentElement.clientTop ===>document的顶部边框宽度
      return rect.top - container.clientTop;
    }
    // element到当前文档顶部的距离-容器到当前文档顶部的距离=element到容器的距离
    return rect.top - (container as HTMLElement).getBoundingClientRect().top;
  }

  return rect.top;
}

function easeInOutCubic(t: number, b: number, c: number, d: number) {
  const cc = c - b;
  t /= d / 2;
  if (t < 1) {
    return cc / 2 * t * t * t + b;
  }
  return cc / 2 * ((t -= 2) * t * t + 2) + b;
}

// 匹配 hash值
const sharpMatcherRegx = /#([^#]+)$/;


function scrollTo(href: string, offsetTop = 0, getContainer: () => AnchorContainer, callback = () => { }) {
  //获取容器
  const container = getContainer();
  // 获取当前容器滚动的距离
  const scrollTop = getScroll(container, true);
  // 匹配link的hash值
  const sharpLinkMatch = sharpMatcherRegx.exec(href);
  if (!sharpLinkMatch) { return; }

  const targetElement = document.getElementById(sharpLinkMatch[1]);
  if (!targetElement) {
    return;
  }
  // 获取target到container(顶边)的距离
  const eleOffsetTop = getOffsetTop(targetElement, container);
  // target到文档顶边的距离
  const targetScrollTop = scrollTop + eleOffsetTop - offsetTop;
  const startTime = Date.now();
  const frameFunc = () => {
    const timestamp = Date.now();
    const time = timestamp - startTime;
    // easeInOutCubic 参数 已消耗的时间、原始位置、目标位置、持续的总时间
    // 返回应该处在的位置
    const nextScrollTop = easeInOutCubic(time, scrollTop, targetScrollTop, 450);
    if (container === window) {
      // window下使用scrollTo
      window.scrollTo(window.pageXOffset, nextScrollTop);
    } else {
      // 非window下使用scrollTop
      (container as HTMLElement).scrollTop = nextScrollTop;
    }
    // time从0开始，直到超过450后(说明动画已经到达目标位置)停止调用
    if (time < 450) {
      raf(frameFunc);
    } else {
      // 动画结束后 回调
      callback();
    }
  };
  // requestAnimateFrame 每一帧执行动画(更流畅)，浏览器进入后台会暂停
  raf(frameFunc);
  // url中添加"#xxx"
  history.pushState(null, '', href);
}

type Section = {
  link: String;
  top: number;
};

export type AnchorContainer =  HTMLElement | Window;

export interface AnchorProps {
  prefixCls?: string;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  offsetTop?: number;
  bounds?: number;
  affix?: boolean;
  showInkInFixed?: boolean;
  getContainer?: () => AnchorContainer;
}

export interface AnchorDefaultProps extends AnchorProps {
  prefixCls: string;
  affix: boolean;
  showInkInFixed: boolean;
  getContainer: () => AnchorContainer;
}

export default class Anchor extends React.Component<AnchorProps, any> {
  static Link: typeof AnchorLink;

  static defaultProps = {
    prefixCls: 'ant-anchor',
    affix: true,
    showInkInFixed: false,
    // 指定滚动的容器，默认是window
    getContainer: getDefaultContainer,
  };

  // 定义context（旧版react）
  static childContextTypes = {
    antAnchor: PropTypes.object,
  };

  private inkNode: HTMLSpanElement;

  private links: String[];
  private scrollEvent: any;
  private animating: boolean;

  constructor(props: AnchorProps) {
    super(props);
    this.state = {
      activeLink: null,
    };
    this.links = [];
  }

  //定义context具体内容（旧版react）
  getChildContext() {
    return {
      antAnchor: {
        //添加到links
        registerLink: (link: String) => {
          if (!this.links.includes(link)) {
            this.links.push(link);
          }
        },
        //从links去除
        unregisterLink: (link: String) => {
          const index = this.links.indexOf(link);
          if (index !== -1) {
            this.links.splice(index, 1);
          }
        },
        //当前激活link
        activeLink: this.state.activeLink,
        scrollTo: this.handleScrollTo,
      },
    };
  }

  componentDidMount() {
    const { getContainer } = this.props as AnchorDefaultProps;
    this.scrollEvent = addEventListener(getContainer(), 'scroll', this.handleScroll);
    // 设置 activeLink
    this.handleScroll();
  }

  componentWillUnmount() {
    if (this.scrollEvent) {
      this.scrollEvent.remove();
    }
  }

  componentDidUpdate() {
    //更新锚链接指示器的位置
    this.updateInk();
  }

  // 设置 activeLink
  handleScroll = () => {
    // 正在scroll 退出
    if (this.animating) {
      return;
    }
    const { offsetTop, bounds } = this.props;
    // activeLink 设置为匹配当前高度(offsetTop+bounds)的link
    this.setState({
      activeLink: this.getCurrentAnchor(offsetTop, bounds),
    });
  }

  handleScrollTo = (link: string) => {
    const { offsetTop, getContainer } = this.props as AnchorDefaultProps;
    this.animating = true;
    this.setState({ activeLink: link });
    scrollTo(link, offsetTop, getContainer, () => {
      this.animating = false;
    });
  }

  // 获取当前高度(offsetTop+bounds)匹配的link
  getCurrentAnchor(offsetTop = 0, bounds = 5) {
    let activeLink = '';
    if (typeof document === 'undefined') {
      return activeLink;
    }

    const linkSections: Array<Section> = [];
    const { getContainer } = this.props as AnchorDefaultProps;
    // 获取当前容器
    const container = getContainer();
    // links内容就是href组成的数组
    this.links.forEach(link => {
      // 匹配link的hash值
      const sharpLinkMatch = sharpMatcherRegx.exec(link.toString());
      if (!sharpLinkMatch) { return; }
      // 获取id为hash值的元素
      const target = document.getElementById(sharpLinkMatch[1]);
      if (target) {
        // 获取距离容器高度
        const top = getOffsetTop(target, container);
        if (top < offsetTop + bounds) {
          linkSections.push({
            link,
            top,
          });
        }
      }
    });

    // 因为 linkSections 获取的是所有小于给定值(参数offsetTop+bound)的集合
    // 因此要获取最后一项，就是当前高度对应的link或者说是当前高度最接近的link
    if (linkSections.length) {
      const maxSection = linkSections.reduce((prev, curr) => curr.top > prev.top ? curr : prev);
      return maxSection.link;
    }
    return '';
  }

  // 根据当前className中active的变化更新inkNode(墨水指示器)的位置
  updateInk = () => {
    if (typeof document === 'undefined') {
      return;
    }
    const { prefixCls } = this.props;
    //获取 当前组件里面的原生dom
    const anchorNode = ReactDOM.findDOMNode(this) as Element;
    // 获取当前activelink的linkTitle的dom（是锚点链接(锚点菜单)的dom）
    const linkNode = anchorNode.getElementsByClassName(`${prefixCls}-link-title-active`)[0];
    // 调整ink位置
    if (linkNode) {
      this.inkNode.style.top = `${(linkNode as any).offsetTop + linkNode.clientHeight / 2 - 4.5}px`;
    }
  }

  saveInkNode = (node: HTMLSpanElement) => {
    this.inkNode = node;
  }

  render() {
    const {
      prefixCls,
      className = '',
      style,
      offsetTop,
      affix,
      showInkInFixed,
      children,
    } = this.props;
    const { activeLink } = this.state;
    // 当前active的className
    const inkClass = classNames(`${prefixCls}-ink-ball`, {
      visible: activeLink,
    });


    const wrapperClass = classNames(className, `${prefixCls}-wrapper`);

    // 未设置fixed模式(!affix)并且未配置fixed模式下的ink 就添加fixed的className
    const anchorClass = classNames(prefixCls, {
      'fixed': !affix && !showInkInFixed,
    });


    const wrapperStyle = {
      maxHeight: offsetTop ? `calc(100vh - ${offsetTop}px)` : '100vh',
      ...style,
    };

    const anchorContent = (
      <div
        className={wrapperClass}
        style={wrapperStyle}
      >
        <div className={anchorClass}>
          <div className={`${prefixCls}-ink`} >
            <span className={inkClass} ref={this.saveInkNode} />
          </div>
          {children}
        </div>
      </div>
    );


    return !affix ?
      // 非fixed
      anchorContent :
      // fixed
      // 使用affix组件
      (<Affix offsetTop={offsetTop}>
        {anchorContent}
      </Affix>
    );
  }
}

```