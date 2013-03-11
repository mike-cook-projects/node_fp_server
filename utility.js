/* NODE */
var NodeSys = require("sys");

/*
    Game Utility
	Author: Mike Cook
	Date: 9/05/11
	Description: Utility functions shared between classes
*/
var Utility = exports.Utility = {
	//// Create a global unique identifier
	createGuid: function() {
		//// Create a string of four random bytes
		function S4() {
			// Return the random byes
			return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
		}
	
		// Return the guid
		return (S4()+S4()+S4()+S4()+S4()+S4()+S4()+S4());
	}
};
