

/**
 * 
 * @param {Any} needle : any string, regex or object to search for
 * @param {Object} options : configuration options
 * @returns : Array of matched objects with path and value
 * 
 * To find matching keys/values/objects within an object structure
 * This will also handle circular references
 * Work with Array.prototype.findMatch as well
 * 
 * For match == 'key    : if all key matches with needle
 * For match == 'value  : if all value matches with any type of needle (string, boolean, number, object, array, function)
 * For match == 'both   : if all key and value matches with needle
 * For match == 'pair   : if at least one key and value matches with needle (object for AND condition in value of object, array of objects for OR condition in value of object)
 * 
 */
Object.prototype.findMatch = function (needle, options = {}) {
    const config = Object.assign({
        match: 'both',               // 'key', 'value', 'both', 'pair'
        maxDepth: 0,                // set to above 0 if applied
        caseSensitive: false,
        includeFunctions: false,
        root: this,
        pathOnly: false,
        exclude: []
    }, options);

    const isRegExp = (r) => Object.prototype.toString.call(r) === '[object RegExp]';
    const needleIsObject = typeof needle === 'object' && needle !== null && !isRegExp(needle);
    const needleIsString = typeof needle === 'string';
    const needleIsRegex = isRegExp(needle);

    const results = [];
    const visited = new WeakSet();

    function matchesKey(key) {
        if (!needleIsString && !needleIsRegex) return false;
        const keyStr = String(key);
        if (!config.caseSensitive) {
            return needleIsRegex ? needle.test(keyStr) : keyStr.toLowerCase().includes(needle.toLowerCase());
        }
        return needleIsRegex ? needle.test(keyStr) : keyStr.includes(needle);
    }

    function matchesValue(val) {
        if (needleIsRegex) {
            try { return typeof val === 'string' && needle.test(val); } catch (e) { return false; }
        }
        if (needleIsString) {
            try { return typeof val === 'string' && (config.caseSensitive ? val.includes(needle) : val.toLowerCase().includes(needle.toLowerCase())); }
            catch (e) { return false; }
        }
        if (needleIsObject) {
            return deepEqual(val, needle);
        }
        return false;
    }

    function matchPair(obj) {
        if (obj === null || typeof obj !== 'object') return false;
        if (needle === null || typeof needle !== 'object') return false;

        // needle is a single object → AND logic
        if (!Array.isArray(needle)) {
            return objectContains(obj, needle);
        }

        // needle is an array → OR logic
        for (const item of needle) {
            if (typeof item === 'object' && item !== null) {
                if (objectContains(obj, item)) return true;
            }
        }

        return false;
    }

    function objectContains(obj, needle = needle) {
        for (const key of Reflect.ownKeys(needle)) {
            if (!(key in obj)) return false;
            if (!deepEqual(obj[key], needle[key])) return false;
        }
        return true;
    }

    function deepEqual(a, b, seen = new WeakMap()) {
        if (a === b) return true;

        // Handle NaN
        if (Number.isNaN(a) && Number.isNaN(b)) return true;

        if (a === null || b === null) return false;

        const typeA = typeof a;
        const typeB = typeof b;
        if (typeA !== typeB) return false;

        // Objects & arrays
        if (typeA === 'object') {
            // prevent circular recursion
            if (seen.get(a) === b) return true;
            seen.set(a, b);

            // Dates
            if (a instanceof Date && b instanceof Date) {
                return a.getTime() === b.getTime();
            }

            // Arrays
            if (Array.isArray(a) && Array.isArray(b)) {
                if (a.length !== b.length) return false;
                for (let i = 0; i < a.length; i++) {
                    if (!deepEqual(a[i], b[i], seen)) return false;
                }
                return true;
            }

            // Maps
            if (a instanceof Map && b instanceof Map) {
                if (a.size !== b.size) return false;
                for (const [k, v] of a) {
                    if (!b.has(k) || !deepEqual(v, b.get(k), seen)) return false;
                }
                return true;
            }

            // Sets
            if (a instanceof Set && b instanceof Set) {
                if (a.size !== b.size) return false;
                for (const v of a) {
                    if (!b.has(v)) return false;
                }
                return true;
            }

            // Plain objects
            const keysA = Reflect.ownKeys(a);
            const keysB = Reflect.ownKeys(b);

            if (keysA.length !== keysB.length) return false;

            for (const key of keysA) {
                if (!keysB.includes(key)) return false;
                if (!deepEqual(a[key], b[key], seen)) return false;
            }

            return true;
        }

        return false;
    }


    function safeGet(obj, prop) {
        try {
            const desc = Object.getOwnPropertyDescriptor(obj, prop);
            if (desc && typeof desc.get === 'function') {
                try { return desc.get.call(obj); } catch (e) { return undefined; }
            }
            return obj[prop];
        } catch (e) {
            return undefined;
        }
    }

    function traverse(obj, path, depth) {
        if (obj === null || obj === undefined) return;
        if (typeof obj !== 'object' && typeof obj !== 'function') return;
        if (visited.has(obj)) return;
        visited.add(obj);
        if (config.maxDepth && depth > config.maxDepth) return;

        let props;
        try {
            props = Object.getOwnPropertyNames(obj).concat(Object.getOwnPropertySymbols(obj));
        } catch (e) {
            return;
        }

        for (const prop of props) {
            const propName = typeof prop === 'symbol' ? prop.toString() : String(prop);
            if (config.exclude?.includes(propName)) continue;

            let val = safeGet(obj, prop);
            const newPath = path ? `${path}.${propName}` : propName;

            let res;
            if ((config.match === 'key' || config.match === 'both') && matchesKey(propName)) {
                res = { path: newPath, value: val };
            }
            else if ((config.match === 'value' || config.match === 'both') && matchesValue(val)) {
                res = { path: newPath, value: val };
            }
            else if (config.match === 'pair' && matchPair(val)) {
                res = { path: newPath, value: val };
            }

            if (res) {
                if (config.pathOnly) delete res.value;
                results.push(res);
            }

            const isRecurse = (typeof val === 'object' && val !== null) || (config.includeFunctions && typeof val === 'function');
            if (isRecurse) {
                try {
                    traverse(val, newPath, depth + 1);
                } catch (e) { }
            }
        }
    }

    traverse(config.root, '', 0);
    return results;
};


