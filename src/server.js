const http = require('http');
const fs = require('fs');
const socketio = require('socket.io');

const port = process.env.PORT || process.env.NODE_PORT || 3000;

const index = fs.readFileSync(`${__dirname}/../client/client.html`);

const onRequest = (request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/html' });
  response.write(index);
  response.end();
};

const app = http.createServer(onRequest).listen(port);

console.log(`Listening on 127.0.0.1: ${port}`);

const io = socketio(app);
const users = {};

const onJoined = (sock) => {
  const socket = sock;

  socket.on('join', (data) => {
    users[data.name] = {
      socket,
      joined: Date.now(),
      about: `${data.name} is completely average.`,
      tm: undefined,
    };
    const online = (Object.keys(users).length < 2) ?
      `There is ${Object.keys(users).length} user online` :
      `There are ${Object.keys(users).length} users online`;
    const joinMsg = {
      name: '',
      msg: online,
    };

    socket.name = data.name;
    socket.emit('msg', joinMsg);

    socket.join('room1');

    const response = {
      name: '',
      msg: `${data.name} has joined.`,
    };
    socket.broadcast.to('room1').emit('msg', response);

    console.log(`${data.name} joined`);
    socket.emit('msg', { name: '', msg: 'You joined the room' });
  });
};

const ping = (socket) => {
  const sock = socket;

  const iv = setInterval(() => {
    users[sock.name].socket.emit('ping', {});
    users[sock.name].tm = setTimeout(() => {
      clearInterval(iv);
      console.log(`disconnecting ${sock.name}`);
      delete users[sock.name];
      sock.disconnect();

      // let other users know that they left
      io.emit('msg', { name: '', msg: `${sock.name} left.` });
    }, 5000);
  }, 3000);
};

const onMsg = (socket) => {
  const sock = socket;
  let keys;
  let online;
  let username;
  let whisper;

  sock.on('msgToServer', (data) => {
    if (data.msg[0] === '/') {
      const command = data.msg.split(' ')[0];
      const info = data.msg.substring(command.length + 1);
      switch (command) {
        case '/aboutme':
          users[sock.name].about = info;
          users[sock.name].socket.emit('msg', {
            name: '',
            msg: `Changed your about to "${info}"`,
          });
          break;
        case '/about':
          if (users[info]) {
            users[sock.name].socket.emit('msg', {
              name: '',
              msg: users[info].about,
            });
          } else {
            users[sock.name].socket.emit('msg', {
              name: '',
              msg: 'That user does not exist',
            });
          }
          break;
        case '/whisper':
          username = info.split(' ')[0];
          whisper = info.substring(username.length + 1);
          console.log(`${username}: ${whisper}`);
          if (users[username] && whisper) {
            users[sock.name].socket.emit('msg', {
              name: '',
              msg: `You whispered ${whisper} to ${username}`,
            });
            users[username].socket.emit('msg', {
              name: '',
              msg: `${sock.name} whispered "${whisper}" to you`,
            });
          } else {
            users[sock.name].socket.emit('msg', {
              name: '',
              msg: 'Hmm... that doesn\'t look right.  Check /help!',
            });
          }
          break;
        case '/online':
          keys = Object.keys(users);
          online = '\nYou\'re all alone!';
          if (keys.length > 1) {
            online = '\nCurrently online: ';
            for (let i = 0; i < keys.length; i++) {
              if (keys[i]) online += `\n${keys[i]}`;
              if (keys[i] === sock.name) online += ' (you)';
            }
          }
          users[sock.name].socket.emit('msg', {
            name: '',
            msg: online,
          });
          break;
        case '/pong':
          clearTimeout(users[sock.name].tm);
          break;
        default:
          users[sock.name].socket.emit('msg', {
            name: '',
            msg: '\nCommands:'
      + '\n\t /about [user] - set your "about" info'
      + '\n\t /aboutme [message] - get a user\'s "about" info'
      + '\n\t /whisper [user] [message] - privately message a user'
      + '\n\t /online - get all users currently online',
          });
          break;
      }
    } else {
      io.sockets.in('room1').emit('msg', {
        name: socket.name,
        msg: data.msg,
      });
    }
  });
};

io.sockets.on('connection', (socket) => {
  console.log('started');

  onJoined(socket);
  onMsg(socket);
  ping(socket);
});

console.log('Websocket server started');
