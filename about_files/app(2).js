"use strict";
var CM;
(function (CM) {
    CM.userId = parseInt(document.body.dataset['userId']);
    CM.siteId = document.body.dataset['siteId'];
    function onResize() {
        CM.sitePreview.layout();
    }
    CM.onResize = onResize;
    CM.sitePreview = {
        element: document.getElementById('sitePreview'),
        fix() {
            CM.sitePreview.element.style.width = CM.sitePreview.element.clientWidth + 'px';
        },
        unfix() {
            CM.sitePreview.element.style.width = null;
        },
        layout() {
            let designing = document.body.classList.contains('designing');
            let subtract = 0;
            Array.from(document.querySelectorAll('main .notice.show')).forEach(el => {
                subtract += el.offsetHeight;
            });
            if (designing) {
                subtract += 30;
            }
            CM.sitePreview.element.style.height = (window.innerHeight - subtract) + 'px';
        }
    };
    class PortfolioApp {
        constructor() {
            let path = '/';
            if (location.pathname.startsWith('/portfolio/')) {
                path += location.pathname.replace('/portfolio/', '').replace('/pieces', '');
            }
            if (path.startsWith('/design') || path === '/settings' || path === '/projects') {
                path = '/';
            }
            this.bridge = new CM.Bridge(path);
            document.addEventListener('saved', this.onSaved.bind(this));
            document.addEventListener('block:edit', this.onBlockEdit.bind(this));
            document.addEventListener('block:saved', this.onBlockSaved.bind(this));
            document.addEventListener('option:change', this.onOptionChange.bind(this));
            document.addEventListener('option:saved', this.onOptionSaved.bind(this));
            document.addEventListener('toggle:saved', this.onToggleSaved.bind(this));
            window.addEventListener('resize', onResize.bind(this));
            onResize();
        }
        get pro() {
            return document.body.classList.contains('pro');
        }
        onSaved(e) {
            this.flashUpdated();
            let reload = e.detail && e.detail.reload;
            reload && this.bridge.reload();
            document.body.classList.add('saving');
            setTimeout(() => {
                document.body.classList.remove('saving');
                document.body.classList.add('saved');
            }, 500);
        }
        onBlockEdit(e) {
            let block = e.detail.instance;
            let { blockName, entity } = block.element.dataset;
            if (entity && block.form.fields.length === 1) {
                let fieldObserver = _.observe(block.element, 'field:change', (e) => {
                    let change = e.detail;
                    if (blockName) {
                        this.bridge.updateBlock(blockName, change.value);
                    }
                    this.bridge.change(entity, change.value);
                });
                block.on('block:close', () => {
                    fieldObserver.stop();
                });
            }
        }
        onBlockSaved(e) {
            this.onSaved(e);
            let target = e.target;
            target.classList.remove('adding');
            let detail = e.detail;
            if (detail.name) {
                this.bridge.notify({
                    type: 'change',
                    entity: detail.entity,
                    name: detail.name,
                    value: detail.value
                });
                if (detail.entity) {
                    this.bridge.change(detail.entity, detail.value);
                }
            }
            let { blockName } = target.dataset;
            if (!blockName)
                return;
            let block = detail.instance;
            if (block.form.fields.length === 1) {
                let field = block.form.fields[0];
                this.bridge.updateBlock(blockName, field.value);
            }
            else {
                this.bridge.updateBlock(blockName, detail.data);
            }
        }
        showNotice(name) {
            let noticeEl = document.querySelector(`#${name}Notice`);
            noticeEl && noticeEl.classList.add('show');
            onResize();
        }
        hideNotice(name) {
            let noticeEl = document.querySelector(`#${name}Notice`);
            noticeEl && noticeEl.classList.remove('show');
            onResize();
        }
        get designing() {
            return document.body.matches('.designing');
        }
        get setting() {
            return document.body.matches('.setting');
        }
        get previewing() {
            return document.body.matches('.previewing');
        }
        onNavigate(path) {
            if (this.designing)
                return;
            if (path === '/') {
                path = '';
            }
            if ('/portfolio/' + path === location.pathname) {
                return;
            }
            Carbon.Router.instance.navigate('/portfolio' + path);
        }
        onOptionSaved(e) {
            let { name, value, oldValue } = e.detail;
            this.onSaved(e);
            if (name === 'colorScheme') {
                let moodEl = document.querySelector('#moodBlock.copybara');
                if (!moodEl)
                    return;
                let moodOptionEls = Array.from(document.querySelectorAll('#moodChooser .option'));
                setTimeout(() => {
                    switch (value) {
                        case 'dark':
                            moodOptionEls[0].click();
                            break;
                        case 'light':
                            moodOptionEls[2].click();
                            break;
                    }
                }, 1000);
                for (var selector of ['#moodChooser', '#moodBlock']) {
                    let el = document.querySelector(selector);
                    el && el.classList.remove(oldValue);
                    el && el.classList.add(value);
                }
            }
            else {
                this.bridge.invoke('optionSaved', e.detail);
            }
        }
        onToggleSaved(e) {
            let el = e.target;
            let data = e.detail;
            this.bridge.invoke('optionSaved', {
                name: data.name,
                value: data.value,
                type: 'toggle'
            });
            switch (data.name) {
                case 'projectCentering': return true;
                case 'projectNumbering': return true;
                case 'coverPage':
                    this.bridge.refresh();
                    return true;
            }
            if (data.name === 'active') {
                let projectEl = document.querySelector('.project');
                if (projectEl.matches('.show')) {
                    if (data.value) {
                        this.hideNotice('projectIsHidden');
                    }
                    else {
                        this.showNotice('projectIsHidden');
                    }
                    this.bridge.updateBlock('nav');
                    return;
                }
                let popoutEl = el.closest('.popout');
                if (!popoutEl)
                    return;
                let popout = Carbon.Popout.get(popoutEl);
                let parentEl = popout.parentEl;
                projectEl = parentEl.closest('.project');
                projectEl.classList.toggle('active', data.value);
                projectEl.classList.toggle('inactive', data.value);
                this.bridge.refresh();
            }
            else if (data.name === 'showThumbnailText') {
                document.querySelector('#projectSubtitleFieldBlock').classList[data.value ? 'remove' : 'add']('hidden');
                this.bridge.reload();
            }
            else if (data.name === 'cover') {
                document.querySelector('#coverTitleFontBlock').classList[data.value ? 'remove' : 'add']('hidden');
            }
            else {
                this.bridge.reload();
            }
        }
        onOptionChange(e) {
            let { name, value, oldValue } = e.detail;
            if (parseInt(value, 10) > 0) {
                value = name + value;
                oldValue = name + oldValue;
            }
            this.bridge.invoke('applyOption', e.detail);
        }
        flashUpdated() {
            let updatedEl = document.querySelector('#updated');
            let clonedEl = updatedEl.cloneNode(true);
            clonedEl.classList.add('show');
            updatedEl.parentElement.replaceChild(clonedEl, updatedEl);
            updatedEl.replaceWith(clonedEl);
            updatedEl = clonedEl;
            updatedEl.addEventListener('animationend', () => {
                updatedEl.classList.remove('show');
            }, false);
        }
    }
    CM.PortfolioApp = PortfolioApp;
    const mainEl = document.querySelector('main');
    class SectionBase {
        constructor(element, url) {
            this.element = element;
            this.url = url;
            this.loaded = false;
            this.force = false;
            this.gutsEl = this.element.querySelector('.guts');
        }
        reload() {
            this.loaded = false;
            this._load();
        }
        load(cxt) {
            if (this.onLoad) {
                this.onLoad(cxt);
            }
            if (cxt.prevpath == cxt.path) {
            }
            else if (cxt.prevpath && cxt.prevpath.startsWith('/portfolio/projects/') && cxt.path.startsWith('/portfolio/projects/')) {
            }
            else if (cxt.prevpath && cxt.prevpath.startsWith(cxt.path)) {
                Panel.back(document.querySelector('.side.show'), this.element);
            }
            else if (cxt.prevpath == '/portfolio/projects' && cxt.path.startsWith('/portfolio/projects/')) {
                Panel.back(CM.Sections.projects.element, this.element);
            }
            else {
                Panel.forwards(CM.last || CM.Sections.main.element, this.element);
            }
            CM.last = this.element;
            this._load();
        }
        onLoad(e) { }
        unload(cxt) {
            this.onUnload();
        }
        onUnload(e) {
        }
        async _load() {
            if (!this.url || this.loaded && !this.force) {
                return Promise.resolve(true);
            }
            this.gutsEl.innerHTML = '';
            let response = await _.send(this.url, {
                method: 'GET',
                headers: { 'Accept': 'text/html' }
            });
            let html = await response.text();
            this.gutsEl.innerHTML = html;
            this._onLoaded(response);
            Carbon.DOM.onChange();
            let contentEl = this.element.querySelector('.content');
            if (contentEl) {
                contentEl.scrollTop = 0;
            }
            return true;
        }
        _onLoaded(response) {
            this.loaded = true;
            setTimeout(() => {
                Carbon.DOM.onChange();
            }, 200);
            this.onLoaded(response);
        }
        onLoaded(response) {
        }
    }
    ;
    class ContactPage extends SectionBase {
        constructor() {
            super(document.querySelector('section.contact'), '/profile?partial=personalizeContact');
        }
        onLoaded(response) {
            let introduceName = response.headers.get('X-Introduce');
            introduceName && CM.IntroductionModal.get().show(introduceName);
        }
        onUnload(cxt) {
            CM.IntroductionModal.get().hide();
        }
    }
    class AboutPage extends SectionBase {
        constructor() {
            super(document.querySelector('section.about'), '/profile?partial=personalizeAbout');
        }
        onLoaded() {
            Carbon.DOM.onChange();
        }
    }
    class BlogPage extends SectionBase {
        constructor() {
            super(document.querySelector('section.blog'), '/posts?partial=true');
        }
        onLoaded() {
            CM.BlogActions.onOpen();
        }
    }
    class ProjectPage extends SectionBase {
        constructor() {
            super(document.querySelector('section.project'), '');
            this.prevpath = null;
            this.force = true;
        }
        onLoad(e) {
            this.prevpath = e.prevpath;
            this.url = `/projects/${e.params.id}?partial=section`;
            CM.portfolio.bridge.navigate(`/projects/${e.params.id}`);
            this.loaded = false;
        }
        onLoaded(response) {
            if (response.headers.get('x-project-visibility') === 'hidden') {
                CM.portfolio.showNotice('projectIsHidden');
            }
            let backEl = this.element.querySelector('a.back');
            let backLink = (this.prevpath == '/portfolio/projects')
                ? '/portfolio/projects'
                : '/portfolio';
            backEl.setAttribute('href', backLink);
        }
        onUnload() {
            CM.portfolio.hideNotice('projectIsHidden');
        }
    }
    class ThemesSection extends SectionBase {
        constructor() {
            super(document.querySelector('section.themes'), '/themes?partial=true');
        }
        onLoad() {
            document.body.classList.add('designing');
        }
        onUnload(cxt) {
            document.body.classList.remove('designing');
            let previewingEl = document.querySelector('.theme.previewing');
            if (previewingEl) {
                let themeId = parseInt(document.body.dataset['themeId']);
                CM.portfolio.bridge.setThemeId(themeId);
                previewingEl.classList.remove('previewing');
            }
        }
    }
    class DesignSection extends SectionBase {
        constructor() {
            super(document.querySelector('section.design'), '/design?partial=true');
        }
        onLoad(e) {
            document.body.classList.add('designing');
            CM.portfolio.bridge.navigate('/');
            CM.sitePreview.layout();
            Carbon.DOM.onChange();
        }
        onUnload(cxt) {
            document.body.classList.remove('designing');
            CM.sitePreview.layout();
        }
    }
    class SettingsSection {
        constructor() {
            this.element = document.querySelector('section.settings');
            this.url = '/settings?partial=true';
        }
        load() {
            Panel.forwards(CM.last || CM.Sections.main.element, this.element);
            mainEl.style.marginLeft = this.element.clientWidth + 'px';
            document.body.classList.add('nopreview');
            CM.sitePreview.fix();
            this._load();
        }
        unload() {
            document.body.classList.remove('nopreview');
        }
        async _load() {
            let html = await _.getHTML(this.url);
            this.element.querySelector('.guts').innerHTML = html;
            this.setup();
        }
        setup() {
            new CM.SettingsController();
        }
    }
    class MainSection {
        constructor() {
            this.element = document.querySelector('.side.main');
        }
        load() {
            CM.selectApp('portfolio');
            CM.portfolio.bridge.navigate('/');
            CM.last = this.element;
            let current = Array.from(document.querySelectorAll('.side.show:not(.main)'));
            for (var el of current) {
                Panel.back(el, this.element);
            }
            if (current.length === 0) {
                this.element.classList.add('show');
            }
        }
        unload(cxt) {
        }
    }
    class ProjectManagerSection {
        constructor() {
            this.element = document.querySelector('.projectManager');
        }
        load() {
            CM.ProjectList.get().open();
            document.body.classList.add('nopreview');
        }
        unload(cxt) {
            document.body.classList.remove('nopreview');
        }
    }
    class ProjectDefaultsSection extends SectionBase {
        constructor() {
            super(document.querySelector('section.projectDesign'), '/design/projectdefaults');
        }
        onLoad() {
            document.body.classList.add('designing');
            CM.sitePreview.layout();
            CM.portfolio.showNotice('defaultProject');
            setTimeout(() => {
                CM.portfolio.bridge.navigate('/projects/5385112');
            }, 50);
        }
        unload() {
            CM.portfolio.hideNotice('defaultProject');
            CM.sitePreview.layout();
        }
    }
    CM.Sections = {
        main: new MainSection(),
        projects: new ProjectManagerSection(),
        design: new DesignSection(),
        settings: new SettingsSection(),
        themes: new ThemesSection(),
        projectDefaults: new ProjectDefaultsSection(),
        about: new AboutPage(),
        contact: new ContactPage(),
        project: new ProjectPage(),
        blog: new BlogPage()
    };
    CM.portfolio = new PortfolioApp();
})(CM || (CM = {}));
