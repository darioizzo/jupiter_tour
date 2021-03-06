/* Namespace PLUGIN 
    Modules which are not necessary for the game on its own.
    */
var plugin = {};
(function () {

    /* Base Class Plugin
        Every plugin has to inherit from it.
    */
    function Plugin(gameEngine) {
        this._gameEngine = gameEngine;
        this._isEngineInitialized = false;
    }
    Plugin.prototype = {
        constructor: Plugin,
        onEvent: function (eventType, eventData) {}
    };



    /* Class LoaderScreen Plugin
        Displays a loader gif which also disables all other interfaces at certain events.
    */
    plugin.LoaderScreen = function (gameEngine) {
        Plugin.call(this, gameEngine);
        this._div = document.createElement('div');
        this._div.className = 'loader unselectable';
        this._div.innerHTML = 'loading...';
        this._div.oncontextmenu = function () {
            return false;
        };
        document.body.appendChild(this._div);
    }
    plugin.LoaderScreen.prototype = Object.create(Plugin.prototype);
    plugin.LoaderScreen.prototype.constructor = plugin.LoaderScreen;
    plugin.LoaderScreen.prototype.onEvent = function (eventType, eventData) {
        switch (eventType) {
        case core.GameEvents.ENGINE_INITIALIZED:
            this._isEngineInitialized = true;
            this._div.remove();
            setTimeout(function () {
                utility.fitText();
            }, 3000);
            break;
        }
    };



    /* Class AutoSaver Plugin
        Continuously sends the gamehistory tree to the server.
        */
    plugin.AutoSaver = function (gameEngine) {
        Plugin.call(this, gameEngine);
        var self = this;
        this._gameExpiringDays = 7;
        this._isInitialized = false;
        this._missionID = null;
        this._isSaved = true;
        this._gameID = '';
        this._isBusy = false;

        //TODO: change after testing done.
        this._logInterval = 10;

        this._funAutoSave = function () {
            if (!self._isSaved) {
                net.sendPOSTRequest({
                    type: 'savegameinfos',
                    gameID: self._gameID
                }, function (saveGameInfos) {
                    var deltaIndex = saveGameInfos.deltaIndex;

                    var gameHistory = self._gameEngine.pluginEvent(core.GameEvents.GAME_HISTORY_REQUEST, {
                        compressed: false
                    });
                    var deltaNodeHistory = gameHistory.nodeHistory.slice(deltaIndex, gameHistory.nodeHistory.length);
                    if (deltaNodeHistory.length) {
                        var deltaNodes = {};
                        for (var i = 0; i < deltaNodeHistory.length; i++) {
                            var nodeID = deltaNodeHistory[i];
                            deltaNodes[nodeID] = gameHistory.nodes[nodeID];
                        }
                        var deltaGameHistory = {
                            nodeHistory: deltaNodeHistory,
                            nodes: deltaNodes
                        };
                        deltaGameHistory = JSON.stringify(deltaGameHistory);
                        net.sendPOSTRequest({
                            type: 'savegameupdate',
                            gameID: self._gameID,
                            deltaData: deltaGameHistory,
                            deltaIndex: deltaIndex
                        }, function (saveGameInfos) {
                            self._isSaved = true;
                            console.log('Autosave success');
                            setTimeout(self._funAutoSave, self._logInterval * 1000);
                        }, function (error) {
                            console.log('Autosave error');
                            setTimeout(self._funAutoSave, self._logInterval * 1000);
                        });
                    } else {
                        self._isSaved = true;
                        setTimeout(self._funAutoSave, self._logInterval * 1000);
                    }
                }, function (error) {
                    setTimeout(self._funAutoSave, self._logInterval * 1000);
                });
            } else {
                setTimeout(self._funAutoSave, self._logInterval * 1000);
            }
        };
    };
    plugin.AutoSaver.prototype = Object.create(Plugin.prototype);
    plugin.AutoSaver.prototype.constructor = plugin.AutoSaver;
    plugin.AutoSaver.prototype.onEvent = function (eventType, eventData) {
        var self = this;
        switch (eventType) {
        case core.GameEvents.ENGINE_INITIALIZED:
            this._isEngineInitialized = true;
            break;

        case core.GameEvents.GAME_ID_AVAILABLE:
            this._gameID = eventData.gameID;
            break;

        case core.GameEvents.GAME_ID_CHANGE:
            this._gameID = eventData.gameID;
            break;

        case core.GameEvents.GAME_PHASE_CHANGE:
            switch (eventData.phase) {
            case core.GameStatePhases.ORBITING_BODY_OVERVIEW:
            case core.GameStatePhases.ORBITING_BODY_OVERVIEW_LOCKED:
                if (!(this._isSaved || this._isInitialized || this._isBusy)) {
                    var self = this;
                    this._isBusy = true;
                    if ((this._gameID != '') && (this._missionID != null)) {
                        console.log('Autosave init');
                        if (this._gameID[0] == 'm') {
                            var gameHistory = this._gameEngine.pluginEvent(core.GameEvents.GAME_HISTORY_REQUEST, {
                                compressed: false
                            });
                            var deltaNodeHistory = gameHistory.nodeHistory;
                            var deltaNodes = {};
                            for (var i = 0; i < deltaNodeHistory.length; i++) {
                                var nodeID = deltaNodeHistory[i];
                                deltaNodes[nodeID] = gameHistory.nodes[nodeID];
                            }
                            var deltaGameHistory = {
                                nodeHistory: deltaNodeHistory,
                                nodes: deltaNodes
                            };
                            deltaGameHistory = JSON.stringify(deltaGameHistory);
                            net.sendPOSTRequest({
                                type: 'savegameinit',
                                missionID: this._missionID,
                                deltaData: deltaGameHistory
                            }, function (saveGameInfos) {
                                self._gameID = saveGameInfos.gameID;
                                net.replaceCookie('gameID', self._gameID, self._gameExpiringDays);
                                self._gameEngine.pluginEvent(core.GameEvents.GAME_ID_CHANGE, {
                                    gameID: self._gameID
                                });
                                setTimeout(self._funAutoSave, self._logInterval * 1000);
                                console.log('Autosave running');
                                self._isInitialized = true;
                                self._isBusy = false;
                            }, function (error) {
                                console.log('Autosave init error');
                                self._isBusy = false;
                            });
                        } else {
                            setTimeout(self._funAutoSave, self._logInterval * 1000);
                            console.log('Autosave running');
                            this._isInitialized = true;
                            this._isBusy = false;
                        }
                    }
                }
                break;

            case core.GameStatePhases.SOLVING:
                this._isSaved = false;
                break;
            }
            break;


        case core.GameEvents.MISSION_ID_AVAILABLE:
            this._missionID = eventData.missionID;
            break;
        }
    };


    /* Class SaveWindow
        GUI for saving the current game.
    */
    function SaveWindow(menu) {
        var self = this;
        this._menu = menu;
        this._data = {
            isCancelled: false,
            saveName: '',
            gameID: ''
        };

        this._backgroundDiv = document.createElement('div');
        this._backgroundDiv.className = 'browser-background';
        this._backgroundDiv.onclick = function () {
            return false;
        };

        this._div = document.createElement('div');
        this._div.className = 'browser-container center-vertically center-horizontally';

        var list = document.createElement('div');
        list.id = 'browserlist';
        list.className = 'browser-list center-horizontally unselectable';

        var tools = document.createElement('div');
        tools.className = 'browser-tools center-horizontally';

        var text = document.createElement('input');
        text.id = 'savepathinput';
        text.className = 'text-input selectable';

        var cancel = document.createElement('div');
        cancel.innerHTML = 'cancel';
        cancel.onclick = function () {
            self._data.isCancelled = true;
            self.close();
            self._menu.onSaveWindowClosed(self._data);
        };
        cancel.className = 'button align-right text-fit';
        var action = document.createElement('div');
        action.id = 'windowsavebutton';
        action.innerHTML = 'save';
        action.className = 'button align-right text-fit';
        action.onclick = function () {
            self._data.isCancelled = false;
            var saveName = $('#savepathinput').val();
            saveName = saveName.trim();
            self._data.gameID = '';
            $('.savegame-entry').each(function () {
                if ($(this).children('.name').text() == saveName) {
                    self._data.gameID = $(this).attr('id');
                }
            });
            self._data.saveName = saveName;
            var busyDiv = document.createElement('div');
            var busyImg = document.createElement('img');
            busyImg.className = 'center-vertically center-horizontally';
            busyImg.src = 'res/img/busy.gif';
            busyImg.style.width = '3%';
            busyImg.style.height = 'auto';
            busyDiv.appendChild(busyImg);
            busyDiv.className = 'busy-container';
            self._div.appendChild(busyDiv);
            $('.busy-container').bind('contextmenu', function () {
                return false;
            });
            self._menu.onSaveWindowClosed(self._data);
        };

        tools.appendChild(text);
        tools.appendChild(action);
        tools.appendChild(cancel);

        this._div.appendChild(list);
        this._div.appendChild(tools);
    }
    SaveWindow.prototype = {
        constructor: SaveWindow,

        open: function () {
            var self = this;
            document.body.appendChild(this._backgroundDiv);
            document.body.appendChild(this._div);
            utility.fitText();
            $('.busy-container').remove();
            $('#windowsavebutton').hide();
            $('#savepathinput').bind('input', function () {
                if ($(this).val().trim().length) {
                    $('#windowsavebutton').show();
                } else {
                    $('#windowsavebutton').hide();
                }
            });
            net.sendGETRequest('/savegamelist', 'html', {}, function (response) {
                $('#browserlist').html(response);
                $('.savegame-entry').click(function () {
                    $('#savepathinput').val($(this).children('.name').html());
                    $('#savepathinput').trigger('input');
                });
                var gameID = self._menu.getGameID();
                $('.savegame-entry').each(function () {
                    if ($(this).attr('id') == gameID) {
                        $('#savepathinput').val($(this).children('.name').html());
                        $('#savepathinput').trigger('input');
                    }
                });
                utility.fitText();
            }, function (error) {
                alert('Could not retrieve save games.');
                self.close();
            });
            $('#savepathinput').trigger('input');

            $('.browser-background, .browser-container').on('contextmenu', function () {
                return false;
            });
        },

        close: function () {
            this._div.remove();
            this._backgroundDiv.remove();
        }
    };

    /* Class Menu Plugin 
    User Interface for:
        - Going back to the dashboard
        - Saving the current game
    */
    plugin.Menu = function (gameEngine) {
        Plugin.call(this, gameEngine);
        var self = this;

        this._gameExpiringDays = 7;
        this._doRedirect = false;
        this._isSaved = true;
        this._missionID = null;
        this._gameID = '';
        this._isLoggedIn = net.isLoggedIn();

        this._saveWindow = new SaveWindow(this);

        this._container = document.createElement('div');
        this._container.className = 'menu-container';

        this._content = document.createElement('div');
        this._content.className = 'content-container text-fit';
        this._content.style.textAlign = 'center';

        this._content.innerHTML = '<h3 class="unselectable">jupiter tour</h3> \
                        <div id="dashboardbutton" class="button unselectable">dashboard</div> \
                        <div id="savebutton" class="button unselectable">save</div>';

        this._container.appendChild(this._content);

    };
    plugin.Menu.prototype = Object.create(Plugin.prototype);
    plugin.Menu.prototype.constructor = plugin.Menu;
    plugin.Menu.prototype.getGameID = function () {
        return this._gameID;
    };
    plugin.Menu.prototype.onSaveWindowClosed = function (data) {
        var self = this;
        if (!data.isCancelled) {
            if (data.gameID == '') {
                if (this._gameID != '' && this._missionID != null) {
                    if (this._gameID[0] == 'm') {
                        var gameHistory = self._gameEngine.pluginEvent(core.GameEvents.GAME_HISTORY_REQUEST, {
                            compressed: false
                        });
                        var deltaNodeHistory = gameHistory.nodeHistory;
                        var deltaNodes = {};
                        for (var i = 0; i < deltaNodeHistory.length; i++) {
                            var nodeID = deltaNodeHistory[i];
                            deltaNodes[nodeID] = gameHistory.nodes[nodeID];
                        }
                        var deltaGameHistory = {
                            nodeHistory: deltaNodeHistory,
                            nodes: deltaNodes
                        };
                        deltaGameHistory = JSON.stringify(deltaGameHistory);
                        net.sendPOSTRequest({
                            type: 'savegameinit',
                            missionID: this._missionID,
                            name: data.saveName,
                            deltaData: deltaGameHistory
                        }, function (saveGameInfos) {
                            self._gameID = saveGameInfos.gameID;
                            net.replaceCookie('gameID', self._gameID, self._gameExpiringDays);
                            self._saveWindow.close();
                            self._gameEngine.pluginEvent(core.GameEvents.GAME_ID_CHANGE, {
                                gameID: self._gameID
                            });
                            self._isSaved = true;
                            if (self._doRedirect) {
                                window.location.href = '/dashboard/index.html';
                            }
                        }, function (error) {
                            alert('Something went wrong with transmitting the savegame data');
                            self._saveWindow.close();
                        });
                    } else {
                        net.sendPOSTRequest({
                                type: 'savegameinfos',
                                gameID: this._gameID
                            }, function (saveGameInfos) {
                                if (saveGameInfos.name == null || saveGameInfos.name == data.saveName) {
                                    var deltaIndex = saveGameInfos.deltaIndex;

                                    var gameHistory = self._gameEngine.pluginEvent(core.GameEvents.GAME_HISTORY_REQUEST, {
                                        compressed: false
                                    });
                                    var deltaNodeHistory = gameHistory.nodeHistory.slice(deltaIndex, gameHistory.nodeHistory.length);
                                    if (deltaNodeHistory.length || saveGameInfos.name == null) {
                                        var deltaNodes = {};
                                        for (var i = 0; i < deltaNodeHistory.length; i++) {
                                            var nodeID = deltaNodeHistory[i];
                                            deltaNodes[nodeID] = gameHistory.nodes[nodeID];
                                        }
                                        var deltaGameHistory = {
                                            nodeHistory: deltaNodeHistory,
                                            nodes: deltaNodes
                                        };
                                        deltaGameHistory = JSON.stringify(deltaGameHistory);
                                        net.sendPOSTRequest({
                                            type: 'savegameupdate',
                                            gameID: self._gameID,
                                            deltaData: deltaGameHistory,
                                            deltaIndex: deltaIndex,
                                            name: data.saveName
                                        }, function (saveGameInfos) {
                                            self._gameID = saveGameInfos.gameID;
                                            self._saveWindow.close();
                                            self._gameEngine.pluginEvent(core.GameEvents.GAME_ID_CHANGE, {
                                                gameID: self._gameID
                                            });
                                            self._isSaved = true;
                                            if (self._doRedirect) {
                                                window.location.href = '/dashboard/index.html';
                                            }
                                            net.replaceCookie('gameID', self._gameID, self._gameExpiringDays);
                                        }, function (error) {
                                            alert('Something went wrong with transmitting the savegame data');
                                            self._saveWindow.close();
                                        });
                                    } else {
                                        self._saveWindow.close();
                                    }
                                } else {
                                    var gameHistory = self._gameEngine.pluginEvent(core.GameEvents.GAME_HISTORY_REQUEST, {
                                        compressed: false
                                    });
                                    var deltaNodeHistory = gameHistory.nodeHistory;
                                    var deltaNodes = {};
                                    for (var i = 0; i < deltaNodeHistory.length; i++) {
                                        var nodeID = deltaNodeHistory[i];
                                        deltaNodes[nodeID] = gameHistory.nodes[nodeID];
                                    }
                                    var deltaGameHistory = {
                                        nodeHistory: deltaNodeHistory,
                                        nodes: deltaNodes
                                    };
                                    deltaGameHistory = JSON.stringify(deltaGameHistory);
                                    net.sendPOSTRequest({
                                        type: 'savegameinit',
                                        missionID: self._missionID,
                                        name: data.saveName,
                                        deltaData: deltaGameHistory
                                    }, function (saveGameInfos) {
                                        self._gameID = saveGameInfos.gameID;
                                        self._saveWindow.close();
                                        self._gameEngine.pluginEvent(core.GameEvents.GAME_ID_CHANGE, {
                                            gameID: self._gameID
                                        });
                                        self._isSaved = true;
                                        if (self._doRedirect) {
                                            window.location.href = '/dashboard/index.html';
                                        }
                                        net.replaceCookie('gameID', self._gameID, self._gameExpiringDays);
                                    }, function (error) {
                                        alert('Something went wrong with transmitting the savegame data');
                                        self._saveWindow.close();
                                    });
                                }
                            },
                            function (error) {
                                alert('Something went wrong with the savegame info request on the server');
                                self._saveWindow.close();
                            });
                    }
                }
            } else {
                net.sendPOSTRequest({
                    type: 'savegameinfos',
                    gameID: data.gameID
                }, function (saveGameInfos) {
                    var deltaIndex;
                    if (data.gameID != self._gameID) {
                        deltaIndex = 0;
                    } else {
                        deltaIndex = saveGameInfos.deltaIndex;
                    }
                    var gameHistory = self._gameEngine.pluginEvent(core.GameEvents.GAME_HISTORY_REQUEST, {
                        compressed: false
                    });
                    var deltaNodeHistory = gameHistory.nodeHistory.slice(deltaIndex, gameHistory.nodeHistory.length);
                    if (deltaNodeHistory.length) {
                        var deltaNodes = {};
                        for (var i = 0; i < deltaNodeHistory.length; i++) {
                            var nodeID = deltaNodeHistory[i];
                            deltaNodes[nodeID] = gameHistory.nodes[nodeID];
                        }
                        var deltaGameHistory = {
                            nodeHistory: deltaNodeHistory,
                            nodes: deltaNodes
                        };
                        deltaGameHistory = JSON.stringify(deltaGameHistory);
                        net.sendPOSTRequest({
                            type: 'savegameupdate',
                            gameID: data.gameID,
                            deltaData: deltaGameHistory,
                            deltaIndex: deltaIndex,
                            missionID: self._missionID,
                            name: data.saveName
                        }, function (saveGameInfos) {
                            self._gameID = saveGameInfos.gameID;
                            self._saveWindow.close();
                            self._gameEngine.pluginEvent(core.GameEvents.GAME_ID_CHANGE, {
                                gameID: self._gameID
                            });
                            self._isSaved = true;
                            if (self._doRedirect) {
                                window.location.href = '/dashboard/index.html';
                            }
                            net.replaceCookie('gameID', self._gameID, self._gameExpiringDays);
                        }, function (error) {
                            alert('Something went wrong with transmitting the savegame data');
                            self._saveWindow.close();
                        });
                    } else {
                        self._isSaved = true;
                        self._saveWindow.close();
                    }
                }, function (error) {
                    alert('Something went wrong with the savegame info request on the server');
                    self._saveWindow.close();
                });
            }
        }
    };

    plugin.Menu.prototype.onEvent = function (eventType, eventData) {
        var self = this;
        switch (eventType)  {
        case core.GameEvents.GAME_ID_AVAILABLE:
            this._gameID = eventData.gameID;
            break;

        case core.GameEvents.GAME_ID_CHANGE:
            this._gameID = eventData.gameID;
            break;

        case core.GameEvents.ENGINE_INITIALIZED:
            this._isEngineInitialized = true;

            this._gameEngine.getPluginDomElement().appendChild(this._container);
            utility.fitText();

            $(this._content).children('.button').on('contextmenu', function () {
                return false;
            });

            if (!this._isLoggedIn) {
                $('#savebutton').addClass('disabled');
            } else {
                $('#savebutton').removeClass('disabled');
            }

            $('#savebutton').on('click', function () {
                self._saveWindow.open();
            });

            $('#dashboardbutton').on('click', function () {
                if (self._isLoggedIn) {
                    self._doRedirect = true;
                    if (!self._isSaved) {
                        if (confirm('Do you want to save your game before switching to the dashboard?')) {
                            $('#savebutton').trigger('click');
                        } else {
                            window.location.href = '/dashboard/index.html';
                        }
                    } else {
                        window.location.href = '/dashboard/index.html';
                    }
                } else {
                    window.location.href = '/dashboard/index.html';
                }
            });
            break;

        case core.GameEvents.GAME_PHASE_CHANGE:
            switch (eventData.phase) {
            case core.GameStatePhases.ORBITING_BODY_OVERVIEW:
            case core.GameStatePhases.ORBITING_BODY_OVERVIEW_LOCKED:
                $('#dashboardbutton').removeClass('disabled');
                if (this._isLoggedIn && (this._missionID != null)) {
                    $('#savebutton').removeClass('disabled');
                }
                break;

            default:
                $(this._content).children('.button').addClass('disabled');
                this._isSaved = false;
                break;
            }
            break;

        case core.GameEvents.MISSION_ID_AVAILABLE:
            this._missionID = eventData.missionID;
            break;
        }
    };

    /* Class GameLoader Plugin
        Calls the GameEngine to setup a game
    */
    plugin.GameLoader = function (gameEngine) {
        Plugin.call(this, gameEngine);
    };
    plugin.GameLoader.prototype = Object.create(Plugin.prototype);
    plugin.GameLoader.prototype.constructor = plugin.GameLoader;
    plugin.GameLoader.prototype.onEvent = function (eventType, eventData) {
        var self = this;
        switch (eventType) {
        case core.GameEvents.ENGINE_INITIALIZED:
            this._isEngineInitialized = true;
            break;

        case core.GameEvents.GAME_ID_AVAILABLE:
            var gameID = eventData.gameID;
            if (gameID[0] == 'm') {
                net.sendGETRequest('/missions/' + gameID + '.json', 'json', {}, function (missionData) {
                    self._gameEngine.pluginEvent(core.GameEvents.MISSION_ID_AVAILABLE, {
                        missionID: missionData.mission.id
                    });
                    self._gameEngine.pluginEvent(core.GameEvents.SETUP_GAME, {
                        mission: missionData.mission,
                        saveGame: missionData.saveGame
                    });
                }, function (error) {
                    console.log('GameLoader error.');
                });
            } else {
                net.sendGETRequest('/savegame',
                    'json', {
                        gameID: gameID
                    },
                    function (missionData) {
                        self._gameEngine.pluginEvent(core.GameEvents.MISSION_ID_AVAILABLE, {
                            missionID: missionData.mission.id
                        });
                        self._gameEngine.pluginEvent(core.GameEvents.SETUP_GAME, {
                            mission: missionData.mission,
                            saveGame: missionData.saveGame
                        });
                    },
                    function (error) {
                        console.log('GameLoader error.');
                    });
            }
            break;
        }
    };

    /* Class FlightEngineer
        Displays more detailed information about current spacecraft state
    */
    plugin.FlightEngineer = function (gameEngine) {
        Plugin.call(this, gameEngine);
        this._orbitingBodies = {};
        this._isInitialized = false;
        this._container = document.createElement('div');
        this._container.className = 'flightengineer-container';

        var content = document.createElement('div');
        content.className = 'content-container';

        function createEntry(id, name, value, height) {
            return '<div style="width:100%;height:' + height + ';display:inline-block;white-space:nowrap;"><div style="width:50%;height:100%;display:inline-block;vertical-align:top;" class="text-fit">' + name + '</div><div style="width:50%;height:100%;display:inline-block;vertical-align:top;" class="text-fit" id="' + id + '"></div>' + value + '</div>';
        }
        var entries = {
            feEpoch: 'mission epoch',
            fePassedDays: 'passed days',
            feTotalDeltaV: 'total deltaV',
            feScore: 'score',
            feSOI: 'current sphere of influence',
            feVInfinity: 'relative velocity at infinity',
            feMappedArea: 'last mapped area',
            feDeltaV: 'last leg deltaV',
            fePerformance: 'last leg performance',
            feTimeOfFlight: 'last leg time of flight',
            feChromosome: 'last leg chromosome',
        }

        var innerHTML = '<div class="title text-fit">flight engineer</div><div class="values-container">';
        var height = '10%';
        for (var key in entries) {
            innerHTML += createEntry(key, entries[key], '', height);
        }
        innerHTML += '</div>';
        content.innerHTML = innerHTML;
        this._container.appendChild(content);
    };
    plugin.FlightEngineer.prototype = Object.create(Plugin.prototype);
    plugin.FlightEngineer.prototype.onEvent = function (eventType, eventData) {
        switch (eventType) {
        case core.GameEvents.ENGINE_INITIALIZED:
            this._isEngineInitialized = true;

            this._gameEngine.getPluginDomElement().appendChild(this._container);
            utility.fitText();

            this._orbitingBodies = this._gameEngine.pluginEvent(core.GameEvents.ORBITING_BODIES_MAPPING_REQUEST);
            this._isInitialized = true;
            break;

        case core.GameEvents.GAME_STATE_CHANGE:
            if (this._isInitialized) {
                var gameState = eventData.gameState;
                $('#feEpoch').text(utility.round(gameState.getEpoch()) + ' MJD');
                $('#fePassedDays').text(utility.round(gameState.getPassedDays()));
                $('#feVInfinity').text(gameState.getVelocityInf().toString(2));
                $('#feTotalDeltaV').text(utility.round(gameState.getTotalDeltaV()) + ' m/s');
                $('#feScore').text(gameState.getScore());
                $('#feSOI').text(gameState.getOrbitingBody().getName());
                var transferLeg = gameState.getTransferLeg();
                if (!transferLeg.chromosome.length) {
                    transferLeg.chromosome = [];
                }
                $('#feChromosome').text(transferLeg.chromosome.map(function (value) {
                    return Math.round(value * 100) / 100;
                }).prettyPrint());
                var feMappedFace = '';
                if (transferLeg.mappedFaceID != '') {
                    var faceInfos = transferLeg.mappedFaceID.split('_');
                    switch (this._orbitingBodies[faceInfos[0]].getSurfaceType()) {
                    case model.SurfaceTypes.SPHERE:
                        feMappedFace = 'part of the surface on ' + this._orbitingBodies[faceInfos[0]].getName();
                        break;
                    case model.SurfaceTypes.TRUNCATED_ICOSAHEDRON:
                        feMappedFace = 'Face ' + faceInfos[1] + ' on ' + this._orbitingBodies[faceInfos[0]].getName();
                        break;
                    }
                }
                $('#feMappedArea').text(feMappedFace);
                $('#feDeltaV').text(utility.round(transferLeg.deltaV) + ' m/s');
                $('#fePerformance').text(utility.round(transferLeg.dsmRating) * 100 + ' %');
                $('#feTimeOfFlight').text(utility.round(transferLeg.timeOfFlight));
            }
            break;
        }
    };

    /* Class MissionFeed
        Displays more information about the current mission.
    */
    plugin.MissionFeed = function (gameEngine) {
        Plugin.call(this, gameEngine);
        this._missionID = null;

        this._container = document.createElement('div');
        this._container.className = 'missionfeed-container';

        var content = document.createElement('div');
        content.className = 'content-container';
        var title = document.createElement('div');
        title.className = 'title text-fit';
        title.textContent = 'mission feed';
        this._feedDiv = document.createElement('div');
        this._feedDiv.className = 'feed';
        content.appendChild(title);
        content.appendChild(this._feedDiv);
        this._container.appendChild(content);
    };
    plugin.MissionFeed.prototype = Object.create(Plugin.prototype);
    plugin.MissionFeed.prototype.constructor = plugin.MissionFeed;
    plugin.MissionFeed.prototype.onEvent = function (eventType, eventData) {
        switch (eventType) {
        case core.GameEvents.ENGINE_INITIALIZED:
            this._isEngineInitialized = true;

            this._gameEngine.getPluginDomElement().appendChild(this._container);
            utility.fitText();
            break;

        case core.GameEvents.MISSION_ID_AVAILABLE:
            this._missionID = eventData.missionID;
            var self = this;
            net.sendGETRequest('/dashboard/playtab.html', 'html', {}, function (response) {
                    var parser = new DOMParser;
                    var doc = parser.parseFromString(response, 'text/html');
                    self._feedDiv.innerHTML = doc.getElementById('mission' + self._missionID + 'feed').innerHTML;
                },
                function (error) {
                    console.log('Error in MissionFeed');
                });
            break;
        }
    };
})();