### ScrollableInkTabBar


整体：
* 此处使用了mixins继承了其他组件的方法
* 不展开每个mixin组件，只说明此处每个方法的作用
* 主要处理了以下事情：
    1. 配置了tab-nav的标题（children的tab属性）
    2. 定义了每个tab-nav的active,disabled,绑定了传递的event
    3. 渲染了墨水条，指示当前active（如果是editable-card），如果设置墨水条不显示，但也加载DOM
    4. 渲染左右按钮，如果tab很少，左右按钮不显示，但同样会加载DOM
    5. 渲染tabs,定义tabPosition（tab-nav的方向）
    6. 定义多层div，自定义传递prefix

* 最终返回格式大概为(后面为className)
```
   div .prefix-bar
    extraContent（如果有)
    div .prefix-nav-container
    span .prefix-tab-prev [prefix-tab-btn-disabled] [prefix-tab-arrow-show]
    span .prefix-tab-next
    div .prefix-nav-wrap
      div .prefix-nav-scroll
        div .prefix-nav .prefix-nav-animated
        inkBarNode
        tabs
```

源码：

```jsx

import createReactClass from 'create-react-class';
import InkTabBarMixin from './InkTabBarMixin';
import ScrollableTabBarMixin from './ScrollableTabBarMixin';
import TabBarMixin from './TabBarMixin';
import RefMixin from './RefMixin';

const ScrollableInkTabBar = createReactClass({
  displayName: 'ScrollableInkTabBar',
  mixins: [RefMixin, TabBarMixin, InkTabBarMixin, ScrollableTabBarMixin],
  render() {
    /*
    * 创建墨水条（activeTab的指示器）如下
    * ___________________
    * |tab1  tab2  tab3 |
    * |¯¯¯¯             |
    * |当前是tab1       |
    * |_________________|
    * */
    const inkBarNode = this.getInkBarNode();
    // 返回一个div，里面有菜单的标题内容
    const tabs = this.getTabs();
    {/* 创建了可滚动的菜单，定义了很多className
        * 大概如下格式
        * div .prefix-nav-container
        *   span .prefix-nav-prev
        *   span .prefix-nav-next
        *   div .prefix-nav-wrap
        *     div .prefix-nav-scroll
        *       div .prefix-nav
        *       参数[0]：inkBarNode
        *       参数[1]：tabs
    */}
    const scrollbarNode = this.getScrollBarNode([inkBarNode, tabs]);
    /*
    * 结合以上的组件，并且会从props判断是否有extraContent
    *
    * 有extraContent（右上角附加内容）
    *  div .prefix-bar role->tablist
    *   extraContent
    *   div .prefix-nav-container 也就是scrollbarNode
    *     ...
    *
    * 没有extraContent
    *  div .prefix-bar role->tablist
    *   div .prefix-nav-container
    *     ...
    *
    * */
    return this.getRootNode(scrollbarNode);
  },
});

export default ScrollableInkTabBar;

```