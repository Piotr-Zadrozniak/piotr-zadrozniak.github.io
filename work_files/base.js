"use strict";
var Carbon;
(function (Carbon) {
    function errorHandler(message, url, line, column, error) {
        let data = {
            url: url,
            line: line,
            message: message
        };
        if (column) {
            data.column = column;
        }
        if (error && error.stack) {
            data.stack = error.stack;
        }
        try {
            fetch('/jserrors', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        }
        catch (e) { }
        return false;
    }
    window.onerror = errorHandler;
    Carbon.controllerFactory = {
        get(name) {
            let controller = Carbon.controllers.get(name);
            if (!!controller)
                return controller;
            let controllerName = name[0].toUpperCase() + name.substring(1) + 'Actions';
            controller = CM[controllerName];
            if (!controller)
                throw new Error(`Controller not found "${controllerName}"`);
            return controller;
        }
    };
})(Carbon || (Carbon = {}));
document.addEventListener('carbon:drop', (e) => {
    let el = e.target;
    let action = el.getAttribute('on-drop');
    if (!action || !action.includes(':'))
        return;
    e.detail.target = e.target;
    Carbon.ActionKit.execute(e.detail, action);
});
document.addEventListener('click', (e) => {
    let target = e.target;
    if (target.matches('.action, .handle'))
        return;
    let blockEl = target.closest('.editBlock, .bigEditBlock');
    let sectionEl = target.closest('section');
    if (!blockEl || blockEl.matches('.setup') || !blockEl.querySelector('form'))
        return;
    let block = Carbon.EditBlock.get(blockEl);
    block.edit();
});
Carbon.ActionKit.observe('mouseover', 'click', 'close', 'edit', 'submit', 'change');
var _;
(function (_) {
    function height(element) {
        return parseInt(getComputedStyle(element).height);
    }
    _.height = height;
    function width(element) {
        return parseInt(getComputedStyle(element).width);
    }
    _.width = width;
    function isEmpty(instance) {
        if (!instance)
            return true;
        if (instance.empty)
            return true;
        let values = Object.keys(instance).map(key => instance[key]);
        for (var i = 0; i < values.length; i++) {
            if (values[i])
                return false;
        }
        return true;
    }
    _.isEmpty = isEmpty;
    ;
    function removeWhitespace(element) {
        for (var i = 0; i < element.childNodes.length; i++) {
            let node = element.childNodes[i];
            if (node.nodeType == 3 && !/\S/.test(node.nodeValue)) {
                element.removeChild(node);
            }
        }
    }
    _.removeWhitespace = removeWhitespace;
    async function getPartial(url, partial = 'default') {
        var response = await fetch(url, {
            headers: {
                'x-partial': partial
            }
        });
        return await response.text();
    }
    _.getPartial = getPartial;
    ;
    class Deferred {
        constructor() {
            this.promise = new Promise((resolve, reject) => {
                this._resolve = resolve;
                this._reject = reject;
            });
        }
        resolve(value) {
            this._resolve(value);
        }
        reject(value) {
            this._reject(value);
        }
    }
    _.Deferred = Deferred;
    function show(element) {
        element.style.display = null;
    }
    _.show = show;
    function hide(element) {
        element.style.display = 'none';
    }
    _.hide = hide;
})(_ || (_ = {}));
var CM;
(function (CM) {
    CM.authenticityToken = document.querySelector('meta[name="authenticityToken"]').content;
    _.defaultHeaders['x-authenticity-token'] = CM.authenticityToken;
    CM.FormActions = {
        setup(e) {
            new Carbon.Form(e.target);
        }
    };
    CM.ScrollableActions = {
        setup(e) {
            Carbon.Scrollable.get(e.target).watch();
        }
    };
})(CM || (CM = {}));
