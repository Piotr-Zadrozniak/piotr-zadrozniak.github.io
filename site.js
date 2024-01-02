Carbon.Reactive.on('routed', adjust);
var mainEl = document.querySelector('main');
var frameRequest;
var l = mainEl.scrollLeft;
mainEl.addEventListener('scroll', function () {
    frameRequest && window.cancelAnimationFrame(frameRequest);
    frameRequest = window.requestAnimationFrame(pageCheck);
}, {
    capture: false,
    passive: true
});
function checkViewport() {
    let viewportEl = document.querySelector('meta[name="viewport"]');
    let isPortrait = window.innerHeight > window.innerWidth;
    viewportEl.content = isPortrait ? 'width=device-width, maximum-scale=1' : 'height=840, maximum-scale=1';
}
if (navigator && navigator.userAgent.includes('Chrome')) {
    window.addEventListener('orientationchange', checkViewport);
    checkViewport();
}
window.addEventListener('resize', function () {
    pageCheck();
    adjust();
}, false);
let ua = navigator.userAgent;
if (ua && ua.includes('iPad')) {
    document.body.classList.add('iPad');
}
document.body.addEventListener('wheel', e => {
    if (location.pathname.includes('/blog'))
        return;
    let deltaX = e.deltaY || e.wheelDeltaY;
    if (deltaX) {
        let scrollLeft = mainEl.scrollLeft + deltaX;
        mainEl.scrollLeft = scrollLeft;
    }
}, true);
function removeWhitespace(element) {
    for (var i = 0; i < element.childNodes.length; i++) {
        var node = element.childNodes[i];
        if (node.nodeType == 3 && !/\S/.test(node.nodeValue)) {
            element.removeChild(node);
        }
    }
}
;
function adjust() {
    const maxWidth = 6000;
    if (location.pathname.includes('/projects')) {
        setProjectInfoWidth();
    }
    let containerEl = document.querySelector('.container');
    if (!containerEl)
        return;
    removeWhitespace(containerEl);
    let maxHeight = containerEl.offsetHeight;
    for (var el of Array.from(document.querySelectorAll('.contained'))) {
        let size = getDimensions(parseInt(el.dataset['width'], 10), parseInt(el.dataset['height'], 10), maxWidth, maxHeight);
        el.style.width = size.width + 'px';
        el.style.height = size.height + 'px';
    }
    if (document.querySelector('.about')) {
        setAboutColumns();
    }
    setContainerWidth(containerEl);
}
function setContainerWidth(containerEl) {
    containerEl.style.width = '500000px';
    let els = containerEl.children;
    if (els.length === 0)
        return;
    let left = els[0].getBoundingClientRect().left;
    let lastEl = els[els.length - 1];
    let right = lastEl.getBoundingClientRect().right;
    let width = Math.ceil(right - left) + css(lastEl, 'marginRight') + css(containerEl, 'paddingRight');
    containerEl.style.width = width + 'px';
}
function css(el, name) {
    let style = getComputedStyle(el);
    let val = style[name];
    if (val.includes('px')) {
        return parseInt(val, 10);
    }
    return val;
}
function getDimensions(width, height, maxWidth, maxHeight) {
    if (height <= maxHeight && width <= maxWidth) {
        return { width: width, height: height };
    }
    let mutiplier = (maxWidth / width);
    if (height * mutiplier <= maxHeight) {
        return {
            width: maxWidth,
            height: Math.round(height * mutiplier)
        };
    }
    else {
        mutiplier = (maxHeight / height);
        return {
            width: Math.round(width * mutiplier),
            height: maxHeight
        };
    }
}
function _outerHeight(el) {
    let css = getComputedStyle(el);
    return parseInt(css.height) + parseInt(css.marginBottom) + parseInt(css.marginTop);
}
function setProjectInfoWidth() {
    pageCheck();
    let el = document.querySelector('.sidebar > .info');
    let contentEl = document.querySelector('main .content');
    const unitWidth = 450;
    let infoBlockEl = el.querySelector('.block');
    let footerEl = document.querySelector('footer');
    let h2 = el.querySelector('h2');
    let hrEl = el.querySelector('hr');
    let infoTop = infoBlockEl.getBoundingClientRect().top;
    let footerTop = footerEl.getBoundingClientRect().top;
    let blockHeight = footerTop - infoTop;
    infoBlockEl.style.height = blockHeight + 'px';
    let lastEl = infoBlockEl.children[infoBlockEl.children.length - 1];
    let blockWidth = lastEl.getBoundingClientRect().left + 470;
    contentEl.style.marginLeft = (blockWidth + 20) + 'px';
    el.style.width = blockWidth + 'px';
}
function setAboutColumns() {
    for (var el of Array.from(document.querySelectorAll('.about .column'))) {
        let paddEl = el.querySelector('.padd');
        let lastEl = paddEl.children[paddEl.children.length - 1];
        let elBox = el.getBoundingClientRect();
        let lastBox = lastEl.getBoundingClientRect();
        let width = lastBox.right - elBox.left;
        el.style.marginRight = width + 'px';
    }
}
Carbon.Reactive.on('routed', function (e) {
    if (!e.reloaded) {
        mainEl.scrollLeft = 0;
    }
    for (var el of Array.from(document.querySelectorAll('.siteLinks li'))) {
        el.classList.remove('current');
    }
    document.body.classList.remove('showNav', 'project');
    if (e.path == '/') {
        selectSiteLink('home');
    }
    else if (e.path.startsWith('/project')) {
        document.body.classList.add('project');
        setProjectInfoWidth();
    }
    else if (e.path.startsWith('/about')) {
        setAboutColumns();
        setContainerWidth(document.querySelector('.container'));
        selectSiteLink('about');
    }
    else if (e.path.startsWith('/contact')) {
        selectSiteLink('contact');
    }
    setupHammer(document.querySelector('.sidebar'));
});
function setupHammer(sidebarEl) {
    var hammertime = new Hammer(sidebarEl);
    hammertime.get('pan').set({ direction: Hammer.DIRECTION_HORIZONTAL, threshold: 0 });
    hammertime.on('panstart', function (ev) {
        l = mainEl.scrollLeft;
    });
    var fr = null;
    hammertime.on('pan', function (ev) {
        let scrollLeft = l - ev.deltaX;
        fr && window.cancelAnimationFrame(fr);
        fr = window.requestAnimationFrame(function () {
            mainEl.scrollLeft = scrollLeft;
        });
    });
}
function selectSiteLink(name) {
    for (var el of Array.from(document.querySelectorAll('.siteLinks li.current'))) {
        el.classList.remove('current');
    }
    let linkEl = document.querySelector(`#${name}Link`);
    linkEl && linkEl.classList.add('current');
}
document.body.addEventListener('mouseover', e => {
    let target = e.target;
    if (target.matches('.captionLink')) {
        let pieceEl = target.closest('carbon-piece');
        pieceEl.classList.add('hovering');
        let mouseLeaveObserver = _.observe(pieceEl, 'mouseleave', e => {
            e.target.classList.remove('hovering');
            mouseLeaveObserver.stop();
        });
    }
});
var lastScrollLeft = 0;
function pageCheck() {
    let scrollLeft = mainEl.scrollLeft;
    let pageWidth = window.innerWidth;
    let nextProjectLinkEl = document.querySelector('.nextProjectLink');
    if (nextProjectLinkEl) {
        if (pageWidth < 1280 && scrollLeft < 300) {
            nextProjectLinkEl.style.display = 'none';
        }
        else {
            nextProjectLinkEl.style.display = null;
        }
    }
    document.body.classList.toggle('tall', scrollLeft > 450);
    if (lastScrollLeft == scrollLeft)
        return;
    lastScrollLeft = scrollLeft;
    if (scrollLeft < 400) {
        let opacity = (-(1 / 380) * scrollLeft) + 1;
        if (opacity < 0)
            opacity = 0;
        let sidebarEl = document.querySelector('.sidebar');
        sidebarEl.style.transition = 'none';
        sidebarEl.style.opacity = opacity.toString();
    }
    let scrollHintEl = document.querySelector('.scrollHint');
    if (scrollHintEl) {
        let projectEl = document.querySelector('.projects');
        if ((scrollLeft > 0) && ((projectEl.clientWidth + 450) > pageWidth)) {
            scrollHintEl.classList.add('hidden');
        }
        else {
            scrollHintEl.classList.remove('hidden');
        }
    }
}
document.body.classList.add('loaded');
Carbon.controllers.navigate = {
    home() {
        scrollTo(mainEl, 0, 250);
    }
};
Carbon.ActionKit.observe('click');
function scrollTo(element, to, duration) {
    let difference = to - element.scrollLeft;
    let perTick = difference / duration * 10;
    setTimeout(() => {
        element.scrollLeft = element.scrollLeft + perTick;
        if (element.scrollLeft == to)
            return;
        scrollTo(element, to, duration - 10);
    }, 10);
}
