class CancellationToken {
  constructor(check) {
	  this.isCancellationRequested = check;
  }
}

export {CancellationToken};