`react-infinite-scroller`就是一个组件，主要逻辑就是`addEventListener`绑定`scroll`事件。

看它的源码主要意义不在知道如何使用它，而是知道以后处理`滚动加载`要注意的东西。

> 此处跳到[总结](#总结)。

## 初识

参数：
```
// 渲染出来的DOM元素name
element: 'div',
// 是否能继续滚动渲染
hasMore: false,
// 是否在订阅事件的时候执行事件
initialLoad: true,
// 表示当前翻页的值(每渲染一次递增)
pageStart: 0,
// 传递ref，返回此组件渲染的 DOM
ref: null,
// 触发渲染的距离
threshold: 250,
// 是否在window上绑定和处理距离
useWindow: true,
// 是否反向滚动，即到顶端后渲染
isReverse: false,
// 是否使用捕获模式
useCapture: false,
// 渲染前的loading组件
loader: null,
// 自定义滚动组件的父元素
getScrollParent: null,
```

-----

## 深入

### componentDidMount
```js
componentDidMount() {
  this.pageLoaded = this.props.pageStart;
  this.attachScrollListener();
}
```

执行`attachScrollListener`

-----

### attachScrollListener

```js
attachScrollListener() {
  const parentElement = this.getParentElement(this.scrollComponent);
  
  if (!this.props.hasMore || !parentElement) {
    return;
  }

  let scrollEl = window;
  if (this.props.useWindow === false) {
    scrollEl = parentElement;
  }
  scrollEl.addEventListener(
    'mousewheel',
    this.mousewheelListener,
    this.props.useCapture,
  );
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
```

此处通过`getParentElement`获取父组件(用户自定义父组件或者当前dom的parentNode)

然后绑定了3个事件，分别是`scroll`,`resize`,`mousewheel`

前2种都绑定`scrollListener`，`mousewheel`是一个非标准事件，是不建议在生产模式中使用的。

那么这里为什么要使用呢？

-----

### mousewheel解决chrome的等待bug

此处的`mousewheel`事件是为了处理`chrome`浏览器的一个特性(不知道是否是一种bug)。

[stackoverflow:Chrome的滚动等待问题](https://stackoverflow.com/questions/47524205/random-high-content-download-time-in-chrome/47684257#47684257)

上面这个问题主要描述，当在使用滚轮加载时，而且加载会触发`ajax请求`，当滚轮到达底部，会出现一个漫长而且无任何动作的等待(长达2-3s)。

```js
window.addEventListener("mousewheel", (e) => {
    if (e.deltaY === 1) {
        e.preventDefault()
    }
})
```
以上绑定可以消除这个"bug"。

> 个人并没有遇到过这种情况，不知道是否有遇到过可以说说解决方案。

-----

### getParentElement

```js
getParentElement(el) {
  const scrollParent =
    this.props.getScrollParent && this.props.getScrollParent();
  if (scrollParent != null) {
    return scrollParent;
  }
  return el && el.parentNode;
}
```

上面用到了`getParentElement`，很好理解，使用用户自定义的父组件，或者当前组件`DOM.parentNode`。

-----

### scrollListener

```js
scrollListener() {
  const el = this.scrollComponent;
  const scrollEl = window;
  const parentNode = this.getParentElement(el);

  let offset;
  // 使用window的情况
  if (this.props.useWindow) {
    const doc = document.documentElement || document.body.parentNode || document.body;
    const scrollTop = scrollEl.pageYOffset !== undefined
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
    // 正常模式组件到底端的距离
    offset = el.scrollHeight - parentNode.scrollTop - parentNode.clientHeight;
  }

  // 此处应该要判断确保滚动组件正常显示
  if (
    offset < Number(this.props.threshold) &&
    (el && el.offsetParent !== null)
  ) {
    // 卸载事件
    this.detachScrollListener();
    // 卸载事件后再执行 loadMore
    if (typeof this.props.loadMore === 'function') {
      this.props.loadMore((this.pageLoaded += 1));
    }
  }
}
```

组件核心。

### 几个学习/复习点

1. `offsetParent`

    `offsetParent`返回一个指向最近的包含该元素的定位元素.
    
    `offsetParent`很有用，因为计算`offsetTop`和`offsetLeft`都是相对于`offsetParent`边界的。
    
    `offsetParent`为 null 的几种情况:
    
    * ele 为 body
    * ele 的 position 为 fixed
    * ele 的 display 为 none
    
    此组件中`offsetParent`处理了2种情况
    
    1. 在`useWindow`的情况下(即事件绑定在window，滚动作用在body)
    
        通过递归获取`offsetParent`到达顶端的高度(`offsetTop`)。
        
        ```js
       calculateTopPosition(el) {
         if (!el) {
           return 0;   
         }
         return el.offsetTop + this.calculateTopPosition(el.offsetParent);   
        }
        ```
    2. 通过判断`offsetParent`不为null的情况，确保滚动组件正常显示
    
    ```js
      if (
        offset < Number(this.props.threshold) &&
        (el && el.offsetParent !== null)
      ) {/* ... */ }
    ```

2. `scrollHeight`和`clientHeight`

    在无滚动的情况下，`scrollHeight`和`clientHeight`相等，都为`height`+`padding`*2
    
    在有滚动的情况下，`scrollHeight`表示实际内容高度，`clientHeight`表示视口高度。

3. 每次执行`loadMore`前卸载事件。

    确保不会重复(过多)执行`loadMore`，因为先卸载事件再执行`loadMore`，可以确保在执行过程中，`scroll`事件是无效的，然后再每次`componentDidUpdate`的时候重新绑定事件。

### render

```js
render() {
  // 获取porps
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

  // 定义一个ref
  // 能将当前组件的DOM传出去
  props.ref = node => {
    this.scrollComponent = node;
    // 执行父组件传来的ref(如果有)
    if (ref) {
      ref(node);
    }
  };

  const childrenArray = [children];
  // 执行loader
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
```

这里一个小亮点就是，在`react`中，`this.props`是不允许修改的。

这里使用了解构
```
getScrollParent,
...props
} = renderProps;
```

这里解构相当于`Object.assign`，定义了一个新的`object`，便可以添加属性了，并且`this.props`不会受到影响。

## 总结

`react-infinite-scroller`逻辑比较简单。

一些注意/学习/复习点：

* `Chrome`的一个滚动加载请求的bug。[本文位置](#mousewheel解决chrome的等待bug)

* `offsetParent`的一些实际用法。[本文位置](#几个学习/复习点)

* 通过不断订阅和取消事件绑定让滚动执行函数不会频繁触发。[本文位置](#几个学习/复习点)

* `scrollHeight`和`clientHeight`区别。[本文位置](#几个学习/复习点)

此库建议使用在自定义的一些组件上并且不那么复杂的逻辑上。

用在第三方库可以会无法获取正确的父组件，而通过`document.getElementBy..`传入。

面对稍微复杂的逻辑，

例如，一个搜索组件，订阅`onChange`事件显示内容，搜索"a"，呈现内容，滚动加载了3次，再添加搜索词"b"，这时候"ab"的内容呈现是在3次之后。
