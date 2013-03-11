/* NODE */
var NodeSys = require("sys");
var NodeUtil = require("util");

/* MONGODB */
var MongoDB = require("mongodb");

/*
  Game Database
	Author: Mike Cook
	Date: 9/05/11
	Description: Functions for interacting with the Mongo database
*/
var Database = exports.Database = {
	// MongoDB "Constants"
	MONGODB_CLIENT_HOST: ['localhost'], // Mongo DB replica set
	MONGODB_CLIENT_PORT: 27017, // Mongo DB server port
	MONGODB_CLIENT_DATABASE: '<db_name>', // Mongo DB database
	MONGODB_CLIENT_USERNAME: '<db_user>', // Mongo DB username
	MONGODB_CLIENT_PASSWORD: '<db_pass>', // Mongo DB password

	// A reference to the shared class instances
	shared: null,
	
	// The local mongo client
	mongoClient: null,
	
	//// Initialization
	// p_shared: A reference to the shared class instances
	init: function(p_shared) {
		// Set the shared references
		Database.shared = p_shared;
	
		// Create the Mongo client
		Database.createMongoDbClient();
	},
	
	//// Create the MongoDB client for inserting records into MongoDB
	createMongoDbClient: function() {		
		// Setup the Mongo server options
		var server_options = {
			auto_reconnect: true // If Mongo is down, the Decoder should stop running
		};
		
		// Setup the Mongo database client options
		var client_options = {
			strict: false // Create a collection if it doesn't exist
		};
		
		// Create a server
		var server = new MongoDB.Server(Database.MONGODB_CLIENT_HOST, Database.MONGODB_CLIENT_PORT, server_options);
		
		// Create the Mongo DB client
		Database.mongoClient = new MongoDB.Db(Database.MONGODB_CLIENT_DATABASE, server, client_options);
		
		//// Handle action when connection is opened
		// p_error: Possible error returned from open operation
		// p_client: The client that called the open (Server.mongoClient in our case)
		Database.mongoClient.onOpen = function(p_error, p_client) {
			// LOG
			NodeSys.log("Opened");
			
			// Fire event
			process.emit("mongo_connected");
		};
		
		//// Handle action when close occurs
		// p_server: Server object that was closed
		Database.mongoClient.on("close", function(p_server) {		
			// LOG
			NodeSys.log("Closed");
			
			// STUB
		});
		
		// Open the connection
		Database.mongoClient.open(Database.mongoClient.onOpen);
	},
	
	//// Process the results of a query and return the result
	// p_callback: The callback intended for the results
	// p_error: A possible error message
	// p_cursor: The cursor object containing the results
	processResults: function(p_callback, p_error, p_cursor) {	
		// Check if we have an error
		if (p_error) {
			// Check that the error isn't that there were no records, or that the key already exists
			if (p_error.message === "No matching object found" || p_error.message.indexOf("duplicate key error") !== -1) {
				// Return back an empty array to the callback, since we have no records
				p_callback([]);
				
				// Exit
				return true;
			} else {
				// Log the error
				NodeSys.log(p_error.message);
				
				// Exit
				return false;
			}
		}
		
		// Check if our cursor is actually a document
		if (!p_cursor.each) {
			// Call the callback and pass an array with the document
			p_callback([ p_cursor ]);
			
			// Exit
			return true;
		}
			
		// Array of cursor records
		var document_array = [];
	
		//// Loop through the cursor, executing the callback when we run out of documents
		// p_callback: The callback to execute when array is filled (Bound, Not Passed)
		// p_error: A possible error on accessing the cursor
		// p_document: The current document for the cursor
		p_cursor.each(function(p_callback, p_error, p_document) {
			// Check for an error on the document
			if (p_error) {
				// Log the error
				NodeSys.log(p_error.message);
			
				// Call the callback, but pass false to specify an error
				return false;
			}
			
			// Check if we have a document to perform actions with
			if (p_document) {
				// Add the document to the array
				document_array.push(p_document);
			} else {
				// We are out of documents, so just call the callback
				p_callback(document_array);
			}
		}.bind(p_cursor, p_callback));
	},
	
	//// Find a record or group of records
	// p_collection: The name of the collection to search
	// p_query: The criteria to query on
	// p_sort: How to sort the data
	// p_callback: The callback to execute on response
	find: function(p_collection, p_query, p_sort, p_callback) {	
		// Set a reference to the collection
	    var collection = new MongoDB.Collection(Database.mongoClient, p_collection);
	    
	    // Format the sort
	    p_sort = Database.formatSort(p_sort);
	    
	    // Try to find the record(s)
	    collection.find(p_query, Database.processResults.bind(Database, p_callback));
	},

	//// Find a record and modify if exists
	// p_collection: The name of the collection to search
	// p_query: The criteria to query on
	// p_update: The values to update
	// p_sort: How to sort the data
	// p_upsert (Optional): Whether to upsert the record if not found
	// p_callback: The callback to execute on response
	findAndModify: function(p_collection, p_query, p_update, p_sort, p_upsert, p_callback) {
		// Default value for the flags
		var flags = { new: true };
		
		// Check if p_upsert was ommitted
		if (typeof p_upsert === "function") {
			// Set p_callback as the function
			p_callback = p_upsert;
		} else if (p_upsert === true) {
			// Add the upsert option to the flags
			flags.upsert = true;
		}
	
		// Set a reference to the collection
	    var collection = new MongoDB.Collection(Database.mongoClient, p_collection);
	    
	    // Format the sort
	    p_sort = Database.formatSort(p_sort);
	    
	    // Try to find the user
	    collection.findAndModify(p_query,
	    						 p_sort,
	    						 p_update,
	    						 flags,
	    						 Database.processResults.bind(Database, p_callback));
	},
	
	//// Insert a record into mongo
	// p_collection: The name of the collection to search
	// p_documents: The documents to insert
	// p_callback: The callback to execute on response
	insert: function(p_collection, p_documents, p_callback) {
		// Set default for safe option
		var options = { safe: false };
		
		// Check if we have a callback
		if (typeof p_callback !== "undefined") {
			// Update the safe flag
			options.safe = true;
		}
	
		// Set a reference to the collection
	    var collection = new MongoDB.Collection(Database.mongoClient, p_collection);
	    
	    // Insert the record and call the callback
	    collection.insert(p_documents, options, p_callback);
	},
	
	//// Update a record into mongo
	// p_collection: The name of the collection to search
	// p_query: The documents to update
	// p_update: The object describing the update
	// p_callback: The callback to execute on response
	update: function(p_collection, p_query, p_update, p_callback) {
		// Set default for callback
		p_callback = p_callback || function() {};
	
		// Set default for safe option
		var options = { safe: false };
		
		// Check if we have a callback
		if (typeof p_callback !== "undefined") {
			// Update the safe flag
			options.safe = true;
		}
	
		// Set a reference to the collection
	    var collection = new MongoDB.Collection(Database.mongoClient, p_collection);
	    
	    // Update the record and call the callback
	    collection.update(p_query, p_update, p_callback);
	},
	
	//// Delete a record from Mongo
	// p_collection: The name of the collection to search
	// p_query: The query describing the document to delete
	// p_callback: The callback to execute on response
	remove: function(p_collection, p_query, p_callback) {
		// Set default for safe option
		var options = { safe: false };
		
		// Check if we have a callback
		if (typeof p_callback !== "undefined") {
			// Update the safe flag
			options.safe = true;
		}
	
		// Set a reference to the collection
	    var collection = new MongoDB.Collection(Database.mongoClient, p_collection);
	    
	    // Insert the record and call the callback
	    collection.remove(p_query, options, p_callback);
	},
	
	//// Format a sort into the correct format
	// p_sort: The attempted sort
	formatSort: function(p_sort) {
		// Check if it is null or undefined
		if (!p_sort) {
			// Return a default sort of the _id field
			return [["_id", "asc"]];
		}
		
		// Check if it is a string
		if (typeof p_sort === "string") {
			// Return a formatted asc sort on the string's field
			return [[p_sort, "asc"]];
		}
		
		// Check if it is a single dimensional array of strings
		if (typeof p_sort === "object" && typeof p_sort[0] === "string") {
			// Return the array nested in another
			return [p_sort];
		}
		
		// It passed the above checks, so it is probably correct
		return p_sort;
	}
};
