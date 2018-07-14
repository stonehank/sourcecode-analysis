* 一些关于children的处理方法

```js
import React from 'react';

// children变为数组
export function toArrayChildren(children) {
  const ret = [];
  React.Children.forEach(children, (child) => {
    ret.push(child);
  });
  return ret;
}

// 找出key为参数key的child
export function findChildInChildrenByKey(children, key) {
  let ret = null;
  if (children) {
    children.forEach((child) => {
      if (ret) {
        return;
      }
      if (child && child.key === key) {
        ret = child;
      }
    });
  }
  return ret;
}

// 找出key为参数key，并且showProp为true的child，如果有多于1个，抛出错误
export function findShownChildInChildrenByKey(children, key, showProp) {
  let ret = null;
  if (children) {
    children.forEach((child) => {
      if (child && child.key === key && child.props[showProp]) {
        if (ret) {
          throw new Error('two child with same key for <rc-animate> children');
        }
        ret = child;
      }
    });
  }
  return ret;
}

export function findHiddenChildInChildrenByKey(children, key, showProp) {
  let found = 0;
  if (children) {
    children.forEach((child) => {
      if (found) {
        return;
      }
      found = child && child.key === key && !child.props[showProp];
    });
  }
  return found;
}

// 判断c1和c2是否相同（通过length，遍历后每一个key，showProp）
export function isSameChildren(c1, c2, showProp) {
  // 长度相等
  let same = c1.length === c2.length;
  if (same) {
    c1.forEach((child, index) => {
      const child2 = c2[index];
      // 每一个index下child都存在
      if (child && child2) {
        // todo 此处是否与上面冲突(永远不可能实现？)
        if ((child && !child2) || (!child && child2)) {
          same = false;
          // 判断key
        } else if (child.key !== child2.key) {
          same = false;
          // 如果有传递showProp 判断showProp
        } else if (showProp && child.props[showProp] !== child2.props[showProp]) {
          same = false;
        }
      }
    });
  }
  return same;
}

// 返回prev和next中无重复的子元素（用child.key作为判断依据）,重复项使用next的
// 返回prev和next中(一直存在的组件(使用next的)，从无到有的组件(使用next的)，从有到无的组件(使用prev的))
export function mergeChildren(prev, next) {
  let ret = [];

  // For each key of `next`, the list of keys to insert before that key in
  // the combined list
  const nextChildrenPending = {};
  let pendingChildren = [];
  // 此处处理之后得到的
  prev.forEach((child) => {
    // 能再next中找到key和prev中值的key属性相等的（组件一直都存在的）
    if (child && findChildInChildrenByKey(next, child.key)) {
      // pendingChildren 有值
      if (pendingChildren.length) {
        // 以child.key为key，值为独一无二的child组成的数组
        nextChildrenPending[child.key] = pendingChildren;
        pendingChildren = [];
      }
      // prev中独一无二的，放入pendingChildren（组件prev时存在，next不存在，从有到无的）
    } else {
      pendingChildren.push(child);
    }
  });

  next.forEach((child) => {
    // child存在 并且当前key对应的nextChildrenPending上有值
    if (child && nextChildrenPending.hasOwnProperty(child.key)) {
      // concat这些值(独一无二的prev的child组成的数组)
      ret = ret.concat(nextChildrenPending[child.key]);
    }
    // next的所有child（包括一直存在的和从无到有的）
    ret.push(child);
  });

  // 将之前有可能在pendingChildren里剩下的值合并
  ret = ret.concat(pendingChildren);

  return ret;
}

```