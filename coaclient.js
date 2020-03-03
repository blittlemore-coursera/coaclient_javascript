const csvWriter = require('csv-write-stream');
const csvParser = require('csv-parser');
const os = require('os');
const fs = require('fs');
const util = require('util');
const http = require('http');
const open = require('open');
const url = require('url');
const request = require('request');

const CACHE_DIR_PATH = os.homedir() + '/.coursera/';
const CONFIG_FILE_NAME = "coaconfig.csv";
const AUTH_FILE_SUFFIX = "_aout.csv";
const REFRESH_TOKEN_KEY = "refresh_token";
const AUTHORIZATION_CODE_VALUE = "authorization_code";
const SCOPE_ACCESS_BUSINESS = "access_business_api";
const SCOPE_VIEW_PROFILE = "view_profile";
const ACCESS_TYPE_VALUE = "offline";
const COURSERA_CODE_URI = "https://accounts.coursera.org/oauth2/v1/auth?scope=%s&redirect_uri=%s&access_type=offline&grant_type=authorization_code&response_type=code&client_id=%s";
const COURSERA_AUTH_TOKEN_URI = "https://accounts.coursera.org/oauth2/v1/token";
const COURSERA_CALLBACK_URI = "http://localhost:9876/callback?client_id=";
const EXPIRES_IN = 1800000;
const DEFAULT_PORT = 9876;
const ENCODING_UTF8 = 'utf8';
const CONTENT_TYPE_FORM = 'application/x-www-form-urlencoded';

function CoaclientAPI() {}

/**
 * Get access token by client name from local cache token file.
 * If lifetime of access token is expired then it will refresh and save new tokens.
 *
 * @param clientName Name of client
 * @returns {Promise<any>} Access token
 */
CoaclientAPI.prototype.getAccessToken = function(clientName) {
    return new Promise(function (resolve, reject) {
        let inputStream = fs.createReadStream(CACHE_DIR_PATH + clientName + AUTH_FILE_SUFFIX, ENCODING_UTF8);
        inputStream
            .pipe(csvParser())
            .on('data', function (authTokens) {
                if (Number(authTokens.expiredIn) < new Date().getTime()) {
                    refreshAuthTokens(authTokens, clientName).then(function (accessToken) {
                        resolve(accessToken);
                    }).catch(function (error) {
                        console.log(error);
                    })
                } else {
                    resolve(authTokens.accessToken)
                }
            })
            .on('end', function (data) {
            });
        inputStream.on('error', function(err) {
            reject("Error reading auth tokens file, try to generate new one: " + err);
        });
    });
};

/**
 * Get refresh, access tokens and expired time by client name from local cache token file
 *
 * @param clientName Name of client
 * @returns {Promise<any>} Refresh, access tokens and expired_in time
 */
CoaclientAPI.prototype.getAuthTokens = function(clientName) {
    return new Promise(function (resolve, reject) {
        let inputStream = fs.createReadStream(CACHE_DIR_PATH + clientName + AUTH_FILE_SUFFIX, ENCODING_UTF8);
        inputStream
            .pipe(csvParser())
            .on('data', function (row) {
                resolve(row)
            })
            .on('end', function (data) {
                reject("Tokens not found in file: " + CACHE_DIR_PATH + clientName + AUTH_FILE_SUFFIX)
            });
        inputStream.on('error', function(err) {
            reject("Error reading config file: " + err);
        });
    })
};

/**
 * Get client config with full information by client name
 * or clientId from local cache config file.
 *
 * @param clientIdentifier Name of client or client ID
 * @returns {Promise<any>} Client config object
 */
CoaclientAPI.prototype.getClientConfig = function(clientIdentifier) {
    return new Promise(function (resolve, reject) {
        let inputStream = fs.createReadStream(CACHE_DIR_PATH + CONFIG_FILE_NAME, ENCODING_UTF8);
        inputStream
            .pipe(csvParser())
            .on('data', function (row) {
                if (row.name === clientIdentifier || row.clientId === clientIdentifier) {
                    var clientConfig = {
                        'name': row.name,
                        'clientId': row.clientId,
                        'secretKey': row.secretKey,
                        'scope': row.scope
                    };
                    resolve(clientConfig);
                }
            }).on('end', function (data) {
            reject("Client " + clientIdentifier + " not found.")
        });
        inputStream.on('error', function(err) {
            reject("Error reading config file: " + err);
        });
    })
};

/**
 * Get list of client config from local cache config dir.
 *
 * @returns {Promise<any>} List of client config ojects
 */
