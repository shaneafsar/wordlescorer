import * as debug$0 from "debug";
import http from "http";
import app from "../app.js";

// ****************
// EXPRESS SERVER
// ****************

/**
 * Normalize a port into a number, string, or false.
 */
function normalizePort(val) {
    var port = parseInt(val, 10);
    if (isNaN(port)) {
        // named pipe
        return val;
    }
    if (port >= 0) {
        // port number
        return port;
    }
    return false;
}


class Server {
  constructor() {
    this.debug = debug$0.default('static2:server');
    /**
     * Get port from environment and store in Express.
     */
    this.port = normalizePort(process.env.PORT || '3000');
    app.set('port', this.port);
    /**
     * Create HTTP server.
     */
    this.server = http.createServer(app);
    /**
     * Listen on provided port, on all network interfaces.
     */
    this.server.listen(this.port);
    this.server.on('error', this.onError.bind(this));
    this.server.on('listening', this.onListening.bind(this));
  }
  
  onError(error) {
    if (error.syscall !== 'listen') {
        throw error;
    }
    const bind = typeof port === 'string'
        ? 'Pipe ' + port
        : 'Port ' + port;
    // handle specific listen errors with friendly messages
    switch (error.code) {
        case 'EACCES':
            console.error(bind + ' requires elevated privileges');
            process.exit(1);
            break;
        case 'EADDRINUSE':
            console.error(bind + ' is already in use');
            process.exit(1);
            break;
        default:
            throw error;
    }
  }
  
  onListening() {
    const addr = this.server.address();
    const bind = typeof addr === 'string'
        ? 'pipe ' + addr
        : 'port ' + addr.port;
    this.debug('Listening on ' + bind);
  }
}

function initServer() {
  return new Server();
}

export default initServer;