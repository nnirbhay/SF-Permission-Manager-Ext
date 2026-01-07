
export let String_Prototype;

/**
 * Adds a method to the String prototype to extract a substring between two strings.
 */
String.prototype.substringBetween = function (start, end) {
    try {
        // Find the starting index, if not found consider as 0
        const startIndex = Math.max(0, this.indexOf(start));

        // Find the ending index, if not found, consider as the end of the string
        let endIndex = this.indexOf(end, startIndex + start.length);
        if(endIndex === -1) endIndex = this.length;

        // Extract the substring between the two indices
        return this.substring(startIndex + start.length, endIndex);
    } catch (error) {
        console.error('Error in substringBetween method :', error.stack);
        return this;
    }
};

/**
 * Adds a method to the String prototype to extract a substring BEFORE strings.
 * [UPDATED] strict will use to return null if did not find start index
 */
String.prototype.substringBefore = function (end, strict) {
    // Find the ending index, if not found, consider as the end of the string
    const endIndex = this.indexOf(end);
    if(endIndex === -1) return strict === true ? null : this;

    // Extract the substring before string
    return this.substring(0, endIndex);
};

/**
 * Adds a method to the String prototype to extract a substring BEFORE strings.
 * [UPDATED] strict will use to return null if did not find start index
 */
String.prototype.substringBeforeLast = function (end, strict) {
    // Find the ending index, if not found, consider as the end of the string
    const endIndex = this.lastIndexOf(end);
    if(endIndex === -1) return strict === true ? null : this;

    // Extract the substring before string
    return this.substring(0, endIndex);
};

/**
 * Adds a method to the String prototype to extract a substring AFTER strings.
 * [UPDATED] strict will use to return null if did not find start index
 */
String.prototype.substringAfter = function (start, strict) {
    const startIndex = this.indexOf(start);
    if(startIndex === -1) return strict === true ? null : this;

    // Extract the substring before string
    return this.substring(startIndex + start.length, this.length);
};

/**
 * Adds a method to the String prototype to extract a substring AFTER LAST strings.
 * [UPDATED] strict will use to return null if did not find start index
 */
String.prototype.substringAfterLast = function (start, strict) {
    const startIndex = this.lastIndexOf(start);
    if(startIndex === -1) return strict === true ? null : this;

    // Extract the substring before string
    return this.substring(startIndex + start.length, this.length);
};

/**
 * Adds a method to the String prototype to Remove/unEscape double and single quotes
 */
