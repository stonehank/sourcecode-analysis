## rc-Animate

整体：

本身不执行动画，只是负责收集当前组件的条件，判断是否需要进行动画，真正执行动画再AnimateChild

先了解3种动画定义：
* appear：首次出现动画
* enter：后续出现动画
* leave：后续离开动画

* Animate使用了自定义的key属性(不是用于diff的key)，用时间戳来定义这个key
基本所有的动画和动画状态都是根据key值来获取和执行

* componentDidMount，会判断是否需要appear动画，需要就执行；

* componentWillReceiveProps，都会检查是否需要保持可见知道动画结束才不可见，并且检查每一个child是否需要进行动画，
需要的直接提交给动画执行方法进行判断是否支持；

* componentDidUpdate，进行需要的动画

Animate动画分为showProp模式和非showProp模式；

showProp：
* 组件除了在存在不存在的时候触发enter和leave动画，还会在可见和不可见的状态触发enter和leave

非showProp：
* 组件只能在存在不存在的情况触发enter和leave动画

动画途中遇到状态改变分2种情况：exclusive和非exclusive

非exclusive：
* 执行动画完毕，检查当前组件挂载状态，如果和动画意思不相符，例如动画为enter，动画结束发现组件卸载了，就会去执行leave动画；
* 如果和动画意思相符，就执行动画结束的回调

exclusive：
* 停止动画执行，更新children，开始执行下一个动画



