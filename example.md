### Dependadncy

```javascript
import { 
    apiVersion, STORAGE_ITEM_KEYS, orgCallout, APP_SETTING_KEYS, DOMSelectors,
    fetchBodyWithTrack, extractMethodEntry, afterStackCleanup, isStorageQuotaExceed
} from 'dl/_globalProperties';
import '../../../utilities/prototypes/prototypes.js';
import Logger  from '../_logger/logger.js';             // not required for our app

```


### On Start
```javascript
    onstart() {      
        try {

            // Get Session ID from the Cookies using chrome.runtime API
            this.sessionId = await chrome.runtime.sendMessage({message: "get_sid", sfHost : orgDomain});
            if(!this.sessionId) {
                this.offlineModes.sessionExpired = true;
                return;
            }
    
            // Check Inetnet Connection
            this.offlineModes.noInternet = !window.navigator.onLine;
            if(this.offlineModes.noInternet) return;
            this.offlineModes.noInternet = await this.checkNoInternet();
            if(this.offlineModes.noInternet) return;
    
            
            /**
             * Fetch Initial Essential Infos Like...
             * 1. Current User Info
             * 2. Org Info
             * 3. All Trace Flags
             * 4. All Debug Levels
             * 5. All Users
             * 6. All namespace available in org
             */
            this.fetchInitialInfo();                    // Fetch initial Infos from salesforce org
    
            setupAdvanceDebugging(this, ('dl_advance-'+apiVersion));
        } catch (error) {
            Logger.error(error, '@_lens > connectedCallback', 'Error in ConnectedCallBack : ')
        }

    }

```

### GET Record USING Composite

```javascript

const compositeRequest = [];

let allUserQuery = (`SELECT Id, Name, IsActive FROM User ORDER BY Name`).replaceAll(' ','+');
compositeRequest.push({
    method : "GET",  referenceId : 'User',
    url : `/services/data/v${apiVersion}/queryAll?q=${allUserQuery}`,
});

let orgInfoQuery = ('SELECT Id, Name, IsSandbox, NamespacePrefix FROM Organization').replaceAll(' ','+')
compositeRequest.push({
    method : "GET",  referenceId : 'Organization',
    url : `/services/data/v${apiVersion}/query?q=${orgInfoQuery}`,
});

let debugLogQuery = ('SELECT Id, Operation, LogUser.Id, LogUser.Name, LogUser.Profile.Name, Status, StartTime, LogLength, DurationMilliseconds, LastModifiedDate FROM ApexLog ORDER BY StartTime DESC, Id DESC').replaceAll(' ', '+')
compositeRequest.push({
    method : "GET",  referenceId : 'ApexLog',
    url : `/services/data/v${apiVersion}/query?q=${debugLogQuery}`,
});

// to get record after 2000...
let debugLogQuery2 = ('SELECT Id, Operation, LogUser.Id, LogUser.Name, LogUser.Profile.Name, Status, StartTime, LogLength, DurationMilliseconds, LastModifiedDate FROM ApexLog ORDER BY StartTime DESC, Id DESC OFFSET 2000').replaceAll(' ', '+')
compositeRequest.push({
    method : "GET",  referenceId : 'ApexLog_2000',
    url : `/services/data/v${apiVersion}/query?q=${debugLogQuery2}`,
});

// prepare request body...
const requestBody = { "allOrNone" : false, "compositeRequest" : compositeRequest,}

const response = await orgCallout({url: (orgDomain + `/services/data/v${apiVersion}/composite`), options: {sessionId: this.sessionId, method: 'POST', body: requestBody}, purpose: 'Initial_Info_Rest_API'});
const results =  await response.json();
if(response.status === 200){
    Logger.log('@_lens > fetchInitialInfo_rest', ' API Call result : ', results);
    return results?.compositeResponse;
} else {
    Logger.log('@_lens > fetchInitialInfo_rest', 'error in API Call', results);
    this.offlineModes.sessionExpired = results.some(ele => ele.errorCode === "INVALID_SESSION_ID")
    this.offlineModes.apiDisabled = results.some(ele => ele.errorCode === "API_CURRENTLY_DISABLED");
    return null;
}

```
