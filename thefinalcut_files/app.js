"use strict";
var CM;
(function (CM) {
    CM.ConversationActions = {
        back() {
            CM.messages.back();
        },
        archive(e) {
            CM.messages.archiveConversation(e.id);
        },
        unarchive(e) {
            CM.messages.unarchiveConversation(e.id);
        },
        report(e) {
            CM.messages.reportConversation(e.id);
        },
        unreport(e) {
            CM.messages.unreportConversation(e.id);
        }
    };
    CM.ConversationParticipantActions = {
        open() {
            document.querySelector('.conversationParticipant').classList.add('show');
        },
        close() {
            document.querySelector('.conversationParticipant').classList.remove('show');
        }
    };
    class MessageComposer {
        constructor(element) {
            this.inputEl = element.querySelector('textarea');
            this.fieldEl = element.querySelector('.field');
            this.submitEl = element.querySelector('.send');
            this.form = new Carbon.Form(element.querySelector('form'));
            this.inputEl.addEventListener('input', this.onInput.bind(this));
            this.form.on('sent', this.reset.bind(this));
        }
        reset() {
            this.fieldEl.classList.remove('invalid');
            this.inputEl.value = '';
            this.inputEl.select();
            _.trigger(this.inputEl, 'poke');
        }
        onInput() {
            this.submitEl.disabled = this.inputEl.value.length === 0;
        }
    }
    class MessagesApp {
        constructor() {
            this.element = document.querySelector('#messagesApp');
            this.isSetup = false;
            this.isSending = false;
            this.sideEl = this.element.querySelector('.side');
            this.mainEl = this.element.querySelector('.main');
            window.addEventListener('resize', this.onResize.bind(this), false);
            this.mainEl.style.transition = 'opacity 1s linear';
        }
        back() {
            this.element.classList.remove('conversationDetail');
            this.element.classList.add('conversationList');
        }
        async load(filter) {
            if (this.isSetup)
                return true;
            this.element.classList.add('conversationList');
            let url = '/conversations';
            if (filter) {
                url = url + '/' + filter;
            }
            url += '?partial=true';
            let response = await fetch(url);
            let html = await response.text();
            this.onLoad(html, response);
            this.isSetup = true;
        }
        onLoad(html, response) {
            this.element.classList.remove('loading');
            let empty = !!response.headers.get('x-empty');
            this.element.classList.toggle('empty', empty);
            if (empty) {
                this.mainEl.innerHTML = html;
                return;
            }
            this.sideEl.innerHTML = html;
            let openId = response.headers.get('x-open-conversation-id');
            let unreadMessageCount = parseInt(response.headers.get('x-unread-message-count'));
            let introduceName = response.headers.get('x-introduce');
            this.updateNotificationCount(unreadMessageCount);
            if (openId) {
                this.openConversation(openId);
            }
            if (introduceName) {
                CM.IntroductionModal.get().show(introduceName);
            }
            Carbon.DOM.onChange();
        }
        async reloadList() {
            let response = await fetch('/conversations?partial=true');
            let unreadMessageCount = parseInt(response.headers.get('x-unread-message-count'));
            this.updateNotificationCount(unreadMessageCount);
            let html = await response.text();
            this.sideEl.innerHTML = html;
            let itemEl = document.querySelector('#conversation_' + this.conversationId);
            itemEl && itemEl.classList.add('active');
            Carbon.DOM.onChange();
        }
        updateNotificationCount(count) {
            let notificationCountEl = document.querySelector('.appLink.messages > .notificationCount');
            if (notificationCountEl) {
                notificationCountEl.textContent = count.toString();
                notificationCountEl.classList.toggle('none', count === 0);
            }
        }
        async archiveConversation(id) {
            let response = await _.post(`/conversations/${id}/archive`);
            let json = await response.json();
            this.reloadList();
            this.openConversation(id);
        }
        async unarchiveConversation(id) {
            await _.post(`/conversations/${id}/unarchive`);
            this.reloadList();
            this.openConversation(id);
        }
        async reportConversation(id) {
            let response = await _.post(`/conversations/${id}/report`);
            let json = await response.json();
            this.reloadList();
            this.openConversation(id);
        }
        async unreportConversation(id) {
            let response = await _.post(`/conversations/${id}/unreport`);
            let json = await response.json();
            this.reloadList();
            this.openConversation(id);
        }
        async openConversation(id) {
            this.load();
            this.element.classList.add('conversationDetail');
            this.element.classList.remove('conversationList');
            this.conversationId = id;
            for (var activeEl of Array.from(document.querySelectorAll('.conversations .active'))) {
                activeEl.classList.remove('active');
            }
            let conversationEl = document.querySelector('#conversation_' + id);
            if (conversationEl) {
                conversationEl.classList.remove('new');
                conversationEl.classList.add('active');
            }
            this.mainEl.style.animation = '';
            this.mainEl.innerHTML = '';
            let response = await fetch(`/conversations/${id}?partial=true`, { credentials: 'same-origin' });
            let unreadMessageCount = parseInt(response.headers.get('x-unread-message-count'));
            this.updateNotificationCount(unreadMessageCount);
            let html = await response.text();
            this.mainEl.style.animation = 'fadeIn 0.1s linear';
            this.mainEl.innerHTML = html;
            this.composer = new MessageComposer(document.querySelector('.replyBlock'));
            this.composer.form.send = this.sendMessage.bind(this);
            this.composer.inputEl.addEventListener('expanded', this.onResize.bind(this));
            new Carbon.AutoExpander(this.composer.inputEl, { maxHeight: 550 });
            this.conversationId = id;
            this.onResize();
        }
        onResize() {
            let messageList = document.querySelector('.conversationPage .messages');
            if (!messageList)
                return;
            let cp = document.querySelector('.conversationPage');
            let contentHeight = _.height(messageList);
            let winHeight = window.innerHeight;
            let replyBlockEl = document.querySelector('.replyBlock');
            let replyBlockHeight = replyBlockEl.offsetHeight;
            let minHeight = Math.min(cp.offsetHeight, (winHeight - replyBlockHeight - 100));
            if (minHeight >= contentHeight) {
                cp.classList.remove('overflowing');
            }
            else {
                cp.classList.add('overflowing');
                cp.scrollTop = contentHeight;
                window.scrollTo(0, contentHeight);
            }
            cp.style.bottom = replyBlockHeight + 'px';
        }
        async appendMessage(cId, mId) {
            let url = `/conversations/${cId}/message?messageId=${mId}`;
            let messageListEl = document.querySelector('.conversationPage .messages');
            let html = await _.getHTML(url);
            messageListEl.insertAdjacentHTML('beforeend', html);
            this.onResize();
        }
        sendMessage() {
            if (this.isSending)
                return;
            let messageListEl = document.querySelector('.conversationPage .messages');
            let request = fetch('/conversations?partial=message', {
                method: 'POST',
                headers: {
                    'Accept': 'text/html',
                    'Content-Type': 'application/json',
                    'x-authenticity-token': CM.authenticityToken
                },
                body: JSON.stringify(this.composer.form.serialize())
            });
            this.isSending = true;
            this.composer.form.element.classList.add('sending');
            let messageEl = this.composer.fieldEl.querySelector('.message');
            request.then(response => {
                if (!response.ok) {
                    return response.json().then(data => {
                        return Promise.reject(data);
                    });
                }
                return response.text();
            }).then(html => {
                this.isSending = false;
                this.composer.reset();
                messageListEl.insertAdjacentHTML('beforeend', html);
                this.composer.form.element.classList.remove('sending');
                this.onResize();
            }, data => {
                this.composer.fieldEl.classList.add('invalid');
                messageEl.textContent = data.errors[0].message;
                return Promise.reject(data);
            });
        }
    }
    CM.messages = new MessagesApp();
})(CM || (CM = {}));
