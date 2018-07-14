## AnchorLink组件


整体：
* AnchorLink 挂载时添加href到links数组中(属于Anchor组件)，links作用是遍历后计算每个href对应的dom的高度；
* 点击后会执行context的toScroll方法


```jsx
import * as React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

export interface AnchorLinkProps {
  prefixCls?: string;
  href: string;
  title: React.ReactNode;
  children?: any;
}

export default class AnchorLink extends React.Component<AnchorLinkProps, any> {
  static defaultProps = {
    prefixCls: 'ant-anchor',
    href: '#',
  };

  // 接收context（旧版react）
  static contextTypes = {
    antAnchor: PropTypes.object,
  };

  context: {
    antAnchor: any;
  };

  // 给Anchor组件里的links添加
  componentDidMount() {
    this.context.antAnchor.registerLink(this.props.href);
  }
  // 从Anchor组建立的links删除
  componentWillUnmount() {
    this.context.antAnchor.unregisterLink(this.props.href);
  }

  // 点击锚链接，动画跳转到锚点
  handleClick = () => {
    this.context.antAnchor.scrollTo(this.props.href);
  }

  render() {
    const {
      prefixCls,
      href,
      title,
      children,
    } = this.props;
    const active = this.context.antAnchor.activeLink === href;
    const wrapperClassName = classNames(`${prefixCls}-link`, {
      [`${prefixCls}-link-active`]: active,
    });
    const titleClassName = classNames(`${prefixCls}-link-title`, {
      [`${prefixCls}-link-title-active`]: active,
    });
    return (
      <div className={wrapperClassName}>
        <a
          className={titleClassName}
          href={href}
          title={typeof title === 'string' ? title : ''}
          onClick={this.handleClick}
        >
          {title}
        </a>
        {children}
      </div>
    );
  }
}


```