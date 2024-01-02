"use strict";
var CM;
(function (CM) {
    function pluralize(name) {
        switch (name) {
            case 'specialty': return 'specialties';
            default: return name + 's';
        }
    }
    CM.ExperienceActions = {
        currentChanged(e) {
            let el = e.target;
            let dateRangeEl = el.closest('.dateRange');
            dateRangeEl.classList.toggle('present', e.value);
        }
    };
    class BlockList {
        constructor(element) {
            this.element = element;
            this.type = this.element.dataset['type'];
            this.addPosition = this.element.dataset['addPosition'];
            this.sectionEl = this.element.closest('section');
            let sortable = new Carbon.Sortable(this.element, {
                axis: 'y',
                handle: '.handle',
                animation: 200
            });
            sortable.on('update', this.reorder.bind(this));
            this.element.addEventListener('block:edit', this.onBlockEdit.bind(this));
            this.element.addEventListener('block:saved', this.onBlockSaved.bind(this));
            this.element.addEventListener('block:deleted', this.onBlockDeleted.bind(this));
            this.element.addEventListener('block:close', this.onBlockClose.bind(this));
            this.element.addEventListener('block:removed', this.onBlockRemoved.bind(this));
            if (this.element.dataset['template']) {
                this.template = Carbon.Template.get(element.dataset['template']);
            }
            BlockList.map.set(this.element, this);
        }
        static get(element) {
            return BlockList.map.get(element) || new BlockList(element);
        }
        async reorder() {
            let orderedIds = Array.from(this.element.children)
                .filter(el => !el.matches('.removed'))
                .map(el => el.dataset['id']);
            let segment;
            if (this.type === 'link') {
                segment = 'links';
            }
            else if (this.type === 'page') {
                segment = 'pages';
            }
            else if (this.type === 'client' || this.type === 'skill' || this.type === 'specialty') {
                segment = 'list-items';
            }
            else {
                segment = 'experiences';
            }
            let data = await _.postJSON(`/${segment}/reorder`, { ids: orderedIds });
            _.trigger(this.element, 'saved', { reload: true });
            _.trigger(this.element, 'reordered');
        }
        onBlockEdit() {
            this.sectionEl.classList.add('editing');
        }
        onBlockDeleted(e) {
            let blockEl = e.target;
            blockEl.remove();
        }
        onBlockSaved(e) {
            if (e.detail.created) {
                this.add();
            }
            this.sectionEl.classList.remove('adding', 'editing', 'empty');
            _.trigger(this.element, 'saved', { reload: true });
            _.trigger(this.element, 'change', {
                empty: false
            });
        }
        onBlockClose() {
            this.sectionEl.classList.remove('adding', 'editing');
        }
        onBlockRemoved() {
            this.sectionEl.classList.remove('adding', 'editing');
            let empty = this.element.querySelectorAll('li:not(.removed)').length === 0;
            _.trigger(this.element, 'saved', { reload: true });
            _.trigger(this.element, 'change', { empty: empty });
            empty && this.sectionEl.classList.add('empty');
        }
        async add() {
            this.sectionEl.classList.add('adding', 'editing');
            if (this.template) {
                let html = this.template.render().outerHTML;
                this.append(html);
            }
            else {
                let html = await _.getPartial(`/${this.type}s/new`);
                this.append(html);
            }
        }
        append(html) {
            this.element.insertAdjacentHTML(this.addPosition || 'afterbegin', html);
            let el = this.addPosition === 'beforeend'
                ? this.element.lastElementChild
                : this.element.firstElementChild;
            el.classList.add('adding', 'editing');
            let block = ObjectBlock.get(el);
            block.form.fields[0].focus();
            return block;
        }
    }
    BlockList.map = new WeakMap();
    CM.BlockList = BlockList;
    Carbon.formatters.set('page', function (value) {
        return Promise.resolve(value.title);
    });
    class ObjectBlock {
        constructor(element) {
            this.changed = false;
            this.element = element;
            if (this.element.matches('.setup')) {
                throw new Error('[ObjectBlock] Already setup');
            }
            this.editGuts = this.element.querySelector('.editGuts');
            this.previewGuts = this.element.querySelector('.previewGuts');
            let { type, id } = this.element.dataset;
            if (!type) {
                type = this.element.closest('[data-type]').dataset['type'];
            }
            if (id) {
                this.entity = new Entity(type.toLowerCase(), id);
            }
            if (this.element.querySelector('form')) {
                this.setup();
                if (this.form.element.hasAttribute('autosave')) {
                    let field = this.form.fields[0];
                    this.form.on('field:change', () => {
                        this.changed = true;
                    });
                    this.form.on('field:blur', () => {
                        if (this.element.matches('.adding')) {
                            if (!field.value)
                                this.cancel();
                        }
                        else if (this.changed) {
                            this.form.send();
                        }
                        else {
                            this.cancel();
                        }
                    });
                    this.form.on('field:focus', () => {
                        this.form.fields[0].select();
                        this.element.classList.add('editing');
                    });
                }
            }
            this.element.classList.add('setup');
            ObjectBlock.map.set(this.element, this);
        }
        static get(element) {
            return ObjectBlock.map.get(element) || new ObjectBlock(element);
        }
        get editing() {
            return this.element.matches('.editing');
        }
        setup() {
            this.form = new Carbon.Form(this.element.querySelector('form'));
            this.form.on('sent', this.onSent.bind(this));
        }
        async onSent(e) {
            let result = e.result;
            if (result.status === 'deleted') {
                _.trigger(this.element, 'block:deleted', { instance: this });
                return;
            }
            if (!this.entity) {
                let type = result.type.toLowerCase() || this.element.dataset['type'];
                this.entity = new Entity(type, result.id);
            }
            this.entity.id = result.id;
            this.element.dataset['id'] = result.id.toString();
            this.form.element.action = this.entity.url;
            this.form.element.method = 'PATCH';
            if (!this.previewGuts) {
                this.element.classList.remove('adding', 'editing');
                _.trigger(this.element, 'block:saved', { instance: this, created: e.created });
                return;
            }
            await this.updatePreview(result);
            this.element.classList.remove('adding', 'editing');
            _.trigger(this.element, 'block:saved', { instance: this });
        }
        async updatePreview(data) {
            if (this.element.dataset['formatter']) {
                let formatter = Carbon.formatters.get(this.element.dataset['formatter']);
                let text = await formatter(data);
                this.element.querySelector('.text').textContent = text;
                return true;
            }
            let url = this.entity.url + '?partial=/blocks/experienceBlock.preview';
            let html = await _.getHTML(url);
            this.previewGuts.innerHTML = html;
            return true;
        }
        async edit() {
            if (!this.form) {
                let url = this.entity.url + '?partial=/blocks/experienceBlock.form';
                let html = await _.getHTML(url);
                this.editGuts.innerHTML = html;
                this.element.classList.add('editing');
                this.setup();
                this.form.fields[0].select();
                _.trigger(this.element, 'block:edit', { instance: this });
            }
            else {
                this.element.classList.add('editing');
                this.form.fields[0].select();
                _.trigger(this.element, 'block:edit', { instance: this });
            }
        }
        cancel() {
            this.element.classList.remove('editing');
            _.trigger(this.element, 'block:close');
            if (this.element.matches('.adding')) {
                this.element.remove();
            }
        }
        async remove() {
            await this.entity.delete();
            this.element.classList.remove('editing');
            this.element.classList.add('removed');
            _.trigger(this.element, 'block:removed');
        }
        restore() {
            this.entity.restore();
            this.element.classList.remove('removed');
        }
    }
    ObjectBlock.map = new WeakMap();
    CM.ObjectBlock = ObjectBlock;
    class Entity {
        constructor(type, id) {
            this.type = type;
            this.id = id;
        }
        get url() {
            return `/${pluralize(this.type)}/${this.id}`;
        }
        delete() {
            return _.send(this.url, { method: 'DELETE' });
        }
        restore() {
            return _.post(`${this.url}/restore`);
        }
    }
    CM.Entity = Entity;
    CM.LinkActions = {
        async add() {
            CM.MiscSection.element.classList.add('editing');
            let linksEditerEl = document.getElementById('linksEditor');
            let html = await _.getPartial(`/links/new`, '/profile/blocks/newLinkBlock');
            linksEditerEl.insertAdjacentHTML('afterbegin', html);
        },
        search(e) {
            let newLinkEl = e.target.closest('.newLink');
            newLinkEl.classList.remove('chosen');
            newLinkEl.classList.add('searching');
            let searchEl = newLinkEl.querySelector("[type='search']");
            searchEl.select();
            let autocomplete = new Carbon.AutoComplete(searchEl.parentElement);
            autocomplete.on('select', CM.LinkActions.select);
        },
        cancel(e) {
            CM.MiscSection.element.classList.remove('editing');
            let newLinkEl = e.target.closest('.newLink');
            newLinkEl.remove();
        },
        select(e) {
            if (!e.detail || !e.detail.data)
                return;
            let { slug } = e.detail.data;
            let newLinkEl = e.target.closest('.newLink');
            CM.LinkActions.load(newLinkEl, slug);
        },
        choose(e) {
            let { slug } = e.target.dataset;
            let newLinkEl = e.target.closest('.newLink');
            Array.from(newLinkEl.querySelectorAll('.linkIcon')).forEach(el => {
                el.classList.add('unselected');
            });
            e.target.classList.remove('unselected');
            e.target.classList.add('selected');
            CM.LinkActions.load(newLinkEl, slug);
        },
        async append(id) {
            let html = await _.getPartial(`/links/${id}`, '/profile/blocks/linkBlock');
            document.querySelector('#linksList').insertAdjacentHTML('afterbegin', html);
        },
        async load(newLinkEl, slug) {
            let editGuts = newLinkEl.querySelector('.editGuts');
            let html = await _.getPartial(`/links/new?type=${slug}`, '/profile/blocks/linkBlock.edit');
            editGuts.innerHTML = html;
            newLinkEl.classList.add('chosen');
            let formEl = editGuts.querySelector('form');
            let form = new Carbon.Form(formEl);
            form.fields[0].select();
            form.on('sent', (e) => {
                if (e.created) {
                    CM.LinkActions.append(e.result.id);
                    let cancelEl = newLinkEl.querySelector('.cancel');
                    cancelEl.click();
                }
            });
        }
    };
    CM.LocationBlockActions = {
        placeSelected(e) {
            console.log('place section', e);
        }
    };
    CM.BlockListActions = {
        setup(e) {
            BlockList.get(e.target);
        },
        add(e) {
            let el = document.getElementById(e.id);
            BlockList.get(el).add();
        }
    };
    CM.BlockActions = {
        edit(e) {
            let block = ObjectBlock.get(e.target.closest('.block, [data-id]'));
            if (block.editing)
                return;
            block.edit();
        },
        remove(e) {
            ObjectBlock.get(e.target.closest('.block, [data-id]')).remove();
        },
        restore(e) {
            ObjectBlock.get(e.target.closest('.block, [data-id]')).restore();
        },
        cancel(e) {
            ObjectBlock.get(e.target.closest('.block, [data-id]')).cancel();
        }
    };
    CM.FieldBlockActions = {
        setup(e) {
            let block = Carbon.FieldBlock.get(e.target);
            block.form.fields[0].select();
        }
    };
})(CM || (CM = {}));
