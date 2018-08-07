
## 介绍
是一个...

算法如何：

`react-motion`使用了弹性算法，和`anime`的区别如下：



## 结构

对每一个文件作用先大致说明
```
├──src
    ├──mapToZero.js             // 初始化目标的速度值为0
    ├──mergeDiff.js             
    ├──Motion.js                // 单个目标动画的执行文件
    ├──presets.js               // 预定义的动画效果参数
    ├──react-motion.js          // 接口
    ├──reorderKeys.js           // 
    ├──shouldStopAnimation.js   // 判断是否需要停止动画
    ├──spring.js                // 默认动画参数配置，只需要提供目标位置
    ├──StaggeredMotion.js       // 多个目标动画的执行文件
    ├──stepper.js               // 弹力动画的算法
    ├──stripStyle.js            // 将传入的动画参数转换成目标值
    ├──TransitionMotion.js      // 
    ├──Types.js                 // 规定了type
```

## 3个模块

提供了3个模块，分别是`Motion`, `StaggeredMotion`, `TransitionMotion`

### Motion

我们按它的生命周期函数的顺序分析

首先调用`defaultState`，它对传入的参数进行处理，
通过`scripStyle`转换成一个`位置值`和通过`mapToZero`转换成一个`速度值`，
整套算法就是建立在这两个属性之上
```jsx harmony
constructor(props: MotionProps) {
  super(props);
  this.state = this.defaultState();
}

defaultState(): MotionState {
    // defaultStyles指定一个初始值，后续计算不处理它或者通过stripStyle处理
    const {defaultStyle, style} = this.props;
    const currentStyle = defaultStyle || stripStyle(style);
    // 对每一个位置(x,y)，默认速度都为0
    const currentVelocity = mapToZero(currentStyle);
    return {
      currentStyle,
      currentVelocity,
      lastIdealStyle: currentStyle,
      lastIdealVelocity: currentVelocity,
    };
  }
```

接下来，执行`startAnimationIfNecessary`
```jsx harmony
componentDidMount() {
  this.prevTime = defaultNow();
  this.startAnimationIfNecessary();
}
```
`startAnimationIfNecessary`使用了`raf`库，默认使用requestAnimationFrame，
它的几个重要点如下：
1. `shouldStopAnimation`检测是否停止动画
2. 定义了几个变量
    ```
    1. currentTime     // 当前的时间戳
    2. this.prevTime   // 上一帧的时间戳
    3. timeDelta       // 当前帧消耗的时间
    4. this.accumulatedTime 
    // 偏差值，例如当前帧消耗20ms，而规定的帧时间是16.7，那么偏差值就是3.3
    // 这里偏差值后面会计算补充到当前位置，但是下一次计算的开始点不会包括偏差值
    
    一个例子：
    假设规定的每帧时间是16.7，第一帧消耗了20ms，第二帧消耗了16.4ms
    那么第一帧偏差值是3.3ms，行走的距离就是：
    ----------->  +   ->  
    16.7ms的距离   3.3ms距离
    第二帧偏差值是3ms，距离是
                -------->   +   ->
           从16.7的位置开始    3ms的距离
           
    5. framesToCatchUp // 可执行帧数
    // 如果第一帧消耗15ms ，那么它的可执行帧数就是0，偏差值是15ms
    
    ```
3. 通过`stepper`具体计算当前`位置值`和`速度值`


先看源码的动画计算的思想部分，这里不仅仅有`上一次的位置和速度`，
`本次的位置和速度`，还计算了`下一次的位置和速度`，之所以这么做是为了补上偏差值带来的误差：
```jsx harmony
startAnimationIfNecessary = (): void => {
      /* 定义和判断的部分省略... */
  
     // 如果传入的style参数是数字，则直接设置，没有动画效果
    if (typeof styleValue === 'number') {
      newCurrentStyle[key] = styleValue;
      newCurrentVelocity[key] = 0;
      newLastIdealStyle[key] = styleValue;
      newLastIdealVelocity[key] = 0;
    } else {
      // 上一次位置
      let newLastIdealStyleValue = this.state.lastIdealStyle[key];
      // 上一次速度
      let newLastIdealVelocityValue = this.state.lastIdealVelocity[key];
      for (let i = 0; i < framesToCatchUp; i++) {
        // 通过上一次的位置和速度返回当前新的位置和速度
        [newLastIdealStyleValue, newLastIdealVelocityValue] = stepper(
          msPerFrame / 1000,
          newLastIdealStyleValue,
          newLastIdealVelocityValue,
          styleValue.val,
          styleValue.stiffness,
          styleValue.damping,
          styleValue.precision,
        );
      }
      // 计算next(下一次的位置和速度)是为了计算偏差值所占有的速度和位置
      const [nextIdealX, nextIdealV] = stepper(
        msPerFrame / 1000,
        newLastIdealStyleValue,
        newLastIdealVelocityValue,
        styleValue.val,
        styleValue.stiffness,
        styleValue.damping,
        styleValue.precision,
      );
      // 通过偏差值计算当前实际位置，就是上面例如画的图
      
      // 此次动画的位置=这一次执行帧数的位置+下一帧动画的位置*偏差值
      newCurrentStyle[key] =
        newLastIdealStyleValue +
        (nextIdealX - newLastIdealStyleValue) * currentFrameCompletion;
      // 此次动画的速度=这一次执行帧数的速度+下一帧动画的速度*偏差值
      newCurrentVelocity[key] =
        newLastIdealVelocityValue +
        (nextIdealV - newLastIdealVelocityValue) * currentFrameCompletion;
      newLastIdealStyle[key] = newLastIdealStyleValue;
      newLastIdealVelocity[key] = newLastIdealVelocityValue;
    }
  }

    /* ... */

  this.setState({
    currentStyle: newCurrentStyle,
    currentVelocity: newCurrentVelocity,
    lastIdealStyle: newLastIdealStyle,
    lastIdealVelocity: newLastIdealVelocity,
  });

    // 递归调用，保持动画
  this.startAnimationIfNecessary();
  });
};
```
`shouldStopAnimation`和`stepper`放到`Motion`后再去分析。

