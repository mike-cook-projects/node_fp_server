/* NODE */
var NodeSys = require("sys");
var NodeEvents = require("events");
var NodeUtil = require("util");

/*
  Game Client
	Author: Mike Cook
	Date: 9/05/11
	Description: Handles server-side storage of client info
		p_shared: A reference to the shared classes
		p_client_key: The key specific for this client
*/
var Client = exports.Client = function(p_shared, p_client_key) {
	// Flag to update template on load (for debug purposes)
	this.UPDATE_TEMPLATE = false;

	// Set the engine
	this.shared = p_shared;
	
	// Set the client key
	this.clientKey = p_client_key;
	
	// The username this client is using
	this.username = null;
	
	// The character prototype, this applies any new additions to a character
	this.characterPrototype = null;
	
	// The list of characters for the user
	this.characters = null;
	
	// The name of the currently selected character
	this.selected = null;
	
	// Flag for whether the client is currently fighting
	this.fighting = false;
	
	// Load the data
	this.loadData.call(this);
};

// Set the inheritence
NodeUtil.inherits(Client, NodeEvents.EventEmitter);

//// Loads the data for the client
Client.prototype.loadData = function() {
	// This is a chain of events for loading data.  The first event is when we get the username.
	this.on("username_set", this.getPrototype);
	
	// When the prototype is set, load the characters
	this.on("prototype_set", this.getCharacters);
	
	// When the characters are loaded, check if we should update the template
	this.on("characters_set", this.updateTemplate);
	
	// Start the chain
	this.getUsername.call(this);
};

//// Gets the username for this client
Client.prototype.getUsername = function() {
	// Get the username from the database
	this.shared.Database.find(
		"users", 
		{ sessionKey: this.clientKey },
		null,
		this.setUsername.bind(this)
	);
};

//// Sets the username for this client
// p_results: The document array returned by Database
Client.prototype.setUsername = function(p_results) {
	// Check that we have results
	if (p_results.length > 0) {
		// Set the username
		this.username = p_results[0].username;
		
		// Emit that we have the username
		this.emit("username_set");
	}	
};

//// Gets the character prototype for this client
Client.prototype.getPrototype = function() {
	// Get the username from the database
	this.shared.Database.find(
		"prototypes", 
		{ type: "character" },
		null,
		this.setPrototype.bind(this)
	);
};

//// Sets the character prototype for this client
// p_results: The document array returned by Database
Client.prototype.setPrototype = function(p_results) {
	// Set the username
	this.characterPrototype = p_results[0];
		
	// Emit that we have the characters
	this.emit("prototype_set");
};

//// Gets the characters for this client
Client.prototype.getCharacters = function() {
	// Get the username from the database
	this.shared.Database.find(
		"characters", 
		{ username: this.username },
		null,
		this.setCharacters.bind(this)
	);
};

//// Sets the characters for this client
// p_results: The document array returned by Database
Client.prototype.setCharacters = function(p_results) {
	// Set the username
	this.characters = p_results;
	
	// Update characters with any properties from the prototype they are missing
	this.updateCharacters();
		
	// Emit that we have the characters
	this.emit("characters_set");
};

//// Update characters with missing properties from the character prototype
Client.prototype.updateCharacters = function() {
	//// Recursive function to compare two objects
	// p_prototype: The prototype to inherit from
	// p_object: The object to inherit to
	var mergeObjects = function(p_prototype, p_object) {
		// Loop through the properties in the prototype
		for (var property in p_prototype) {
			// Check if the property is an object (exclude arrays)
			if (typeof p_prototype[property] === "object" && !p_prototype[property].length) {
				// Fill in the objects property if it doesn't exist
				p_object[property] = p_object[property] || {};
				
				// Call the function again with the nested object
				mergeObjects(p_prototype[property], p_object[property]);
			} else if (p_prototype[property] === "object") {
				// Fill in the objects array property if it doesn't exist
				p_object[property] = p_object[property] || [];
			} else {
				// Set the property if it doesn't exist
				p_object[property] = p_object[property] || p_prototype[property];
			}
		}
	}

	// Loop through the characters
	for (var i = 0; i < this.characters.length; i++) {
		// Merge the properties
		mergeObjects(this.characterPrototype, this.characters[i]);
	}
};

//// Get the current character for this client
Client.prototype.getSelectedCharacter = function() {
	// Loop through the character
	for (var i = 0; i < this.characters.length; i++) {
		// Check if this is the selected character
		if (this.characters[i].template.name === this.selected) {
			// Return the character template
			return this.characters[i].template;
		}
	}
};

