

// Adding a new method 'groupBy' to all arrays via Array prototype
Array.prototype.groupBy = function(key) {
    // Use reduce to build the grouped object
    return this.reduce((acc, item) => {
        // Get the value of the key to group by
        const groupKey = item[key];

        // If this group key is not yet in the accumulator, initialize it as an empty array
        if (!acc[groupKey]) {
        acc[groupKey] = [];
        }

        // Push the current item into the appropriate group
        acc[groupKey].push(item);

        // Return the accumulator for the next iteration
        return acc;
    }, {}); // Initial value is an empty object
};

Array.prototype.groupToItem = function(key, groupItemsKey = 'items') {
    const groupedMap = this.reduce((acc, item) => {
      const groupKey = item[key];
      if (!acc[groupKey]) {
        acc[groupKey] = {
          [key]: groupKey,
          [groupItemsKey]: []
        };
      }
      // Clone the item without the grouping key if you don't want duplicate
      const { [key]: _, ...rest } = item;
      acc[groupKey][groupItemsKey].push(rest);
      return acc;
    }, {});

    // Return as array
    return Object.values(groupedMap);
};


// Method to sort an array of objects by multiple keys
Array.prototype.sortBy = function(sorters) {
    return this.slice().sort((a, b) => {
        for (let { key, order = 'asc' } of sorters) {
        const valA = a[key];
        const valB = b[key];

        // Skip if values are equal and move to next key
        if (valA === valB) continue;

        // Determine sorting direction
        const comparison = valA > valB ? 1 : -1;
        return order === 'asc' ? comparison : -comparison;
        }
        return 0; // All keys are equal
    });
};