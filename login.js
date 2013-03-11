/*
  TODO: 
		  
	POTENTIAL ISSUES: [ ] - 
*/

/* NODE */
var NodeSys = require("sys");

/*
	Game Login
	Author: Mike Cook
	Date: 9/05/11
	Description: Handles login functionality
*/
var Login = exports.Login = {
	// A reference to the shared class instances
	shared: null,
	
	//// Initialization
	// p_shared: A reference to the shared class instances
	init: function(p_shared) {
		// Set the local reference
		Login.shared = p_shared;
	},
	
	//// Process an action involving user login
	// this: The socket requesting the action
	// p_action_data: Object containing data for the action
	// p_callback: Function to execute on result
	doAction: function(p_action_data, p_callback) {
		// Call the action and return the result
		return Login[p_action_data.action](p_action_data, p_callback);
	},
	
	//// Check if a user exists for the passed credentials
	// p_data: Object containing data for checking the user
	// p_callback: Function to execute on result
	getUserExists: function(p_data, p_callback) {
		// Create a new GUID as a key
		var guid = Login.shared.Utility.createGuid();
	    
	    // Set the query
	    var query = { username: p_data.username, password: p_data.password };
	    
	    // Set the update
	    var update = { $set: { sessionKey: guid } };
	    
	    // Set the sort as the default
	    var sort = null;
	    
	    // Try to find the user
	    Login.shared.Database.findAndModify("users", query, update, sort, p_callback);
	},
	
	//// Create a new user
	// p_data: Object containing data for inserting the user
	// p_callback: Function to execute on result
	createUser: function(p_data, p_callback) {
		// Create a new GUID as a key
		var guid = Login.shared.Utility.createGuid();
	
	    // Set the query
	    var query = { username: p_data.username, password: p_data.password };
	    
	    // Set the update
	    var update = { $set: { sessionKey: guid } };
	    
	    // Set the sort as the default
	    var sort = null;
	    
	    // Try to find the user
	    Login.shared.Database.findAndModify("users", query, update, sort, true, p_callback);
	}
};
