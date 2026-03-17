// One-time script to create the maulabs_targetqueue attribute on the notification entity
const { getToken, apiRequest } = require('./auth');

const ENTITY = "maulabs_supervisornotification";
const ATTR = "maulabs_targetqueue";

(async () => {
    console.log("Authenticating...");
    const token = await getToken();
    console.log("Authenticated.");

    // Check if attribute already exists
    const checkPath = `/api/data/v9.2/EntityDefinitions(LogicalName='${ENTITY}')/Attributes(LogicalName='${ATTR}')`;
    try {
        await apiRequest("GET", checkPath, token);
        console.log(`Attribute ${ATTR} already exists. Skipping creation.`);
    } catch (e) {
        if (e.status === 404) {
            console.log(`Creating ${ATTR} attribute...`);
            const body = {
                "@odata.type": "Microsoft.Dynamics.CRM.StringAttributeMetadata",
                SchemaName: ATTR,
                DisplayName: {
                    "@odata.type": "Microsoft.Dynamics.CRM.Label",
                    LocalizedLabels: [{
                        "@odata.type": "Microsoft.Dynamics.CRM.LocalizedLabel",
                        Label: "Target Queue",
                        LanguageCode: 1033
                    }]
                },
                Description: {
                    "@odata.type": "Microsoft.Dynamics.CRM.Label",
                    LocalizedLabels: [{
                        "@odata.type": "Microsoft.Dynamics.CRM.LocalizedLabel",
                        Label: "Queue ID to scope notification recipients",
                        LanguageCode: 1033
                    }]
                },
                RequiredLevel: { Value: "None", CanBeChanged: true },
                MaxLength: 100,
                FormatName: { Value: "Text" },
                ImeMode: "Auto"
            };

            const attrPath = `/api/data/v9.2/EntityDefinitions(LogicalName='${ENTITY}')/Attributes`;
            const result = await apiRequest("POST", attrPath, token, body);
            console.log("Attribute created! Status:", result.status);

            // Publish the entity
            console.log("Publishing entity...");
            await apiRequest("POST", "/api/data/v9.2/PublishXml", token, {
                ParameterXml: `<importexportxml><entities><entity>${ENTITY}</entity></entities></importexportxml>`
            });
            console.log("Entity published.");
        } else {
            console.error("Error checking attribute:", e.message);
        }
    }
})();
