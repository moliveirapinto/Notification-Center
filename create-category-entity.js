// One-time script to create the maulabs_notificationcategory entity with real fields
const { getToken, apiRequest } = require('./auth');

const ENTITY_LOGICAL = "maulabs_notificationcategory";
const ENTITY_SCHEMA = "maulabs_notificationcategory";
const ENTITY_DISPLAY = "Notification Category";
const ENTITY_DISPLAY_PLURAL = "Notification Categories";
const SOLUTION = "SupervisorNotifications";
const PUBLISHER_PREFIX = "maulabs";

// Attributes to create (primary name is created with the entity itself)
const EXTRA_ATTRIBUTES = [
    {
        "@odata.type": "Microsoft.Dynamics.CRM.StringAttributeMetadata",
        SchemaName: "maulabs_emoji",
        DisplayName: label("Emoji"),
        Description: label("Emoji icon for the category"),
        RequiredLevel: { Value: "ApplicationRequired", CanBeChanged: true },
        MaxLength: 20,
        FormatName: { Value: "Text" },
        ImeMode: "Auto"
    },
    {
        "@odata.type": "Microsoft.Dynamics.CRM.StringAttributeMetadata",
        SchemaName: "maulabs_color",
        DisplayName: label("Color"),
        Description: label("Hex color code for the category badge"),
        RequiredLevel: { Value: "ApplicationRequired", CanBeChanged: true },
        MaxLength: 20,
        FormatName: { Value: "Text" },
        ImeMode: "Auto"
    },
    {
        "@odata.type": "Microsoft.Dynamics.CRM.StringAttributeMetadata",
        SchemaName: "maulabs_description",
        DisplayName: label("Description"),
        Description: label("Optional description for the category"),
        RequiredLevel: { Value: "None", CanBeChanged: true },
        MaxLength: 500,
        FormatName: { Value: "Text" },
        ImeMode: "Auto"
    }
];

function label(text) {
    return {
        "@odata.type": "Microsoft.Dynamics.CRM.Label",
        LocalizedLabels: [{
            "@odata.type": "Microsoft.Dynamics.CRM.LocalizedLabel",
            Label: text,
            LanguageCode: 1033
        }]
    };
}

