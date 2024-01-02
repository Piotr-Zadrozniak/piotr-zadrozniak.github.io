"use strict";
var CM;
(function (CM) {
    CM.AccountActions = {
        close() {
            let modal = Carbon.Modal.get('#deleteAccountModal');
            modal.open();
            let formEl = modal.element.querySelector('form');
            let form = new Carbon.Form(formEl);
            let buttonEl = formEl.querySelector('button');
            let inputEl = formEl.querySelector('input');
            if (buttonEl && inputEl) {
                inputEl.addEventListener('input', e => {
                    if (inputEl.value.length) {
                        buttonEl.removeAttribute('disabled');
                    }
                    else {
                        buttonEl.setAttribute('disabled', 'true');
                    }
                });
            }
            form.on('sent', () => {
                document.location.assign('https://carbonmade.com/v4/goodbye-c3-hello-c4');
            });
        },
        async openSection(e) {
            CM.AccountActions.select(e);
            let name = e.name || e.target.dataset['name'];
            let activeNavEl = document.querySelector('#accountApp nav .active');
            activeNavEl && activeNavEl.classList.remove('active');
            let linkEl = document.querySelector(`#accountApp nav .${name}Link`);
            linkEl && linkEl.classList.add('active');
            let html = await _.getPartial(`/account/${name}`);
            document.querySelector('#accountApp .main').innerHTML = html;
            Carbon.DOM.onChange();
        },
        select(e) {
            if (!e || !e.target)
                return;
            let currentAppEl = document.querySelector('carbon-app span.active');
            currentAppEl && currentAppEl.classList.remove('active');
            e.target.classList.add('active');
        }
    };
    async function ViewAccountSection(name) {
        let html = await _.getPartial('/account/' + name);
        document.querySelector('#accountApp .main').innerHTML = html;
    }
    CM.ViewAccountSection = ViewAccountSection;
    ;
    CM.SuspendedNoticeActions = {
        dismiss() { document.querySelector('#noticeMask').remove(); }
    };
    CM.PreferenceActions = {
        toggle(e) {
            let el = e.target;
            el.classList.toggle('on');
            let active = el.matches('.on');
            let flag = el.dataset['flag'];
            _.postJSON('/account/updatepreference', {
                name: flag,
                value: active
            });
        }
    };
    CM.OrderActions = {
        abandon(e) {
            _.post(`/orders/${e.id}/abandon`);
        }
    };
    CM.PlanActions = {
        async downgradeToFree() {
            let modal = Carbon.Modal.get('#downgradeModal');
            let gutsEl = modal.element.querySelector('.guts');
            let html = await _.getHTML('/account/downgradeToFree');
            gutsEl.innerHTML = html;
            modal.open();
        },
        async downgrade(e) {
            let modal = Carbon.Modal.get('#downgradeModal');
            let productId = e.target.dataset['productId'];
            let gutsEl = modal.element.querySelector('.guts');
            let html = await _.getHTML(`/account/order?productId=${productId}`);
            gutsEl.innerHTML = html;
            modal.open();
        },
        async upgrade(e) {
            let modal = Carbon.Modal.get('#upgradeModal');
            modal.on('close', () => {
                modal.element.classList.remove('showMatrix', 'celebrate', 'confirmPlanChange');
            });
            CM.userMenu && CM.userMenu.close();
            let plan = '1';
            let feature = 'none';
            if (e) {
                plan = e.id;
                feature = e.target.dataset['feature'] || 'none';
            }
            modal.element.dataset['currentPlan'] = plan;
            let gutsEl = modal.element.querySelector('.guts');
            let url = `/plans?feature=${feature}&plan=${plan}`;
            let html = await _.getPartial(url, 'upgrade');
            gutsEl.innerHTML = html;
            modal.element.classList.add('showMatrix');
            modal.open();
        },
        async changeCycle(e) {
            let modal = Carbon.Modal.get('#upgradeModal');
            let cycle = e.target.dataset['value'];
            let plan = modal.element.dataset['currentPlanId'];
            let gutsEl = modal.element.querySelector('.guts');
            let url = `/plans?cycle=${cycle}&plan=${plan}`;
            let html = await _.getPartial(url, 'upgrade');
            gutsEl.innerHTML = html;
            modal.open();
        },
        async change(e) {
            let modal = Carbon.Modal.get('#upgradeModal');
            if (!modal.isOpen) {
                modal.element.classList.add('direct');
                modal.open();
            }
            let confirmGutsEl = modal.element.querySelector('.confirmGuts');
            let productId = e.target.dataset['productId'];
            if (!productId)
                throw new Error('[BillingModal] productId is empty');
            let html = await _.getPartial(`/plans/change?productId=${productId}`);
            modal.removeClass('celebrate');
            modal.addClass('confirmPlanChange');
            confirmGutsEl.innerHTML = html;
            let cancelEl = confirmGutsEl.querySelector('.cancel');
            cancelEl.addEventListener('click', e => {
                modal.removeClass('confirmPlanChange');
                if (modal.element.matches('.direct')) {
                    modal.close();
                    modal.removeClass('direct');
                }
            }, { once: true });
        },
        async confirmChange(e) {
            let modal = Carbon.Modal.get('#upgradeModal');
            let orderId = e.target.dataset['orderId'];
            modal.element.classList.add('processing');
            await _.post(`/orders/${orderId}/place`);
            CM.PlanActions.celebrate({ plan: e.id });
            ['projects', 'settings', 'personalize'].forEach(name => {
                let section = CM.Sections[name];
                section && section.reload && section.reload();
            });
            if (location.pathname.startsWith('/account')) {
                CM.AccountActions.openSection({ name: 'plan' });
            }
        },
        async confirmDowngradeToFree() {
            await _.post(`/accounts/${CM.siteId}/downgrade`);
            CM.IntroductionModal.get().show('accountDowngradedNotice');
            CM.AccountActions.openSection({ name: 'plan' });
        },
        async confirmDowngrade(e) {
            let response = await _.postJSON(`/accounts/${CM.siteId}/changeplan`, {
                productId: e.target.dataset['productId']
            });
            CM.IntroductionModal.get().show('accountDowngradedNotice');
            Carbon.Modal.get('#downgradeModal').close();
            CM.AccountActions.openSection({ name: 'plan' });
        },
        close() {
            Carbon.Modal.get('#upgradeModal').close();
        },
        async celebrate(e) {
            let modal = Carbon.Modal.get('#upgradeModal');
            let plan = e.id || e.plan;
            let html = await _.getPartial(`/plans/celebrate?plan=${plan}`);
            modal.open();
            modal.element.querySelector('.celebrateGuts').innerHTML = html;
            modal.element.classList.remove('confirmPlanChange', 'processing');
            modal.element.classList.add('celebrate');
        }
    };
    CM.BillingActions = {
        async changeBillingCycle(e) {
            let data = e.target.dataset;
            let newProductId = (data['currentInterval'] === 'P1Y')
                ? data['monthlyProductId']
                : data['yearlyProductId'];
            let modal = Carbon.Modal.get('#billingModal');
            let gutsEl = modal.element.querySelector('.guts');
            let url = `/account/order?productId=${newProductId}`;
            let html = await _.getHTML(url);
            gutsEl.innerHTML = html;
            modal.open();
        },
        async confirmBillingCycleChange(e) {
            let modal = Carbon.Modal.get('#billingModal');
            await _.postJSON(`/accounts/${CM.siteId}/changecycle`, {
                productId: parseInt(e.target.dataset['productId'])
            });
            CM.IntroductionModal.get().show('billingCycleChangedNotice');
            CM.AccountActions.openSection({ name: 'billing' });
            modal.close();
        }
    };
})(CM || (CM = {}));
