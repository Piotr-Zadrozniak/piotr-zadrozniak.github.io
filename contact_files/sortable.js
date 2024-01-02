"use strict";
var Carbon;
(function (Carbon) {
    const RSPACE = /\s+/g;
    class Drag {
        constructor(element, origin) {
            this.startIndex = -1;
            this.observers = [];
            this.element = element;
            this.origin = origin;
            let box = this.element.getBoundingClientRect();
            let mid = {
                x: box.left + (this.element.clientWidth / 2),
                y: box.top + (this.element.clientHeight / 2)
            };
            this.offset = {
                x: origin.clientX - mid.x,
                y: origin.clientY - mid.y
            };
        }
        getDelta() {
            return {
                x: this.current.clientX - this.origin.clientX,
                y: this.current.clientY - this.origin.clientY
            };
        }
        dispose() {
            this.observers.forEach(o => o.stop());
            this.observers = null;
        }
    }
    Carbon.Drag = Drag;
    let UserSelect = {
        blockSelect(e) {
            e.preventDefault();
            e.stopPropagation();
        },
        block() {
            document.body.focus();
            document.addEventListener('selectstart', UserSelect.blockSelect, true);
        },
        unblock() {
            document.removeEventListener('selectstart', UserSelect.blockSelect, true);
        }
    };
    class Sortable {
        constructor(el, options) {
            this.dragging = false;
            this.moved = false;
            this.disabled = false;
            this.observers = [];
            this.element = el;
            if (!el)
                throw new Error('[Sortable] el not defined');
            this.options = {
                handle: null,
                draggable: /[uo]l/i.test(this.element.nodeName) ? 'li' : '>*',
                ghostClass: 'ghost',
                dragClass: 'dragging',
                animation: 0,
                axis: null
            };
            if (options) {
                Object.assign(this.options, options);
            }
            this.containerEl = _scrollParent(this.element);
            this.autoScroll = new AutoScroll(this.containerEl);
            this.observers.push(_on(this.element, 'mousedown', this.onMouseDown.bind(this)), _on(this.element, 'touchstart', this.onTouchStart.bind(this)));
        }
        on(type, listener) {
            return _on(this.element, type, listener);
        }
        _listen() {
            this.observers.forEach(o => o.start());
        }
        _unlisten() {
            this.observers.forEach(o => o.stop());
        }
        disable() {
            this.disabled = true;
        }
        enable() {
            this.disabled = false;
        }
        onTouchStart(e) {
            if (this.disabled)
                return;
            this.method = 'touch';
            let touch = e.touches[0];
            let dragEl = this.getDraggable(touch.target);
            if (!dragEl)
                return;
            this.startDrag(dragEl, touch);
        }
        onMouseDown(e) {
            if (this.disabled)
                return;
            this.method = 'mouse';
            if (e.button !== 0)
                return;
            let dragEl = this.getDraggable(e.target);
            if (!dragEl)
                return;
            let moveMouseListener = _on(document, 'mousemove', (moveEvent) => {
                let distanceX = moveEvent.clientX - e.clientX;
                let distanceY = moveEvent.clientY - e.clientY;
                let distance = Math.sqrt(Math.pow(distanceX, 2) + Math.pow(distanceY, 2));
                if (distance > 3) {
                    this.startDrag(dragEl, e);
                    moveMouseListener.stop();
                }
            });
            _on(document, 'mouseup', moveEvent => {
                moveMouseListener.stop();
            });
        }
        startDrag(dragEl, e) {
            UserSelect.block();
            this._unlisten();
            this.drag = new Drag(dragEl, e);
            this.drag.startIndex = _index(dragEl, this.options.draggable);
            this.cloneEl = this.drag.element.cloneNode(true);
            this.cloneEl.style.display = 'none';
            this.element.insertBefore(this.cloneEl, this.drag.element);
            this.trigger(this.element, 'clone', this.drag.element);
            if (this.method === 'touch') {
                this.drag.observers.push(_on(document, 'touchmove', this.onTouchMove.bind(this)), _on(document, 'touchend', this.onDrop.bind(this)), _on(document, 'touchcancel', this.onDrop.bind(this)));
            }
            else {
                this.drag.observers.push(_on(document, 'mousemove', this.onMouseMove.bind(this)), _on(document, 'mouseup', this.onDrop.bind(this)));
            }
        }
        onMouseMove(e) {
            if (!this.drag)
                return;
            e.preventDefault();
            this._onMove(e);
        }
        onTouchMove(e) {
            if (!this.drag)
                return;
            e.preventDefault();
            this._onMove(e.touches[0]);
        }
        _onMove(e) {
            this.moved = true;
            this.drag.current = e;
            if (!this.dragging) {
                this.last = e;
                this.element.classList.add('sorting');
                this.drag.element.classList.add(this.options.dragClass);
                this.dragging = true;
                this.trigger(this.element, 'start', this.drag.element, this.drag.startIndex);
            }
            let delta = this.drag.getDelta();
            if (this.options.axis === 'y') {
                delta.x = 0;
            }
            this.checkScroll(this.autoScroll.element, e);
            this.appendGhost();
            this.ghostEl.style.transform = `translate3d(${delta.x}px,${delta.y}px,0)`;
            if (this.last.clientX === e.clientX
                && this.last.clientY === e.clientY) {
                return;
            }
            this.last = e;
            let pos = {
                x: e.clientX - this.drag.offset.x,
                y: e.clientY - this.drag.offset.y
            };
            if (this.options.axis === 'y') {
                pos.x = this.drag.origin.clientX;
            }
            let el = document.elementFromPoint(pos.x, pos.y);
            if (!el)
                return;
            let target = this.getDragElement(el);
            if (!target)
                return;
            this.onDragOver({
                clientX: pos.x,
                clientY: pos.y,
                target: target
            });
        }
        checkScroll(el, e) {
            let page = {
                top: window.pageYOffset,
                bottom: window.pageYOffset + window.innerHeight
            };
            let distanceFromBottom = page.bottom - e.pageY;
            let distanceFromTop = e.pageY - page.top;
            const threshhold = 100;
            const distance = 500;
            if (distanceFromTop < threshhold) {
                this.autoScroll.distance = -(distance * (1 - (distanceFromTop / threshhold)));
                this.autoScroll.start();
            }
            else if (distanceFromBottom < threshhold) {
                this.autoScroll.distance = distance * (1 - (distanceFromBottom / threshhold));
                this.autoScroll.start();
            }
            else {
                this.autoScroll.stop();
            }
        }
        appendGhost() {
            if (this.ghostEl)
                return;
            let ghost = this.drag.element.cloneNode(true);
            ghost.classList.add(this.options.ghostClass);
            ghost.classList.remove(this.options.dragClass);
            let parent = this.drag.element.parentElement.getBoundingClientRect();
            parent.left - this.drag.element.offsetLeft;
            let box = this.drag.element.getBoundingClientRect();
            let left = this.drag.element.offsetLeft;
            let top = this.drag.element.offsetTop;
            ghost.style.top = top + 'px';
            ghost.style.left = left + 'px';
            ghost.style.width = box.width + 'px';
            ghost.style.height = box.height + 'px';
            ghost.style.position = 'absolute';
            ghost.style.zIndex = '100000';
            ghost.style.pointerEvents = 'none';
            this.element.appendChild(ghost);
            this.ghostEl = ghost;
        }
        onDragOver(e) {
            let target = e.target;
            if (!target || target === this.drag.element)
                return;
            this.lastEl = target;
            let targetBox = target.getBoundingClientRect();
            let t = {
                x: e.clientX,
                y: e.clientY
            };
            let px = (t.x - targetBox.left) / targetBox.width;
            let py = (t.y - targetBox.top) / targetBox.height;
            let nextSibling = target.nextElementSibling;
            let after = (this.options.axis === 'y')
                ? py > 0.5
                : px > 0.5 || py > 0.5;
            let currentIndex = _index(this.drag.element, this.options.draggable);
            let targetIndex = _index(target, this.options.draggable);
            if (targetIndex < currentIndex && !after) {
                target.parentNode.insertBefore(this.drag.element, target);
            }
            else if (targetIndex > currentIndex && after) {
                if (nextSibling) {
                    target.parentNode.insertBefore(this.drag.element, nextSibling);
                }
                else {
                    this.element.appendChild(this.drag.element);
                }
                console.log('after');
            }
            else {
                return;
            }
            if (this.options.animation) {
                _animate(this.drag.element.getBoundingClientRect(), this.drag.element, this.options.animation);
                _animate(targetBox, target, this.options.animation);
            }
        }
        onDrop(e) {
            UserSelect.unblock();
            this._listen();
            this.autoScroll.stop();
            if (this.moved) {
                e.preventDefault();
                e.stopPropagation();
            }
            if (this.drag) {
                this.drag.element.classList.remove(this.options.dragClass);
                this.ghostEl && this.ghostEl.remove();
                this.cloneEl && this.cloneEl.remove();
                let newIndex = _index(this.drag.element, this.options.draggable);
                if (this.drag.startIndex !== newIndex) {
                    if (newIndex >= 0) {
                        this.trigger(this.element, 'update', null, this.drag.startIndex, newIndex);
                    }
                }
                this.trigger(this.element, 'end', this.drag.element, this.drag.startIndex, newIndex);
            }
            this.reset();
        }
        reset() {
            this.element.classList.remove('sorting');
            this.ghostEl && this.ghostEl.remove();
            this.ghostEl = null;
            this.lastEl = null;
            this.cloneEl && this.cloneEl.remove();
            this.cloneEl = null;
            if (this.drag) {
                this.drag.dispose();
            }
            this.drag = null;
            this.dragging = false;
            this.moved = false;
        }
        trigger(element, name, targetEl, startIndex, newIndex) {
            let e = document.createEvent('Event');
            e.initEvent(name, true, true);
            e.item = targetEl;
            e.clone = this.cloneEl;
            e.oldIndex = startIndex;
            e.newIndex = newIndex;
            element.dispatchEvent(e);
        }
        getDraggable(target) {
            if (this.options.handle && !target.closest(this.options.handle)) {
                return null;
            }
            return this.getDragElement(target);
        }
        getDragElement(target) {
            let el = target.closest(this.options.draggable);
            if (el && el.parentNode !== this.element)
                return null;
            return el;
        }
    }
    Carbon.Sortable = Sortable;
    class AutoScroll {
        constructor(element) {
            this.active = false;
            this.element = element;
        }
        start() {
            if (this.active)
                return;
            this.active = true;
            this.step();
        }
        stop() {
            this.active = false;
        }
        step() {
            if (!this.active)
                return;
            requestAnimationFrame((timestamp) => {
                if (!this.timestamp) {
                    this.timestamp = timestamp;
                    this.step();
                }
                let delta = (timestamp - this.timestamp) / 1000;
                this.timestamp = timestamp;
                this.scroll(delta);
                this.step();
            });
        }
        scroll(delta) {
            let value = (delta * this.distance);
            this.element.scrollTop = this.element.scrollTop + value;
        }
    }
    function _animate(prevRect, target, duration) {
        if (!target.animate)
            return;
        let currentRect = target.getBoundingClientRect();
        let l = prevRect.left - currentRect.left;
        let t = prevRect.top - currentRect.top;
        if (l === 0 && t === 0)
            return;
        target.animate([
            { transform: `translate3d(${l}px,${t}px,0px)` },
            { transform: "translate3d(0,0,0)" }
        ], duration);
    }
    function _index(el, selector) {
        if (!el || !el.parentNode) {
            return -1;
        }
        let index = 0;
        while (el && (el = el.previousElementSibling)) {
            if (selector === '> *' || el.matches(selector)) {
                index++;
            }
        }
        return index;
    }
    let d = null;
    let f = null;
    function debugBox(box, point) {
        if (!d) {
            d = document.createElement('div');
            d.style.pointerEvents = 'none';
            d.style.position = 'fixed';
            d.style.border = '3px solid rgba(255, 0, 0, 0.5)';
            d.style.zIndex = '100000';
            d.style.boxSizing = 'border-box';
            document.body.appendChild(d);
            f = document.createElement('div');
            f.style.pointerEvents = 'none';
            f.style.position = 'fixed';
            f.style.borderRadius = '3px';
            f.style.background = 'blue';
            f.style.zIndex = '100001';
            f.style.boxSizing = 'border-box';
            f.style.width = '6px';
            f.style.height = '6px';
            document.body.appendChild(f);
        }
        d.style.top = box.top + 'px';
        d.style.left = box.left + 'px';
        d.style.width = box.width + 'px';
        d.style.height = box.height + 'px';
        f.style.top = point.y + 'px';
        f.style.left = point.x + 'px';
    }
    function _scrollParent(element) {
        let excludeStaticParent = getComputedStyle(element).position === "absolute";
        var el = element;
        var style;
        do {
            style = getComputedStyle(el);
            for (var name of ['overflow', 'overflowX', 'overflowY']) {
                if (/(auto|scroll)/.test(style[name]))
                    return el;
            }
        } while (el = el.parentElement);
        return element.ownerDocument.body;
    }
    function _on(element, type, listener) {
        return new EventObserver(element, type, listener);
    }
    class EventObserver {
        constructor(element, type, handler, useCapture = false) {
            this.element = element;
            this.type = type;
            this.handler = handler;
            this.useCapture = useCapture;
            this.active = true;
            this.element.addEventListener(type, handler, useCapture);
        }
        start() {
            if (this.active)
                return;
            this.element.addEventListener(this.type, this.handler, this.useCapture);
            this.active = true;
        }
        stop() {
            this.element.removeEventListener(this.type, this.handler, this.useCapture);
            this.active = false;
        }
    }
})(Carbon || (Carbon = {}));
