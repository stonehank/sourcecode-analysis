
## 介绍
是一个...

算法如何：

`react-motion`使用了弹性算法，和`anime`的区别如下：



## 结构

对每一个文件作用先大致说明
```
├──src
    ├──mapToZero.js             // 初始化目标的速度值为0
    ├──mergeDiff.js             // 对TransitionMotion的动画序列进行排序
    ├──Motion.js                // 单个目标动画的执行文件
    ├──presets.js               // 预定义的动画效果参数
    ├──react-motion.js          // 接口
    ├──reorderKeys.js           // 已经被移除
    ├──shouldStopAnimation.js   // 判断是否需要停止动画
    ├──spring.js                // 默认动画参数配置，只需要提供目标位置
    ├──StaggeredMotion.js       // 多个目标动画的执行文件
    ├──stepper.js               // 弹力动画的算法
    ├──stripStyle.js            // 将传入的动画参数转换成目标值
    ├──TransitionMotion.js      // 目标进入和取消动画的处理
    ├──Types.js                 // 规定了type
```

## 3个模块

提供了3个模块，分别是`Motion`, `StaggeredMotion`, `TransitionMotion`，其中还会穿插一些公用方法

解释几个变量：
```jsx harmony
currentStyle: 当前动画属性(例如height，width)状态
currentVelocitie: 当前动画属性速度
lastIdealStyle: 上一次动画属性状态
lastIdealVelocitie: 上一次动画属性速度
```
-----------
### stripStyle

很容易理解，转换格式

将`{x: {val: 1, stiffness: 1, damping: 2}, y: 2}`转换成`{x: 1, y: 2}`

```jsx harmony
export default function stripStyle(style: Style): PlainStyle {
  let ret = {};
  for (const key in style) {
    if (!Object.prototype.hasOwnProperty.call(style, key)) {
      continue;
    }
    ret[key] = typeof style[key] === 'number' ? style[key] : style[key].val;
  }
  return ret;
}
```

----------

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

这里使用`unreadPropStyle`记录每一次的style值(当前帧的目标值)，在raf调用结束会清除`unreadPropStyle`的值，所以当检测到`unreadPropStyle`有值，
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

弹性动画的算法，内容不多，但是整个组件的核心

```js
  /* ... */
export default function stepper(
  // 每一帧所用秒数
  secondPerFrame: number,
  // 当前位置
  x: number,
  // 当前速度
  v: number,
  // 目标位置
  destX: number,
  // 弹性
  k: number,
  // 阻力
  b: number,
  // 精度(用于停止动画)
  precision: number): [number, number] {
  // 计算当前弹性力(离目标越近，弹性越小)
  const Fspring = -k * (x - destX);
  // 计算当前阻力(速度越快，阻力越大)
  const Fdamper = -b * v;
  // 当前加速度，忽略质量
  const a = Fspring + Fdamper;
  // 新的速度
  const newV = v + a * secondPerFrame;
  // 新的位置
  const newX = x + newV * secondPerFrame;
  // 停止动画的条件，小于当前精度，则速度为0，位置为目标
  if (Math.abs(newV) < precision && Math.abs(newX - destX) < precision) {
    reusedTuple[0] = destX;
    reusedTuple[1] = 0;
    return reusedTuple;
  }
  /* ... */
}
```

### StaggeredMotion

这个一个多目标的动画处理，因此大体上就是遍历需要处理的动画，然后使用类似`Motion`的方法

还是根据生命周期函数分析

同样先调用`defaultState`
```jsx harmony
constructor(props: StaggeredProps) {
  super(props);
  this.state = this.defaultState();
}
```
这里有一点不同，styles必须是函数
```jsx harmony
 defaultState(): StaggeredMotionState {
    const {defaultStyles, styles} = this.props;
    // 与Motion不同之处，styles是个函数，接收上一次的styles，返回值是一个数组，里面包含每一个类似Motion的style个格式
    // 例如：stylex=()=>[{x:{stiffness:100,damping:10,val:100},
    //                   {x:spring(50)},
    //                   {x:500}}]
    
    // 初始的lastIdealStyles是defaultStyles或者是styles()的返回值
    const currentStyles: Array<PlainStyle> = defaultStyles || styles().map(stripStyle);
    // 对应的方向，值为0
    const currentVelocities = currentStyles.map(currentStyle => mapToZero(currentStyle));
    return {
      currentStyles,
      currentVelocities,
      lastIdealStyles: currentStyles,
      lastIdealVelocities: currentVelocities,
    };
  }
```
接下来是`componentDidMount`

