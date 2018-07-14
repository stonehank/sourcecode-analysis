## rc-lazyRenderBox

整体：
* 渲染一个div，当传入hiddenClassName存在时，根据visible来判断是否需要添加hidden的className


```tsx
import * as React from 'react';

export interface ILazyRenderBoxPropTypes {
  className?: string;
  visible?: boolean;
  hiddenClassName?: string;
  role?: string;
  style?: {};
}

export default class LazyRenderBox extends React.Component<ILazyRenderBoxPropTypes, any> {
  shouldComponentUpdate(nextProps: ILazyRenderBoxPropTypes) {
    // 未传递hiddenClassName并且不可见，才会阻止渲染
    return !!nextProps.hiddenClassName || !!nextProps.visible;
  }
  render() {
    let className = this.props.className;
    // hiddenClassName存在 并且 不可见
    if (!!this.props.hiddenClassName && !this.props.visible) {
      // className 添加 hiddenClassName
      className += ` ${this.props.hiddenClassName}`;
    }
    // 删除visible和hiddenC，传递给div，渲染
    const props: any = { ...this.props };
    delete props.hiddenClassName;
    delete props.visible;
    props.className = className;
    return <div {...props} />;
  }
}

```