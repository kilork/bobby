var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var sassMiddleware = require('node-sass-middleware');
const debug = require('debug')('bobby:app');

var index = require('./routes/index');
var users = require('./routes/users');
let api = require('./routes/api');

var app = express();
require('express-ws')(app);

const pty = require('node-pty');

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(sassMiddleware({
  src: path.join(__dirname, 'public'),
  dest: path.join(__dirname, 'public'),
  indentedSyntax: true, // true = .sass and false = .scss
  sourceMap: true
}));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', index);
app.use('/users', users);
app.use('/api/', api)

let terminals = {};
let logs = {};

app.post('/terminals', (req, res) => {
  debug('received POST request to /terminals with body: %o', req.body);
  let cols = req.body.cols || 80;
  let rows = req.body.rows || 24;
  if (cols == 0) {
    cols = 80;
  }
  if (rows == 0) {
    rows = 24;
  }
  let term = pty.spawn(process.platform === 'win32' ? 'cmd.exe' : 'bash', [], {
    name: 'xterm-color',
    cols: cols,
    rows: rows,
    cwd: process.env.CWD,
    env: process.env
  });
  debug(`Created terminal with PID: ${term.pid}`);
  let sPID = term.pid.toString();
  terminals[sPID] = term;
  logs[sPID] = '';
  term.on('data', (data) => logs[sPID] += data);
  req.body.pid = sPID;
  res.send(req.body);
  res.end();
});

app.put('/terminals/:pid', (req, res) => {
  debug('received PUT request to /terminals/%s with body: %o', req.params.pid, req.body);
  let term = terminals[req.params.pid];
  let cols = req.body.cols || 80;
  let rows = req.body.rows || 24;
  term.resize(cols, rows);
  debug('terminal %s resized to %d cols %d rows', req.params.pid, cols, rows);
  res.end();
});

app.ws('/terminals/:pid', (ws, req) => {
  let pid = req.params.pid;
  debug('received WS request to /terminals/%s', pid);
  let term = terminals[pid];
  if (!term) {
    debug('not found term!');
  }
  ws.send(logs[pid]);

  term.on('data', (data) => {
    try {
      ws.send(data);
    } catch (ex) {
      // The WebSocket is not open, ignore
    }
  });
  ws.on('message', (msg) => term.write(msg));
  ws.on('close', () => {
    term.kill();
    debug('closed terminal %s', pid);
    // cleanup
    delete terminals[pid];
    delete logs[pid];
  });
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