```jsx harmony
 componentDidMount() {
    this.prevTime = defaultNow();
    this.startAnimationIfNecessary();
  }
```
`startAnimationIfNecessary`这里取消了onRest的调用，并且是通过遍历动画序列逐个计算，其他和`Motion`的类似

至于onRest的取消，引用官网解释：

> No onRest for StaggeredMotion because we haven't found a good semantics for it yet. Voice your support in the issues section.

接着是`componentWillReceiveProps`，结构也是一样的
```jsx harmony
 componentWillReceiveProps(props: StaggeredProps) {
    if (this.unreadPropStyles != null) {
      // previous props haven't had the chance to be set yet; set them here
      this.clearUnreadPropStyle(this.unreadPropStyles);
    }

    this.unreadPropStyles = props.styles(this.state.lastIdealStyles);
    if (this.animationID == null) {
      this.prevTime = defaultNow();
      this.startAnimationIfNecessary();
    }
  }
```
`clearUnreadPropStyle`和`Motion`的意思一样，都是处理上一帧动画未结束就又触发的新的属性值，
只有一个要注意，当任意目标需要手动更新位置，所有目标都会`setState`

接着`unmount`和`render`都和`Motion`无区别，就不多说了。

可以看出，`StaggeredMotion`和`Motion`其实就是一个模子里出来的，总结下它们的不同点：




|   比较        | StaggeredMotion      | Motion      |
|---------------|----------------------|-------------|
|动画支持目标数 |多个                  |1个          |
|传入style      |函数                  |Array        |
|动画计算       |遍历逐个计算          |单个计算     |
|UnreadPropStyle|任意更新全更新        |单个目标更新|
|onRest         |有                    |无          |


### TransitionMotion

这是最复杂的一个动画组件，涉及到元素的新增和移除，基本架构和前2者类似，但新增了许多不同的变量名，当然都是有用的，
但也可能会看的比较乱，所以先排列出一些关键的变量，并说明它们是做什么用的

#### 排序问题

因为有添加和删除，那怎么判断动画的执行顺序，用到了拓扑排序的思想

例如：

旧的序列： `a -> b -> x`
新的序列： `c -> b -> d`
那么很显然 `a`和`c` 在`b`的前面执行， `x`和`d`在`b`的后面执行

那么`a`和`c`的顺序，`x`和`d`的顺序怎么判断
这里使用的是next默认优先，即默认 `a -> c` ，` x -> d`

#### TransitionMotion参数
```
* 即将新增元素的动画起点
willEnter
----------------------------
* 即将移除元素的动画终点
willLeave
----------------------------
* 已经移除的回调，无返回值
didLeave
----------------------------
* old代表未排序的动画列表或者数据
例如：oldMergedPropsStyles就是未排序的mergedPropsStyles
oldMergedPropsStyles
oldCurrentStyles
oldCurrentVelocities
oldLastIdealStyles
oldLastIdealVelocities
----------------------------
* new代表已经排序的动画列表或者数据
例如：newMergedPropsStyles就是已经排好序的mergedPropsStyles
newMergedPropsStyles, 
newCurrentStyles, 
newCurrentVelocities, 
newLastIdealStyles, 
newLastIdealVelocities
----------------------------
以上的new和old后面变量名称的具体意思：

* 当前动画属性列表(例如height，width)位置
currentStyles
----------------------------
* 当前动画属性列表速度
currentVelocities
----------------------------
* 上一次动画属性列表位置
lastIdealStyles 
----------------------------
* 上一次动画属性列表速度
lastIdealVelocities 
----------------------------
* 储存了key和data数据的当前动画列表
mergedPropsStyles
----------------------------
通过rehydrateStyles组合而成，
* 储存了key和data数据的目标动画列表
destStyles
----------------------------
```

`rehydrateStyles`是什么

当styles是函数的时候，接受一个参数是type为`TransitionPlainStyle`，返回本次的目标值

类似`{key: string, data?: any, style: PlainStyle}`，而它的内容则是上一次的位置，

`mergedPropsStyles`的结构有key和data，但它的style有可能不是PlainStyle格式的，(有可能是`{stifiness:xx,damping:xxx...}`)

因此要通过`rehydrateStyles`创建这种格式

