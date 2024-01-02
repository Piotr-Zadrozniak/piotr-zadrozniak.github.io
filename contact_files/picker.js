"use strict";
var CM;
(function (CM) {
    class PieceManager {
        constructor(element, options) {
            this.uploadedPieces = [];
            this.element = element;
            let accept = [
                'avif', 'bmp', 'heic', 'jpg', 'jpeg', 'jxr', 'jxl', 'png', 'psd', 'gif', 'tiff', 'tif', 'ico',
                'pdf'
            ];
            if (CM.portfolio.pro) {
                accept.push.apply(accept, [
                    'aiff', 'aac', 'flac', 'm4a', 'mp3', 'oga', 'opus', 'wav', 'wma',
                    'avi', 'flv', 'f4v', 'm4v', 'mov', 'mp4', 'mv4', 'mpg', 'mpeg', 'mov', 'ogg', 'ogv', 'webm', 'wmv', 'qt'
                ]);
            }
            this.piecesEl = this.element.querySelector('ul.pieces');
            if (!this.piecesEl)
                throw new Error('[PieceManager] ul.pieces missing');
            this.quota = options.quota;
            let filePickerEl = this.element.querySelector('.filePicker');
            let filePicker2El = this.element.querySelector('.filePicker2');
            this.dropbox = new Carbon.DropboxChooser('3ta2xeuzehs6pob');
            this.uploader = new Carbon.UploadManager({
                url: 'https://carbon-media-uploads.accelerator.net/',
                uploadLimit: 1000,
                maxSize: '2048MB',
                log: (message) => { console.log(message); },
                accept: accept,
                inputs: [new Carbon.FileDrop(this.element),
                    new Carbon.FileInput(filePickerEl, { multiple: true }),
                    new Carbon.FileInput(filePicker2El, { multiple: true }),
                    this.dropbox
                ]
            });
            this.dropbox.loadScript();
            let batchProgressEl = this.element.querySelector('.batchProgress');
            this.progressMeter = new Carbon.BatchProgressMeter(batchProgressEl);
            this.progressMeter.observe(this.uploader);
            this.uploader.on('add', this.onFilesAdded.bind(this));
            this.uploader.on('complete', this.onBatchUploaded.bind(this));
            this.uploader.on('progress', this.onBatchProgress.bind(this));
            let sortable = new Carbon.Sortable(this.piecesEl, {
                scrollSensitivity: 125,
                handle: '.thumbnail, .textPreview',
            });
            sortable.on('start', CM.Notice.hideAll);
            sortable.on('update', this.reorder.bind(this));
            _.observe(this.element, 'selection', (e) => {
                if (e.detail.selectedCount > 0) {
                    sortable.disable();
                }
                else {
                    sortable.enable();
                }
            });
        }
        onBatchProgress(e) {
            let currentUploadNumberEl = document.querySelector('.currentUploadNumber');
            if (currentUploadNumberEl) {
                currentUploadNumberEl.textContent = (this.uploader.completedCount + 1).toString();
            }
        }
        async onBatchUploaded() {
            this.uploader.reset();
            let callbacks = this.uploadedPieces.map(p => p.created);
            try {
                await Promise.all(callbacks);
            }
            catch (err) {
                console.log('batch error', err);
            }
            this.onPiecesCreated();
        }
        onPiecesCreated() {
            this.element.classList.remove('uploading');
            this.element.classList.add('ready', 'completed', 'changed');
        }
        reorder() {
            let orderedIds = Array.from(this.piecesEl.children)
                .map(el => el.dataset['id'])
                .filter(p => !!p);
            let action = `${this.element.dataset['entityPath']}/pieces/reorder`;
            _.postJSON(action, { ids: orderedIds });
            _.trigger(document, 'saved');
            this.element.classList.add('changed');
        }
        reset() {
            this.setState('empty');
            this.uploadedPieces = [];
            for (var el of Array.from(this.piecesEl.querySelectorAll('.upload'))) {
                el.remove();
            }
            this.uploader.reset();
        }
        setState(state) {
            this.element.classList.remove('empty', 'browsing', 'uploading', 'uploaded', 'ready');
            this.element.classList.add(state);
        }
        async onFilesAdded(e) {
            if (e.rejected.length > 0) {
                for (var rejection of e.rejected) {
                    if (rejection.type && rejection.type.startsWith('video')) {
                        CM.IntroductionModal.get().show('videoUploadsRequirePaidPlan');
                        return;
                    }
                    if (rejection.type && rejection.type.startsWith('audio')) {
                        CM.IntroductionModal.get().show('audioUploadsRequirePaidPlan');
                        return;
                    }
                }
            }
            CM.Notice.hideAll();
            if (e.queued.length === 0)
                return;
            this.element.classList.remove('empty');
            for (var removedPieceEl of Array.from(document.querySelectorAll('.piece.removed'))) {
                removedPieceEl.remove();
            }
            let response = await fetch('/uploads/authorize?count=' + e.queued.length, {
                method: 'POST'
            });
            let authorizations = await response.json();
            for (let i = 0; i < e.queued.length; i++) {
                let upload = e.queued[i];
                let authorization = authorizations[i];
                if (upload.authorization) {
                }
                else {
                    upload.url = authorization.url;
                    upload.method = 'PUT';
                    upload.authorization = authorization;
                }
                if (this.quota.remaining === 0 && this.quota.consumeOverage)
                    continue;
                console.log('add upload', upload);
                let piece = this.addUpload(upload);
                this.quota.increaseUsage();
            }
            this.startUploader();
            let uploadBatchSize = document.querySelector('.uploadBatchSize');
            if (uploadBatchSize) {
                uploadBatchSize.textContent = e.queued.length.toString();
            }
        }
        startUploader() {
            if (this.uploader.queue.length < 1) {
                return;
            }
            this.setState('uploading');
            this.uploader.start();
        }
        addUpload(upload) {
            upload.on('start', u => {
                let currentUploadEl = document.querySelector('.currentUpload');
                if (currentUploadEl) {
                    currentUploadEl.querySelector('.fileName').textContent = upload.name;
                }
            });
            upload.promise.then(result => {
                let data = {
                    uploadId: result.blob.id
                };
                switch (this.element.dataset['entityType']) {
                    case 'project':
                        data.projectId = this.element.dataset['entityId'];
                        break;
                    case 'post':
                        data.containerKey = this.element.dataset['entityKey'];
                        break;
                }
                return _.send('/pieces?partial=block', {
                    method: 'POST',
                    body: JSON.stringify(data),
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }).then(response => { return response.text(); }).then(html => {
                    let pieceEl = parseHTML(html);
                    this.piecesEl.appendChild(pieceEl);
                    let piece = new Piece(pieceEl);
                    this.uploadedPieces.push(piece);
                });
            }).catch(e => {
                console.log('piece error', e);
            });
        }
    }
    CM.PieceManager = PieceManager;
    function parseHTML(text) {
        let div = document.createElement('div');
        div.innerHTML = text;
        return div.children[0];
    }
    ;
    let PieceStatus;
    (function (PieceStatus) {
        PieceStatus[PieceStatus["Pending"] = 1] = "Pending";
        PieceStatus[PieceStatus["Created"] = 2] = "Created";
        PieceStatus[PieceStatus["Error"] = 5] = "Error";
    })(PieceStatus || (PieceStatus = {}));
    class Piece {
        constructor(element) {
            this.removed = false;
            if (!element)
                throw new Error('[Piece] element is undefined');
            this.element = element;
            let data = this.element.dataset;
            this.id = data.id;
            if (this.id && !this.isText) {
                let mediaType = data.mediaType;
                this.type = mediaType.split('/')[0];
                if (data.thumbnailId) {
                    this.thumbnail = new CM.Media({
                        id: data.thumbnailId,
                        width: parseInt(data.thumbnailWidth),
                        height: parseInt(data.thumbnailHeight),
                    });
                }
                this.media = {
                    id: data.mediaId,
                    type: mediaType,
                    width: parseInt(data.mediaWidth),
                    height: parseInt(data.mediaHeight)
                };
                if (this.type === 'image' || mediaType.endsWith('pdf')) {
                    this.thumbnail = new CM.Media(this.media);
                }
            }
            if (data.description) {
                this.description = data.description;
            }
            if (this.processing) {
                this.check();
            }
            this.status = (this.id) ? PieceStatus.Created : PieceStatus.Pending;
            Piece.map.set(this.element, this);
        }
        static get(el) {
            return Piece.map.get(el) || new Piece(el);
        }
        async play() {
            this.element.classList.toggle('playing');
            let isPlaying = this.element.classList.contains('playing');
            let data = await _.getJSON(`/pieces/${this.id}`);
            if (!this.audio) {
                this.audio = new Audio(data.media.sources[0].url);
            }
            if (isPlaying) {
                this.audio.play();
            }
            else {
                this.audio.pause();
            }
        }
        get processing() {
            return this.element.matches('.processing');
        }
        setAttributes(attributes) {
            this.id = attributes.id;
            this.media = attributes.media;
            this.status = PieceStatus.Created;
            this.element.dataset['id'] = attributes.id.toString();
            this.element.id = 'piece_' + attributes.id;
            this.attributes = attributes;
            if (!this.media)
                return;
            let mimeParts = this.media.type.split('/');
            this.type = mimeParts[0];
            this.format = mimeParts[1];
            this.element.classList.add(this.type);
            let metaInfoEl = this.element.querySelector('.metaInfo');
            let formEl = this.element.querySelector('form');
            if (formEl) {
                formEl.action = `/pieces/${attributes.id}`;
            }
            if (this.type === 'video') {
                let ok = this.media.sources && this.media.sources.length > 0;
                this.setState(ok ? 'loaded' : 'processing');
            }
            else if (this.type === 'application') {
                this.setState('ok');
                this.element.classList.add(this.format);
                if (this.format === 'pdf') {
                    metaInfoEl.textContent = this.media.pages.length.toString();
                }
            }
            else if (this.type === 'audio') {
                let parts = this.media.duration.split(':');
                metaInfoEl.textContent = (parseInt(parts[1], 10) + ':' + parts[2].split('.')[0]);
                this.setState('loaded');
            }
            else {
                this.setState('loaded');
            }
            this.element.classList.remove('uploading');
        }
        async reload() {
            let html = await _.getHTML(`/pieces/${this.id}?partial=block`);
            let el = parseHTML(html);
            this.element.replaceWith(el);
            this.element = el;
        }
        setProgress(result) {
            if (!this.progressMeter) {
                this.progressMeter = new Carbon.ProgressMeter(this.element.querySelector('.progress'));
                this.progressMeter.setValue(0);
            }
            this.progressMeter.setValue(result.progress / 100);
            switch (result.status.toLowerCase()) {
                case 'ok':
                case 'completed':
                    this.check();
                    break;
                case 'waiting':
                case 'processing':
                    this.setState('processing');
                    break;
            }
        }
        async check() {
            let data = await _.getJSON(`/videos/${this.media.id}`);
            if (data.status.toLowerCase() === "ok") {
                this.setState('loaded');
                this.reload();
            }
        }
        get url() {
            let managerEl = this.element.closest('.pieceManager');
            return managerEl.dataset['entityPath'] + '/pieces/' + this.id;
        }
        remove() {
            if (this.removed)
                return;
            if (this.id) {
                _.send(this.url, { method: 'DELETE' });
            }
            else if (this.upload) {
                this.upload.cancel();
                this.element.remove();
            }
            else {
                throw new Error('was not removed');
            }
            if (this.element.matches('.error')) {
                this.element.remove();
            }
            this.removed = true;
            this.element.classList.add('removed');
            _.trigger(this.element, 'piece:remove', {
                instance: this
            });
        }
        setState(state) {
            this.element.classList.remove('uploaded', 'processing', 'loading', 'loaded', 'error');
            this.element.classList.add(state);
        }
        get isText() {
            return this.element.matches('.text');
        }
    }
    Piece.map = new WeakMap();
    CM.Piece = Piece;
    class PieceViewer {
        constructor() {
            this.element = document.querySelector('#pieceViewer');
            this.modal = Carbon.Modal.get(this.element);
            this.iframe = this.element.querySelector('iframe');
            this.modal.on('close', this.onClose.bind(this));
        }
        onClose() {
            this.modal.close();
            this.iframe.removeAttribute('src');
        }
        open() {
            this.modal.open();
        }
        view(piece) {
            this.element.classList.remove('application');
            if (!this.isOpen) {
                this.element.classList.remove('processing', 'loading', 'loaded');
                this.element.classList.add('loading');
                this.open();
                setTimeout(() => {
                    this.view(piece);
                }, 300);
                return;
            }
            this.current = piece;
            this.setState(piece.type);
            this.iframe.removeAttribute('src');
            this.element.classList.remove('loading');
            this.element.classList.add('loaded', 'video');
            this.iframe.src = `/pieces/${piece.id}`;
            this.iframe.removeAttribute('height');
            this.iframe.removeAttribute('width');
            this.iframe.style.width = '100%';
        }
        setState(state) {
            this.element.classList.remove('video', 'image', 'ready');
            this.element.classList.add(state);
        }
        get isOpen() {
            return this.element.matches('.open');
        }
    }
    CM.PieceViewer = PieceViewer;
    class FrameChooser {
        constructor() {
            this.element = document.getElementById('frameChooser');
            this.modal = Carbon.Modal.get(this.element);
            this.frames = Array.from(document.querySelectorAll('#frames li:not(.custom)'))
                .map(el => new VideoFrame(el));
            let saveEl = this.element.querySelector('.save');
            _.observe(saveEl, 'click', this.save.bind(this));
            this.element.addEventListener('click', this.onClick.bind(this), false);
        }
        static get() {
            return FrameChooser.instance || (FrameChooser.instance = new FrameChooser());
        }
        onClick(e) {
            let frameEl = e.target.closest('li');
            frameEl && this.selectFrame(frameEl);
        }
        on(type, listener) {
            return _.observe(this.element, type, listener);
        }
        selectFrame(frameEl) {
            Array.from(document.querySelectorAll('#frames li.selected')).forEach(el => {
                el.classList.remove('selected');
            });
            frameEl.classList.add('selected');
        }
        setState(state) {
            this.element.classList.remove('saving', 'saved');
            this.element.classList.add(state);
        }
        async save() {
            this.setState('saving');
            let selectedEl = document.querySelector('#frames li.selected');
            let frameUrl = selectedEl.dataset['url'];
            if (!frameUrl)
                return;
            let response = await fetch('/uploads/authorize', {
                method: 'POST'
            });
            let authorization = await response.json();
            let upload = new Carbon.UrlUpload(frameUrl, {
                authorization
            });
            let result = await upload.start();
            await _.patchJSON(`/pieces/${this.piece.id}/thumbnail`, {
                uploadId: result.blob.id
            });
            this.onSaved();
        }
        onSaved() {
            _.trigger(this.element, 'saved', { reload: true });
            this.close();
        }
        open(piece) {
            this.modal.open();
            piece && this.load(piece);
        }
        close() {
            this.modal.close();
        }
        async load(piece) {
            this.piece = piece;
            this.frames.forEach(frame => {
                frame.clear();
            });
            let take = this.frames.length;
            let url = `/videos/${piece.media.id}/frames?take=${take}`;
            let frames = await _.getJSON(url);
            frames.forEach((model, i) => {
                this.frames[i].setModel(model);
            });
        }
    }
    CM.FrameChooser = FrameChooser;
    class VideoFrame {
        constructor(element) {
            this.element = element;
            this.element = element;
        }
        clear() {
            this.element.style.backgroundImage = '';
        }
        setModel(attributes) {
            this.element.dataset['url'] = attributes.url;
            this.element.style.backgroundImage = `url('${attributes.url}')`;
        }
    }
    class Quota {
        constructor(attributes) {
            this.reactive = new Carbon.Reactive();
            this.count = 0;
            this.count = attributes.count;
            this.limit = attributes.limit;
            this.consumeOverage = attributes.consumeOverage || false;
        }
        on(name, callback) {
            return this.reactive.on(name, callback);
        }
        get remaining() {
            return Math.max(this.limit - this.count, 0);
        }
        get limitReached() {
            return this.count >= this.limit;
        }
        get overLimitBy() {
            let delta = this.limit - this.count;
            return (delta >= 0) ? 0 : Math.abs(delta);
        }
        set(attributes) {
            if (attributes.count) {
                this.count = attributes.count;
            }
            ;
            if (attributes.limit) {
                this.limit = attributes.limit;
            }
            this.onChange();
        }
        increaseUsage(value = 1) {
            this.count += value;
            this.onChange();
        }
        decreaseUsage(value = 1) {
            this.count -= value;
            this.onChange();
        }
        onChange() {
            this.reactive.trigger({
                type: 'change',
                quota: this,
                remaining: this.remaining
            });
        }
    }
    CM.Quota = Quota;
})(CM || (CM = {}));
var Carbon;
(function (Carbon) {
    class DropboxChooser {
        constructor(key, options) {
            this.loaded = false;
            this.loading = false;
            this.reactive = new Carbon.Reactive();
            this.key = key;
            if (options && options.accept) {
                this.accept = options.accept;
            }
            this.reactive.subscribe(e => {
                console.log('dropbox batch', e);
            });
        }
        async open() {
            if (!this.loaded) {
                await this.loadScript();
                this._open();
            }
            else {
                this._open();
            }
        }
        subscribe(callback) {
            return this.reactive.subscribe(callback);
        }
        _open() {
            this.loaded = true;
            let options = {
                linkType: 'direct',
                multiselect: true,
                success: this.onSelection.bind(this),
                cancel: this.onCancel.bind(this)
            };
            if (this.accept) {
                options.extensions = this.accept.map(f => '.' + f);
            }
            Dropbox.choose(options);
        }
        setAccept(formats) {
            this.accept = formats;
        }
        onCancel() { }
        async onSelection(files) {
            let response = await fetch('/uploads/authorize?count=' + files.length, {
                method: 'POST'
            });
            let authorizations = await response.json();
            let uploads = [];
            for (var i = 0; i < files.length; i++) {
                let file = files[i];
                let upload = new Carbon.UrlUpload(file.link, {
                    authorization: authorizations[i]
                });
                upload.size = file.size;
                upload.name = file.name;
                upload.source = 'dropbox';
                upload.thumbnailUrl = file.thumbnailLink;
                uploads[i] = upload;
                console.log(file, upload);
            }
            this.reactive.trigger(uploads);
            return uploads;
        }
        loadScript() {
            if (this.loaded)
                return Promise.resolve(true);
            this.loading = true;
            return new Promise((resolve, reject) => {
                let el = document.createElement('script');
                el.id = "dropboxjs";
                el.async = true;
                el.setAttribute('data-app-key', this.key);
                el.addEventListener('load', e => {
                    this.loaded = true;
                    this.loading = false;
                    resolve(true);
                }, false);
                el.src = 'https://www.dropbox.com/static/api/2/dropins.js';
                let headEl = document.getElementsByTagName('head')[0];
                headEl.appendChild(el);
            });
        }
    }
    Carbon.DropboxChooser = DropboxChooser;
})(Carbon || (Carbon = {}));