(async () => {
    console.log("Authenticating...");
    const token = await getToken();
    console.log("Authenticated.\n");

    // 1. Check if entity already exists
    const checkPath = `/api/data/v9.2/EntityDefinitions(LogicalName='${ENTITY_LOGICAL}')`;
    let entityExists = false;
    try {
        await apiRequest("GET", checkPath, token);
        entityExists = true;
        console.log(`Entity ${ENTITY_LOGICAL} already exists.`);
    } catch (e) {
        if (e.status !== 404) {
            console.error("Error checking entity:", e.message);
            return;
        }
    }

    if (!entityExists) {
        // 2. Create the entity
        console.log(`Creating entity ${ENTITY_LOGICAL}...`);
        const entityBody = {
            "@odata.type": "Microsoft.Dynamics.CRM.EntityMetadata",
            SchemaName: ENTITY_SCHEMA,
            DisplayName: label(ENTITY_DISPLAY),
            DisplayCollectionName: label(ENTITY_DISPLAY_PLURAL),
            Description: label("Categories for supervisor notifications"),
            OwnershipType: "OrganizationOwned",
            IsActivity: false,
            HasNotes: false,
            HasActivities: false,
            PrimaryNameAttribute: "maulabs_name",
            Attributes: [
                {
                    "@odata.type": "Microsoft.Dynamics.CRM.StringAttributeMetadata",
                    SchemaName: "maulabs_name",
                    DisplayName: label("Category Name"),
                    Description: label("Name of the notification category"),
                    RequiredLevel: { Value: "ApplicationRequired", CanBeChanged: true },
                    MaxLength: 100,
                    FormatName: { Value: "Text" },
                    IsPrimaryName: true,
                    ImeMode: "Auto"
                }
            ]
        };

        try {
            const result = await apiRequest("POST", "/api/data/v9.2/EntityDefinitions", token, entityBody);
            console.log("Entity created! Status:", result.status);
        } catch (e) {
            console.error("Failed to create entity:", e.message);
            return;
        }

        // Publish entity before adding more attributes
        console.log("Publishing entity before adding extra attributes...");
        await apiRequest("POST", "/api/data/v9.2/PublishXml", token, {
            ParameterXml: `<importexportxml><entities><entity>${ENTITY_LOGICAL}</entity></entities></importexportxml>`
        });
        console.log("Published.\n");
    }

    // 3. Add extra attributes
    for (const attr of EXTRA_ATTRIBUTES) {
        const attrName = attr.SchemaName.toLowerCase();
        const attrPath = `/api/data/v9.2/EntityDefinitions(LogicalName='${ENTITY_LOGICAL}')/Attributes(LogicalName='${attrName}')`;
        try {
            await apiRequest("GET", attrPath, token);
            console.log(`Attribute ${attrName} already exists. Skipping.`);
        } catch (e) {
            if (e.status === 404) {
                console.log(`Creating attribute ${attrName}...`);
                try {
                    const result = await apiRequest("POST",
                        `/api/data/v9.2/EntityDefinitions(LogicalName='${ENTITY_LOGICAL}')/Attributes`,
                        token, attr);
                    console.log(`  ${attrName} created! Status:`, result.status);
                } catch (e2) {
                    console.error(`  Failed to create ${attrName}:`, e2.message);
                }
            } else {
                console.error(`Error checking ${attrName}:`, e.message);
            }
        }
    }

    // 4. Now update the notification entity: change maulabs_category from string to lookup
    //    First check if the old string attribute exists
    const oldCatAttr = "maulabs_category";
    const oldCatPath = `/api/data/v9.2/EntityDefinitions(LogicalName='maulabs_supervisornotification')/Attributes(LogicalName='${oldCatAttr}')`;
    try {
        const attrCheck = await apiRequest("GET", oldCatPath + "?$select=AttributeType", token);
        const attrType = attrCheck.data.AttributeType;
        console.log(`\nExisting maulabs_category attribute type: ${attrType}`);
        if (attrType === "String" || attrType === "Memo") {
            console.log("Old string-based maulabs_category found. Will keep it for migration.");
            console.log("NOTE: After migration, you can manually remove it from D365.");
        }
    } catch (e) {
        if (e.status === 404) {
            console.log("\nmaulabs_category attribute does not exist yet.");
        }
    }

    // 5. Publish all entities so metadata cache is fresh before creating relationships
    console.log("\nPublishing entities to refresh cache before creating lookup...");
    await apiRequest("POST", "/api/data/v9.2/PublishAllXml", token);
    console.log("Published all.");

    // Create a lookup attribute on the notification entity pointing to the category entity
    const lookupAttr = "maulabs_categoryid";
    const lookupPath = `/api/data/v9.2/EntityDefinitions(LogicalName='maulabs_supervisornotification')/Attributes(LogicalName='${lookupAttr}')`;
    try {
        await apiRequest("GET", lookupPath, token);
        console.log(`Lookup attribute ${lookupAttr} already exists. Skipping.`);
    } catch (e) {
        if (e.status === 404) {
            console.log(`\nCreating lookup attribute ${lookupAttr} on notification entity...`);

            // Create a 1:N relationship (Category -> Notifications)
            const relationshipBody = {
                "@odata.type": "Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata",
                SchemaName: "maulabs_notificationcategory_notification",
                ReferencedEntity: ENTITY_LOGICAL,
                ReferencingEntity: "maulabs_supervisornotification",
                Lookup: {
                    "@odata.type": "Microsoft.Dynamics.CRM.LookupAttributeMetadata",
                    SchemaName: "maulabs_categoryid",
                    DisplayName: label("Category"),
                    Description: label("Notification category lookup"),
                    RequiredLevel: { Value: "None", CanBeChanged: true }
                },
                CascadeConfiguration: {
                    Assign: "NoCascade",
                    Delete: "RemoveLink",
                    Merge: "NoCascade",
                    Reparent: "NoCascade",
                    Share: "NoCascade",
                    Unshare: "NoCascade",
                    RollupView: "NoCascade"
                }
            };

            try {
                const result = await apiRequest("POST",
                    `/api/data/v9.2/RelationshipDefinitions`,
                    token, relationshipBody);
                console.log("Lookup relationship created! Status:", result.status);
            } catch (e2) {
                console.error("Failed to create lookup:", e2.message);
            }
        } else {
            console.error("Error checking lookup:", e.message);
        }
    }

    // 6. Add entity to solution
    console.log(`\nAdding ${ENTITY_LOGICAL} to solution ${SOLUTION}...`);
    try {
        // Get the entity MetadataId
        const entityMeta = await apiRequest("GET",
            `/api/data/v9.2/EntityDefinitions(LogicalName='${ENTITY_LOGICAL}')?$select=MetadataId`, token);
        const entityMetaId = entityMeta.data.MetadataId;
        console.log(`  Entity MetadataId: ${entityMetaId}`);
        await apiRequest("POST", "/api/data/v9.2/AddSolutionComponent", token, {
            ComponentId: entityMetaId,
            ComponentType: 1, // Entity
            SolutionUniqueName: SOLUTION,
            AddRequiredComponents: false,
            DoNotIncludeSubcomponents: false
        });
        console.log("Added to solution.");
    } catch (e) {
        if (e.message && e.message.includes("already exists")) {
            console.log("Already in solution.");
        } else {
            console.warn("AddSolutionComponent note:", e.message);
        }
    }

    // 7. Publish
    console.log("\nPublishing...");
    try {
        await apiRequest("POST", "/api/data/v9.2/PublishXml", token, {
            ParameterXml: `<importexportxml><entities><entity>maulabs_supervisornotification</entity><entity>${ENTITY_LOGICAL}</entity></entities></importexportxml>`
        });
        console.log("Published!");
    } catch (e) {
        console.error("Publish error:", e.message);
    }

    console.log("\n════════════════════════════════════════════════");
    console.log("  ✅ Notification Category entity ready!");
    console.log("  Entity: " + ENTITY_LOGICAL);
    console.log("  Fields: maulabs_name, maulabs_emoji, maulabs_color, maulabs_description");
    console.log("  Lookup: maulabs_categoryid on maulabs_supervisornotification");
    console.log("════════════════════════════════════════════════");
})();