```jsx harmony
function rehydrateStyles(
  mergedPropsStyles: Array<TransitionStyle>,
  unreadPropStyles: ?Array<TransitionStyle>,
  plainStyles: Array<PlainStyle>,
): Array<TransitionPlainStyle> {
  const cUnreadPropStyles = unreadPropStyles;
  // 如果unreadPropStyles不存在，则通过mergedPropsStyles创建
  if (cUnreadPropStyles == null) {
    return mergedPropsStyles.map((mergedPropsStyle, i) => ({
      key: mergedPropsStyle.key,
      data: mergedPropsStyle.data,
      // 这里style使用的是第三个参数的值，
      // 这里计算动画时用的是lastIdealStyles，
      // 而在render的时候用的是currentStyles
      style: plainStyles[i],
    }));
  }
  // 如果unreadPropStyles对应的key存在，则通过unreadPropStyles创建
  return mergedPropsStyles.map((mergedPropsStyle, i) => {
    for (let j = 0; j < cUnreadPropStyles.length; j++) {
      if (cUnreadPropStyles[j].key === mergedPropsStyle.key) {
        return {
          key: cUnreadPropStyles[j].key,
          data: cUnreadPropStyles[j].data,
          style: plainStyles[i],
        };
      }
    }
    return {key: mergedPropsStyle.key, data: mergedPropsStyle.data, style: plainStyles[i]};
  });
}
```
还是按照流程走，

首先是`constructor`

```jsx harmony
  constructor(props: TransitionProps) {
    super(props);
    this.state = this.defaultState();
  }
```
跳到`defaultState`

todo 这里用到了stripStyle，mergeAndSync
```jsx harmony
  defaultState(): TransitionMotionState {
    const {defaultStyles, styles, willEnter, willLeave, didLeave} = this.props;
    // styles可以是对象也可以是函数，将动画目标数据赋值给destStyles
    const destStyles: Array<TransitionStyle> = typeof styles === 'function' ? styles(defaultStyles) : styles;
    // 初始化oldMergedPropsStyles为defaultStyles或者destStyles
    let oldMergedPropsStyles: Array<TransitionStyle>;
    if (defaultStyles == null) {
      oldMergedPropsStyles = destStyles;
    } else {
      oldMergedPropsStyles = (defaultStyles: any).map(defaultStyleCell => {
        for (let i = 0; i < destStyles.length; i++) {
          if (destStyles[i].key === defaultStyleCell.key) {
            return destStyles[i];
          }
        }
        return defaultStyleCell;
      });
    }
    // 通过stripStyle计算出当前位置和速度
    const oldCurrentStyles = defaultStyles == null
      ? destStyles.map(s => stripStyle(s.style))
      : (defaultStyles: any).map(s => stripStyle(s.style));
    const oldCurrentVelocities = defaultStyles == null
      ? destStyles.map(s => mapToZero(s.style))
      : defaultStyles.map(s => mapToZero(s.style));
    const [mergedPropsStyles, currentStyles, currentVelocities, lastIdealStyles, lastIdealVelocities] = mergeAndSync(
      (willEnter: any),
      (willLeave: any),
      (didLeave: any),
      oldMergedPropsStyles,
      destStyles,
      oldCurrentStyles,
      oldCurrentVelocities,
      oldCurrentStyles, 
      oldCurrentVelocities, 
    );
    return {
      currentStyles,
      currentVelocities,
      lastIdealStyles,
      lastIdealVelocities,
      mergedPropsStyles,
    };
  }
```
这里的`mergeAndSync`我们第一次遇到，它是`TransitionMotion`组件的重点

