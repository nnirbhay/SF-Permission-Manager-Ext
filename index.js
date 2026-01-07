
import '/src/utilities/prototypes/prototypes.js';

const allowedSfDomains = ['.lightning.force.com', '.my.salesforce.com', '.my.salesforce-setup.com', '.builder.salesforce-experience.com']
let extID = `${chrome.i18n.getMessage("@@extension_id")}`;

document.addEventListener("DOMContentLoaded", () => {
    chrome.windows.getCurrent({ populate: true }, (_window) => {
        let sfTabs = [];

        _window.tabs?.forEach(tab => {
            let url = tab.url;
            if (!url) return;

            let domain = new URL(url).hostname;
            const sfD = allowedSfDomains.find(ele => domain?.includes(ele))
            if (!sfD) return;

            domain = domain.replace(sfD, '.my.salesforce.com');
            if (sfTabs.some(ele => ele.domain === domain)) return;

            let host = domain.replace('.my.salesforce.com', '');
            let sfTab = {
                host, domain, tabIndex: tab.index,
                groupId: tab.groupId, windowId: _window.id
            }

            if (tab.active) {
                openNewTabWith(sfTab);
                window.close(); // Close popup if we auto-open
                return;
            }
            sfTabs.push(sfTab);
        });

        createPopupDOM(sfTabs);
    })
})

async function openNewTabWith(sfTab) {
    chrome.tabs.create({
        url: `chrome-extension://${extID}/dist/bundle.html?domain=https://${sfTab.domain}`,
        index: sfTab.tabIndex + 1, windowId: sfTab.windowId, active: true,
    });
}

function createPopupDOM(sfTabsUniq) {
    const body = document.createElement('div');
    body.classList.add('main-sec');

    body.innerHTML = `
    <div class="product-header">
        <img class="product-logo" src="/icon.png" alt="Logo" />
        <span class="header-text">Permission Manager</span>
    </div>
    <div class="org-list-title">Select an active Salesforce Org:</div>
    `

    if (!sfTabsUniq?.length) {
        body.innerHTML += `
            <div style="text-align:center; padding: 20px; color: #718096;">
                No Salesforce tabs found in this window.
            </div>
        `
    }

    sfTabsUniq?.forEach(sfTab => {
        const btn = document.createElement('button');
        btn.classList.add('org-select-btn');
        btn.innerHTML = `
            <span>${sfTab.host}</span>
            <svg viewBox="0 0 24 24"><path d="M10 6V8H5V19H16V14H18V20C18 20.5523 17.5523 21 17 21H4C3.44772 21 3 20.5523 3 20V7C3 6.44772 3.44772 6 4 6H10ZM21 3V11H19L18.9999 6.413L11.2071 14.2071L9.79289 12.7929L17.5849 5H13V3H21Z"></path></svg>
        `
        btn.addEventListener('click', () => {
            openNewTabWith(sfTab);
            window.close();
        });
        body.appendChild(btn);
    });

    document.body.appendChild(body)
}