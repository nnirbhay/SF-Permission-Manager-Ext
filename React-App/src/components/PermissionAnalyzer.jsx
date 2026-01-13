
import { useState, useEffect, useMemo } from 'react';
import { Select, Spin, Tag, message, Input, Popover, Avatar, Divider, Table, Switch, Tabs, Radio, Segmented } from 'antd';
import { UserOutlined, SafetyCertificateOutlined, CloudServerOutlined, CopyOutlined, CloudOutlined, FilterOutlined, DownOutlined, UpOutlined, ReloadOutlined, ExclamationCircleOutlined, SolutionOutlined, ScheduleOutlined, ClusterOutlined, RocketOutlined, SearchOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import '../../../src/utilities/prototypes/prototypes.js';
import '../App.css';

const { Search } = Input;
const API_VERSION = '65.0';

let orgDomain;
let sessionId;

export default function PermissionAnalyzer() {
    const [loading, setLoading] = useState(true);
    const [errorCode, setErrorCode] = useState(null);
    const [users, setUsers] = useState([]);
    const [systemPermissions, setSystemPermissions] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [orgInfo, setOrgInfo] = useState(null);
    const [objects, setObjects] = useState([]);
    const [userPermissions, setUserPermissions] = useState({ profile: null, assignments: [], groups: [] });
    const [userSystemPermissions, setUserSystemPermissions] = useState({});
    const [selectedSources, setSelectedSources] = useState([]);
    const [expandedObject, setExpandedObject] = useState(null);
    const [objectPermsCache, setObjectPermsCache] = useState({});
    const [fetchingDetail, setFetchingDetail] = useState(false);
    const [objSearch, setObjSearch] = useState('');
    const [fieldSearch, setFieldSearch] = useState('');
    const [isMutualMode, setIsMutualMode] = useState(false);
    const [setupEntityCache, setSetupEntityCache] = useState({});
    const [fetchingSetupEntities, setFetchingSetupEntities] = useState(false);
    const [analyzeMode, setAnalyzeMode] = useState('user'); // 'user' | 'system' | 'object'
    const [selectedSystemPerm, setSelectedSystemPerm] = useState(null);
    const [systemPermUsers, setSystemPermUsers] = useState([]);
    const [systemPermSources, setSystemPermSources] = useState({ profiles: [], assignments: [], groups: [] });
    const [fetchingSystemUsers, setFetchingSystemUsers] = useState(false);
    const [systemPermUsersAssignments, setSystemPermUsersAssignments] = useState([]);

    // Object & Field Analysis States
    const [selectedObjectForAnalysis, setSelectedObjectForAnalysis] = useState(null);
    const [selectedObjectPermsForAnalysis, setSelectedObjectPermsForAnalysis] = useState([]);
    const [selectedFieldsForAnalysis, setSelectedFieldsForAnalysis] = useState([]);
    const [selectedFieldPermsForAnalysis, setSelectedFieldPermsForAnalysis] = useState([]);
    const [needsReEvaluation, setNeedsReEvaluation] = useState(false);
    const [objectFieldsCache, setObjectFieldsCache] = useState({});
    const [fetchingFields, setFetchingFields] = useState(false);
    const [objPermsLogic, setObjPermsLogic] = useState('AND');
    const [fieldPermsLogic, setFieldPermsLogic] = useState('AND');
    const [dataFetched, setDataFetched] = useState(false);

    const trackApiCall = (type) => {
        const today = new Date().toISOString().split('T')[0];
        const statsStr = localStorage.getItem(orgDomain + '_' + 'sf_perm_api_stats') || '{}';
        const stats = JSON.parse(statsStr);

        if (!stats[today]) stats[today] = {};
        stats[today][type] = (stats[today][type] || 0) + 1;

        if (!stats.overall) stats.overall = {};
        stats.overall[type] = (stats.overall[type] || 0) + 1;

        localStorage.setItem(orgDomain + '_' + 'sf_perm_api_stats', JSON.stringify(stats));
    };

    const filteredSystemUsers = useMemo(() => {
        if (analyzeMode !== 'system' && analyzeMode !== 'object') return systemPermUsers;
        if (selectedSources.length === 0) return systemPermUsers;

        // Default System mode logic
        const matchingAssigneeIds = new Set();
        systemPermUsersAssignments.forEach(a => {
            const psId = a.PermissionSet?.Id;
            const psgId = a.PermissionSetGroup?.Id;
            if (selectedSources.includes(psId) || (psgId && selectedSources.includes(psgId))) {
                matchingAssigneeIds.add(a.AssigneeId);
            }
        });
        return systemPermUsers.filter(u => matchingAssigneeIds.has(u.Id));
    }, [analyzeMode, systemPermUsers, systemPermUsersAssignments, selectedSources]);



    const getApiStats = () => {
        const statsStr = localStorage.getItem('sf_perm_api_stats') || '{}';
        return JSON.parse(statsStr);
    };

    const apiStats = useMemo(() => getApiStats(), [selectedUser, systemPermUsers]); // Refresh on data fetch

    useEffect(() => {
        const init = async () => {
            try {
                const urlParams = new URLSearchParams(window.location.search);
                orgDomain = urlParams.get('domain');

                sessionId = await chrome.runtime.sendMessage({ message: "get_sid", sfHost: orgDomain });
                if (!sessionId) {
                    message.error('Session expired or not found. Please refresh the Salesforce tab.');
                    setErrorCode('INVALID_SESSION_ID')
                    setLoading(false);
                    return;
                }
                await fetchInitialData();
            } catch (err) {
                console.error('Initialization error:', err);
                message.warning('Execution environment error.');
            } finally {
                setLoading(false);
            }
        };
        init();
    }, []);

    const orgCallout = async (url, method = 'GET', body = null, callType = 'generic') => {
        if (errorCode) {
            message.error(errorCodeMessages()[errorCode]);
            return;
        }
        trackApiCall(callType);
        const response = await fetch(`${orgDomain}${url}`, {
            method,
            headers: { 'Authorization': `Bearer ${sessionId}`, 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : null
        });
        let result = await response.json();
        console.log('orgCallout : ', url, result);
        if (!response.ok) {
            console.log('error Code : ', result?.at(0)?.errorCode);
            setErrorCode(result?.at(0)?.errorCode);
            throw new Error(`API error: ${response.statusText}`);
        }
        return result;
    };

    const fetchInitialData = async () => {
        try {
            const compositeRequest = {
                allOrNone: false,
                compositeRequest: [
                    {
                        method: "GET", referenceId: "User",
                        url: `/services/data/v${API_VERSION}/query?q=${encodeURIComponent('SELECT Id,Name,Email,Username,Alias,Profile.Name,UserRole.Name,IsActive FROM User WHERE IsActive=true ORDER BY Name LIMIT 2000')}`
                    },
                    {
                        method: "GET", referenceId: "Organization",
                        url: `/services/data/v${API_VERSION}/query?q=${encodeURIComponent('SELECT Id,Name,IsSandbox,NamespacePrefix FROM Organization')}`
                    },
                    {
                        method: "GET", referenceId: "SObjects",
                        url: `/services/data/v${API_VERSION}/sobjects/`
                    },
                    {
                        method: "GET", referenceId: "PermissionSetObject",
                        url: `/services/data/v${API_VERSION}/sobjects/PermissionSet/describe/`
                    }
                ]
            };

            const res = await orgCallout(`/services/data/v${API_VERSION}/composite`, 'POST', compositeRequest, 'initial_data_fetch');
            const userResults = res.compositeResponse.find(r => r.referenceId === 'User').body;
            const orgResults = res.compositeResponse.find(r => r.referenceId === 'Organization').body;
            const sobjResults = res.compositeResponse.find(r => r.referenceId === 'SObjects').body;
            const permSetObjResults = res.compositeResponse.find(r => r.referenceId === 'PermissionSetObject').body;

            setUsers(userResults.records);
            setOrgInfo(orgResults.records[0]);

            let spFields = permSetObjResults.fields;
            let sPermissions = [];
            spFields.forEach(f => {
                if (f.name.startsWith('Permissions') && f.type == 'boolean') sPermissions.push({ name: f.name, label: f.label })
            });
            setSystemPermissions(sPermissions);

            const sortedObjs = sobjResults.sobjects
                .filter(obj => obj.queryable && obj.layoutable)
                .sort((a, b) => a.label.localeCompare(b.label));
            setObjects(sortedObjs);
        } catch (err) {
            message.error('Error fetching data via Composite API.');
        }
    };

    const handleUserSelect = async (userId) => {
        const user = users.find(u => u.Id === userId);
        setSelectedUser(user);
        setUserPermissions({ profile: null, assignments: [], groups: [] });
        setUserSystemPermissions({});
        setSelectedSources([]);
        setExpandedObject(null);
        setObjectPermsCache({});

        let sysPermissions = systemPermissions.map(sp => sp.name);

        try {
            // Composite request for User Assignments and Muting Info
            const compositeRequest = {
                allOrNone: true,
                compositeRequest: [
                    {
                        method: "GET", referenceId: "Assignments",
                        url: `/services/data/v${API_VERSION}/query?q=${encodeURIComponent(`SELECT PermissionSet.Id, PermissionSet.Name, PermissionSet.Label, PermissionSet.IsOwnedByProfile, PermissionSet.Profile.Id, PermissionSet.Profile.Name, PermissionSetGroup.Id, PermissionSetGroup.MasterLabel FROM PermissionSetAssignment WHERE AssigneeId = '${userId}'`)}`
                    },
                    {
                        method: "GET", referenceId: "System_Assignments",
                        url: `/services/data/v${API_VERSION}/query?q=${encodeURIComponent(`SELECT Id, Name, Label, IsOwnedByProfile, Profile.Name, PermissionSetGroupId, ${sysPermissions.join(',')} FROM PermissionSet WHERE ID IN (SELECT PermissionSetId FROM PermissionSetAssignment WHERE AssigneeId = '${userId}')`)}`
                    },
                    {
                        method: "GET", referenceId: "PSGComponents",
                        url: `/services/data/v${API_VERSION}/query?q=${encodeURIComponent(`SELECT Id, PermissionSetId, PermissionSetGroupId, PermissionSet.Name, PermissionSet.Label FROM PermissionSetGroupComponent WHERE PermissionSetGroupId IN (SELECT PermissionSetGroupId FROM PermissionSetAssignment WHERE AssigneeId = '${userId}')`)}`
                    }
                ]
            };

            const resComp = await orgCallout(`/services/data/v${API_VERSION}/composite`, 'POST', compositeRequest, 'user_permissions_fetch');
            const assignmentRes = resComp.compositeResponse.find(r => r.referenceId === 'Assignments').body;
            const sysPermissionAssignemnts = resComp.compositeResponse.find(r => r.referenceId === 'System_Assignments').body;
            const PSGComponentsRes = resComp.compositeResponse.find(r => r.referenceId === 'PSGComponents').body;

            const profileAssignemnt = assignmentRes?.records?.find(r => r.PermissionSet.IsOwnedByProfile) ?? {};
            const profile = { ...profileAssignemnt.PermissionSet?.Profile, PermissionSet: profileAssignemnt.PermissionSet };

            const assignments = assignmentRes.records?.filter(r => !r.PermissionSet.IsOwnedByProfile && !r.PermissionSetGroup);
            const groupsMap = {};
            const userSystemPermissions = {};

            assignmentRes.records.forEach(r => {
                if (r.PermissionSetGroup) {
                    const gid = r.PermissionSetGroup.Id;
                    if (!groupsMap[gid]) {
                        groupsMap[gid] = {
                            Id: gid, Label: r.PermissionSetGroup.MasterLabel,
                            PSIds: [], MutingPSId: null
                        };
                    }
                    groupsMap[gid].PSIds.push(r.PermissionSet.Id);
                }
            });

            PSGComponentsRes.records.forEach(c => {
                // If the assigned PS is a Muting PS, store its ID
                if (c.PermissionSetId.startsWith('0QM') && groupsMap[c.PermissionSetGroupId]) {
                    groupsMap[c.PermissionSetGroupId].MutingPSId = c.PermissionSetId;
                }
                else {
                    if (!groupsMap[c.PermissionSetGroupId].pSets?.length) groupsMap[c.PermissionSetGroupId].pSets = [];
                    groupsMap[c.PermissionSetGroupId].pSets.push({
                        Id: c.PermissionSetId,
                        Name: c.PermissionSet.Name,
                        Label: c.PermissionSet.Label
                    });
                }
            });

            setUserPermissions({ profile, assignments, groups: Object.values(groupsMap) });

            sysPermissionAssignemnts.records.forEach(r => {
                userSystemPermissions[r.Id] = {
                    isProfile: r.IsOwnedByProfile,
                    id: r.Id, name: r.IsOwnedByProfile ? r?.Profile.Name : r.Name,
                    label: r.IsOwnedByProfile ? r?.Profile.Name : r.Label,
                    granted: systemPermissions?.filter(ele => r[ele.name] == true)?.map(e => (e.name)),
                    // need to re-evalute the mutting for system permissions 
                    // MutingPSId: PSGComponentsRes.records?.find(c => c.PermissionSetId.startsWith('0QM') && groupsMap[r.PermissionSetGroupId]),
                }
            });

            setUserSystemPermissions(userSystemPermissions) // This will be handled by setupUserSystemPermission
        } catch (err) {
            console.error(err);
            message.error('Error fetching user permissions.');
        }
    };

    const toggleSource = (id) => {
        setSelectedSources(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
        if (selectedSources.length < 2) {
            setIsMutualMode(false)
        }
    };

    const getTargetParentIds = () => {
        const groupsConfig = []; // [{psIds: [], muteId: null}]
        const standaloneIds = [];
        const profileId = userPermissions.profile?.PermissionSet?.Id;

        if (profileId) standaloneIds.push(profileId);
        userPermissions.assignments.forEach(a => standaloneIds.push(a.PermissionSet.Id));
        userPermissions.groups.forEach(g => groupsConfig.push({ psIds: g.PSIds, muteId: g.MutingPSId }));

        return { groupsConfig, standaloneIds };
    };

    const fetchObjectPermissions = async (object, force = false) => {
        if (!force && objectPermsCache[object.name]) return;

        setFetchingDetail(true);
        try {
            const { groupsConfig, standaloneIds } = getTargetParentIds();
            const allPSIds = new Set(standaloneIds);
            groupsConfig.forEach(g => {
                g.psIds.forEach(id => allPSIds.add(id));
                if (g.muteId) allPSIds.add(g.muteId);
            });

            if (allPSIds.size === 0) return;

            const psIdsStr = Array.from(allPSIds).map(id => `'${id}'`).join(',');
            const objQuery = `SELECT ParentId, PermissionsCreate, PermissionsRead, PermissionsEdit, PermissionsDelete, PermissionsViewAllRecords, PermissionsModifyAllRecords, PermissionsViewAllFields FROM ObjectPermissions WHERE ParentId IN (${psIdsStr}) AND SobjectType = '${object.name}'`;
            const fieldQuery = `SELECT ParentId, Field, PermissionsRead, PermissionsEdit FROM FieldPermissions WHERE ParentId IN (${psIdsStr}) AND SobjectType = '${object.name}'`;

            const compositeRequest = {
                allOrNone: true,
                compositeRequest: [
                    {
                        method: "GET", referenceId: "objQuery",
                        url: `/services/data/v${API_VERSION}/query?q=${encodeURIComponent(objQuery)}`
                    },
                    {
                        method: "GET", referenceId: "fieldQuery",
                        url: `/services/data/v${API_VERSION}/query?q=${encodeURIComponent(fieldQuery)}`
                    },
                    {
                        method: "GET", referenceId: "describeRes",
                        url: `/services/data/v${API_VERSION}/sobjects/${object.name}/describe`
                    }
                ]
            };

            const resComp = await orgCallout(`/services/data/v${API_VERSION}/composite`, 'POST', compositeRequest, 'object_perms_fetch');
            const objRes = resComp.compositeResponse.find(r => r.referenceId === 'objQuery').body;
            const fieldRes = resComp.compositeResponse.find(r => r.referenceId === 'fieldQuery').body;
            const describeRes = resComp.compositeResponse.find(r => r.referenceId === 'describeRes').body;

            const objMap = {}; // ParentId -> Perms
            objRes.records.forEach(r => objMap[r.ParentId] = r);

            const fieldMapRaw = {}; // ParentId -> FieldName -> Perms
            fieldRes.records.forEach(f => {
                if (!fieldMapRaw[f.ParentId]) fieldMapRaw[f.ParentId] = {};
                const fieldName = f.Field.split('.')[1];
                fieldMapRaw[f.ParentId][fieldName] = f;
            });

            const getEffectiveForGroup = (config, p, isField = false, fName = null) => {
                let groupGrant = false;
                config.psIds.forEach(id => {
                    const rec = isField ? fieldMapRaw[id]?.[fName] : objMap[id];
                    if (rec) {
                        const key = isField ? (p === 'Read' ? 'PermissionsRead' : 'PermissionsEdit') : `Permissions${p}`;
                        if (rec[key]) groupGrant = true;
                    }
                });

                let isMuted = false;

                if (config.muteId) {
                    const muteRec = isField ? fieldMapRaw[config.muteId]?.[fName] : objMap[config.muteId];
                    if (muteRec) {
                        const key = isField
                            ? (p === 'Read' ? 'PermissionsRead' : 'PermissionsEdit')
                            : `Permissions${p}`;
                        // In Muting PS, TRUE means MUTED (inverse)
                        if (muteRec[key]) isMuted = true;
                    }
                }
                return { grant: groupGrant && !isMuted, muted: isMuted };
            };

            // Prepare Source Labels for hover
            const sourceLabels = {};
            if (userPermissions.profile) sourceLabels[userPermissions.profile.PermissionSet.Id] = `Profile: ${userPermissions.profile.Name}`;
            userPermissions.assignments.forEach(a => sourceLabels[a.PermissionSet.Id] = `PS: ${a.PermissionSet.Label}`);
            userPermissions.groups.forEach(g => sourceLabels[g.Id] = `PSG: ${g.Label}`);

            const rawObjectResults = {};
            ['Read', 'Create', 'Edit', 'Delete', 'ViewAllRecords', 'ModifyAllRecords', 'ViewAllFields'].forEach(p => {
                const resultsPerSource = [];
                standaloneIds.forEach(id => {
                    const rec = objMap[id];
                    let granted = false;
                    if (rec) {
                        const key = p === 'ViewAllRecords' ? 'PermissionsViewAllRecords' : (p === 'ModifyAllRecords' ? 'PermissionsModifyAllRecords' : (p === 'ViewAllFields' ? 'PermissionsViewAllFields' : `Permissions${p}`));
                        if (rec[key]) granted = true;
                    }
                    resultsPerSource.push({ id, label: sourceLabels[id] || 'Unknown', grant: granted, muted: false });
                });

                groupsConfig.forEach(config => {
                    const groupResult = getEffectiveForGroup(config, p);
                    const groupRef = userPermissions.groups.find(g => g.MutingPSId === config.muteId || (config.psIds.includes(g.PSIds[0])));
                    resultsPerSource.push({ id: groupRef?.Id, label: groupRef?.Label ? `PSG: ${groupRef.Label}` : 'Permission Set Group', ...groupResult });
                });
                rawObjectResults[p] = resultsPerSource;
            });

            const rawFieldResults = describeRes.fields?.filter(f => !f.compoundFieldName && f.type !== 'id')?.map(f => {
                const rResults = [];
                const eResults = [];
                standaloneIds.forEach(id => {
                    const fRec = fieldMapRaw[id]?.[f.name];
                    rResults.push({ id, label: sourceLabels[id], grant: f.permissionable ? !!fRec?.PermissionsRead : true, muted: false });
                    eResults.push({ id, label: sourceLabels[id], grant: f.permissionable ? !!fRec?.PermissionsEdit : f.updateable, muted: false });
                });
                groupsConfig.forEach(config => {
                    const groupRef = userPermissions.groups.find(g => g.MutingPSId === config.muteId || (config.psIds.includes(g.PSIds[0])));
                    const label = groupRef ? `PSG: ${groupRef.Label}` : 'PSG';
                    rResults.push({ id: groupRef?.Id, label, ...getEffectiveForGroup(config, 'Read', true, f.name) });
                    eResults.push({ id: groupRef?.Id, label, ...getEffectiveForGroup(config, 'Edit', true, f.name) });
                });
                return { name: f.name, label: f.label, rResults, eResults };
            });

            setObjectPermsCache(prev => ({
                ...prev,
                [object.name]: {
                    rawObjectResults,
                    rawFieldResults,
                }
            }));
        } catch (err) {
            message.error('Error fetching object permissions.');
            console.log('err : ', err.stack);

        } finally {
            setFetchingDetail(false);
        }
    };

    const processAssignments = (records) => {
        const profilesMap = {};
        const psMap = {};
        const psgMapLocal = {};
        const uniqueUsers = {};

        records.forEach(p => {
            const ps = p.PermissionSet;
            const psg = p.PermissionSetGroup;

            if (ps.IsOwnedByProfile) {
                profilesMap[ps.Id] = { Id: ps.Id, Name: ps.PermissionSet?.Profile?.Name || ps.Profile?.Name || ps.Name, psId: ps.Id };
            } else if (psg && psg.Id) {
                psgMapLocal[psg.Id] = { Id: psg.Id, Label: psg.MasterLabel };
            } else {
                psMap[ps.Id] = { PermissionSet: { Id: ps.Id, Label: ps.Label, Name: ps.Name } };
            }

            if (!uniqueUsers[p.AssigneeId]) {
                uniqueUsers[p.AssigneeId] = {
                    Id: p.AssigneeId,
                    Name: p.Assignee.Name,
                    Username: p.Assignee.Username,
                    ProfileName: p.Assignee.Profile?.Name,
                    RoleName: p.Assignee.UserRole?.Name
                };
            }
        });

        setSystemPermSources({
            profiles: Object.values(profilesMap),
            assignments: Object.values(psMap),
            groups: Object.values(psgMapLocal)
        });
        setSystemPermUsersAssignments(records);
        setSystemPermUsers(Object.values(uniqueUsers));
    };

    const fetchSystemPermissionData = async (permName) => {
        if (!permName) return;
        setFetchingSystemUsers(true);
        setSelectedSystemPerm(permName);
        try {
            const pscQuery = `SELECT AssigneeId, Assignee.Name, Assignee.Username, Assignee.Profile.Name, Assignee.UserRole.Name, 
                PermissionSet.Id, PermissionSet.Name, PermissionSet.Label, PermissionSet.IsOwnedByProfile, 
                PermissionSet.Profile.Id, PermissionSet.Profile.Name, 
                PermissionSetGroup.Id, PermissionSetGroup.MasterLabel 
                FROM PermissionSetAssignment WHERE PermissionSet.${permName} = true AND Assignee.IsActive = true`;
            const assignRes = await orgCallout(`/services/data/v${API_VERSION}/query?q=${encodeURIComponent(pscQuery)}`, 'GET', null, 'system_perm_users_fetch');
            processAssignments(assignRes.records);
        } catch (err) {
            console.error('Fetch system perm error:', err);
            message.error('Error fetching system permission data.');
        } finally {
            setFetchingSystemUsers(false);
        }
    };


    const fetchObjectAccessData = async (obj, objPerms, fields, fieldPerms) => {
        if (!obj) return;
        setFetchingSystemUsers(true);
        setNeedsReEvaluation(false);
        try {
            const hasObjCriteria = objPerms?.length > 0;
            const hasFieldCriteria = fields?.length > 0 && fieldPerms?.length > 0;

            if (!hasObjCriteria && !hasFieldCriteria) {
                setSystemPermUsers([]);
                setSystemPermSources({ profiles: [], assignments: [], groups: [] });
                setFetchingSystemUsers(false);
                return;
            }

            const psaBaseQuery = `SELECT AssigneeId, Assignee.Name, Assignee.Username, Assignee.Profile.Name, Assignee.UserRole.Name, 
                PermissionSet.Id, PermissionSet.Name, PermissionSet.Label, PermissionSet.IsOwnedByProfile, 
                PermissionSet.Profile.Id, PermissionSet.Profile.Name, 
                PermissionSetGroup.Id, PermissionSetGroup.MasterLabel 
                FROM PermissionSetAssignment 
                WHERE PermissionSetId IN ({##sub_query##}) AND Assignee.IsActive = true`;

            const batchRequests = [];

            // 1. Object Permissions Subquery
            if (hasObjCriteria) {
                const cond = objPerms.map(p => `Permissions${p}=true`).join(objPermsLogic === 'AND' ? ' AND ' : ' OR ');
                const subQuery = `SELECT ParentId FROM ObjectPermissions WHERE SobjectType='${obj}' AND (${cond})`;
                batchRequests.push({
                    method: 'GET',
                    url: `/services/data/v${API_VERSION}/query?q=${encodeURIComponent(psaBaseQuery.replace('{##sub_query##}', subQuery))}`,
                    referenceId: 'obj_assignments'
                });
            }

            // 2. Field Permissions Subqueries (One per field for cumulative AND)
            if (hasFieldCriteria) {
                const cond = fieldPerms.map(p => `Permissions${p}=true`).join(fieldPermsLogic === 'AND' ? ' AND ' : ' OR ');
                fields.forEach((f, idx) => {
                    const subQuery = `SELECT ParentId FROM FieldPermissions WHERE SobjectType='${obj}' AND Field='${obj}.${f}' AND (${cond})`;
                    batchRequests.push({
                        method: 'GET',
                        url: `/services/data/v${API_VERSION}/query?q=${encodeURIComponent(psaBaseQuery.replace('{##sub_query##}', subQuery))}`,
                        referenceId: `field_assignments_${idx}`
                    });
                });
            }

            const compositeRes = await orgCallout(`/services/data/v${API_VERSION}/composite`, 'POST', { compositeRequest: batchRequests }, 'object_access_fetch');

            let objUserAssignments = null; // Map {AssigneeId: [Records]}
            let fieldUserAssignmentsList = []; // Array of Maps {AssigneeId: [Records]}

            compositeRes.compositeResponse?.forEach(res => {
                const records = res.body?.records || [];
                const userMap = {};
                records.forEach(r => {
                    if (!userMap[r.AssigneeId]) userMap[r.AssigneeId] = [];
                    userMap[r.AssigneeId].push(r);
                });

                if (res.referenceId === 'obj_assignments') {
                    objUserAssignments = userMap;
                } else if (res.referenceId.startsWith('field_assignments_')) {
                    fieldUserAssignmentsList.push(userMap);
                }
            });

            // Intersection for Fields (AND logic)
            let intersectedFieldUserAssignments = null;
            if (fieldUserAssignmentsList.length > 0) {
                intersectedFieldUserAssignments = fieldUserAssignmentsList[0];
                for (let i = 1; i < fieldUserAssignmentsList.length; i++) {
                    const nextMap = fieldUserAssignmentsList[i];
                    const newIntersection = {};
                    Object.keys(intersectedFieldUserAssignments).forEach(uid => {
                        if (nextMap[uid]) {
                            // Combine assignments for this user
                            newIntersection[uid] = [...new Set([...intersectedFieldUserAssignments[uid], ...nextMap[uid]])];
                        }
                    });
                    intersectedFieldUserAssignments = newIntersection;
                }
            }

            // Final Result (AND between Object block and Field block if both exist)
            let finalAssignmentsMap = {};
            if (objUserAssignments && intersectedFieldUserAssignments) {
                Object.keys(objUserAssignments).forEach(uid => {
                    if (intersectedFieldUserAssignments[uid]) {
                        finalAssignmentsMap[uid] = [...new Set([...objUserAssignments[uid], ...intersectedFieldUserAssignments[uid]])];
                    }
                });
            } else if (objUserAssignments) {
                finalAssignmentsMap = objUserAssignments;
            } else if (intersectedFieldUserAssignments) {
                finalAssignmentsMap = intersectedFieldUserAssignments;
            }

            const allFinalRecords = Object.values(finalAssignmentsMap).flat();

            if (allFinalRecords.length === 0) {
                setSystemPermUsers([]);
                setSystemPermSources({ profiles: [], assignments: [], groups: [] });
            } else {
                processAssignments(allFinalRecords);
            }
            setDataFetched(true);
        } catch (err) {
            console.error('Fetch object access error:', err);
            message.error('Error fetching access data.');
        } finally {
            setFetchingSystemUsers(false);
        }
    };

    const setupUserSystemPermission = async () => {
        try {
            const { groupsConfig, standaloneIds } = getTargetParentIds();
            const allPSIds = new Set(standaloneIds);
            groupsConfig.forEach(g => {
                g.psIds.forEach(id => allPSIds.add(id));
                if (g.muteId) allPSIds.add(g.muteId);
            });

            if (allPSIds.size === 0) return;

            const psIdsStr = Array.from(allPSIds).map(id => `'${id}'`).join(',');
            const fieldsToQuery = systemPermissions.map(p => p.name).join(',');
            const psQuery = `SELECT Id, ${fieldsToQuery} FROM PermissionSet WHERE Id IN (${psIdsStr})`;

            const res = await orgCallout(`/services/data/v${API_VERSION}/query?q=${encodeURIComponent(psQuery)}`, 'GET', null, 'user_system_perms_fetch');
            const psMap = {};
            res.records.forEach(r => psMap[r.Id] = r);

            // Calculate Effective
            const sourceLabels = {};
            if (userPermissions.profile) sourceLabels[userPermissions.profile.PermissionSet.Id] = `Profile: ${userPermissions.profile.Name}`;
            userPermissions.assignments.forEach(a => sourceLabels[a.PermissionSet.Id] = `PS: ${a.PermissionSet.Label}`);
            userPermissions.groups.forEach(g => sourceLabels[g.Id] = `PSG: ${g.Label}`);

            const getEffectiveForSytemPerm = (config, pName) => {
                let groupGrant = false;
                config.psIds.forEach(id => {
                    const rec = psMap[id];
                    if (rec && rec[pName]) groupGrant = true;
                });

                let isMuted = false;
                if (config.muteId) {
                    const muteRec = psMap[config.muteId];
                    if (muteRec && muteRec[pName]) isMuted = true;
                }
                return { grant: groupGrant && !isMuted, muted: isMuted };
            };

            const rawSystemResults = {};
            systemPermissions.forEach(p => {
                const resultsPerSource = [];
                standaloneIds.forEach(id => {
                    const rec = psMap[id];
                    resultsPerSource.push({ id, label: sourceLabels[id], grant: !!rec?.[p.name], muted: false });
                });
                groupsConfig.forEach(config => {
                    const groupRef = userPermissions.groups.find(g => g.MutingPSId === config.muteId || (config.psIds.includes(g.PSIds[0])));
                    const groupResult = getEffectiveForSytemPerm(config, p.name);
                    resultsPerSource.push({ id: groupRef?.Id, label: (groupRef?.Label ? `PSG: ${groupRef.Label}` : 'PSG'), ...groupResult });
                });
                rawSystemResults[p.name] = resultsPerSource;
            });

            setUserSystemPermissions(rawSystemResults);
        } catch (err) {
            console.error(err);
            message.error('Error fetching user system permissions.');
        } finally {
            setFetchingDetail(false);
        }
    };

    const fetchSetupEntityAccess = async () => {
        if (!selectedUser) return;
        setFetchingSetupEntities(true);
        try {
            const { groupsConfig, standaloneIds } = getTargetParentIds();
            const allPSIds = new Set(standaloneIds);
            groupsConfig.forEach(g => {
                g.psIds.forEach(id => allPSIds.add(id));
                if (g.muteId) allPSIds.add(g.muteId);
            });

            if (allPSIds.size === 0) return;

            const sourceLabels = {};
            if (userPermissions.profile) sourceLabels[userPermissions.profile.PermissionSet.Id] = `Profile: ${userPermissions.profile.Name}`;
            userPermissions.assignments.forEach(a => sourceLabels[a.PermissionSet.Id] = `PS: ${a.PermissionSet.Label}`);
            userPermissions.groups.forEach(g => sourceLabels[g.Id] = `PSG: ${g.Label}`);

            const psIdsStr = Array.from(allPSIds).map(id => `'${id}'`).join(',');
            const entityMap = {
                'ApexClass': 'Apex Classes',
                'ApexPage': 'Visualforce Pages',
                'CustomPermission': 'Custom Permissions',
                'TabSet': 'Apps',
                'NamedCredential': 'Named Credentials',
                'ConnectedApplication': 'Connected Apps',
                'ExternalCredential': 'External Credentials',
                'OrgWideEmailAddress': 'Org Wide Email Addresses'
            };

            const query = `SELECT ParentId, SetupEntityId, SetupEntityType FROM SetupEntityAccess WHERE ParentId IN (${psIdsStr})`;
            const res = await orgCallout(`/services/data/v${API_VERSION}/query?q=${encodeURIComponent(query)}`, 'GET', null, 'setup_entity_fetch');

            const cache = {};
            res.records.forEach(r => {
                const cat = entityMap[r.SetupEntityType] || r.SetupEntityType;
                if (!cache[cat]) cache[cat] = { count: 0, entities: {} };

                if (!cache[cat].entities[r.SetupEntityId]) {
                    cache[cat].entities[r.SetupEntityId] = { id: r.SetupEntityId, sources: [] };
                    cache[cat].count++;
                }
                const sourceLabel = sourceLabels[r.ParentId] || 'Unknown Source';
                cache[cat].entities[r.SetupEntityId].sources.push(sourceLabel);
            });

            setSetupEntityCache(cache);
        } catch (err) {
            console.error('Fetch setup entity error:', err);
            message.error('Error fetching setup entity permissions.');
        } finally {
            setFetchingSetupEntities(false);
        }
    };


    const handleTabChange = (key) => {
        if (key === 'setupEntity') {
            fetchSetupEntityAccess();
        }
        // else if (key === 'systemPermission') {
        //     setupUserSystemPermission();
        // }
        // else { // Reset object/field analysis states when switching away from it
        //     setSelectedObjectForAnalysis(null);
        //     setSelectedObjectPermsForAnalysis([]);
        //     setSelectedFieldsForAnalysis([]);
        //     setSelectedFieldPermsForAnalysis([]);
        //     setNeedsReEvaluation(false);
        //     setObjPermsLogic('OR');
        //     setFieldPermsLogic('OR');
        //     setDataFetched(false);
        //     setUserSystemPermissions({});
        // }
    };



    const toggleObjectExpansion = (object) => {
        if (expandedObject === object.name) {
            setExpandedObject(null);
        } else {
            setExpandedObject(object.name);
            fetchObjectPermissions(object);
        }
    };

    const copyLoginUrl = () => {
        const loginUrl = `${orgDomain}/secur/frontdoor.jsp?sid=${sessionId}`;
        navigator.clipboard.writeText(loginUrl);
        message.success('Login URL copied!');
    };

    const filteredObjs = useMemo(() => {
        const val = objSearch.toLowerCase();
        return objects.filter(o => o.label.toLowerCase().includes(val) || o.name.toLowerCase().includes(val));
    }, [objSearch, objects]);


    return (
        <div className="main-app d-f f-d-c h-100-vh of-h c-b-1">
            {loading && <div className="loading-container pos-f z-i-9999 w-100-p h-100-p d-f a-i-c j-c-c"><Spin size="large" tip="Loading Salesforce Data..." /></div>}
            <header className="app-header d-f a-i-c j-c-s-b p-i-1l p-bk-l">
                <div className="d-f a-i-c g-m">
                    <SafetyCertificateOutlined className="fs-24-px c-prim" />
                    <h1 className="fs-18-px c-w m-a-0 fw-600">Salesforce Permission Assistance</h1>
                </div>
                <div className="d-f a-i-c g-1">
                    {orgInfo && <div className="bg-c-prim-xl p-bk-xs p-i-s b-rad-4-px fs-12-px d-f a-i-c g-m c-prim fw-600">
                        {orgInfo.Name}
                        <Popover
                            title="API Call Statistics"
                            content={
                                <div style={{ minWidth: 200 }}>
                                    <div className="fw-700 border-b p-b-xs">Today ({new Date().toISOString().split('T')[0]})</div>
                                    {Object.entries(getApiStats()[new Date().toISOString().split('T')[0]] || {}).map(([type, count]) => (
                                        <div key={type} className="d-f j-c-s-b fs-12-px m-t-xs">
                                            <span>{type.replace(/_/g, ' ')}:</span>
                                            <span className="fw-600">{count}</span>
                                        </div>
                                    ))}
                                    <div className="fw-700 border-b p-b-xs m-t-m">Overall</div>
                                    {Object.entries(getApiStats().overall || {}).map(([type, count]) => (
                                        <div key={type} className="d-f j-c-s-b fs-12-px m-t-xs">
                                            <span>{type.replace(/_/g, ' ')}:</span>
                                            <span className="fw-600">{count}</span>
                                        </div>
                                    ))}
                                </div>
                            }
                        >
                        </Popover>
                    </div>}
                    <Popover
                        trigger="click"
                        placement="bottomRight"
                        content={
                            <div className="p-a-m" style={{ width: 280 }}>
                                <div className="d-f a-i-c g-m p-a-m bg-c-prim-xxl b-rad-9-px">
                                    <Avatar size={42} icon={<UserOutlined />} className="bg-c-prim" />
                                    <div className="of-h">
                                        <div className="fs-15-px fw-600 c-prim t-o-e w-s-nw">{selectedUser?.Name || 'N/A'}</div>
                                        <div className="fs-12-px c-b-2 t-o-e w-s-nw">{selectedUser?.Email || 'N/A'}</div>
                                    </div>
                                </div>
                                <div className="m-t-m p-a-s d-f a-i-c g-s bg-c-prim-xxl b-rad-4-px">
                                    <CloudOutlined className="c-prim" />
                                    <span className="fs-12-px fw-600 c-prim">{orgInfo?.Name || 'N/A'}</span>
                                </div>
                                <button className="prime-button w-100-p m-t-m" data-inverse onClick={copyLoginUrl}>
                                    <CopyOutlined /> COPY LOGIN URL
                                </button>
                            </div>
                        }
                    >
                        <Avatar icon={<UserOutlined />} className="cur-pointer bg-c-prim" />
                    </Popover>
                </div>
            </header>

            <main className="f-g-1 d-f of-h bg-c-wb-1">
                <aside className="left-panel d-f f-d-c of-y-a p-a-1 bg-c-w b-r-1-px b-c-b-5" style={{ minWidth: 380, width: 380 }}>
                    <div className="p-b-m">
                        <div className="fs-14-px fw-700 c-b-2 t-t-ucp">Analyze For</div>
                        <Select
                            className="w-100-p m-t-s"
                            value={analyzeMode}
                            onChange={(val) => {
                                setAnalyzeMode(val);
                                setSelectedUser(null);
                                setSelectedSystemPerm(null);
                                setSystemPermUsers([]);
                                setSystemPermSources({ profiles: [], assignments: [], groups: [] });
                                setSelectedSources([]);
                                setSelectedObjectForAnalysis(null);
                                setSelectedObjectPermsForAnalysis([]);
                                setSelectedFieldsForAnalysis([]);
                                setSelectedFieldPermsForAnalysis([]);
                                setNeedsReEvaluation(false);
                                setObjPermsLogic('AND');
                                setFieldPermsLogic('AND');
                                setDataFetched(false);
                            }}
                            options={[
                                { value: 'user', label: 'User' },
                                { value: 'system', label: 'System Permission' },
                                { value: 'object', label: 'Object & Fields' }
                            ]}
                        />
                    </div>

                    <div className="p-b-m border-t p-t-m">
                        {analyzeMode === 'user' ? (
                            <>
                                <div className="fs-14-px fw-700 c-b-2 t-t-ucp">Select Salesforce User</div>
                                <Select
                                    showSearch
                                    className="w-100-p m-t-s"
                                    placeholder="Type name to search..."
                                    optionFilterProp="label"
                                    onChange={handleUserSelect}
                                    value={selectedUser?.Id}
                                    options={users.map(u => ({ value: u.Id, label: `${u.Name} (${u.Profile?.Name || 'No Profile'})`, name: u.Name }))}
                                />

                                {selectedUser?.Id && (
                                    <div className="m-t-m p-a-m bg-c-wb-1 b-rad-9-px b-1-px b-c-b-5">
                                        <div className="d-f f-d-c g-xs">
                                            <div className="m-b-m">
                                                <div className="fs-13-px fw-700 c-b-2 p-b-xs">{selectedUser?.Name}</div>
                                                <span className="fs-11-px c-b-2 t-o-e">{selectedUser.Username}</span>
                                            </div>
                                            <div className="d-f j-c-s-b f-w-w g-m">
                                                <Tag color="blue" className="fs-13-px m-a-0">
                                                    {selectedUser?.UserRole?.Name || 'N/A'}
                                                </Tag>
                                                <Tag color="gold" className="fs-13-px m-a-0">
                                                    {selectedUser?.Profile?.Name || 'N/A'}
                                                </Tag>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : analyzeMode === 'system' ? (
                            <>
                                <div className="fs-14-px fw-700 c-b-2 t-t-ucp">Select System Permission</div>
                                <Select
                                    showSearch
                                    className="w-100-p m-t-s"
                                    placeholder="Search system permission..."
                                    optionFilterProp="label"
                                    onChange={fetchSystemPermissionData}
                                    value={selectedSystemPerm}
                                    options={systemPermissions.map(p => ({ value: p.name, label: p.label }))?.sort((a, b) => a.label.localeCompare(b.label))}
                                />
                                {selectedSystemPerm && (
                                    <div className="m-t-m p-a-m bg-c-wb-1 b-rad-9-px b-1-px b-c-b-5">
                                        <div className="fs-13-px fw-700 c-b-2 m-b-xs">
                                            {systemPermissions.find(p => p.name === selectedSystemPerm)?.label}
                                        </div>
                                        <div className="fs-11-px c-b-3 ff-mono">{selectedSystemPerm}</div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                <div className="m-b-m">
                                    <div className="fs-14-px fw-700 c-b-2 t-t-ucp">Select Object</div>
                                    <Select
                                        showSearch
                                        className="w-100-p m-t-s"
                                        placeholder="Search object..."
                                        optionFilterProp="label"
                                        value={selectedObjectForAnalysis}
                                        onChange={async (val) => {
                                            setSelectedObjectForAnalysis(val);
                                            setSelectedObjectPermsForAnalysis([]);
                                            setSelectedFieldsForAnalysis([]);
                                            setSelectedFieldPermsForAnalysis([]);
                                            setNeedsReEvaluation(true);
                                            setDataFetched(false);
                                            // Fetch describe for field list
                                            setFetchingFields(true);
                                            try {
                                                const res = await orgCallout(`/services/data/v${API_VERSION}/sobjects/${val}/describe`, 'GET', null, 'object_describe');
                                                const fields = res.fields?.filter(f => !f.compoundFieldName && f.type !== 'id' && f.permissionable)
                                                    .map(f => ({ value: f.name, label: f.label }))
                                                    .sort((a, b) => a.label.localeCompare(b.label));
                                                setObjectFieldsCache(prev => ({ ...prev, [val]: fields }));
                                            } catch (e) { } finally { setFetchingFields(false); }
                                        }}
                                        options={objects.map(o => ({ value: o.name, label: o.label }))}
                                        optionRender={(o) =>
                                            <>
                                                <div className="fs-14-px c-b-1">{o.label}</div>
                                                <div className="fs-11-px c-b-3">{o.value}</div>
                                            </>
                                        }
                                    />
                                </div>

                                <div className="m-b-m">
                                    <div className="d-f j-c-s-b a-i-c">
                                        <div className="fs-14-px fw-700 c-b-2 t-t-ucp">Object Permissions</div>
                                        <div className="d-f a-i-c g-s">
                                            <span className={`fs-10-px fw-700 ${objPermsLogic === 'OR' ? 'c-prim' : 'c-b-4'}`}>ANY</span>
                                            <Switch
                                                size="medium"
                                                checked={objPermsLogic === 'AND'}
                                                disabled={!selectedObjectForAnalysis || selectedObjectPermsForAnalysis.length <= 1}
                                                onChange={val => {
                                                    setObjPermsLogic(val ? 'AND' : 'OR');
                                                    setNeedsReEvaluation(true);
                                                }}
                                            />
                                            <span className={`fs-10-px fw-700 ${objPermsLogic === 'AND' ? 'c-prim' : 'c-b-4'}`}>ALL</span>
                                        </div>
                                    </div>
                                    <Select
                                        mode="multiple"
                                        className="w-100-p m-t-s"
                                        placeholder="Select object permissions..."
                                        disabled={!selectedObjectForAnalysis}
                                        value={selectedObjectPermsForAnalysis}
                                        onChange={(val) => {
                                            setSelectedObjectPermsForAnalysis(val);
                                            setNeedsReEvaluation(true);
                                        }}
                                        options={[
                                            { value: 'Read', label: 'Read' },
                                            { value: 'Create', label: 'Create' },
                                            { value: 'Edit', label: 'Edit' },
                                            { value: 'Delete', label: 'Delete' },
                                            { value: 'ViewAllRecords', label: 'View All Records' },
                                            { value: 'ModifyAllRecords', label: 'Modify All Records' },
                                            { value: 'ViewAllFields', label: 'View All Fields' }
                                        ]}
                                    />
                                </div>

                                <div className="m-b-m">
                                    <div className="d-f j-c-s-b a-i-c">
                                        <div className="fs-14-px fw-700 c-b-2 t-t-ucp">Select Fields</div>
                                    </div>
                                    <Select
                                        mode="multiple"
                                        showSearch
                                        className="w-100-p m-t-s"
                                        placeholder="Select fields..."
                                        optionFilterProp="label"
                                        disabled={!selectedObjectForAnalysis || fetchingFields}
                                        loading={fetchingFields}
                                        value={selectedFieldsForAnalysis}
                                        onChange={(val) => {
                                            setSelectedFieldsForAnalysis(val);
                                            setNeedsReEvaluation(true);
                                        }}
                                        options={selectedObjectForAnalysis ? objectFieldsCache[selectedObjectForAnalysis] || [] : []}
                                        optionRender={(o) =>
                                            <>
                                                <div className="fs-14-px c-b-1">{o.label}</div>
                                                <div className="fs-11-px c-b-3">{o.value}</div>
                                            </>
                                        }
                                    />
                                </div>

                                <div className="m-b-m">
                                    <div className="d-f j-c-s-b a-i-c">
                                        <div className="fs-14-px fw-700 c-b-2 t-t-ucp">Field Permissions</div>
                                        <div className="d-f a-i-c g-s">
                                            <span className={`fs-10-px fw-700 ${fieldPermsLogic === 'OR' ? 'c-prim' : 'c-b-4'}`}>ANY</span>
                                            <Switch
                                                size="medium"
                                                checked={fieldPermsLogic === 'AND'}
                                                disabled={!selectedObjectForAnalysis || selectedFieldPermsForAnalysis.length <= 1}
                                                onChange={val => {
                                                    setFieldPermsLogic(val ? 'AND' : 'OR');
                                                    setNeedsReEvaluation(true);
                                                }}
                                            />
                                            <span className={`fs-10-px fw-700 ${fieldPermsLogic === 'AND' ? 'c-prim' : 'c-b-4'}`}>ALL</span>
                                        </div>
                                    </div>
                                    <Select
                                        mode="multiple"
                                        className="w-100-p m-t-s"
                                        placeholder="Select field permissions..."
                                        maxCount={20}
                                        disabled={selectedFieldsForAnalysis.length === 0}
                                        value={selectedFieldPermsForAnalysis}
                                        onChange={(val) => {
                                            setSelectedFieldPermsForAnalysis(val);
                                            setNeedsReEvaluation(true);
                                        }}
                                        options={[
                                            { value: 'Read', label: 'Read' },
                                            { value: 'Edit', label: 'Edit' }
                                        ]}
                                    />
                                </div>

                                <div className="m-t-m">
                                    <div className="fs-12-px c-b-3 t-a-c p-a-s bg-c-wb-1 b-rad-6-px b-1-px b-c-b-5 dashed">
                                        Criteria changes will require re-evaluation from the results panel.
                                    </div>
                                </div>

                            </>
                        )}

                    </div>

                    {(analyzeMode === 'user' ? selectedUser : (analyzeMode === 'system' ? selectedSystemPerm : (selectedObjectForAnalysis && (selectedObjectPermsForAnalysis.length > 0 || selectedFieldsForAnalysis.length > 0)))) && (
                        <div className="f-g-1 m-t-m of-a border-t p-t-m">
                            <div className="fs-16-px fw-700 c-b-2 t-t-ucp d-f a-i-c g-s m-b-m">
                                <FilterOutlined /> Permission Sources
                            </div>
                            <div className="fs-11-px c-b-3 m-b-m">
                                {analyzeMode === 'user'
                                    ? "Select sources to filter permissions. If none are selected, combined effective permissions are displayed."
                                    : "Listed sources grant the selected " + (analyzeMode === 'system' ? "system permission." : "object/field access.")}
                            </div>

                            <div className="p-a-m bg-c-wb-1 b-rad-4-px b-1-px b-c-b-5">
                                {(() => {
                                    const sources = analyzeMode === 'user' ? userPermissions : systemPermSources;
                                    const profilesToRender = analyzeMode === 'user'
                                        ? (sources.profile ? [{ ...sources.profile, psId: sources.profile.PermissionSet?.Id }] : [])
                                        : sources.profiles ?? [];

                                    return (
                                        <>
                                            {profilesToRender.length > 0 && (
                                                <>
                                                    <div className="fs-14-px fw-700 p-a-m border-b p-t-0 d-f a-i-c g-m">
                                                        <SolutionOutlined />
                                                        PROFILES
                                                    </div>
                                                    {profilesToRender.map(p => (
                                                        <div
                                                            key={p.psId}
                                                            className={`source-toggle d-f a-i-c j-c-s-b p-a-s m-t-xs b-rad-4-px cur-pointer tran-a-l-2 ${selectedSources.includes(p.psId) ? 'active' : ''}`}
                                                            onClick={() => toggleSource(p.psId)}
                                                        >
                                                            <span className="fs-13-px c-b-1">{p.Name}</span>
                                                            <Tag color="gold" className="fs-10-px m-a-0">PRO</Tag>
                                                        </div>
                                                    ))}
                                                </>
                                            )}

                                            {sources.assignments?.length > 0 && (
                                                <>
                                                    <div className="fs-14-px fw-700 m-t-m p-a-m border-b d-f a-i-c g-m">
                                                        <ScheduleOutlined />
                                                        PERMISSION SETS
                                                    </div>
                                                    {sources.assignments.map(a => (
                                                        <div
                                                            key={a.PermissionSet.Id}
                                                            className={`source-toggle d-f a-i-c j-c-s-b p-a-s m-t-xs b-rad-4-px cur-pointer tran-a-l-2 ${selectedSources.includes(a.PermissionSet.Id) ? 'active' : ''}`}
                                                            onClick={() => toggleSource(a.PermissionSet.Id)}
                                                        >
                                                            <span className="fs-13-px c-b-1 t-o-e">{a.PermissionSet.Label}</span>
                                                            <Tag color="blue" className="fs-10-px m-a-0">PS</Tag>
                                                        </div>
                                                    ))}
                                                </>
                                            )}

                                            {sources.groups?.length > 0 && (
                                                <>
                                                    <div className="fs-14-px fw-700 m-t-m p-b-xs border-b d-f a-i-c g-m">
                                                        <ClusterOutlined />
                                                        PERMISSION SET GROUPS
                                                    </div>
                                                    {sources.groups.map(g => (
                                                        <div
                                                            key={g.Id}
                                                            className={`source-toggle d-f a-i-c j-c-s-b p-a-s m-t-xs b-rad-4-px cur-pointer tran-a-l-2 ${selectedSources.includes(g.Id) ? 'active' : ''}`}
                                                            onClick={() => toggleSource(g.Id)}
                                                        >
                                                            <div className="d-f a-i-c g-s of-h">
                                                                <span className="fs-13-px c-b-1 t-o-e">{g.Label}</span>
                                                                {g.MutingPSId && (
                                                                    <Tag color="volcano" className="fs-9-px m-a-0" style={{ padding: '0 4px', lineHeight: '14px' }}>MUTING</Tag>
                                                                )}
                                                            </div>
                                                            <Tag color="purple" className="fs-10-px m-a-0">PSG</Tag>
                                                        </div>
                                                    ))}
                                                </>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                    )}
                </aside>

                <section className="f-g-1 d-f f-d-c of-h p-a-1 bg-c-w p-t-0">
                    {errorCode && (
                        <div className="w-100-p h-100-p d-f f-d-c a-i-c j-c-c c-b-4">
                            <CloseCircleOutlined style={{ fontSize: 48, color: 'var(--dist-color)' }} />
                            <div className="fs-18-px m-t-m c-dist">{errorCodeMessages()[errorCode]}</div>
                        </div>
                    )}
                    {!errorCode && (
                        <>
                            {analyzeMode === 'user' ? (
                                !selectedUser ? (
                                    <div className="w-100-p h-100-p d-f f-d-c a-i-c j-c-c c-b-4">
                                        <UserOutlined style={{ fontSize: 80 }} />
                                        <div className="fs-18-px m-t-m">Select a user to analyze permissions</div>
                                    </div>
                                ) : (
                                    <Tabs defaultActiveKey="obj&Fields" className='h-100-p' onChange={handleTabChange}
                                        items={[
                                            {
                                                key: 'obj&Fields', label: 'Object & Field Permissions',
                                                children: <>
                                                    <div className="d-f f-d-c h-100-p">
                                                        <div className="m-b-m">
                                                            <h2 className="fs-18-px fw-600 m-a-0 c-b-1 m-b-m">Object & Field Permissions</h2>
                                                            <Search
                                                                placeholder="Search objects..."
                                                                className="w-100-p"
                                                                allowClear
                                                                onChange={e => setObjSearch(e.target.value)}
                                                            />
                                                        </div>

                                                        <div className="f-g-1 of-y-a s-bar-auto p-r-s m-t-s">
                                                            {filteredObjs.map(obj => (
                                                                <div key={obj.name} className="accordion-item m-b-m bg-c-w b-rad-4-px b-1-px b-c-b-5 of-h tran-a-l-2 shadow-s">
                                                                    <div
                                                                        className={`accordion-header d-f a-i-c j-c-s-b p-a-m cur-pointer tran-a-l-2 ${expandedObject === obj.name ? 'bg-c-prim-xxl' : ''}`}
                                                                        onClick={() => toggleObjectExpansion(obj)}
                                                                    >
                                                                        <div className="d-f a-i-c g-m">
                                                                            <CloudServerOutlined className={expandedObject === obj.name ? 'c-prim' : 'c-prim-m'} style={{ fontSize: 24 }} />
                                                                            <div className="of-h">
                                                                                <div className="fs-14-px fw-600 c-b-1 t-o-e">{obj.label}</div>
                                                                                <div className="fs-11-px c-b-3 ff-mono t-o-e">{obj.name}</div>
                                                                            </div>
                                                                        </div>
                                                                        {expandedObject === obj.name ? <UpOutlined className="c-prim" /> : <DownOutlined className="c-b-4" />}
                                                                    </div>

                                                                    {expandedObject === obj.name && (
                                                                        <div className="accordion-content p-a-m b-t-1-px b-c-b-5 bg-c-w">
                                                                            {fetchingDetail && !objectPermsCache[obj.name] ? (
                                                                                <div className="p-a-1 t-a-c"><Spin tip="Analyzing effective permissions..." /></div>
                                                                            ) : (
                                                                                <div className="animate-in">

                                                                                    <div className="d-f a-i-s j-c-s-b p-b-m border-b m-b-m">
                                                                                        <div className="d-f f-w g-m f-g-1">
                                                                                            {['Read', 'Create', 'Edit', 'Delete', '', 'ViewAllRecords', 'ModifyAllRecords', 'ViewAllFields'].map(p => {

                                                                                                if (!p) return <div className='w-100-p'></div>

                                                                                                const cached = objectPermsCache[obj.name];
                                                                                                if (!cached) return null;

                                                                                                const results = (cached.rawObjectResults[p] || []).filter(r => selectedSources.length === 0 || selectedSources.includes(r.id));
                                                                                                const isGranted = isMutualMode ? (results.length > 0 && results.every(r => r.grant)) : results.some(r => r.grant);
                                                                                                const grantSources = results.filter(r => r.grant || r.muted);

                                                                                                if (isMutualMode && !isGranted) return null;  // Hide non-mutual

                                                                                                let statusClass = 'inactive';
                                                                                                if (isGranted) statusClass = p.includes('All') ? 'active-blue' : 'active-green';

                                                                                                const badge = (
                                                                                                    <div key={p} className={`perm-badge p-bk-xs p-i-m b-rad-20-px fs-11-px fw-600 ${statusClass} cur-help d-f a-i-c j-c-c g-xs`}>
                                                                                                        {p.replace('AllRecords', ' All Records')?.replace('AllFields', ' All Fields')}
                                                                                                    </div>
                                                                                                );

                                                                                                const popoverContent = (
                                                                                                    <div className="fs-11-px" style={{ minWidth: 200 }}>
                                                                                                        {grantSources.map(r => (
                                                                                                            <div key={r.label} className="d-f g-m j-c-s-b p-bk-xs border-b-ghost">
                                                                                                                <span>{r.label}</span>
                                                                                                                <Tag color={r.grant ? 'green' : 'orange'} className="fs-9-px m-a-0">{r.grant ? 'GRANT' : 'MUTED'}</Tag>
                                                                                                            </div>
                                                                                                        ))}
                                                                                                    </div>
                                                                                                );

                                                                                                return (
                                                                                                    <Popover
                                                                                                        key={p}
                                                                                                        title={<span className="fs-12-px fw-700">Source Analysis: {p.replace('All', ' All')}</span>}
                                                                                                        content={popoverContent}
                                                                                                    >
                                                                                                        {badge}
                                                                                                    </Popover>
                                                                                                );
                                                                                            })}
                                                                                        </div>
                                                                                        <div className="d-f a-i-c g-s">
                                                                                            <span className="fs-12-px fw-600 c-b-3">MUTUAL</span>
                                                                                            <Switch
                                                                                                size="medium"
                                                                                                checked={isMutualMode}
                                                                                                onChange={setIsMutualMode}
                                                                                                disabled={!(selectedSources?.length > 1)}
                                                                                            />
                                                                                        </div>
                                                                                    </div>



                                                                                    <Divider className="m-bk-m fs-13-px c-b-3">FIELD LEVEL SECURITY</Divider>
                                                                                    <Search
                                                                                        placeholder="Filter fields..."
                                                                                        size="medium"
                                                                                        className="m-b-m w-100-p"
                                                                                        onChange={e => setFieldSearch(e.target.value)}
                                                                                    />

                                                                                    <div className="of-y-a s-bar-w-t" style={{ maxHeight: 400 }}>
                                                                                        <Table
                                                                                            loading={fetchingDetail}
                                                                                            size="small"
                                                                                            pagination={false}
                                                                                            dataSource={objectPermsCache[obj.name]?.rawFieldResults.map(f => {
                                                                                                const rFilt = f.rResults.filter(r => selectedSources.length === 0 || selectedSources.includes(r.id));
                                                                                                const eFilt = f.eResults.filter(e => selectedSources.length === 0 || selectedSources.includes(e.id));
                                                                                                const rGrant = isMutualMode ? (rFilt.length > 0 && rFilt.every(r => r.grant || r.muted)) : rFilt.some(r => r.grant || r.muted);
                                                                                                const eGrant = isMutualMode ? (eFilt.length > 0 && eFilt.every(e => e.grant || e.muted)) : eFilt.some(e => e.grant || e.muted);
                                                                                                return {
                                                                                                    ...f,
                                                                                                    Read: rGrant,
                                                                                                    Edit: eGrant,
                                                                                                    IsMutedRead: rFilt.some(r => r.muted),
                                                                                                    IsMutedEdit: eFilt.some(e => e.muted),
                                                                                                    rSources: rFilt.filter(r => r.grant || r.muted),
                                                                                                    eSources: eFilt.filter(e => e.grant || e.muted)
                                                                                                };
                                                                                            })
                                                                                                .filter(f => {
                                                                                                    return fieldSearch ? (f.name.toLowerCase().includes(fieldSearch.toLowerCase()) || f.label.toLowerCase().includes(fieldSearch.toLowerCase())) : true;
                                                                                                })
                                                                                                .sort((a, b) => a.label.localeCompare(b.label))}
                                                                                            rowKey="name"
                                                                                            columns={[
                                                                                                {
                                                                                                    title: 'Field Name', dataIndex: 'name', key: 'name', sorter: (a, b) => a.label.localeCompare(b.label),
                                                                                                    render: (v, record) => {
                                                                                                        return (
                                                                                                            <div className='text-ellipsis' title={record.name}>
                                                                                                                <span className="text-ellipsis">{record.label} ({record.name})</span>
                                                                                                            </div>
                                                                                                        );
                                                                                                    }
                                                                                                },
                                                                                                {
                                                                                                    title: 'Read', dataIndex: 'Read', key: 'Read', align: 'center',
                                                                                                    render: (v, record) => {
                                                                                                        if (isMutualMode && !v) return '-';
                                                                                                        const badge = (
                                                                                                            <Tag color={v ? 'green' : (record.IsMutedRead ? 'orange' : 'red')} className="fs-10-px b-rad-2-px cur-help">
                                                                                                                {v ? 'GRANT' : (record.IsMutedRead ? 'MUTED' : 'DENY')}
                                                                                                            </Tag>
                                                                                                        );
                                                                                                        return record.rSources?.length > 0 ? (
                                                                                                            <Popover
                                                                                                                content={
                                                                                                                    <div className="fs-11-px">{
                                                                                                                        record.rSources.map(s =>
                                                                                                                            <div className='d-f a-i-c j-c-s-b g-m m-b-s' key={s.label}>
                                                                                                                                {s.label}
                                                                                                                                <Tag color={s.muted ? 'orange' : 'green'} className="fs-10-px b-rad-2-px cur-help">
                                                                                                                                    {s.muted ? 'MUTED' : 'Granted'}
                                                                                                                                </Tag>
                                                                                                                            </div>
                                                                                                                        )}
                                                                                                                    </div>
                                                                                                                }
                                                                                                                title="Read Sources">
                                                                                                                {badge}
                                                                                                            </Popover>
                                                                                                        ) : badge;
                                                                                                    }
                                                                                                },
                                                                                                {
                                                                                                    title: 'Edit', dataIndex: 'Edit', key: 'Edit', align: 'center',
                                                                                                    render: (v, record) => {
                                                                                                        if (isMutualMode && !v) return '-';
                                                                                                        const badge = (
                                                                                                            <Tag color={v ? 'green' : (record.IsMutedEdit ? 'orange' : 'red')} className="fs-10-px b-rad-2-px cur-help">
                                                                                                                {v ? 'GRANT' : (record.IsMutedEdit ? 'MUTED' : 'DENY')}
                                                                                                            </Tag>
                                                                                                        );
                                                                                                        return record.eSources?.length > 0 ? (
                                                                                                            <Popover content={
                                                                                                                <div className="fs-11-px">
                                                                                                                    {record.eSources.map(s =>
                                                                                                                        <div className='d-f a-i-c j-c-s-b g-m m-b-s' key={s.label}>
                                                                                                                            {s.label}
                                                                                                                            <Tag color={s.muted ? 'orange' : 'green'} className='fs-10-px b-rad-2-px cur-help'>
                                                                                                                                {s.muted ? 'MUTED' : 'GRANT'}
                                                                                                                            </Tag>
                                                                                                                        </div>
                                                                                                                    )}
                                                                                                                </div>}
                                                                                                                title="Edit Sources"
                                                                                                            >
                                                                                                                {badge}
                                                                                                            </Popover>
                                                                                                        ) : badge;
                                                                                                    }
                                                                                                },
                                                                                            ]}
                                                                                        />
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                            {filteredObjs.length === 0 && <div className="t-a-c p-a-1 c-b-4">No objects found matching your search.</div>}
                                                        </div>
                                                    </div>
                                                </>
                                            },
                                            {
                                                key: 'systemPermission', label: 'System Permissions',
                                                children: <>
                                                    <div className="d-f f-d-c h-100-p">
                                                        <div className="m-b-m">
                                                            <div className="d-f j-c-s-b a-i-c m-b-m">
                                                                <h2 className="fs-18-px fw-600 m-a-0 c-b-1">System Permissions</h2>
                                                                <div className="d-f a-i-c g-s">
                                                                    <span className="fs-12-px fw-600 c-b-3">MUTUAL</span>
                                                                    <Switch
                                                                        size="medium"
                                                                        checked={isMutualMode}
                                                                        onChange={setIsMutualMode}
                                                                        disabled={!(selectedSources?.length > 1)}
                                                                    />
                                                                </div>
                                                            </div>
                                                            <Search
                                                                placeholder="Search system permissions..."
                                                                className="w-100-p"
                                                                allowClear
                                                                onChange={e => setFieldSearch(e.target.value)}
                                                            />
                                                        </div>

                                                        {Object.keys(userSystemPermissions).length === 0 ? (
                                                            <div className="p-a-1 t-a-c"><Spin tip="Analyzing effective permissions..." /></div>
                                                        ) : (
                                                            <div className="f-g-1 of-y-a s-bar-auto p-r-s m-t-s">
                                                                <Table
                                                                    dataSource={systemPermissions
                                                                        .sort((a, b) => a.label.localeCompare(b.label))
                                                                        .filter(p => !fieldSearch || p.label.toLowerCase().includes(fieldSearch.toLowerCase()) || p.name.toLowerCase().includes(fieldSearch.toLowerCase()))
                                                                        .map(p => {
                                                                            const results = Object.values(userSystemPermissions).filter(r => selectedSources.length === 0 || selectedSources.includes(r.id));
                                                                            const func = isMutualMode ? 'every' : 'some'
                                                                            const isGranted = results[func](r => r.granted?.includes(p.name));
                                                                            const grantSources = results.filter(r => r.granted?.includes(p.name));
                                                                            const mutedSource = results.find(r => r.id === r.MutingPSId?.PermissionSetId);
                                                                            mutedSource && console.log('mutedSource : ', mutedSource);
                                                                            const isMuted = mutedSource?.granted?.includes(p.name);
                                                                            return { ...p, isGranted, isMuted, grantSources };
                                                                        })
                                                                        .filter(p => isMutualMode ? p.isGranted : true)
                                                                    }
                                                                    rowKey="name"
                                                                    pagination={false}
                                                                    size="small"
                                                                    columns={[
                                                                        {
                                                                            title: 'Permission Name',
                                                                            key: 'label',
                                                                            render: (r) => (
                                                                                <div>
                                                                                    <div className="fs-13-px fw-600 c-b-1">{r.label}</div>
                                                                                    <div className="fs-10-px c-b-3 ff-mono">{r.name}</div>
                                                                                </div>
                                                                            )
                                                                        },
                                                                        {
                                                                            title: 'Status',
                                                                            key: 'status',
                                                                            width: 120,
                                                                            render: (r) => {
                                                                                const badge = (
                                                                                    <Tag color={r.isGranted ? 'green' : 'red'} className="fs-11-px fw-600 m-a-0 b-rad-20-px p-i-m">
                                                                                        {r.isGranted ? 'GRANT' : 'DENY'}
                                                                                    </Tag>
                                                                                );

                                                                                if (r.grantSources.length === 0) return badge;

                                                                                return (
                                                                                    <Popover
                                                                                        title={<span className="fs-12-px fw-700">Source Analysis</span>}
                                                                                        content={
                                                                                            <div className="fs-11-px" style={{ minWidth: 200 }}>
                                                                                                {r.grantSources.map(s => (
                                                                                                    <div key={s.label} className="d-f g-m j-c-s-b p-bk-xs border-b-ghost">
                                                                                                        <span>{s.label}</span>
                                                                                                        {/* <Tag color={s.isGranted ? 'green' : 'orange'} className="fs-9-px m-a-0">{s.isGranted ? 'GRANT' : 'MUTED'}</Tag> */}
                                                                                                        <Tag color={'green'} className="fs-9-px m-a-0">{'GRANT'}</Tag>
                                                                                                    </div>
                                                                                                ))}
                                                                                            </div>
                                                                                        }
                                                                                    >
                                                                                        <div className="cur-help d-i-b">{badge}</div>
                                                                                    </Popover>
                                                                                );
                                                                            }
                                                                        }
                                                                    ]}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                </>
                                            },
                                            {
                                                key: 'setupEntity', label: 'Setup Entity Access',
                                                children: (
                                                    <div className="apps-tab animate-in h-100-p of-y-a s-bar-auto">
                                                        {fetchingSetupEntities ? (
                                                            <div className="t-a-c p-a-xl"><Spin tip="Fetching setup entity access..." /></div>
                                                        ) : (
                                                            <div className="d-f f-d-c g-m">
                                                                {Object.keys(setupEntityCache).length === 0 ? (
                                                                    <div className="t-a-c p-a-xl c-b-4">No setup entity permissions found for the current selection.</div>
                                                                ) : (
                                                                    Object.keys(setupEntityCache).sort().map(cat => (
                                                                        <div key={cat} className="accordion-item m-b-m bg-c-w b-rad-4-px b-1-px b-c-b-5 of-h shadow-s">
                                                                            <div className="accordion-header d-f a-i-c j-c-s-b p-a-m bg-c-prim-xxl">
                                                                                <div className="d-f a-i-c g-m">
                                                                                    <SafetyCertificateOutlined className="c-prim" style={{ fontSize: 20 }} />
                                                                                    <span className="fs-14-px fw-700 c-b-1">{cat}</span>
                                                                                </div>
                                                                                <Tag color="blue" className="fs-11-px m-a-0">{setupEntityCache[cat].count}</Tag>
                                                                            </div>
                                                                            <div className="accordion-content p-a-m bg-c-w b-t-1-px b-c-b-5">
                                                                                <div className="d-f f-w-w g-s">
                                                                                    {Object.values(setupEntityCache[cat].entities).map(entity => (
                                                                                        <Popover
                                                                                            key={entity.id}
                                                                                            title="Access Sources"
                                                                                            content={
                                                                                                <div className="fs-11-px">
                                                                                                    {entity.sources.map((s, idx) => (
                                                                                                        <div key={idx} className="p-bk-xs border-b-ghost">{s}</div>
                                                                                                    ))}
                                                                                                </div>
                                                                                            }
                                                                                        >
                                                                                            <Tag color="default" className="cur-help fs-11-px m-a-0 p-i-s p-bk-xs b-rad-4-px border-ghost">
                                                                                                {entity.id}
                                                                                            </Tag>
                                                                                        </Popover>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    ))
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            }
                                        ]}
                                    />
                                )
                            ) : (
                                analyzeMode === 'system' ? (
                                    !selectedSystemPerm ? (
                                        <div className="w-100-p h-100-p d-f f-d-c a-i-c j-c-c c-b-4">
                                            <SafetyCertificateOutlined style={{ fontSize: 80 }} />
                                            <div className="fs-18-px m-t-m">Select a system permission to analyze</div>
                                        </div>
                                    ) : (
                                        <div className="h-100-p d-f f-d-c animate-in p-t-m">
                                            <div className="d-f a-i-c j-c-s-b m-b-m">
                                                <h2 className="fs-18-px fw-600 m-a-0 c-b-1">Granted Users ({filteredSystemUsers.length})</h2>
                                                <Tag color="blue" className="fs-12-px">{systemPermissions.find(p => p.name === selectedSystemPerm)?.label}</Tag>
                                            </div>
                                            <div className="f-g-1 of-y-a s-bar-auto p-r-s">
                                                <Table
                                                    loading={fetchingSystemUsers}
                                                    dataSource={filteredSystemUsers}
                                                    rowKey="Id"
                                                    pagination={false}
                                                    columns={[
                                                        { title: 'Name', dataIndex: 'Name', key: 'Name', sorter: (a, b) => a.Name.localeCompare(b.Name) },
                                                        { title: 'Username', dataIndex: 'Username', key: 'Username', sorter: (a, b) => a.Username.localeCompare(b.Username) },
                                                        { title: 'Profile', dataIndex: 'ProfileName', key: 'ProfileName', sorter: (a, b) => a.ProfileName.localeCompare(b.ProfileName) },
                                                        { title: 'Role', dataIndex: 'RoleName', key: 'RoleName', sorter: (a, b) => (a.RoleName || '').localeCompare(b.RoleName || '') }
                                                    ]}
                                                />
                                            </div>
                                        </div>
                                    )
                                ) : (
                                    !selectedObjectForAnalysis || (selectedObjectPermsForAnalysis.length === 0 && selectedFieldsForAnalysis.length === 0) ? (
                                        <div className="w-100-p h-100-p d-f f-d-c a-i-c j-c-c c-b-4">
                                            <CloudServerOutlined style={{ fontSize: 80 }} />
                                            <div className="fs-18-px m-t-m">Select an object and criteria to analyze</div>
                                        </div>
                                    ) : !dataFetched ? (
                                        <div className="w-100-p h-100-p d-f f-d-c a-i-c j-c-c">
                                            <div className="p-a-xl b-rad-16-px d-f f-d-c a-i-c g-l animate-in zoom-in p-a-m">
                                                <div className="p-a-m bg-c-prim-xxl b-rad-50-p">
                                                    <RocketOutlined style={{ fontSize: 60, color: 'var(--c-prim)' }} />
                                                </div>
                                                <div className="t-a-c">
                                                    <h3 className="fs-24-px fw-700 c-b-1 m-b-s">Ready to Analyze?</h3>
                                                    <p className="fs-14-px c-b-3 m-b-xl">
                                                        Analyze access for <strong>{`${objects.find(o => o.name === selectedObjectForAnalysis)?.label} (${selectedObjectForAnalysis})`}</strong> based on your selected criteria.
                                                    </p>
                                                </div>
                                                <button
                                                    className="prime-button animate-pulse p-i-xl fs-14-px fw-700"
                                                    style={{ height: 32, borderRadius: 16 }}
                                                    disabled={fetchingSystemUsers}
                                                    onClick={() => fetchObjectAccessData(selectedObjectForAnalysis, selectedObjectPermsForAnalysis, selectedFieldsForAnalysis, selectedFieldPermsForAnalysis)}
                                                >
                                                    {fetchingSystemUsers ? <Spin size="large" /> : <><SearchOutlined /> START ANALYSIS</>}
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="h-100-p d-f f-d-c animate-in p-t-m">
                                            <div className="m-b-m p-b-m b-b-1-px b-c-b-5">
                                                <div className="d-f a-i-f j-c-s-b m-b-m">
                                                    <div className="d-f f-d-c">
                                                        <div className="fs-12-px c-b-3 fw-600 t-t-ucp">Analysis Scope for</div>
                                                        <h2 className="fs-24-px fw-800 m-a-0 c-prim d-f a-i-c g-s">
                                                            {objects.find(ele => ele.name === selectedObjectForAnalysis)?.label}
                                                            <span className="fs-14-px fw-600 c-b-3 m-l-s">({filteredSystemUsers.length} Users found)</span>
                                                        </h2>
                                                        {selectedObjectPermsForAnalysis.length > 0 && <div className="d-f f-w-w g-s m-t-xs">
                                                            {selectedObjectPermsForAnalysis.map(p => (
                                                                <Tag key={p} color="blue" className="fs-11-px m-a-0 border-none bg-c-prim-xl c-prim fw-600">{p}</Tag>
                                                            ))}
                                                            <Tag color="default" className="fs-10-px m-a-0 fw-700 m-l-a">{objPermsLogic == 'OR' ? 'ANY' : 'ALL'}</Tag>
                                                        </div>}
                                                    </div>
                                                </div>

                                                {selectedFieldsForAnalysis.length > 0 && (
                                                    <div className="m-t-s p-a-s bg-c-wb-1 b-rad-6-px b-1-px b-c-b-5 dashed w-100-p animate-in fade-in">
                                                        <div className="d-f a-i-c g-s m-b-s">
                                                            <div className="fs-11-px fw-700 c-b-3 t-t-ucp m-r-s">Fields ({selectedFieldsForAnalysis.length}):</div>
                                                            <div className="d-f f-w-w g-s">
                                                                <div className="fs-12-px c-b-3 t-o-e" style={{ maxWidth: 400 }}>
                                                                    {selectedFieldsForAnalysis.join(', ')}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="d-f a-i-c g-s">
                                                            <Tag color="grey" className="fs-11-px m-a-0 border-none bg-c-cyan-xl c-cyan p-i-m fw-600">
                                                                <CheckCircleOutlined /> Field Permissions: {selectedFieldPermsForAnalysis.join(` ${fieldPermsLogic} `) || 'N/A'}
                                                            </Tag>
                                                        </div>
                                                    </div>
                                                )}

                                                {needsReEvaluation && (
                                                    <div className="min-w-100-p d-f a-i-c j-c-e g-m m-bk-m">
                                                        <button
                                                            className="prime-button animate-in slide-in-right p-i-m"
                                                            onClick={() => fetchObjectAccessData(selectedObjectForAnalysis, selectedObjectPermsForAnalysis, selectedFieldsForAnalysis, selectedFieldPermsForAnalysis, objPermsLogic, fieldPermsLogic)}
                                                            disabled={fetchingSystemUsers}
                                                        >
                                                            {fetchingSystemUsers ? <Spin size="small" /> : <><ReloadOutlined /> RE-EVALUATE</>}
                                                        </button>
                                                    </div>
                                                )}

                                            </div>
                                            <div className="f-g-1 of-y-a s-bar-auto p-r-s">
                                                <Table
                                                    loading={fetchingSystemUsers}
                                                    dataSource={filteredSystemUsers}
                                                    rowKey="Id"
                                                    pagination={false}
                                                    columns={[
                                                        { title: 'Name', dataIndex: 'Name', key: 'Name', sorter: (a, b) => a.Name.localeCompare(b.Name) },
                                                        { title: 'Username', dataIndex: 'Username', key: 'Username', sorter: (a, b) => a.Username.localeCompare(b.Username) },
                                                        { title: 'Profile', dataIndex: 'ProfileName', key: 'ProfileName', sorter: (a, b) => a.ProfileName.localeCompare(b.ProfileName) },
                                                        { title: 'Role', dataIndex: 'RoleName', key: 'RoleName', sorter: (a, b) => (a.RoleName || '').localeCompare(b.RoleName || '') }
                                                    ]}
                                                />
                                            </div>
                                        </div>
                                    )
                                )
                            )}
                        </>
                    )}
                </section>
            </main>
        </div >
    );
}


// End of PermissionAnalyzer component



const errorCodeMessages = () => {
    return {
        'INVALID_SESSION_ID': 'Session has been expired !!!',
        'INVALID_TYPE': `It seems like you don't have access to the developer console! Ask your system administration for the permission`,
        'API_CURRENTLY_DISABLED': 'API Disabled for the current User!!!',
        'NO_INTERNET': 'No Internet Connection !!!',
    }
}