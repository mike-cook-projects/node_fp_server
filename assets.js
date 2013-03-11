/*
  TODO: 
		  
	POTENTIAL ISSUES: [ ] - 
*/

/* NODE */
var NodeSys = require("sys");
var NodeUtil = require("util");

/*
	Game Assets
	Author: Mike Cook
	Date: 9/05/11
	Description: Handles Asset functionality
*/
var Assets = exports.Assets = {
	// A reference to the shared class instances
	shared: null,
	
	//// Initialization
	// p_shared: A reference to the shared class instances
	init: function(p_shared) {
		// Set the local reference
		Assets.shared = p_shared;
	},
	
	//// Process an action involving assets
	// p_socket: The socket that is requesting the data
	// p_data: The data passed
	// p_callback: Generic callback to just return the data
	doAction: function(p_socket, p_data, p_callback) {
		// Call the action and return the result
		return Assets[p_data.action](p_socket, p_data, p_callback);
	},
	
	//// Get an asset prototype
	// p_socket: The socket that is requesting the data
	// p_data: Object containing request data
	// p_callback: Function to execute on result
	getAssetPrototype: function(p_socket, p_data, p_callback) {    
	    // Check if we are checking the character prototype
	    if (p_data.prototypeType === "character") {
	    	// The client already has the prototype, so return that
	    	p_callback({
	    		type: "character_prototype",
	    		prototype: p_socket.client.characterPrototype
	    	});
	    	
	    	// Exit
	    	return true;
	    }
	    
	    // Set the query
	    var query = { type: p_data.prototypeType };
	    
	    // Set the sort as the default
	    var sort = null;
	    
	    // Try to find the prototype
	    Assets.shared.Database.find(
	    	"prototypes", 
	    	query, 
	    	sort, 
	    	p_callback);
	},
	
	//// Create a new character
	// p_socket: The socket that is requesting the data
	// p_data: Object containing request data
	// p_callback: Function to execute on result
	createCharacter: function(p_socket, p_data, p_callback) {
		// Create the document to insert
		var document = {
			username: p_socket.client.username,
			template: p_data.template
		};
			
		//// Insert the document into the characters collection and refresh the clients character list
		// p_callback (Bound): The callback to execute on finish
		// p_client (Bound): The client object for the user
		// p_results: The results from the insert
		Assets.shared.Database.insert("characters", document, function(p_callback, p_client, p_results) {
			// Refresh the client list
			p_client.getCharacters();
			
			// Execute the callback
			p_callback({
				type: "character_create"
			});
		}.bind(this, p_callback, p_socket.client));
	},
	
	//// Delete a character
	// p_socket: The socket that is requesting the data
	// p_data: Object containing request data
	// p_callback: Function to execute on result
	deleteCharacter: function(p_socket, p_data, p_callback) {
		// Set the query to find the character to remove
		var query = {
			username: p_socket.client.username,
			"template.name": p_data.characterName
		};
	
		//// Insert the document into the characters collection and refresh the clients character list
		// p_callback (Bound): The callback to execute on finish
		// p_client (Bound): The client object for the user
		// p_results: The results from the insert
		Assets.shared.Database.remove("characters", query, function(p_callback, p_client, p_results) {
			// Refresh the client list
			p_client.getCharacters();
			
			// Execute the callback
			p_callback({
				type: "character_delete"
			});
		}.bind(this, p_callback, p_socket.client));
	},
	
	//// Get the character list for the user
	// p_socket: The socket that is requesting the data
	// p_data: Object containing request data
	// p_callback: Function to execute on result
	getCharacterList: function(p_socket, p_data, p_callback) {	
		// Return the current character list
		p_callback({
			type: "character_list",
			characters: p_socket.client.characters
		});	
	},
	
	//// Set the selected character in the client
	// p_socket: The socket that is requesting the data
	// p_data: Object containing request data
	// p_callback: Function to execute on result
	selectCharacter: function(p_socket, p_data, p_callback) {
		// Update the client
		p_socket.client.selected = p_data.name;
		
		// Call the callback
		p_callback({
			type: "select_character",
			characterName: p_socket.client.selected
		});
	}, 
	
	//// Get the currently selected character
	// p_socket: The socket that is requesting the data
	// p_data: Object containing request data
	// p_callback: Function to execute on result
	getCharacter: function(p_socket, p_data, p_callback) {
		// Flag for finding character
		var found = false;
		
		// The character to send back
		var character;
		
		// Loop through the characters
		for (var i = 0; p_socket.client.characters.length; i++) {
			// Check the name
			if (p_socket.client.characters[i].template.name === p_socket.client.selected) {
				// Set the character
				character = p_socket.client.characters[i];
				
				// Flag found
				found = true;
				
				// Exit
				break;
			}
		}
		
		// Check if a character wasn't found
		if (!found) {
			// Set the character as the first character, or {} if no characters
			character = p_socket.client.characters.length > 0 ? p_socket.client.characters[0] : {};
		}
		
		// Return the character
		p_callback({
			type: "current_character",
			character: character
		});
	}
};
