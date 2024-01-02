"use strict";
var CM;
(function (CM) {
    CM.themeId = parseInt(document.body.dataset['themeId'] || '2');
    class Bridge {
        constructor(path = '/') {
            this.host = document.body.dataset['themeHost'] || 'preview.carbonmade.com';
            this.path = path;
            this.refresh();
            window.addEventListener('message', this.receive.bind(this), false);
        }
        setThemeId(id) {
            CM.themeId = id;
            this.refresh();
        }
        reload() {
            this.invoke('reload');
        }
        refresh() {
            let url = 'https://' + this.host + this.path + '?themeId=' + CM.themeId;
            CM.sitePreview.element.src = url;
        }
        receive(e) {
            if (!e.data)
                return;
            if (typeof e.data === 'string') {
                if (!e.data.startsWith('{'))
                    return;
            }
            else {
                return;
            }
            const message = JSON.parse(e.data);
            switch (message.type) {
                case 'navigate':
                    this.onNavigate(message);
                    break;
                case 'editBlock':
                    this.editBlock(message.data);
                    break;
                case 'edit':
                    this.edit(message);
                    break;
                case 'update':
                    this.update(message);
                    break;
                case 'authorize':
                    this.authorize(message);
                    break;
            }
            switch (message.action) {
                case 'destroy':
                    this.destroy(message);
                    break;
            }
        }
        async authorize(data) {
            let response = await fetch('/uploads/authorize', {
                method: 'POST'
            });
            let authorization = await response.json();
            let message = {
                type: 'authorization',
                data: authorization
            };
            this.send(message);
        }
        notify(data) {
            this.send({
                type: 'notification',
                data: data
            });
        }
        change(name, value) {
            this.send({
                action: 'change',
                data: {
                    entity: name,
                    value: value,
                    version: 3
                }
            });
        }
        updateBlock(name, data) {
            this.send({
                action: 'updateBlock',
                data: {
                    name: name,
                    data: data
                }
            });
        }
        onNavigate(message) {
            if (this.path == message.path)
                return;
            this.path = message.path;
            CM.portfolio.onNavigate(this.path);
        }
        navigate(url) {
            if (this.path == url)
                return;
            this.path = url;
            this.invoke('load', url);
        }
        invoke(name, data) {
            let message = {
                action: name,
                data: data
            };
            this.send(message);
        }
        send(message) {
            if (!message)
                throw new Error('Message is empty');
            if (this.other === undefined) {
                this.other = CM.sitePreview.element.contentWindow;
            }
            if (!this.other || this.other.postMessage === undefined) {
                console.log('Other window is not defined');
                return;
            }
            this.other.postMessage(JSON.stringify(message), '*');
        }
        async edit(data) {
            let entity = parseEntity(data.entity || data.model);
            switch (entity.type) {
                case 'post': {
                    CM.PostActions._edit(entity.id);
                    break;
                }
                case 'piece': {
                    let piece = await _.getJSON(`/pieces/${entity.id}`);
                    switch (entity.attribute) {
                        case 'text': {
                            CM.TextEditor.get().open(piece);
                            break;
                        }
                        case 'thumbnail': {
                            if (data.action === 'pick') {
                                CM.FrameChooser.get().open(piece);
                            }
                            break;
                        }
                    }
                }
            }
        }
        async update(message) {
            let entity = parseEntity(message.entity || message.model);
            let request;
            console.log('update', entity);
            if (entity.attribute === 'cover') {
                let url = `/${entity.type}s/${entity.id}/cover`;
                let method = message.action === 'remove' ? 'DELETE' : 'PATCH';
                request = _.sendJSON(url, method, message.data);
            }
            else if (entity.attribute === 'style') {
                let url = `/${entity.type}s/${entity.id}/style`;
                await _.patchJSON(url, message.data);
                let key = Object.keys(message.data)[0];
                this.notify({
                    type: 'change',
                    entity: `${entity.type}#${entity.id}.style`,
                    name: key,
                    value: message.data[key]
                });
                return;
            }
            else if (entity.type === 'piece' && entity.attribute === 'thumbnail') {
                let url = `/pieces/${entity.id}/thumbnail`;
                if (message.action === 'remove') {
                    request = _.send(url, { method: 'DELETE' }).then(response => response.json());
                }
                else {
                    request = _.patchJSON(url, message.data);
                }
            }
            if (!request)
                return;
            let result = await request;
            _.trigger(document, 'saved', {
                reload: true
            });
            if (entity.attribute === 'cover') {
                this.notify({
                    type: message.action === 'remove' ? 'remove' : 'change',
                    name: entity.attribute,
                    value: result
                });
                return;
            }
        }
        destroy(message) {
            let entity = parseEntity(message.entity || message.model);
            switch (entity.type) {
                case 'post':
                    CM.PostActions._destroy(entity.id);
                    break;
            }
        }
        async editBlock(data) {
            if (data.id.includes('thumbnail')) {
                let project = new CM.Project({
                    id: data.spec.projectId
                });
                if (data.action === 'reset') {
                    let image = await project.resetThumbnail();
                    CM.ProjectThumbnailActions.onReset(image);
                }
                else if (data.action === "pick") {
                    CM.ThumbnailPicker.get().open(data.spec);
                }
                else if (data.uploadId) {
                    let image = await project.updateThumbnail({ uploadId: data.uploadId });
                    CM.ProjectThumbnailActions.onSaved(image, data.spec);
                }
                else {
                    let cropper = CM.ThumbnailCropper.get();
                    cropper.element.classList.remove('backable');
                    console.log(data.spec);
                    cropper.open(data.spec);
                }
            }
        }
    }
    CM.Bridge = Bridge;
    function parseEntity(text) {
        let parts = text.split('.');
        let entity = {
            type: parts[0].split('#')[0]
        };
        if (parts[0].includes('#')) {
            entity.id = parts[0].split('#')[1];
        }
        if (parts.length > 1) {
            entity.attribute = text.substring(text.indexOf('.') + 1);
        }
        return entity;
    }
    CM.parseEntity = parseEntity;
})(CM || (CM = {}));
