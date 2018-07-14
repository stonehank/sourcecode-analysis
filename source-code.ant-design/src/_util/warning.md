```js
import warning from 'warning';

const warned: { [msg: string]: boolean} = {};
export default (valid: boolean, message: string): void => {
  // valid为false 并且 第一次warning
  if (!valid && !warned[message]) {
    // warning，当第一个参数为false，发出message
    warning(false, message);
    warned[message] = true;
  }
};

```