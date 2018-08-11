/* @flow */
import mapToZero from './mapToZero';
import stripStyle from './stripStyle';
import stepper from './stepper';
import mergeDiff from './mergeDiff';
import defaultNow from 'performance-now';
import defaultRaf from 'raf';
import shouldStopAnimation from './shouldStopAnimation';
import React from 'react';
import PropTypes from 'prop-types';

import type {
  ReactElement,
  PlainStyle,
  Velocity,
  TransitionStyle,
  TransitionPlainStyle,
  WillEnter,
  WillLeave,
  DidLeave,
  TransitionProps,
} from './Types';

const msPerFrame = 1000 / 60;

// the children function & (potential) styles function asks as param an
// Array<TransitionPlainStyle>, where each TransitionPlainStyle is of the format
// {key: string, data?: any, style: PlainStyle}. However, the way we keep
// internal states doesn't contain such a data structure (check the state and
// TransitionMotionState). So when children function and others ask for such
// data we need to generate them on the fly by combining mergedPropsStyles and
// currentStyles/lastIdealStyles

// 当styles是函数的时候，接受一个参数是type为TransitionPlainStyle，类似{key: string, data?: any, style: PlainStyle},
// mergedPropsStyles的style有可能不是PlainStyle格式的，因此要通过mergedPropsStyles和currentStyles/lastIdealStyles创建
// 此处如果unreadPropStyles有值就使用unreadPropStyles，否则使用mergedPropsStyles
function rehydrateStyles(
  mergedPropsStyles: Array<TransitionStyle>,
  unreadPropStyles: ?Array<TransitionStyle>,
  plainStyles: Array<PlainStyle>,
): Array<TransitionPlainStyle> {
  // Copy the value to a `const` so that Flow understands that the const won't
  // change and will be non-nullable in the callback below.
  const cUnreadPropStyles = unreadPropStyles;
  if (cUnreadPropStyles == null) {
    return mergedPropsStyles.map((mergedPropsStyle, i) => ({
      key: mergedPropsStyle.key,
      data: mergedPropsStyle.data,
      style: plainStyles[i],
    }));
  }
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

function shouldStopAnimationAll(
  currentStyles: Array<PlainStyle>,
  destStyles: Array<TransitionStyle>,
  currentVelocities: Array<Velocity>,
  mergedPropsStyles: Array<TransitionStyle>,
): boolean {
  // 判断已经排好序的动画序列和目标的动画序列长度是否相等
  if (mergedPropsStyles.length !== destStyles.length) {
    return false;
  }

  // 判断已经排好序的动画序列中的每一个key是否和目标动画序列对应的key相等
  for (let i = 0; i < mergedPropsStyles.length; i++) {
    if (mergedPropsStyles[i].key !== destStyles[i].key) {
      return false;
    }
  }

  // we have the invariant that mergedPropsStyles and
  // currentStyles/currentVelocities/last* are synced in terms of cells, see
  // mergeAndSync comment for more info
  // 对 每一个进行判断是否需要停止，有1个不能停止都为false
  for (let i = 0; i < mergedPropsStyles.length; i++) {
    if (!shouldStopAnimation(
        currentStyles[i],
        destStyles[i].style,
        currentVelocities[i])) {
      return false;
    }
  }

  return true;
}

// core key merging logic

// things to do: say previously merged style is {a, b}, dest style (prop) is {b,
// c}, previous current (interpolating) style is {a, b}
// **invariant**: current[i] corresponds to merged[i] in terms of key

// steps:
// turn merged style into {a?, b, c}
//    add c, value of c is destStyles.c
//    maybe remove a, aka call willLeave(a), then merged is either {b, c} or {a, b, c}
// turn current (interpolating) style from {a, b} into {a?, b, c}
//    maybe remove a
//    certainly add c, value of c is willEnter(c)
// loop over merged and construct new current
// dest doesn't change, that's owner's
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
  // 此处newMergedPropsStyles已经是排好序的动画序列
  for (let i = 0; i < newMergedPropsStyles.length; i++) {
    const newMergedPropsStyleCell = newMergedPropsStyles[i];
    let foundOldIndex = null;
    //
    for (let j = 0; j < oldMergedPropsStyles.length; j++) {
      if (oldMergedPropsStyles[j].key === newMergedPropsStyleCell.key) {
        foundOldIndex = j;
        break;
      }
    }
    // TODO: key search code
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

type TransitionMotionDefaultProps = {
  willEnter: WillEnter,
  willLeave: WillLeave,
  didLeave: DidLeave
}

type TransitionMotionState = {
  // list of styles, each containing interpolating values. Part of what's passed
  // to children function. Notice that this is
  // Array<ActualInterpolatingStyleObject>, without the wrapper that is {key: ...,
  // data: ... style: ActualInterpolatingStyleObject}. Only mergedPropsStyles
  // contains the key & data info (so that we only have a single source of truth
  // for these, and to save space). Check the comment for `rehydrateStyles` to
  // see how we regenerate the entirety of what's passed to children function
  currentStyles: Array<PlainStyle>,
  currentVelocities: Array<Velocity>,
  lastIdealStyles: Array<PlainStyle>,
  lastIdealVelocities: Array<Velocity>,
  // the array that keeps track of currently rendered stuff! Including stuff
  // that you've unmounted but that's still animating. This is where it lives
  mergedPropsStyles: Array<TransitionStyle>,
};

export default class TransitionMotion extends React.Component<TransitionProps, TransitionMotionState> {
  static propTypes = {
    defaultStyles: PropTypes.arrayOf(PropTypes.shape({
      key: PropTypes.string.isRequired,
      data: PropTypes.any,
      style: PropTypes.objectOf(PropTypes.number).isRequired,
    })),
    styles: PropTypes.oneOfType([
      PropTypes.func,
      PropTypes.arrayOf(PropTypes.shape({
        key: PropTypes.string.isRequired,
        data: PropTypes.any,
        style: PropTypes.objectOf(PropTypes.oneOfType([
          PropTypes.number,
          PropTypes.object,
        ])).isRequired,
      }),
      )]).isRequired,
    children: PropTypes.func.isRequired,
    willEnter: PropTypes.func,
    willLeave: PropTypes.func,
    didLeave: PropTypes.func,
  };

  static defaultProps: TransitionMotionDefaultProps = {
    // 默认直接返回目标值(无动画)
    willEnter: styleThatEntered => stripStyle(styleThatEntered.style),
    // recall: returning null makes the current unmounting TransitionStyle
    // disappear immediately
    // 返回null，就是直接消失
    willLeave: () => null,
    didLeave: () => {},
  };

  unmounting: boolean = false;
  animationID: ?number = null;
  prevTime = 0;
  accumulatedTime = 0;
  // it's possible that currentStyle's value is stale: if props is immediately
  // changed from 0 to 400 to spring(0) again, the async currentStyle is still
  // at 0 (didn't have time to tick and interpolate even once). If we naively
  // compare currentStyle with destVal it'll be 0 === 0 (no animation, stop).
  // In reality currentStyle should be 400
  unreadPropStyles: ?Array<TransitionStyle> = null;

  constructor(props: TransitionProps) {
    super(props);
    this.state = this.defaultState();
  }

  defaultState(): TransitionMotionState {
    const {defaultStyles, styles, willEnter, willLeave, didLeave} = this.props;
    // ** styles可以使对象也可以是函数，要有key属性
    const destStyles: Array<TransitionStyle> = typeof styles === 'function' ? styles(defaultStyles) : styles;

    // this is special. for the first time around, we don't have a comparison
    // between last (no last) and current merged props. we'll compute last so:
    // say default is {a, b} and styles (dest style) is {b, c}, we'll
    // fabricate last as {a, b}
    let oldMergedPropsStyles: Array<TransitionStyle>;
    if (defaultStyles == null) {
      oldMergedPropsStyles = destStyles;
    } else {
      oldMergedPropsStyles = (defaultStyles: any).map(defaultStyleCell => {
        // TODO: key search code
        for (let i = 0; i < destStyles.length; i++) {
          if (destStyles[i].key === defaultStyleCell.key) {
            return destStyles[i];
          }
        }
        return defaultStyleCell;
      });
    }
    const oldCurrentStyles = defaultStyles == null
      ? destStyles.map(s => stripStyle(s.style))
      : (defaultStyles: any).map(s => stripStyle(s.style));
    const oldCurrentVelocities = defaultStyles == null
      ? destStyles.map(s => mapToZero(s.style))
      : defaultStyles.map(s => mapToZero(s.style));
    // 此处mergedPropsStyles就是已经排好序的动画列
    const [mergedPropsStyles, currentStyles, currentVelocities, lastIdealStyles, lastIdealVelocities] = mergeAndSync(
      // Because this is an old-style createReactClass component, Flow doesn't
      // understand that the willEnter and willLeave props have default values
      // and will always be present.
      (willEnter: any),
      (willLeave: any),
      (didLeave: any),
      oldMergedPropsStyles,
      destStyles,
      oldCurrentStyles,
      oldCurrentVelocities,
      oldCurrentStyles, // oldLastIdealStyles really
      oldCurrentVelocities, // oldLastIdealVelocities really
    );

    return {
      currentStyles,
      currentVelocities,
      lastIdealStyles,
      lastIdealVelocities,
      mergedPropsStyles,
    };
  }

  // after checking for unreadPropStyles != null, we manually go set the
  // non-interpolating values (those that are a number, without a spring
  // config)
  clearUnreadPropStyle = (unreadPropStyles: Array<TransitionStyle>): void => {
    // 对动画进行合并及排序
    let [mergedPropsStyles, currentStyles, currentVelocities, lastIdealStyles, lastIdealVelocities] = mergeAndSync(
      (this.props.willEnter: any),
      (this.props.willLeave: any),
      (this.props.didLeave: any),
      this.state.mergedPropsStyles,
      unreadPropStyles,
      this.state.currentStyles,
      this.state.currentVelocities,
      this.state.lastIdealStyles,
      this.state.lastIdealVelocities,
    );

    // 如果是number，直接赋值为目标值
    for (let i = 0; i < unreadPropStyles.length; i++) {
      const unreadPropStyle = unreadPropStyles[i].style;
      let dirty = false;

      for (let key in unreadPropStyle) {
        if (!Object.prototype.hasOwnProperty.call(unreadPropStyle, key)) {
          continue;
        }

        const styleValue = unreadPropStyle[key];
        if (typeof styleValue === 'number') {
          if (!dirty) {
            dirty = true;
            currentStyles[i] = {...currentStyles[i]};
            currentVelocities[i] = {...currentVelocities[i]};
            lastIdealStyles[i] = {...lastIdealStyles[i]};
            lastIdealVelocities[i] = {...lastIdealVelocities[i]};
            mergedPropsStyles[i] = {
              key: mergedPropsStyles[i].key,
              data: mergedPropsStyles[i].data,
              style: {...mergedPropsStyles[i].style},
            };
          }
          currentStyles[i][key] = styleValue;
          currentVelocities[i][key] = 0;
          lastIdealStyles[i][key] = styleValue;
          lastIdealVelocities[i][key] = 0;
          mergedPropsStyles[i].style[key] = styleValue;
        }
      }
    }

    // unlike the other 2 components, we can't detect staleness and optionally
    // opt out of setState here. each style object's data might contain new
    // stuff we're not/cannot compare

    // 这里没有和之前2个组件一样使用if(dirty)是因为，每一个style的data都有可能包含新的属性，因此无法判断
    this.setState({
      currentStyles,
      currentVelocities,
      mergedPropsStyles,
      lastIdealStyles,
      lastIdealVelocities,
    });
  }

  // 动画思路和Motion思路差不多，只是对动画列表(已经排序)逐个计算
  startAnimationIfNecessary = (): void => {
    if (this.unmounting || this.animationID != null) {
      return;
    }

    // TODO: when config is {a: 10} and dest is {a: 10} do we raf once and
    // call cb? No, otherwise accidental parent rerender causes cb trigger
    this.animationID = defaultRaf((timestamp) => {
      // https://github.com/chenglou/react-motion/pull/420
      // > if execution passes the conditional if (this.unmounting), then
      // executes async defaultRaf and after that component unmounts and after
      // that the callback of defaultRaf is called, then setState will be called
      // on unmounted component.
      if (this.unmounting) {
        return;
      }

      const propStyles = this.props.styles;
      // 如果styles是函数，destStyles就是根据上一次的动画数据通过styles函数计算出本次的目标位置
      // 如果styles不是函数，destStyles就是styles，也就是本次动画目标位置
      let destStyles: Array<TransitionStyle> = typeof propStyles === 'function'
        ? propStyles(rehydrateStyles(
          this.state.mergedPropsStyles,
          this.unreadPropStyles,
          this.state.lastIdealStyles,
        ))
        : propStyles;

      // check if we need to animate in the first place
      // 判断是否需要停止动画
      if (shouldStopAnimationAll(
          this.state.currentStyles,
          destStyles,
          this.state.currentVelocities,
          this.state.mergedPropsStyles,
        )) {
        // no need to cancel animationID here; shouldn't have any in flight
        this.animationID = null;
        this.accumulatedTime = 0;
        return;
      }

      const currentTime = timestamp || defaultNow();
      const timeDelta = currentTime - this.prevTime;
      this.prevTime = currentTime;
      this.accumulatedTime = this.accumulatedTime + timeDelta;
      // more than 10 frames? prolly switched browser tab. Restart
      if (this.accumulatedTime > msPerFrame * 10) {
        this.accumulatedTime = 0;
      }

      if (this.accumulatedTime === 0) {
        // no need to cancel animationID here; shouldn't have any in flight
        this.animationID = null;
        this.startAnimationIfNecessary();
        return;
      }

      let currentFrameCompletion =
        (this.accumulatedTime - Math.floor(this.accumulatedTime / msPerFrame) * msPerFrame) / msPerFrame;
      const framesToCatchUp = Math.floor(this.accumulatedTime / msPerFrame);
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
        const newMergedPropsStyle = newMergedPropsStyles[i].style;
        let newCurrentStyle: PlainStyle = {};
        let newCurrentVelocity: Velocity = {};
        let newLastIdealStyle: PlainStyle = {};
        let newLastIdealVelocity: Velocity = {};

        for (let key in newMergedPropsStyle) {
          if (!Object.prototype.hasOwnProperty.call(newMergedPropsStyle, key)) {
            continue;
          }
          // newMergedPropsStyle就是当前排好序的动画目标值序列
          const styleValue = newMergedPropsStyle[key];
          if (typeof styleValue === 'number') {
            newCurrentStyle[key] = styleValue;
            newCurrentVelocity[key] = 0;
            newLastIdealStyle[key] = styleValue;
            newLastIdealVelocity[key] = 0;
          } else {
            let newLastIdealStyleValue = newLastIdealStyles[i][key];
            let newLastIdealVelocityValue = newLastIdealVelocities[i][key];
            for (let j = 0; j < framesToCatchUp; j++) {
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
            const [nextIdealX, nextIdealV] = stepper(
              msPerFrame / 1000,
              newLastIdealStyleValue,
              newLastIdealVelocityValue,
              styleValue.val,
              styleValue.stiffness,
              styleValue.damping,
              styleValue.precision,
            );

            newCurrentStyle[key] =
              newLastIdealStyleValue +
              (nextIdealX - newLastIdealStyleValue) * currentFrameCompletion;
            newCurrentVelocity[key] =
              newLastIdealVelocityValue +
              (nextIdealV - newLastIdealVelocityValue) * currentFrameCompletion;
            newLastIdealStyle[key] = newLastIdealStyleValue;
            newLastIdealVelocity[key] = newLastIdealVelocityValue;
          }
        }

        newLastIdealStyles[i] = newLastIdealStyle;
        newLastIdealVelocities[i] = newLastIdealVelocity;
        newCurrentStyles[i] = newCurrentStyle;
        newCurrentVelocities[i] = newCurrentVelocity;
      }

      this.animationID = null;
      // the amount we're looped over above
      this.accumulatedTime -= framesToCatchUp * msPerFrame;

      this.setState({
        currentStyles: newCurrentStyles,
        currentVelocities: newCurrentVelocities,
        lastIdealStyles: newLastIdealStyles,
        lastIdealVelocities: newLastIdealVelocities,
        mergedPropsStyles: newMergedPropsStyles,
      });

      this.unreadPropStyles = null;

      this.startAnimationIfNecessary();
    });
  }

  componentDidMount() {
    this.prevTime = defaultNow();
    this.startAnimationIfNecessary();
  }

  componentWillReceiveProps(props: TransitionProps) {
    // 有未完成的帧，调用clearUnreadPropStyle
    if (this.unreadPropStyles) {
      // previous props haven't had the chance to be set yet; set them here
      this.clearUnreadPropStyle(this.unreadPropStyles);
    }

    const styles = props.styles;
    // 通过styles计算出目标值赋值给unreadPropStyles
    if (typeof styles === 'function') {
      this.unreadPropStyles = styles(
        rehydrateStyles(
          this.state.mergedPropsStyles,
          this.unreadPropStyles,
          this.state.lastIdealStyles,
        )
      );
    } else {
      this.unreadPropStyles = styles;
    }

    if (this.animationID == null) {
      this.prevTime = defaultNow();
      this.startAnimationIfNecessary();
    }
  }

  componentWillUnmount() {
    this.unmounting = true;
    if (this.animationID != null) {
      defaultRaf.cancel(this.animationID);
      this.animationID = null;
    }
  }

  render(): ReactElement {
    // 通过currentStyles转化为children参数需要的格式
    const hydratedStyles = rehydrateStyles(
      this.state.mergedPropsStyles,
      this.unreadPropStyles,
      this.state.currentStyles,
    );
    const renderedChildren = this.props.children(hydratedStyles);
    return renderedChildren && React.Children.only(renderedChildren);
  }
}