接着是`componentWillReceiveProps`，
这里有个`unreadPropStyle`和`clearUnreadPropStyle`

先做一个大概解释：
`unreadPropStyle`的意义是当连续调用` x:0 -->x:400 --->x:spring(0)`这种情况，
默认会跳过`x:400`，因为在`x:400`的raf调用之前，会触发`x:spring(0)`，但这时已经有`animationID(400那个触发的)`，
因此`x:spring(0)`的raf调用不会执行，但是它改变了当前Motion的style，因此`x:400`执行raf的时候，对比的是当前位置0，
和`x:spring(0)`的目标位置0，对比相等，因此不会触发动画

这里使用`unreadPropStyle`记录每一次的style值，在raf调用结束会清除`unreadPropStyle`的值，所以当检测到`unreadPropStyle`有值，
说明上一次的raf未结束就又触发新的，于是就进入`clearUnreadPropStyle`

```jsx harmony
componentWillReceiveProps(props: MotionProps) {
    // 如果unreadPropStyle有值，说明config的值被设置成数字并且被跳过了，需要清除(也就是直接跳转到位置)
    if (this.unreadPropStyle != null) {
      // 先检查是否有number的style，如果有就直接跳转到位置
      this.clearUnreadPropStyle(this.unreadPropStyle);
    }

    this.unreadPropStyle = props.style;
    // this.animationID == null 说明之前没有未结束的raf
    if (this.animationID == null) {
      this.prevTime = defaultNow();
      this.startAnimationIfNecessary();
    }
  }
```
`clearUnreadPropStyle`本身非常简单，就是查找style为number的，直接setState手动设定state

```jsx harmony
  clearUnreadPropStyle = (destStyle: Style): void => {
    let dirty = false;
    let {currentStyle, currentVelocity, lastIdealStyle, lastIdealVelocity} = this.state;

    for (let key in destStyle) {
      if (!Object.prototype.hasOwnProperty.call(destStyle, key)) {
        continue;
      }

      const styleValue = destStyle[key];
      // 参数是number，直接赋值然后setState跳转
      if (typeof styleValue === 'number') {
        // 当有多个属性，一次全部更新，而不是多次(每次更新一个)，防止重复获取
        if (!dirty) {
          dirty = true;
          currentStyle = {...currentStyle};
          currentVelocity = {...currentVelocity};
          lastIdealStyle = {...lastIdealStyle};
          lastIdealVelocity = {...lastIdealVelocity};
        }
        currentStyle[key] = styleValue;
        currentVelocity[key] = 0;
        lastIdealStyle[key] = styleValue;
        lastIdealVelocity[key] = 0;
      }
    }
    // dirty为true说明存在number的style
    if (dirty) {
      this.setState({currentStyle, currentVelocity, lastIdealStyle, lastIdealVelocity});
    }
  };
```

接着是`componentWillUnmount`和`render`，清除raf的调用，返回唯一的children
```jsx harmony
componentWillUnmount() {
  this.unmounting = true;
  if (this.animationID != null) {
    defaultRaf.cancel(this.animationID);
    this.animationID = null;
  }
}
  // children是函数，有返回值并且是唯一的children
render(): ReactElement {
  const renderedChildren = this.props.children(this.state.currentStyle);
  return renderedChildren && React.Children.only(renderedChildren);
}
```

接下来是`shouldStopAnimation`和`stepper`

### shouldStopAnimation

确定停止动画的条件：

1. 速度为0
2. 目标为当前位置
```jsx harmony
export default function shouldStopAnimation(
  currentStyle: PlainStyle,
  style: Style,
  currentVelocity: Velocity,
): boolean {
  for (let key in style) {
    // 原型链的属性跳过
    if (!Object.prototype.hasOwnProperty.call(style, key)) {
      continue;
    }
    // 速度不为0，返回false
    if (currentVelocity[key] !== 0) {
      return false;
    }
    const styleValue = typeof style[key] === 'number'
      ? style[key]
      : style[key].val;
    // 当前位置与目标位置不等，返回false
    // 在stepper内部会通过设定的precision属性调整位置，例如精确度为0.1，那么0.9===1
    if (currentStyle[key] !== styleValue) {
      return false;
    }
  }

  return true;
}
```

### stepper