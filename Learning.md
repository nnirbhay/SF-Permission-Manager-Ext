

- A permission set is used to grant additional permissions to a user.
- If a user is assigned multiple permission sets, Salesforce applies the most permissive access from all assigned permission sets and the user’s profile

- In short, Permission sets only add permissions; they never restrict or remove access.
- When multiple permission sets are assigned: 
    - Salesforce unions all permissions.
    - If any permission set grants access (for example, Edit instead of Read), the user gets the higher (more permissive) level.

* Muting Permissions (Very Important 🔥)
- What is Muting? 
    - Muting permissions allow you to remove or reduce permissions inside a Permission Set Group—without changing the original permission sets.
    - You cannot mute permissions in a single permission set. Muting works only with Permission Set Groups

* Important Rules to Remember
    - Muting never applies outside the group
    - Muting cannot reduce profile permissions
    - Muting only overrides permissions added by the group
    - Salesforce still applies most permissive access overall

* Salesforce (query) used
    - PermissionSet (it hold all permission for access value, Profile and PermissionSetGroup are also consider as PermissionSet to indentify the permission)
    - PermissionSetAssignment (it hold all permission set assigned to user)
    - PermissionSetGroup (it hold all permission set group assigned to user)
    - PermissionSetGroupComponent (it hold all permission set group component assigned to user)
    - ObjectPermissions (it hold all object permission for user)
    - FieldPermissions (it hold all field permission for user)
    - MutePermissionSet (it hold all muted permission set for user)