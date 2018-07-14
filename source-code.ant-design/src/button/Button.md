## Button组件


 整体：
* Button组件 
* 主要是通过改变state状态，从而渲染时应用不同className来改变外观
* 检查是否只有2个中文字符，例如 "提交"， 检查到则会变更state中的属性，
再次渲染时就会变为 "提 交"
* componentWillReceiveProps中会检查是否需要loading状态
* 渲染的dom中绑定了click，通过setTimeout方法延迟执行click动画

注意：
1. 学习使用classNames和omit
2. React.cloneElement的使用
3. 使用React.children与使用this.props.children的比较，前者更准确
4. 每次render通过改变className来改变外观和动画

```jsx

import * as React from 'react';
import { findDOMNode } from 'react-dom';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import omit from 'omit.js';
import Icon from '../icon';
import Group from './button-group';

//2个中文字符
const rxTwoCNChar = /^[\u4e00-\u9fa5]{2}$/;
const isTwoCNChar = rxTwoCNChar.test.bind(rxTwoCNChar);
function isString(str: any) {
  return typeof str === 'string';
}

// Insert one space between two chinese characters automatically.

function insertSpace(child: React.ReactChild, needInserted: boolean) {
  // Check the child if is undefined or null.
  if (child == null) {
    return;
  }
  const SPACE = needInserted ? ' ' : '';
  // strictNullChecks oops.
  // child是react的组件并且组件的子元素只有2个中文字符
  // 如果是<span>点击</span>,child是一个obj，里面type为"span"
  if (typeof child !== 'string' && typeof child !== 'number' &&
    isString(child.type) && isTwoCNChar(child.props.children)) {
    // 克隆组件(element,[props],[...children])
    // 也可以写成
    // <child.type {...child.props}>{child.props.children.split('').join(SPACE)}</child.type>
    return React.cloneElement(child, {},
      child.props.children.split('').join(SPACE));
  }
  // child是字符串
  if (typeof child === 'string') {
    // child只有2个中文字符
    if (isTwoCNChar(child)) {
      child = child.split('').join(SPACE);
    }
    return <span>{child}</span>;
  }
  return child;
}

export type ButtonType = 'default' | 'primary' | 'ghost' | 'dashed' | 'danger';
export type ButtonShape = 'circle' | 'circle-outline';
export type ButtonSize = 'small' | 'default' | 'large';

export interface BaseButtonProps {
  type?: ButtonType;
  htmlType?: string;
  icon?: string;
  shape?: ButtonShape;
  size?: ButtonSize;
  loading?: boolean | { delay?: number };
  prefixCls?: string;
  className?: string;
  ghost?: boolean;
}

export type AnchorButtonProps = BaseButtonProps & React.AnchorHTMLAttributes<HTMLAnchorElement>;

export type NativeButtonProps = BaseButtonProps & React.ButtonHTMLAttributes<HTMLButtonElement>;

export type ButtonProps = AnchorButtonProps | NativeButtonProps;

export default class Button extends React.Component<ButtonProps, any> {
  static Group: typeof Group;
  static __ANT_BUTTON = true;

  static defaultProps = {
    prefixCls: 'ant-btn',
    loading: false,
    ghost: false,
  };

  static propTypes = {
    type: PropTypes.string,
    shape: PropTypes.oneOf(['circle', 'circle-outline']),
    size: PropTypes.oneOf(['large', 'default', 'small']),
    htmlType: PropTypes.oneOf(['submit', 'button', 'reset']),
    onClick: PropTypes.func,
    loading: PropTypes.oneOfType([PropTypes.bool, PropTypes.object]),
    className: PropTypes.string,
    icon: PropTypes.string,
  };

  timeout: number;
  delayTimeout: number;

  constructor(props: ButtonProps) {
    super(props);
    this.state = {
      loading: props.loading,
      clicked: false,
      hasTwoCNChar: false,
    };
  }

  //每次创建时
  componentDidMount() {
    //判断子元素是否只有2个字符，并且更改state
    this.fixTwoCNChar();
  }

  //每次prop改变
  componentWillReceiveProps(nextProps: ButtonProps) {
    const currentLoading = this.props.loading;
    const loading = nextProps.loading;

    //如果传了loading
    if (currentLoading) {
      //先清空之前loading的计时器
      clearTimeout(this.delayTimeout);
    }
    //loading不为布尔值，并且存在delay属性（自定义loadidng延迟）
    if (typeof loading !== 'boolean' && loading && loading.delay) {
      this.delayTimeout = window.setTimeout(() => this.setState({ loading }), loading.delay);
    } else {
      //未自定义loading延迟
      this.setState({ loading });
    }
  }

  //每次更新render后，检查是否2中文字符
  componentDidUpdate() {
    this.fixTwoCNChar();
  }

  componentWillUnmount() {
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
    if (this.delayTimeout) {
      clearTimeout(this.delayTimeout);
    }
  }

  //判断子元素是否只有2个字符，并且将判断结果给state.hasTwoCNChar
  fixTwoCNChar() {
    // Fix for HOC usage like <FormatMessage />
    //返回已经装在的DOM（这里可能是<a>或者<button>)
    const node = (findDOMNode(this) as HTMLElement);
    //返回button上的值（例如：点击）
    const buttonText = node.textContent || node.innerText;
    //只有1个子元素，并且这个子元素是2个中文字符
    if (this.isNeedInserted() && isTwoCNChar(buttonText)) {
      //将state的hasTowCNChar改变为true
      if (!this.state.hasTwoCNChar) {
        this.setState({
          hasTwoCNChar: true,
        });
      }
    } else if (this.state.hasTwoCNChar) {
      //如果不符合条件，并且hasTowCNChar为true（说明这个组件之前是2个中文字，后来update就不是了），变为false
      this.setState({
        hasTwoCNChar: false,
      });
    }
  }

  /**
   * 每次click都通过改变state.clicked来变更class，从而改变视觉效果
   */
  handleClick = (e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => {
    // Add click effect
    this.setState({ clicked: true });
    clearTimeout(this.timeout);
    this.timeout = window.setTimeout(() => this.setState({ clicked: false }), 500);

    const onClick = this.props.onClick;
    //onClick存在，执行
    if (onClick) {
      (onClick as (e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => void)(e);
    }
  }

  //只有1个子元素并且没有icon
  isNeedInserted() {
    const { icon, children } = this.props;
    return React.Children.count(children) === 1 && !icon;
  }

  render() {
    const {
      type, shape, size, className, htmlType, children, icon, prefixCls, ghost, ...others,
    } = this.props;


    const { loading, clicked, hasTwoCNChar } = this.state;

    // large => lg
    // small => sm
    let sizeCls = '';
    switch (size) {
      case 'large':
        sizeCls = 'lg';
        break;
      case 'small':
        sizeCls = 'sm';
      default:
        break;
    }

    const ComponentProp = (others as AnchorButtonProps).href ? 'a' : 'button';

    //classNames 可以将以下class变为"xx1 xx2 xx3..."的格式
    //其中值为true，key成立，值为false，key不合并
    const classes = classNames(prefixCls, className, {
      [`${prefixCls}-${type}`]: type,
      [`${prefixCls}-${shape}`]: shape,
      [`${prefixCls}-${sizeCls}`]: sizeCls,
      [`${prefixCls}-icon-only`]: !children && icon,
      [`${prefixCls}-loading`]: loading,
      [`${prefixCls}-clicked`]: clicked,
      [`${prefixCls}-background-ghost`]: ghost,
      [`${prefixCls}-two-chinese-chars`]: hasTwoCNChar,
    });

    const iconType = loading ? 'loading' : icon;
    const iconNode = iconType ? <Icon type={iconType} /> : null;
    //this.props.children存在时，对每一个children类型执行判断(null，react组件，字符串)并且根据判断执行添加操作
    const kids = (children || children === 0)
      ? React.Children.map(children, child => insertSpace(child, this.isNeedInserted())) : null;


    /**
     * omit:从others里删除loading这个属性
     * type:如果有href属性（a标签）设为undefined，如果是button则设置为传入值或者'button'
     *
     */
    return (
      <ComponentProp
        {...omit(others, ['loading'])}
        type={(others as AnchorButtonProps).href ? undefined : (htmlType || 'button')}
        className={classes}
        onClick={this.handleClick}
      >
        {iconNode}{kids}
      </ComponentProp>
    );
  }
}


```