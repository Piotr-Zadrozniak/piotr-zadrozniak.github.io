var SiteActions = {
    updateThumbnail(data) {
        bridge.reload();
    },
    setStyles(data) {
        let ss = document.getElementById('styles');
        let href = ss.getAttribute('href');
        let basePath = href.substring(0, href.indexOf('?') + 1);
        for (var key in data) {
            ss.dataset[key] = data[key];
        }
        let url = basePath + _.serialize(ss.dataset);
        ss.setAttribute('href', url);
    },
    applyOption(data) {
        if (data.name == 'brandingGlyph') {
            SiteBlocks.brandingGlyph.update(data.value);
        }
        else if (data.name == 'fontScheme') {
            switch (data.value) {
                case 'monospace':
                    SiteActions.bodyClassSwich('variedLetterSpacing', 'fixedLetterSpacing');
                    break;
                case 'serif':
                    SiteActions.bodyClassSwich('fixedLetterSpacing', 'variedLetterSpacing');
                    break;
            }
        }
        else {
            SiteActions.bodyClassSwich(data.oldValue, data.value);
        }
    },
    bodyClassSwich(remove, add) {
        document.body.classList.remove(remove);
        document.body.classList.add(add);
    },
    loadPartial(data) {
        let el = document.querySelector(data.selector);
        fetch(data.url, {
            credentials: 'include'
        }).then(response => response.text())
            .then(html => { el.outerHTML = html; });
    },
    updateBlock(data) {
        let block = SiteBlocks[data.name];
        block && block.update(data.data);
    }
};
var SiteBlocks = {
    nav: {
        update(data) {
            SiteActions.loadPartial({
                url: '/?partial=nav',
                selector: 'nav'
            });
        }
    },
    siteTitle: {
        update(text) {
            let el = document.querySelector('header h1');
            el.textContent = text || '';
            el.classList[text ? 'remove' : 'add']('hide');
        }
    },
    tagline: {
        update(text) {
            let el = document.querySelector('.tagline');
            el.textContent = text || '';
            el.classList[text ? 'remove' : 'add']('hide');
        }
    },
    brandingGlyph: {
        update(value) {
            let el = document.querySelector('carbon-glyph');
            el.innerHTML = `&#x${value};`;
        }
    },
    siteFooterContent: {
        update(text) {
            let el = document.getElementById('footerContent');
            el.innerHTML = text;
        }
    },
    logo: {
        update() {
            SiteActions.loadPartial({
                url: '/?partial=header',
                selector: 'header'
            });
        }
    }
};
class Site {
    constructor() {
        this.router = new Carbon.Router({
            '/': this.index.bind(this),
            '/about': this.about.bind(this),
            '/contact': this.contact.bind(this),
            '/projects/{id}': this.project.bind(this),
            '/blog': this.blog.bind(this),
            '/blog/{tag}': this.blog.bind(this)
        });
        this.router.start({ dispatch: true });
    }
    index(cxt) {
        if (this.isInit(cxt))
            return;
        this.load('/').then(() => {
            this.onLoaded(cxt);
        });
    }
    blog(cxt) {
        if (this.isInit(cxt))
            return;
        this.load(cxt.url).then(() => {
            this.onLoaded(cxt);
        });
    }
    project(cxt) {
        if (this.isInit(cxt)) {
            let infoEl = document.querySelector('.info');
            infoEl && infoEl.classList.add('dropIn');
            return;
        }
        this.load('/projects/' + cxt.params.id).then(() => {
            let infoEl = document.querySelector('.info');
            infoEl && infoEl.classList.add('dropIn');
            this.onLoaded(cxt);
        });
    }
    about(cxt) {
        if (this.isInit(cxt))
            return;
        this.load('/about').then(() => {
            this.onLoaded(cxt);
        });
    }
    contact(cxt) {
        if (this.isInit(cxt))
            return;
        this.load('/contact').then(() => {
            this.onLoaded(cxt);
        });
    }
    load(path, triggerRoute) {
        let mainEl = document.querySelector('main');
        let url = path + (path.indexOf('?') > -1 ? '&' : '?') + 'partial=true';
        document.body.classList.remove('loaded');
        document.body.classList.add('loading');
        return fetch(url, {
            credentials: 'same-origin'
        }).then(response => {
            try {
                let properties = JSON.parse(response.headers.get("x-properties"));
                document.title = properties.title || '';
            }
            catch (err) { }
            return response.text();
        }).then(html => {
            mainEl.innerHTML = html;
            this.onLoaded({
                path: path,
                init: false,
                reloaded: triggerRoute === false
            });
            return true;
        });
    }
    onLoaded(cxt) {
        document.body.classList.add('loaded');
        Carbon.Reactive.trigger('routed', cxt);
        Carbon.DOM.onChange();
    }
    isInit(cxt) {
        if (cxt.init) {
            this.onLoaded(cxt);
            return true;
        }
        return false;
    }
}
Carbon.controllers.set('form', {
    setup(e) { Carbon.Form.get(e.target); }
});
var site = new Site();