//// Update the template from the static local template
Client.prototype.updateTemplate = function() {
	// Check if the update flag is set
	if (this.UPDATE_TEMPLATE) {
		NodeSys.log("UPDATING!");
	
		// Update the template
		this.shared.Database.update(
			"prototypes",
			{ type: "character" },
			this.getStaticTemplate()
		);
	}
};

//// Get a static template of the character.  Updating this
//// in conjuction with changing the UPDATE_TEMPLATE flag will
//// update the Mongo template to this version
Client.prototype.getStaticTemplate = function() {
	// Describe a generic player.  It's a massive object, but it describes
	// attacks, defenses, statistics, and visual appearance 
	return {
		// The type of prototype
		type: "character",
		// The template
		template: {
			// The generic template name
			name: "Template",
			// The max player health
			maxHealth: 200,
			// The current action points
			actionPoints: 0,
			// The default color settings
			primaryColor: "color_green",
			secondaryColor: "color_dark_brown",
			skinColor: "color_peach",
			hairColor: "color_brown",
			// The visual appearance of the plater
			style: {
				// The head and it's items
				head: {
				   hair: ":hairColor:",
				   bandanna: ":primaryColor:",
				   eye: ":primaryColor:"
				},
				// The body and it's items
				body: {
					// The arm and it's items
				   arm: {
				       shoulder: ":secondaryColor:",
				       hand: ":skinColor:",
				       // The weapon description
				       sword: {
				           pommel: "color_brown",
				           guard: "color_dark_brown",
				           blade: "color_grey"
				        }
				    },
				   belt: ":secondaryColor:"
				},
				legs: {
				   shoes: ":primaryColor:"
				}
			},
			// The default attack data
			attackData: {
				// The attack
		        slice: {
		        	// The attack name
		        	name: 'slice',
		        	// The tooltip description
		            description: "Quickly slices at a target, doing 20 damage.",
		            // The damage it does
		            damage: 20,
		            // The action points it generates
		            points: 1,
		            // The action points it costs
		            cost: 0,
		            // Whether it completely counters an attack when it beats it
		            counter: false,
		            // A list of what the attack beats
		            beats: {
		            	// The name of the attack slice beats
		            	charge: {
		            		// Whether it blocks data even if it gets beat
			                blocks: false,
			                // Whether it still damages if it gets countered
			                damages: false,
			                // Various combat log text chosen at random
			                logText: [
			                    ":me: catches :them:'s charge mid-step causing extra damage and stuff. " +
			                    ":damage: points of stuff.",
			                    ":them: rushes forward into :me:'s slice in an attempt to impress the ladies. " +  
			                    "It causes :them: an erotic :damage: damage.",
			                    ":me: slices at :them:'s charge, causing them to both laugh at the :damage: " + 
			                    "damage caused."
			                ]
			            },
			            guard: {
			                blocks: false,
			                damages: false,
			                logText: [
			                    ":me: slices into :them:'s guard, managing to get a few pokes in and does " + 
			                    ":damage: damage.",
			                    ":them: does an impression of a statue causing :me:'s slice to hit softer " + 
			                    "than intended, causing a paltry :damage: damage.",
			                    ":me: fights :them:'s sword before getting a hit, doing :damage: damage to " + 
			                    ":them: and like a bajillion to :them:'s sword."
			                ]
			            }
		            }
		        },
		        cleave: {
		        	name: 'cleave',
		            description: "A slow overhead attack, doing 60 damage.",
		            damage: 60,
		            points: 2,
		            cost: 0,
		            counter: false,
		            beats: {
		            	guard: {
			                blocks: false,
			                damages: false,
			                logText: [
			                    ":me: hits :them:'s guard really hard, causing :me: to wince from bone pain " + 
			                    "and doing :damage: damage.",
			                    ":them: raises their sword to stop :me:'s cleave, causing :damage: damage and " + 
			                    "a painful forearm bruise that doctors in the crowd want to look at.",
			                    ":me: cleaves into :them:'s sword like metal butter, doing :damage: damage."
			                ]
			            },
			            parry: {
			            	blocks: false,
			                damages: false,
			                logText: [
			                    ":them:'s parry is an objection that :me:'s cleave overruled.  The court " +
			                    "awards :damage: damage to :them:.",
			                    ":them: tries a parry against :me:'s cleave.  :them: thought it was one " +
			                    "way, but :damage: damage shows it was the other.",
			                    ":me: cleaves through :them:'s parry doing :damage: damage and making a " + 
			                    "funny sound when :them:'s skin is cut."
			                ]
			            }
		            }
		        },
		        eviscerate: {
		        	name: 'eviscerate',
		            description: "Summon the powers of your ninja grandmother, cutting through your " + 
		            			 "opponent and doing 80 damage.",
		            damage: 80,
		            points: 0,
		            cost: 5,
		            counter: false,
		            beats: {
		            	guard: {
			                blocks: false,
			                damages: false,
			                logText: [
			                    ":me: eviscerates :them:, doing :damage: damage."
			                ]
			            },
			            charge: {
			                blocks: false,
			                damages: false,
			                logText: [
			                    ":me: eviscerates :them:, doing :damage: damage."
			                ]
			            },
			            parry: {
			            	blocks: false,
			                damages: false,
			                logText: [
			                    ":them:'s parry is beaten by :me:'s eviscerate.  Some funny text, also it " + 
			                    "did :damage: damage"
			                ]
			            }
		            }
		        }
		    },
		    // The defend data
		    defendData: {
		    	// Format same as attack data
			    dodge: {
			    	name: 'dodge',
			        description: "Dodge backwards to avoid any dodgable attack.  Does no damage.",
			        damage: 0,
			        points: 0,
			        cost: 3,
			        missFactor: 1,
			        beats: {
			            cleave: {
			                blocks: true,
			                damages: false,
			                logText: [
			                    ":me: deftly avoids :them:'s embarassing cleave.",
			                    ":them:'s cleave cuts nothing but air, blowing air into :me:'s face like " + 
			                    "a pleasant smelling fart.",
			                    ":me: darts backwards to avoid :them:'s clumsy attack.  :me: is reminded of swinging a wooden " + 
			                    "stick wildly at other children."
			                ] 
			            },
			            slice: {
			                blocks: true,
			                damages: false,
			                logText: [
			                    ":me: pretends to parry, but dodges :them:'s slice like an asshole.",
			                    ":them: widly slices about in a very fancy display, doing critical damage to the air.",
			                    ":me: dodges :them:'s slice in a manner very appealing to the bored crowd waiting for " + 
			                    "someone to die."
			                ]
			            },
			            eviscerate: {
			                blocks: true,
			                damages: false,
			                logText: [
			                    ":me: pretends to parry, but dodges :them:'s eviscerate like an asshole.",
			                    ":them: darts forward in a very fancy display, doing critical damage to the air.",
			                    ":me: dodges :them:'s eviscerate in a manner very appealing to the bored crowd waiting " + 
			                    "for someone to die."
			                ]
			            }
			        }
			    },
			    guard: {
			    	name: 'guard',
			        description: "Guard against the next attack, reducing its damage by 50%.",
			        damage: 0,
			        points: 0,
			        cost: 0,
			        missFactor: 0.5,
			        beats: {}
			    },
		        charge: {
		        	name: 'charge',
		            description: "Charge forward to interrupt the opponent's attack.",
		            damage: 0,
		            points: 1,
		            cost: 0,
		            missFactor: 1.5,
		            beats: {
		                cleave: {
		                    blocks: true,
		                    damages: false,
		                    logText: [
			                    ":me: charges to interrupt :them:'s cleave, hitting his potbelly hard.",
			                    ":them: made a stupid decision and got charged by :me: and pays for it in tears.",
			                    ":me: rushes forward, turning :them:'s cleave into a...  whatever, just picture something cool."
			                ]
		                }
		            }           
		        },
		        parry: {
		        	name: 'parry',
		            description: "Parry an opponents slice and pierce them for 30 damage.  Damage is reduced 50% on miss.",
		            damage: 30,
		            points: 0,
		            cost: 1,
		            missFactor: 0.5,
		            beats: {
		                slice: {
		                    blocks: true,
		                    damages: true,
		                    misses: true,
		                    logText: [
			                    ":me: parries :them:'s slice, which makes :them: feel pretty embarassed.  Also, it " + 
			                    "did :damage: damage.",
			                    ":me: does some cool stuff with their sword and makes :them:'s slice miss him.  It " + 
			                    "was pretty sweet and it did :damage: damage.",
			                    ":me: pokes :them:'s testicle before the attack but slashes at his face in the confusion. "   
			                ]
		                }
		            }
		        }
		    }
		}
    };
};
