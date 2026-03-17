// setup-entities.js — Creates the SupervisorNotifications solution,
// entities, and columns in Dynamics 365.
// Run once: node setup-entities.js

const { getToken, apiGet, apiRequest } = require("./auth");

const PUBLISHER_PREFIX = "maulabs";
const SOLUTION_NAME = "SupervisorNotifications";
const NOTIF_ENTITY = "maulabs_supervisornotification";
const ACK_ENTITY = "maulabs_notificationack";

// ── Label shorthand ────────────────────────────────────────────
function L(text) {
    return {
        "@odata.type": "Microsoft.Dynamics.CRM.Label",
        LocalizedLabels: [{
            "@odata.type": "Microsoft.Dynamics.CRM.LocalizedLabel",
            Label: text,
            LanguageCode: 1033
        }]
    };
}

// ── Idempotent POST (swallows "already exists" errors) ─────────
async function tryPost(token, url, body, name) {
    try {
        await apiRequest("POST", url, token, body);
        console.log(`   ✔ Created: ${name}`);
    } catch (err) {
        if (err.status === 409 ||
            /already exists|duplicate|ObjectAlreadyExists|already being used|cannot be used again/i.test(err.message)) {
            console.log(`   – Exists:  ${name} (skipped)`);
        } else {
            throw err;
        }
    }
}