CoaclientAPI.prototype.getClientConfigs = function() {
    return new Promise(function (resolve, reject) {
        let listOfClientConfig = [];
        let inputStream = fs.createReadStream(CACHE_DIR_PATH + CONFIG_FILE_NAME, ENCODING_UTF8);
        inputStream
            .pipe(csvParser())
            .on('data', function (row) {
                let clientConfig = {
                    'name': row.name,
                    'clientId': row.clientId,
                    'secretKey': row.secretKey,
                    'scope': row.scope
                };
                listOfClientConfig.push(clientConfig);
                resolve(listOfClientConfig);
            }).on('end', function (data) {
            reject("Config file is empty: " + CACHE_DIR_PATH + CONFIG_FILE_NAME);
        });
        inputStream.on('error', function(err) {
            reject("Error reading config file: " + err);
        });
    });
};

/**
 * Add client config to local cache config file
 *
 * @param clientName Name of client
 * @param clientId Client ID
 * @param clientSecret Client Secret Key
 * @param scope Scope of access (by default used 'view_profile')
 */
CoaclientAPI.prototype.addClientConfig = function(clientName, clientId, clientSecret, scope) {
    var self = this;
    if (clientName === '' || clientId === '' || clientSecret === '') {
        console.log("Parameters can't be empty.");
    } else if (scope !== '' &&
        scope !== SCOPE_VIEW_PROFILE &&
        scope !== SCOPE_VIEW_PROFILE + "," + SCOPE_ACCESS_BUSINESS &&
        scope !== SCOPE_ACCESS_BUSINESS) {
        console.log("Scope is invalid: " + scope + ". " +
            "Available scopes are 'view_profile' or 'access_business_api'")
    } else {
        self.getClientConfig(clientName).then(function (clientConfig) {
            console.log("Client with name: " + clientConfig.name + " already exist");
        }).catch(function (error) {
            self.getClientConfig(clientId).then(function (clientConfig) {
                console.log("Client with id: " + clientConfig.clientId + " already exist");
            }).catch(function (error) {
                saveClientToCSVFile(clientName, clientId, clientSecret, scope);
            });
        });
    }
};

/**
 * Start server callback listener, generate new tokens and save them to local cache token file.
 *
 * @param clientName Name of client
 */
CoaclientAPI.prototype.generateAuthTokens = function(clientName) {
    var self = this;
    self.getClientConfig(clientName).then(function (clientConfig) {
        const courseraCodeURI = util.format(
            COURSERA_CODE_URI,
            clientConfig.scope,
            COURSERA_CALLBACK_URI + clientConfig.clientId,
            clientConfig.clientId);
        startServerCallbackListener();
        (async () => {
            await open(courseraCodeURI);
        })();
    }).catch(function (error) {
        console.log(error);
    });
};

/**
 * Delete client config by client name from local cache config file
 *
 * @param clientName Name of client
 */
CoaclientAPI.prototype.deleteClientConfig = function(clientName) {
    var self = this;
    self.getClientConfig(clientName).then(function (result) {
        self.getClientConfigs().then(function (clients) {
            const arr = clients.filter(client => {
                return  client.name !== clientName;
            });
            let writer;
            if (!fs.existsSync(CACHE_DIR_PATH)) {
                fs.mkdirSync(CACHE_DIR_PATH);
            }
            if (fs.existsSync(CACHE_DIR_PATH + CONFIG_FILE_NAME)) {
                fs.unlinkSync(CACHE_DIR_PATH + CONFIG_FILE_NAME)
            }
            writer = csvWriter({headers: ["name", "clientId", "secretKey", "scope"]});
            writer.pipe(fs.createWriteStream(CACHE_DIR_PATH + CONFIG_FILE_NAME, {flags: 'a'}));
            arr.forEach(config => {
                writer.write({
                    name: config.name,
                    clientId: config.clientId,
                    secretKey: config.secretKey,
                    scope: config.scope
                });
            });
            writer.end();
            console.log("Client " + clientName + " successfully deleted");
        }).catch(function (error) {
            console.log(error)
        })
    }).catch(function (error) {
        console.log(error);
    })
};

