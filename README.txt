Gas Usage PWA - b1v41

Displayed application version: b1v41

b1v41 changes:
- Restored and hardened automatic Purchase Cost calculation.
- Gallons x Price is calculated as soon as valid values are present.
- Calculated Cost is green and formatted as 99.99.
- User-entered Cost becomes black and is preserved for saving.
- Save recalculates an automatic Cost before validation when appropriate.
- Purchase save waits for the IndexedDB transaction to complete before refreshing the list.
- Existing database name and data model are preserved.
