```js
import raf from 'raf';


export default function throttleByAnimationFrame(fn: (...args: any[]) => void) {
  let requestId: number | null;

  const later = (args: any[]) => () => {
    requestId = null;
    fn(...args);
  };

  const throttled = (...args: any[]) => {
    if (requestId == null) {
      // raf:requestAnimationFrame
      requestId = raf(later(args));
    }
  };

  (throttled as any).cancel = () => raf.cancel(requestId!);

  return throttled;
}


export function throttleByAnimationFrameDecorator() {
  //传入类的（静态成员）构造函数或者（实例成员）类的原型，成员的key，成员的属性描述
  return function(target: any, key: string, descriptor: any) {
    //成员的值
    let fn = descriptor.value;
    let definingProperty = false;
    //返回成员的属性描述
    return {
      configurable: true,
      get() {
        //对于实例成员
        //this是组件
        if (definingProperty || this === target.prototype || this.hasOwnProperty(key)) {
          //返回值
          return fn;
        }

        let boundFn = throttleByAnimationFrame(fn.bind(this));
        definingProperty = true;
        Object.defineProperty(this, key, {
          value: boundFn,
          configurable: true,
          //Object.defineProperty后writable默认为false，因此要设置为true
          writable: true,
        });
        definingProperty = false;
        //返回配置了 requestAnimationFrame 的fn
        return boundFn;
      },
    };
  };
}

```