const _refs = new WeakMap();
class ResourceState {
  constructor(dispose) {
    this.used = false;
    this.destructed = false;
    this.refs = 0;
    this.dispose = dispose;
  }
  ref() {
    this.used = true;
    this.refs++;
  }
  unref() {
    if (this.destructed) return;
    this.refs--;
    if (this.refs === 0) {
      this.destructed = true;
      this.dispose();
    }
  }
}
class Resource {
  constructor(dispose) {
    const state = new ResourceState(dispose);
    _refs.set(this, state);
    setImmediate(_ => {
      if (!state.used) {
      console.log('Resource was allocated but not used immediately', this);
      }
    });
  }
  
  use(scope) {
    _refs.get(this).ref();
    scope();
    _refs.get(this).unref();
  }
}

export {_refs, Resource};