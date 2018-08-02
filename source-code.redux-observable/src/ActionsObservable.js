import { Observable, of, from } from 'rxjs';
import { ofType } from './operators';

export class ActionsObservable extends Observable {
  // of 创建一个 observable
  static of(...actions) {
    return new this(of(...actions));
  }
  // from 创建一个 observable
  static from(actions, scheduler) {
    return new this(from(actions, scheduler));
  }

  constructor(actionsSubject) {
    super();
    this.source = actionsSubject;
  }

  lift(operator) {
    const observable = new ActionsObservable(this);
    observable.operator = operator;
    return observable;
  }

  ofType(...keys) {
    return ofType(...keys)(this);
  }
}
window.ActionsObservable=ActionsObservable