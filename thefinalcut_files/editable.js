"use strict";
var CM;
(function (CM) {
    CM.EditorBridge = {
        upload: function (file, blockEl) {
            return bridge.getUploadAuthorization().then(function (authorization) {
                console.log('upload authorization', authorization);
                var upload = new Carbon.Upload(file, {
                    url: authorization.url,
                    authorization: authorization,
                    method: 'PUT'
                });
                blockEl.classList.add('uploading');
                var thumbEl = blockEl.querySelector('.thumb');
                return upload.start();
            }).then(function (result) { return result; });
        },
        sendMessage: function (message) {
            if (!window.bridge) {
                throw new Error('bridge is not setup');
            }
            bridge.sendMessage(message);
        },
        executeOld: function (data) {
            var message = {
                type: 'editBlock',
                data: data
            };
            bridge.sendMessage(message);
        }
    };
    var PieceControl = (function () {
        function PieceControl() {
        }
        PieceControl.setup = function (e) {
            var el = e.element;
            if (el.tagName != "CARBON-PIECE") {
                throw new Error('[PieceControl] element must be a carbon-piece');
            }
            el.classList.add('editable');
            var controlEl = document.createElement('carbon-editor');
            controlEl.className = 'pieceEditor';
            var data = e.data;
            var id = data.id;
            if (data.type === 'audio') {
                var html = PieceControl.getIndicatorHtml('edit artwork');
                html +=
                    "<carbon-menu escapable>\n   <carbon-action class=\"upload\">\n    Upload New Image\n    <input type=\"file\" on-change=\"piece:" + id + ":uploadThumbnail\">\n   </carbon-action>";
                if (data.poster && data.poster.custom) {
                    html += "  <carbon-action class=\"reset\" on-click=\"piece:" + id + ":resetThumbnail\">Clear Artwork</carbon-action>";
                }
                html += "  <carbon-action class=\"reset\" on-click=\"menu:close\">Cancel</carbon-action>";
                html += "</carbon-menu>";
            }
            else if (data.type === 'video') {
                var html = PieceControl.getIndicatorHtml('edit poster');
                html += "<carbon-menu escapable>\n   <carbon-action class=\"upload\">\n    Upload New Image\n    <input type=\"file\" on-change=\"piece:" + id + ":uploadThumbnail\">\n   </carbon-action>";
                html += "  <carbon-action class=\"pick\" on-click=\"piece:" + id + ":pickThumbnail\">Select from Video</carbon-action>";
                if (data.poster && data.poster.custom) {
                    html += "  <carbon-action class=\"reset\" on-click=\"piece:" + id + ":resetThumbnail\">Reset Poster</carbon-action>";
                }
                html += "  <carbon-action class=\"reset\" on-click=\"menu:close\">Cancel</carbon-action>";
                html += "</carbon-menu>";
                controlEl.innerHTML = html;
            }
            else if (data.type === "text") {
            }
            el.insertBefore(controlEl, el.childNodes[0]);
        };
        PieceControl.getIndicatorHtml = function (hint) {
            return "<carbon-indicator on-click=\"editor:openMenu\">\n   <span class=\"icon\"></span>\n   <span class=\"hint\">" + hint + "</span>\n </carbon-indicator>";
        };
        return PieceControl;
    }());
    CM.PieceControl = PieceControl;
    CM.PostActions = {
        edit: function (e) {
            CM.Menu.closeAll();
            CM.EditorBridge.sendMessage({
                type: 'edit',
                action: 'edit',
                model: "post#" + e.id
            });
        },
        destroy: function (e) {
            CM.Menu.closeAll();
            CM.EditorBridge.sendMessage({
                action: 'destroy',
                model: "post#" + e.id
            });
        }
    };
    CM.TextActions = {
        edit: function (e) {
            CM.Menu.closeAll();
            var model = e.target.closest('carbon-editor').dataset['model'];
            CM.EditorBridge.sendMessage({
                type: 'edit',
                model: model + '.text'
            });
        },
        updateType: function (e) {
            CM.Menu.closeAll();
            var value = e.target.dataset['value'];
            var pieceEl = e.target.closest('carbon-piece');
            var textEl = pieceEl.querySelector('carbon-text');
            var editorEl = e.target.closest('carbon-editor');
            var model = editorEl.dataset['model'];
            var data = {};
            for (var _i = 0, _a = Array.from(pieceEl.querySelectorAll('.selected')); _i < _a.length; _i++) {
                var el = _a[_i];
                el.classList.remove('selected');
            }
            e.target.classList.add('selected');
            data['class'] = value;
            textEl.classList.remove('quote', 'body', 'subtitle');
            textEl.classList.add(value);
            CM.EditorBridge.sendMessage({
                type: 'update',
                model: model + '.style',
                data: data
            });
        },
    };
    CM.CoverActions = {
        upload: function (e) {
            var files = e.target.files || e.files;
            if (files.length === 0)
                return;
            var blockEl = document.querySelector('.cover');
            var model = e.target.closest('[data-model]').dataset['model'];
            CM.EditorBridge.upload(files[0], blockEl).then(function (result) {
                CM.EditorBridge.sendMessage({
                    type: 'update',
                    model: model + '.cover',
                    data: {
                        'uploadId': result.blob.id
                    }
                });
            });
        },
        remove: function (e) {
            var model = e.target.closest('[data-model]').dataset['model'];
            CM.EditorBridge.sendMessage({
                type: 'update',
                action: 'remove',
                model: model + '.cover',
                data: {
                    'source': 'portfolio'
                }
            });
        }
    };
    CM.ThumbnailActions = {
        upload: function (e) {
            var files = e.target.files || e.files;
            if (files.length === 0)
                return;
            var blockEl = e.target.closest('.block, carbon-piece');
            var model = blockEl.closest('[data-model]').dataset['model'];
            CM.EditorBridge.upload(files[0], blockEl).then(function (result) {
                CM.EditorBridge.sendMessage({
                    type: 'update',
                    model: model + '.thumbnail',
                    data: {
                        uploadId: result.blob.id
                    }
                });
            });
        }
    };
    CM.StyleActions = {
        update: function (e) {
            var target = e.target;
            var _a = target.dataset, name = _a.name, value = _a.value;
            var model = target.closest('[data-model]').dataset['model'];
            var data = {};
            data[name] = value;
            CM.EditorBridge.sendMessage({
                type: 'update',
                model: model + '.style',
                data: data
            });
        }
    };
    CM.Menu = {
        closeAll: function () {
            for (var _i = 0, _a = Array.from(document.querySelectorAll('carbon-menu.open')); _i < _a.length; _i++) {
                var el = _a[_i];
                el.classList.remove('open');
                el.classList.add('closed');
            }
        }
    };
    CM.PieceActions = {
        updateStyle: function (e) {
            var _a = e.target.dataset, name = _a.name, value = _a.value;
            var data = {};
            data[name] = value;
            console.log(e, {
                type: 'update',
                model: "piece#" + e.id + ".style",
                data: data
            });
            CM.EditorBridge.sendMessage({
                type: 'update',
                model: "piece#" + e.id + ".style",
                data: data
            });
        },
        uploadThumbnail: function (e) {
            var files = e.target.files || e.files;
            if (files.length === 0)
                return;
            var editorEl = e.target.closest('carbon-editor');
            var blockEl = e.target.closest('carbon-piece');
            var model = editorEl.dataset['model'];
            var request = CM.EditorBridge.upload(files[0], blockEl);
            request.then(function (result) {
                CM.EditorBridge.sendMessage({
                    type: 'update',
                    model: model + '.thumbnail',
                    data: {
                        'uploadId': result.blob.id
                    }
                });
            });
        },
        pickThumbnail: function (e) {
            CM.Menu.closeAll();
            var editorEl = e.target.closest('carbon-editor');
            var model = editorEl.dataset['model'];
            CM.EditorBridge.sendMessage({
                type: 'edit',
                action: 'pick',
                model: model + '.thumbnail'
            });
        },
        editDimensions: function (e) {
            var model = e.target.closest('carbon-editor').dataset['model'];
            CM.EditorBridge.sendMessage({
                type: 'edit',
                model: model + '.dimensions'
            });
        },
        resetThumbnail: function (e) {
            var model = e.target.closest('carbon-editor').dataset['model'];
            CM.EditorBridge.sendMessage({
                type: 'update',
                action: 'remove',
                model: model + '.thumbnail'
            });
        }
    };
    CM.ProjectThumbnailActions = {
        upload: function (e) {
            CM.Menu.closeAll();
            var files = e.files || e.target.files;
            if (!files || files.length === 0)
                return;
            var blockEl = e.target.closest('.editable') || e.target;
            var editorEl = blockEl.closest('carbon-editor') || blockEl.querySelector('carbon-editor');
            var data = editorEl.dataset;
            CM.EditorBridge.upload(files[0], blockEl).then(function (result) {
                blockEl.classList.remove('uploading');
                CM.EditorBridge.executeOld({
                    id: "project#" + data.projectId + ".thumbnail",
                    uploadId: result.blob.id,
                    spec: data
                });
            });
        },
        crop: function (e) {
            CM.Menu.closeAll();
            var data = e.target.closest('carbon-editor').dataset;
            CM.ProjectThumbnailActions.notify(data, 'crop');
        },
        pick: function (e) {
            CM.Menu.closeAll();
            var data = e.target.closest('carbon-editor').dataset;
            CM.ProjectThumbnailActions.notify(data, 'pick');
        },
        reset: function (e) {
            CM.Menu.closeAll();
            var data = e.target.closest('carbon-editor').dataset;
            CM.ProjectThumbnailActions.notify(data, 'reset');
        },
        notify: function (spec, action) {
            CM.EditorBridge.executeOld({
                id: "project#" + spec.projectId + ".thumbnail",
                action: action,
                projectId: spec.projectId,
                spec: spec
            });
        }
    };
})(CM || (CM = {}));
Carbon.Reactive.on('piece:built', function (e) {
    CM.PieceControl.setup(e);
});
document.body.addEventListener('carbon:drop', function (e) {
    console.log('dropped files', e);
    var el = e.target;
    var action = el.getAttribute('on-drop');
    if (!action || !action.includes(':'))
        return;
    e.detail.target = e.target;
    Carbon.ActionKit.execute(e.detail, action);
});
Carbon.controllers.projectThumbnail = CM.ProjectThumbnailActions;
Carbon.controllers.piece = CM.PieceActions;
Carbon.controllers.text = CM.TextActions;
Carbon.controllers.post = CM.PostActions;
Carbon.controllers.cover = CM.CoverActions;
Carbon.controllers.style = CM.StyleActions;
Carbon.controllers.menu = {
    close: function () {
        for (var _i = 0, _a = Array.from(document.querySelectorAll('carbon-menu')); _i < _a.length; _i++) {
            var el = _a[_i];
            el.classList.remove('open');
        }
    }
};
Carbon.controllers.confirmation = {
    show: function (e) {
        e.target.classList.add('confirming');
    },
    cancel: function (e) {
        e.target.closest('carbon-action').classList.remove('confirming');
    }
};
var clickOutsideControlObserver;
Carbon.controllers.control = {
    edit: function (e) {
        var controlEl = e.target.closest('.control');
        if (controlEl.matches('.editing')) {
            controlEl.classList.remove('editing');
            return;
        }
        var openControlEl = document.querySelector('.control.editing');
        if (openControlEl) {
            openControlEl.classList.remove('editing');
        }
        controlEl.classList.add('editing');
        clickOutsideControlObserver = Carbon.observe(document.body, 'click', function (e) {
            var target = e.target;
            if (target.closest('.control'))
                return;
            controlEl.classList.remove('editing');
            clickOutsideControlObserver.stop();
        });
    }
};
Carbon.controllers.option = {
    save: function (e) {
        var target = e.target;
        var controlEl = target.closest('.control');
        var selectedEl = controlEl.querySelector('.selected');
        if (selectedEl)
            selectedEl.classList.remove('selected');
        var _a = controlEl.dataset, name = _a.name, model = _a.model;
        var value = target.dataset['value'];
        var data = {};
        data[name] = value;
        CM.EditorBridge.sendMessage({
            type: 'update',
            model: model + '.style',
            data: data
        });
        var valueEl = controlEl.querySelector('.value');
        if (valueEl) {
            valueEl.className = "value " + name + "-" + value;
        }
        target.classList.add('selected');
        if (clickOutsideControlObserver) {
            clickOutsideControlObserver.stop();
        }
        controlEl.classList.remove('editing');
    },
    toggle: function (e) {
        var target = e.target;
        var controlEl = target.closest('.control');
        var _a = controlEl.dataset, model = _a.model, name = _a.name;
        var value = controlEl.matches('.on');
        var data = {};
        data[name] = value ? '' : 'on';
        CM.EditorBridge.sendMessage({
            type: 'update',
            model: model + '.style',
            data: data
        });
        controlEl.classList[value ? 'remove' : 'add']('on');
    }
};
document.body.addEventListener('click', function (e) {
    var el = e.target;
    if (el.closest('carbon-editor'))
        return;
    if (document.querySelector('carbon-menu.open')) {
        e.stopPropagation();
        e.preventDefault();
        CM.Menu.closeAll();
    }
}, true);
document.addEventListener('click', function (e) {
    var target = e.target;
    var aEl = target.closest('a');
    if (!aEl)
        return;
    var editorEl = target.closest('carbon-editor');
    if (target.closest('input')) {
        e.stopPropagation();
    }
    else if (editorEl) {
        e.preventDefault();
    }
}, true);
Carbon.controllers.editor = {
    openMenu: function (e) {
        var editorEl = e.target.closest('carbon-editor');
        var menuEl = editorEl.querySelector('carbon-menu');
        menuEl.classList.add('open');
    },
    toggleMenu: function (e) {
        var editorEl = e.target.closest('carbon-editor');
        var menuEl = editorEl.querySelector('carbon-menu');
        if (menuEl.matches('.open')) {
            menuEl.classList.remove('open');
            menuEl.classList.add('closed');
            return;
        }
        CM.Menu.closeAll();
        menuEl.classList.remove('closed');
        menuEl.classList.add('open');
    }
};
document.addEventListener('keydown', function (e) {
    if (e.which != 27)
        return;
    CM.Menu.closeAll();
    for (var _i = 0, _a = Array.from(document.querySelectorAll('.editing')); _i < _a.length; _i++) {
        var el = _a[_i];
        el.classList.remove('editing');
    }
}, false);
Carbon.ActionKit.observe('click', 'change');
