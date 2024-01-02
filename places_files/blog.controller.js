"use strict";
var CM;
(function (CM) {
    CM.BlogActions = {
        onOpen() {
            let blogIntroductionEl = document.querySelector('#blogIntroduction');
            if (blogIntroductionEl) {
                Carbon.Modal.get(blogIntroductionEl).open();
                document.querySelector('section.blog .breadcrumb > h1').textContent = 'Log';
            }
            Array.from(document.querySelectorAll('.posts.placeholder.new')).forEach(el => {
                el.classList.remove('new');
            });
        },
        async activate(e) {
            let modal = Carbon.Modal.get(e.target.closest('carbon-modal'));
            modal.close();
            let introductionEl = document.getElementById('blogIntroduction');
            introductionEl && introductionEl.remove();
            await _.post('/posts/activate');
            let html = await _.getPartial('/', 'pageManager');
            let el = Carbon.DOM.parse(html);
            document.getElementById('pageList').innerHTML = el.querySelector('#pageList').innerHTML;
            CM.portfolio.bridge.updateBlock('nav', { changed: 'all' });
            CM.PostActions.add();
        },
        ignore() {
            CM.portfolio.onNavigate('/');
            CM.portfolio.bridge.navigate('/');
            Carbon.Modal.get('#blogIntroduction').close();
        }
    };
    CM.PostActions = {
        async add() {
            let editor = PostEditor.get();
            editor.saveButton.textContent = 'Post';
            let data = await _.postJSON('/posts', {
                ownerId: CM.siteId
            });
            editor.setModel(data);
            editor.open();
        },
        save() {
            PostEditor.get().save();
        },
        cancel() {
            PostEditor.get().close();
        },
        async _edit(key) {
            let editor = PostEditor.get();
            editor.saveButton.textContent = 'Save';
            let data = await _.getJSON(`/posts/${key}`);
            editor.setModel(data);
            editor.open();
        },
        async _destroy(key) {
            await _.send(`/posts/${key}`, { method: 'DELETE' });
            _.trigger(document, 'saved', { reload: true });
        }
    };
    class PostEditor {
        constructor() {
            this.changed = false;
            if (PostEditor.instance)
                throw new Error('[PostEditor] Already setup');
            this.element = document.querySelector('#postEditor');
            this.modal = Carbon.Modal.get(this.element);
            this.bodyInput = this.element.querySelector('.fields textarea');
            this.saveButton = this.element.querySelector('.save.button');
            this.tagsBlock = new Carbon.TokenList(this.element.querySelector('.tagsBlock'));
            let quota = new CM.Quota({
                count: 0,
                limit: 10,
                consumeOverage: true
            });
            this.pieceManager = new CM.PieceManager(this.element, {
                quota: quota
            });
            this.tagsBlock.on('add', e => {
                e.element.querySelector('.text').textContent = e.value.toLowerCase();
            });
            this.modal.on('open', this.onOpen.bind(this));
        }
        static get() {
            return PostEditor.instance || (PostEditor.instance = new PostEditor());
        }
        open() {
            this.modal.open();
        }
        onOpen() {
            if (this.bodyInput.value.length > 0)
                return;
            setTimeout(() => {
                this.bodyInput.focus();
            }, 551);
        }
        async save() {
            let data = {
                body: this.bodyInput.value,
                tags: this.tagsBlock.getValues()
            };
            if (!this.post.published) {
                data.published = 'now';
            }
            await _.patchJSON(`/posts/${this.key}`, data);
            this.changed = true;
            this.close();
        }
        async setModel(post) {
            this.post = post;
            this.key = post.key;
            this.pieceManager.piecesEl.innerHTML = '';
            this.bodyInput.value = post.body || '';
            this.tagsBlock.clear();
            if (post.tags) {
                this.tagsBlock.addRange(post.tags);
            }
            if (post.pieces && post.pieces.length > 0) {
                this.modal.removeClass('empty');
                let html = await _.getPartial(`/posts/${post.key}`, 'pieces');
                let el = Carbon.DOM.parse(html);
                this.pieceManager.piecesEl.innerHTML = el.innerHTML;
            }
            else {
                this.modal.addClass('empty');
            }
            this.pieceManager.quota.set({
                count: post.pieces ? post.pieces.length : 0
            });
            this.element.dataset['entityType'] = 'post';
            this.element.dataset['entityKey'] = this.key;
            this.element.dataset['entityPath'] = '/posts/' + this.key;
        }
        close() {
            this.modal.close();
            if (this.changed) {
                _.trigger(document, 'saved', { reload: true });
                this.changed = false;
            }
        }
    }
    CM.PostEditor = PostEditor;
})(CM || (CM = {}));
