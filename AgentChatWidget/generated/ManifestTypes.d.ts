/*
*This is auto generated from the ControlManifest.Input.xml file
*/

// Define IInputs and IOutputs Type. They should match with ControlManifest.
export interface IInputs {
    DirectLineSecret: ComponentFramework.PropertyTypes.StringProperty;
    TokenEndpointUrl: ComponentFramework.PropertyTypes.StringProperty;
    ClientId: ComponentFramework.PropertyTypes.StringProperty;
    AgentId: ComponentFramework.PropertyTypes.StringProperty;
    AgentName: ComponentFramework.PropertyTypes.StringProperty;
    PrimaryColor: ComponentFramework.PropertyTypes.StringProperty;
    UserId: ComponentFramework.PropertyTypes.StringProperty;
    UserName: ComponentFramework.PropertyTypes.StringProperty;
    RecordId: ComponentFramework.PropertyTypes.StringProperty;
    RecordTable: ComponentFramework.PropertyTypes.StringProperty;
    ContextJson: ComponentFramework.PropertyTypes.StringProperty;
    DemoMode: ComponentFramework.PropertyTypes.TwoOptionsProperty;
    DemoScenario: ComponentFramework.PropertyTypes.StringProperty;
    sampleProperty: ComponentFramework.PropertyTypes.StringProperty;
}
export interface IOutputs {
    sampleProperty?: string;
}
