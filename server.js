/* NODE */
var NodeSys = require("sys");

/* SOCKET.IO */
var SocketIO = require("socket.io");

/* SERVER CLASSES */
var Client = require("./classes/client.js").Client;
var Login = require("./classes/login.js").Login;
var Assets = require("./classes/assets.js").Assets;
var Database = require("./classes/database.js").Database;
var Utility = require("./classes/utility.js").Utility;

/*
	Game Server
	Author: Mike Cook,
	Date: 8/31/11
	Description: Listens for messages from the client and responds appropriately
*/
var Server = {	
	// A container for the shared classes to access a single instance of each other
	shared: null,
	
	// String buffer for incoming messages
	buffer: '',
	
	// Sockets currently connected to the server
	sockets: [],
	
	// An object of information stored by keys provided by the client
	clients: {},
	
	// Socket io object
	ioServer: null,
	
	// Client to connect to Mongo DB
	mongoClient: null,
	
	// The game server running state
	running: false,
	
	// Whether the decoder is reading from files or Memcached
	readingFromFile: true,
	
	//////////////////////////////////////////////////////////////////////////////////////////////
	// DECODER EVENTS    																		//
	//////////////////////////////////////////////////////////////////////////////////////////////
	
	//// Event that fires when Decoder starts
	onStart: function() {
		
	},
	
	//// Event that is fired when the Game Server is exiting
	onSigInt: function() {
		// Check if we have a mongo DB connection
		if (Database.mongoClient && Database.mongoClient.close) {
			// Close the mongo DB connection
			Database.mongoClient.close();
		}
		
		// Check if we have a ioServer connection
		if (Server.ioServer) {
			// Close the socket server
			Server.ioServer.server.close();
		}
	},
	
	//// Event fired when process is ending
	onExit: function() {
		
	},
	
	//////////////////////////////////////////////////////////////////////////////////////////////
	// INIT																					   	//
	//////////////////////////////////////////////////////////////////////////////////////////////
	
	//// Initialization
	init: function() {
		// Handle on start events
		Server.onStart();
		
		// A object containing a reference to the various classes, this way I avoid creating
		// multiple instances of the same class
		Server.shared = {
			Login: Login,
			Assets: Assets,
			Database: Database,
			Utility: Utility
		};
		
		// Init the database, passing a reference to the engine
		Database.init(Server.shared);
		
		// Bind the actions that occur once mongo is connection
		process.on("mongo_connected", function() {
			NodeSys.log("Mongo Connected");
		
			// Init the login class, passing a reference to the engine
			Login.init(Server.shared);
			
			// Init the assets class, passing a reference to the engine
			Assets.init(Server.shared);
			
			// Init the battle class, passing a reference to the engine
			//Battle.init(Server.shared);
			
			// Create the socket
			Server.createSocketIO();
		});
		
		// Bind to start exiting on SIGINT
		process.on("SIGINT", Server.onSigInt);
		
		// Bind the exit event on exit
		process.on("exit", Server.onExit);
	},
	
	//////////////////////////////////////////////////////////////////////////////////////////////
	// SOCKET.IO CREATION AND EVENT BINDING													   	//
	//////////////////////////////////////////////////////////////////////////////////////////////
	
	//// Create the Socket.IO object and bind events
	createSocketIO: function() {
		// Create the web socket
		Server.ioServer = SocketIO.listen(8080);
		
		// Bind the connect event
		Server.ioServer.sockets.on("connection", Server.onSocketConnect);
	},
	
	//// Socket connect event
	// p_socket: The socket connecting
	onSocketConnect: function(p_socket) {
		// Add the socket to the socket array
		Server.sockets.push(p_socket);
		
		//// Create the function for talking back to the client
		// p_data: The data to return to the client
		// p_type (Optional): Type of event
		p_socket.response = function(p_data, p_type) {
			// Convert p_data to an object if it is an array
			p_data = typeof p_data.length !== "undefined" ? { items: p_data } : p_data;
			
			// Check for p_type
			if (p_type) {
				// Add the type property to the data
				p_data.type = p_type;
			}
		
			// Send the data
			this.emit("response", p_data);
		};
		
		// Bind the event for the socket to load client data
		p_socket.on("init", Server.onSocketInit.bind(p_socket));
	
		// Bind event for client request
		p_socket.on("request", Server.onSocketRequest.bind(p_socket));
		
		// Bind event for starting a session
		p_socket.on("session", Server.onSocketSession.bind(p_socket));
		
		// Emit the we successfully connected
		p_socket.emit("connected");
	},
	
	//// Socket init event
	// p_data: Data passed from client
	onSocketInit: function(p_data) {
		// Check if the data has no key or if client information exists with that key
		if (!p_data.clientKey) {
			// Emit the ready event, but set the status as out of session
			this.emit("ready", { session: false });
		} else if (Server.clients[p_data.clientKey]) {
			// We have a key and client information, so bind it to the socket
			this.client = Server.clients[p_data.clientKey];
			
			// Emit that we are ready and have session data
			this.emit("ready", { session: true });		
		} else {
			// We have a session key, but no data stored for it yet, so set that up
			Server.clients[p_data.clientKey] = new Client(Server.shared, p_data.clientKey);
			
			// Bind the client to the socket
			this.client = Server.clients[p_data.clientKey];
			
			// Emit that we are ready
			this.emit("ready", { session: true });
		}
	},
	
	//// Socket message event
	// p_data: Data passed from client
	onSocketRequest: function(p_data) {
		// Check that we have a request type and client key
		if (!p_data.requestType || !p_data.clientKey) {
			// This an invalid request, so send data back
			this.response.call(this, { error: "Invalid Request Type or Client Key" });
			
			// Exit
			return false;
		}
		
		// Execute the request
		Server.shared[p_data.requestType].doAction(
			// The client info for the socket
			this, 
			// The data of the request
			p_data,
			// A generic callback to send the response
			this.response.bind(this)
		);
	},
	
	//// Socket event for user login or creation.  Provides the client key.
	// p_data: Data for the event
	onSocketSession: function(p_data) {
		// Set the type
		var type = p_data.action === "getUserExists" ? 'login' : 'create_user';
		
		// Execute the event
		Login.doAction(
			// The data of the request
			p_data, 
			//// The callback for the request
			// this: Socket receiving session request
			// p_type: The type of request (login, create_user) for starting a session
			// p_data: The data passed to the session request
			// p_results: Mongo results of user check or creation
			function(p_type, p_results) {
				// Check if we have a record
				if (p_results.length && p_results.length > 0) {
					// Return the client key
					this.response.call(this, { type: p_type + "_success", clientKey: p_results[0].sessionKey });
				} else {
					// Something went wrong, so return the fail
					this.response.call(this, { type: p_type + "_failure" });
				}
			}.bind(this, type)	
		);
	},	
};

// Initialize the Game Engine
Server.init();
