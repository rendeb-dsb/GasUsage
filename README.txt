GasUsage PWA b1v42

IndexedDB database: GasUsageDB

b1v42 hardens Purchase Cost calculation by invoking it directly from the Gallons/Price controls and again during validation. Calculated Cost is green and formatted to two decimals; user-entered Cost is black. Purchase saves wait for IndexedDB transaction completion and then refresh the Purchases list.
