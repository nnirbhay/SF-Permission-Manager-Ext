
import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import RecordAccessAnalyzer from './components/RecordAccessAnalyzer';
import './App.css'; // Reuse styles if needed


const ContentApp = () => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const handleMessage = (request, sender, sendResponse) => {
            console.log('handleMessage : ', request);
            if (request.action === "OPEN_RECORD_ACCESS_ANALYZER") {
                setVisible(true);
            }
        };

        chrome.runtime.onMessage.addListener(handleMessage);
        return () => chrome.runtime.onMessage.removeListener(handleMessage);
    }, []);

    return (
        <div className="sf-perm-manager-content-root">
            <RecordAccessAnalyzer
                visible={visible}
                onClose={() => setVisible(false)}
            />
        </div>
    );
};

// Create a container for our React app
const init = () => {
    const existingRoot = document.getElementById('sf-permission-manager-root');
    if (existingRoot) return;

    const rootDiv = document.createElement('div');
    rootDiv.id = 'sf-permission-manager-root';
    document.body.appendChild(rootDiv);

    const root = createRoot(rootDiv);
    root.render(<ContentApp />);
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
