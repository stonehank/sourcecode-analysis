import React, { Component } from 'react';
import PropTypes from 'prop-types';

export default class InfiniteScroll extends Component {
  static propTypes = {
    children: PropTypes.node.isRequired,
    element: PropTypes.node,
    hasMore: PropTypes.bool,
    initialLoad: PropTypes.bool,
    isReverse: PropTypes.bool,
    loader: PropTypes.node,
    loadMore: PropTypes.func.isRequired,
    pageStart: PropTypes.number,
    ref: PropTypes.func,
    getScrollParent: PropTypes.func,
    threshold: PropTypes.number,
    useCapture: PropTypes.bool,
    useWindow: PropTypes.bool,
  };

  static defaultProps = {
    element: 'div',
    hasMore: false,
    initialLoad: true,
    pageStart: 0,
    ref: null,
    threshold: 250,
    useWindow: true,
    isReverse: false,
    useCapture: false,
    loader: null,
    getScrollParent: null,
  };

  constructor(props) {
    super(props);

    this.scrollListener = this.scrollListener.bind(this);
  }

  componentDidMount() {
    this.pageLoaded = this.props.pageStart;
    // 绑定事件，每当到达 threshold 则取消绑定
    this.attachScrollListener();
  }

  componentDidUpdate() {
    // 绑定事件，每当到达 threshold 则取消绑定
    this.attachScrollListener();
  }

  componentWillUnmount() {
    this.detachScrollListener();
    this.detachMousewheelListener();
  }

  // Set a defaut loader for all your `InfiniteScroll` components
  setDefaultLoader(loader) {
    this.defaultLoader = loader;
  }

  detachMousewheelListener() {
    let scrollEl = window;
    if (this.props.useWindow === false) {
      scrollEl = this.scrollComponent.parentNode;
    }

    scrollEl.removeEventListener(
      'mousewheel',
      this.mousewheelListener,
      this.props.useCapture,
    );
  }

  // 卸载事件
  detachScrollListener() {
    let scrollEl = window;
    if (this.props.useWindow === false) {
      scrollEl = this.getParentElement(this.scrollComponent);
    }

    scrollEl.removeEventListener(
      'scroll',
      this.scrollListener,
      this.props.useCapture,
    );
    scrollEl.removeEventListener(
      'resize',
      this.scrollListener,
      this.props.useCapture,
    );
  }

  // 获取默认/自定义父组件
  // 此处传入的el是滚动组件
  getParentElement(el) {
    // 存在用户传入parentNode
    const scrollParent =
      this.props.getScrollParent && this.props.getScrollParent();
    if (scrollParent != null) {
      return scrollParent;
    }
    // 无用户定义则默认为el的父组件
    return el && el.parentNode;
  }

  filterProps(props) {
    return props;
  }

  attachScrollListener() {
    // this.scrollComponent是滚动组件
    const parentElement = this.getParentElement(this.scrollComponent);

    // 没有更多 或者 没有父元素
    if (!this.props.hasMore || !parentElement) {
      // 直接返回
      return;
    }
    // 在window上绑定事件
    let scrollEl = window;
    // 在父元素上绑定事件
    if (this.props.useWindow === false) {
      scrollEl = parentElement;
    }
    // mousewheel事件
    scrollEl.addEventListener(
      'mousewheel',
      this.mousewheelListener,
      this.props.useCapture,
    );
    // scroll事件
    scrollEl.addEventListener(
      'scroll',
      this.scrollListener,
      this.props.useCapture,
    );
    scrollEl.addEventListener(
      'resize',
      this.scrollListener,
      this.props.useCapture,
    );

    if (this.props.initialLoad) {
      this.scrollListener();
    }
  }

  mousewheelListener(e) {
    // 问题指的是chrome的悬挂问题，当页面中存在无限滚动并且执行ajax，执行到最后一个的时候会出现等待很长的时间，但拖动滚动条正常
    // 解决办法就是如下，当e.deltaY ===1的时候 preventDefault()
    // todo 个人尝试，deltaY都是100或-100 ？
    // Prevents Chrome hangups
    // See: https://stackoverflow.com/questions/47524205/random-high-content-download-time-in-chrome/47684257#47684257
    if (e.deltaY === 1) {
      e.preventDefault();
    }
  }

  scrollListener() {
    const el = this.scrollComponent;
    const scrollEl = window;
    const parentNode = this.getParentElement(el);

    let offset;
    // 使用window的情况
    if (this.props.useWindow) {
      const doc = document.documentElement || document.body.parentNode || document.body;
      const scrollTop = scrollEl.pageYOffset !== undefined
        // pageYOffset 只读属性，但只能用在window上
          ? scrollEl.pageYOffset
          : doc.scrollTop;
      // isReverse指 滚动到顶端，load新组件
      if (this.props.isReverse) {
        // 相反模式获取到顶端距离
        offset = scrollTop;
      } else {
        // 正常模式则获取到底端距离
        offset = this.calculateOffset(el, scrollTop);
      }
      // 不使用window的情况
    } else if (this.props.isReverse) {
      // 相反模式组件到顶端的距离
      offset = parentNode.scrollTop;
    } else {
      // 滚动组件的实际高度 - 已经滚动的高度 - 父组件的高度(可以理解为父组件为视口) === 到底端还剩下的高度
      // 正常模式组件到底端的距离
      offset = el.scrollHeight - parentNode.scrollTop - parentNode.clientHeight;
    }

    // Here we make sure the element is visible as well as checking the offset
    /*
     offsetParent 为 null 的几种情况:
     1. ele 为 body
     2. ele 的 position 为 fixed
     3. ele 的 display 为 none
    */
    // 此处应该要判断后2种情况，确保滚动组件正常显示
    if (
      offset < Number(this.props.threshold) &&
      (el && el.offsetParent !== null)
    ) {
      // 卸载事件
      this.detachScrollListener();
      // Call loadMore after detachScrollListener to allow for non-async loadMore functions
      // 执行 loadMore
      if (typeof this.props.loadMore === 'function') {
        this.props.loadMore((this.pageLoaded += 1));
      }
    }
  }

  // el指的是滚动组件
  calculateOffset(el, scrollTop) {
    if (!el) {
      return 0;
    }

    return (
      // 到页面顶端的top + 滚动组件的高度(很高) - 已经滚动的高度 - 视口高度 === 到滚动组件最底端还剩下的高度
      this.calculateTopPosition(el) +
      (el.offsetHeight - scrollTop - window.innerHeight)
    );
  }

  // 递归调用 计算定位父元素的top
  calculateTopPosition(el) {
    if (!el) {
      return 0;
    }
    return el.offsetTop + this.calculateTopPosition(el.offsetParent);
  }

  render() {
    const renderProps = this.filterProps(this.props);
    const {
      children,
      element,
      hasMore,
      initialLoad,
      isReverse,
      loader,
      loadMore,
      pageStart,
      ref,
      threshold,
      useCapture,
      useWindow,
      getScrollParent,
      ...props
    } = renderProps;

    // 定义一个ref并且执行父组件传来的ref(如果有)
    // 能传递 这个div滚动组件 出去
    props.ref = node => {
      this.scrollComponent = node;
      if (ref) {
        ref(node);
      }
    };

    const childrenArray = [children];
    if (hasMore) {
      if (loader) {
        isReverse ? childrenArray.unshift(loader) : childrenArray.push(loader);
      } else if (this.defaultLoader) {
        isReverse
          ? childrenArray.unshift(this.defaultLoader)
          : childrenArray.push(this.defaultLoader);
      }
    }
    // ref 传递给 'div'元素
    return React.createElement(element, props, childrenArray);
  }
}
