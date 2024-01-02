"use strict";
var Panel;
(function (Panel) {
    let mainEl = document.querySelector('main');
    function translateX(element, start, end, duration = 200) {
        element.classList.add('show');
        mainEl.style.transition = `margin-left ${duration}ms ease-out`;
        let animation = element.animate([
            { transform: `translateX(${start}px)` },
            { transform: `translateX(${end}px)` },
        ], { duration: duration, easing: 'ease-out', fill: 'forwards' });
        return animation.finished;
    }
    function back(one, two) {
        one.style.zIndex = '5';
        two.style.zIndex = '6';
        translateX(one, 0, two.clientWidth).then(() => {
            one.classList.remove('show');
            CM.sitePreview.unfix();
        });
        mainEl.style.marginLeft = two.offsetWidth + 'px';
        return translateX(two, -two.offsetWidth, 0);
    }
    Panel.back = back;
    ;
    function forwards(one, two, duration = 200) {
        one.style.zIndex = '5';
        two.style.zIndex = '6';
        translateX(one, 0, -one.clientWidth, duration).then(() => {
            one.classList.remove('show');
        });
        mainEl.style.marginLeft = two.offsetWidth + 'px';
        document.getElementById('siteManager').style.zIndex = null;
        return translateX(two, 300, 0, duration);
    }
    Panel.forwards = forwards;
})(Panel || (Panel = {}));
var PM;
(function (PM) {
    let mainEl = document.querySelector('main');
    let iframeEl = document.querySelector('#sitePreview');
    let appSwitcherEl = document.querySelector('#appSwitcher');
    let pageManagerEl = document.querySelector('.pageManager.project');
    let projectPieceManagerEl = document.querySelector('#projectPieceManager');
    let piecesEl = document.querySelector('#projectPieceManager ul.pieces');
    let ratioW = 300 / window.innerWidth;
    let ratioH = 210 / window.innerHeight;
    function getRandom(min, max) {
        return Math.random() * (max - min) + min;
    }
    function slidePanelX(element, start, end, duration, delay) {
        let animation = element.animate([
            { transform: `translateX(${start}px)` },
            { transform: `translateX(${end}px)` },
        ], { duration: duration, iterations: 1, easing: 'cubic-bezier(.02, .01, .47, 1.1)', fill: 'forwards', delay: delay });
        return animation.finished;
    }
    function slidePanelY(element, start, end, duration, delay) {
        let animation = element.animate([
            { transform: `translateY(${start}px)` },
            { transform: `translateY(${end}px)` },
        ], { duration: duration, iterations: 1, easing: 'cubic-bezier(.02, .01, .47, 1.1)', fill: 'forwards', delay: delay });
        return animation.finished;
    }
    function expandPieceManager(duration, delay) {
        let animation = projectPieceManagerEl.animate([
            { transform: `translateX(0px) scale(${ratioW},${ratioH})` },
            { transform: 'translateX(-60px) scale(1.0)' },
        ], {
            duration: duration,
            iterations: 1,
            easing: 'cubic-bezier(.02, .01, .47, 1.1)',
            fill: 'forwards',
            delay: delay
        });
        return animation.finished;
    }
    function collapsePieceManager(duration, delay) {
        let animation = projectPieceManagerEl.animate([
            { transform: `translateX(-60px) scale(1.0)` },
            { transform: `translateX(0px) scale(${ratioW},${ratioH})` },
        ], {
            duration: duration,
            iterations: 1,
            easing: 'cubic-bezier(.02, .01, .47, 1.1)',
            fill: 'forwards',
            delay: delay
        });
        return animation.finished;
    }
    function fade(element, start, end, duration, delay) {
        let animation = element.animate([
            { opacity: start.toString() },
            { opacity: end.toString() },
        ], {
            duration: duration,
            iterations: 1,
            easing: 'ease-in-out',
            fill: 'forwards',
            delay: delay
        });
        return animation.finished;
    }
    function thumbFader(start, end, duration) {
        Array.from(document.querySelectorAll('.piece .thumbnail')).forEach(element => {
            element.animate([
                { opacity: `${start}` },
                { opacity: `${end}` },
            ], {
                duration: duration,
                iterations: 1,
                easing: 'ease-in-out',
                fill: 'forwards',
                delay: getRandom(200, 400)
            });
        });
    }
    function expandIn() {
        projectPieceManagerEl.classList.add('show');
        slidePanelX(iframeEl, 0, iframeEl.clientWidth, 300, 200);
        slidePanelX(appSwitcherEl, 0, -60, 300, 200);
        slidePanelY(pageManagerEl, 0, pageManagerEl.clientHeight, 300, 200);
        piecesEl.style.opacity = '0';
        expandPieceManager(300, 200).then(() => {
            fade(piecesEl, 0, 1, 300, 200);
            document.querySelector('.piecesContent').style.opacity = 0;
        });
    }
    PM.expandIn = expandIn;
    function collapseOut() {
        fade(piecesEl, 1, 0, 200, 0).then(() => {
            slidePanelX(iframeEl, iframeEl.clientWidth, 0, 250, 150);
            slidePanelX(appSwitcherEl, -60, 0, 250, 150);
            slidePanelY(pageManagerEl, pageManagerEl.clientHeight, 0, 250, 150);
            collapsePieceManager(250, 150).then(() => {
                document.querySelector('.piecesContent').style.opacity = 1;
                piecesEl.innerHTML = '';
                projectPieceManagerEl.classList.remove('show');
            });
        });
    }
    PM.collapseOut = collapseOut;
})(PM || (PM = {}));
var CM;
(function (CM) {
    function getRandom(min, max) {
        return Math.random() * (max - min) + min;
    }
    CM.PieceBlockActions = {
        layout(e) {
            let x = 0;
            let deg = -3;
            let zIndex = 1000;
            let pieceEls = e.target.querySelectorAll('.piece');
            let degInc = 6 / pieceEls.length;
            for (var el of Array.from(pieceEls)) {
                if (x !== 0) {
                    x += getRandom(-1, 1) - el.offsetWidth + 7;
                }
                el.style.transform = `rotateZ(${deg}deg)`;
                el.style.left = x + 20 + 'px';
                el.style.top = getRandom(4, 10).toString() + 'px';
                zIndex--;
                el.style.zIndex = zIndex.toString();
                x += el.offsetWidth;
                deg += Math.max(degInc, .5);
            }
        }
    };
})(CM || (CM = {}));
var Pointless;
(function (Pointless) {
    function fizz(starCount) {
        let maxTime = 41;
        let universerEl = document.querySelector('#universe');
        let width = universerEl.clientWidth;
        let height = universerEl.clientHeight;
        for (var i = 0; i < starCount; ++i) {
            let xpos = Math.round(Math.random() * width);
            let star = document.createElement('div');
            let speed = 500 * (Math.random() * maxTime + 1);
            star.setAttribute('class', 'star' + (3 - Math.floor((speed / 500) / 8)));
            star.style.backgroundColor = 'white';
            universerEl.appendChild(star);
            star.animate([
                { transform: 'translate3d(' + xpos + 'px, ' + height + 'px, 0)', opacity: 1 },
                { transform: 'translate3d(' + xpos + 'px, -10px, 0)', opacity: 0 }
            ], {
                delay: Math.random() * -speed,
                duration: speed,
                iterations: 1000
            });
        }
    }
    Pointless.fizz = fizz;
})(Pointless || (Pointless = {}));
