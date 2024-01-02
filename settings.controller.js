"use strict";
Carbon.formatters.set('domainFormatter', function (data) {
    return Promise.resolve(data.host);
});
var CM;
(function (CM) {
    class SettingsController {
        constructor() {
            let customDomainBlock = document.getElementById('customDomainBlock');
            let privacyBlockEl = document.getElementById('privacyBlock');
            customDomainBlock && customDomainBlock.addEventListener('error', (e) => {
                let messageEl = customDomainBlock.querySelector('i.message');
                if (messageEl.textContent === 'Not registered') {
                    customDomainBlock.classList.add('unregistered');
                }
            }, false);
            privacyBlockEl && privacyBlockEl.addEventListener('toggle:saved', (e) => {
                e.stopPropagation();
                let detail = e.detail;
                if (detail.name !== 'private')
                    return;
                if (detail.value) {
                    privacyBlockEl.classList.remove('public');
                    privacyBlockEl.classList.add('private');
                    CM.portfolio.showNotice('siteIsPrivate');
                }
                else {
                    privacyBlockEl.classList.remove('private');
                    privacyBlockEl.classList.add('public');
                    CM.portfolio.hideNotice('siteIsPrivate');
                }
            }, false);
            customDomainBlock && customDomainBlock.addEventListener('block:saved', (e) => {
                let data = e.detail.data;
                if (data.status === 'deleted') {
                    customDomainBlock.classList.remove('inactive', 'active', 'propagating', 'unregistered');
                    customDomainBlock.classList.add('empty');
                    return;
                }
                let verifyDomainEl = document.querySelector('.verifyDomain');
                verifyDomainEl && verifyDomainEl.setAttribute('on-click', `domain#${data.name}:verify`);
                customDomainBlock.classList.remove('empty');
                customDomainBlock.classList.add('inactive');
                CM.DomainActions.viewInstructions(data, false);
            });
            let customDomainBlockEl = document.querySelector('#customDomainBlock .block');
            if (customDomainBlockEl && !customDomainBlockEl.matches('.empty')) {
                customDomainBlockEl.classList.add('disabled');
            }
        }
    }
    CM.SettingsController = SettingsController;
    CM.DomainActions = {
        activate(data) {
            data.errorMessage = 'a';
            CM.DomainActions.verify(data);
        },
        change() {
            let customDomainBlockEl = document.querySelector('#customDomainBlock > .block');
            let block = Carbon.EditBlock.get(customDomainBlockEl);
            block.element.classList.remove('disabled', 'empty');
            block.edit();
            let inputEl = block.element.querySelector('input');
            if (inputEl) {
                inputEl.value = '';
                inputEl.select();
            }
            block.on('block:close', () => {
                block.element.classList.remove('empty', 'unregistered');
                block.element.classList.add('disabled');
            });
        },
        verify(data) {
            CM.DomainActions.viewInstructions(data, true);
        },
        close() {
            Carbon.Modal.get('#domainBindingInstructions').close();
        },
        async viewInstructions(a, validate) {
            let modal = Carbon.Modal.get('#domainBindingInstructions');
            let gutsEl = modal.element.querySelector('.guts');
            if (validate === true) {
                modal.element.classList.add('validating');
            }
            if (!modal.isOpen) {
                modal.open();
            }
            let url = `/sites/0/bindings/0/instructions?partial=customDomainInstructions&verify=${validate}`;
            let response = await _.send(url, { method: 'GET' });
            let status = response.headers.get('x-verification-status').toLowerCase();
            let html = await response.text();
            gutsEl.innerHTML = html;
            gutsEl.classList.remove('loading');
            gutsEl.classList.add('loaded');
            let customDomainBlock = document.getElementById('customDomainBlock');
            if (validate) {
                modal.removeClass('validating');
                if (status === 'error') {
                    customDomainBlock.classList.remove('active', 'propagating', 'empty', 'unregistered');
                    customDomainBlock.classList.add('inactive');
                }
                else if (status === 'ok') {
                    customDomainBlock.classList.remove('inactive', 'active', 'empty', 'unregistered');
                    customDomainBlock.classList.add('propagating');
                    modal.close();
                }
            }
        }
    };
    CM.CustomDomainActions = {
        async setup(e) {
            let formEl = e.target.querySelector('form');
            let nameInput = formEl.querySelector('input');
            formEl.addEventListener('submit', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                let response = await _.send('/domains/suggest', {
                    method: 'POST',
                    body: JSON.stringify({
                        name: nameInput.value
                    }),
                    headers: {
                        'Content-Type': 'application/json',
                        'x-partial': 'suggestions'
                    }
                });
                if (!response.ok) {
                    alert('not ok');
                    return;
                }
                let html = await response.text();
                document.querySelector('.suggestions').innerHTML = html;
                document.querySelector('#domainRegistration').classList.add('showSuggestions');
            });
        }
    };
    CM.BackupActions = {
        start() {
            let popup = new Carbon.PopupWindow('/dropbox');
            popup.open();
            popup.on('closed', () => {
            });
        }
    };
})(CM || (CM = {}));
var Carbon;
(function (Carbon) {
    class PopupWindow {
        constructor(url, options = {}) {
            this.url = url;
            this.options = options;
        }
        on(name, callback) {
            document.addEventListener(name + '.window', callback);
        }
        open() {
            let width = this.options.width || 800;
            let height = this.options.height || 600;
            let top = (screen.height / 2) - (height / 2);
            let left = (screen.width / 2) - (width / 2);
            this.window = window.open(this.url, this.options.title || 'Popup', `location=0,status=0,width=${width},height=${height},top=${top},left=${left}`);
            this.interval = setInterval(() => {
                if (this.window.closed) {
                    clearInterval(this.interval);
                    _.trigger(document, 'closed.window');
                }
            }, 100);
        }
    }
    Carbon.PopupWindow = PopupWindow;
})(Carbon || (Carbon = {}));
