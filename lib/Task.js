import {_refs} from './Resource';
class TaskState {
  constructor(task, token) {
    this.destructed = false;
    this.cancelled = false;
    this.next = task.next.bind(task);
    this.throw = task.throw.bind(task);
    this.return = task.return.bind(task);
    this.using = [];
    this.mandates = [];
    if (token !== undefined) this.mandates.push(token);
  }
  
  destruct() {
    if (this.destructed) return;
    this.destructed = true;
    for (let res of this.using) {
      try {
        _refs.get(res).unref();
      }
      catch (e) {
        console.log(e);
      }
    }
  }
  
  isCancelled() {
    for (let mandate of this.mandates) {
      if (mandate.isCancellationRequested()) {
        return true;
      }
    }
  }
}

const START = Promise.resolve({
  done: false,
  value: undefined
});
let current;
function associate(fn, state) {
  return (v) => {
    current = state;
    try {
      return fn(v);
    }
    finally {
      current = null;
    }
  }
}
class Task {
  constructor(genfn, token) {
	  return new Promise((f,r) => {
      const state = new TaskState(genfn(), token);
      
      START.then(progress, r);
      
      let _done = false;
      function progress(iter) {
        if (_done) return;
        if (state.isCancelled()) {
          _done = true;
          Promise.resolve(undefined)
            .then(state.return)
            .then(progressBail);
          return;
        }
        const done = iter.done;
        const value = iter.value;
        if (done) {
          _done = true;
          state.destruct();
          f(value);
          return;
        }
        
        Promise.resolve(value)
          .then(
            associate(state.next, state),
            associate(state.throw, state)
          )
          .then(progress, e => {
            _done = true;
            state.destruct();
            r(e);
          });
      }
      
      function progressBail(iter) {
        const done = iter.done;
        const value = iter.value;
        if (done) {
          state.destruct();
          return;
        }
        
        Promise.resolve(value)
          .then(
            associate(state.next, state),
            associate(state.throw, state)
          )
          .then(progressBail, _ => {
            state.destruct();
          });
      }
    });
  }
  static using(res) {
    if (!current) throw new EvalError('Not in a task');
    if (!_refs.has(res)) throw new TypeError('res must be a Resource');
    _refs.get(res).ref();
    current.using.push(res);
  }
  /* REMOVED until lockfile usecase requirement is proven
  static affording(token) {
    if (!current) throw new EvalError('Not in a task');
    if (typeof token.isCancellationRequested !== 'function') {
      throw new TypeError('token.isCancellationRequested must be a function');
    }
    current.mandates.push(token);
  }
  */
}
export {Task};