代码长，参数也一大堆，再次回顾下每个参数代表的[意思](#TransitionMotion参数)

这里调用了`mergeDiff`，它的功能就是对要进行的动画进行先后排序，具体怎么做后面再说，先知道它的功能
```jsx harmony
function mergeAndSync(
  willEnter: WillEnter,
  willLeave: WillLeave,
  didLeave: DidLeave,
  oldMergedPropsStyles: Array<TransitionStyle>,
  destStyles: Array<TransitionStyle>,
  oldCurrentStyles: Array<PlainStyle>,
  oldCurrentVelocities: Array<Velocity>,
  oldLastIdealStyles: Array<PlainStyle>,
  oldLastIdealVelocities: Array<Velocity>,
): [Array<TransitionStyle>, Array<PlainStyle>, Array<Velocity>, Array<PlainStyle>, Array<Velocity>] {
  // 对要进行的动画进行先后排序(拓扑排序思想)
  const newMergedPropsStyles = mergeDiff(
    oldMergedPropsStyles,
    destStyles,
    // 参数3 是执行删除的动作，无删除动画则直接删除，有删除动画的还需要进入到动画排序
    (oldIndex, oldMergedPropsStyle) => {
      const leavingStyle = willLeave(oldMergedPropsStyle);
      // 无willLeave动画，直接调用didLeave
      if (leavingStyle == null) {
        didLeave({ key: oldMergedPropsStyle.key, data: oldMergedPropsStyle.data });
        return null;
      }
      // 判断需要停止动画，调用didLeave
      if (shouldStopAnimation(
          oldCurrentStyles[oldIndex],
          leavingStyle,
          oldCurrentVelocities[oldIndex])) {
        didLeave({ key: oldMergedPropsStyle.key, data: oldMergedPropsStyle.data });
        return null;
      }
      // 有willLeave并且动画还未停止，返回删除动画
      return {key: oldMergedPropsStyle.key, data: oldMergedPropsStyle.data, style: leavingStyle};
    },
  );

  let newCurrentStyles = [];
  let newCurrentVelocities = [];
  let newLastIdealStyles = [];
  let newLastIdealVelocities = [];
  // 注意！！此处newMergedPropsStyles已经是排好序的动画序列
  // 后面的就是填充上面这个4个变量了(根据排好的顺序)
  for (let i = 0; i < newMergedPropsStyles.length; i++) {
    const newMergedPropsStyleCell = newMergedPropsStyles[i];
    let foundOldIndex = null;
    for (let j = 0; j < oldMergedPropsStyles.length; j++) {
      if (oldMergedPropsStyles[j].key === newMergedPropsStyleCell.key) {
        foundOldIndex = j;
        break;
      }
    }
    // 无旧的全是新增，创建新的数据
    if (foundOldIndex == null) {
      const plainStyle = willEnter(newMergedPropsStyleCell);
      newCurrentStyles[i] = plainStyle;
      newLastIdealStyles[i] = plainStyle;

      const velocity = mapToZero(newMergedPropsStyleCell.style);
      newCurrentVelocities[i] = velocity;
      newLastIdealVelocities[i] = velocity;
      // 有旧的target更新或者删除，使用旧的数据作为新排序的数据
    } else {
      newCurrentStyles[i] = oldCurrentStyles[foundOldIndex];
      newLastIdealStyles[i] = oldLastIdealStyles[foundOldIndex];
      newCurrentVelocities[i] = oldCurrentVelocities[foundOldIndex];
      newLastIdealVelocities[i] = oldLastIdealVelocities[foundOldIndex];
    }
  }
  /*
  * newMergedPropsStyles：已经排好序的动画序列
  * newCurrentStyles：已经排好序的目前的位置
  * newCurrentVelocities：已经排好序的目前的速度
  * newLastIdealStyles：已经排好序的旧的位置
  * newLastIdealVelocities：已经排好序的旧的速度
  * */
  return [newMergedPropsStyles, newCurrentStyles, newCurrentVelocities, newLastIdealStyles, newLastIdealVelocities];
}
```

接着是`componentDidMount`，内部调用了`startAnimationIfNecessary`
```jsx harmony
startAnimationIfNecessary = (): void => {
  /* ... */

  const propStyles = this.props.styles;
  // 通过rehydrateStyles计算destStyles
  // 如果styles是函数，destStyles就是根据上一次的动画数据通过styles函数计算出本次的目标位置
  // 如果styles不是函数，destStyles就是styles，也就是本次动画目标位置
  let destStyles: Array<TransitionStyle> = typeof propStyles === 'function'
    ? propStyles(rehydrateStyles(
      this.state.mergedPropsStyles,
      this.unreadPropStyles,
      this.state.lastIdealStyles,
    ))
    : propStyles;
  
  /* 省略：判断是否需要停止动画，计算当前动画帧和偏差值... */
  
  // 将旧的动画数据(未排序)转换成新的动画数据(已排序)
  let [newMergedPropsStyles, newCurrentStyles, newCurrentVelocities, newLastIdealStyles, newLastIdealVelocities] = mergeAndSync(
    (this.props.willEnter: any),
    (this.props.willLeave: any),
    (this.props.didLeave: any),
    this.state.mergedPropsStyles,
    destStyles,
    this.state.currentStyles,
    this.state.currentVelocities,
    this.state.lastIdealStyles,
    this.state.lastIdealVelocities,
  );
  
  // 对newMergedPropsStyles逐个计算
  for (let i = 0; i < newMergedPropsStyles.length; i++) {
    /* 省略：与StaggeredMotion流程一致... */
  }
}
```

可以看到，和另外2个相比，多了2个方法，

* `rehydrateStyles`：处理数据
* `mergeAndSync`：排序

前面都讲过了，这里也不重复

接着`componentWillReceiveProps`调用了`clearUnreadPropStyle`




