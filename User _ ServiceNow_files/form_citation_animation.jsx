/*! RESOURCE: /scripts/form_citation_animation.js */
(function() {
    'use strict';
    var ANIMATION_CONFIG = {
        DURATION: 1800,
        STAY_VISIBLE: 300,
        FADE_DURATION: 800,
        FOCUS_BUFFER: 300,
        CLEANUP_BUFFER: 100,
        PADDING: 4,
        TAB_SWITCH_BUFFER: 200,
        SCROLL_BUFFER: 600,
        STROKE_OFFSET: 1,
        BORDER_RADIUS: 4
    };
    var FOCUSABLE_SELECTORS = [
        'input:not([type="hidden"]):not([disabled]):not([aria-hidden="true"])',
        'textarea:not([disabled]):not([aria-hidden="true"])',
        'select:not([disabled])',
        'button:not([disabled])',
        'div[tabindex]:not([tabindex="-1"])',
        '[tabindex]:not([tabindex="-1"])'
    ].join(', ');
    function showSourceHiddenMessage() {
        g_form.addInfoMessage(getMessage("The source may be hidden in your current view. Try resetting your user preferences, or contact your admin for assistance."));
    }
    function isElementVisible(element) {
        if (!element || element.disabled || element.offsetParent === null) {
            return false;
        }
        
        if (element.getAttribute('aria-hidden') === 'true') {
            return false;
        }
        
        var computedStyle = window.getComputedStyle(element);
        return computedStyle.display !== 'none';
    }
    function switchToTabContainingElement(fieldName) {
        try {
            var tabName = g_form.getTabNameForField(fieldName);
            g_form.activateTab(tabName);
            return true;
        } catch (e) {
            return false;
        }
    }
    function createSVGRect(width, height, perimeter) {
var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        var offset = ANIMATION_CONFIG.STROKE_OFFSET;
        
        rect.setAttribute('x', offset);
        rect.setAttribute('y', offset);
        rect.setAttribute('width', width - offset * 2);
        rect.setAttribute('height', height - offset * 2);
        rect.setAttribute('rx', ANIMATION_CONFIG.BORDER_RADIUS);
        rect.setAttribute('ry', ANIMATION_CONFIG.BORDER_RADIUS);
        rect.setAttribute('stroke-dasharray', perimeter);
        rect.setAttribute('stroke-dashoffset', perimeter);
        
        return rect;
    }
    function createSVGContainer(width, height) {
var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'snake-svg-container');
        svg.setAttribute('width', width);
        svg.setAttribute('height', height);
        svg.style.setProperty('--snake-animation-duration', ANIMATION_CONFIG.DURATION + 'ms');
        svg.style.setProperty('--snake-fade-duration', ANIMATION_CONFIG.FADE_DURATION + 'ms');
        return svg;
    }
    function findMonacoEditor(container) {
        var monacoTextarea = container.querySelector('textarea.inputarea.monaco-mouse-cursor-text');
        return monacoTextarea && monacoTextarea.offsetParent !== null ? monacoTextarea : null;
    }
    function findTinyMCEIframe(container) {
        var iframe = container.querySelector('iframe');
        if (iframe && iframe.offsetParent !== null && 
            iframe.offsetWidth > 0 && iframe.offsetHeight > 0) {
            return iframe;
        }
        return null;
    }
    function findFocusableElement(container) {
        if (!container) {
            return null;
        }
        var monacoEditor = findMonacoEditor(container);
        if (monacoEditor) {
            return monacoEditor;
        }
        var tinyMCEIframe = findTinyMCEIframe(container);
        if (tinyMCEIframe) {
            return tinyMCEIframe;
        }
        var focusableElements = container.querySelectorAll(FOCUSABLE_SELECTORS);
        for (var i = 0; i !== focusableElements.length; i++) {
            if (focusableElements[i].offsetParent !== null) {
                return focusableElements[i];
            }
        }
        return null;
    }
    function focusIframeContent(iframe) {
        try {
            var iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            var iframeBody = iframeDoc.body;
            if (iframeBody) {
                iframeBody.focus();
                return true;
            }
        } catch (e) {
            iframe.focus();
        }
        return false;
    }
    function setFocusOnElement(element) {
        if (!element) {
            return;
        }
        if (element.tagName === 'IFRAME') {
            focusIframeContent(element);
        } else {
            element.focus();
        }
    }
    function cleanupAnimation(element, svg) {
        element.classList.remove('snake-highlight');
        if (svg.parentNode) {
            svg.parentNode.removeChild(svg);
        }
    }
    function setupAnimationLifecycle(element, svg, rect, focusElement, cfg) {
        var didFadeStart = false;
        var didCleanup = false;
        function startFadeOut() {
            if (didFadeStart) {
                return;
            }
            didFadeStart = true;
            svg.classList.add('snake-fade-out');
        }
        function cleanupAndFocus() {
            if (didCleanup) {
                return;
            }
            didCleanup = true;
            cleanupAnimation(element, svg);
            setTimeout(function() {
                setFocusOnElement(focusElement);
            }, cfg.FOCUS_BUFFER);
        }
        function scheduleFallbacks() {
            var fadeStartFallback = cfg.DURATION + cfg.STAY_VISIBLE + cfg.CLEANUP_BUFFER;
            var removeTimeFallback = fadeStartFallback + cfg.FADE_DURATION;
            setTimeout(function() {
                startFadeOut();
            }, fadeStartFallback);
            setTimeout(function() {
                cleanupAndFocus();
            }, removeTimeFallback);
        }
        function wireAnimationEvents() {
            rect.addEventListener('animationend', function(e) {
                if (e.animationName !== 'snakeDraw') {
                    return;
                }
                setTimeout(function() {
                    startFadeOut();
                }, cfg.STAY_VISIBLE + cfg.CLEANUP_BUFFER);
            }, { once: true });
            function onSvgAnimationEnd(e) {
                if (e.animationName !== 'fadeOut') {
                    return;
                }
                svg.removeEventListener('animationend', onSvgAnimationEnd);
                cleanupAndFocus();
            }
            svg.addEventListener('animationend', onSvgAnimationEnd);
        }
        wireAnimationEvents();
        scheduleFallbacks();
    }
    function animateBorder(element, citationField, animationDisabled, focusElement) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(function() {
            element.classList.add('snake-highlight');
            var cfg = ANIMATION_CONFIG;
            requestAnimationFrame(function() {
                var width = element.clientWidth;
                var height = element.clientHeight + (cfg.PADDING * 2);
                var perimeter = animationDisabled ? 0 : (width + height) * 2;
                var svg = createSVGContainer(width, height);
                var rect = createSVGRect(width, height, perimeter);
                if (animationDisabled) {
                    rect.setAttribute('stroke-dashoffset', 0);
                }
                svg.appendChild(rect);
                element.appendChild(svg);
                setupAnimationLifecycle(element, svg, rect, focusElement, cfg);
            });
        }, ANIMATION_CONFIG.SCROLL_BUFFER);
    }
    function createSnakeAnimation(recordTarget, citationField, animationDisabled) {
        if (!recordTarget || !citationField) {
            return;
        }
        var element = document.getElementById('element.' + recordTarget + '.' + citationField);
        if (!element || !switchToTabContainingElement(citationField)) {
            showSourceHiddenMessage();
            return;
        }
        setTimeout(function() {
            if (!g_form.hasField(citationField)) {
                showSourceHiddenMessage();
                return;
            }
            var focusElement = g_form.getControl(citationField);
            if (!isElementVisible(focusElement)) {
                focusElement = findFocusableElement(element);
            }
            if (!focusElement) {
                showSourceHiddenMessage();
                return;
            }
            animateBorder(element, citationField, animationDisabled, focusElement);
        }, ANIMATION_CONFIG.TAB_SWITCH_BUFFER);
    }
    function getCitationFieldNameFromPayload(citationPayload) {
        var fields = citationPayload && citationPayload.fields;
        if (fields && Array.isArray(fields) && fields.length > 0) {
            return fields[0];
        }
        return '';
    }
    function bindCitationLinkClickedEventOnce() {
        if (window.NOW && window.NOW.FormCitationAnimation && window.NOW.FormCitationAnimation._nacmCitationEventBound) {
            return;
        }
        function onCitationLinkClicked(e) {
            var detail = (e && e.detail) ? e.detail : {};
            var recordTarget = detail.table || (window.g_form && typeof g_form.getTableName === 'function' ? g_form.getTableName() : '');
            var citationField = '';
            try {
                citationField = getCitationFieldNameFromPayload(detail.citationPayload);
            } catch (error) {
console.error('Failed to decode/parse citation payload', error);
                return;
            }
            if (!recordTarget || !citationField) {
                return;
            }
            if (window.NOW && window.NOW.FormCitationAnimation && typeof window.NOW.FormCitationAnimation.init === 'function') {
                window.NOW.FormCitationAnimation.init(recordTarget, citationField);
            }
        }
        window.addEventListener('nacmCitationLinkClicked', onCitationLinkClicked);
        window.NOW = window.NOW || {};
        window.NOW.FormCitationAnimation = window.NOW.FormCitationAnimation || {};
        window.NOW.FormCitationAnimation._nacmCitationEventBound = true;
    }
    window.NOW = window.NOW || {};
    window.NOW.FormCitationAnimation = {
        init: function(recordTarget, citationField) {
            if (recordTarget && citationField) {
                createSnakeAnimation(recordTarget, citationField, window.NOW.animationDisabled);
            }
        }
    };
    bindCitationLinkClickedEventOnce();
})();
;
