## rc-AnimateChild

整体：

* 根据传递进来的属性确定执行css动画还是js动画
* 执行完毕返回children

```js
import React from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import cssAnimate, { isCssAnimationSupported } from 'css-animation';
import animUtil from './util';

const transitionMap = {
  enter: 'transitionEnter',
  appear: 'transitionAppear',
  leave: 'transitionLeave',
};

export default class AnimateChild extends React.Component {
  static propTypes = {
    children: PropTypes.any,
  }

  componentWillUnmount() {
    this.stop();
  }

  componentWillEnter(done) {
    // 存在enter动画className或者自定义js
    if (animUtil.isEnterSupported(this.props)) {
      this.transition('enter', done);
    } else {
      done();
    }
  }

  componentWillAppear(done) {
    // 存在appear动画className或者自定义js
    if (animUtil.isAppearSupported(this.props)) {
      this.transition('appear', done);
    } else {
      done();
    }
  }

  componentWillLeave(done) {
    if (animUtil.isLeaveSupported(this.props)) {
      this.transition('leave', done);
    } else {
      // always sync, do not interupt with react component life cycle
      // update hidden -> animate hidden ->
      // didUpdate -> animate leave -> unmount (if animate is none)
      done();
    }
  }

  // 真正的运动方法
  transition(animationType, finishCallback) {
    // 当前组件原生DOM
    const node = ReactDOM.findDOMNode(this);
    const props = this.props;
    const transitionName = props.transitionName;
    const nameIsObj = typeof transitionName === 'object';
    this.stop();
    const end = () => {
      this.stopper = null;
      finishCallback();
    };
    // 234
    if ((isCssAnimationSupported || !props.animation[animationType]) &&
      transitionName && props[transitionMap[animationType]]) {
      // 对transitionName的格式做出不同处理
      const name = nameIsObj ? transitionName[animationType] : `${transitionName}-${animationType}`;
      // 一：'transitionName.enter+'-active'
      let activeName = `${name}-active`;
      if (nameIsObj && transitionName[`${animationType}Active`]) {
        // 二：transitionName.enterActive
        activeName = transitionName[`${animationType}Active`];
      }
      // 参数1：目标node 参数2：className和activeClassName 参数3：回调
      // 返回一个stop方法，可以停止
      this.stopper = cssAnimate(node, {
        name,
        active: activeName,
      }, end);
    } else {
      this.stopper = props.animation[animationType](node, end);
    }
  }
  //
  stop() {
    const stopper = this.stopper;
    // todo 存在stopper（说明正在运动中）
    if (stopper) {
      // 停止运动
      this.stopper = null;
      stopper.stop();
    }
  }

  render() {
    return this.props.children;
  }
}


```