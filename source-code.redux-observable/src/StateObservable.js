import { Observable, Subject } from 'rxjs';

export class StateObservable extends Observable {
  constructor(stateSubject, initialState) {
    super(subscriber => {
      const subscription = this.__notifier.subscribe(subscriber);
      if (subscription && !subscription.closed) {
        subscriber.next(this.value);
      }
      return subscription;
    });

    this.value = initialState;
    this.__notifier = new Subject();
    this.__subscription = stateSubject.subscribe(value => {
      if (value !== this.value) {
        this.value = value;
        this.__notifier.next(value);
      }
    });
  }
}
