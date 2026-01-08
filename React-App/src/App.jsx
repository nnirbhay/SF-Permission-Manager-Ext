
import { useState, useEffect, useMemo } from 'react';
import { Select, Spin, Tag, message, Input, Popover, Avatar, Divider, Table, Switch } from 'antd';
import { UserOutlined, SafetyCertificateOutlined, CloudServerOutlined, CopyOutlined, CloudOutlined, FilterOutlined, DownOutlined, UpOutlined, ReloadOutlined, ExclamationCircleOutlined, SolutionOutlined, ScheduleOutlined, ClusterOutlined } from '@ant-design/icons';
import '../../src/utilities/prototypes/prototypes.js';
import './App.css';

const { Search } = Input;
const API_VERSION = '65.0';

let orgDomain;
let sessionId;

function App() {
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [orgInfo, setOrgInfo] = useState(null);
    const [objects, setObjects] = useState([]);
    const [userPermissions, setUserPermissions] = useState({ profile: null, assignments: [], groups: [] });
    const [selectedSources, setSelectedSources] = useState([]);
    const [expandedObject, setExpandedObject] = useState(null);
    const [objectPermsCache, setObjectPermsCache] = useState({});
    const [fetchingDetail, setFetchingDetail] = useState(false);
    const [objSearch, setObjSearch] = useState('');
    const [fieldSearch, setFieldSearch] = useState('');
    const [lastEvaluatedSources, setLastEvaluatedSources] = useState([]);
    const [needsReEvaluation, setNeedsReEvaluation] = useState(false);
    const [noPermissions, setNoPermissions] = useState(false);
    const [isMutualMode, setIsMutualMode] = useState(false);

    useEffect(() => {
        if (expandedObject) {
            const currentSources = [...selectedSources].sort().join(',');
            const lastSources = [...lastEvaluatedSources].sort().join(',');
            setNeedsReEvaluation(currentSources !== lastSources);
        } else {
            setNeedsReEvaluation(false);
        }
    }, [selectedSources, expandedObject, lastEvaluatedSources]);

    useEffect(() => {
        const init = async () => {
            try {
                const urlParams = new URLSearchParams(window.location.search);
                orgDomain = urlParams.get('domain');

                sessionId = await chrome.runtime.sendMessage({ message: "get_sid", sfHost: orgDomain });
                if (!sessionId) {
                    message.error('Session expired or not found. Please refresh the Salesforce tab.');
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

    const orgCallout = async (url, method = 'GET', body = null) => {
        const response = await fetch(`${orgDomain}${url}`, {
            method,
            headers: { 'Authorization': `Bearer ${sessionId}`, 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : null
        });
        console.log('orgCallout : ', url);
        if (!response.ok) throw new Error(`API error: ${response.statusText}`);
        return await response.json();
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
                    }
                ]
            };

            const res = await orgCallout(`/services/data/v${API_VERSION}/composite`, 'POST', compositeRequest);
            const userResults = res.compositeResponse.find(r => r.referenceId === 'User').body;
            const orgResults = res.compositeResponse.find(r => r.referenceId === 'Organization').body;
            const sobjResults = res.compositeResponse.find(r => r.referenceId === 'SObjects').body;

            setUsers(userResults.records);
            setOrgInfo(orgResults.records[0]);

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
        setSelectedSources([]);
        setExpandedObject(null);
        setObjectPermsCache({});

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
                        method: "GET", referenceId: "PSGComponents",
                        url: `/services/data/v${API_VERSION}/query?q=${encodeURIComponent(`SELECT Id, PermissionSetId, PermissionSetGroupId FROM PermissionSetGroupComponent WHERE PermissionSetGroupId IN (SELECT PermissionSetGroupId FROM PermissionSetAssignment WHERE AssigneeId = '${userId}')`)}`
                    }
                ]
            };

            const resComp = await orgCallout(`/services/data/v${API_VERSION}/composite`, 'POST', compositeRequest);
            const assignmentRes = resComp.compositeResponse.find(r => r.referenceId === 'Assignments').body;
            const PSGComponentsRes = resComp.compositeResponse.find(r => r.referenceId === 'PSGComponents').body;

            const profileAssignemnt = assignmentRes?.records?.find(r => r.PermissionSet.IsOwnedByProfile) ?? {};
            const profile = { ...profileAssignemnt.PermissionSet.Profile, PermissionSet: profileAssignemnt.PermissionSet };

            const assignments = assignmentRes.records.filter(r => !r.PermissionSet.IsOwnedByProfile && !r.PermissionSetGroup);
            const groupsMap = {};

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
            });

            setUserPermissions({ profile, assignments, groups: Object.values(groupsMap) });
        } catch (err) {
            console.error(err);
            message.error('Error fetching user permissions.');
        }
    };

    const toggleSource = (id) => {
        setSelectedSources(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
        // Note: We no longer clear the cache here automatically if we want the "Re-evaluate" button flow.
        // However, the user selection logic says "If user is selected... show re-evaluate".
    };

    const getTargetParentIds = () => {
        const groupsConfig = []; // [{psIds: [], muteId: null}]
        const standaloneIds = [];
        const profileId = userPermissions.profile?.PermissionSet?.Id;

        if (selectedSources.length === 0) {
            // Apply all
            if (profileId) standaloneIds.push(profileId);
            userPermissions.assignments.forEach(a => standaloneIds.push(a.PermissionSet.Id));
            userPermissions.groups.forEach(g => groupsConfig.push({ psIds: g.PSIds, muteId: g.MutingPSId }));
        } else {
            selectedSources.forEach(sid => {
                const group = userPermissions.groups.find(g => g.Id === sid);
                if (group) {
                    groupsConfig.push({ psIds: group.PSIds, muteId: group.MutingPSId });
                } else if (sid === profileId) {
                    standaloneIds.push(profileId);
                } else {
                    standaloneIds.push(sid);
                }
            });
        }
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

            const [objRes, fieldRes, describeRes] = await Promise.all([
                orgCallout(`/services/data/v${API_VERSION}/query?q=${encodeURIComponent(objQuery)}`),
                orgCallout(`/services/data/v${API_VERSION}/query?q=${encodeURIComponent(fieldQuery)}`),
                orgCallout(`/services/data/v${API_VERSION}/sobjects/${object.name}/describe`)
            ]);

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
                    resultsPerSource.push({ label: sourceLabels[id] || 'Unknown', grant: granted, muted: false });
                });

                groupsConfig.forEach(config => {
                    const groupResult = getEffectiveForGroup(config, p);
                    const groupRef = userPermissions.groups.find(g => g.MutingPSId === config.muteId || (config.psIds.includes(g.PSIds[0])));
                    resultsPerSource.push({ label: groupRef?.Label ? `PSG: ${groupRef.Label}` : 'Permission Set Group', ...groupResult });
                });
                rawObjectResults[p] = resultsPerSource;
            });

            const sourceBreakdown = {};
            Object.keys(rawObjectResults).forEach(p => {
                sourceBreakdown[p] = rawObjectResults[p].filter(r => r.grant).map(r => r.label);
            });

            console.log('describeRes : ', describeRes);

            const rawFieldResults = describeRes.fields?.filter(f => !f.compoundFieldName && f.type !== 'id')?.map(f => {
                const rResults = [];
                const eResults = [];
                standaloneIds.forEach(id => {
                    const fRec = fieldMapRaw[id]?.[f.name];
                    rResults.push({ label: sourceLabels[id], grant: f.permissionable ? !!fRec?.PermissionsRead : true, muted: false });
                    eResults.push({ label: sourceLabels[id], grant: f.permissionable ? !!fRec?.PermissionsEdit : f.updateable, muted: false });
                });
                groupsConfig.forEach(config => {
                    const groupRef = userPermissions.groups.find(g => g.MutingPSId === config.muteId || (config.psIds.includes(g.PSIds[0])));
                    const label = groupRef ? `PSG: ${groupRef.Label}` : 'PSG';
                    rResults.push({ label, ...getEffectiveForGroup(config, 'Read', true, name) });
                    eResults.push({ label, ...getEffectiveForGroup(config, 'Edit', true, name) });
                });
                return { name: f.name, label: f.label, rResults, eResults };
            });

            setObjectPermsCache(prev => ({
                ...prev,
                [object.name]: {
                    rawObjectResults,
                    rawFieldResults,
                    sourceBreakdown
                }
            }));
            setLastEvaluatedSources([...selectedSources]);
            setNeedsReEvaluation(false);
        } catch (err) {
            message.error('Error fetching object permissions.');
            console.log('err : ', err.stack);

        } finally {
            setFetchingDetail(false);
        }
    };

    const handleReEvaluate = () => {
        if (expandedObject) {
            const obj = objects.find(o => o.name === expandedObject);
            if (obj) {
                fetchObjectPermissions(obj, true);
            }
        }
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

    if (loading) return <div className="loading-container w-100-p h-100-vh d-f a-i-c j-c-c"><Spin size="large" tip="Loading Salesforce Data..." /></div>;

    return (
        <div className="main-app d-f f-d-c h-100-vh of-h c-b-1">
            <header className="app-header d-f a-i-c j-c-s-b p-i-1l p-bk-l">
                <div className="d-f a-i-c g-m">
                    <SafetyCertificateOutlined className="fs-24-px c-prim" />
                    <h1 className="fs-18-px c-w m-a-0 fw-600">Salesforce Permission Assistance</h1>
                </div>
                <div className="d-f a-i-c g-1">
                    {orgInfo && <div className="bg-c-prim-xl p-bk-xs p-i-s b-rad-4-px fs-12-px c-prim fw-600">{orgInfo.Name}</div>}
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
                <aside className="left-panel d-f f-d-c of-y-a p-a-1 bg-c-w b-r-1-px b-c-b-5" style={{ width: 340 }}>
                    <div className="p-b-m">
                        <div className="fs-14-px fw-700 c-b-2 t-t-ucp">Select Salesforce User</div>
                        <Select
                            showSearch
                            className="w-100-p m-t-s"
                            placeholder="Type name to search..."
                            optionFilterProp="label"
                            onChange={handleUserSelect}
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
                    </div>

                    {selectedUser && (
                        <div className="f-g-1 m-t-m of-a">
                            <div className="fs-16-px fw-700 c-b-2 t-t-ucp d-f a-i-c g-s m-b-m">
                                <FilterOutlined /> Permission Sources
                            </div>
                            <div className="fs-11-px c-b-3 m-b-m">
                                Select sources to filter permissions. If none are selected, <b>combined effective permissions</b> are displayed.
                            </div>
                            {!noPermissions ? (
                                <div className="p-a-m bg-c-wb-1 b-rad-4-px b-1-px b-c-b-5">
                                    {userPermissions.profile?.Id && (
                                        <>
                                            <div className="fs-14-px fw-700 p-a-m border-b p-t-0 d-f a-i-c g-m">
                                                <SolutionOutlined />
                                                PROFILE
                                            </div>
                                            <div
                                                className={`source-toggle d-f a-i-c j-c-s-b p-a-s m-t-xs b-rad-4-px cur-pointer tran-a-l-2 ${selectedSources.includes(userPermissions.profile?.PermissionSet?.Id) ? 'active' : ''}`}
                                                onClick={() => toggleSource(userPermissions.profile?.PermissionSet?.Id)}
                                            >
                                                <span className="fs-13-px c-b-1">{userPermissions.profile?.Name}</span>
                                                <Tag color="gold" className="fs-10-px m-a-0">PRO</Tag>
                                            </div>
                                        </>
                                    )}

                                    {userPermissions.assignments.length > 0 && (
                                        <>
                                            <div className="fs-14-px fw-700 m-t-m p-a-m border-b d-f a-i-c g-m">
                                                <ScheduleOutlined />
                                                PERMISSION SETS
                                            </div>
                                            {userPermissions.assignments.map(a => (
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

                                    {userPermissions.groups.length > 0 && (
                                        <>
                                            <div className="fs-14-px fw-700 m-t-m p-b-xs border-b d-f a-i-c g-m">
                                                <ClusterOutlined />
                                                PERMISSION SET GROUPS
                                            </div>
                                            {userPermissions.groups.map(g => (
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
                                </div>
                            ) : (
                                <div className="p-a-m bg-c-wb-1 b-rad-4-px b-1-px b-c-b-5 d-f f-d-c a-i-c">
                                    <ExclamationCircleOutlined style={{ fontSize: 24, fill: '#9CA3AF' }} />
                                    <div className="fs-13-px m-t-m c-b-3">No permissions found for the selected user.</div>
                                </div>
                            )}

                        </div>
                    )}
                </aside>

                <section className="f-g-1 d-f f-d-c of-h p-a-1 bg-c-w">
                    {!selectedUser ? (
                        <div className="w-100-p h-100-p d-f f-d-c a-i-c j-c-c c-b-4">
                            <UserOutlined style={{ fontSize: 80 }} />
                            <div className="fs-18-px m-t-m">Select a user to analyze permissions</div>
                        </div>
                    ) : (
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

                                                                    const results = cached.rawObjectResults[p] || [];
                                                                    const isGranted = isMutualMode ? (results.length > 0 && results.every(r => r.grant)) : results.some(r => r.grant);
                                                                    const grantSources = results.filter(r => r.grant || r.muted);

                                                                    if (isMutualMode && !isGranted) return null; // Hide non-mutual

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
                                                                    disabled={selectedSources?.length == 1}
                                                                />
                                                            </div>
                                                        </div>

                                                        {needsReEvaluation && (
                                                            <div className="p-a-m m-b-m bg-c-prim-xxl b-rad-4-px d-f a-i-c j-c-s-b animate-in">
                                                                <span className="fs-12-px c-prim fw-600">Filters changed. Update to see new permissions.</span>
                                                                <button className="prime-button d-f a-i-c g-s" onClick={handleReEvaluate} style={{ padding: '2px 10px' }}>
                                                                    <ReloadOutlined />
                                                                    RE-EVALUATE
                                                                </button>
                                                            </div>
                                                        )}

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
                                                                    const rGrant = isMutualMode ? (f.rResults.length > 0 && f.rResults.every(r => r.grant || r.muted)) : f.rResults.some(r => r.grant || r.muted);
                                                                    const eGrant = isMutualMode ? (f.eResults.length > 0 && f.eResults.every(e => e.grant || e.muted)) : f.eResults.some(e => e.grant || e.muted);
                                                                    return {
                                                                        ...f,
                                                                        Read: rGrant,
                                                                        Edit: eGrant,
                                                                        IsMutedRead: f.rResults.some(r => r.muted),
                                                                        IsMutedEdit: f.eResults.some(e => e.muted),
                                                                        rSources: f.rResults.filter(r => r.grant || r.muted),
                                                                        eSources: f.eResults.filter(e => e.grant || e.muted)
                                                                    };
                                                                }).filter(f => {
                                                                    return f.name.toLowerCase().includes(fieldSearch.toLowerCase());
                                                                })}
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
                    )}
                </section>
            </main>
        </div>
    );
}

export default App;
