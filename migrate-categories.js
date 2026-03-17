// One-time migration: move categories from entity description metadata to the new entity table
// Also updates notification records to use the new lookup field
const { getToken, apiRequest } = require('./auth');

const NOTIF_ENTITY = "maulabs_supervisornotification";
const CAT_SET = "maulabs_notificationcategories";
const NOTIF_SET = "maulabs_supervisornotifications";

(async () => {
    console.log("Authenticating...");
    const token = await getToken();
    console.log("Authenticated.\n");

    // 1. Read existing categories from entity description metadata
    console.log("Reading categories from entity description metadata...");
    let oldCategories = [];
    try {
        const metaResult = await apiRequest("GET",
            `/api/data/v9.2/EntityDefinitions(LogicalName='${NOTIF_ENTITY}')?$select=Description`, token);
        const desc = metaResult.data?.Description?.LocalizedLabels?.[0]?.Label || "";
        if (desc) {
            const config = JSON.parse(desc);
            oldCategories = config.categories || [];
        }
    } catch (e) {
        console.log("Could not read metadata:", e.message);
    }

    if (!oldCategories.length) {
        console.log("No categories found in metadata. Nothing to migrate.");
        return;
    }

    console.log(`Found ${oldCategories.length} categories to migrate:\n`);
    oldCategories.forEach(c => console.log(`  ${c.icon} ${c.name} (${c.id})`));

    // 2. Create category records in the new entity
    const idMap = {}; // oldId -> newGuid
    for (const cat of oldCategories) {
        console.log(`\nCreating: ${cat.icon} ${cat.name}...`);
        try {
            const result = await apiRequest("POST", `/api/data/v9.2/${CAT_SET}`, token, {
                maulabs_name: cat.name,
                maulabs_emoji: cat.icon,
                maulabs_color: cat.color,
                maulabs_description: cat.description || null
            });
            // Get the new record ID from headers
            // The response has status 204, get entity ID from OData-EntityId header
            // Since our apiRequest doesn't return headers, re-query to find it
            const query = await apiRequest("GET",
                `/api/data/v9.2/${CAT_SET}?$select=maulabs_notificationcategoryid&$filter=maulabs_name eq '${cat.name.replace(/'/g, "''")}'&$top=1`, token);
            if (query.data.value && query.data.value.length > 0) {
                idMap[cat.id] = query.data.value[0].maulabs_notificationcategoryid;
                console.log(`  Created: ${idMap[cat.id]}`);
            }
        } catch (e) {
            console.error(`  Failed: ${e.message}`);
        }
    }

    console.log(`\n${Object.keys(idMap).length} categories migrated.\n`);

    // 3. Update notification records to use the new lookup
    console.log("Updating notification records...");
    try {
        const notifs = await apiRequest("GET",
            `/api/data/v9.2/${NOTIF_SET}?$select=maulabs_supervisornotificationid,maulabs_category&$filter=maulabs_category ne null`, token);
        const records = notifs.data.value || [];
        console.log(`Found ${records.length} notifications with categories to update.\n`);

        let updated = 0;
        let skipped = 0;
        for (const n of records) {
            const oldCatId = n.maulabs_category;
            const newCatGuid = idMap[oldCatId];
            if (!newCatGuid) {
                console.log(`  Skipping ${n.maulabs_supervisornotificationid} - no mapping for ${oldCatId}`);
                skipped++;
                continue;
            }
            try {
                await apiRequest("PATCH",
                    `/api/data/v9.2/${NOTIF_SET}(${n.maulabs_supervisornotificationid})`, token, {
                        "maulabs_categoryid@odata.bind": `/${CAT_SET}(${newCatGuid})`
                    });
                updated++;
            } catch (e) {
                console.error(`  Failed to update ${n.maulabs_supervisornotificationid}: ${e.message}`);
            }
        }
        console.log(`\nUpdated ${updated} notifications, skipped ${skipped}.`);
    } catch (e) {
        console.error("Error querying notifications:", e.message);
    }

    console.log("\n════════════════════════════════════════════════");
    console.log("  ✅ Migration complete!");
    console.log("  Old category IDs → new entity GUIDs:");
    Object.entries(idMap).forEach(([old, newId]) => console.log(`    ${old} → ${newId}`));
    console.log("════════════════════════════════════════════════");
})();
