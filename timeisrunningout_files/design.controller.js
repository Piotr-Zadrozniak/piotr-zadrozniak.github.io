"use strict";
var CM;
(function (CM) {
    CM.ThemeActions = {
        preview(e) {
            let el = e.target;
            let themeEl = el.closest('.theme');
            if (themeEl.matches('.current'))
                return;
            document.body.classList.add('previewingTheme');
            let themeId = parseInt(themeEl.dataset['id']);
            CM.portfolio.bridge.setThemeId(themeId);
            Array.from(document.querySelectorAll('.theme.previewing')).forEach(el => {
                el.classList.remove('previewing');
            });
            themeEl.classList.add('previewing');
        },
        cancelPreview() {
            let themeId = parseInt(document.body.dataset['themeId']);
            CM.portfolio.bridge.setThemeId(themeId);
            for (var el of Array.from(document.querySelectorAll('.theme.previewing'))) {
                el.classList.remove('previewing');
            }
            document.body.classList.remove('previewingTheme');
        },
        async apply(e) {
            let target = e.target;
            let themeEl = target.closest('.theme');
            let themeId = parseInt(themeEl.dataset['id']);
            for (var el of Array.from(document.querySelectorAll('.theme.current'))) {
                el.classList.remove('current');
            }
            document.body.dataset['themeId'] = themeId.toString();
            themeEl.classList.remove('previewing');
            themeEl.classList.add('current');
            await _.patchJSON(`/sites/${CM.siteId}`, {
                themeId: themeId
            });
            for (var sectionName of ['design', 'about', 'contact']) {
                CM.Sections[sectionName].reload();
            }
            _.trigger(document, 'saved', { reload: true });
            Carbon.Router.instance.navigate('/portfolio/design');
        }
    };
})(CM || (CM = {}));
