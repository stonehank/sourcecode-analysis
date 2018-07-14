整体：
* 作为```TabContent```的children被渲染
* 根据传入的属性，添加不同的className
* TabPane渲染出的格式：
   ```
   div .prefix-tabpane prefix-tabpane-(active|inactive)
     children(或者placeholder)
   ```
源码：
```jsx
import React from 'react';
import PropTypes from 'prop-types';
import createReactClass from 'create-react-class';
import classnames from 'classnames';
import { getDataAttr } from './utils';

const TabPane = createReactClass({
  displayName: 'TabPane',
  propTypes: {
    className: PropTypes.string,
    active: PropTypes.bool,
    style: PropTypes.any,
    destroyInactiveTabPane: PropTypes.bool,
    forceRender: PropTypes.bool,
    placeholder: PropTypes.node,
  },
  getDefaultProps() {
    return { placeholder: null };
  },
  render() {
    const {
      className, destroyInactiveTabPane, active, forceRender,
      rootPrefixCls, style, children, placeholder, ...restProps,
    } = this.props;
    this._isActived = this._isActived || active;
    const prefixCls = `${rootPrefixCls}-tabpane`;
    const cls = classnames({
      [prefixCls]: 1,
      [`${prefixCls}-inactive`]: !active,
      [`${prefixCls}-active`]: active,
      [className]: className,
    });
    const isRender = destroyInactiveTabPane ? active : this._isActived;
    return (
      <div
        style={style}
        role="tabpanel"
        aria-hidden={active ? 'false' : 'true'}
        className={cls}
        {...getDataAttr(restProps)}
      >
        {isRender || forceRender ? children : placeholder}
      </div>
    );
  },
});

export default TabPane;

```