Coursera OAuth2 client
======================

This project is a Node.js library consisting of a client for interacting with Coursera's OAuth2 authorizes APIs.

Requirements
-----
Install Node.js from https://nodejs.org/en/download/

Setup
-----

Before using Coursera's OAuth2 APIs, be sure you know your client id,
client secret, and scopes you want for your application. You may create
an application at https://accounts.coursera.org/console. When creating the
application, set the Redirect URI to be ``http://localhost:9876/callback?client_id=<your_client_id>``.

Usage
------
(``Client-side``)
- Clone project, go to the project folder and build module by run command '``browserify coaclient.js -o bundlecoaclient.js``', after that you can use it at client side.

(``Server-side``)
You can use module in different ways:
- Clone project, add this module to your project, then run command 'npm install' to fetch all dependencies.
- Open terminal, go to your project folder and download module from npm global repository via command '``npm install coaclient``' after you can use it in your project:

-----
    var coaclientAPI = require('coaclient');
    coaclientAPI().addClientConfig(clientName, clientId, clientSecretKey, scope);
    coaclientAPI().generateAuthTokens(clientName);
    coaclientAPI().getAccessToken(clientName);

The Coaclient tries to open the default system browser. The application configuration will be saved to the local file if the request is succeeded.
You should check the data you've provided to the library during application configuration if you see any errors in the browser.

If the client was successfully added and configured, you will be able to successfully get authentication tokens for Coursera API. Otherwise, an exception will be thrown telling you to set up your application for API access.

Documentation
-----

``class CourseraOAuth2API``

Methods:

----
    addClientConfig(clientName, clientId, clientSecretKey, scope);

Create a new client config and save it to the local config file: ``<home.dir>/.coursera/coaconfig.csv``

Parameters:

    clientName - Client Name
    clientId - Coursera Client ID
    clientSecret - Coursera Client Secret Key
    scope - by default used "view_profile", for business use "access_business_api".
----

    deleteClientConfig(clientName);

Delete client config from file: ``<home.dir>/.coursera/coaconfig.csv``

----
    generateAuthTokens(clientName);

By default start-server callback listener on port 9876 and get auth tokens from Coursera OAuth API.

----
    getAuthTokens(clientName).then(function (tokens) {
        // do something with 'tokens';
    }).catch(function (error) {
        // do something if catch error;
    });

Returns:
Promise object with refresh, access tokens and expired time from auth token file:  ``<home.dir>/.coursera/<client_name>_oauth2.csv``.

----
    getAccessToken(clientName).then(function (accessToken) {
        // do something with 'accessToken';
    }).catch(function (error) {
        // do something if catch error;
    });

Returns:
Promise object with access token from auth token file:  ``<home.dir>/.coursera/<client_name>_oauth2.csv``.

----
    getClientConfigs.then(function (listOfClientConfigs) {
        // do something with 'listOfClients';
    }).catch(function (error) {
        // do something if catch error;
    });

Returns:
Promise object with a list of client configs from local file: ``<home.dir>/.coursera/coaconfig.csv``.

----
    getClientConfig(clientNameOrId).then(function (clientConfig) {
        // do something with 'clientConfig';
    }).catch(function (error) {
        // do something if catch error;
    });

Returns:
Promise object with client config from local file: ``<home.dir>/.coursera/coaconfig.csv``.

----

Bugs / Issues / Feature Requests
-----

Please use the Github issue tracker to document any bugs or other issues you
encounter while using this tool.
