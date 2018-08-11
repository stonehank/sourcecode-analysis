/* @flow */
import mapToZero from './mapToZero';
import stripStyle from './stripStyle';
import stepper from './stepper';
import defaultNow from 'performance-now';
import defaultRaf from 'raf';
import shouldStopAnimation from './shouldStopAnimation';
import React from 'react';
import PropTypes from 'prop-types';

import type {ReactElement, PlainStyle, Style, Velocity, MotionProps} from './Types';

const msPerFrame = 1000 / 60;

type MotionState = {
  currentStyle: PlainStyle,
  currentVelocity: Velocity,
  lastIdealStyle: PlainStyle,
  lastIdealVelocity: Velocity,
};

export default class Motion extends React.Component<MotionProps, MotionState> {
  static propTypes = {
    // TOOD: warn against putting a config in here
    defaultStyle: PropTypes.objectOf(PropTypes.number),
    style: PropTypes.objectOf(PropTypes.oneOfType([
      PropTypes.number,
      PropTypes.object,
    ])).isRequired,
    children: PropTypes.func.isRequired,
    onRest: PropTypes.func,
  };

  constructor(props: MotionProps) {
    super(props);
    this.state = this.defaultState();
  }

  unmounting: boolean = false;
  wasAnimating: boolean = false;
  animationID: ?number = null;
  prevTime: number = 0;
  accumulatedTime: number = 0;

  defaultState(): MotionState {
    // defaultStyles指定一个初始值，后续计算不处理它
    const {defaultStyle, style} = this.props;
    const currentStyle = defaultStyle || stripStyle(style);
    // 对每一个位置，默认速度都为0
    const currentVelocity = mapToZero(currentStyle);
    return {
      currentStyle,
      currentVelocity,
      lastIdealStyle: currentStyle,
      lastIdealVelocity: currentVelocity,
    };
  }

  // it's possible that currentStyle's value is stale: if props is immediately
  // changed from 0 to 400 to spring(0) again, the async currentStyle is still
  // at 0 (didn't have time to tick and interpolate even once). If we naively
  // compare currentStyle with destVal it'll be 0 === 0 (no animation, stop).
  // In reality currentStyle should be 400

  // unreadPropStyle的意义是当连续调用 x:0 -->x:400 --->x:spring(0)这种情况，
  // 默认会跳过400，因为在下一次raf调用之前，又触发x:spring(0)，但这时已经有animateID(400那个触发的)，因此x:spring(0)不会执行，
  // 但是它改变了当前motion的style，因此x:400执行raf的时候，对比的是当前位置0，和style的目标位置0，相等，因此不会触发动画

  // 如果使用unreadPropStyle，当检测到unreadPropStyle有值，说明上一次的raf未结束就又触发新的，于是就进入clearUnreadPropStyle
  // 手动触发this.setState
  unreadPropStyle: ?Style = null;
  // after checking for unreadPropStyle != null, we manually go set the
  // non-interpolating values (those that are a number, without a spring
  // config)
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
        // 当有多个属性，一次全部解构获取，而不是多次(每次更新一个)，防止漏掉
        if (!dirty) {
          dirty = true;
          currentStyle = {...currentStyle};
          currentVelocity = {...currentVelocity};
          lastIdealStyle = {...lastIdealStyle};
          lastIdealVelocity = {...lastIdealVelocity};
        }
        // 更新当前对应属性为目标值
        currentStyle[key] = styleValue;
        currentVelocity[key] = 0;
        lastIdealStyle[key] = styleValue;
        lastIdealVelocity[key] = 0;
      }
    }

    if (dirty) {
      this.setState({currentStyle, currentVelocity, lastIdealStyle, lastIdealVelocity});
    }
  };

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

      // check if we need to animate in the first place
      const propsStyle: Style = this.props.style;


      if (shouldStopAnimation(
        this.state.currentStyle,
        propsStyle,
        this.state.currentVelocity,
      )) {
        // 如果是从动画中停止的，调用onRest
        if (this.wasAnimating && this.props.onRest) {
          this.props.onRest();
        }

        // no need to cancel animationID here; shouldn't have any in flight
        this.animationID = null;
        this.wasAnimating = false;
        this.accumulatedTime = 0;
        return;
      }

      // 开始进行动画
      this.wasAnimating = true;
      // 当前的时间戳
      const currentTime = timestamp || defaultNow();
      // 这一帧消耗的时间
      const timeDelta = currentTime - this.prevTime;
      // 更新prevTime
      this.prevTime = currentTime;
      // 上一次的偏差值+本次的差值，计算出本次的偏差值，作为下一次的accumulateTime
      this.accumulatedTime = this.accumulatedTime + timeDelta;
      // more than 10 frames? prolly switched browser tab. Restart
      // 偏差时间超过了10帧，按照当前的位置和速度重新开始
      if (this.accumulatedTime > msPerFrame * 10) {
        this.accumulatedTime = 0;
      }
      if (this.accumulatedTime === 0) {
        this.animationID = null;
        this.startAnimationIfNecessary();
        return;
      }

      /*
      * 20ms  1 frame=16.67ms
      * currentFrameCompletion=3.33/16.67
      * framesToCatchUp=1
      * */
      // 当前偏差值
      let currentFrameCompletion =
        (this.accumulatedTime - Math.floor(this.accumulatedTime / msPerFrame) * msPerFrame) / msPerFrame;
      // 当前可执行的帧数，算上上次的偏差值计算得出
      const framesToCatchUp = Math.floor(this.accumulatedTime / msPerFrame);

      let newLastIdealStyle: PlainStyle = {};
      let newLastIdealVelocity: Velocity = {};
      let newCurrentStyle: PlainStyle = {};
      let newCurrentVelocity: Velocity = {};

      for (let key in propsStyle) {
        if (!Object.prototype.hasOwnProperty.call(propsStyle, key)) {
          continue;
        }

        const styleValue = propsStyle[key];
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
          // 计算next是为了计算偏差值所占有的速度和位置
          const [nextIdealX, nextIdealV] = stepper(
            msPerFrame / 1000,
            newLastIdealStyleValue,
            newLastIdealVelocityValue,
            styleValue.val,
            styleValue.stiffness,
            styleValue.damping,
            styleValue.precision,
          );

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

      this.animationID = null;
      // the amount we're looped over above
      // 此次的偏差值为减去此次帧数所消耗的时间
      this.accumulatedTime -= framesToCatchUp * msPerFrame;


      this.setState({
        currentStyle: newCurrentStyle,
        currentVelocity: newCurrentVelocity,
        lastIdealStyle: newLastIdealStyle,
        lastIdealVelocity: newLastIdealVelocity,
      });

      this.unreadPropStyle = null;

      this.startAnimationIfNecessary();
    });
  };

  componentDidMount() {
    this.prevTime = defaultNow();
    this.startAnimationIfNecessary();
  }

  componentWillReceiveProps(props: MotionProps) {
    // 如果unreadPropStyle有值，说明config的值被设置成数字并且被跳过了，需要清除(也就是直接跳转到位置)
    if (this.unreadPropStyle != null) {
      // previous props haven't had the chance to be set yet; set them here
      // 先检查是否有number的style，如果有就直接跳转到位置，然后再执行spring(或者其他)
      this.clearUnreadPropStyle(this.unreadPropStyle);
    }

    this.unreadPropStyle = props.style;
    // this.animationID == null 说明之前没有未结束的raf
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

  // children接收参数currentStyle
  render(): ReactElement {
    const renderedChildren = this.props.children(this.state.currentStyle);
    return renderedChildren && React.Children.only(renderedChildren);
  }
}
