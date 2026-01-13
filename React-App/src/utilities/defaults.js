export const setupEntities = {
    'ApexClass': {
        label: 'Apex Class Access',
        query: `SELECT Id, Name, NamespacePrefix FROM ApexClass WHERE ID IN (SELECT SetupEntityId FROM SetupEntityAccess WHERE ParentId IN ({{#psIdsStr}}) AND SetupEntityType = '{{#type}}')`,
    },
    'ApexPage': {
        label: 'Visualforce Page Access',
        query: `SELECT Id, Name, NamespacePrefix FROM ApexPage WHERE ID IN (SELECT SetupEntityId FROM SetupEntityAccess WHERE ParentId IN ({{#psIdsStr}}) AND SetupEntityType = '{{#type}}')`,
    },
    'ConnectedApplication': {
        label: 'Assigned Connected Apps',
        query: `SELECT Id, Name FROM ConnectedApplication WHERE ID IN (SELECT SetupEntityId FROM SetupEntityAccess WHERE ParentId IN ({{#psIdsStr}}) AND SetupEntityType = '{{#type}}')`,
    },
    'CustomEntityDefinition': { // 
        label: 'Custom Settings and Custom Metadata Types Access',
        query: `SELECT Id, MasterLabel, NamespacePrefix FROM CustomEntityDefinition WHERE ID IN (SELECT SetupEntityId FROM SetupEntityAccess WHERE ParentId IN ({{#psIdsStr}}) AND SetupEntityType = '{{#type}}')`,
    },
    'CustomPermission': {
        label: 'Custom Permissions',
        query: `SELECT Id, MasterLabel, NamespacePrefix FROM CustomEntityDefinition WHERE ID IN (SELECT SetupEntityId FROM SetupEntityAccess WHERE ParentId IN ({{#psIdsStr}}) AND SetupEntityType = '{{#type}}')`,
    },
    'EmailRoutingAddress': { // tooling api
        label: 'Email Routing Address Access',
        query: `SELECT Id, Name FROM CustomEntityDefinition WHERE ID IN (SELECT SetupEntityId FROM SetupEntityAccess WHERE ParentId IN ({{#psIdsStr}}) AND SetupEntityType = '{{#type}}')`,
    },
    'ExternalClientApplication': {
        label: 'External Client App Access',
        query: `SELECT Id, MasterLabel, NamespacePrefix FROM CustomEntityDefinition WHERE ID IN (SELECT SetupEntityId FROM SetupEntityAccess WHERE ParentId IN ({{#psIdsStr}}) AND SetupEntityType = '{{#type}}')`,
    },
    'ExternalCredentialParameter': { // tooling api
        label: 'External Credential Principal Access',
        query: `SELECT Id, Name FROM CustomEntityDefinition WHERE ID IN (SELECT SetupEntityId FROM SetupEntityAccess WHERE ParentId IN ({{#psIdsStr}}) AND SetupEntityType = '{{#type}}')`,
    },
    'FlowDefinition': {     // tooling api
        label: 'Flow Access',
        query: `SELECT Id, Name FROM CustomEntityDefinition WHERE ID IN (SELECT SetupEntityId FROM SetupEntityAccess WHERE ParentId IN ({{#psIdsStr}}) AND SetupEntityType = '{{#type}}')`,
    },
    'MessagingChannel': {
        label: 'Messaging Channel Access',
        query: `SELECT Id, Name FROM CustomEntityDefinition WHERE ID IN (SELECT SetupEntityId FROM SetupEntityAccess WHERE ParentId IN ({{#psIdsStr}}) AND SetupEntityType = '{{#type}}')`,
    },
    'OrgWideEmailAddress': {
        label: 'Org Wide Email Address Access',
        query: `SELECT Id, Name FROM CustomEntityDefinition WHERE ID IN (SELECT SetupEntityId FROM SetupEntityAccess WHERE ParentId IN ({{#psIdsStr}}) AND SetupEntityType = '{{#type}}')`,
    },
    'ServiceProvider': {
        label: 'Service Provider Access',
        query: `SELECT Id, Name FROM CustomEntityDefinition WHERE ID IN (SELECT SetupEntityId FROM SetupEntityAccess WHERE ParentId IN ({{#psIdsStr}}) AND SetupEntityType = '{{#type}}')`,
    },
    'StandardInvocableActionType': {
        label: 'Standard Invocable Action Type Access',
        query: `SELECT Id, Name FROM CustomEntityDefinition WHERE ID IN (SELECT SetupEntityId FROM SetupEntityAccess WHERE ParentId IN ({{#psIdsStr}}) AND SetupEntityType = '{{#type}}')`,
    },
    'TabSet': {
        label: 'Assigned Apps',
        query: `SELECT Id, Name FROM CustomEntityDefinition WHERE ID IN (SELECT SetupEntityId FROM SetupEntityAccess WHERE ParentId IN ({{#psIdsStr}}) AND SetupEntityType = '{{#type}}')`,
    },
    'ServicePresenceStatus': {
        label: 'Service Presence Statuses Access',
        query: `SELECT Id, Name FROM CustomEntityDefinition WHERE ID IN (SELECT SetupEntityId FROM SetupEntityAccess WHERE ParentId IN ({{#psIdsStr}}) AND SetupEntityType = '{{#type}}')`,
    },
    'ExternalDataSource': {
        label: 'External Data Source Access',
        query: `SELECT Id, Name FROM CustomEntityDefinition WHERE ID IN (SELECT SetupEntityId FROM SetupEntityAccess WHERE ParentId IN ({{#psIdsStr}}) AND SetupEntityType = '{{#type}}')`,
    },
    'NamedCredential': {
        label: 'Named Credential Access',
        query: `SELECT Id, Name FROM CustomEntityDefinition WHERE ID IN (SELECT SetupEntityId FROM SetupEntityAccess WHERE ParentId IN ({{#psIdsStr}}) AND SetupEntityType = '{{#type}}')`,
    },
}