String.prototype.unescapeQuotes = function () {
    return this?.replaceAll(/\\"/g, '"')?.replaceAll(/\\"/g, "'")?.trim()
}

/**
 * Adds a method to the String prototype to unescape html tag and unicode
 */
String.prototype.unescapedHTML = function () {
    if(!this) return this;

    // Step 1: Decode HTML entities
    var doc = new DOMParser().parseFromString(this, "text/html");
    var docValue = doc.documentElement.innerText;

    // Step 2: Unescape Using a textarea element method
    const textarea = document.createElement('textarea');
    textarea.innerText = docValue;

    return textarea.value;
}

String.prototype.splitByNewLine = function(){
    let string = this ?? '';
    // convert new newline character (\r\n, \n) 
    // These must be in below order: //r//n then //n
    if(string?.includes('\r\n')) string = string.replaceAll('\r\n', '!!##DLV##!!');
    if(string?.includes('\\r\\n')) string = string.replaceAll('\\r\\n', '!!##DLV##!!');
    if(string?.includes('\\t')) string = string.replaceAll('\\t', '    ');
    if(string?.includes('\\n')) string = string.replaceAll('\\n', '!!##DLV##!!');
    return string?.split('!!##DLV##!!');
}



// Convert GMT Date String into Local Date Object
String.prototype.gmt_to_Local_Date = function () {
    // Fix timezone format from +0000 to +00:00
    // Remove 'Z' if it's included and
    const fixedISO = this?.replace(/([+-])(\d{2})(\d{2})$/, '$1$2:$3').replace('Z', '');
    return new Date(fixedISO);
}
  
  
// Convert Local Date String to GMT Date Object
String.prototype.getGMTDate = function () {
    const fixedISO = this?.replace(/([+-])(\d{2})(\d{2})$/, '');
    return new Date(fixedISO);
}

// Convert GMT Date String To Local Date String in ISO Format to use in input field
String.prototype.GMT_to_Local_ISO = function(){
    let sting = this
    sting = sting.replace('+000', '');
    sting = sting.replace('Z', '');
    // if there is 'Z' in date-string means it will add +5:30(based on time zoon), if Not means it will keep same
    return convertToISOformat(sting+'Z')
}

// "22/12/2025, 19:08:32" => Mon Dec 22 2025 19:08:32 => 2025-12-22T19:08:32.000Z
String.prototype.localeStringToDate = function(){
    const input = this;
    const [datePart, timePart] = input.split(", ");
    const [day, month, year] = datePart.split("/");
    const [hour, minute, second] = timePart.split(":");
    const date = new Date(year, month - 1, day, hour, minute, second);
    return new Date(date);
}

// Convert Date String To Format to use in input field
Date.prototype.getISOFormat = function(){
    return convertToISOformat(this.toISOString())
}

// Generic method convert ISO date string that we can use in input field
function convertToISOformat(string){
    const d = new Date(string);
    const localTime = d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0') + 'T' +
    String(d.getHours()).padStart(2, '0') + ':' +
    String(d.getMinutes()).padStart(2, '0') + ':' +
    String(d.getSeconds() > 0 ? d.getSeconds() : 1).padStart(2, '0');
    return localTime
}


/**
 * Converts a given time duration into a human-readable format.
 *
 * Supports calling with:
 *  - duration only (assumes nanoseconds)
 *  - duration and unit
 *  - duration, unit, and target unit (for direct conversion)
 *
 * @param {string} [unit='ns'] - The input unit (e.g., 'ms', 'seconds').
 * @param {string} [targetUnit] - Optional: target unit for direct conversion.
 * @returns {string} Human-readable formatted duration.
 */
String.prototype.toDuration = function(unit = 'ns', targetUnit, toFixed) {
    const unitToNs = {
        ns: 1,
        nanosecond: 1,
        nanoseconds: 1,

        us: 1_000,
        µs: 1_000,
        microsecond: 1_000,
        microseconds: 1_000,

        ms: 1_000_000,
        millisecond: 1_000_000,
        milliseconds: 1_000_000,

        s: 1_000_000_000,
        sec: 1_000_000_000,
        second: 1_000_000_000,
        seconds: 1_000_000_000,

        m: 60 * 1_000_000_000,
        min: 60 * 1_000_000_000,
        minute: 60 * 1_000_000_000,
        minutes: 60 * 1_000_000_000,

        h: 3600 * 1_000_000_000,
        hr: 3600 * 1_000_000_000,
        hour: 3600 * 1_000_000_000,
        hours: 3600 * 1_000_000_000,
    };

    // Handle if only one or two arguments are provided

    const unitKey = unit?.toLowerCase() ?? 'ns';
    const factor = unitToNs[unitKey];

    if (!factor) return NaN

    toFixed = toFixed != null ? toFixed : 3;
    const durationNs = parseFloat(this) * factor;

    // If a target unit is provided, return direct conversion
    if (targetUnit) {
        const targetKey = targetUnit.toLowerCase();
        const targetFactor = unitToNs[targetKey];

        if (!targetFactor) return NaN

        const converted = durationNs / targetFactor;
        return `${converted.toFixed(toFixed)} ${targetUnit}`;
    }

    // Auto human-readable formatting
    if (durationNs < 1_000) return `${durationNs} ns`;
    if (durationNs < 1_000_000) return `${(durationNs / 1_000).toFixed(toFixed)} µs`;
    if (durationNs < 1_000_000_000) return `${(durationNs / 1_000_000).toFixed(toFixed)} ms`;

    const totalSeconds = (durationNs / 1_000_000_000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = (totalSeconds % 60);

    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0 || hours > 0) parts.push(`${minutes}m`);
    parts.push(`${seconds.toFixed(toFixed)}s`);

    return parts.join(' ');
}

Number.prototype.toDuration = function(unit = 'ns', targetUnit){
    return this.toString()?.toDuration(unit, targetUnit)
}

/**
 * Converts a given file size into a human-readable format.
 *
 * Supports calling with:
 *  - size only (assumes bytes)
 *  - size and unit
 *  - size, unit, and target unit (for direct conversion)
 *
 * @param {string} [unit='b'] - The input unit (e.g., 'KB', 'MB').
 * @param {string} [targetUnit] - Optional: target unit for direct conversion.
 * @returns {string} Human-readable formatted file size.
 */
String.prototype.toSize = function(unit = 'b', targetUnit, toFixed, base10) {
    const dividedBy = base10 ? 1000 : 1024;

    const unitToBytes = {
        b: 1,
        byte: 1,
        bytes: 1,

        kb: dividedBy,
        kilobyte: dividedBy,
        kilobytes: dividedBy,

        mb: dividedBy ** 2,
        megabyte: dividedBy ** 2,
        megabytes: dividedBy ** 2,

        gb: dividedBy ** 3,
        gigabyte: dividedBy ** 3,
        gigabytes: dividedBy ** 3,

        tb: dividedBy ** 4,
        terabyte: dividedBy ** 4,
        terabytes: dividedBy ** 4,
    };


    const unitKey = unit?.toLowerCase() ?? 'b';
    const inputFactor = unitToBytes[unitKey];

    if (!inputFactor) return NaN

    toFixed = toFixed != null ? toFixed : 2;
    const sizeInBytes = parseFloat(this) * inputFactor;

    // If a target unit is specified, return direct conversion
    if (targetUnit) {
        const targetKey = targetUnit.toLowerCase();
        const targetFactor = unitToBytes[targetKey];

        if (!targetFactor) {
            throw new Error(`Unsupported target unit: '${targetUnit}'`);
        }

        const converted = sizeInBytes / targetFactor;
        return `${converted.toFixed(toFixed)} ${targetUnit.toUpperCase()}`;
    }


    // Auto human-readable format
    if (sizeInBytes < dividedBy) return `${sizeInBytes} B`;
    if (sizeInBytes < dividedBy ** 2) return `${(sizeInBytes / dividedBy).toFixed(toFixed)} KB`;
    if (sizeInBytes < dividedBy ** 3) return `${(sizeInBytes / dividedBy ** 2).toFixed(toFixed)} MB`;
    if (sizeInBytes < dividedBy ** 4) return `${(sizeInBytes / dividedBy ** 3).toFixed(toFixed)} GB`;

    return `${(sizeInBytes / dividedBy ** 4).toFixed(toFixed)} TB`;
}

Number.prototype.toSize = function(unit = 'b', targetUnit){
    return this.toString()?.toSize(unit, targetUnit)
}