/**
 * Get value from object by path
 * 
 * @param {String} path : Path to get value from
 * @param {Object} options : configuration options
 * @returns 
 */
Object.prototype.getByPath = function (path, options = {}) {
    let root = this;
    const config = Object.assign({
        maxDepth: Infinity,
        caseSensitive: true,
        exclude: [],
    }, options);

    if (root == null) return undefined;
    if (path === "" || path == null) return root;

    const parts = String(path).split(".");
    let current = root;
    let depth = 0;

    for (let part of parts) {
        if (current == null) return undefined;

        if (depth >= config.maxDepth) return undefined;
        depth++;

        // exclude: stop traversal if excluded
        if (config.exclude.includes(part)) return undefined;

        let keyToUse = part;

        // handle case-insensitive lookups
        if (!config.caseSensitive && typeof part === "string") {
        const allKeys = Reflect.ownKeys(current);
        const found = allKeys.find(k => String(k).toLowerCase() === part.toLowerCase());
        if (found !== undefined) keyToUse = found;
        }

        // symbol lookup fallback
        const symbolKey =
        typeof part === "string"
            ? Object.getOwnPropertySymbols(current).find(sym => sym.toString() === part)
            : null;

        const finalKey = symbolKey ?? keyToUse;

        try {
        const desc = Object.getOwnPropertyDescriptor(current, finalKey);
        if (desc && typeof desc.get === "function") {
            current = desc.get.call(current);
        } else {
            current = current[finalKey];
        }
        } catch {
        return undefined;
        }
    }

    return current;
};