function sendAuthTokensRequest(clientId, courseraCode) {
    CoaclientAPI.prototype.getClientConfig(clientId).then(function (config) {
        const form = {
            'client_id': config.clientId,
            'client_secret': config.secretKey,
            'code': courseraCode,
            'redirect_uri': (COURSERA_CALLBACK_URI + config.clientId),
            'access_type': ACCESS_TYPE_VALUE,
            'grant_type': AUTHORIZATION_CODE_VALUE
        };
        console.log(config)
        console.log(courseraCode)
        console.log(COURSERA_AUTH_TOKEN_URI)
        const headers = {
            'Content-Type': CONTENT_TYPE_FORM
        };

        request.post({ url: COURSERA_AUTH_TOKEN_URI, form: form, headers: headers }, function (e, r, body) {
            const params = JSON.parse(body);
            console.log(params)
            if (params.refresh_token === undefined) {
                console.log("Error send authentication tokens request: " + params.msg);
            } else {
                saveAuthTokensToCSVFile(config, params.refresh_token, params.access_token);
                console.log("Auth tokens for client " + config.name + " successfully saved.");
            }
        });
    }).catch(function (error) {
        console.log(error);
    });
}

function saveAuthTokensToCSVFile(config, refreshToken, accessToken) {
    let writer;
    let authTokenFilePath = CACHE_DIR_PATH + config.name + AUTH_FILE_SUFFIX;
    if (fs.existsSync(authTokenFilePath)) {
        fs.unlinkSync(authTokenFilePath);
    }
    let expiredIn = Number(new Date().getTime()) + EXPIRES_IN;
    writer = csvWriter({headers: ['refreshToken', 'accessToken', "expiredIn"]});
    writer.pipe(fs.createWriteStream(authTokenFilePath, {flags: 'a'}));
    writer.write({
        refreshToken: refreshToken,
        accessToken: accessToken,
        expiredIn: expiredIn
    });
    writer.end();
}

function startServerCallbackListener() {
    let server = http.createServer(function (req, res) {
        const params = url.parse(req.url, true).query;
        if (params === null || params.code === '' || params.code === undefined) {
            res.writeHead(404);
            res.end("Failed to generate code from Coursera.");
        } else {
            sendAuthTokensRequest(params.client_id, params.code);
            res.writeHead(200);
            res.end("Generating code is successfully.");
            server.close();
        }
    });
    server.on('error', function (e) {
        console.log("Port already in used: " + DEFAULT_PORT + ", " + e)
    });
    server.listen(DEFAULT_PORT);
}

function saveClientToCSVFile(clientName, clientId, clientSecret, scope) {
    let writer;
    if (!fs.existsSync(CACHE_DIR_PATH)) {
        fs.mkdirSync(CACHE_DIR_PATH);
    }
    if (!fs.existsSync(CACHE_DIR_PATH + CONFIG_FILE_NAME))
        writer = csvWriter({headers: ["name", "clientId", "secretKey", "scope"]});
    else
        writer = csvWriter({sendHeaders: false});

    if (scope === SCOPE_ACCESS_BUSINESS || scope === (SCOPE_VIEW_PROFILE + "," + SCOPE_ACCESS_BUSINESS)) {
        scope = SCOPE_VIEW_PROFILE + "+" + SCOPE_ACCESS_BUSINESS;
    }
    if (scope === '' || scope === SCOPE_VIEW_PROFILE) {
        scope = SCOPE_VIEW_PROFILE;
    }

    writer.pipe(fs.createWriteStream(CACHE_DIR_PATH + CONFIG_FILE_NAME, {flags: 'a'}));
    writer.write({
        name: clientName,
        clientId: clientId,
        secretKey: clientSecret,
        scope: scope
    });
    writer.end();
    console.log("Client " + clientName + " successfully added.")
}

function refreshAuthTokens(authTokens, clientName) {
    return new Promise(function (resolve, reject) {
        CoaclientAPI.prototype.getClientConfig(clientName).then(function (config) {
            const form = {
                'client_id': config.clientId,
                'client_secret': config.secretKey,
                'refresh_token': authTokens.refreshToken,
                'grant_type': REFRESH_TOKEN_KEY
            };

            const headers = {
                'Content-Type': CONTENT_TYPE_FORM
            };

            request.post({ url: COURSERA_AUTH_TOKEN_URI, form: form, headers: headers }, function (e, r, body) {
                var params = JSON.parse(body);
                if (params.access_token === undefined) {
                    reject("Error send authentication tokens request: " + params.msg);
                } else {
                    saveAuthTokensToCSVFile(config, authTokens.refreshToken, params.access_token);
                    console.log("Access token for client " + config.name + " successfully refreshed");
                    resolve(params.access_token);
                }
            });
        }).catch(function (error) {
            reject(error);
            console.log(error);
        });
    });
}

module.exports = CoaclientAPI;
