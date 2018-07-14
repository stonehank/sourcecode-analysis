
* appear：首次出现动画
* enter：后续出现动画
* leave：后续离开动画
* animation：自定义动画（使用js）而不是className


```js


const util = {
  // isXXXSupported 指既可以使用className，也可以使用自定义js
  isAppearSupported(props) {
    return props.transitionName && props.transitionAppear || props.animation.appear;
  },
  isEnterSupported(props) {
    return props.transitionName && props.transitionEnter || props.animation.enter;
  },
  isLeaveSupported(props) {
    return props.transitionName && props.transitionLeave || props.animation.leave;
  },
  allowAppearCallback(props) {
    return props.transitionAppear || props.animation.appear;
  },
  allowEnterCallback(props) {
    return props.transitionEnter || props.animation.enter;
  },
  allowLeaveCallback(props) {
    return props.transitionLeave || props.animation.leave;
  },
};
export default util;


```