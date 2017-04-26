var util = require('util');
var express = require('express');
var path = require('path');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);

//FOR EJS TEMPLATE ENGINE
app.engine('.html', require('ejs').__express);
app.set('views', __dirname + '/views');
app.set('view engine', 'html');

//MIDDLEWARE FOR LOG
//app.use(express.logger());

//MIDDLEWARE FOR REQUEST BODY PARSING
app.use(express.bodyParser());

//MIDDLEWARE FOR SESSION-COOKIE SET
app.use(express.cookieParser('your secret here'));
app.use(express.session());

//MIDDLEWARE FOR STATIC FILE SERVING [CSS, JS, IMAGES, HTML]
app.use(express.static(path.join(__dirname, 'public')));

server.listen(process.env.VCAP_APP_PORT || 3000);
console.log("server running on port 3000");

io.configure('development', function(){
  io.set('transports', ['xhr-polling']);
});

//object for holding user names
var usernames = {};

//for friendList of a specific user
var frndNames = {};

// prevents socket debug statements from showing up on the console
io.set('log level', 1);

//FOR SOCKET CONNECTION
io.sockets.on('connection', function (socket) {
	
	//for storing usernames
	socket.on('addUser', function(username) {
		console.log('connected');
		// we store the username in the socket session for this client
		socket.username = username;
		
		if(username != null) {
			usernames[username] = socket.id;
			//req.session.id = socket.id;
			
			//initialize the friendlist object
			if(typeof frndNames[socket.username] == 'undefined') {
				frndNames[socket.username] = new Array();
			}
			
		}
		
		console.log(1);
		console.log(usernames);
		console.log(frndNames[socket.username]);
		socket.broadcast.emit('updateUser', {ulist: usernames, flist: frndNames}); //it will emit the message to all except the client 
		socket.emit('updateUser', {ulist: usernames, flist: frndNames});
		//update friend list at page refresh if any user in the list
		if(frndNames[socket.username] != "") {
			////console.log('null');
			socket.emit('updateFriendList', frndNames[socket.username]);
		}
	});
	
	//for message
	socket.on('sendMessage', function (data) {
		//data.msg_receiver -- is the message receiver							   
		data.msg_sender = socket.username; //is the message sender name
		
		io.sockets.socket(usernames[data.msg_receiver]).emit('message', data);
  	});
	
	//send the invitation to the respective user
	socket.on('sendInvite', function(data) {
		//data.toname -- is the reciever here
		data.fromname = socket.username; //is the sender here
		io.sockets.socket(usernames[data.toname]).emit('sendInvite', data); //it will emit the message to the individual client
	});
		
	//process the invite action [accept/deny]
	socket.on('inviteAction', function(data) {
		//data.sendername -- is the sender here
		data.receivername = socket.username; //is the receiver here whose name will come under Friend List 
		
		//if invitation is accepted add the [sender name to the receiver friend list] and [receiver name to the sender friend list]
		if(data.action == "accept") {
			frndNames[data.receivername][frndNames[data.receivername].length] = data.sendername; //receiver friend list
			frndNames[data.sendername][frndNames[data.sendername].length] = data.receivername; //sender friend list
			console.log(frndNames);
		}
		
		io.sockets.socket(usernames[data.sendername]).emit('inviteAction', data);	
	});	
	
	//on socket disconnect
	socket.on('disconnect', function(){
		console.log(2);
		console.log(usernames);
		//remove the user from the global username list
		delete usernames[socket.username];
		//console.log("this user " + usernames[socket.username] + "disconnected.");
		//update the list [user list + friend list] at client side
		if(socket.username != null) {
			setTimeout( function() { 
						if(typeof usernames[socket.username] == 'undefined') {
							
							//update the frndNames object
							delete frndNames[socket.username];
							for(var i in frndNames) {
								//console.log("i");
								//console.log(i);
								for(var j in frndNames[i]) {
									//console.log("j");
									//console.log(j);
									//console.log(frndNames[i][j]);
									if(frndNames[i][j] == socket.username) {
										//instead of using delete, i am using splice method to remove element as delete operator only remove array element does not reposition the index of the array instead it holds the index
										frndNames[i].splice(j,1); 	
									}
								}
								
							}
							
							console.log(3);
							console.log(frndNames);
							
							socket.broadcast.emit('updateUserList', socket.username);
						}
					}, 30000);
		}
		
		/*if(socket.username != null) {
			socket.broadcast.emit('updateUserList', socket.username);
		}*/
		
	});
	
});

app.get('/', function(req, res) {
	////console.log(req.session);
	//res.end('connected<br />'+req.headers);
	res.render('chat.html', {
		title: "Welcome to Node Chat Application",
		authData: req.session.userid,
		method: 'get'
	});
	
});

app.post('/', function(req, res) {
	req.session.userid = req.body.hid_username;
	res.render('chat.html', {
		title: "Welcome to Node Chat Application",
		authData: req.session.userid,
		method: 'post'
	});
	
});