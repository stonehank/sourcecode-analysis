// @flow
import React, { type Node } from 'react';
import createReactContext from 'create-react-context';

type Listener = () => mixed;

const StateContext = createReactContext(null);

// 自定义组件
export class Container<State: {}> {
  state: State;
  _listeners: Array<Listener> = [];

  constructor() {
    CONTAINER_DEBUG_CALLBACKS.forEach(cb => cb(this));
  }

  setState(
    updater: $Shape<State> | ((prevState: $Shape<State>) => $Shape<State>),
    callback?: () => void
  ): Promise<void> {
    return Promise.resolve().then(() => {
      let nextState;

      // 赋值nextState
      if (typeof updater === 'function') {
        nextState = updater(this.state);
      } else {
        nextState = updater;
      }

      // 为null 则执行callback 返回
      if (nextState == null) {
        if (callback) callback();
        return;
      }

      // 合并
      this.state = Object.assign({}, this.state, nextState);

      // 执行listener(通过真正React的setState重新渲染)，这里是一个promise
      let promises = this._listeners.map(listener => listener());


      // 所有
      return Promise.all(promises).then(() => {
        // 全部listener执行完毕，执行回调
        if (callback) {
          return callback();
        }
      });
    });
  }

  // 增加订阅(这里默认的订阅就是React的setState空值(为了重新渲染)，也可以添加自定义监听函数)
  subscribe(fn: Listener) {
    this._listeners.push(fn);
  }

  // 取消订阅
  unsubscribe(fn: Listener) {
    this._listeners = this._listeners.filter(f => f !== fn);
  }
}

export type ContainerType = Container<Object>;
export type ContainersType = Array<Class<ContainerType> | ContainerType>;
export type ContainerMapType = Map<Class<ContainerType>, ContainerType>;

export type SubscribeProps<Containers: ContainersType> = {
  to: Containers,
  children: (
    ...instances: $TupleMap<Containers, <C>(Class<C> | C) => C>
  ) => Node
};

type SubscribeState = {};

const DUMMY_STATE = {};

  /* React组件 */
export class Subscribe<Containers: ContainersType> extends React.Component<
  SubscribeProps<Containers>,
  SubscribeState
> {
  state = {};
  // 存放传入的状态组件
  instances: Array<ContainerType> = [];
  unmounted = false;

  componentWillUnmount() {
    this.unmounted = true;
    this._unsubscribe();
  }

  _unsubscribe() {
    this.instances.forEach(container => {
      // container为当前组件的每一个状态管理实例
      // 删除listeners中的this.onUpdate
      container.unsubscribe(this.onUpdate);
    });
  }

  onUpdate: Listener = () => {
    return new Promise(resolve => {
      // 组件未被卸载
      if (!this.unmounted) {
        // 纯粹是为了让React更新组件
        this.setState(DUMMY_STATE, resolve);
      } else {
        // 已经被卸载则直接返回
        resolve();
      }
    });
  };

  _createInstances(
    map: ContainerMapType | null,
    containers: ContainersType
  ): Array<ContainerType> {
    // 首先全部instances解除订阅(清除当前组件对应的状态组件实例中的监听方法 this.onUpdate)
      // 因为有可能取消某一个状态管理组件
    this._unsubscribe();

    // 必须存在map 必须被Provider包裹才会有map
    if (map === null) {
      throw new Error(
        'You must wrap your <Subscribe> components with a <Provider>'
      );
    }

    let safeMap = map;
    // 重新定义当前组件的状态管理组件(根据to传入的数组)
    let instances = containers.map(ContainerItem => {
      let instance;

      // 传入的是Container组件，则使用
      if (
        typeof ContainerItem === 'object' &&
        ContainerItem instanceof Container
      ) {
        instance = ContainerItem;
      } else {
        // 传入的不是Container，可能是其他自定义组件等等(需要用new执行)，尝试获取
        instance = safeMap.get(ContainerItem);

        // 不存在则以它为key，value是新的Container组件
        if (!instance) {
          instance = new ContainerItem();
          safeMap.set(ContainerItem, instance);
        }
      }

      // 先解绑再绑定，避免重复订阅
      instance.unsubscribe(this.onUpdate);
      instance.subscribe(this.onUpdate);

      return instance;
    });

    this.instances = instances;
    return instances;
  }

  render() {
    return (
      <StateContext.Consumer>
      /* Provider传递的map */
      {map =>
          // children是函数
          this.props.children.apply(
            null,
            // 传给子函数的参数(传进当前组件的状态管理实例)
            this._createInstances(map, this.props.to)
          )
        }
      </StateContext.Consumer>
    );
  }
}

export type ProviderProps = {
  inject?: Array<ContainerType>,
  children: Node
};

    /* Provider 可以嵌套使用 ，能够获取到上一层Provider中保存的状态组件*/
export function Provider(props: ProviderProps) {
  return (
    <StateContext.Consumer>
      {parentMap => {
        let childMap = new Map(parentMap);

        if (props.inject) {
          props.inject.forEach(instance => {
            childMap.set(instance.constructor, instance);
          });
        }

        // 负责将childMap传递，初始为null
        return (
          <StateContext.Provider value={childMap}>
            {props.children}
          </StateContext.Provider>
        );
      }}
    </StateContext.Consumer>
  );
}

let CONTAINER_DEBUG_CALLBACKS = [];

// If your name isn't Sindre, this is not for you.
// I might ruin your day suddenly if you depend on this without talking to me.
export function __SUPER_SECRET_CONTAINER_DEBUG_HOOK__(
  callback: (container: Container<any>) => mixed
) {
  CONTAINER_DEBUG_CALLBACKS.push(callback);
}
