"use strict";
var CM;
(function (CM) {
    function selectApp(name) {
        Array.from(document.querySelectorAll('carbon-app.open')).forEach(el => {
            el.classList.remove('open');
        });
        let el = document.querySelector(`carbon-app#${name}App`);
        el && el.classList.add('open');
        let activeEl = document.querySelector('#appSwitcher .item.active');
        activeEl && activeEl.classList.remove('active');
        let appLinkEl = document.querySelector('.appLink.' + name);
        appLinkEl && appLinkEl.classList.add('active');
        if (name === 'portfolio') {
            document.body.classList.add('portfolio');
            document.body.classList.remove('nopreview');
        }
        else {
            document.body.classList.add('nopreview');
            document.body.classList.remove('portfolio');
        }
    }
    CM.selectApp = selectApp;
    ;
})(CM || (CM = {}));
var Bootstrap;
(function (Bootstrap) {
    let router = new Carbon.Router({
        '/portfolio': CM.Sections.main,
        '/portfolio/projects/{id}/pieces': (cxt) => {
            CM.Sections.project.url = `/projects/${cxt.params.id}?partial=section`;
            CM.Sections.project.load(cxt);
            CM.PieceController.get().open({
                id: cxt.params.id
            });
        },
        '/portfolio/projects/{id}': CM.Sections.project,
        '/portfolio/design/project-defaults': CM.Sections.projectDefaults,
        '/portfolio/design': CM.Sections.design,
        '/portfolio/design/themes': CM.Sections.themes,
        '/portfolio/projects': CM.Sections.projects,
        '/portfolio/settings': CM.Sections.settings,
        '/portfolio/about': CM.Sections.about,
        '/portfolio/contact': CM.Sections.contact,
        '/portfolio/blog': CM.Sections.blog,
        '/account/reupgrade': () => {
            window.location.assign('/account/reupgrade');
        },
        '/account': () => {
            CM.selectApp('account');
            CM.AccountActions.openSection({ name: 'settings' });
        },
        '/messages': () => {
            CM.selectApp('messages');
            CM.messages.load();
        },
        '/messages/archived': () => {
            CM.selectApp('messages');
            CM.messages.load('archived');
        },
        '/messages/spam': () => {
            CM.selectApp('messages');
            CM.messages.load('spam');
        },
        '/messages/{id}': (e) => {
            CM.selectApp('messages');
            CM.messages.openConversation(e.params.id);
        },
        '/account/{section}': (e) => {
            CM.selectApp('account');
            CM.AccountActions.openSection({ name: e.params.section });
        },
        '/stats': async () => {
            CM.selectApp('stats');
            let gutsEl = document.querySelector('#statsApp .guts');
            let html = await _.getPartial('/stats');
            gutsEl.innerHTML = html;
            CM.Chart.show('P30D', 'P1D');
        },
        '/domains': (e) => {
            Carbon.DOM.onChange();
        },
        '/profile/{section}': async (e) => {
            CM.selectApp('profile');
            let gutsEl = document.querySelector('carbon-app#profileApp .guts');
            let html = await _.getPartial(`/profile/${e.params.section}`);
            gutsEl.innerHTML = html;
            Carbon.DOM.onChange();
        },
        '/upgrade': (e) => {
            CM.PlanActions.upgrade();
        }
    });
    router.on('route:load', (e) => {
        Carbon.DOM.onChange();
        CM.userMenu && CM.userMenu.close();
    });
    router.start();
    Carbon.Router.instance = router;
})(Bootstrap || (Bootstrap = {}));
(function (Bootstrap) {
    Carbon.DOM.onChange();
    let celebrate = document.body.dataset['celebrate'];
    if (celebrate) {
        CM.PlanActions.celebrate({ id: celebrate });
    }
})(Bootstrap || (Bootstrap = {}));
