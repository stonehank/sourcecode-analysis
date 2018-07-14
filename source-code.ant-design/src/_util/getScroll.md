```js
export default function getScroll(target: any, top: boolean): number {
  if (typeof window === 'undefined') {
    return 0;
  }

  //如果是window则用pageYoffset，非window用scrollTop（pageYoffset是只读的，性能更好，但只能用于整个文档）
  const prop = top ? 'pageYOffset' : 'pageXOffset';
  const method = top ? 'scrollTop' : 'scrollLeft';
  const isWindow = target === window;

  let ret = isWindow ? target[prop] : target[method];
  // ie6,7,8 standard mode
  // 兼容模式，使用document.documentElement.scrollTop;
  if (isWindow && typeof ret !== 'number') {
    ret = window.document.documentElement[method];
  }

  return ret;
}

```