/******************************************
* 
* Purpose of used this component to export method and variable(properties) to use them globally every where in any component...
* So, in future if we need to make changes in below method or variable, then we do not need change in every component one by one,
* Change at here will reflect every where, where this is following export properties are used...
*
*******************************************/

export const STORAGE_ITEM_KEYS = {
    apiVersion: '_apiVersion',
    // orgInfo : '_orgInfo', 
    // executionStarts : '_executionUnits',
    updateIdentifier: '_logUpdateIdentifier',
    appSettings: '_appSettings',
    apiUsage: '_apiUsage',
};

export let APP_SETTING_KEYS = {
    Dark_Mode: 'Dark_Mode',
    darkModeClass: 'dl-dark-active',
    Local_Log_Storage: 'Local_Log_Storage'
}

// @lens object in global window object to alter the global properties values in case some mismatch;
let lensApp = 'dl_lens'
if (!window[lensApp]) window[lensApp] = {};
window[lensApp].STORAGE_ITEM_KEYS = STORAGE_ITEM_KEYS;
window[lensApp].APP_SETTING_KEYS = APP_SETTING_KEYS;
window[lensApp]._systemInfo = _systemInfo;
window[lensApp].DOMSelectors = DOMSelectors;

export function isDarkModeEnabled() {
    return document.querySelector(`body.${APP_SETTING_KEYS.darkModeClass}`) ? true : false
}

/**
 * Use to execute debug log in proper format, 
 * to maintain debug format for error handling,
 * @param {*} componentName 
 * @param {*} methodName 
 * @param {*} error 
 * @param {*} debugMode 
 * @param {*} additionalInfo 
 */
export function errorDebugger(componentName, methodName, error, debugMode, additionalInfo) {
    const errorInfo = {}

    componentName && (errorInfo.component = componentName);
    methodName && (errorInfo.method = methodName);
    error?.message && (errorInfo.errorMessage = error?.message);
    additionalInfo && (errorInfo.additionalInfo = additionalInfo);

    if (debugMode?.toLowerCase() === 'error') {
        console.error('Error from LWC Component : ', errorInfo);
    }
    else if (debugMode?.toLowerCase() === 'warn') {
        console.warn('Warning from LWC Component : ', errorInfo);
    }
    else {
        console.log('Message from LWC Component : ', errorInfo);
    }
}

/**
 * This variable used to show/hide debug log...
 * If we want to show debug log in console, add below parameter into url...
 * This will be helpful to debug error in production environment as well to hide debug from users...
 */
export var showDebug = setDebugVisibility();
function setDebugVisibility() {
    const identifier = 'dl_debugMode';
    const value = 'on';
    const urlParams = new URLSearchParams(window.location.search);
    const showDebug = urlParams.get(identifier);

    // '?dl_debugMode=on' OR '#dl_debugMode=on'
    return (showDebug == value) || (window.location.hash == `#${identifier}=${value}`);
}



export default class GlobalProperties extends LightningElement { }

/**
 * 
 * @param {*} request : {url, options, purpose}
 * @returns : return the API callout result as promise
 */
export function orgCallout(request) {
    let { url, options, purpose } = request;
    updateAPIUsage(purpose);
    return fetch(encodeURI(url), prepareRequestOptions(options));
}

/**
 * Method to prepare API call request option/header
 * @param {*} sessionId 
 * @param {*} method 
 * @param {*} body 
 * @returns 
 */
export function prepareRequestOptions(options) {
    let { sessionId, method, body } = options;
    const myHeaders = new Headers();
    let bearerString = "Bearer " + sessionId;
    myHeaders.append("Authorization", bearerString);
    myHeaders.append("Content-Type", 'application/json');

    const requestOptions = {
        method: method ?? "GET",
        headers: myHeaders,
        redirect: "follow",
    };

    if (body) {
        requestOptions.body = typeof body == 'string' ? body : JSON.stringify(body);
    }

    return requestOptions;
}

/**
 * 
 * @param {String} purpose : Purpose of the API callout
 * 
 */
export async function updateAPIUsage(purpose = 'other') {
    try {

        const urlParams = new URLSearchParams(window.location.search);
        const orgDomain = urlParams.get('domain');
        let usageStr = localStorage.getItem(orgDomain + STORAGE_ITEM_KEYS.apiUsage);
        let current = (new Date()).toLocaleString()
        let usage = usageStr ? JSON.parse(usageStr) : { 'today': {}, 'total': {}, lastUpdated: '', fistUpdated: current };

        let lastDate = usage['lastUpdated']?.substringBefore(',');          // Last Updated Date
        usage['lastUpdated'] = current;                                     // Current Date Time
        let todayDate = current?.substringBefore(',');                      // Current Date

        let usage_today = usage['today'];
        let usage_total = usage['total'];

        // If last updated date is not same as current(today's) date....
        // Set Today's Usage to Zero
        if (lastDate != todayDate) {
            usage_today = {}
            usage_today[purpose] = 1;
        }
        else {
            let previousUsage = usage_today[purpose] ?? 0;
            usage_today[purpose] = previousUsage + 1;
        }

        // update total usage
        let previousUsage = usage_total[purpose] ?? 0;
        usage_total[purpose] = previousUsage + 1;

        usage['today'] = usage_today;
        usage['total'] = usage_total;

        // calculate overall usage for today and total
        usage['overall_today'] = 0;
        Object.keys(usage_today)?.forEach(key => usage['overall_today'] += usage_today[key]);
        usage['overall_total'] = 0;
        Object.keys(usage_total)?.forEach(key => usage['overall_total'] += usage_total[key]);

        localStorage.setItem(orgDomain + STORAGE_ITEM_KEYS.apiUsage, JSON.stringify(usage));
    } catch (error) { }
}

