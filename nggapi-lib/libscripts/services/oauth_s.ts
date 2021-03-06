/// <reference path="../../../definitely_typed/angular/angular.d.ts"/>
/// <reference path="../../../definitely_typed/gapi.d.ts"/>
/// <reference path="../../../nggapi_interfaces/drive_interfaces.d.ts"/>

'use strict';


module NgGapi {
  /**
   * an Enum to define the different refresh token behaviours
   */
  export enum NoAccessTokenPolicy {
    RETRY,            // http will sleep for a config number of ms then retry
    FAIL              // http will fail with a synthetic 401
    // TODO implement this by having getAccessToken return FAIL or RETRY=nnn instead of undefined
  }

  /**
   * an Enum to define the different refresh token behaviours
   */
  export enum TokenRefreshPolicy {
    ON_DEMAND,            // token will be refreshed after a 401
    PRIOR_TO_EXPIRY       // token will be refreshed shortly prior to expiration using a setTimeout
    // TODO add some kind of "own" option which overrides calls to gapi.auth
  }

  /**
   * The OAuth service
   */
  export class OauthService implements IOauthService {
    sig = 'OauthService';               // used in unit testing to confirm DI
    isAuthInProgress = false;           // true if there is an outstanding auth (ie. refresh token) in progress to prevent multiples
    isAuthedYet = false;                // first time flag, used to set immediate mode

    testStatus:string;                  // this has no rol ein the functionality of OauthService. it's a helper property for unit tests


    /**
     *
     * @param scopes.  a space separated string of scopes
     * @param clientId. The Google client ID
     * @param tokenRefreshPolicy  One of the TokenRefreshPolicy Enum values
     * @param $log
     * @param $window
     */
    constructor(private scopes:string, private clientId:string, private tokenRefreshPolicy, private $log:ng.ILogService, private $window:ng.IWindowService) {
      //console.log("OAuth instantiated with " + scopes);
      //$log.log("scopes", this.scopes);
      //$log.log("trp", this.tokenRefreshPolicy);drivdrivee
      console.log('oauth cons');
    }


    /**
     * return an access token. Normally simply calls gapi.auth.getToken(). If that returns undefined, then
     * return undefined, and starts a background refresh. The idea is that retries of the REST call witll repeatedly fail 401 until
     * such time that the refresh completes and gapi.auth.getToken returns a valid access token.
     *
     * @return the access token string
     */
    getAccessToken():string {
      if (!this.isGapiLoaded()) {
        this.$log.warn('[O55] waiting for the gapi script to download');
        this.testStatus = 'O55';
        return undefined;
      }
      if (!!this.$window['gapi'].auth.getToken()) {
        return this.$window['gapi'].auth.getToken()['access_token'];
      } else {
        this.refreshAccessToken();
        return undefined;
      }
    }


    /**
     *  call gapi authorize.
     *  Uses isFirstAuth to set the immediate flag, so first time through there is a login prompt.
     *
     *  If isAuthInprogress, does nothing, but emits a console warning to help debug any issues where the callback wasn't invoked.
     */
    refreshAccessToken() {
      if (this.isAuthInProgress) {
        this.$log.warn('[O75] refresh access token suppressed because there is already such a request in progress');
        this.testStatus = 'O75';
        return;
      }

      if (!this.isGapiLoaded()) {
        this.$log.warn('[O81] gapi not yet loaded');
        this.testStatus = 'O81';
        return;
      }

      this.isAuthInProgress = true;

      this.$window['gapi'].auth.authorize(
        {client_id:  this.clientId,
        scope:      this.scopes,
        immediate:  this.isAuthedYet},
        ()=>{this.refreshCallback();});                    // callback invoked when gapi refresh returns with a new token
    }


    /**
     * called when gapi.auth.authorize returns
     * Reports an error if no token.
     *
     * Sets up an auto refresh if required
     */
    refreshCallback() {
      this.isAuthInProgress = false;
      this.isAuthedYet = true;
      //console.log('authed');

      var token:GoogleApiOAuth2TokenObject = this.$window['gapi'].auth.getToken();
      if (!token) {
        this.$log.error('[O99] There is a problem that authorize has returned without an access token. Poss. access denied by user? ');
        return;
      }

      // if app has requested auto-refresh, set up the timeout to refresh
      if (this.tokenRefreshPolicy == TokenRefreshPolicy.PRIOR_TO_EXPIRY) {
        var expiry:number = token.expires_in;
        this.$log.log('[O120] token will refresh after '+expiry*950+'ms');
        setTimeout(this.refreshAccessToken, expiry*950);              // refresh after 95% of the validity
        this.testStatus = 'O120';
      }
    }


    isGapiLoaded():boolean {
      return (this.$window['gapi'] && this.$window['gapi'].auth);
    }
  }
}

/**
 * Config function which returns a provider containing methods to set OAuth parameters and a $get to return the OAuth service itself.
 * This will be referenced by the app.js startup script, something like:-
 *
 *myApp.provider('oauthService', NgGapi.Config)
	.config(function (oauthServiceProvider) {
		oauthServiceProvider.setScopes('drive.file');
		oauthServiceProvider.setClientID('1234');
		oauthServiceProvider.setTokenRefreshPolicy(NgGapi.TokenRefreshPolicy.ON_DEMAND);
});
 *
 * @returns {{setScopes: (function(any): undefined), setClientID: (function(any): undefined), $get: (function(): NgGapi.OAuth)}}
 */

NgGapi['Config'] = function () {
	var scopes;
	var clientID;
	var tokenRefreshPolicy;
	return {
		setScopes: function (_scopes) {
			scopes  = _scopes;
		},
		setClientID: function (_clientID) {
			clientID = _clientID;
		},
		setTokenRefreshPolicy: function (_policy) {
			tokenRefreshPolicy = _policy;
		},
		$get: function () {
			var myInjector = angular.injector(["ng"]);
			var $log = myInjector.get("$log");
			var $window = myInjector.get("$window");
			return new NgGapi.OauthService(scopes, clientID, tokenRefreshPolicy, $log, $window);
		}
	}
};


// define the PngGapi module. This will then be included by the host app with "angular .module('MyApp', ['PngGapi']);"

angular.module('ngm.NgGapi', []);