// ── Main ───────────────────────────────────────────────────────
async function main() {
    console.log("Authenticating...");
    const token = await getToken();

    // 1. Find publisher
    console.log("\n[1/8] Finding publisher with prefix '" + PUBLISHER_PREFIX + "'...");
    const pubs = await apiGet(token,
        `/api/data/v9.2/publishers?$filter=customizationprefix eq '${PUBLISHER_PREFIX}'&$select=publisherid,friendlyname`);
    if (!pubs.value.length) throw new Error(`No publisher with prefix '${PUBLISHER_PREFIX}'`);
    const pubId = pubs.value[0].publisherid;
    console.log(`   Publisher: ${pubs.value[0].friendlyname} (${pubId})`);

    // 2. Create solution
    console.log("\n[2/8] Creating solution '" + SOLUTION_NAME + "'...");
    await tryPost(token, "/api/data/v9.2/solutions", {
        uniquename: SOLUTION_NAME,
        friendlyname: "Supervisor Notifications",
        version: "1.0.0.0",
        "publisherid@odata.bind": `/publishers(${pubId})`
    }, "Solution");

    // 3. Create Supervisor Notification entity
    console.log("\n[3/8] Creating entity: Supervisor Notification...");
    await tryPost(token, "/api/data/v9.2/EntityDefinitions", {
        "@odata.type": "Microsoft.Dynamics.CRM.EntityMetadata",
        SchemaName: "maulabs_SupervisorNotification",
        EntitySetName: "maulabs_supervisornotifications",
        DisplayName: L("Supervisor Notification"),
        DisplayCollectionName: L("Supervisor Notifications"),
        Description: L("Supervisor-to-agent notification messages"),
        HasNotes: false,
        HasActivities: false,
        OwnershipType: "UserOwned",
        IsActivity: false,
        PrimaryNameAttribute: "maulabs_title",
        Attributes: [{
            "@odata.type": "Microsoft.Dynamics.CRM.StringAttributeMetadata",
            SchemaName: "maulabs_Title",
            MaxLength: 500,
            FormatName: { Value: "Text" },
            DisplayName: L("Title"),
            RequiredLevel: { Value: "ApplicationRequired" },
            IsPrimaryName: true
        }]
    }, "maulabs_SupervisorNotification");

    // 4. Add columns to notification entity
    console.log("\n[4/8] Adding columns to Supervisor Notification...");
    const nAttrUrl = `/api/data/v9.2/EntityDefinitions(LogicalName='${NOTIF_ENTITY}')/Attributes`;

    await tryPost(token, nAttrUrl, {
        "@odata.type": "Microsoft.Dynamics.CRM.MemoAttributeMetadata",
        SchemaName: "maulabs_Message",
        MaxLength: 10000,
        DisplayName: L("Message"),
        RequiredLevel: { Value: "None" }
    }, "maulabs_Message (Memo)");

    await tryPost(token, nAttrUrl, {
        "@odata.type": "Microsoft.Dynamics.CRM.StringAttributeMetadata",
        SchemaName: "maulabs_ImageUrl",
        MaxLength: 2000,
        FormatName: { Value: "Url" },
        DisplayName: L("Image URL"),
        RequiredLevel: { Value: "None" }
    }, "maulabs_ImageUrl");

    await tryPost(token, nAttrUrl, {
        "@odata.type": "Microsoft.Dynamics.CRM.StringAttributeMetadata",
        SchemaName: "maulabs_LinkUrl",
        MaxLength: 2000,
        FormatName: { Value: "Url" },
        DisplayName: L("Link URL"),
        RequiredLevel: { Value: "None" }
    }, "maulabs_LinkUrl");

    await tryPost(token, nAttrUrl, {
        "@odata.type": "Microsoft.Dynamics.CRM.StringAttributeMetadata",
        SchemaName: "maulabs_LinkText",
        MaxLength: 500,
        FormatName: { Value: "Text" },
        DisplayName: L("Link Text"),
        RequiredLevel: { Value: "None" }
    }, "maulabs_LinkText");

    await tryPost(token, nAttrUrl, {
        "@odata.type": "Microsoft.Dynamics.CRM.IntegerAttributeMetadata",
        SchemaName: "maulabs_Status",
        MinValue: 0,
        MaxValue: 2,
        Format: "None",
        DisplayName: L("Notification Status"),
        Description: L("0=Draft, 1=Scheduled, 2=Sent"),
        RequiredLevel: { Value: "None" }
    }, "maulabs_Status (Integer)");

    await tryPost(token, nAttrUrl, {
        "@odata.type": "Microsoft.Dynamics.CRM.IntegerAttributeMetadata",
        SchemaName: "maulabs_Priority",
        MinValue: 0,
        MaxValue: 2,
        Format: "None",
        DisplayName: L("Priority"),
        Description: L("0=Normal, 1=Important, 2=Urgent"),
        RequiredLevel: { Value: "None" }
    }, "maulabs_Priority (Integer)");

    await tryPost(token, nAttrUrl, {
        "@odata.type": "Microsoft.Dynamics.CRM.StringAttributeMetadata",
        SchemaName: "maulabs_Category",
        MaxLength: 100,
        FormatName: { Value: "Text" },
        DisplayName: L("Category"),
        RequiredLevel: { Value: "None" }
    }, "maulabs_Category");

    await tryPost(token, nAttrUrl, {
        "@odata.type": "Microsoft.Dynamics.CRM.DateTimeAttributeMetadata",
        SchemaName: "maulabs_ScheduledOn",
        Format: "DateAndTime",
        DisplayName: L("Scheduled On"),
        RequiredLevel: { Value: "None" }
    }, "maulabs_ScheduledOn (DateTime)");

    await tryPost(token, nAttrUrl, {
        "@odata.type": "Microsoft.Dynamics.CRM.DateTimeAttributeMetadata",
        SchemaName: "maulabs_SentOn",
        Format: "DateAndTime",
        DisplayName: L("Sent On"),
        RequiredLevel: { Value: "None" }
    }, "maulabs_SentOn (DateTime)");

    // 5. Create Notification Acknowledgment entity
    console.log("\n[5/8] Creating entity: Notification Acknowledgment...");
    await tryPost(token, "/api/data/v9.2/EntityDefinitions", {
        "@odata.type": "Microsoft.Dynamics.CRM.EntityMetadata",
        SchemaName: "maulabs_NotificationAck",
        EntitySetName: "maulabs_notificationacks",
        DisplayName: L("Notification Acknowledgment"),
        DisplayCollectionName: L("Notification Acknowledgments"),
        Description: L("Tracks which agents acknowledged notifications"),
        HasNotes: false,
        HasActivities: false,
        OwnershipType: "UserOwned",
        IsActivity: false,
        PrimaryNameAttribute: "maulabs_name",
        Attributes: [{
            "@odata.type": "Microsoft.Dynamics.CRM.StringAttributeMetadata",
            SchemaName: "maulabs_Name",
            MaxLength: 200,
            FormatName: { Value: "Text" },
            DisplayName: L("Name"),
            RequiredLevel: { Value: "None" },
            IsPrimaryName: true
        }]
    }, "maulabs_NotificationAck");

    // 6. Add columns to ack entity
    console.log("\n[6/8] Adding columns to Notification Acknowledgment...");
    const aAttrUrl = `/api/data/v9.2/EntityDefinitions(LogicalName='${ACK_ENTITY}')/Attributes`;

    await tryPost(token, aAttrUrl, {
        "@odata.type": "Microsoft.Dynamics.CRM.StringAttributeMetadata",
        SchemaName: "maulabs_NotificationId",
        MaxLength: 100,
        FormatName: { Value: "Text" },
        DisplayName: L("Notification ID"),
        RequiredLevel: { Value: "ApplicationRequired" }
    }, "maulabs_NotificationId");

    await tryPost(token, aAttrUrl, {
        "@odata.type": "Microsoft.Dynamics.CRM.DateTimeAttributeMetadata",
        SchemaName: "maulabs_AcknowledgedOn",
        Format: "DateAndTime",
        DisplayName: L("Acknowledged On"),
        RequiredLevel: { Value: "None" }
    }, "maulabs_AcknowledgedOn (DateTime)");

    // 7. Set default categories (if not already set)
    console.log("\n[7/8] Setting default categories...");
    const defPath = `EntityDefinitions(LogicalName='${NOTIF_ENTITY}')`;
    const metaResp = await apiGet(token, `/api/data/v9.2/${defPath}?$select=Description`);
    let descText = "";
    if (metaResp.Description && metaResp.Description.LocalizedLabels && metaResp.Description.LocalizedLabels.length)
        descText = metaResp.Description.LocalizedLabels[0].Label;

    let hasCategories = false;
    try { const cfg = JSON.parse(descText); hasCategories = !!(cfg.categories && cfg.categories.length); } catch (e) { }

    if (!hasCategories) {
        const defaultConfig = {
            categories: [
                { id: "general", name: "General", color: "#5B5FC7", icon: "\uD83D\uDCE2" },
                { id: "policy", name: "Policy Update", color: "#2563eb", icon: "\uD83D\uDCCB" },
                { id: "urgent", name: "Urgent Alert", color: "#d13438", icon: "\uD83D\uDEA8" },
                { id: "training", name: "Training", color: "#107C10", icon: "\uD83D\uDCDA" }
            ]
        };
        await apiRequest("PUT", `/api/data/v9.2/${defPath}`, token, {
            Description: {
                "@odata.type": "Microsoft.Dynamics.CRM.Label",
                LocalizedLabels: [{
                    "@odata.type": "Microsoft.Dynamics.CRM.LocalizedLabel",
                    Label: JSON.stringify(defaultConfig),
                    LanguageCode: 1033
                }]
            }
        }, { "MSCRM.MergeLabels": "true" });
        console.log("   ✔ Default categories set (General, Policy Update, Urgent Alert, Training)");
    } else {
        console.log("   – Categories already configured (skipped)");
    }

    // 8. Add entities to solution & publish
    console.log("\n[8/8] Adding entities to solution and publishing...");
    for (const entity of [NOTIF_ENTITY, ACK_ENTITY]) {
        const meta = await apiGet(token,
            `/api/data/v9.2/EntityDefinitions(LogicalName='${entity}')?$select=MetadataId`);
        await tryPost(token, "/api/data/v9.2/AddSolutionComponent", {
            ComponentId: meta.MetadataId,
            ComponentType: 1,
            SolutionUniqueName: SOLUTION_NAME,
            AddRequiredComponents: false,
            IncludedComponentSettingsValues: null
        }, `${entity} → solution`);
    }

    await apiRequest("POST", "/api/data/v9.2/PublishAllXml", token);
    console.log("   ✔ Published");

    console.log("\n════════════════════════════════════════════════");
    console.log("  ✅ Setup complete!");
    console.log("  Next: node publish-solution.js");
    console.log("════════════════════════════════════════════════\n");
}

main().catch(err => {
    console.error("\n❌ Error:", err.message);
    process.exit(1);
});
