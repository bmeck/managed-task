import {createServer} from 'http';
import {CancellationToken,Resource,Task} from '../';

// This is a simple game
//
// Hold open a POST connection as long as you can
// to try and get the longest connection time.
// Your time will not be recorded until you disconnect
//
// so you must balance:
// * if you want to be in the lead currently
// * or if you can wait longer than anyone else will
//
// You can see who held the connection open the longest with a GET

let max_conn_time_at_death = 0;
let leader_address = 'none';
const server = createServer((req,res) => {
	let is_dead = false;
	// Use a simple helper to make our token
	// You could make a plain object with
	//    .isCancellationRequested() => boolean
	// if you wanted to
	const cancellation_token = new CancellationToken(_ => is_dead);
	const address = req.socket.remoteAddress;
	
	// if our client disconnects, cancel pending work
	req.on('close', _ => is_dead = true);
	
	if (req.method.toLowerCase() === 'post') {
		// create a new managed Task
		//
		// this is basically a juiced up `async`/`await`
		// with cancellation and resource disposal built in
		new Task(function*() {
			const ctime = Date.now();
			// attach a resource to this task:
			//
			// resources will be .dispose()'d when the task finishes
			// 1. by returning
			// 2. by throwing
			// 3. by cancellation
			//
			// since we are using a token
			// NO CODE RELATING TO HTTP REQUESTS IS REQUIRED
			//
			// NOTE: due to reference counting and Resource sharing
			//    YOU MUST use the Resource constructor
			Task.using(new Resource(_ => {
				const conn_time = Date.now()-ctime;
				if (conn_time > max_conn_time_at_death) {
					leader_address = address;
					max_conn_time_at_death = conn_time;
				}
			}));
			
			// dumb loop representing all the work of a
			// long running query
			// the timeout means our conn_time resolution is ~1s
			//
			// AGAIN, no mention of HTTP or cancellation
			while (true) {
				yield new Promise(f => setTimeout(f, 1000));
			}
		}, cancellation_token);
	}
	else {
		res.end(`Max time connected:
		${max_conn_time_at_death/1000}s by ${leader_address}`);
	}
});
server.listen(process.env.PORT || 0, '0.0.0.0', _ => {
	const url = `http://${server.address().address}:${server.address().port}`;
	console.log(`listening on ${url}`);
	console.log(`POST will record how long you stay connected`);
	console.log(`Otherwise will show the longest anyone has been connected`);
});