import {CancellationToken,Resource,Task} from '../';
import {lock} from 'proper-lockfile';
import * as fs from 'fs';

let writable = 
	// if you want to see errors safely propagate
	null
	// if you want to see it on stdout
	// process.stdout
	
// simple example of using a lockfile to cancel tasks
for (let file of process.argv.slice(2)) {
	new Task(streamFileToStdout(file));
}

function* streamFileToStdout(file) {
	let stream = fs.createReadStream(file);
	yield lockfileTask('stdout', function* (cancellationToken) {
		console.log(`== start ${file} ==`);
		try {
			yield pipePromise(stream, writable, cancellationToken);
		}
		catch (e) {
			console.error(`== error ${file} : ${e.message} ==`);
			throw e;
		}
		finally {
			console.log(`== stop ${file} ==`)
		}
	});
}

// helper to wrap existing NPM lib with a resource/cancellationToken
function lockfileTask(file, genfn) {
	return new Task(function* () {
		// when are lock becomes stale, it should cancel the operation
    	let stale = false;
		const cancellationToken = new CancellationToken(_ => stale);
		// acquite the actual lockfile
		// little bit verbose due to options, but this is a scheduling lib
		// and that is the responsibility of the lockfile lib
		const release = yield new Promise((fulfill,reject) => {
			lock(file, {realpath: false, retries: 10},
				_ => stale = true,
				(e, release) => e ?
					reject(e) :
					fulfill(release)
			);
		});
		// make sure release is called, however this task ends
		Task.using(new Resource(release));
		yield new Task(genfn(cancellationToken), cancellationToken);
	});
};


function pipePromise(readable, writable, cancellationToken) {
	return new Task(function* () {
		let dead = false;
		let hadError = false;
		let error = null;
		readable.on('error', e => {
			hadError = true;
			error = e;
		});
		Task.affording(new CancellationToken(_ => hadError));
		readable.on('end', _ => dead = true);
		try {
			while(!dead) {
				let chunk = readable.read();
				if (chunk === null) {
					yield new Promise((f) => {
						readable.once('readable', f);
					});
					continue;
				}
				yield new Promise((f,r) => {
					writable.write(chunk, e => e ? r(e) : f(null));
				});
			}
		}
		finally {
			// cancelled
			if (hadError) {
				throw error;
			}
		}
	}, cancellationToken);
}