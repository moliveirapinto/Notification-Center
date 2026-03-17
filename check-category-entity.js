// Quick diagnostic: check category entity attributes
const { getToken, apiRequest } = require('./auth');
const fs = require('fs');

(async () => {
    const t = await getToken();

    // 1. List category entity attributes
    console.log("=== Category entity attributes ===");
    const r = await apiRequest('GET',
        "/api/data/v9.2/EntityDefinitions(LogicalName='maulabs_notificationcategory')/Attributes?$select=LogicalName,AttributeType", t);
    r.data.value
        .filter(a => a.LogicalName.startsWith('maulabs_'))
        .forEach(a => console.log("  " + a.LogicalName + " (" + a.AttributeType + ")"));

    // 2. Check if lookup exists on notification entity
    console.log("\n=== Notification entity - categoryid lookup ===");
    try {
        const lk = await apiRequest('GET',
            "/api/data/v9.2/EntityDefinitions(LogicalName='maulabs_supervisornotification')/Attributes(LogicalName='maulabs_categoryid')?$select=LogicalName,AttributeType", t);
        console.log("  Found: " + lk.data.LogicalName + " (" + lk.data.AttributeType + ")");
    } catch (e) {
        console.log("  Not found (status " + e.status + ")");
    }

    // 3. Check entity set name
    console.log("\n=== Entity set name ===");
    const meta = await apiRequest('GET',
        "/api/data/v9.2/EntityDefinitions(LogicalName='maulabs_notificationcategory')?$select=EntitySetName,MetadataId", t);
    console.log("  EntitySetName: " + meta.data.EntitySetName);
    console.log("  MetadataId: " + meta.data.MetadataId);

    console.log("\n=== DONE ===");
})();
