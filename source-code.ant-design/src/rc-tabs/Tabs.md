## rc-tabs

整体：
* 定义了activeKey（当前激活）的更新和默认设置，并且定义了键盘上下左右键控制activeKey的逻辑
* 作为公共父组件，保存了当前tabs组件的最新activeKey
* children分别传进renderTabBar（作用是渲染tabs菜单）和renderTabContent（作用是渲染tabs内容）处理
* 渲染出来格式为：
    ```
    div
      renderTabBar
      renderTabContent
    ```
源码：


```jsx
import React from 'react';
import PropTypes from 'prop-types';
import KeyCode from './KeyCode';
import TabPane from './TabPane';
import classnames from 'classnames';
import { getDataAttr } from './utils';

function noop() {
}

// 如果child可用并且activeKey不存在，定义第一个非disabled的child为默认activeKey
function getDefaultActiveKey(props) {
  let activeKey;
  React.Children.forEach(props.children, (child) => {
    if (child && !activeKey && !child.props.disabled) {
      activeKey = child.key;
    }
  });
  return activeKey;
}

// 存在child和child.key返回true
function activeKeyIsValid(props, key) {
  const keys = React.Children.map(props.children, child => child && child.key);
  return keys.indexOf(key) >= 0;
}

export default class Tabs extends React.Component {
  constructor(props) {
    super(props);

    // 如果未定义activeKey，则使用getDefaultActiveKey定义
    let activeKey;
    if ('activeKey' in props) {
      activeKey = props.activeKey;
    } else if ('defaultActiveKey' in props) {
      activeKey = props.defaultActiveKey;
    } else {
      activeKey = getDefaultActiveKey(props);
    }

    this.state = {
      activeKey,
    };
  }

  componentWillReceiveProps(nextProps) {
    // 更新activeKey
    if ('activeKey' in nextProps) {
      this.setState({
        activeKey: nextProps.activeKey,
      });
      // nextPorps没有activeKey会自动获取默认activeKey
    } else if (!activeKeyIsValid(nextProps, this.state.activeKey)) {
      // https://github.com/ant-design/ant-design/issues/7093
      this.setState({
        activeKey: getDefaultActiveKey(nextProps),
      });
    }
  }

  // 点击tabs，执行回调，并且设定activeKey
  onTabClick = (activeKey) => {
    if (this.tabBar.props.onTabClick) {
      this.tabBar.props.onTabClick(activeKey);
    }
    // 更新activeKey
    this.setActiveKey(activeKey);
  }

  onNavKeyDown = (e) => {
    const eventKeyCode = e.keyCode;
    // 键盘右键或者下键
    if (eventKeyCode === KeyCode.RIGHT || eventKeyCode === KeyCode.DOWN) {
      e.preventDefault();
      // 获取按下键盘后的新的activeKey
      const nextKey = this.getNextActiveKey(true);
      // 执行更新和回调
      this.onTabClick(nextKey);
      // 键盘左键或者上键
    } else if (eventKeyCode === KeyCode.LEFT || eventKeyCode === KeyCode.UP) {
      e.preventDefault();
      const previousKey = this.getNextActiveKey(false);
      this.onTabClick(previousKey);
    }
  }
  // 更新activeKey
  setActiveKey = (activeKey) => {
    if (this.state.activeKey !== activeKey) {
      if (!('activeKey' in this.props)) {
        this.setState({
          activeKey,
        });
      }
      this.props.onChange(activeKey);
    }
  }

  // 定义了键盘按下的逻辑
  getNextActiveKey = (next) => {
    const activeKey = this.state.activeKey;
    // 通过保存child的顺序的不同，可以实现i+1 为向右或者向左移动（不需要另外配置i-1）
    // next为push
    // prev为unshift
    const children = [];
    React.Children.forEach(this.props.children, (c) => {
      if (c && !c.props.disabled) {
        if (next) {
          children.push(c);
        } else {
          children.unshift(c);
        }
      }
    });
    const length = children.length;
    let ret = length && children[0].key;
    children.forEach((child, i) => {
      // 找到当前activeKey（即变化之前的）
      if (child.key === activeKey) {
        // 如果是最后一个tab
        if (i === length - 1) {
          // 转回第一个tab
          ret = children[0].key;
        } else {
          // 继续下一个tab
          ret = children[i + 1].key;
        }
      }
    });
    return ret;
  }

  render() {
    const props = this.props;
    const {
      prefixCls,
      tabBarPosition, className,
      renderTabContent,
      renderTabBar,
      destroyInactiveTabPane,
      ...restProps,
    } = props;
    const cls = classnames({
      [prefixCls]: 1,
      [`${prefixCls}-${tabBarPosition}`]: 1,
      [className]: !!className,
    });
    // 外部穿的渲染bar的组件
    this.tabBar = renderTabBar();
    const contents = [
      // 传递定义的键盘和click方法和当前activeKey
      React.cloneElement(this.tabBar, {
        prefixCls,
        key: 'tabBar',
        onKeyDown: this.onNavKeyDown,
        tabBarPosition,
        onTabClick: this.onTabClick,
        panels: props.children,
        activeKey: this.state.activeKey,
      }),
      // 传递当前activeKey和更新activeKey的方法
      React.cloneElement(renderTabContent(), {
        prefixCls,
        tabBarPosition,
        activeKey: this.state.activeKey,
        destroyInactiveTabPane,
        children: props.children,
        onChange: this.setActiveKey,
        key: 'tabContent',
      }),
    ];
    if (tabBarPosition === 'bottom') {
      contents.reverse();
    }
    return (
      <div
        className={cls}
        style={props.style}
        {...getDataAttr(restProps)}
      >
        {contents}
      </div>
    );
  }
}

Tabs.propTypes = {
  destroyInactiveTabPane: PropTypes.bool,
  renderTabBar: PropTypes.func.isRequired,
  renderTabContent: PropTypes.func.isRequired,
  onChange: PropTypes.func,
  children: PropTypes.any,
  prefixCls: PropTypes.string,
  className: PropTypes.string,
  tabBarPosition: PropTypes.string,
  style: PropTypes.object,
  activeKey: PropTypes.string,
  defaultActiveKey: PropTypes.string,
};

Tabs.defaultProps = {
  prefixCls: 'rc-tabs',
  destroyInactiveTabPane: false,
  onChange: noop,
  tabBarPosition: 'top',
  style: {},
};

Tabs.TabPane = TabPane;

```