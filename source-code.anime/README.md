为了能更好的理解这个库，个人写了一个此库的压缩版，实现了核心的功能(主要也是为了更好理解核心功能)，内容更少方便阅读，
地址在[这里](https://github.com/stonehank/simplify-anime)

--------

## 介绍
[anime](http://animejs.com/)一个动画库，摒弃了常规的`left,top`属性，全面采用`requestAnimateFrame+CSS3属性`能充分调用设备进行GPU渲染。

它的亮点有以下(直接引用官网)：
> * Keyframes(帧动画): Chain multiple animation properties.
> * Timeline(同步动画): Synchronize multiple instances together.
> * Playback controls(暂停回放功能): Play, pause, restart, seek animations or timelines.
> * CSS transforms(CSS动画): Animate CSS transforms individually.
> * Function based values(函数定义配置(注入了内部属性)): Multiple animated targets can have individual value.
> * SVG Animations(SVG动画): Motion path, line drawing and morphing animations.
> * Easing functions(自定义贝塞尔函数): Use the built in functions or create your own Cubic Bézier curve easing.

这么多亮点，其实关键函数就3~4个。

因为这里都是使用缓动函数算法，也就是通过 `初始位置`, `结束位置`, `持续时间`,`已消耗的时间` 计算出当前所在位置。

`初始位置`、`结束位置`和`持续时间`是作为参数传入配置的，因此计算`已消耗时间`就是完成动画的核心。  

下面就深入了解下它的核心。

## 深入理解

先了解几个时间的变量，动画都是`算法+时间=位置`这么算出来的：
```js
// 记录当前位置所对应的时间，根据lastTime计算
instance.cuurentTime
// 记录当前位置所消耗的时间
engineTime
// 记录上一次计算完毕赋值后的位置对应时间
lastTime
// 上一次调用raf的时间
startTime
// 当前位置所消耗时间(能匹配反转状态)，根据engineTime计算
insTime
// 动画持续时间
insDuration
// 延迟时间
delay
// 从什么时间点开始动画
insOffset
```

接着看几个关键函数，这里先不放具体代码，只是先知道是做什么的(按一个正常动画顺序排放)：

```js
// anime的核心机制, 递归调用raf执行(关键)
const engine = (() => {
  // ...requestAnimateFrame
})();

// anime主体
function anime(params){
  
  // 定义instance 也是最终返回值
  let instance = createNewInstance(params);
  
  // 外部API 从当前位置开始执行动画
  instance.play = function() {}
  
  // 配置 startTime 和 engineTime(关键)
   instance.tick = function(t) {}
   
  // 对当前engineTime进行判断，确定动画方案(关键)
  function setInstanceProgress(engineTime) {}
  
  // 计算动画当前位置 并且赋值(关键)
  function setAnimationsProgress(insTime){}

  // 直接跳到参数time的时间所在的位置
  instance.seek = function(time) {}
  // 外部API 暂停
  instance.pause = function() {}
  // 外部API 反转
  instance.reverse = function() {}
  // 外部API reset
  instance.reset = function() {}
  // 外部API 重新开始
  instance.restart = function() {}
  /*...*/
  return instance
}
```
关键函数就4个，其他都是一些对关键函数的具体使用

接着一个个解析：


* createNewInstance

其实就是对属性和方法合并成一个整体对象，这个对象是贯穿全局的，因此里面什么都有...
```js
 function createNewInstance(params) {
  
    /* 对params进行处理 */
    const instanceSettings = replaceObjectProps(defaultInstanceSettings, params);
    const tweenSettings = replaceObjectProps(defaultTweenSettings, params);
    const animatables = getAnimatables(params.targets);
    const properties = getProperties(instanceSettings, tweenSettings, params);
    const animations = getAnimations(animatables, properties);
        
    // mergeObjects(o1,o2)相当于 Object.assing({},o2,o1)
    return mergeObjects(instanceSettings, {
      children: [],
      animatables: animatables,
      animations: animations,
      duration: getInstanceTimings('duration', animations, instanceSettings, tweenSettings),
      delay: getInstanceTimings('delay', animations, instanceSettings, tweenSettings)
    });
  }
```

* instance.play

此处先做了防护，只有paused状态下才会执行，`lastTime`这里是调取当前动画的位置对应的时间，因此才可以实现从任意位置开始动画。


```js
 // 外部API 从当前位置开始执行动画
instance.play = function() {
  if (!instance.paused) return;
  instance.paused = false;
  // 从0 开始
  startTime = 0;
  // 调取当前动画当前位置所对应的时间
  lastTime = adjustTime(instance.currentTime);
  // 给 activeInstances 添加当前实例，说明这是一个正在运行的动画
  activeInstances.push(instance);
  // raf未启动，调用engine
  if (!raf) engine();
}
```

* engine

anime的核心机制，通过递归调用`requestAnimateFrame`，当检测到需要执行动画的集合`activeInstances`有值，调用instance.tick。

```js
  // IIFE 之后调用engine相当于执行内部的play
  const engine = (() => {
    // step收到一个参数，
    function play() { raf = requestAnimationFrame(step); };
    // 这里的参数t是 raf的参数中可以接受的一个时间戳，表示触发调用的时间
    function step(t) {
      // activeInstances指正在被执行的动画集合
      const activeLength = activeInstances.length;
      // 存在正在运行的动画
      if (activeLength) {
        let i = 0;
        while (i < activeLength) {
          // 调用tick执行
          if (activeInstances[i]) activeInstances[i].tick(t);
          i++;
        }
        play();
      } else {
        // 不存在正在运行的动画 cancel
        cancelAnimationFrame(raf);
        raf = 0;
      }
    }
    return play;
  })();
```


* instance.tick

tick的作用通过参数`t`，`raf`的一个时间戳概念，计算出距离上一次调用实际消耗的时间`engineTime`。

例如：上一次调用时间戳是`1000`，也就是1秒，中途突然执行一个巨大的任务，等任务结束，时间戳是`20000`，
那么这次的`engineTime`就是`lastTime+20000-1000`，也就是计算这次动画从上次位置再加上19秒的位置...
那么anime对于这种情况是怎么处理呢?继续看下一个`setInstanceProgress`。

```js
// 配置 startTime 和 engineTime
instance.tick = function(t) {
  now = t;
  // startTime 如果首次执行 就是now，否则就是上一次tick的时间
  if (!startTime) startTime = now;
  // lastTime 是上一次执行结束后动画对应位置的时间戳
  // engineTime 是到动画目前为止消耗的总时间，一般理论上讲是lastTime+16.6667
  const engineTime = (lastTime + now - startTime) * anime.speed;
  setInstanceProgress(engineTime);
}
```

* setInstanceProgress

这个函数接受一个消耗的时间值，在内部对其进行适配和定义了各种情况的动画起始点，传递给`setAnimationsProgress`。

例如，上面那个例子，如果消耗了19秒，就如进入这个判断:从结束点开始动画(考虑reverse的情况)。
```js
// 消耗的时间超出了持续时间 并且当前位置不在终点  或者 未设定持续时间
if ((insTime >= insDuration && insCurrentTime !== insDuration) || !insDuration){
  if ((insTime >= insDuration && insCurrentTime !== insDuration) || !insDuration) {
    // 从结束点开始
    setAnimationsProgress(insDuration);
    if (!insReversed) countIteration();
  }
}
```

setInstanceProgress(省略了一些配置的定义)

```js
// 对当前engineTime进行判断，确定动画方案
function setInstanceProgress(engineTime) {
  // 动画持续时间
  const insDuration = instance.duration;
  // 从什么时间点开始动画
  const insOffset = instance.offset;
  // 加上延迟后的开始时间
  const insStart = insOffset + instance.delay;
  // 记录当前位置所对应的时间
  const insCurrentTime = instance.currentTime;
  // 是否是反转状态
  const insReversed = instance.reversed;
  // 当前位置所消耗时间(能匹配反转状态)
  // 这里adjustTime就是如果是反转状态，则返回 insDuration-engineTime
  const insTime = adjustTime(engineTime);
  /* ... */
  // 消耗的时间大于应该开始的时间 并且 消耗的时间在持续时间范围内
  if (insTime > insOffset && insTime < insDuration) {
    setAnimationsProgress(insTime);
  } else {
    // 消耗的时间小于应该开始的时间 并且 当前位置不在起点
    if (insTime <= insOffset && insCurrentTime !== 0) {
      // 从头开始
      setAnimationsProgress(0);
      if (insReversed) countIteration();
    }
    // 消耗的时间超出了持续时间 并且当前位置不在终点  或者 未设定持续时间
    if ((insTime >= insDuration && insCurrentTime !== insDuration) || !insDuration) {
      // 从结束点开始
      setAnimationsProgress(insDuration);
      if (!insReversed) countIteration();
    }
  }
  setCallback('update');
  // 消耗时间大于持续时间 并且在终点(不在终点的上面已经判断了)
  if (engineTime >= insDuration) {
    if (instance.remaining) {
      startTime = now;
      if (instance.direction === 'alternate') toggleInstanceDirection();
      // remaining为false，remaining>0说明还需要继续动画
    } else {
      // 完成动画的执行
      instance.pause();
      if (!instance.completed) {
        instance.completed = true;
        setCallback('complete');
        if ('Promise' in window) {
          resolve();
          promise = makePromise();
        }
      }
    }
    lastTime = 0;
  }
}
```

* setAnimationsProgress(省略了一些配置的定义)

这个函数接受一个参数，就是当前位置所消耗时间(动画起始点)，然后在里面计算出每一个动画目标的位置，并且赋值

```js
// 计算动画当前位置 并且赋值
function setAnimationsProgress(insTime) {
  /* ... */
  // 这个while逐个计算当前实例中的每个动画的当前位置(通过时间和算法)
  while (i < animationsLength) {
      /* ... */
    // 消耗的时间占总持续时间的比例 在起点终点之间
    const elapsed = minMaxValue(insTime - tween.start - tween.delay, 0, tween.duration) / tween.duration;
    // 通过算法计算当前进度
    const eased = isNaN(elapsed) ? 1 : tween.easing(elapsed, tween.elasticity);
    /* ... */
    // 遍历每一个到达点执行
    for (let n = 0; n < toNumbersLength; n++) {
      let value;
      const toNumber = tween.to.numbers[n];
      const fromNumber = tween.from.numbers[n];
      if (!tween.isPath) {
        // 计算当前具体位置
        value = fromNumber + (eased * (toNumber - fromNumber));
      } else {
        // 进行SVG path计算
        value = getPathProgress(tween.value, eased * toNumber);
      }
      /* ... */
      numbers.push(value);
    }
         /* ... */
        if (!isNaN(n)) {
          // 组合单位 '135.546'+'px'
          if (!b) {
            progress += n + ' ';
          } else {
            progress += n + b;
          }
        }
    /* ... */
    // 组合结果 'translateX('+'135.546px'+')`
    setTweenProgress[anim.type](animatable.target, anim.property, progress, transforms, animatable.id);
    anim.currentValue = progress;
    i++;
  }
  // 遍历结果，逐个target赋值
  const transformsLength = Object.keys(transforms).length;
  if (transformsLength) {
    for (let id = 0; id < transformsLength; id++) {
      if (!transformString) {
        const t = 'transform';
        // 配置兼容性
        transformString = (getCSSValue(document.body, t) ? t : `-webkit-${t}`);
      }
      // 设置style
      instance.animatables[id].target.style[transformString] = transforms[id].join(' ');
    }
  }
  // 记录当前位置所对应的时间
  instance.currentTime = insTime;
  // 设置进度
  instance.progress = (insTime / instance.duration) * 100;
}
```
剩下的就是一些操作函数了：

* instance.seek 
```js
// 直接跳到参数time的时间所在的位置
instance.seek = function(time) {
  setInstanceProgress(adjustTime(time));
}
```

* instance.pause
```js
// 外部API 暂停
instance.pause = function() {
  const i = activeInstances.indexOf(instance);
  // 删除activeInstances 后续engine中找不到便不会执行
  if (i > -1) activeInstances.splice(i, 1);
  instance.paused = true;
}
```

* instance.reverse

```js
// 外部API 反转
instance.reverse = function() {
  toggleInstanceDirection();
  startTime = 0;
  lastTime = adjustTime(instance.currentTime);
}
```

* instance.restart

```js
// 外部API 重新执行
instance.restart = function() {
  instance.pause();
  instance.reset();
  instance.play();
}
```
 
* instance.reset
```js
// 外部API reset
instance.reset = function() {
  const direction = instance.direction;
  const loops = instance.loop;
  // 当前位置,进度 归零
  instance.currentTime = 0;
  instance.progress = 0;
  instance.paused = true;
  instance.began = false;
  instance.completed = false;
  instance.reversed = direction === 'reverse';
  instance.remaining = direction === 'alternate' && loops === 1 ? 2 : loops;
  setAnimationsProgress(0);
  for (let i = instance.children.length; i--; ){
    instance.children[i].reset();
  }
}
```

## 总结

1. 使用了`requestAnimateFrame`和`CSS`动画提高流畅度。
2. 使用了缓动函数，只需要通过`当前动画消耗的时间`，搭配其他定义的配置项，就可以计算出当前动画具体位置。



