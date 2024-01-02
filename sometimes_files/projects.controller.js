"use strict";
var CM;
(function (CM) {
    _.observe(CM.Sections.project.element, 'block:saved', (e) => {
        let block = e.detail.instance;
        if (e.detail.created) {
            block.element.classList.remove('adding');
            let nameField = block.form.fields[0];
            let textField = block.form.fields[1];
            nameField.remove();
            var data = e.detail.data;
            block.formatter = Carbon.formatters.get('standard');
            block.form.element.setAttribute('method', 'PATCH');
            block.form.element.action = block.form.element.action + 's';
            textField.input.name = data.name;
            Array.from(block.element.querySelectorAll('label, legend')).forEach(el => {
                el.textContent = data.name;
            });
            CM.CustomDetailBlock.append();
        }
        else if (e.detail.response.headers.get("x-removed")) {
            block.remove();
        }
    });
    CM.CustomDetailActions = {
        async remove(e) {
            let block = Carbon.EditBlock.get(e.target.closest('.editBlock'));
            block.form.fields[0].value = '';
            await block.form.send();
            block.element.classList.add('removed');
        }
    };
    CM.CustomDetailBlock = {
        append() {
            let project = Project.current();
            let customDetailBlock = Carbon.Template.get('customDetailBlock');
            let wordListEl = document.querySelector('#projectDetailsGroup');
            wordListEl.appendChild(customDetailBlock.render());
        }
    };
    Carbon.formatters.set('customDetail', (data) => {
        return Promise.resolve(data.text);
    });
    class TextEditor {
        constructor() {
            this.element = document.querySelector('#textEditor');
            this.modal = Carbon.Modal.get(this.element);
            this.textInput = this.element.querySelector('textarea');
            this.typeSelector = Dropdown.get(document.querySelector('.textTypeSelector'));
            _.observe(this.textInput, 'input', e => {
                if (!this.pieceId)
                    return;
                this.element.classList.toggle('empty', !this.textInput.value);
            });
        }
        static get() {
            return TextEditor.instance || (TextEditor.instance = new TextEditor());
        }
        open(piece) {
            this.element.classList.remove('empty');
            if (piece != null && piece.id) {
                this.pieceId = piece.id;
                this.textInput.value = piece.description;
                if (piece.style != null && piece.style.class) {
                    this.typeSelector.selectValue(piece.style.class);
                }
            }
            else {
                this.pieceId = null;
                this.textInput.value = '';
                this.typeSelector.selectValue('paragraph');
            }
            this.modal.open();
            setTimeout(() => {
                this.textInput.select();
            }, 200);
        }
        save() {
            if (this.pieceId) {
                let request = _.patchJSON(`/pieces/${this.pieceId}`, {
                    description: this.textInput.value,
                    type: this.typeSelector.getValue(),
                });
                request.then(piece => {
                    let pieceEl = document.querySelector('#piece_' + piece.id);
                    pieceEl && CM.Piece.get(pieceEl).reload();
                    this.modal.close();
                    _.trigger(this.element, 'saved', {
                        reload: true,
                        data: piece
                    });
                });
                return request;
            }
            return this.create();
        }
        async destroy() {
            let projectId = Project.current().id;
            let pieceEl = document.querySelector('#piece_' + this.pieceId);
            let url = `/projects/${projectId}/pieces/${this.pieceId}`;
            await _.send(url, { method: 'DELETE' });
            pieceEl.remove();
            this.modal.close();
            CM.Sections.project.reload();
            _.trigger(document, 'saved', { reload: true });
        }
        async create() {
            let piecesEl = document.querySelector('ul.pieces');
            let data = {
                type: this.typeSelector.getValue(),
                projectId: Project.current().id,
                text: this.textInput.value
            };
            let model = await _.postJSON('/text', data);
            let html = await _.getHTML(`/pieces/${model.id}?partial=block`);
            piecesEl.insertAdjacentHTML('beforeend', html);
            this.modal.close();
            document.querySelector('#projectPieceManager').classList.add('changed');
            return true;
        }
    }
    CM.TextEditor = TextEditor;
    CM.SourceActions = {
        openSourceMenu(e) {
            e.target.classList.add('active');
            let popout = Carbon.Popout.get('#pieceSourceMenu');
            _.one(popout.element, 'close', () => {
                document.querySelector('#pieceSourceSelector').classList.remove('active');
            });
            popout.open();
        },
        closeMenu() {
            Carbon.Popout.get('#pieceSourceMenu').close();
        },
        select(e) {
            CM.SourceActions.closeMenu();
            switch (e.id) {
                case 'dropbox':
                    PieceController.get().pieceManager.dropbox.open();
                    break;
                case 'local':
                    document.querySelector('#projectPieceManager .filePicker').click();
                    break;
            }
        }
    };
    CM.DropdownActions = {
        open(e) {
            let el = e.target.closest('.dropdown');
            Dropdown.get(el).open();
        },
        toggle(e) {
            let el = e.target.closest('.dropdown');
            Dropdown.get(el).open();
        }
    };
    class Dropdown {
        constructor(element) {
            this.element = element;
            this.currentEl = this.element.querySelector('.current');
            this.optionsEl = this.element.querySelector('.options');
            this.optionsEl.addEventListener('click', this.selectOption.bind(this));
        }
        static get(element) {
            return Dropdown.map.get(element) || new Dropdown(element);
        }
        open() {
            this.element.classList.add('open');
        }
        close() {
            this.element.classList.remove('open');
        }
        getValue() {
            var selectedEl = this.optionsEl.querySelector('.selected');
            return selectedEl.dataset['value'];
        }
        selectValue(value) {
            for (var el of Array.from(this.optionsEl.children)) {
                if (el.dataset['value'] === value) {
                    this.internalSelect(el);
                }
            }
        }
        selectOption(e) {
            let optionEl = e.target.closest('li, .option');
            optionEl && this.internalSelect(optionEl);
        }
        internalSelect(optionEl) {
            for (var selectedEl of Array.from(this.optionsEl.querySelectorAll('.selected'))) {
                selectedEl.classList.remove('selected');
            }
            this.currentEl.textContent = optionEl.textContent;
            this.currentEl.className = optionEl.className + ' current';
            optionEl.classList.add('selected');
            this.close();
        }
    }
    Dropdown.map = new WeakMap();
    CM.Dropdown = Dropdown;
    CM.TextActions = {
        new() {
            TextEditor.get().open();
            Carbon.Popout.get('#pieceSourceMenu').close();
        },
        destroy() {
            TextEditor.get().destroy();
        },
        save() {
            TextEditor.get().save();
        }
    };
    CM.NoticeActions = {
        dismiss(e) {
            let noticeEl = e.target.closest('carbon-notice');
            noticeEl && noticeEl.classList.remove('show');
            Array.from(document.querySelectorAll('.piece.removed')).forEach(el => {
                el.remove();
            });
        }
    };
    CM.Notice = {
        show(name, message) {
            let el = document.querySelector('#' + name + 'Notice');
            el.classList.add('show');
            if (message) {
                el.querySelector('.message').innerHTML = message;
            }
        },
        hide(name) {
            document.querySelector('#' + name + 'Notice').classList.remove('show');
        },
        hideAll() {
            Array.from(document.querySelectorAll('carbon-notice.show')).forEach(el => {
                el.classList.remove('show');
            });
            Array.from(document.querySelectorAll('.piece.removed')).forEach(el => el.remove());
        }
    };
    class PieceHelper {
        static getSelected() {
            return Array.from(document.querySelectorAll('.piece.selected'));
        }
        static countSelected() {
            return document.querySelectorAll('.piece.selected').length;
        }
    }
    CM.PiecesActions = {
        unselectAll() {
            PieceHelper.getSelected().forEach(el => el.classList.remove('selected'));
            document.querySelector('#projectPieceManager').classList.remove('selectedPieces');
        },
        removeSelected() {
            Array.from(document.querySelectorAll('.piece.removed')).forEach(el => el.remove());
            let selectedEls = PieceHelper.getSelected();
            selectedEls.forEach(el => el.classList.add('removed'));
            CM.PiecesActions.unselectAll();
            let pieceIds = selectedEls.map(el => el.dataset['id']);
            let project = Project.current();
            _.send(`${project.url}/pieces`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: pieceIds }),
            });
            CM.PiecesActions._check();
            let removedCount = selectedEls.length;
            let note = (removedCount === 1)
                ? 'Piece deleted.'
                : removedCount + ' pieces were deleted.';
            CM.Notice.show('removedPieces', note);
        },
        undoRemoveSelected() {
            CM.PiecesActions._undo();
            CM.Notice.hide('removedPieces');
        },
        cancelNewProject() {
            document.querySelector('#pieceMover').classList.remove('addingProject');
        },
        newProject() {
            document.querySelector('#pieceMover').classList.add('addingProject');
            let form = Carbon.Form.get('#pieceMover form');
            let titleInput = form.element.querySelector("input[name='title']");
            if (titleInput) {
                titleInput.value = '';
                titleInput.select();
            }
            form.on('sent', e => {
                console.log('new project created', e.result);
                CM.PiecesActions.moveSelectedTo(e.result.id);
                form.off('sent');
            });
        },
        moveSelected(e) {
            let el = e.target;
            let projectId = parseInt(el.dataset['projectId']);
            CM.PiecesActions.moveSelectedTo(projectId);
        },
        undoMoveSelected() {
            CM.PiecesActions._undo();
            CM.Notice.hide('movedPieces');
        },
        moveSelectedTo(projectId) {
            Array.from(document.querySelectorAll('.piece.removed')).forEach(el => el.remove());
            let selectedEls = PieceHelper.getSelected();
            selectedEls.forEach(el => el.classList.add('removed'));
            CM.PiecesActions.unselectAll();
            let pieceIds = selectedEls.map(el => el.dataset['id']);
            let data = {
                ids: pieceIds,
                toId: projectId
            };
            let fromId = Project.current().id;
            _.postJSON(`/projects/${fromId}/pieces/move`, data);
            let movedPiecesCount = selectedEls.length;
            let note = (movedPiecesCount === 1)
                ? 'Piece moved.'
                : movedPiecesCount + ' pieces were moved.';
            CM.Notice.show('movedPieces', note);
            document.querySelector('#movedPiecesNotice .viewProject').setAttribute('on-click', `project#${projectId}:view`);
            let pieceMover = Carbon.Popout.get('#pieceMover');
            pieceMover.element.classList.remove('addingProject');
            pieceMover.close();
            CM.PiecesActions._check();
        },
        openMover(e) {
            let el = e.target;
            CM.Notice.hideAll();
            el.classList.add('active');
            let popout = Carbon.Popout.get('#pieceMover', {
                position: 'fixed'
            });
            _.one(popout.element, 'close', () => {
                document.querySelector('.openMover').classList.remove('active');
            });
            popout.open();
            let gutsEl = popout.element.querySelector('.guts');
            let project = Project.current();
            _.getPartial('/projects?include=none', 'pieceMoverMenu').then(html => {
                gutsEl.innerHTML = html;
                let liEl = document.querySelector('li.project_' + project.id);
                liEl && liEl.remove();
            });
        },
        _check() {
            let activePieces = document.querySelectorAll('#projectPieceManager .piece:not(.removed)');
            let managerEl = document.querySelector('#projectPieceManager');
            managerEl.classList.toggle('empty', activePieces.length === 0);
        },
        _undo() {
            let pieceIds = Array.from(document.querySelectorAll('.pieces > .piece')).map(el => el.dataset['id']);
            let project = Project.current();
            let request = _.send(`${project.url}/pieces`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: pieceIds })
            });
            Array.from(document.querySelectorAll('.piece.removed')).forEach(el => {
                el.classList.remove('removed');
            });
            CM.PiecesActions._check();
        }
    };
    CM.PieceActions = {
        play(e) {
            CM.Piece.get(e.target.closest('.piece')).play();
        },
        select(e) {
            let pieceEl = e.target.closest('.piece');
            let managerEl = pieceEl.closest('.pieceManager');
            pieceEl.classList.toggle('selected');
            let selectedCount = PieceHelper.countSelected();
            managerEl.classList.toggle('selectedPieces', selectedCount > 0);
            _.trigger(managerEl, 'selection', {
                selectedCount: selectedCount
            });
            Array.from(document.querySelectorAll('.selectionCount')).forEach(el => {
                el.textContent = selectedCount.toString();
            });
        },
        destroy(e) {
            CM.Piece.get(e.target.closest('.piece')).remove();
        },
        remove(e) {
            CM.Piece.get(e.target.closest('.piece')).remove();
        }
    };
    CM.CaptionBlockActions = {
        editing(e) {
            CM.Notice.hideAll();
            e.target.closest('.piece').classList.add('editingCaption');
        },
        closed(e) {
            e.target.closest('.piece').classList.remove('editingCaption');
        }
    };
    class PieceController {
        constructor() {
            this.element = document.getElementById('projectPieceManager');
            this.viewer = new CM.PieceViewer();
            this.sorting = false;
            if (PieceController.instance)
                throw new Error('[PieceController] already setup');
            this.quota = new CM.Quota({
                count: 1,
                limit: 10000
            });
            this.pieceManager = new CM.PieceManager(this.element, {
                quota: this.quota
            });
            Pointless.fizz(100);
            this.element.querySelector('.done').addEventListener('click', this.close.bind(this), false);
            _.observe(this.element, 'saved', this.onSaved.bind(this));
            this.element.addEventListener('click', this.onClick.bind(this));
        }
        static get() {
            return PieceController.instance || (PieceController.instance = new PieceController());
        }
        onClick(e) {
            let target = e.target;
            if (target.closest('.caption') || target.matches('.action'))
                return;
            let pieceEl = target.closest('.piece');
            pieceEl && this.pieceClicked(pieceEl, e);
        }
        async pieceClicked(pieceEl, e) {
            if (pieceEl.matches('.removed, .processing, .uploading, .queued'))
                return;
            let piece = CM.Piece.get(pieceEl);
            if (PieceHelper.countSelected() > 0) {
                e.preventDefault();
                e.stopPropagation();
                CM.PieceActions.select(e);
            }
            if (piece.isText) {
                let data = await _.getJSON(`/pieces/${piece.id}`);
                TextEditor.get().open(data);
            }
            else if (piece.type === 'audio') {
                if (e.target.getAttribute('on-click') != null) {
                }
                else {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }
            else if (piece.type === 'video') {
                e.preventDefault();
                e.stopPropagation();
                this.viewer.view(piece);
            }
        }
        onSaved() {
            this.element.classList.add('changed');
        }
        async open(data) {
            this.id = data.id;
            this.pieceManager.piecesEl.innerHTML;
            PM.expandIn();
            history.replaceState(null, null, `/portfolio/projects/${this.id}/pieces`);
            let result = await this.load(data);
            this.onOpen();
            return result;
        }
        onOpen() {
            _.removeWhitespace(this.pieceManager.piecesEl);
        }
        close() {
            PM.collapseOut();
            if (this.element.querySelectorAll('.removed').length > 0) {
                this.element.classList.add('changed');
            }
            if (this.element.matches('.changed')) {
                CM.Sections.project.reload();
                _.trigger(document, 'saved', { reload: true });
            }
            this.element.classList.remove('changed');
            Array.from(document.querySelectorAll('.pieceManagerNotice')).forEach(el => {
                el.classList.remove('show');
            });
            this.element.classList.remove('hasNotice');
            CM.Notice.hideAll();
            history.replaceState(null, null, `/portfolio/projects/${this.id}`);
        }
        async load(data) {
            this.id = data.id;
            this.element.classList.add('loading');
            this.element.classList.add(data.type);
            let dataset = this.element.dataset;
            dataset['entityType'] = 'project';
            dataset['entityId'] = data.id;
            dataset['entityPath'] = '/projects/' + data.id;
            let response = await fetch(`/projects/${this.id}/pieces`, {
                headers: { 'x-partial': 'index' }
            });
            let title = decodeURI(response.headers.get('x-project-title') || '');
            document.querySelector('.projectTitle').textContent = title;
            let html = await response.text();
            this.pieceManager.piecesEl.innerHTML = Carbon.DOM.parse(html).innerHTML;
            let pieceEls = document.querySelectorAll('.pieces > .piece');
            this.element.classList.toggle('empty', pieceEls.length === 0);
            for (var pieceEl of Array.from(pieceEls)) {
                if (pieceEl.classList.contains('processing')) {
                    new CM.Piece(pieceEl).check();
                }
            }
            this.element.classList.remove('loading');
            return true;
        }
        get isOpen() {
            return this.element.matches('.open');
        }
    }
    CM.PieceController = PieceController;
    CM.ProjectActions = {
        view(e) {
            PieceController.get().close();
            let path = `/projects/${e.id}`;
            CM.portfolio.bridge.navigate(path);
            CM.portfolio.onNavigate(path);
            CM.Notice.hideAll();
        },
        async add() {
            let data = await _.postJSON('/projects', {
                title: "Untitled"
            });
            let path = `/projects/${data.id}`;
            ProjectQuota.instance.decrement(1);
            CM.portfolio.bridge.navigate(path);
            CM.portfolio.onNavigate(path);
            document.body.classList.remove('onboarding');
        },
        editPieces(e) {
            PieceController.get().open(e);
        },
        destroy(e) {
            _.trigger(e.target, 'requestClose');
            new Project(e).destroy();
        },
        publish(e) {
            _.trigger(e.target, 'requestClose');
            new Project(e).publish();
        },
        unpublish(e) {
            _.trigger(e.target, 'requestClose');
            new Project(e).unpublish();
        },
        archive(e) {
            _.trigger(e.target, 'requestClose');
            new Project(e).archive();
        },
        unarchive(e) {
            new Project(e).unarchive();
        },
        restore(e) {
            new Project(e).restore();
        },
        async uploadPieces(e) {
            if (!e.files)
                return;
            let controller = PieceController.get();
            await controller.open(e);
            controller.pieceManager.uploader.addFiles(e.files);
        }
    };
    class Project {
        constructor(attributes) {
            Object.assign(this, attributes);
        }
        static current() {
            return new Project({
                id: document.getElementById('projectData').dataset['id']
            });
        }
        get url() {
            return `/projects/${this.id}`;
        }
        updateThumbnail(data) {
            return _.patchJSON(`${this.url}/thumbnail`, data);
        }
        async resetThumbnail() {
            var response = await _.send(`${this.url}/thumbnail`, { method: 'DELETE' });
            return await response.json();
        }
        async destroy() {
            let response = await _.send(this.url, { method: 'DELETE' });
            ProjectQuota.instance.set(JSON.parse(response.headers.get('x-project-quota')));
            let projectIsOpen = document.querySelector('section.project.show');
            if (projectIsOpen) {
                Carbon.Router.instance.navigate('/portfolio/projects');
            }
            else {
                let projectEl = document.querySelector('#project_' + this.id);
                projectEl.classList.add('deleted');
                let openGearEl = document.querySelector('.projectGear.open');
                openGearEl && _.trigger(openGearEl, 'requestClose');
                _.trigger(document, 'saved', { reload: true });
            }
        }
        async publish() {
            let response = await _.post(`${this.url}/publish`);
            let data = await response.json();
            CM.Sections.project.reload();
            CM.portfolio.hideNotice('projectIsHidden');
        }
        async unpublish() {
            let url = `/projects/${this.id}/unpublish`;
            await _.post(url);
            CM.Sections.project.reload();
            CM.portfolio.showNotice('projectIsHidden');
        }
        async restore() {
            let projectEl = document.querySelector('#project_' + this.id);
            projectEl && projectEl.classList.remove('deleted');
            let url = `/projects/${this.id}/restore`;
            let response = await _.post(url);
            ProjectQuota.instance.set(JSON.parse(response.headers.get('x-project-quota')));
            _.trigger(projectEl, 'restored');
            _.trigger(document, 'saved', { reload: true });
        }
        async archive() {
            let projectGearEl = document.querySelector('.projectGear.open');
            let projectEl = document.querySelector('#project_' + this.id);
            projectGearEl && _.trigger(projectGearEl, 'requestClose');
            projectEl && projectEl.classList.add('justArchived');
            let resoonse = await this.setFlag('archived', true);
            ProjectQuota.instance.increment(1);
            if (document.querySelector('section.project.show')) {
                Carbon.Router.instance.navigate('/portfolio/projects');
            }
            else {
                _.trigger(document, 'saved', { reload: true });
            }
        }
        async unarchive() {
            let request = this.setFlag('archived', false);
            let openGearEl = document.querySelector('.projectGear.open');
            let projectEl = document.querySelector('#project_' + this.id);
            openGearEl && _.trigger(openGearEl, 'requestClose');
            projectEl && projectEl.classList.remove('justArchived');
            let response = await request;
            ProjectQuota.instance.decrement(1);
            CM.portfolio.bridge.reload();
            await ProjectList.get().reload();
        }
        setFlag(name, value) {
            return _.send(`/projects/${this.id}/flags`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name,
                    value: value
                })
            });
        }
    }
    CM.Project = Project;
    class ProjectQuota {
        constructor() {
            this.count = parseInt(document.body.dataset['projectCount']);
            this.limit = parseInt(document.body.dataset['projectLimit']);
        }
        get remaining() {
            return Math.max(this.limit - this.count, 0);
        }
        increment(count) {
            this.count -= count;
            this.onChange();
        }
        decrement(count) {
            this.count += count;
            this.onChange();
        }
        set(attributes) {
            this.count = attributes.count;
            this.limit = attributes.limit;
            this.onChange();
        }
        async onChange() {
            document.body.classList.toggle('reachedProjectLimit', this.remaining === 0);
            projectManagerEl.classList.toggle('empty', this.count === 0);
            if (this.count === 0) {
                let html = await _.getHTML('/projects?partial=empty');
                projectManagerEl.querySelector('.emptyGuts').innerHTML = html;
                return;
            }
            let nearingProjectLimitEl = document.querySelector('.nearingProjectLimit');
            if (this.remaining <= 2 && this.remaining !== 0) {
                nearingProjectLimitEl.classList.add('show');
                nearingProjectLimitEl.querySelector('span').textContent = this.remaining.toString() + ' project' + (this.remaining != 1 ? 's' : '');
            }
            else {
                nearingProjectLimitEl.classList.remove('show');
            }
        }
    }
    ProjectQuota.instance = new ProjectQuota();
    CM.ProjectQuota = ProjectQuota;
    CM.ProjectThumbnailActions = {
        onReset(image) {
            CM.portfolio.bridge.notify({
                type: 'change',
                entity: 'project#0.thumbnail',
                name: 'thumbnail',
                value: image
            });
        },
        async onSaved(image, spec) {
            let cropper = ThumbnailCropper.get();
            if (spec.size != 'native') {
                let a = await _.getJSON(`/media/${image.id}/transform?height=2000&width=2000&flag=<`);
                new CM.Media(a).load().then(cropper.open.bind(cropper));
            }
            CM.portfolio.bridge.notify({
                type: 'change',
                entity: 'project#0.thumbnail',
                name: 'thumbnail',
                value: image
            });
        }
    };
    class ThumbnailPicker {
        constructor() {
            this.element = document.querySelector('#thumbnailPicker');
            this.modal = Carbon.Modal.get(this.element);
            this.changed = false;
            this.gutsEl = this.element.querySelector('.guts');
            let doneEl = this.element.querySelector('.done');
            _.observe(doneEl, 'click', this.save.bind(this));
            let blockEl = document.querySelector('#projectThumbBlock');
            if (blockEl && blockEl.dataset['size'] !== 'native') {
                _.hide(doneEl);
            }
            this.gutsEl.addEventListener('click', this.onClick.bind(this));
        }
        static get() {
            return ThumbnailPicker.instance || (ThumbnailPicker.instance = new ThumbnailPicker());
        }
        onClick(e) {
            let target = e.target;
            let liEl = target.closest('li');
            liEl && this.onPicked(liEl);
        }
        onPicked(target) {
            this.selectedId = parseInt(target.dataset['id']);
            Array.from(this.gutsEl.querySelectorAll('.selected')).forEach(el => {
                el.classList.remove('selected');
            });
            target.classList.add('selected');
            let blockEl = document.querySelector('#projectThumbBlock');
            if (this.size !== 'native') {
                this.save();
            }
        }
        async save() {
            if (!this.selectedId) {
                this.close();
                return;
            }
            this.changed = true;
            let project = new Project({
                id: this.projectId
            });
            let image = await project.updateThumbnail({ imageId: this.selectedId });
            this.onSaved(image);
        }
        onSaved(image) {
            if (this.size === 'native') {
                this.close();
                CM.portfolio.bridge.notify({
                    type: 'change',
                    entity: 'project#0.thumbnail',
                    name: 'thumbnail',
                    value: image
                });
                return;
            }
            let cropper = ThumbnailCropper.get();
            image.size = this.size;
            image.projectId = this.projectId;
            cropper.open(image);
            cropper.changed = true;
            cropper.element.classList.add('backable');
        }
        async open(spec) {
            this.gutsEl.innerHTML = '';
            this.spec = spec;
            this.projectId = spec.projectId;
            this.size = spec.size;
            let html = await _.getPartial(`/projects/${this.projectId}`, '/components/thumbnailPicker.guts');
            this.gutsEl.innerHTML = html;
            this.modal.open();
        }
        cancel() {
            if (this.changed) {
                let project = new Project({
                    id: this.spec.projectId
                });
                project.updateThumbnail({
                    transform: this.spec.transform,
                    imageId: this.spec.id
                }).then(this.close.bind(this));
                return;
            }
            this.close();
        }
        close() {
            this.modal.close();
        }
        get isOpen() {
            return this.element.matches('.open');
        }
    }
    CM.ThumbnailPicker = ThumbnailPicker;
    class ThumbnailCropper {
        constructor() {
            this.element = document.querySelector('#thumbnailCropper');
            this.cropper = new Carbon.Cropper(this.element.querySelector('.cropper'));
            this.modal = Carbon.Modal.get(this.element);
            this.changed = false;
            this.cropper.on('end', () => {
                this.changed = true;
            });
            this.element.querySelector('.done').addEventListener('click', this.onDone.bind(this));
        }
        static get() {
            return ThumbnailCropper.instance || (ThumbnailCropper.instance = new ThumbnailCropper());
        }
        setViewportSize(width, height) {
            this.cropper.viewport.setSize(width, height);
            this.element.style.width = width + 'px';
            this.element.style.height = height + 'px';
        }
        async show(data) {
            let url = `/media/${data.id}/transform?height=2000&width=2000&flag=<`;
            let image = await _.getJSON(url);
            this.changed = false;
            this.size = data.size;
            this.projectId = data.projectId;
            this.cropper.setImage(image);
            if (data.transform) {
                this.cropper.setTransform(data.transform);
            }
            else {
                this.cropper.center();
            }
            this.element.classList.remove('empty');
        }
        open(data) {
            console.log('open thumbnail cropper', data);
            if (this.isOpen)
                return;
            if (!data.id)
                throw new Error('[Cropper] id missing');
            if (!data.size.includes('x'))
                return;
            let size = data.size.split('x');
            this.setViewportSize(parseInt(size[0]), parseInt(size[1]));
            if (data && data.id) {
                this.show(data);
            }
            this.modal.open();
        }
        async onDone() {
            if (!this.changed) {
                this.close();
                return;
            }
            let project = new Project({
                id: this.projectId
            });
            let image = await project.updateThumbnail({
                transform: this.cropper.getTransform().toString(),
                size: this.size
            });
            this.close();
            CM.portfolio.bridge.notify({
                type: 'change',
                entity: `project#{project.id}.thumbnail`,
                name: 'thumbnail',
                value: image
            });
        }
        close() {
            this.modal.close();
            let picker = ThumbnailPicker.get();
            if (picker.isOpen)
                picker.close();
        }
        get isOpen() {
            return this.element.matches('.open');
        }
    }
    CM.ThumbnailCropper = ThumbnailCropper;
    CM.ProjectListActions = {
        filter(e) {
            let el = e.target;
            if (el.matches('.current'))
                return;
            let currentEl = el.closest('.filter').querySelector('.current');
            currentEl && currentEl.classList.remove('current');
            let name = el.dataset['name'];
            ProjectList.get().filterList(name);
            el.classList.add('current');
        }
    };
    let projectManagerEl = document.querySelector('.projectManager');
    class ProjectList {
        constructor() {
            this.element = document.querySelector('.projectList');
            this.filter = 'active';
            this.sortable = new Carbon.Sortable(this.element, {
                axis: 'both',
                animation: 50
            });
            this.sortable.on('update', this.reorder.bind(this));
            window.addEventListener('resize', () => {
                Array.from(document.querySelectorAll('.projectGear.open')).forEach(el => {
                    _.trigger(el, 'requestClose');
                });
            });
            this.element.addEventListener('click', this.onClick.bind(this));
        }
        static get() {
            return ProjectList.instance || (ProjectList.instance = new ProjectList());
        }
        onClick(e) {
            let target = e.target;
            let projectEl = target.closest('.project');
            if (!projectEl
                || projectEl.matches('.deleted')
                || this.sortable.moved
                || this.filter === 'archived'
                || target.closest('.popout, .action'))
                return;
            let id = projectEl.dataset['id'];
            let path = `/portfolio/projects/${id}`;
            Carbon.Router.instance.navigate(path);
        }
        filterList(name) {
            this.element.classList.remove(this.filter + 'Filter');
            this.element.innerHTML = '';
            this.filter = name;
            document.querySelector('.projectList').classList.remove('show');
            this.element.innerHTML = '';
            this.reload();
        }
        async open() {
            projectManagerEl.querySelector('.content').scrollTop = 0;
            let mainEl = document.querySelector('main');
            mainEl.style.marginLeft = this.element.clientWidth + 'px';
            CM.sitePreview.fix();
            Panel.forwards(CM.last || CM.Sections.main.element, projectManagerEl);
            await this.reload();
        }
        async reload() {
            this.element.innerHTML = '';
            let url = `/projects/?filter=${this.filter}`;
            let html = await _.getPartial(url, 'list');
            this.element.innerHTML = html;
            this.element.classList.add(this.filter + 'Filter');
            if (this.filter === 'archived') {
                let empty = this.element.children.length === 0;
                projectManagerEl.classList.toggle('empty', empty);
                if (empty) {
                    let html = await _.getPartial('/projects', 'emptyArchive');
                    projectManagerEl.querySelector('.emptyGuts').innerHTML = html;
                }
            }
            else {
                ProjectQuota.instance.onChange();
            }
            this.sortable.disabled = this.filter === 'archived';
            document.querySelector('.projectList').classList.add('show');
            Carbon.Scrollable.get(document.querySelector('.projectManager .scrollable')).poke();
            return true;
        }
        async reorder() {
            let ids = Array.from(this.element.children).map(el => el.dataset['id']);
            await _.postJSON('/projects/reorder', {
                ids: ids
            });
            _.trigger(document, 'saved', { reload: true });
        }
        get isOpen() {
            return projectManagerEl.matches('.show');
        }
    }
    CM.ProjectList = ProjectList;
})(CM || (CM = {}));
