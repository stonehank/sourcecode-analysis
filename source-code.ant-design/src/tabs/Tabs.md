## Tabs组件

* 整体：
* Tabs组件 检查了是否支持flex，分别加上不同的className
* 并且定义了添加、删除和变更tabs的回调（具体功能逻辑需要自己写）
* 其实就是给组件添加一套自己的className或者使用```Icon```
* 实际实现逻辑都在[rc-tabs](../rc-tabs/Tabs.md)

源码：
```jsx
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import RcTabs, { TabPane } from 'rc-tabs';
import ScrollableInkTabBar from 'rc-tabs/lib/ScrollableInkTabBar';
import TabContent from 'rc-tabs/lib/TabContent';
import classNames from 'classnames';
import Icon from '../icon';
import warning from '../_util/warning';
import isFlexSupported from '../_util/isFlexSupported';

export type TabsType = 'line' | 'card' | 'editable-card';
export type TabsPosition = 'top' | 'right' | 'bottom' | 'left';

export interface TabsProps {
  activeKey?: string;
  defaultActiveKey?: string;
  hideAdd?: boolean;
  onChange?: (activeKey: string) => void;
  onTabClick?: Function;
  onPrevClick?: React.MouseEventHandler<any>;
  onNextClick?: React.MouseEventHandler<any>;
  tabBarExtraContent?: React.ReactNode | null;
  tabBarStyle?: React.CSSProperties;
  type?: TabsType;
  tabPosition?: TabsPosition;
  onEdit?: (targetKey: string | React.MouseEvent<HTMLElement>, action: any) => void;
  size?: 'large' | 'default' | 'small';
  style?: React.CSSProperties;
  prefixCls?: string;
  className?: string;
  animated?: boolean | { inkBar: boolean; tabPane: boolean; };
  tabBarGutter?: number;
}

// Tabs
export interface TabPaneProps {
  /** 选项卡头显示文字 */
  tab?: React.ReactNode | string;
  style?: React.CSSProperties;
  closable?: boolean;
  className?: string;
  disabled?: boolean;
  forceRender?: boolean;
}

/**
 * 封装了rc-tabs，简化了api
 */
export default class Tabs extends React.Component<TabsProps, any> {
  // **rc-tabs
  static TabPane = TabPane as React.ClassicComponentClass<TabPaneProps>;

  static defaultProps = {
    prefixCls: 'ant-tabs',
    hideAdd: false,
  };

  createNewTab = (targetKey: React.MouseEvent<HTMLElement>) => {
    const onEdit = this.props.onEdit;
    if (onEdit) {
      onEdit(targetKey, 'add');
    }
  }

  removeTab = (targetKey: string, e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    if (!targetKey) {
      return;
    }

    const onEdit = this.props.onEdit;
    if (onEdit) {
      onEdit(targetKey, 'remove');
    }
  }

  handleChange = (activeKey: string) => {
    const onChange = this.props.onChange;
    if (onChange) {
      onChange(activeKey);
    }
  }

  componentDidMount() {
    const NO_FLEX = ' no-flex';
    // 获取当前组件的原生DOM
    const tabNode = ReactDOM.findDOMNode(this) as Element;
    // DOM已被加载并且不支持flex，让className加上no-flex
    if (tabNode && !isFlexSupported() && tabNode.className.indexOf(NO_FLEX) === -1) {
      tabNode.className += NO_FLEX;
    }
  }

  render() {
    let {
      prefixCls,
      className = '',
      size,
      type = 'line',
      tabPosition,
      children,
      tabBarExtraContent,
      tabBarStyle,
      hideAdd,
      onTabClick,
      onPrevClick,
      onNextClick,
      animated = true,
      tabBarGutter,
    } = this.props;

    // 根据传入animated的定义inkBar和tabPane
    // inkBar就是标题栏
    // tabPaneAnimated就是内容栏
    let { inkBarAnimated, tabPaneAnimated } = typeof animated === 'object' ? {
      inkBarAnimated: animated.inkBar, tabPaneAnimated: animated.tabPane,
    } : {
      inkBarAnimated: animated, tabPaneAnimated: animated,
    };

    // card tabs should not have animation
    // 如果type不是line，动画默认为false
    if (type !== 'line') {
      tabPaneAnimated = 'animated' in this.props ? tabPaneAnimated : false;
    }

    // 参数1为false，则发出参数2
    warning(
      !(type.indexOf('card') >= 0 && (size === 'small' || size === 'large')),
      'Tabs[type=card|editable-card] doesn\'t have small or large size, it\'s by designed.',
    );


    const cls = classNames(className, {
      [`${prefixCls}-vertical`]: tabPosition === 'left' || tabPosition === 'right',
      [`${prefixCls}-${size}`]: !!size,
      [`${prefixCls}-card`]: type.indexOf('card') >= 0,
      [`${prefixCls}-${type}`]: true,
      [`${prefixCls}-no-animation`]: !tabPaneAnimated,
    });


    // only card type tabs can be added and closed
    let childrenWithClose: React.ReactElement<any>[] = [];
    //只有是type editable-card
    if (type === 'editable-card') {
      childrenWithClose = [];
      // 遍历children
      React.Children.forEach(children as React.ReactNode, (child: React.ReactElement<any>, index) => {
        // closable 默认为true
        let closable = child.props.closable;
        closable = typeof closable === 'undefined' ? true : closable;
        // 添加closeIcon
        const closeIcon = closable ? (
           <Icon
             type="close"
             onClick={e => this.removeTab(child.key as string, e)}
           />
        ) : null;
        // 通过clone方法给每个不需要closable的child添加 className
        // 参数1：element 参数2：props 参数3：children（这里没有）
        // 放进数组 最后会
        childrenWithClose.push(React.cloneElement(child, {
          tab: (
            <div className={closable ? undefined : `${prefixCls}-tab-unclosable`}>
              {child.props.tab}
              {closeIcon}
            </div>
          ),
          key: child.key || index,
        }));
      });
      // Add new tab handler

      /*
      * 如果未隐藏add
      * div
      *   span
      *     icon
      *     extra
      *
      * 如果隐藏add
      * div
      *   extra
      *
      * */
      if (!hideAdd) {
        tabBarExtraContent = (
          <span>
            <Icon type="plus" className={`${prefixCls}-new-tab`} onClick={this.createNewTab} />
            {tabBarExtraContent}
          </span>
        );
      }
    }
    tabBarExtraContent = tabBarExtraContent ? (
      <div className={`${prefixCls}-extra-content`}>
        {tabBarExtraContent}
      </div>
    ) : null;


    const renderTabBar = () => (

      <ScrollableInkTabBar
        inkBarAnimated={inkBarAnimated}
        // 右上角附加内容
        extraContent={tabBarExtraContent}
        onTabClick={onTabClick}
        onPrevClick={onPrevClick}
        onNextClick={onNextClick}
        style={tabBarStyle}
        tabBarGutter={tabBarGutter}
      />
    );

    /*
    * 在RcTabs内部
    * 0、初始化键盘left(up)、right(down)
    * 1、用1个div包裹
    * 2、下面注释的①和②为兄弟元素
    * 3、其中children的tab属性被①用作tab标题，children的内容被②用作tab内容
    * 4、渲染出来格式为：
    *   div
    *     ScrollableInkTabBar
    *     TabContent
    * */
    return (
      <RcTabs
        {...this.props}
        className={cls}
        tabBarPosition={tabPosition}
        //① ScrollableInkTabBar
        renderTabBar={renderTabBar}
        //② TabContent
        renderTabContent={() => <TabContent animated={tabPaneAnimated} animatedWithMargin />}
        onChange={this.handleChange}
      >

        {childrenWithClose.length > 0 ? childrenWithClose : children}
      </RcTabs>
    );
  }
}

```