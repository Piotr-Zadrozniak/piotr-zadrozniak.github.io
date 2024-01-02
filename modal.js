document.addEventListener('keydown', e => {
    if (e.which !== 27)
        return;
    let openEls = document.querySelectorAll('.open[escapable]');
    for (var i = 0; i < openEls.length; i++) {
        var el = openEls[i];
        if (el.tagName === 'CARBON-MODAL') {
            Carbon.Modal.get(el).close();
        }
        else {
            el.classList.remove('open', 'show');
        }
    }
}, false);
var Carbon;
(function (Carbon) {
    class Modal {
        constructor(element, options = null) {
            if (!element)
                throw new Error('[Modal] element not found');
            if (element.classList.contains('setup'))
                throw new Error('[Modal] Already setup');
            this.element = element;
            this.options = options || this.element.dataset;
            this.element.classList.add('setup');
            Modal.instances.set(this.element, this);
        }
        static get(element, options) {
            let el = (typeof element === 'string') ? document.querySelector(element) : element;
            if (!el)
                throw new Error('[Modal] element not found');
            return Modal.instances.get(el) || new Modal(el, options);
        }
        addClass(name) {
            this.element.classList.add(name);
        }
        removeClass(name) {
            this.element.classList.remove(name);
        }
        get isOpen() {
            return this.element.classList.contains('open');
        }
        open() {
            if (this.isOpen)
                return;
            this.depth = Modal.depth++;
            this.removeClass('closed');
            if (!Carbon.Modal.mask) {
                Modal.mask = new Carbon.Mask();
            }
            Array.from(document.querySelectorAll('carbon-modal.open')).forEach(el => {
                el.classList.add('behind');
            });
            setTimeout(this._open.bind(this), 0);
        }
        _open() {
            this.removeClass('closed');
            this.addClass('open');
            this.setup();
            Modal.mask.show();
            let autoSelectEl = this.element.querySelector('[autoselect]');
            if (autoSelectEl) {
                setTimeout(() => {
                    autoSelectEl.focus();
                }, 200);
            }
            trigger(this.element, 'open', {
                instance: this
            });
        }
        setup() {
            Modal.mask.element.className = (this.options.maskClass || '') + ' mask show';
            let css = getComputedStyle(this.element);
            let zIndex = parseInt(css.zIndex, 10);
            Modal.mask.setZIndex(zIndex - 1);
            var onClickOutside = this.element.getAttribute('on-click-outside');
            if (onClickOutside) {
                this.maskClickListener = function (e) {
                    Carbon.ActionKit.execute({ target: e.target }, onClickOutside);
                };
                Modal.mask.element.addEventListener('click', this.maskClickListener, false);
            }
        }
        close() {
            if (!this.isOpen)
                return;
            Modal.depth--;
            this.element.classList.remove('open');
            this.element.classList.add('closed');
            trigger(this.element, 'close', {
                instance: this
            });
            if (this.maskClickListener) {
                Modal.mask.element.removeEventListener('click', this.maskClickListener, false);
            }
            var openModals = document.querySelectorAll('carbon-modal.open');
            if (openModals.length > 0) {
                var modal = Modal.get(openModals[0]);
                modal.setup();
                return;
            }
            Modal.mask.hide();
        }
        on(type, callback) {
            this.element.addEventListener(type, callback, false);
        }
    }
    Modal.instances = new WeakMap();
    Modal.depth = 0;
    Carbon.Modal = Modal;
    class Mask {
        constructor(options) {
            this.classList = [];
            let el = document.createElement('div');
            el.id = 'mask_' + Carbon.Mask.index++;
            el.className = 'mask';
            document.body.appendChild(el);
            this.element = el;
            if (options) {
                if (options.zIndex) {
                    this.setZIndex(options.zIndex);
                }
            }
        }
        setZIndex(value) {
            this.element.style.zIndex = value.toString();
        }
        show() {
            this.element.classList.remove('hide');
            this.element.classList.add('show');
            document.body.classList.add('masked');
        }
        addClass(name) {
            this.element.classList.add(name);
            this.classList.push(name);
        }
        removeClass(name) {
            this.element.classList.remove(name);
            return this;
        }
        hide() {
            this.element.classList.remove('show');
            this.element.classList.add('hide');
            if (document.querySelectorAll('.mask.show').length == 0) {
                document.body.classList.remove('masked');
            }
            return this;
        }
        dispose() {
            this.element.remove();
        }
    }
    Mask.index = 0;
    Carbon.Mask = Mask;
    function trigger(element, name, detail) {
        return element.dispatchEvent(new CustomEvent(name, {
            bubbles: true,
            detail: detail
        }));
    }
})(Carbon || (Carbon = {}));
if (Carbon.controllers) {
    Carbon.controllers.set('modal', {
        close(e) {
            let modalEl = e.id
                ? document.getElementById(e.id)
                : e.target.closest('carbon-modal');
            Carbon.Modal.get(modalEl).close();
        },
        open(e) {
            Carbon.Modal.get('#' + e.id).open();
        }
    });
}
