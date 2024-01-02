"use strict";
var Carbon;
(function (Carbon) {
    function setStyle(element, data) {
        for (var _i = 0, _a = Object.keys(data); _i < _a.length; _i++) {
            var key = _a[_i];
            element.style[key] = data[key];
        }
    }
    var Zoomable = (function () {
        function Zoomable() {
            var _this = this;
            this.padding = 50;
            this.queuedOpen = false;
            this.visible = false;
            this.animating = false;
            this.viewportEl = document.createElement('div');
            this.viewportEl.id = 'zoomer';
            this.viewportEl.classList.add('viewport');
            setStyle(this.viewportEl, {
                position: 'fixed',
                overflow: 'hidden',
                top: '0',
                right: '0',
                bottom: '0',
                left: '0',
                zIndex: '100',
                visibility: 'hidden',
                userSelect: 'none'
            });
            document.body.appendChild(this.viewportEl);
            window.addEventListener('resize', this.onResize.bind(this), false);
            window.addEventListener('scroll', this.onScroll.bind(this), false);
            document.addEventListener('keyup', function (e) {
                if (e.keyCode !== 27)
                    return;
                if (_this.pannable && _this.pannable.enabled) {
                    _this.pannable.reset();
                    _this.pannable.disable();
                }
                else {
                    _this.zoomOut();
                }
            });
        }
        Zoomable.get = function () {
            return Zoomable.instance || (Zoomable.instance = new Zoomable());
        };
        Zoomable.prototype.open = function (element) {
            var _this = this;
            this.scrollTop = document.body.scrollTop;
            if (this.visible || this.queuedOpen)
                return;
            this.element = element;
            if (this.animating) {
                this.queuedOpen = true;
                setTimeout(function () {
                    _this.queuedOpen = false;
                    _this.open(_this.element);
                }, 50);
                return;
            }
            this.origin = this.element.getBoundingClientRect();
            this.scale = 0;
            var data = element.dataset;
            this.url = data['zoomSrc'];
            if (data['zoomSize']) {
                var parts = data['zoomSize'].split('x');
                this.fullWidth = parseInt(parts[0], 10);
                this.fullHeight = parseInt(parts[1], 10);
            }
            else {
                this.fullWidth = parseInt(data['zoomWidth'], 10);
                this.fullHeight = parseInt(data['zoomHeight'], 10);
            }
            this.createClone();
            this.visible = true;
            this.viewportEl.classList.add('open');
            this.viewportEl.classList.remove('closed');
            this.viewportEl.style.visibility = 'visible';
            this.viewportEl.style.cursor = 'zoom-out';
            var self = this;
            var zo = function () {
                self.zoomOut();
            };
            this.zo = zo;
            if (this.cloneEl.classList.contains('pannable') && Carbon.Pannable !== undefined) {
                this.pannable = new Carbon.Pannable(this.cloneEl, {
                    enabled: false,
                    delayInitialize: true
                });
                this.pannable.initScale = this.scale;
                this.gestures = this.pannable.gestures;
                this.gestures.add(new Carbon.Gestures.Tap({ event: 'doubletap', taps: 2, interval: 300 }));
                this.gestures.add(new Carbon.Gestures.Tap());
                this.gestures.on("doubletap", this.onDoubleTap.bind(this));
                this.gestures.on("tap", this.onTap.bind(this));
                this.gestures.on('panmove', this.onPanMove.bind(this));
                this.gestures.on('panend', this.onPanEnd.bind(this));
            }
            else {
                this.viewportEl.addEventListener('click', zo, {
                    once: true
                });
            }
            this.element.style.visibility = 'hidden';
            _.trigger(this.viewportEl, 'zoomer:open', {});
            this.cloneEl.style['will-change'] = 'transform';
            this.zoomIn();
        };
        Zoomable.prototype.onPanEnd = function (e) {
            console.log('panend', e, this.pannable.enabled);
            if (this.pannable.enabled)
                return;
            if (Math.abs(e.deltaY) > 50) {
                this.zoomOut();
            }
            else {
                this.pannable.center();
                this.pannable.transform.translate = this.pannable.position;
                this.pannable.update();
            }
        };
        Zoomable.prototype.onPanMove = function (e) {
            if (this.pannable.enabled)
                return;
            e.deltaX = 0;
            this.pannable.onDrag(e, true);
        };
        Zoomable.prototype.onTap = function () {
            var _this = this;
            this.te = setTimeout(function () {
                if (!_this.pannable.enabled) {
                    _this.zoomOut();
                }
            }, 300);
        };
        Zoomable.prototype.onDoubleTap = function () {
            if (this.te) {
                clearTimeout(this.te);
                this.te = null;
            }
            if (this.pannable.enabled) {
                this.pannable.reset();
                this.pannable.disable();
                return;
            }
            this.pannable.enable();
            var scaleFactor = 3;
            var newScale = this.scale * scaleFactor;
            this.pannable.transform.scale = newScale;
            var elBox = this.cloneEl.getBoundingClientRect();
            var viewport = this.viewportEl.getBoundingClientRect();
            this.pannable.position = {
                x: -((elBox.width * scaleFactor) - viewport.width) / 2,
                y: -((elBox.height * scaleFactor) - viewport.height) / 2
            };
            this.pannable.transform.translate = this.pannable.position;
            this.pannable.update();
        };
        Zoomable.prototype.createClone = function () {
            var a = this.viewportEl.querySelector('.clone');
            a && a.remove();
            var cloneEl = this.element.cloneNode(true);
            if (cloneEl.tagName == 'CARBON-IMAGE' && cloneEl.querySelector('img')) {
                cloneEl = cloneEl.querySelector('img');
            }
            setStyle(cloneEl, {
                display: 'block',
                position: 'absolute',
                top: '0',
                left: '0',
                width: this.origin.width + 'px',
                height: this.origin.height + 'px',
                transformOrigin: 'left top',
                transform: "translate(" + this.origin.left + "px, " + this.origin.top + "px) scale(1)"
            });
            cloneEl.draggable = false;
            cloneEl.classList.add('clone');
            cloneEl.classList.remove('zoomable');
            cloneEl.removeAttribute('on-click');
            this.viewportEl.appendChild(cloneEl);
            this.calculateTargetPosition({ width: this.fullWidth, height: this.fullHeight });
            this.cloneEl = cloneEl;
        };
        Zoomable.prototype.calculateTargetPosition = function (elementSize) {
            this.origin = this.element.getBoundingClientRect();
            var viewport = this.viewportEl.getBoundingClientRect();
            var size = this.fit(elementSize, { width: viewport.width - this.padding, height: viewport.height - this.padding });
            this.fittedBox = {
                width: size.width,
                height: size.height,
                top: (viewport.height - size.height) / 2,
                left: (viewport.width - size.width) / 2
            };
            if (elementSize.top) {
                this.fittedBox.top = elementSize.top;
            }
            if (elementSize.left) {
                this.fittedBox.left = elementSize.left;
            }
            this.scale = this.fittedBox.width / this.origin.width;
        };
        Zoomable.prototype.onScroll = function () {
            if (!this.element)
                return;
            if (Math.abs(this.scrollTop - window.scrollY) < 15) {
                return;
            }
            if (this.visible) {
                this.zoomOut();
                return;
            }
            this.calculateTargetPosition({ width: this.fullWidth, height: this.fullHeight });
            if (!this.animating) {
                this.cloneEl.style.transform = "translate(" + this.origin.left + "px," + this.origin.top + "px)";
            }
        };
        Zoomable.prototype.onResize = function () {
            this.calculateTargetPosition({ width: this.fullWidth, height: this.fullHeight });
            this.cloneEl.style.transition = 'none';
            this.cloneEl.style.transform = "translate(" + this.fittedBox.left + "px," + this.fittedBox.top + "px) scale(" + this.scale + ")";
        };
        Zoomable.prototype.zoomIn = function (duration) {
            var _this = this;
            if (duration === void 0) { duration = '0.4s'; }
            var easing = 'cubic-bezier(.175,.885,.32,1)';
            this.cloneEl.style.transition = "transform " + duration + " " + easing;
            this.cloneEl.style.transform = "translate(" + this.fittedBox.left + "px," + this.fittedBox.top + "px) scale(" + this.scale + ")";
            var animated = new Deferred();
            var otherImg = this.cloneEl.tagName == 'IMG'
                ? this.cloneEl
                : this.cloneEl.querySelector('img');
            if (otherImg) {
                var img = new Image();
                img.onload = function () {
                    animated.promise.then(function () {
                        otherImg.removeAttribute('srcset');
                        otherImg.src = _this.url;
                    });
                };
                img.src = this.url;
            }
            setTimeout(function () {
                animated.resolve(true);
            }, 401);
        };
        Zoomable.prototype.step = function (p) {
            var left = ((this.origin.left - this.fittedBox.left) * p) + this.fittedBox.left;
            var top = ((this.origin.top - this.fittedBox.top) * p) + this.fittedBox.top;
            var scale = ((1 - this.scale) * p) + this.scale;
            this.cloneEl.style.transform = "translate3d(" + left + "px, " + top + "px, 0) scale(" + scale + ")";
        };
        Zoomable.prototype.fit = function (element, box) {
            if (element.height <= box.height && element.width <= box.width) {
                return { width: element.width, height: element.height };
            }
            var mutiplier = (box.width / element.width);
            if (element.height * mutiplier <= box.height) {
                return {
                    width: box.width,
                    height: Math.round(element.height * mutiplier)
                };
            }
            else {
                mutiplier = (box.height / element.height);
                return {
                    width: Math.round(element.width * mutiplier),
                    height: box.height
                };
            }
        };
        Zoomable.prototype.next = function (timestamp) {
            if (!this.animating)
                return;
            var duration = 200;
            if (!this.timestamp) {
                this.timestamp = timestamp;
            }
            else {
                var elapsed = timestamp - this.timestamp;
                var p = Math.min(elapsed / duration, 1);
                this.step(p);
                if (elapsed >= duration) {
                    this.viewportEl.classList.remove('open', 'closing');
                    this.viewportEl.classList.add('closed');
                    this.viewportEl.style.background = '';
                    this.element.style.visibility = 'visible';
                    this.animating = false;
                    this.cloneEl.remove();
                    return;
                }
            }
            requestAnimationFrame(this.next.bind(this));
        };
        Zoomable.prototype.zoomOut = function () {
            if (this.zo) {
                this.viewportEl.removeEventListener('click', this.zo);
                this.zo = null;
            }
            if (!this.visible)
                return;
            this.viewportEl.style.cursor = null;
            this.viewportEl.classList.add('closing');
            this.timestamp = null;
            this.visible = false;
            this.calculateTargetPosition(this.cloneEl.getBoundingClientRect());
            this.cloneEl.style.transition = 'none';
            this.animating = true;
            this.viewportEl.style.background = 'transparent';
            _.trigger(this.viewportEl, 'zoomer:close');
            requestAnimationFrame(this.next.bind(this));
        };
        return Zoomable;
    }());
    Carbon.Zoomable = Zoomable;
    var Deferred = (function () {
        function Deferred() {
            var _this = this;
            this.promise = new Promise(function (resolve, reject) {
                _this._resolve = resolve;
                _this._reject = reject;
            });
        }
        Deferred.prototype.resolve = function (value) {
            this._resolve(value);
        };
        Deferred.prototype.reject = function (value) {
            this._reject(value);
        };
        return Deferred;
    }());
})(Carbon || (Carbon = {}));
Carbon.controllers.set('zoom', {
    in: function (e) {
        if (e.target.closest('carbon-indicator, .hovering'))
            return;
        Carbon.Zoomable.get().open(e.target);
    }
});
