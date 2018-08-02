import { Subject, from, queueScheduler } from 'rxjs';
import { map, mergeMap, observeOn, subscribeOn } from 'rxjs/operators';
import { ActionsObservable } from './ActionsObservable';
import { StateObservable } from './StateObservable';

export function createEpicMiddleware(options = {}) {
  if (process.env.NODE_ENV !== 'production' && typeof options === 'function') {
    throw new TypeError('Providing your root Epic to `createEpicMiddleware(rootEpic)` is no longer supported, instead use `epicMiddleware.run(rootEpic)`\n\nLearn more: https://redux-observable.js.org/MIGRATION.html#setting-up-the-middleware');
  }

  const epic$ = new Subject();
  let store;

  // 作为redux的中间件
  const epicMiddleware = _store => {
    if (process.env.NODE_ENV !== 'production' && store) {
      // https://github.com/redux-observable/redux-observable/issues/389
      require('./utils/console').warn('this middleware is already associated with a store. createEpicMiddleware should be called for every store.\n\nLearn more: https://goo.gl/2GQ7Da');
    }
    store = _store;
    // actionSubject$.source=<Subject>
    const actionSubject$ = new Subject().pipe(
      observeOn(queueScheduler)
    );
    const stateSubject$ = new Subject().pipe(
      observeOn(queueScheduler)
    );
    const action$ = new ActionsObservable(actionSubject$);
    // 一个保存当前状态的发射源，通过__subscription.next改变内部value(引用对比)
    // todo constructor??
    const state$ = new StateObservable(stateSubject$, store.getState());


    const result$ = epic$.pipe(
      // 对发射源逐个处理
      map(epic => {
        const output$ = 'dependencies' in options
          ? epic(action$, state$, options.dependencies)
          : epic(action$, state$);

        // 无返回值，应该要返回一个流
        if (!output$) {
          throw new TypeError(`Your root Epic "${epic.name || '<anonymous>'}" does not return a stream. Double check you\'re not missing a return statement!`);
        }

        return output$;
      }),
      mergeMap(output$ =>
        from(output$).pipe(
          subscribeOn(queueScheduler),
          observeOn(queueScheduler)
        )
      )
    );
    // 订阅 dispatch，一旦有发射源的流进入，先经过上面pipe的过程，再dispatch($output)
    // result$.subscribe(x=>console.log(x));
    result$.subscribe(store.dispatch);

    return next => {
      return action => {
        // Downstream middleware gets the action first,
        // which includes their reducers, so state is
        // updated before epics receive the action
        const result = next(action);

        // It's important to update the state$ before we emit
        // the action because otherwise it would be stale
        stateSubject$.next(store.getState());
        // console.log(store.getState())
        actionSubject$.next(action);

        return result;
      };
    };
  };

  epicMiddleware.run = rootEpic => {
    if (process.env.NODE_ENV !== 'production' && !store) {
      require('./utils/console').warn('epicMiddleware.run(rootEpic) called before the middleware has been setup by redux. Provide the epicMiddleware instance to createStore() first.');
    }
    //
    epic$.next(rootEpic);
  };

  return epicMiddleware;
}
