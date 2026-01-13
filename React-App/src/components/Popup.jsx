
import React, { useState, useEffect } from 'react';
import { Card, Button, Typography, List, message } from 'antd';
import { SafetyCertificateOutlined, DatabaseOutlined, RightOutlined } from '@ant-design/icons';
import RecordAccessAnalyzer from './RecordAccessAnalyzer';

const { Title, Text } = Typography;

const allowedSfDomains = ['.lightning.force.com', '.my.salesforce.com', '.my.salesforce-setup.com', '.builder.salesforce-experience.com'];

const Popup = () => {
    const [sfTabs, setSfTabs] = useState([]);
    const [selectedTab, setSelectedTab] = useState(null);
    const [isRecordPage, setIsRecordPage] = useState(false);
    const [extID, setExtID] = useState('');
    const [isRecordAccessSlider, setIsRecordAccessSlider] = useState(false);

    useEffect(() => {
        setExtID(chrome.i18n.getMessage("@@extension_id"));
        chrome.windows.getCurrent({ populate: true }, (_window) => {
            const tabs = [];
            let activeSfTab = null;
            console.log(_window.tabs);

            _window.tabs?.forEach(tab => {
                const url = tab.url;
                if (!url) return;

                try {
                    const urlObj = new URL(url);
                    const domain = urlObj.hostname;
                    const sfD = allowedSfDomains.find(ele => domain?.includes(ele));

                    if (sfD) {
                        const normalizedDomain = domain.replace(sfD, '.my.salesforce.com');
                        const host = normalizedDomain.replace('.my.salesforce.com', '');

                        const sfTab = {
                            id: tab.id,
                            url: tab.url,
                            host,
                            domain: normalizedDomain,
                            tabIndex: tab.index,
                            windowId: _window.id,
                            active: tab.active
                        };

                        if (tab.active) {
                            activeSfTab = sfTab;
                        } else {
                            // Avoid duplicates (different tabs of same org in same window)
                            if (!tabs.some(t => t.domain === normalizedDomain)) {
                                tabs.push(sfTab);
                            }
                        }
                    }
                } catch (e) {
                    console.error("Invalid URL", url);
                }
            });

            if (activeSfTab) {
                handleOrgSelection(activeSfTab);
            } else {
                setSfTabs(tabs);
            }
        });
    }, []);

    const handleOrgSelection = (sfTab) => {
        setSelectedTab(sfTab);
        checkIfRecordPage(sfTab.url);
    };

    const checkIfRecordPage = (url) => {
        // Salesforce URL pattern for record pages: /lightning/r/OBJECT_NAME/RECORD_ID/view
        const recordPattern = /\/lightning\/r\/([a-zA-Z0-9_]+)\/([a-zA-Z0-9]{15,18})\//;
        const match = url.match(recordPattern);
        setIsRecordPage(!!match);
    };

    const openPermissionAnalyzer = () => {
        if (!selectedTab) return;
        chrome.tabs.create({
            url: `chrome-extension://${extID}/dist/bundle.html?domain=https://${selectedTab.domain}`,
            index: selectedTab.tabIndex + 1,
            windowId: selectedTab.windowId,
            active: true,
        });
        window.close();
    };

    const openRecordAccessAnalyzer = () => {
        if (!selectedTab || !isRecordPage) return;

        // In reality, this would inject the RecordAccessAnalyzer component into the tab
        // For now, we'll just send a message to the content script or background
        chrome.runtime.sendMessage({
            action: "OPEN_RECORD_ACCESS_ANALYZER",
            tabId: selectedTab.id
        });
        window.close();
    };

    return (
        <div className="bg-c-wb-1 p-a-1" style={{ width: 350 }}>
            <div className="d-f a-i-c g-m m-b-2">
                <img src="/icon.png" alt="Logo" className="w-32-px h-32-px" />
                <h4 className="fs-18-px fw-600 m-a-0 c-b-1">Permission Manager</h4>
            </div>

            {!selectedTab ? (
                <div>
                    <span className="c-b-3 fs-13-px m-b-m d-b">
                        Select an active Salesforce Org:
                    </span>
                    {sfTabs.length > 0 ? (
                        <div className="d-f f-d-c g-s">
                            {sfTabs.map(tab => (
                                <button
                                    key={tab.id}
                                    className="w-100-p d-f j-c-s-b a-i-c p-a-m b-rad-4-px bg-c-w b-1-px b-c-b-5 cur-pointer tran-a-l-2 hover-bg-light"
                                    onClick={() => handleOrgSelection(tab)}
                                    style={{ textAlign: 'left', border: '1px solid #e2e8f0' }}
                                >
                                    <span className="fs-14-px c-b-1">{tab.host}</span>
                                    <RightOutlined className="c-b-3" />
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="t-a-c p-a-2 c-b-3 fs-14-px">
                            No Salesforce tabs found in this window.
                        </div>
                    )}
                </div>
            ) : (
                <div className="animate-in">
                    <span className="c-b-3 fs-13-px m-b-1s d-b">
                        Choose an analyzer for <b className="c-b-1">{selectedTab.host}</b>:
                    </span>

                    <div
                        className="p-a-m b-rad-8-px bg-c-w b-1-px b-c-b-5 m-b-m cur-pointer tran-a-l-2"
                        onClick={openPermissionAnalyzer}
                        style={{ borderLeft: '4px solid #1890ff', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
                    >
                        <div className="d-f a-i-c g-m">
                            <SafetyCertificateOutlined className="fs-24-px" style={{ color: '#1890ff' }} />
                            <div>
                                <div className="fw-600 fs-14-px c-b-1">Permission Analyzer</div>
                                <div className="c-b-3 fs-12-px">Analyze user & object permissions</div>
                            </div>
                        </div>
                    </div>

                    <div
                        className={`p-a-m b-rad-8-px bg-c-w b-1-px b-c-b-5 tran-a-l-2 ${isRecordPage ? 'cur-pointer' : 'cur-not-allowed'}`}
                        onClick={isRecordPage ? openRecordAccessAnalyzer : undefined}
                        style={{
                            borderLeft: `4px solid ${isRecordPage ? '#52c41a' : '#d9d9d9'}`,
                            opacity: isRecordPage ? 1 : 0.6,
                            boxShadow: isRecordPage ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
                        }}
                    >
                        <div className="d-f a-i-c g-m">
                            <DatabaseOutlined className="fs-24-px" style={{ color: isRecordPage ? '#52c41a' : '#d9d9d9' }} />
                            <div>
                                <div className={`fw-600 fs-14-px ${isRecordPage ? 'c-b-1' : 'c-b-4'}`}>Record Access Analyzer</div>
                                <div className="c-b-3 fs-12-px">
                                    {isRecordPage ? 'Analyze access for this record' : 'Only available on record pages'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Popup;
