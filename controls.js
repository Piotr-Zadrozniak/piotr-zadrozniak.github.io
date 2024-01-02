"use strict";
var CM;
(function (CM) {
    class Media {
        constructor(attributes) {
            this.loaded = false;
            Object.assign(this, attributes);
        }
        async resize(maxWidth, maxHeight, anchor) {
            let url = `/media/${this.id}/transform?height=${maxHeight}&width=${maxWidth}&anchor=${encodeURI(anchor || '>')}`;
            return new Media(await _.getJSON(url));
        }
        load() {
            if (this.loaded) {
                return Promise.resolve(this);
            }
            return new Promise((resolve, reject) => {
                let image = new Image();
                image.onload = () => {
                    this.loaded = true;
                    resolve(this);
                };
                image.src = this.url;
            });
        }
    }
    CM.Media = Media;
    class IntroductionModal {
        constructor() {
            this.element = document.querySelector('#introductionModal');
            this.modal = Carbon.Modal.get(this.element);
            this.titleEl = this.element.querySelector('.title');
            this.descriptionEl = this.element.querySelector('.description');
            this.dismissEl = this.element.querySelector('.dismiss');
            this.innerEl = this.element.querySelector('.inner');
        }
        static get() {
            return IntroductionModal.instance || (IntroductionModal.instance = new IntroductionModal());
        }
        async show(name) {
            this.element.className = name;
            _.hide(this.innerEl);
            let data = await _.getJSON(`/introductions?name=${name}`);
            this.titleEl.textContent = data.title || '';
            this.descriptionEl.innerHTML = data.description || '';
            this.dismissEl.textContent = data.buttonText || '';
            _.show(this.innerEl);
            this.modal.open();
        }
        hide() {
            if (this.modal) {
                this.modal.close();
            }
        }
    }
    CM.IntroductionModal = IntroductionModal;
    CM.UserMenuActions = {
        toggle() { CM.userMenu.toggle(); }
    };
    class UserMenu {
        constructor() {
            this.element = document.querySelector('.userMenu');
            this.mask = new Carbon.Mask({ zIndex: 98 });
            this.mask.addClass('transparent');
            this.mask.element.addEventListener('click', this.close.bind(this));
        }
        toggle() {
            if (!this.element)
                return;
            this.element.classList.toggle('open');
            this.mask[this.isOpen ? 'show' : 'hide']();
        }
        close() {
            if (!this.element)
                return;
            this.element.classList.remove('open');
            this.mask.hide();
        }
        get isOpen() {
            return this.element.matches('.open');
        }
    }
    CM.userMenu = new UserMenu();
    CM.PreviewBlock = {
        async update(selector, media) {
            if (!(media.type.startsWith('image') || media.type === 'application/pdf')) {
                return;
            }
            let previewEl = document.querySelector(selector);
            if (!previewEl)
                return;
            let height = _.height(previewEl);
            let width = _.width(previewEl);
            previewEl.style.backgroundImage = '';
            let thumb = (previewEl.dataset['sizing'] === 'cover')
                ? new Media(media).resize(width, height, 'center')
                : new Media(media).resize(width, height);
            let parentEl = previewEl.parentElement;
            if (parentEl.matches('.resume')) {
                var len = Math.min(media.pages.length, 3);
                parentEl.className = 'resume ' + ['zero', 'one', 'two', 'three'][len];
            }
            let t = await thumb;
            previewEl.style.backgroundImage = `url('${t.url}')`;
        }
    };
    CM.UploadActions = {
        async remove(e) {
            let blockEl = e.target.closest('.block');
            let { entity, name, remote } = blockEl.dataset;
            await _.send(remote, { method: 'DELETE' });
            blockEl.classList.add('empty');
            _.trigger(blockEl, 'block:saved', {
                entity: entity,
                name: name,
                value: null
            });
        },
        async save(e) {
            let files = e.files || e.target.files;
            if (files.length <= 0)
                return;
            let el = e.target;
            let blockEl = el.closest('.block');
            if (!blockEl)
                return;
            let { name, remote, entity } = blockEl.dataset;
            if (!remote)
                throw new Error('[Upload] missing data-remote');
            let progressEl = blockEl.querySelector('.progress');
            let progressMeter = null;
            if (progressEl) {
                progressMeter = new Carbon.ProgressMeter(progressEl);
            }
            blockEl.classList.remove('empty');
            blockEl.classList.add('uploading');
            let response = await fetch('/uploads/authorize', {
                method: 'POST'
            });
            let authorization = await response.json();
            let upload = new Carbon.Upload(files[0], {
                url: authorization.url,
                authorization: authorization,
                method: 'PUT'
            });
            if (progressMeter) {
                progressMeter.reset();
                upload.on('progress', progressMeter.update.bind(progressMeter));
            }
            let result = await upload.start();
            let request = _.patchJSON(remote, {
                uploadId: result.blob.id
            });
            request.then((media) => {
                _.trigger(blockEl, 'block:saved', {
                    entity: entity,
                    name: name,
                    value: media
                });
                setTimeout(() => {
                    blockEl.classList.remove('uploading');
                }, 1000);
                CM.PreviewBlock.update(`.${name}Preview`, media);
            }, (err) => {
                console.log(err);
                blockEl.classList.remove('uploading');
                alert('ERROR:' + err.errors[0].message);
            });
        }
    };
    CM.TooltipActions = {
        show(e) {
            CM.tip.showHint(e);
        }
    };
    class Tooltip {
        constructor() {
            this.element = document.querySelector('#tooltip');
            this.gutsEl = this.element.querySelector('.guts');
            this.titleEl = this.element.querySelector('.title');
            this.descriptionEl = this.element.querySelector('.description');
            this.tagsEl = this.element.querySelector('.tags');
        }
        showHint(e) {
            let hintEl = (e.currentTarget || e.target);
            if (!hintEl.matches('.clickable')) {
                _.one(hintEl, 'mouseout', this.hide.bind(this));
            }
            hintEl.classList.add('show');
            let data = hintEl.dataset;
            let featureName = data['feature'];
            let { title, description, tags } = data;
            if (this.extraClass) {
                this.element.classList.remove(this.extraClass);
            }
            this.extraClass = data['class'];
            if (this.extraClass) {
                this.element.classList.add(this.extraClass);
            }
            if (title) {
                this.titleEl.textContent = title;
                _.show(this.titleEl);
            }
            else {
                _.hide(this.titleEl);
            }
            if (description) {
                this.descriptionEl.innerHTML = description;
                _.show(this.descriptionEl);
            }
            else {
                _.hide(this.descriptionEl);
            }
            if (tags) {
                this.tagsEl.textContent = tags;
                _.show(this.tagsEl);
            }
            else {
                _.hide(this.tagsEl);
            }
            if (featureName) {
                this.element.classList.add('featureTip');
                this.element.classList.add(featureName);
                this.element.setAttribute('feature', featureName);
            }
            else {
                this.element.classList.remove('featureTip');
            }
            this.show();
            let offset = hintEl.getBoundingClientRect();
            let gutsHeight = _.height(this.gutsEl);
            let topOffset = offset.top - gutsHeight - 5;
            let topAdjustment = parseInt(data['topAdjustment'] || '0');
            let leftAdjustment = parseInt(data['leftAdjustment'] || '0');
            this.element.style.top = (topOffset + topAdjustment) + 'px';
            if (data['align'] === 'right') {
                let rightAdjustment = parseInt(data['rightAdjustment'] || '0');
                this.element.style.right = (8 + rightAdjustment) + 'px';
            }
            else {
                if (data['position'] === 'auto') {
                    leftAdjustment += offset.left;
                }
                this.element.style.left = (20 + leftAdjustment) + 'px';
            }
            if (!hintEl.matches('.clickable'))
                return;
            let clickOutObserver = _.observe(document, 'click', e => {
                var target = e.target;
                if (!target.closest('#tooltip'))
                    return;
                this.hide();
                hintEl.classList.remove('show');
                clickOutObserver.stop();
            });
        }
        show() {
            this.element.classList.remove('hide');
            this.element.classList.add('show');
        }
        hide(e) {
            if (e) {
                let hintEl = e.currentTarget;
                hintEl.classList.remove('show');
            }
            let feature = this.element.dataset['feature'];
            if (feature) {
                this.element.classList.remove(feature);
                this.element.dataset['feature'] = null;
            }
            this.element.classList.remove('show', 'featureTip');
            this.element.classList.add('hide');
        }
    }
    CM.tip = new Tooltip();
    CM.PageActions = {
        open(e) {
            let pageManagerBlock = document.querySelector('#pageManagerBlock');
            let linkEl = e.target;
            if (pageManagerBlock.matches('.editingPages')) {
                CM.ObjectBlock.get(linkEl).edit();
                return;
            }
            let slug = linkEl.dataset['slug'];
            if (!slug)
                return;
            if (linkEl.matches('.page') && slug != 'home') {
                CM.portfolio.bridge.navigate('/' + slug);
                Carbon.Router.instance.navigate('/portfolio/' + slug);
            }
        },
        async toggleVisibility(e) {
            let liEl = e.target.closest('li');
            let id = liEl.dataset['id'];
            e.target.classList.toggle('visible');
            e.target.classList.toggle('hidden');
            liEl.classList.toggle('visible');
            liEl.classList.toggle('hidden');
            let visible = liEl.matches('.visible');
            let data = {
                visibility: visible ? 'visible' : 'hidden'
            };
            await _.patchJSON(`/pages/${id}`, data);
            _.trigger(liEl, 'saved', { reload: true });
            CM.portfolio.bridge.updateBlock('nav', {});
        }
    };
    CM.SiteActions = {
        togglePreview() {
            CM.SiteActions[CM.portfolio.previewing ? 'unpreview' : 'preview']();
        },
        preview() {
            document.body.classList.add('previewing');
        },
        unpreview() {
            document.body.classList.remove('previewing');
        }
    };
})(CM || (CM = {}));
Carbon.formatters.set('address', (data) => {
    return Promise.resolve(data.lines.join(' '));
});
Carbon.formatters.set('markdown', function (data) {
    let formData = new FormData();
    data.append('text', this.form.fields[0].value);
    return fetch('/markdown', {
        method: 'POST',
        body: formData
    }).then(response => response.text());
});
var Carbon;
(function (Carbon) {
    Carbon.blockFormatters = {
        customWord(blockEl, data) {
            blockEl.querySelector('label').textContent = data.name;
            blockEl.querySelector('.preview').textContent = data.text;
        },
    };
    class StringMap {
        constructor(url) {
            this.url = url;
            this.url = url;
        }
        patch(data) {
            return _.send(this.url, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        }
    }
    Carbon.StringMap = StringMap;
    class Popout {
        constructor(element, options) {
            this.mask = new Carbon.Mask();
            this.fixed = false;
            if (!element)
                throw new Error('[Popout] element not found');
            this.element = element;
            if (this.element.matches('.setup'))
                throw new Error('[Popout] Already setup');
            this.options = options || {};
            let dataset = this.element.dataset;
            this.fixed = dataset['position'] !== 'absolute';
            if (dataset['maskAction'] == 'close') {
                this.options.maskAction = 'close';
            }
            this.options.maskZIndex = parseInt(dataset['maskZIndex'] || '5000');
            this.options.maskClass = dataset['maskClass'] || 'transparent';
            this.originEl = this.element;
            this.parentEl = this.element.parentElement;
            this.element.addEventListener('requestClose', this.close.bind(this), false);
            this.element.classList.add('setup');
            this.arrowEl = this.element.querySelector('.arrow');
            window.addEventListener('resize', this.layout.bind(this));
            Popout.map.set(this.element, this);
        }
        static get(element, options) {
            let el = (typeof element === 'string') ? document.querySelector(element) : element;
            return Popout.map.get(el) || new Popout(el, options);
        }
        on(type, listener) {
            this.element.addEventListener(type, listener, false);
        }
        toggle() {
            this[this.isOpen ? 'close' : 'open']();
        }
        open() {
            if (this.isOpen)
                return;
            this.mask.setZIndex(this.options.maskZIndex);
            this.mask.element.className = 'mask ' + this.options.maskClass;
            this.originBox = this.originEl.getBoundingClientRect();
            if (this.fixed) {
                this.mask.show();
                let liEl = this.element.closest('li');
                liEl && liEl.classList.add('gearOpen');
                this.element.remove();
                document.body.appendChild(this.element);
                this.element.classList.remove('closed');
                this.element.classList.add('open');
                this.layout();
                if (this.options.maskAction !== 'none') {
                    _.one(this.mask.element, 'click', this.close.bind(this));
                }
            }
            else {
                this.element.classList.remove('closed');
                this.element.classList.add('open');
            }
            _.trigger(this.element, 'popout:open', { instance: this });
        }
        close() {
            if (!this.isOpen)
                return;
            this.element.classList.remove('open');
            this.element.classList.add('closed');
            Array.from(document.querySelectorAll('.gearOpen')).forEach(el => {
                el.classList.remove('gearOpen');
            });
            if (this.fixed) {
                this.element.remove();
                this.unposition();
                this.parentEl.appendChild(this.element);
            }
            _.trigger(this.element, 'close', {
                instance: this
            });
            this.mask.hide();
        }
        layout() {
            if (!this.isOpen)
                return;
            const topMargin = 10;
            const bottomMargin = 10;
            let align = this.options.align;
            let position = {
                top: this.originBox.top,
                left: this.originBox.left
            };
            if (align && align.includes('right')) {
                position.left = this.originBox.right;
            }
            if (align && align.includes('middle')) {
                position.top += this.originEl.clientHeight / 2;
            }
            let height = this.element.clientHeight;
            let windowHeight = window.innerHeight;
            this.element.style.maxHeight = (windowHeight - (topMargin + bottomMargin)) + 'px';
            let topAdjustment = 0;
            if (this.options.verticalAlign == 'middle') {
                topAdjustment -= (height / 2);
            }
            let top = topAdjustment + position.top;
            let bottom = windowHeight - (height + position.top) - topAdjustment;
            if ((top) <= topMargin) {
                topAdjustment = topMargin - position.top;
            }
            else if (bottom <= bottomMargin) {
                topAdjustment = -(position.top) + windowHeight - height - bottomMargin;
            }
            this.element.style.position = 'fixed';
            this.element.style.top = (position.top + topAdjustment) + 'px';
            this.element.style.left = position.left + 'px';
            this.element.style.zIndex = '5001';
            if (this.arrowEl) {
                let elBox = this.element.getBoundingClientRect();
                let diff = this.originBox.top - elBox.top;
                this.arrowEl.style.top = diff + 'px';
            }
        }
        unposition() {
            this.element.style.position = null;
            this.element.style.top = null;
            this.element.style.left = null;
            this.element.style.zIndex = null;
        }
        get isOpen() {
            return this.element.matches('.open');
        }
    }
    Popout.map = new WeakMap();
    Carbon.Popout = Popout;
})(Carbon || (Carbon = {}));
(function (CM) {
    CM.CheckboxActions = {
        toggle(e) {
            let el = e.target;
            let inputName = el.dataset['inputName'];
            el.classList.toggle('on');
            el.classList.toggle('off');
            let formEl = el.closest('form');
            let inputEl = formEl.querySelector(`input[name='${inputName}']`);
            if (inputEl) {
                inputEl.value = el.matches('.on').toString().toLowerCase();
            }
            if (el.hasAttribute('on-change')) {
                Carbon.ActionKit.dispatch({
                    type: 'change',
                    target: el,
                    value: el.matches('.on')
                });
            }
        }
    };
    CM.ModeActions = {
        change(e) {
            let modeSwitcherEl = e.target.closest('.modeSwitcher');
            let el = document.querySelector(modeSwitcherEl.dataset['selector']);
            el.classList.toggle(e.target.dataset['name']);
        }
    };
    CM.PopoutActions = {
        toggle(e) {
            Carbon.Popout.get(e.target).toggle();
        },
        cancel(e) {
            Carbon.Popout.get(e.target.closest('.popout')).close();
        },
        open(e) {
            let { popoutOrigin } = e.target.dataset;
            let popoutEl = document.getElementById(e.id);
            if (!popoutEl) {
                throw new Error(`[Popout]: No element #${e.id}`);
            }
            let popout = Carbon.Popout.get(popoutEl, {
                verticalAlign: 'middle',
                maskAction: 'none'
            });
            if (popoutOrigin) {
                let parts = popoutOrigin.split(':');
                popout.originEl = document.querySelector(parts[0]);
                if (parts.length > 1) {
                    popout.options.align = parts[1];
                }
            }
            else {
                popout.originEl = e.target;
            }
            popout.open();
        }
    };
    CM.ChoiceActions = {
        save(e) {
            let selectedEl = e.target.querySelector('.selected');
            let controlEl = e.target.closest('.control');
            let control = Carbon.Control.get(controlEl);
            control.selectElement(selectedEl);
        },
        updateBackingField(e) {
            let backingField = e.target.dataset['backingField'];
            if (backingField) {
                let inputEl = document.querySelector(backingField);
                if (inputEl) {
                    inputEl.value = e.value;
                }
            }
        }
    };
    CM.OptionActions = {
        reset(e) {
            let blockEl = e.target.closest('.override');
            blockEl.classList.remove('overridden');
            if (blockEl.matches('.toggleBlock')) {
                let toggleEl = blockEl.querySelector('.toggle');
                let { name, remote } = toggleEl.dataset;
                let defaultValue = toggleEl.dataset['default'] === 'true';
                CM.ToggleActions._setState(toggleEl, defaultValue);
                let map = new Carbon.StringMap(remote.replace('flags', 'style'));
                map.patch({ [name]: null });
                return;
            }
            let controlEl = document.getElementById(blockEl.id.replace('Block', 'Chooser'));
            let control = Carbon.Control.get(controlEl);
            control.reset();
        },
        select(e) {
            let el = e.target;
            let optionsEl = el.closest('.options');
            if (!optionsEl)
                throw new Error('no closest .options');
            let value = el.dataset['value'];
            for (var selectedEl of Array.from(optionsEl.querySelectorAll('.selected'))) {
                selectedEl.classList.remove('selected');
            }
            el.classList.add('selected');
            _.trigger(el, 'option:select', {
                value: value
            });
        },
        save(e) {
            let targetEl = e.target;
            let control = Carbon.Control.get(targetEl.closest('.control'));
            control.selectElement(targetEl);
        }
    };
    CM.PageManagerActions = {
        open() { PageManager.instance.open(); },
        close() { PageManager.instance.close(); }
    };
    class PageManager {
        constructor() {
            this.element = document.querySelector('#pageManagerBlock');
            this.element.addEventListener('reordered', this.onReordered.bind(this), false);
            this.element.addEventListener('block:saved', this.onChange.bind(this), false);
        }
        open() {
            CM.portfolio.bridge.invoke('showNav');
            this.element.classList.add('editingPages');
        }
        close() {
            CM.portfolio.bridge.invoke('hideNav');
            this.element.classList.remove('editingPages');
            Array.from(document.querySelectorAll('#pageList .editing')).forEach(el => {
                CM.ObjectBlock.get(el).cancel();
            });
        }
        onReordered(e) {
            CM.portfolio.bridge.updateBlock('nav', {});
        }
        onChange(e) {
            let data = e.detail.data;
            CM.portfolio.bridge.updateBlock('nav', {});
            if (data && data.slug) {
                let sectionTitleEl = document.querySelector(`section.${data.slug} .breadcrumb > h1`);
                if (sectionTitleEl) {
                    sectionTitleEl.textContent = data.title;
                }
            }
        }
    }
    PageManager.instance = new PageManager();
    CM.PageManager = PageManager;
    CM.ToggleActions = {
        async save(e) {
            let el = e.target;
            let { name, remote } = el.dataset;
            let on = el.matches('.on');
            CM.ToggleActions._setState(el, !on);
            let value = !on;
            let detail = {
                name: name,
                value: value
            };
            _.trigger(el, 'toggle:change', detail);
            let data = await _.patchJSON(remote, detail);
            _.trigger(el, 'toggle:saved', detail);
        },
        _setState(toggleEl, on) {
            let blockEl = toggleEl.closest('.toggleBlock, .togglable');
            let override = blockEl.matches('.override');
            toggleEl.classList.add(on ? 'on' : 'off');
            toggleEl.classList.remove(on ? 'off' : 'on');
            blockEl.classList.add(on ? 'on' : 'off');
            blockEl.classList.remove(on ? 'off' : 'on');
            override && blockEl.classList.add('overridden');
        }
    };
    CM.CoverPageActions = {
        edit() {
            CM.portfolio.bridge.invoke('editCover');
        }
    };
    CM.ContentBlockActions = {
        async edit(e) {
            let partialUrl = e.target.dataset['partialUrl'];
            let partial = null;
            if (!partialUrl)
                return;
            switch (partialUrl) {
                case '/profile/education':
                    partial = '/profile/experiences';
                    partialUrl = '/degrees';
                    break;
                case '/profile/experience':
                    partial = '/profile/experiences';
                    partialUrl = '/positions';
                    break;
                case '/profile/awards':
                case '/profile/exhibitions':
                case '/profile/publications':
                    partial = '/profile/experiences';
                    partialUrl = '/' + partialUrl.split('/')[2];
                    break;
            }
            await CM.MiscSection.load(partialUrl, partial);
            CM.MiscSection.open(e.target);
        }
    };
    CM.MiscSection = {
        element: document.querySelector('section.misc'),
        extraClass: 'none',
        observer: null,
        open(blockEl) {
            CM.MiscSection.element.classList.remove('editing');
            mainEl.style.marginLeft = CM.MiscSection.element.clientWidth + 'px';
            CM.MiscSection.observer = _.observe(CM.MiscSection.element, 'change', (e) => {
                if (!e || !e.detail)
                    return;
                blockEl.classList.toggle('empty', e.detail.empty);
            });
            CM.sitePreview.fix();
            return Panel.forwards(CM.last, CM.MiscSection.element);
        },
        async load(url, partial) {
            let html = await _.getPartial(url, partial);
            CM.MiscSection.element.querySelector('.guts').innerHTML = html;
            let dataEl = CM.MiscSection.element.querySelector('.data');
            if (dataEl) {
                let data = dataEl.dataset;
                CM.MiscSection.element.querySelector('.breadcrumb > h1').textContent = data['title'];
                let addItemEl = CM.MiscSection.element.querySelector('.addItem');
                addItemEl.textContent = data['addText'];
                addItemEl.setAttribute('on-click', data['addAction']);
                CM.MiscSection.extraClass = data['extraClass'];
                if (CM.MiscSection.extraClass) {
                    CM.MiscSection.element.classList.add(CM.MiscSection.extraClass);
                }
            }
            Carbon.DOM.onChange();
            return true;
        }
    };
    let mainEl = document.querySelector('main');
    document.addEventListener('field:change', () => {
        document.body.classList.remove('saved');
    });
    CM.MiscSectionActions = {
        async close() {
            mainEl.style.marginLeft = null;
            await Panel.back(CM.MiscSection.element, CM.last);
            document.querySelector('section.misc .guts').innerHTML = '';
            CM.MiscSection.extraClass && CM.MiscSection.element.classList.remove(CM.MiscSection.extraClass);
            CM.MiscSection.observer.stop();
            CM.sitePreview.unfix();
        }
    };
    CM.SortableActions = {
        setup(e) {
            let el = e.target;
            if (el.matches('.setup'))
                return;
            let action = el.dataset['reorderAction'];
            let sortable = new Carbon.Sortable(el, {
                handle: '.orderHandle',
                axis: 'y',
                update: save
            });
            async function save() {
                let orderedIds = Array.from(el.children).map(el => el.dataset['id']);
                await _.postJSON(action, { ids: orderedIds });
                _.trigger(document, 'saved', { reload: true });
            }
            sortable.on('update', save);
            el.classList.add('setup');
        }
    };
})(CM || (CM = {}));
(function (CM) {
    CM.HexColorActions = {
        setup(e) {
            var control = Carbon.Control.get(e.target.closest('.control'));
            let target = e.target;
            let inputEl = target.querySelector('input');
            let pickerEl = target.querySelector('.colorPicker');
            let previewEl = e.target.querySelector('.preview');
            target.addEventListener('click', e => {
                if (e.target.matches('.custom, .dot')) {
                    pickerEl.classList.add('open');
                    inputEl.select();
                }
            });
            target.querySelector('.cancel').addEventListener('click', () => {
                pickerEl.classList.remove('open');
            });
            target.querySelector('.save').addEventListener('click', async () => {
                Color.parse(inputEl.value).then(save, () => { inputEl.classList.add('invalid'); });
            });
            inputEl.addEventListener('keydown', async (e) => {
                if (e.which !== 13)
                    return;
                try {
                    let color = await Color.parse(inputEl.value);
                    this.save(color);
                }
                catch (err) {
                    inputEl.classList.add('invalid');
                }
            });
            let save = (color) => {
                target.dataset['value'] = color.value;
                inputEl.style.color = color.value;
                inputEl.value = color.value;
                target.classList.remove('selected');
                target.style.backgroundColor = color.value;
                previewEl.style.backgroundColor = color.value;
                control.selectElement(target);
                pickerEl.classList.remove('open');
            };
            inputEl.addEventListener('input', async (e) => {
                try {
                    let color = await Color.parse(inputEl.value);
                    inputEl.classList.remove('invalid');
                    inputEl.style.color = color.value;
                    previewEl.style.backgroundColor = color.value;
                }
                catch (err) {
                }
            });
        }
    };
    class Color {
        constructor(value) {
            this.value = value;
        }
        static async parse(text) {
            let result = await _.postJSON('/colors/validate', {
                text: text
            });
            if (!result.valid) {
                throw new Error('Invalid color');
            }
            return new Color(result.value);
        }
    }
    CM.Color = Color;
})(CM || (CM = {}));
(function (Carbon) {
    ;
    class Control {
        constructor(element) {
            this.element = element;
            if (!element)
                throw new Error('[Control] element undefined');
            this.optionsEl = this.element.querySelector('.options');
            if (!this.optionsEl)
                throw new Error('no closest .options');
            let delegatorSelector = element.dataset['delegatorSelector'];
            this.blockEl = document.querySelector(delegatorSelector) || this.element;
            this.valueEl = this.blockEl.querySelector('.value');
            Control.instances.set(this.element, this);
        }
        static get(element, options) {
            let el = (typeof element === 'string')
                ? document.querySelector(element)
                : element;
            if (!el)
                throw new Error('[Control] element not found');
            return Control.instances.get(el) || new Control(el);
        }
        get entity() {
            return this.optionsEl.dataset['entity'];
        }
        get name() {
            return this.optionsEl.dataset['name'];
        }
        get remote() {
            return this.optionsEl.dataset['remote'];
        }
        get type() {
            return this.blockEl.dataset['type'];
        }
        get override() {
            return this.blockEl.matches('.override');
        }
        async reset() {
            let defaultOption = this.getDefault();
            this.select(defaultOption);
            if (this.name === 'projectLayout') {
                let blockEl = document.querySelector('#projectThumbnailsOverrideBlock');
                if (blockEl) {
                    blockEl.classList.toggle('hidden', defaultOption.value !== 'flipbook');
                }
            }
            let map = new Carbon.StringMap(this.remote);
            await map.patch({ [this.name]: null });
            _.trigger(document, 'saved', { reload: true });
        }
        get selected() {
            let el = this.optionsEl.querySelector('.selected');
            if (!el)
                return null;
            return new Carbon.Option(el);
        }
        getDefault() {
            let defaultEl = this.optionsEl.querySelector('.default');
            if (!defaultEl)
                throw new Error('no .default option');
            return new Carbon.Option(defaultEl);
        }
        select(option) {
            let selected = this.selected;
            if (selected) {
                selected.unselect();
            }
            option.select();
            let selectBlockEl = option.element.closest('.selectBlock');
            if (selectBlockEl) {
                let placeholderEl = selectBlockEl.querySelector('.placeholder');
                placeholderEl.textContent = option.element.textContent;
            }
            if (!this.valueEl)
                return;
            let controlValue = new ControlValue(this.valueEl);
            if (this.type === 'hexColorChooser') {
                var value = option.value;
                if (option.value.startsWith('#')) {
                    value = option.value.substring(1);
                }
                controlValue.update(this.name, '#' + value);
            }
            else {
                controlValue.update(this.name, option.value);
            }
        }
        selectElement(targetEl) {
            if (targetEl.matches('.selected'))
                return;
            let oldValue;
            let oldOption = this.selected;
            if (oldOption)
                oldValue = oldOption.value;
            let newOption = new Option(targetEl);
            this.select(newOption);
            this._save(newOption.value, oldValue);
            _.trigger(targetEl, 'requestClose');
        }
        async _save(value, oldValue) {
            let dic = {
                [this.name]: value
            };
            let detail = {
                name: this.name,
                value: value,
                oldValue: oldValue
            };
            if (this.entity) {
                detail.entity = this.entity;
            }
            _.trigger(this.element, 'option:change', detail);
            let map = new Carbon.StringMap(this.remote);
            let response = await map.patch(dic);
            if (!response.ok)
                throw new Error('error saving map');
            let entity = response.headers.get('x-entity');
            ;
            if (entity) {
                detail.entity = entity;
            }
            _.trigger(this.element, 'option:saved', detail);
            if (this.override) {
                this.blockEl.classList.add('overridden');
            }
            if (this.type == 'hexColorChooser') {
                for (let el of Array.from(document.querySelectorAll(`[bind-to='${this.name}']`))) {
                    new Option(el).setColor(value);
                }
            }
            switch (this.name) {
                case 'colorScheme': {
                    let designEl = document.querySelector('section.design');
                    designEl.classList.remove(oldValue);
                    designEl.classList.add(value);
                    break;
                }
                case 'fontScheme': {
                    Array.from(document.querySelectorAll('#titleTypefaceBlock, #titleTypefaceChooser')).forEach(el => {
                        el.classList.remove('sans', 'serif');
                        el.classList.add(value);
                    });
                    for (var name of ['#titleFontChooser', '#coverTitleFontChooser']) {
                        if (!document.querySelector(name))
                            return;
                        let control = Control.get(name);
                        if (control.overridden)
                            return;
                        let defaultOption = control.findOption(value === 'sans' ? 'karla' : 'merriweather');
                        control.select(defaultOption);
                    }
                    break;
                }
                case 'vibe': {
                    if (value === 'color') {
                        let valueEl = document.querySelector('#vibeBlock .value');
                        if (document.querySelector('#moodChooser')) {
                            let currentMood = Control.get('#moodChooser').selected;
                            valueEl.classList.remove('mood-1', 'mood-2', 'mood-3');
                            valueEl.classList.add('mood-' + currentMood.value);
                        }
                    }
                    break;
                }
                case 'thumbnailTextPlacement': {
                    let subtitleBlockEl = document.querySelector('#projectSubtitleFieldBlock');
                    if (subtitleBlockEl) {
                        let shouldShow = value === 'inside' || value === 'hover';
                        subtitleBlockEl.classList.toggle('hidden', !shouldShow);
                    }
                    break;
                }
                case 'thumbTextPlacement': {
                    let projectSubtitleFieldBlockEl = document.querySelector('#projectSubtitleFieldBlock');
                    projectSubtitleFieldBlockEl.classList[value !== 'hidden' ? 'remove' : 'add']('hidden');
                }
                case 'projectLayout': {
                    Array.from(document.querySelectorAll('#projectThumbnailsBlock, #projectThumbnailsOverrideBlock')).forEach(el => {
                        el.classList.toggle('hidden', value !== 'flipbook');
                    });
                    break;
                }
            }
            if (this.name === 'mood') {
                let v = this.name + '-' + value;
                Array.from(document.querySelectorAll('.vibe-color, .thumbHover-colorHover')).forEach(el => {
                    el.classList.remove('mood-1', 'mood-2', 'mood-3');
                    el.classList.add(v);
                });
            }
        }
        get overridden() {
            return this.blockEl.matches('.overridden');
        }
        findOption(name) {
            for (var optionEl of Array.from(this.optionsEl.children)) {
                if (optionEl.dataset['value'] === name) {
                    return new Option(optionEl);
                }
            }
            return null;
        }
    }
    Control.instances = new WeakMap();
    Carbon.Control = Control;
    class ControlValue {
        constructor(element) {
            this.element = element;
            this.element = element;
        }
        update(name, value) {
            if (value.startsWith('#')) {
                this.element.style.backgroundColor = value;
                return;
            }
            Array.from(this.element.classList)
                .filter(el => el.startsWith(name + '-'))
                .forEach(className => { this.element.classList.remove(className); });
            this.element.classList.add(name + '-' + value);
        }
    }
    Carbon.ControlValue = ControlValue;
    class Option {
        constructor(element) {
            this.element = element;
            this.element = element;
        }
        setColor(color) {
            if (color.length === 6) {
                color = '#' + color;
            }
            this.element.style.backgroundColor = color;
        }
        select() {
            this.element.classList.add('selected');
        }
        unselect() {
            this.element.classList.remove('selected');
        }
        get value() {
            return this.element.dataset['value'];
        }
    }
    Carbon.Option = Option;
})(Carbon || (Carbon = {}));