/**
 * Method to get api version of the domain org from the local storage
 */
export let apiVersion = getApiVersion();
function getApiVersion() {
    const urlParams = new URLSearchParams(window.location.search);
    const orgDomain = urlParams.get('domain');
    return localStorage.getItem(orgDomain + STORAGE_ITEM_KEYS.apiVersion) ?? '63.0';
}

/**
 * Method to get APP Version of the app from the manifest method
 */
export let appVersion = getAppVersion();
async function getAppVersion() {
    const manifest = await fetch('/manifest.json');
    const manifestData = await manifest.json();
    return manifestData.version;
}

/**
 * This method is to use when you want to know how much body fetched while body fetching callout
 * @param {*} url : url of body fetching
 * @param {*} requestOptions : request option for api call header 
 * @param {*} totalSize : total size fo body, this must be known before api call
 * @param {*} onProgress : callback method to update process info
 * @returns 
 */
export async function fetchBodyWithTrack(url, requestOptions, totalSize, onProgress) {
    const response = await orgCallout({ url: url, options: requestOptions, purpose: 'Fetch_Log_Body' });

    if (!response.ok) {
        throw new Error(`Failed to fetch log: ${response.status}`);
    }

    const reader = response.body.getReader();
    let loaded = 0;
    const chunks = [];

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        loaded += value.length;

        if (onProgress) {
            onProgress(loaded, totalSize);
        }
    }

    return new Blob(chunks, { type: 'text/plain' });
}

/**
 * Method to extract method entry and constructor entry from processInfo
 * Used in Log Data Parsing(@_lens.js) & Execution Stack Extraction(visual_ExecutionStack.js)
 */
export function extractMethodEntry(processInfo, processType, nameSpaceList) {
    let classInfo, methodInfo = '';

    if (processType == 'METHOD_ENTRY' || processType == 'CODE_UNIT_STARTED') {

        // Note: use strict mode for the substringAfter
        const paras = processInfo?.substringAfter('(', true)?.replace(')', '') ?? '';

        const codeUnitInfo = processInfo?.replace('(' + paras + ')', '');
        const splits = codeUnitInfo?.split('.');
        if (splits?.length) {
            const fSplit = splits?.at(0);
            const nameSpace = nameSpaceList?.some(ele => ele === fSplit);
            const nestedClass = (nameSpace && splits?.length === 4) || (!nameSpace && splits?.length >= 3);
            let _method = codeUnitInfo?.substringAfterLast('.', true) ?? '';
            let _class = codeUnitInfo?.substringBeforeLast('.' + _method);

            classInfo = nestedClass ? _class?.substringBeforeLast('.') : _class;
            methodInfo = _method ? _method + '(' + paras + ')' : '';
        }
    }
    else if (processType == 'CONSTRUCTOR_ENTRY') {
        const codeUnitInfo = processInfo?.substringAfterLast('|');
        const splits = codeUnitInfo?.split('.');
        if (splits?.length) {
            const fSplit = splits?.at(0);
            const nameSpace = nameSpaceList?.find(ele => ele === fSplit);
            const nestedClass = (nameSpace && splits?.length == 3) || (!nameSpace && splits?.length >= 2);
            classInfo = nestedClass ? codeUnitInfo.substringBeforeLast('.') : codeUnitInfo;;
            methodInfo = nestedClass ?
                codeUnitInfo.substringAfterLast('.') + '()' :
                classInfo + '()';
            methodInfo = methodInfo.replace(nameSpace + '.', '');
        }
    }

    return {
        className: classInfo?.trim(),
        methodName: methodInfo?.trim()
    }
}


export function generateRandomId(index) {
    const now = new Date();
    const timestamp = now.getTime(); // e.g., 1715940000000
    const dateString = now.toISOString().replace(/[-:.TZ]/g, ''); // e.g., 20250517153000
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let randomPart = '';
    for (let i = 0; i < 8; i++) {
        randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `${dateString}-${randomPart}-${timestamp}-${index ?? ''}`;
}


export function afterStackCleanup(func, microTask, delay) {
    if (microTask) {
        // Use microtask to run the function after the current stack
        // microtasks run before macro-tasks.
        Promise.resolve().then(() => { func() });
    }
    else {
        setTimeout(() => { func() }, delay ?? 0)
    }
}

export async function isStorageQuotaExceed() {
    if (navigator?.storage?.estimate) {
        let result = await navigator.storage.estimate();
        return (result.usage >= result.quota);
    }

    return false;
}