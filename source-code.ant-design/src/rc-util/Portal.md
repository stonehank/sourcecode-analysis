整体：
* React >16 的 createPortal 传送门方法
* [createPortal 传送门方法](https://zhuanlan.zhihu.com/p/29880992?utm_source=wechat_session&utm_medium=social&from=singlemessage)


```js
import React from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';

export default class Portal extends React.Component {
  static propTypes = {
    getContainer: PropTypes.func.isRequired,
    children: PropTypes.node.isRequired,
    didUpdate: PropTypes.func,
  }

  componentDidMount() {
    this.createContainer();
  }

  componentDidUpdate(prevProps) {
    const { didUpdate } = this.props;
    if (didUpdate) {
      didUpdate(prevProps);
    }
  }

  componentWillUnmount() {
    this.removeContainer();
  }

  createContainer() {
    this._container = this.props.getContainer();
    this.forceUpdate();
  }

  removeContainer() {
    if (this._container) {
      this._container.parentNode.removeChild(this._container);
    }
  }

  render() {
    if (this._container) {
      return ReactDOM.createPortal(this.props.children, this._container);
    }
    return null;
  }
}

```