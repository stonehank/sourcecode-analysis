/* @flow */
import type {TransitionStyle} from './Types';

// core keys merging algorithm. If previous render's keys are [a, b], and the
// next render's [c, b, d], what's the final merged keys and ordering?

// - c and a must both be before b
// - b before d
// - ordering between a and c ambiguous

// this reduces to merging two partially ordered lists (e.g. lists where not
// every item has a definite ordering, like comparing a and c above). For the
// ambiguous ordering we deterministically choose to place the next render's
// item after the previous'; so c after a

// this is called a topological sorting. Except the existing algorithms don't
// work well with js bc of the amount of allocation, and isn't optimized for our
// current use-case bc the runtime is linear in terms of edges (see wiki for
// meaning), which is huge when two lists have many common elements


// 这里讲述了怎么判断动画的执行顺序，因为有添加和删除，用到了拓扑排序的思想
// 例如：
// 旧的序列： a -> b -> x
// 新的序列： c -> b -> d
// 那么很显然 a和c 在b的前面执行， x和d在b的后面执行

// 那么a和c的顺序，x和d的顺序怎么判断
// 这里使用的是next默认在后面，即默认 a -> c ; x -> d
export default function mergeDiff(
  prev: Array<TransitionStyle>,
  next: Array<TransitionStyle>,
  onRemove: (prevIndex: number, prevStyleCell: TransitionStyle) => ?TransitionStyle
): Array<TransitionStyle> {
  // bookkeeping for easier access of a key's index below. This is 2 allocations +
  // potentially triggering chrome hash map mode for objs (so it might be faster
  // to loop through and find a key's index each time), but I no longer care

  // 保存初始index的顺序，后面排序比较时使用
  let prevKeyIndex: {[key: string]: number} = {};
  for (let i = 0; i < prev.length; i++) {
    prevKeyIndex[prev[i].key] = i;
  }
  let nextKeyIndex: {[key: string]: number} = {};
  for (let i = 0; i < next.length; i++) {
    nextKeyIndex[next[i].key] = i;
  }

  // first, an overly elaborate way of merging prev and next, eliminating
  // duplicates (in terms of keys). If there's dupe, keep the item in next).
  // This way of writing it saves allocations

  // 先保存所有next中的动画序列，再去处理prev中的
  let ret = [];
  for (let i = 0; i < next.length; i++) {
    ret[i] = next[i];
  }
  for (let i = 0; i < prev.length; i++) {
    // prev中有key的属性，而next中这个属性名无key，说明是要删除的
    if (!Object.prototype.hasOwnProperty.call(nextKeyIndex, prev[i].key)) {
      // this is called my TM's `mergeAndSync`, which calls willLeave. We don't
      // merge in keys that the user desires to kill
      // 如果已经删除，返回null，如果正在执行删除动画，返回状态
      const fill = onRemove(i, prev[i]);
      if (fill != null) {
        // 添加进ret
        ret.push(fill);
      }
    }
  }

  // now all the items all present. Core sorting logic to have the right order
  // ret就是所有要进行的动画，现在进行排序
  return ret.sort((a, b) => {
    const nextOrderA = nextKeyIndex[a.key];
    const nextOrderB = nextKeyIndex[b.key];
    const prevOrderA = prevKeyIndex[a.key];
    const prevOrderB = prevKeyIndex[b.key];

    // a,b都在next，按next的位置排序
    if (nextOrderA != null && nextOrderB != null) {
      // both keys in next
      return nextKeyIndex[a.key] - nextKeyIndex[b.key];
      // a,b都在prev，按prev的位置排序
    } else if (prevOrderA != null && prevOrderB != null) {
      // both keys in prev
      return prevKeyIndex[a.key] - prevKeyIndex[b.key];
      // a在next，b在prev
    } else if (nextOrderA != null) {
      // key a in next, key b in prev

      // how to determine the order between a and b? We find a "pivot" (term
      // abuse), a key present in both prev and next, that is sandwiched between
      // a and b. In the context of our above example, if we're comparing a and
      // d, b's (the only) pivot

      // 采取找中间值的办法，
      // 例如
      // 旧的：a, b, x
      // 新的：c, b, d
      // 初始ret顺序为： c->b->d->a->x
      // a和x都不在新的里面，因此
      // 如果判断 a 和 d 的顺序，找中间值 b， a<b， d>b， 因此 a->b->d
      // 如果判断 x 和 d 的顺序，没有中间值，因此按照next放在后面  x->d
      for (let i = 0; i < next.length; i++) {
        const pivot = next[i].key;
        // prev没有这个中间值，跳过
        if (!Object.prototype.hasOwnProperty.call(prevKeyIndex, pivot)) {
          continue;
        }
        // next和prev都存在，判断之前的位置关系
        if (nextOrderA < nextKeyIndex[pivot] && prevOrderB > prevKeyIndex[pivot]) {
          return -1;
        } else if (nextOrderA > nextKeyIndex[pivot] && prevOrderB < prevKeyIndex[pivot]) {
          return 1;
        }
      }
      // 默认为next放后面
      // pluggable. default to: next bigger than prev
      return 1;
    }
    // b在next, a在prev
    // prevOrderA, nextOrderB
    for (let i = 0; i < next.length; i++) {
      const pivot = next[i].key;
      if (!Object.prototype.hasOwnProperty.call(prevKeyIndex, pivot)) {
        continue;
      }
      if (nextOrderB < nextKeyIndex[pivot] && prevOrderA > prevKeyIndex[pivot]) {
        return 1;
      } else if (nextOrderB > nextKeyIndex[pivot] && prevOrderA < prevKeyIndex[pivot]) {
        return -1;
      }
    }
    // pluggable. default to: next bigger than prev
    return -1;
  });
}