```jsx
import React from 'react';
import PropTypes from 'prop-types';
import {
  toArrayChildren,
  mergeChildren,
  findShownChildInChildrenByKey,
  findChildInChildrenByKey,
  isSameChildren,
} from './ChildrenUtils';
import AnimateChild from './AnimateChild';
const defaultKey = `rc_animate_${Date.now()}`;
import animUtil from './util';


// 给children(如果不存在key)添加key
function getChildrenFromProps(props) {
  const children = props.children;
  // children是React组件
  if (React.isValidElement(children)) {
    // 没有key属性
    if (!children.key) {
      // 添加key为 rc_animate_时间戳
      return React.cloneElement(children, {
        key: defaultKey,
      });
    }
  }
  return children;
}

function noop() {
}

export default class Animate extends React.Component {
  // todo 作为以后的判断
  static isAnimate = true; // eslint-disable-line

  static propTypes = {
    component: PropTypes.any,
    componentProps: PropTypes.object,
    animation: PropTypes.object,
    transitionName: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.object,
    ]),
    transitionEnter: PropTypes.bool,
    transitionAppear: PropTypes.bool,
    exclusive: PropTypes.bool,
    transitionLeave: PropTypes.bool,
    onEnd: PropTypes.func,
    onEnter: PropTypes.func,
    onLeave: PropTypes.func,
    onAppear: PropTypes.func,
    showProp: PropTypes.string,
    children: PropTypes.node,
  }

  static defaultProps = {
    animation: {},
    component: 'span',
    componentProps: {},
    transitionEnter: true,
    transitionLeave: true,
    transitionAppear: false,
    onEnd: noop,
    onEnter: noop,
    onLeave: noop,
    onAppear: noop,
  }

  constructor(props) {
    super(props);

    this.currentlyAnimatingKeys = {};
    this.keysToEnter = [];
    this.keysToLeave = [];

    this.state = {
      // 将children转化成一个数组，值为每个child元素
      children: toArrayChildren(getChildrenFromProps(props)),
    };

    this.childrenRefs = {};
  }

  componentDidMount() {
    // 定义判断是否可见的属性值
    const showProp = this.props.showProp;
    // children组成的数组
    let children = this.state.children;
    // 传了可见的属性值
    if (showProp) {
      // 过滤出可见值为true的child
      children = children.filter((child) => {
        return !!child.props[showProp];
      });
    }
    children.forEach((child) => {
      if (child) {
        // 对每个child执行appear动画和回调
        this.performAppear(child.key);
      }
    });
  }

  componentWillReceiveProps(nextProps) {
    this.nextProps = nextProps;
    // 获取nextProps的children数组
    const nextChildren = toArrayChildren(getChildrenFromProps(nextProps));
    const props = this.props;
    // exclusive needs immediate response
    // 如果当前存在exclusive，直接停止当前动画
    if (props.exclusive) {
      // 对每一个存在运动状态的key 停止动画
      Object.keys(this.currentlyAnimatingKeys).forEach((key) => {
        // 停止key值为key
        this.stop(key);
      });
    }
    const showProp = props.showProp;
    const currentlyAnimatingKeys = this.currentlyAnimatingKeys;
    // last props children if exclusive
    const currentChildren = props.exclusive ?
      // exclusive 更新children数组
      toArrayChildren(getChildrenFromProps(props)) :
      // 不更新（将动画进行完毕）
      this.state.children;
    // in case destroy in showProp mode
    let newChildren = [];
    /** showProp模式下，newChildren为prev和next中，
     * 一直存在的组件(使用next的)，
     * 从无到有的组件(使用next的)，
     * 从有到无的组件(使用prev的，
     * 从showProp:true到false的(使用next的并且修改showProp为true)
     */

    /** 非showProp模式下，newChildren为prev和next中，
     * 一直存在的组件(使用next的)，
     * 从无到有的组件(使用next的)，
     * 从有到无的组件(使用prev的)
     */

    /** 都是为了能让从有到无这类动画显示，等动画结束回调时再调整state.children */
    if (showProp) {
      currentChildren.forEach((currentChild) => {
        // 当前组件存在，获取当前组件的下一个状态
        const nextChild = currentChild && findChildInChildrenByKey(nextChildren, currentChild.key);
        let newChild;
        // 当前组件可见(假设showPop为"visible")，下一个状态组件不可见或者不存在
        if ((!nextChild || !nextChild.props[showProp]) && currentChild.props[showProp]) {
          // newChild 赋值为此组件的下一个状态（如果不存在就当前状态），将showProp设为true
          // 此处是因为要显示leave动画，因此showProp不能设为false，等回调的时候才设置
          newChild = React.cloneElement(nextChild || currentChild, {
            [showProp]: true,
          });
        } else {
          // 从不可见到可见，直接赋值，不需要变更状态
          newChild = nextChild;
        }
        if (newChild) {
          newChildren.push(newChild);
        }
      });
      nextChildren.forEach((nextChild) => {
        // nextChild不存在 或者 在currentChildren中找不到nextChild的key（新增的child）
        if (!nextChild || !findChildInChildrenByKey(currentChildren, nextChild.key)) {
          // 加进newChildren
          newChildren.push(nextChild);
        }
      });
    } else {
      // 返回prev和next中(一直存在的组件(使用next的)，从无到有的组件(使用next的)，从有到无的组件(使用prev的))
      // todo 如果child为null 也会合并进去并且不执行去重
      newChildren = mergeChildren(
        currentChildren,
        nextChildren
      );
    }

    // 更新children
    // need render to avoid update
    this.setState({
      children: newChildren,
    });

    // 过滤出nextChildren 中是从看不见到看得见的child（包括2种：1、从无到有 2、从visible:false到true）
    // 传递给keyToEnter
    // 如果处于运动状态，return
    nextChildren.forEach((child) => {
      const key = child && child.key;
      // child是运动状态，返回
      if (child && currentlyAnimatingKeys[key]) {
        return;
      }
      // 非新增child
      const hasPrev = child && findChildInChildrenByKey(currentChildren, key);
      // showProp模式
      if (showProp) {
        // child下一个showProp状态是可见的
        const showInNext = child.props[showProp];
        // 非新增
        if (hasPrev) {
          // child当前showProp状态
          const showInNow = findShownChildInChildrenByKey(currentChildren, key, showProp);
          // 从不可见到可见
          if (!showInNow && showInNext) {
            this.keysToEnter.push(key);
          }
          // 新增（从无到有）
        } else if (showInNext) {
          this.keysToEnter.push(key);
        }
        // 非showProp模式 并且 从无到有
      } else if (!hasPrev) {
        this.keysToEnter.push(key);
      }
    });
    // 过滤出currentChildren 中是从看得见的到看不见的child（包括2种：1、从有到无 2、从visible:true到false）
    // 传递给 keysToLeave
    // 如果处于运动状态，return
    currentChildren.forEach((child) => {
      const key = child && child.key;
      // child是运动状态，返回
      if (child && currentlyAnimatingKeys[key]) {
        return;
      }
      const hasNext = child && findChildInChildrenByKey(nextChildren, key);
      if (showProp) {
        const showInNow = child.props[showProp];
        if (hasNext) {
          const showInNext = findShownChildInChildrenByKey(nextChildren, key, showProp);
          if (!showInNext && showInNow) {
            this.keysToLeave.push(key);
          }
        } else if (showInNow) {
          this.keysToLeave.push(key);
        }
      } else if (!hasNext) {
        this.keysToLeave.push(key);
      }
    });
  }

  componentDidUpdate() {
    const keysToEnter = this.keysToEnter;
    this.keysToEnter = [];
    // 对需要进行enter动画的组件执行enter动画
    keysToEnter.forEach(this.performEnter);
    const keysToLeave = this.keysToLeave;
    this.keysToLeave = [];
    // 对需要进行leave动画的组件执行leave动画
    keysToLeave.forEach(this.performLeave);
  }

  // 执行enter动画，然后回调
  performEnter = (key) => {
    // may already remove by exclusive
    // key对应child的组件已经挂载，获取的是AnimateChild实例
    if (this.childrenRefs[key]) {
      // 设置这个key的运动状态为true
      this.currentlyAnimatingKeys[key] = true;
      // 完成enter动画，并且执行参数回调
      this.childrenRefs[key].componentWillEnter(
        //动画完毕，执行enter回调
        this.handleDoneAdding.bind(this, key, 'enter')
      );
    }
  }
  // 执行appear动画，然后回调
  performAppear = (key) => {
    // key对应child的组件已经挂载
    if (this.childrenRefs[key]) {
      // todo 设置这个key的运动状态为true
      this.currentlyAnimatingKeys[key] = true;
      // 执行appear动画
      this.childrenRefs[key].componentWillAppear(
        // 动画完毕，执行appear回调
        this.handleDoneAdding.bind(this, key, 'appear')
      );
    }
  }

  // 动画完毕，更改运动状态，如果不是exclusive，执行appear或者enter回调(根据是否支持回调)
  handleDoneAdding = (key, type) => {
    const props = this.props;
    // 删除这个key的运动状态
    delete this.currentlyAnimatingKeys[key];
    // if update on exclusive mode, skip check
    // 如果是exclusive 并且下一个状态和当前状态不同，直接跳过(不执行回调)
    if (props.exclusive && props !== this.nextProps) {
      return;
    }
    // 当前props的children数组
    const currentChildren = toArrayChildren(getChildrenFromProps(props));

    // 找不到有参数key的child
    if (!this.isValidChildByKey(currentChildren, key)) {
      // exclusive will not need this
      // 进入动画(appear或者enter)结束后，child消失，说明又触发了leave，立刻转到leave动画的执行和回调
      this.performLeave(key);
    } else {
      if (type === 'appear') {
        // 支持appear的回调（不一定存在动画）
        if (animUtil.allowAppearCallback(props)) {
          // 执行appear回调
          props.onAppear(key);
          // 执行动画结束回调，第二个参数是当前child的是否存在状态
          props.onEnd(key, true);
        }
      } else {
        // 支持enter的回调（不一定存在动画）
        if (animUtil.allowEnterCallback(props)) {
          props.onEnter(key);
          props.onEnd(key, true);
        }
      }
    }
  }

  // 执行
  performLeave = (key) => {
    // may already remove by exclusive
    // key对应的child的组件已经挂载
    if (this.childrenRefs[key]) {
      // 当前key的运动状态为true
      this.currentlyAnimatingKeys[key] = true;
      //
      this.childrenRefs[key].componentWillLeave(this.handleDoneLeaving.bind(this, key));
    }
  }

  // 动画结束后，更新this.state.children(判断是否有变化)，调用回调
  handleDoneLeaving = (key) => {
    const props = this.props;
    // 删除这个key的运动状态
    delete this.currentlyAnimatingKeys[key];
    // if update on exclusive mode, skip check
    // 如果是exclusive 并且下一个状态和当前状态不同
    if (props.exclusive && props !== this.nextProps) {
      return;
    }
    // 当前props的children数组
    const currentChildren = toArrayChildren(getChildrenFromProps(props));
    // in case state change is too fast
    // 找到了当前key的child
    if (this.isValidChildByKey(currentChildren, key)) {
      // 如果leave动画结束，但还存在当前key的child，执行enter动画和回调
      this.performEnter(key);
    } else {
      // end为leave动画结束后的回调
      const end = () => {
        // 首先判断是否支持
        if (animUtil.allowLeaveCallback(props)) {
          props.onLeave(key);
          props.onEnd(key, false);
        }
      };
      // 判断 this.state.children 是否有变化
      if (!isSameChildren(this.state.children,
          currentChildren, props.showProp)) {
        // 如果有变化 更改state的children
        // 更改完毕，调用end
        this.setState({
          children: currentChildren,
        }, end);
        // 无变化，直接调用end
      } else {
        end();
      }
    }
  }

  // 找出key为参数key的child
  isValidChildByKey(currentChildren, key) {
    const showProp = this.props.showProp;
    if (showProp) {
      // 找出key为参数key，并且showProp为true的child
      return findShownChildInChildrenByKey(currentChildren, key, showProp);
    }
    // 找出key为参数key的child
    return findChildInChildrenByKey(currentChildren, key);
  }

  // 删除运动状态，停止运动
  stop(key) {
    // 删除当前key的运动状态
    delete this.currentlyAnimatingKeys[key];
    const component = this.childrenRefs[key];
    // 如果当前key的child组件已经挂载
    if (component) {
      // 执行child组件上的stop
      // 停止运动
      component.stop();
    }
  }

  render() {
    const props = this.props;
    this.nextProps = props;
    // 转化成数组的children
    const stateChildren = this.state.children;
    let children = null;
    if (stateChildren) {
      children = stateChildren.map((child) => {
        if (child === null || child === undefined) {
          return child;
        }
        // child必须要有key
        if (!child.key) {
          throw new Error('must set key for <rc-animate> children');
        }
        // 真正的动画执行组件
        return (
          <AnimateChild
            key={child.key}
            ref={node => this.childrenRefs[child.key] = node}
            animation={props.animation}
            transitionName={props.transitionName}
            transitionEnter={props.transitionEnter}
            transitionAppear={props.transitionAppear}
            transitionLeave={props.transitionLeave}
          >
            {child}
          </AnimateChild>
        );
      });
    }
    const Component = props.component;
    // 需要wrap的情况
    if (Component) {
      let passedProps = props;
      // 传进的是字符串（原生html标签），例如"span"
      if (typeof Component === 'string') {
        // 传递的props必须符合原生标签要求
        passedProps = {
          className: props.className,
          style: props.style,
          ...props.componentProps,
        };
      }
      return <Component {...passedProps}>{children}</Component>;
    }
    // 不需要wrap（只有1个child）
    return children[0] || null;
  }
}


```