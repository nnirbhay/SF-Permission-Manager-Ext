
import { useState, useEffect, useMemo } from 'react';
import { Select, Spin, Tag, message, Input, Popover, Avatar, Divider, Table } from 'antd';
import { UserOutlined, SafetyCertificateOutlined, CloudServerOutlined, CopyOutlined, CloudOutlined, FilterOutlined, DownOutlined, UpOutlined, ReloadOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import '../../src/utilities/prototypes/prototypes.js';
import './App.css';

const { Search } = Input;
const API_VERSION = '60.0';

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
            const query = `SELECT PermissionSet.Id, PermissionSet.Name, PermissionSet.Label, PermissionSet.IsOwnedByProfile, PermissionSet.Profile.Id, PermissionSet.Profile.Name, PermissionSetGroup.Id, PermissionSetGroup.MasterLabel FROM PermissionSetAssignment WHERE AssigneeId = '${userId}'`;
            const res = await orgCallout(`/services/data/v${API_VERSION}/query?q=${encodeURIComponent(query)}`);
            if (!res?.records?.length) {
                message.warning('No permissions found for the selected user.');
                setNoPermissions(true);
                return;
            }

            setNoPermissions(false);
            const profileAssignemnt = res?.records?.find(r => r.PermissionSet.IsOwnedByProfile) ?? {};
            const profile = { ...profileAssignemnt.PermissionSet.Profile, PermissionSet: profileAssignemnt.PermissionSet };
            console.log('profile : ', profile);

            const assignments = res.records.filter(r => !r.PermissionSet.IsOwnedByProfile && !r.PermissionSetGroup);
            const groupsMap = {};
            res.records.forEach(r => {
                if (r.PermissionSetGroup) {
                    if (!groupsMap[r.PermissionSetGroup.Id]) {
                        groupsMap[r.PermissionSetGroup.Id] = {
                            Id: r.PermissionSetGroup.Id,
                            Label: r.PermissionSetGroup.MasterLabel,
                            PSIds: []
                        };
                    }
                    groupsMap[r.PermissionSetGroup.Id].PSIds.push(r.PermissionSet.Id);
                }
            });

            setUserPermissions({ profile, assignments, groups: Object.values(groupsMap) });
        } catch (err) {
            message.error('Error fetching user permissions.');
        }
    };

    const toggleSource = (id) => {
        setSelectedSources(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
        // Note: We no longer clear the cache here automatically if we want the "Re-evaluate" button flow.
        // However, the user selection logic says "If user is selected... show re-evaluate".
    };

    const getTargetParentIds = () => {
        if (selectedSources.length === 0) {
            // collect all premission set ids
            const ids = userPermissions.assignments.map(a => a.PermissionSet.Id);
            return [...new Set(ids)];
        };

        const ids = [];
        selectedSources.forEach(sid => {
            const group = userPermissions.groups.find(g => g.Id === sid);
            if (group) {
                ids.push(...group.PSIds);
            } else {
                ids.push(sid);
            }
        });
        return [...new Set(ids)];
    };

    const fetchObjectPermissions = async (object) => {
        if (objectPermsCache[object.name]) return;

        setFetchingDetail(true);
        try {
            const parentIds = getTargetParentIds();
            const psIdsStr = parentIds?.map(id => `'${id}'`).join(',') ?? null;
            const objQuery = `SELECT PermissionsCreate, PermissionsRead, PermissionsEdit, PermissionsDelete, PermissionsViewAllRecords, PermissionsModifyAllRecords FROM ObjectPermissions WHERE ${psIdsStr ? `ParentId IN (${psIdsStr}) AND ` : ''} SobjectType = '${object.name}'`;
            const fieldQuery = `SELECT Field, PermissionsRead, PermissionsEdit FROM FieldPermissions WHERE ${psIdsStr ? `ParentId IN (${psIdsStr}) AND ` : ''} SobjectType = '${object.name}'`;

            const [objRes, fieldRes] = await Promise.all([
                orgCallout(`/services/data/v${API_VERSION}/query?q=${encodeURIComponent(objQuery)}`),
                orgCallout(`/services/data/v${API_VERSION}/query?q=${encodeURIComponent(fieldQuery)}`)
            ]);

            const aggregatedObj = objRes.records.reduce((acc, curr) => ({
                Read: acc.Read || curr.PermissionsRead,
                Create: acc.Create || curr.PermissionsCreate,
                Edit: acc.Edit || curr.PermissionsEdit,
                Delete: acc.Delete || curr.PermissionsDelete,
                ViewAll: acc.ViewAll || curr.PermissionsViewAllRecords,
                ModifyAll: acc.ModifyAll || curr.PermissionsModifyAllRecords,
            }), { Read: false, Create: false, Edit: false, Delete: false, ViewAll: false, ModifyAll: false });

            const fieldMap = {};
            fieldRes.records.forEach(f => {
                const fieldName = f.Field.split('.')[1];
                if (!fieldMap[fieldName]) fieldMap[fieldName] = { Read: false, Edit: false };
                fieldMap[fieldName].Read = fieldMap[fieldName].Read || f.PermissionsRead;
                fieldMap[fieldName].Edit = fieldMap[fieldName].Edit || f.PermissionsEdit;
            });

            setObjectPermsCache(prev => ({
                ...prev,
                [object.name]: {
                    object: aggregatedObj,
                    fields: Object.entries(fieldMap).map(([name, perms]) => ({ name, ...perms }))
                }
            }));
            setLastEvaluatedSources([...selectedSources]);
            setNeedsReEvaluation(false);
        } catch (err) {
            message.error('Error fetching object permissions.');
        } finally {
            setFetchingDetail(false);
        }
    };

    const handleReEvaluate = () => {
        if (expandedObject) {
            const obj = objects.find(o => o.name === expandedObject);
            if (obj) {
                setObjectPermsCache(prev => {
                    const newCache = { ...prev };
                    delete newCache[expandedObject];
                    return newCache;
                });
                fetchObjectPermissions(obj);
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
                    <h1 className="fs-18-px c-w m-a-0 fw-600">Salesforce Permission Manager</h1>
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
                                    <div className="d-f j-c-s-b">
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
                                    <div className="fs-13-px fw-700 c-b-3 p-a-m border-b p-t-0">PROFILE</div>
                                    {userPermissions.profile?.Id && (
                                        <div
                                            className={`source-toggle d-f a-i-c j-c-s-b p-a-s m-t-xs b-rad-4-px cur-pointer tran-a-l-2 ${selectedSources.includes(userPermissions.profile?.PermissionSet?.Id) ? 'active' : ''}`}
                                            onClick={() => toggleSource(userPermissions.profile?.PermissionSet?.Id)}
                                        >
                                            <span className="fs-13-px c-b-1">{userPermissions.profile?.Name}</span>
                                            <Tag color="gold" className="fs-10-px m-a-0">PRO</Tag>
                                        </div>
                                    )}

                                    {userPermissions.assignments.length > 0 && (
                                        <>
                                            <div className="fs-13-px fw-700 c-b-3 m-t-m p-a-m border-b">PERMISSION SETS</div>
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
                                            <div className="fs-13-px fw-700 c-b-3 m-t-m p-b-xs border-b">PERMISSION SET GROUPS</div>
                                            {userPermissions.groups.map(g => (
                                                <div
                                                    key={g.Id}
                                                    className={`source-toggle d-f a-i-c j-c-s-b p-a-s m-t-xs b-rad-4-px cur-pointer tran-a-l-2 ${selectedSources.includes(g.Id) ? 'active' : ''}`}
                                                    onClick={() => toggleSource(g.Id)}
                                                >
                                                    <span className="fs-13-px c-b-1 t-o-e">{g.Label}</span>
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

                                                        {needsReEvaluation && (
                                                            <div className="p-a-m m-b-m bg-c-prim-xxl b-rad-4-px d-f a-i-c j-c-s-b animate-in">
                                                                <span className="fs-12-px c-prim fw-600">Filters changed. Update to see new permissions.</span>
                                                                <button className="prime-button d-f a-i-c g-s" onClick={handleReEvaluate} style={{ padding: '2px 10px' }}>
                                                                    <ReloadOutlined />
                                                                    RE-EVALUATE
                                                                </button>
                                                            </div>
                                                        )}

                                                        <div className="d-f f-w g-m p-b-m">
                                                            {['Read', 'Create', 'Edit', 'Delete', 'ViewAll', 'ModifyAll'].map(p => (
                                                                <div key={p} className={`perm-badge p-bk-xs p-i-m b-rad-20-px fs-11-px fw-600 ${objectPermsCache[obj.name]?.object[p] ? (p.includes('All') ? 'active-blue' : 'active-green') : 'inactive'}`}>
                                                                    {p.replace('All', ' All')}
                                                                </div>
                                                            ))}
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
                                                                dataSource={objectPermsCache[obj.name]?.fields.filter(f => f.name.toLowerCase().includes(fieldSearch.toLowerCase()))}
                                                                rowKey="name"
                                                                columns={[
                                                                    { title: 'Field Name', dataIndex: 'name', key: 'name', sorter: (a, b) => a.name.localeCompare(b.name) },
                                                                    { title: 'Read', dataIndex: 'Read', key: 'Read', align: 'center', render: v => <Tag color={v ? 'green' : 'red'} className="fs-10-px b-rad-2-px">{v ? 'GRANT' : 'DENY'}</Tag> },
                                                                    { title: 'Edit', dataIndex: 'Edit', key: 'Edit', align: 'center', render: v => <Tag color={v ? 'green' : 'red'} className="fs-10-px b-rad-2-px">{v ? 'GRANT' : 'DENY'}</Tag> },
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
