var db = require('./db.js');
var playerModels = require('./models/playerModel.js');
var gameboardModel = require('./models/gameboardModel.js');
var turnMechanics = this;

//reset the game, put all players back to $1500 on 0 area
this.resetGame = function(callback) {
    var resetCondition = {},  //no conditions, we want them all
        resetUpdate = { $set: { currentGameArea: 0, money: 1500, properties: [] } },
        resetOptions = { multi: true };

    playerModels.Player.update(resetCondition, resetUpdate, resetOptions, function(err, numAffected) {
        if (err) return console.log("failed to reset game");
        callback();
    });
}

//responsible for taking one turn for all players
this.takeTurnStep = function(callback) {
    playerModels.Player.find(function(err, players) {
        if (err) return console.log("failed to get players");

        var newPlayers = [];
        var turnStepMutex = new Mutex(players.length, function() {
            callback(newPlayers);
        });
        
        players.forEach(function(player) {
            turnMechanics.takeTurn(player, 0, function(player) {
                newPlayers.push(player);
                turnStepMutex.decrement();
            });
        },[]);
    });
}

//responsible for taking one player's individual turn
this.takeTurn = function(player, numDoubles, callback) {
    if (numDoubles == 3) {
        player = goToJail(player);
        player.save(function(err) {
	        if (err) console.log("error in saving the player when going to jail");   
	    });
        return;
    }

    var dice = turnMechanics.rollDice();

    player.currentGameArea = (player.currentGameArea + dice.value) % 40;

    //find the new game area they landed on and apply it
    gameboardModel.GameArea.findOne({ 'index': player.currentGameArea }, function(err, gameArea) {
        if (err) console.log("error in saving the player");

        console.log("player ", player.name , " landed on game area ", gameArea.name);

        turnMechanics.applyGameArea(player, gameArea, function(newPlayer) {
            newPlayer.save(function(err) {
	            if (err) console.log("error in saving the player"); 
        
                if (dice.isDouble) {
                    console.log("player ", player.name, " rolled doubles!");
                    turnMechanics.takeTurn(newPlayer, numDoubles + 1);
                }       
                callback(newPlayer);
	        });            
        });
    });    
}


//rolls two dice, also returns if they are doubles or not
this.rollDice = function() {
    var x = Math.floor(Math.random() * ((6 - 1) + 1) + 1);
    var y = Math.floor(Math.random() * ((6 - 1) + 1) + 1);
    return {
        value: x + y,
        isDouble: x == y
        };
}

//puts a player into jail
this.goToJail = function(player) {
    player.inJail = true;
    return player;
}

//applys the effects of a game area to an individual player
this.applyGameArea = function (player, gamearea, callback) {
    //if it's a property and the player can afford it, auto buy it for now
    if (gamearea.value && player.money >= gamearea.value) {
        player.money -= gamearea.value;
        player.properties.push({
            id: gamearea.id,
            percentage: 1
        });
        console.log("player ", player.name, " bought ", gamearea.name);
    } else {
        console.log("player ", player.name, " did not land on a property");
    }
    callback(player);
}


//this could probably go into some utility module or something later on....
Mutex = function(count, callback) {
    var count = count,
    callback = callback;

    this.decrement = function() {
        if (--count == 0 ) callback();;
    }
}