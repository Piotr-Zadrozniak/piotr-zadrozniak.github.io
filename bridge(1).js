class Bridge {
    constructor() {
        this.path = document.location.pathname;
        window.addEventListener('message', this.receiveMessage.bind(this));
    }
    receiveMessage(e) {
        let message = JSON.parse(e.data);
        if (message.type == 'notification') {
            this.handleNotification(message.data);
        }
        else if (this[message.action]) {
            this[message.action](message.data);
        }
        else if (SiteActions[message.action]) {
            SiteActions[message.action](message.data);
        }
    }
    handleNotification(data) {
        switch (data.name) {
            case 'logo':
                SiteBlocks.logo.update();
                break;
            case 'thumbnail':
            case 'resume':
            case 'photo':
            case 'cover':
                this.reload();
                break;
        }
    }
    sendMessage(message) {
        window.parent.postMessage(JSON.stringify(message), '*');
    }
    navigate(url) {
        this.path = url;
        site.router.navigate(url, { replace: true });
    }
    load(url) {
        this.navigate(url);
    }
    reload() {
        let mainEl = document.querySelector('main');
        let scrollLeft = mainEl.scrollLeft;
        site.load(this.path, false).then(() => {
            setTimeout(() => {
                mainEl.scrollLeft = scrollLeft;
            }, 1);
        });
    }
    applyOption(data) {
        console.log('apply', data);
        switch (data.name) {
            case 'accentColor':
            case 'colorScheme':
                let style = {};
                if (data.name == 'accentColor') {
                    switch (data.value) {
                        case 'purple':
                            data.value = '#bb74f2';
                            break;
                        case 'green':
                            data.value = '#3ed984';
                            break;
                        case 'blue':
                            data.value = '#4a8ad4';
                            break;
                    }
                }
                style[data.name] = data.value;
                SiteActions.setStyles(style);
                break;
            default: {
                document.body.classList.remove(data.oldValue);
                document.body.classList.add(data.value);
                break;
            }
        }
    }
    optionSaved(data) {
        switch (data.name) {
            case 'projectSubtitleField':
                this.reload();
                break;
            case 'logoBox':
                SiteBlocks.logo.update();
                break;
        }
    }
    getUploadAuthorization() {
        this.sendMessage({
            type: 'authorize',
            action: 'authorize',
            model: 'upload'
        });
        return new Promise(resolve => {
            window.addEventListener('message', e => {
                resolve(JSON.parse(e.data).data);
            }, { once: true });
        });
    }
    editBlock(data) {
        let message = {
            type: 'editBlock',
            data: data
        };
        this.sendMessage(message);
    }
}
if (window.parent != self) {
    let bridge = new Bridge();
    window.bridge = bridge;
    document.addEventListener('router:navigate', (e) => {
        let data = e.detail;
        bridge.path = data.path;
        bridge.sendMessage({
            type: 'navigate',
            path: data.path,
            init: false
        });
    });
}
document.body.addEventListener('click', (e) => {
    let target = e.target;
    let aEl = target.closest('a');
    if (aEl) {
        let href = aEl.getAttribute('href');
        if (href && href.startsWith('http')) {
            e.preventDefault();
        }
    }
}, true);
