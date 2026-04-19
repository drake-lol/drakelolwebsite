document.addEventListener('DOMContentLoaded', () => {
    const $ = id => document.getElementById(id);
    const container = $('scene-container');
    if (!container) return console.error("Scene container not found!");

    // --- NEW: DISABLE DARK READER ---
    // This injects a meta tag that tells Dark Reader: "Do not invert this page."
    const metaLock = document.createElement('meta');
    metaLock.name = "darkreader-lock";
    document.head.appendChild(metaLock);

    // Let the browser handle native elements in both color schemes
    document.documentElement.style.colorScheme = 'dark light';
    // --------------------------------

    // --- State ---
    const state = {
        isPaused: false, pausedByVisibility: false,
        enableNewPageScroll: false, // Toggle this to false to turn off scrolling and hide the arrow
        currentNumShapes: 60, currentScaleMultiplier: 1.0, currentRotationSpeedMultiplier: 1.0,
        currentMovementSpeedMultiplier: 1.0, currentNumTransitionShapes: 10, currentBlurIntensity: 200,
        currentResolutionIndex: 2, previousResolutionIndex: 0,
        currentBrightness: 30, currentContrast: 90, currentSaturation: 350, currentHueRotate: 0,
        rawUnbalancedPalette: [], currentDominanceCap: 60,
        currentAccentBoost: 0.5, currentMinThreshold: 1, colorPalette: [], defaultColorPalette: [],
        targetBackgroundColor: '#181818', previousBackgroundColorForTransition: '#181818',
        targetPageBackgroundColor: '#181818', currentPageBackgroundColor: '#181818', previousPageBackgroundColorForTransition: '#181818',
        currentTextColor: '#FFFFFF', targetTextColor: '#FFFFFF', previousTextColorForTransition: '#FFFFFF',
        textColorTransitionStartTime: 0, isTextColorTransitioning: false, isFirstTextUpdate: true,
        currentAnimatedBackgroundColor: '#181818', backgroundColorTransitionStartTime: 0, isBackgroundTransitioning: false,
        prevAnimatedBgColorForBlur: '#181818', prevBlurToggleState: true, prevBlurIntensityForBlur: 300, // Blur is on by default
        lastfmPollIntervalId: null, currentAlbumArtUrl: '', initialSceneSetupPerformed: false,
        firstLastFmColorChangeDone: false, lastFmColorsExtractedSuccessfully: false,
        firstLastFmFetchAttempted: false, lastFmArtProcessing: false,
        DEFAULT_IMAGE_URL: './assets/bgimg/achtsquare_512.png',
        previousFrameAnimatedBgColor: '#121212', defaultBackgroundColor: '#121212', defaultColorsLoaded: false,
        isInitialShapeSpawn: true, previousColorPaletteForCleanup: [], paletteChangeTimestampForCleanup: 0,
        cleanupTriggeredForCurrentPaletteChange: true,
        dynamicBlurLayers: [], activeRainingCakes: [], lastRainCakeSpawnTime: 0,
        isBirthdayModeActive: (() => { const t = new Date(); return t.getMonth() === 6 && t.getDate() === 5; })(),
        oldMenu: { btn: null, sigs: null, links: null, favicon: null, themeMeta: null },
        shapesData: [], fadingOutShapesData: [], transitionShapesData: [],
        lastTime: performance.now(),
        jiggly: { isHoveringContainer: false, touchedIndex: -1 },
        twoJsCanvas: null
    };

    // --- Constants ---
    const RESOLUTIONS = [
        { width: 16, height: 16, label: "16x16" }, { width: 32, height: 32, label: "32x32" },
        { width: 64, height: 64, label: "64x64" }, { width: 128, height: 128, label: "128x128" },
        { width: 256, height: 256, label: "256x256" }, { width: 512, height: 512, label: "512x512" },
        { width: 1024, height: 1024, label: "1024x1024" }, { width: 2048, height: 2048, label: "2048x2048" }
    ];
    const LASTFM_API_URL = 'https://lastfm-red-surf-3b97.damp-unit-21f3.workers.dev/';
    const LASTFM_POLL_INTERVAL = 15000;
    const MAX_PALETTE_COLORS_TO_REQUEST = 8;
    const COLOR_SIMILARITY_TOLERANCE = 45;
    const BACKGROUND_COLOR_TRANSITION_DURATION = 5000;
    const REINIT_BATCH_DIVISOR = 30;
    const CLEANUP_START_DELAY = 0;
    const SLIDER_MAX_BLUR_INTENSITY = 300;
    const MAX_DESIRED_TOTAL_BLUR_VW = 27.77;
    const MAX_BLUR_PER_LAYER_VW = 14.55;
    const MAX_RAINING_CAKES = 15;
    const RAIN_CAKE_SPAWN_INTERVAL = 300;
    const RAIN_CAKE_MIN_SPEED = 0.08;
    const RAIN_CAKE_MAX_SPEED = 0.24;
    const RAIN_CAKE_WIDTH = 60;
    const RAIN_CAKE_HEIGHT = 80;
    const OLD_MENU_FAVICON_BASE_SRC = './assets/favicon/achtsquare_trans_128.png';
    const BASE_MIN_ROTATION_SPEED = 0.002;
    const BASE_MAX_ROTATION_SPEED = 0.01;
    const BASE_MIN_SPEED = 0.00390625;
    const BASE_MAX_SPEED = 0.01953125;
    const SHAPE_TYPES = ['organic'];
    const BASE_RESOLUTION_WIDTH = 16;
    const FADE_DURATION = 500;
    const MAX_LIGHTNESS = 0.75;
    const TEXT_COLOR_TRANSITION_DURATION = 5000;
    const SPAWN_CONFIGS = [
        { getX: (w, h, o) => -o, getY: (w, h, o) => rand(0, h), getVX: (s) => s, getVY: (s) => rand(-s * 0.3, s * 0.3) },
        { getX: (w, h, o) => rand(0, w), getY: (w, h, o) => -o, getVX: (s) => rand(-s * 0.3, s * 0.3), getVY: (s) => s },
        { getX: (w, h, o) => w + o, getY: (w, h, o) => rand(0, h), getVX: (s) => -s, getVY: (s) => rand(-s * 0.3, s * 0.3) },
        { getX: (w, h, o) => rand(0, w), getY: (w, h, o) => h + o, getVX: (s) => rand(-s * 0.3, s * 0.3), getVY: (s) => -s }
    ];

    // --- Key Elements ---
    const canvasHost = $('canvas-host');
    const blurLayer1 = $('blur-layer-1');
    const rainingCakesContainer = $('raining-cakes-container');

    // --- Init Two.js ---
    const colorThief = new ColorThief();
    const two = new Two({
        type: Two.Types.webgl,
        width: RESOLUTIONS[state.currentResolutionIndex].width,
        height: RESOLUTIONS[state.currentResolutionIndex].height,
        autostart: true
    }).appendTo(canvasHost);
    state.twoJsCanvas = two.renderer.domElement;
    if (state.twoJsCanvas) {
        state.twoJsCanvas.style.width = '100%';
        state.twoJsCanvas.style.height = '100%';
        state.twoJsCanvas.style.imageRendering = 'pixelated';
    } else {
        console.error("Two.js canvas element not found after initialization.");
        state.twoJsCanvas = container.querySelector('canvas');
    }

    // --- Helpers ---
    const rand = (min, max) => Math.random() * (max - min) + min;
    const randInt = (min, max) => ~~(Math.random() * (max - min + 1)) + min;
    const compToHex = c => (~~c).toString(16).padStart(2, '0');
    const rgbToHex = (r, g, b) => `#${compToHex(r)}${compToHex(g)}${compToHex(b)}`;
    const hexToRgb = h => {
        const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h);
        return r ? { r: parseInt(r[1], 16), g: parseInt(r[2], 16), b: parseInt(r[3], 16) } : { r: 24, g: 24, b: 24 };
    };
    const hexToHSL = hex => {
        const { r: r255, g: g255, b: b255 } = hexToRgb(hex);
        let r = r255 / 255, g = g255 / 255, b = b255 / 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;
        if (max === min) h = s = 0;
        else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return { h: h * 360, s: s, l: l }; // l is 0-1
    };
    const hslToHex = (h, s, l) => {
        let r, g, b;
        h /= 360;
        if (s === 0) r = g = b = l;
        else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1; if (t > 1) t -= 1;
                if (t < 1 / 6) return p + (q - p) * 6 * t;
                if (t < 1 / 2) return q;
                if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                return p;
            };
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1 / 3); g = hue2rgb(p, q, h); b = hue2rgb(p, q, h - 1 / 3);
        }
        return rgbToHex(r * 255, g * 255, b * 255);
    };

    // Helper to clamp lightness
    const clampColorLightness = (hexColor) => {
        let hsl = hexToHSL(hexColor);
        if (hsl.l >= MAX_LIGHTNESS + 0.001) { // Check if lightness is 80% or more
            hsl.l = MAX_LIGHTNESS; // Clamp it
            return hslToHex(hsl.h, hsl.s, hsl.l); // Convert back to hex
        }
        return hexColor; // Return original if below threshold
    };

    // Helper to find a saturated color for the new page background
    const getBestPageBackgroundColor = (dominantHex, palette) => {
        const domHsl = hexToHSL(dominantHex);
        if (domHsl.s >= 0.25) return dominantHex; // Dominant is saturated enough

        if (palette && palette.length > 0) {
            // Sort palette by saturation (highest first)
            const sorted = [...palette].map(p => {
                const hsl = hexToHSL(p.color);
                return { hex: p.color, s: hsl.s, hsl: hsl };
            }).sort((a, b) => b.s - a.s);
            if (sorted[0].s >= 0.25) {
                let chosenHsl = sorted[0].hsl;
                chosenHsl.s *= 0.2; // Dull the fallback color so it isn't overly vibrant
                return hslToHex(chosenHsl.h, chosenHsl.s, chosenHsl.l);
            }
        }
        return dominantHex; // Fallback to dominant
    };

    const getLuminance = hex => {
        const { r: r255, g: g255, b: b255 } = hexToRgb(hex);
        let r = r255 / 255, g = g255 / 255, b = b255 / 255;
        r = (r <= 0.04045) ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
        g = (g <= 0.04045) ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
        b = (b <= 0.04045) ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const getContrast = h => getLuminance(h) > 0.22 ? '#202124' : '#E8EAED';
    const getWCAGContrastRatio = (h1, h2) => {
        const l1 = getLuminance(h1), l2 = getLuminance(h2);
        return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    };
    const easeInOutQuad = t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    const areColorsSimilar = (rgb1, rgb2, tol) => {
        if (!rgb1 || !rgb2 || rgb1.length !== 3 || rgb2.length !== 3) return false;
        const rDiff = rgb1[0] - rgb2[0], gDiff = rgb1[1] - rgb2[1], bDiff = rgb1[2] - rgb2[2];
        return Math.sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff) < tol;
    };
    const debounce = (func, delay) => {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    };
    const loadImage = src => new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });

    // --- Core Functions ---

    function findClosestColorIndex(pixelRgb, paletteRgb) {
        let minDistanceSq = Infinity, closestIndex = 0;
        for (let i = 0; i < paletteRgb.length; i++) {
            const p = paletteRgb[i];
            const d = Math.pow(pixelRgb[0] - p[0], 2) + Math.pow(pixelRgb[1] - p[1], 2) + Math.pow(pixelRgb[2] - p[2], 2);
            if (d < minDistanceSq) { minDistanceSq = d; closestIndex = i; }
        }
        return closestIndex;
    }

    function applyMenuTextColorToDom(colorHex) {
        if (!colorHex) return;

        // Apply to Links
        if (state.oldMenu.links) {
            state.oldMenu.links.forEach(el => el.style.color = colorHex);
        }

        // Apply to SVGs (Signatures)
        if (state.oldMenu.sigs) {
            state.oldMenu.sigs.forEach(svg => {
                svg.querySelectorAll('path, circle, rect, polygon, ellipse, line, .cls-1')
                    .forEach(el => el.style.fill = colorHex);
            });
        }

        // Apply to Scroll Indicator
        const scrollIndicatorSvg = document.querySelector('.scroll-indicator-svg');
        if (scrollIndicatorSvg) {
            scrollIndicatorSvg.style.stroke = colorHex;
        }
        const scrollIndicator = document.getElementById('scroll-indicator');
        if (scrollIndicator) {
            scrollIndicator.style.color = colorHex;
        }

        // Apply to Coming Soon text
        const comingSoonText = document.querySelector('.new-white-page h1');
        if (comingSoonText) {
            comingSoonText.style.color = colorHex;
        }
    }

    /**
 * Forcefully resets all buttons to their default state
 */
    const resetAllButtons = () => {
        state.jiggly.isHoveringContainer = false;
        state.jiggly.touchedIndex = -1;
    };

    function wrapTextInWords(btn) {
        const span = btn.querySelector('.button-text');
        if (!span) return [];

        const htmlContent = btn.getAttribute('data-text') || span.innerHTML;
        span.innerHTML = '';

        const wordStates = [];
        const temp = document.createElement('div');
        temp.innerHTML = htmlContent;

        temp.childNodes.forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) {
                const words = node.textContent.split(/\s+/).filter(w => w.length > 0);
                words.forEach((word) => {
                    const wSpan = document.createElement('span');
                    wSpan.textContent = word;
                    wSpan.style.display = 'inline-block';
                    wSpan.style.maxWidth = '100%';
                    wSpan.style.whiteSpace = 'normal';
                    wSpan.style.willChange = 'transform';

                    span.appendChild(wSpan);
                    span.appendChild(document.createTextNode(' '));

                    wordStates.push({ el: wSpan, currentX: null, currentY: null, targetX: 0, targetY: 0 });
                });
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                const wSpan = document.createElement('span');
                wSpan.innerHTML = node.innerHTML;
                wSpan.style.display = 'inline-block';
                wSpan.style.maxWidth = '100%';
                wSpan.style.whiteSpace = 'normal';
                wSpan.style.willChange = 'transform';

                span.appendChild(wSpan);
                span.appendChild(document.createTextNode(' '));

                wordStates.push({ el: wSpan, currentX: null, currentY: null, targetX: 0, targetY: 0 });
            }
        });

        if (span.lastChild && span.lastChild.nodeType === Node.TEXT_NODE && span.lastChild.textContent === ' ') {
            span.removeChild(span.lastChild);
        }

        return wordStates;
    }

    function updateButtonText(btn, newText) {
        let textSpan = btn.querySelector('.button-text');
        if (!textSpan) {
            btn.innerHTML = '<span class="button-text"></span>';
            textSpan = btn.querySelector('.button-text');
        }
        let currentText = btn.getAttribute('data-text') || textSpan.innerHTML;
        if (currentText === newText) return;
        textSpan.innerHTML = newText;
        btn.setAttribute('data-text', newText);
        if (state.jiggly && state.jiggly.buttonStates) {
            const bState = state.jiggly.buttonStates.find(b => b.el === btn);
            if (bState) {
                bState.wordStates = wrapTextInWords(btn);
                bState.lastRoundedWeight = -1; // Force re-measure next frame
                bState.needsMeasurement = true;
                bState.needsWordMeasurement = true;
            }
        }
    }

    function normalizeAndCapWeights(palette, cap = 50, boost = 5) {
        let p = JSON.parse(JSON.stringify(palette));
        const accent = p.find(c => c.isAccent);
        if (accent && accent.weight < boost) accent.weight = boost;

        let totalWeight = p.reduce((sum, c) => sum + c.weight, 0);
        if (totalWeight > 0) p.forEach(c => c.weight = (c.weight / totalWeight) * 100);

        p.sort((a, b) => b.weight - a.weight);

        if (p.length > 1 && p[0].weight > cap) {
            const excess = p[0].weight - cap;
            p[0].weight = cap;
            let subTotalWeight = 0;
            for (let i = 1; i < p.length; i++) subTotalWeight += p[i].weight;
            if (subTotalWeight > 0) {
                for (let i = 1; i < p.length; i++) {
                    p[i].weight += excess * (p[i].weight / subTotalWeight);
                }
            }
        }
        return p;
    }

    function rebalanceAndApplyPalette() {
        if (state.rawUnbalancedPalette.length === 0) return;
        let filtered = state.rawUnbalancedPalette.filter(c => c.weight >= state.currentMinThreshold);
        if (filtered.length === 0 && state.rawUnbalancedPalette.length > 0) {
            filtered = [[...state.rawUnbalancedPalette].sort((a, b) => b.weight - a.weight)[0]];
        }
        // Apply lightness clamp to the filtered palette *before* balancing weights
        const clampedFilteredPalette = filtered.map(item => ({
            ...item,
            color: clampColorLightness(item.color)
        }));
        state.colorPalette = normalizeAndCapWeights(clampedFilteredPalette, state.currentDominanceCap, state.currentAccentBoost);
    }


    function lightenDarkenColor(hex, percent) {
        let { r, g, b } = hexToRgb(hex);
        const amount = ~~(255 * (percent / 100));
        r = Math.max(0, Math.min(255, r + amount));
        g = Math.max(0, Math.min(255, g + amount));
        b = Math.max(0, Math.min(255, b + amount));
        return rgbToHex(r, g, b);
    }

    function updateDynamicM3ThemeColors(bgColor, palette) {
        const root = document.documentElement.style;
        if (!bgColor || !palette) return;

        // Apply clamp to background color before calculating M3 theme
        const clampedBgColor = clampColorLightness(bgColor);

        const MIN_SATURATION = 0.15, MIN_CONTRAST = 3.0, MIN_LUMINANCE = 0.25;
        const bgHsl = hexToHSL(clampedBgColor), isGray = bgHsl.s < 0.05;

        let surfaceHsl = { ...bgHsl };
        surfaceHsl.l = 0.12;
        surfaceHsl.s = isGray ? 0 : Math.min(Math.max(bgHsl.s * 0.35, 0.10), 0.23);
        const surface = hslToHex(surfaceHsl.h, surfaceHsl.s, surfaceHsl.l);

        let surfaceHighHsl = { ...surfaceHsl, l: Math.min(0.95, surfaceHsl.l + 0.06) };
        const surfaceContainerHigh = hslToHex(surfaceHighHsl.h, surfaceHighHsl.s, surfaceHighHsl.l);

        const onSurface = '#E8EAED', onSurfaceVariant = '#CAC4D0';
        let outlineHsl = { ...surfaceHsl, l: Math.min(0.95, surfaceHsl.l + 0.08) };
        const outline = hslToHex(outlineHsl.h, outlineHsl.s, outlineHsl.l);

        let primaryAccent = null;
        // Use the already clamped palette for M3 calculations
        if (palette.length > 0) {
            const potentials = palette // palette colors are already clamped
                .map(item => ({ hex: item.color, contrast: getWCAGContrastRatio(item.color, surface), hsl: hexToHSL(item.color) }))
                .filter(p => {
                    const ok = p.contrast >= MIN_CONTRAST && p.hsl.l >= 0.50;
                    return ok && (isGray ? true : p.hsl.s >= MIN_SATURATION);
                })
                .sort((a, b) => isGray ? b.contrast - a.contrast : b.hsl.s - a.hsl.s || b.contrast - a.contrast);

            if (potentials.length > 0) {
                let cHsl = potentials[0].hsl;
                if (isGray) cHsl.s = 0;
                // Clamp the selected primary accent lightness again (safety check)
                cHsl.l = Math.min(cHsl.l, MAX_LIGHTNESS);
                primaryAccent = hslToHex(cHsl.h, cHsl.s, cHsl.l);
            }
        }

        if (!primaryAccent) {
            let paHsl = hexToHSL(clampedBgColor); // Derive from clamped background
            if (isGray) paHsl.s = 0;
            else { paHsl.h = (paHsl.h + 40) % 360; paHsl.s = Math.min(1, Math.max(0.45, paHsl.s + 0.1)); }
            paHsl.l = 0.70; // Target lightness
            // Clamp the derived accent
            paHsl.l = Math.min(paHsl.l, MAX_LIGHTNESS);
            primaryAccent = hslToHex(paHsl.h, paHsl.s, paHsl.l);

            if (getWCAGContrastRatio(primaryAccent, surface) < MIN_CONTRAST) {
                paHsl.l = 0.75;
                paHsl.l = Math.min(paHsl.l, MAX_LIGHTNESS); // Clamp again
                primaryAccent = hslToHex(paHsl.h, paHsl.s, paHsl.l);
                if (getWCAGContrastRatio(primaryAccent, surface) < MIN_CONTRAST) {
                    primaryAccent = isGray ? clampColorLightness('#D3D3D3') : clampColorLightness('#89b3ff'); // Clamp fallbacks too
                }
            }
        }

        // Ensure final primary accent meets min luminance, but also respect max lightness clamp
        let lum = getLuminance(primaryAccent);
        let currentHsl = hexToHSL(primaryAccent);
        if (lum < MIN_LUMINANCE && currentHsl.l < MAX_LIGHTNESS) { // Only increase if below max
            if (currentHsl.l < 1.0) { // Check if not already max HSL lightness (1.0)
                for (let i = 0; i < 20; i++) {
                    currentHsl.l += 0.05;
                    currentHsl.l = Math.min(currentHsl.l, MAX_LIGHTNESS); // Apply clamp during increase
                    if (currentHsl.l > 1.0) currentHsl.l = 1.0; // Ensure HSL doesn't exceed 1.0

                    primaryAccent = hslToHex(currentHsl.h, currentHsl.s, currentHsl.l);
                    lum = getLuminance(primaryAccent);
                    // Break if target met OR clamp reached OR HSL max reached
                    if (lum >= MIN_LUMINANCE || currentHsl.l >= MAX_LIGHTNESS || currentHsl.l >= 1.0) break;
                }
            }
        } else if (currentHsl.l >= MAX_LIGHTNESS + 0.001) { // If it somehow still exceeds, clamp it finally
            primaryAccent = clampColorLightness(primaryAccent);
        }

        const onPrimary = getContrast(primaryAccent);

        let secondaryContainer = null;
        if (palette.length > 0) {
            const p2 = palette // palette colors are already clamped
                .filter(item => item.color.toUpperCase() !== primaryAccent.toUpperCase())
                .map(item => ({ hex: item.color, hsl: hexToHSL(item.color) }))
                .sort((a, b) => isGray ? 0 : b.hsl.s - a.hsl.s);
            if (p2.length > 0) {
                let sHsl = p2[0].hsl;
                sHsl.s = isGray ? 0 : Math.min(sHsl.s, 0.4);
                // Clamp secondary container lightness
                sHsl.l = Math.min(sHsl.l, MAX_LIGHTNESS);
                secondaryContainer = hslToHex(sHsl.h, sHsl.s, sHsl.l);
            }
        }

        if (!secondaryContainer) {
            secondaryContainer = lightenDarkenColor(surface, getLuminance(surface) > 0.5 ? -10 : 12);
            if (areColorsSimilar(hexToRgb(secondaryContainer), hexToRgb(primaryAccent), 25)) {
                secondaryContainer = lightenDarkenColor(surface, 18);
            }
            // Clamp derived secondary container
            secondaryContainer = clampColorLightness(secondaryContainer);
        }
        const onSecondaryContainer = getContrast(secondaryContainer);


        root.setProperty('--m3-primary', primaryAccent);
        root.setProperty('--m3-on-primary', onPrimary);
        root.setProperty('--m3-secondary-container', secondaryContainer);
        root.setProperty('--m3-on-secondary-container', onSecondaryContainer);
        root.setProperty('--m3-surface', surface);
        root.setProperty('--m3-surface-container-high', surfaceContainerHigh);
        root.setProperty('--m3-on-surface', onSurface);
        root.setProperty('--m3-on-surface-variant', onSurfaceVariant);
        root.setProperty('--m3-outline', outline);
    }

    function getRandomColorFromPaletteWeighted(palette, fallback = { color: '#CCCCCC', weight: 1 }) {
        if (!palette || palette.length === 0) return fallback;
        const totalWeight = palette.reduce((sum, item) => sum + item.weight, 0);
        if (totalWeight === 0) return palette[randInt(0, palette.length - 1)];
        let r = Math.random() * totalWeight;
        for (const item of palette) {
            if (r < item.weight) return item;
            r -= item.weight;
        }
        return palette[palette.length - 1];
    }
    const getRandomColorFromPaletteUnweighted = (p, f = '#CCCCCC') => (!p || p.length === 0) ? f : p[randInt(0, p.length - 1)].color;

    function createSmallCakeElement() {
        const cake = document.createElement('div');
        cake.className = 'small-cake';
        const base = document.createElement('div');
        base.className = 'small-cake-layer small-cake-base';
        const frosting = document.createElement('div');
        frosting.className = 'small-cake-layer small-cake-frosting';
        const cherries = document.createElement('div');
        cherries.className = 'small-cake-layer small-cake-cherries';

        // Cakes use unweighted random colors, which are already clamped when the palette is set
        base.style.backgroundColor = getRandomColorFromPaletteUnweighted(state.colorPalette, '#424242');
        const fColor = getRandomColorFromPaletteUnweighted(state.colorPalette, '#F5F5F5');
        frosting.style.backgroundColor = fColor;

        let cColor;
        if (state.colorPalette && state.colorPalette.length > 1) {
            const available = state.colorPalette.filter(item => item.color.toUpperCase() !== fColor.toUpperCase());
            cColor = (available.length > 0) ? available[randInt(0, available.length - 1)].color : fColor;
        } else if (state.colorPalette && state.colorPalette.length === 1) {
            cColor = state.colorPalette[0].color;
        } else {
            cColor = '#C62828';
        }
        cherries.style.backgroundColor = cColor; // This color is also from the clamped palette

        cake.append(base, frosting, cherries);
        return { mainElement: cake };
    }


    function spawnSmallCake() {
        if (!state.isBirthdayModeActive || !rainingCakesContainer || state.activeRainingCakes.length >= MAX_RAINING_CAKES) return;
        const cakeElements = createSmallCakeElement();
        const cakeDiv = cakeElements.mainElement;
        cakeDiv.style.top = `-${RAIN_CAKE_HEIGHT}px`;
        cakeDiv.style.left = `${Math.random() * (window.innerWidth - RAIN_CAKE_WIDTH)}px`;
        const cakeData = {
            element: cakeDiv,
            y: -RAIN_CAKE_HEIGHT,
            speed: rand(RAIN_CAKE_MIN_SPEED, RAIN_CAKE_MAX_SPEED),
            rotation: Math.random() * 360,
            rotationSpeed: (Math.random() - 0.5) * 0.2
        };
        rainingCakesContainer.appendChild(cakeDiv);
        state.activeRainingCakes.push(cakeData);
    }

    function removeAllRainingCakes() {
        state.activeRainingCakes.forEach(cakeData => {
            if (cakeData.element.parentNode === rainingCakesContainer) {
                rainingCakesContainer.removeChild(cakeData.element);
            }
        });
        state.activeRainingCakes = [];
    }

    function applyBlurEffect(bgColorToApply) {
        if (!state.twoJsCanvas || !canvasHost || !blurLayer1) return;

        state.dynamicBlurLayers.forEach(layer => layer.remove());
        state.dynamicBlurLayers = [];

        Object.assign(blurLayer1.style, {
            filter: 'none', backgroundColor: 'transparent', position: 'absolute',
            width: '100%', height: '100%', top: '0', left: '0', willChange: 'auto'
        });
        if (canvasHost.parentElement !== blurLayer1) blurLayer1.appendChild(canvasHost);

        Object.assign(canvasHost.style, {
            filter: 'none', backgroundColor: 'transparent', position: 'absolute',
            width: '100%', height: '100%', top: '0', left: '0', willChange: 'auto'
        });

        state.twoJsCanvas.style.backgroundColor = 'transparent';
        state.twoJsCanvas.style.filter = 'none';

        if (state.prevBlurToggleState && state.currentBlurIntensity > 0) {
            const vmin = Math.min(window.innerWidth, window.innerHeight);
            const totalBlurPx = (state.currentBlurIntensity / SLIDER_MAX_BLUR_INTENSITY) * MAX_DESIRED_TOTAL_BLUR_VW * vmin / 100;
            const maxBlurPerLayerPx = MAX_BLUR_PER_LAYER_VW * vmin / 100;
            const bleedPx = Math.ceil(totalBlurPx * 2);

            Object.assign(blurLayer1.style, {
                width: `calc(100% + ${bleedPx * 2}px)`, height: `calc(100% + ${bleedPx * 2}px)`,
                top: `-${bleedPx}px`, left: `-${bleedPx}px`
            });

            let remainingBlur = totalBlurPx;
            let currentParent = blurLayer1;

            while (remainingBlur > maxBlurPerLayerPx && maxBlurPerLayerPx > 0) {
                const layer = document.createElement('div');
                Object.assign(layer.style, {
                    position: 'absolute', width: '100%', height: '100%', top: '0', left: '0',
                    backgroundColor: 'transparent', filter: `blur(${maxBlurPerLayerPx}px)`, willChange: 'filter'
                });
                currentParent.appendChild(layer);
                state.dynamicBlurLayers.push(layer);
                currentParent = layer;
                remainingBlur -= maxBlurPerLayerPx;
            }

            canvasHost.style.backgroundColor = bgColorToApply;
            if (remainingBlur > 0) {
                canvasHost.style.filter = `blur(${remainingBlur}px)`;
                canvasHost.style.willChange = 'filter';
            }
            if (canvasHost.parentElement !== currentParent) currentParent.appendChild(canvasHost);
        } else {
            canvasHost.style.backgroundColor = bgColorToApply;
        }
    }

    function applyPostProcessingFilters() {
        if (!container) return;
        let filters = [];
        if (state.currentBrightness !== 100) filters.push(`brightness(${state.currentBrightness}%)`);
        if (state.currentContrast !== 100) filters.push(`contrast(${state.currentContrast}%)`);
        if (state.currentSaturation !== 100) filters.push(`saturate(${state.currentSaturation}%)`);
        if (state.currentHueRotate !== 0) filters.push(`hue-rotate(${state.currentHueRotate}deg)`);

        if (window.matchMedia('(prefers-color-scheme: light)').matches) {
            // Post processing to instantly turn the dark layout into light mode while perfectly retaining original hues
            filters.push('invert(1)', 'hue-rotate(180deg)', 'saturate(200%)');
        }

        const filterStr = filters.length > 0 ? filters.join(' ') : 'none';
        container.style.filter = filterStr;
        if (rainingCakesContainer) {
            rainingCakesContainer.style.filter = filterStr;
        }
    }

    function scheduleOldColorCleanup() {
        state.previousColorPaletteForCleanup = (state.colorPalette.length === 0) ?
            ['#CCCCCC'] :
            state.colorPalette.map(item => item.color.toUpperCase());
        state.paletteChangeTimestampForCleanup = performance.now();
        state.cleanupTriggeredForCurrentPaletteChange = false;
    }

    function initializeShape(shapeData, isTransition = false) {
        if (shapeData.twoShape && shapeData.twoShape.parent) two.remove(shapeData.twoShape);
        shapeData.twoShape = null;
        shapeData.needsReinitialization = false;
        if (!isTransition) {
            shapeData.isMarkedForCleanupScaling = false;
            shapeData.cleanupScaleStartTime = 0;
        }

        const shapeType = SHAPE_TYPES[randInt(0, SHAPE_TYPES.length - 1)];
        const minScreenDim = Math.min(two.width, two.height) || 600;

        const baseSizeFactorMin = isTransition ? 0.375 : 0.25;
        const baseSizeFactorMax = isTransition ? 0.825 : 0.55;
        const speedFactor = isTransition ? 2.4 : 1.0;
        const rotSpeedFactor = isTransition ? 1.5 : 1.0;
        const minSize = isTransition ? 5 : 10;

        const baseSize = rand(minScreenDim * baseSizeFactorMin, minScreenDim * baseSizeFactorMax) * state.currentScaleMultiplier;
        const chosenColorItem = getRandomColorFromPaletteWeighted(state.colorPalette, { color: '#CCCCCC', weight: 1 });

        let newTwoShape, approxWidth, approxHeight;
        switch (shapeType) {
            case 'organic':
                const numVertices = randInt(isTransition ? 4 : 5, isTransition ? 8 : 10);
                const anchors = [];
                const avgRadius = baseSize / 2;
                for (let i = 0; i < numVertices; i++) {
                    const baseAngle = (i / numVertices) * Math.PI * 2;
                    const angleOffset = (Math.PI * 2 / numVertices) * rand(-0.4, 0.4);
                    const radius = avgRadius * rand(0.5, 1.5);
                    anchors.push(new Two.Anchor(Math.cos(baseAngle + angleOffset) * radius, Math.sin(baseAngle + angleOffset) * radius));
                }
                newTwoShape = new Two.Path(anchors, true, true, false);
                approxWidth = approxHeight = baseSize;
                break;
            default:
                approxWidth = Math.max(minSize, baseSize);
                approxHeight = Math.max(minSize, baseSize * rand(0.7, 1.3));
                newTwoShape = two.makeRoundedRectangle(0, 0, approxWidth, approxHeight, Math.min(approxWidth, approxHeight) * 0.35);
                break;
        }

        let targetOpacity = 1.0;
        const itemWeight = chosenColorItem.weight;
        if (state.colorPalette.length > 0 && itemWeight > 0) {
            const totalWeight = state.colorPalette.reduce((sum, p) => sum + p.weight, 0);
            if (totalWeight > 0) {
                const perc = (itemWeight / totalWeight) * 100;
                if (perc < 15) targetOpacity = rand(Math.random() < 0.6 ? 0.5 : 0.8, Math.random() < 0.6 ? 0.75 : 1.0);
                else if (perc < 60 && Math.random() < 0.25) targetOpacity = rand(0.75, 0.95);
            }
        }

        newTwoShape.fill = chosenColorItem.color;
        newTwoShape.opacity = isTransition ? 0 : targetOpacity;
        newTwoShape.noStroke();
        newTwoShape.rotation = rand(0, Math.PI * 2);

        shapeData.twoShape = newTwoShape;
        shapeData.rotationSpeed = rand(BASE_MIN_ROTATION_SPEED, BASE_MAX_ROTATION_SPEED) * state.currentRotationSpeedMultiplier * rotSpeedFactor * (Math.random() > 0.5 ? 1 : -1);
        shapeData.approxWidth = approxWidth;
        shapeData.approxHeight = approxHeight;

        const baseSpeedValue = rand(BASE_MIN_SPEED, BASE_MAX_SPEED);
        const resolutionSpeedFactor = (RESOLUTIONS[state.currentResolutionIndex].width / BASE_RESOLUTION_WIDTH);
        const speed = baseSpeedValue * resolutionSpeedFactor * state.currentMovementSpeedMultiplier * speedFactor;

        // --- PLACEMENT LOGIC ---
        if (state.isInitialShapeSpawn && !isTransition) {
            const x = rand(0, two.width);
            const y = rand(0, two.height);
            newTwoShape.translation.set(x, y);

            const vAngle = Math.random() * Math.PI * 2;
            shapeData.vx = Math.cos(vAngle) * speed;
            shapeData.vy = Math.sin(vAngle) * speed;
        } else {
            const offset = Math.max(approxWidth, approxHeight) * 0.7;
            const spawnConfig = SPAWN_CONFIGS[randInt(0, SPAWN_CONFIGS.length - 1)];
            newTwoShape.translation.set(spawnConfig.getX(two.width, two.height, offset), spawnConfig.getY(two.width, two.height, offset));
            shapeData.vx = spawnConfig.getVX(speed);
            shapeData.vy = spawnConfig.getVY(speed);
        }

        if (isTransition) {
            shapeData.spawnTime = performance.now();
            shapeData.isFadingIn = true;
            shapeData.targetOpacity = targetOpacity;
        }

        // --- CURVING PROPERTIES (Modified) ---
        // 50% chance to curve
        if (Math.random() < 0.5) {
            shapeData.curveFreq = rand(0.0003, 0.001);
            shapeData.curveAmp = rand(0.5, 2.5) * (baseSpeedValue * 100);
        } else {
            // No curve = Amplitude 0
            shapeData.curveFreq = 0;
            shapeData.curveAmp = 0;
        }
        shapeData.curveOffset = rand(0, Math.PI * 2);

        if (!newTwoShape.parent) two.add(newTwoShape);
    }

    function adjustShapesArray() {
        while (state.shapesData.length > state.currentNumShapes) {
            const sd = state.shapesData.pop();
            if (sd.twoShape && sd.twoShape.parent) two.remove(sd.twoShape);
        }
        while (state.shapesData.length < state.currentNumShapes) {
            const shapeData = { needsReinitialization: false };
            state.shapesData.push(shapeData);
            initializeShape(shapeData, false);
        }
    }

    function spawnTransitionShapes() {
        if (state.currentNumShapes <= 0) return;
        while (state.transitionShapesData.length > 0) {
            const sd = state.transitionShapesData.pop();
            if (sd.twoShape && sd.twoShape.parent) two.remove(sd.twoShape);
        }
        for (let i = 0; i < state.currentNumTransitionShapes; i++) {
            const shapeData = {};
            initializeShape(shapeData, true);
            state.transitionShapesData.push(shapeData);
        }
    }

    function updateOldMenuElementsStyle(instant = false) {
        // 1. Find the Best Source Color
        // Default to background
        let sourceColorHex = state.targetBackgroundColor || '#121212';

        if (state.colorPalette && state.colorPalette.length > 0) {
            // PRIORITY 1: Look for the specific "Accent" color flagged by our extraction logic
            const accent = state.colorPalette.find(c => c.isAccent);
            if (accent) {
                sourceColorHex = accent.color;
            } else {
                // PRIORITY 2: Fallback to the most saturated color in the palette
                const sorted = state.colorPalette.map(p => ({
                    hex: p.color,
                    hsl: hexToHSL(p.color)
                })).sort((a, b) => b.hsl.s - a.hsl.s);
                sourceColorHex = sorted[0].hex;
            }
        }

        // 2. FORCE MAXIMUM VIBRANCY
        const hsl = hexToHSL(sourceColorHex);

        // Strict threshold: If it has even a tiny bit of color (s > 0.05), we explode it.
        const isBasicallyGray = hsl.s < 0.05;

        // SETTINGS FOR VIBRANCY:
        // Saturation: 1.0 (100%) - Pure Color
        // Lightness: Adapts based on light/dark mode
        const isLightMode = window.matchMedia('(prefers-color-scheme: light)').matches;
        const targetSat = isBasicallyGray ? 0 : 1.0;
        const targetLight = isLightMode ? 0.10 : 0.80;

        const calculatedTargetHex = hslToHex(hsl.h, targetSat, targetLight);

        // 3. First Load Logic / Synchronization
        // We bypass the transition if it's the very first update OR if the scene 
        // hasn't finished its initial setup yet (prevents fading from gray to color on load).
        if (state.isFirstTextUpdate || !state.initialSceneSetupPerformed) {
            state.currentTextColor = calculatedTargetHex;
            state.targetTextColor = calculatedTargetHex;
            state.previousTextColorForTransition = calculatedTargetHex;
            applyMenuTextColorToDom(calculatedTargetHex);

            // Only mark the first update as "complete" if the scene is actually ready.
            // This ensures the first REAL album art color snaps instantly.
            if (state.initialSceneSetupPerformed) {
                state.isFirstTextUpdate = false;
            }
            return;
        }

        // 4. Transition Logic
        if (instant) {
            state.currentTextColor = calculatedTargetHex;
            state.targetTextColor = calculatedTargetHex;
            state.previousTextColorForTransition = calculatedTargetHex;
            applyMenuTextColorToDom(calculatedTargetHex);
            state.isTextColorTransitioning = false;
        } else if (calculatedTargetHex.toUpperCase() !== state.targetTextColor.toUpperCase()) {
            state.previousTextColorForTransition = state.currentTextColor;
            state.targetTextColor = calculatedTargetHex;
            state.textColorTransitionStartTime = performance.now();
            state.isTextColorTransitioning = true;
        }
    }

    function updateOldMenuThemeMetaTag() {
        if (state.oldMenu.themeMeta) {
            let color = state.currentAnimatedBackgroundColor ? clampColorLightness(state.currentAnimatedBackgroundColor) : '#000000';

            const isLightMode = window.matchMedia('(prefers-color-scheme: light)').matches;
            let hsl = hexToHSL(color);

            // Always use the new page background color for the tab bar
            const targetLightness = isLightMode ? 0.90 : 0.20; // Matches --page-bg-l in CSS
            const targetS = Math.min(1, hsl.s * 2.0);
            const targetColorHex = hslToHex(hsl.h, targetS, targetLightness);

            state.oldMenu.themeMeta.content = targetColorHex;
        }
    }


    function updateOldMenuFavicon(coverArtUrl, isPlaying) {
        if (!state.oldMenu.favicon) return;
        const canvas = document.createElement('canvas');
        canvas.width = 128; canvas.height = 128;
        const ctx = canvas.getContext('2d');
        const baseImg = new Image();
        baseImg.crossOrigin = "Anonymous";
        baseImg.src = OLD_MENU_FAVICON_BASE_SRC;
        baseImg.onload = () => {
            if (isPlaying && coverArtUrl) {
                const artImg = new Image();
                artImg.crossOrigin = "Anonymous";
                artImg.src = coverArtUrl;
                artImg.onload = () => {
                    ctx.filter = 'blur(4px) brightness(0.7)';
                    ctx.drawImage(artImg, 0, 0, 128, 128);
                    ctx.filter = 'none';
                    ctx.drawImage(baseImg, 0, 0, 128, 128);
                    state.oldMenu.favicon.href = canvas.toDataURL('image/png');
                };
                artImg.onerror = () => {
                    ctx.drawImage(baseImg, 0, 0, 128, 128);
                    state.oldMenu.favicon.href = canvas.toDataURL('image/png');
                };
            } else {
                ctx.drawImage(baseImg, 0, 0, 128, 128);
                state.oldMenu.favicon.href = canvas.toDataURL('image/png');
            }
        };
        baseImg.onerror = () => console.error("Failed to load base favicon");
    }

    async function handleOldMenuLastFmUpdate(data) {
        if (!state.oldMenu.btn) initializeOldMenuSelectors();
        const isPlaying = data?.recenttracks?.track?.[0]?.["@attr"]?.nowplaying === "true";
        const user = data?.recenttracks?.["@attr"]?.user;
        let artUrl = null;

        updateOldMenuElementsStyle();
        updateOldMenuThemeMetaTag();

        if (isPlaying) {
            const track = data.recenttracks.track[0];
            const trackName = track.name?.replace(/\s*\(.*?\)\s*/g, ' ') || 'Unknown Track';
            const artistName = track.artist?.["#text"]?.replace(/\s*\(.*?\)\s*/g, ' ') || 'Unknown Artist';

            // This is the direct Last.fm URL
            const lastFmTrackUrl = track.url || (user ? `https://www.last.fm/user/${user}` : "#");

            const imgInfo = track.image?.find(img => img.size === 'extralarge' || img.size === 'large');
            if (imgInfo?.["#text"] && !imgInfo["#text"].includes("2a96cbd8b46e442fc41c2b86b821562f")) {
                artUrl = imgInfo["#text"];
            }

            const escapeHTML = str => str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
            const safeTrackName = escapeHTML(trackName.trim());
            const safeArtistName = escapeHTML(artistName.trim());

            if (state.oldMenu.btn) {
                updateButtonText(state.oldMenu.btn, `listening to <span>${safeTrackName}</span> by <span>${safeArtistName}</span>`);
                state.oldMenu.btn.href = lastFmTrackUrl;
            }

        } else {
            if (state.oldMenu.btn) {
                updateButtonText(state.oldMenu.btn, "last.fm");
                state.oldMenu.btn.href = user ? `https://www.last.fm/user/${user}` : "#";
            }
        }

        // Update favicon regardless of playing state
        updateOldMenuFavicon(artUrl, isPlaying);
    }


    async function updateLastFmUI(data) {
        let useDefault = false;
        const track = data?.recenttracks?.track?.[0];

        if (track && track['@attr']?.nowplaying === 'true') {
            const imgUrl = track.image?.find(img => img.size === 'extralarge')['#text'] || track.image?.find(img => img.size === 'large')['#text'] || '';

            if (imgUrl) {
                if (imgUrl !== state.currentAlbumArtUrl) {
                    state.currentAlbumArtUrl = imgUrl;
                    extractAndApplyColorsFromAlbumArt(imgUrl); // This will handle clamping internally
                }
            } else {
                useDefault = true;
                state.lastFmColorsExtractedSuccessfully = false;
                state.currentAlbumArtUrl = '';
            }
        } else { // Not playing or no data
            useDefault = true;
            state.lastFmColorsExtractedSuccessfully = false;
            state.currentAlbumArtUrl = '';
        }

        if (useDefault) {
            applyDefaultColors(); // This will handle clamping internally
            state.lastFmColorsExtractedSuccessfully = false;
            performInitialSceneSetupIfNeeded();
        }
        await handleOldMenuLastFmUpdate(data);
    }


    async function fetchLastFmData(isManual = false) {
        try {
            const res = await fetch(LASTFM_API_URL);
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            const data = await res.json();
            await updateLastFmUI(data);
        } catch (error) {
            console.error('Error fetching Last.fm data:', error);
            handleOldMenuLastFmUpdate(null); // This is not async, fine
            applyDefaultColors();
        } finally {
            state.firstLastFmFetchAttempted = true;
            performInitialSceneSetupIfNeeded();
        }
        if (isManual) resetLastFmInterval();
    }

    function resetLastFmInterval() {
        if (state.lastfmPollIntervalId) clearInterval(state.lastfmPollIntervalId);
        state.lastfmPollIntervalId = setInterval(fetchLastFmData, LASTFM_POLL_INTERVAL);
    }

    function applyDefaultColors() {
        scheduleOldColorCleanup();
        state.previousBackgroundColorForTransition = state.currentAnimatedBackgroundColor;
        state.targetBackgroundColor = clampColorLightness(state.defaultBackgroundColor);

        state.colorPalette = state.defaultColorPalette.length > 0 ?
            state.defaultColorPalette.map(item => ({ ...item, color: clampColorLightness(item.color) })) :
            [];

        state.previousPageBackgroundColorForTransition = state.currentPageBackgroundColor;
        state.targetPageBackgroundColor = getBestPageBackgroundColor(state.targetBackgroundColor, state.colorPalette);

        if (!state.initialSceneSetupPerformed) {
            state.currentAnimatedBackgroundColor = state.targetBackgroundColor;
            state.currentPageBackgroundColor = state.targetPageBackgroundColor;
            state.isBackgroundTransitioning = false;
        } else {
            state.backgroundColorTransitionStartTime = performance.now();
            state.isBackgroundTransitioning = true;
        }

        state.colorPalette = state.defaultColorPalette.length > 0 ?
            state.defaultColorPalette.map(item => ({ ...item, color: clampColorLightness(item.color) })) :
            [];

        updateDynamicM3ThemeColors(state.targetBackgroundColor, state.colorPalette);

        updateOldMenuElementsStyle();
    }


    const arePalettesRoughlyEqual = (a, b) => {
        if (!a || !b || a.length !== b.length) return false;
        if (a.length === 0 && b.length === 0) return true;
        for (let i = 0; i < a.length; i++) {
            // Compare clamped versions if needed, or assume palettes being compared are already clamped
            if (a[i].color !== b[i].color || a[i].weight !== b[i].weight) return false;
        }
        return true;
    };


    function performInitialSceneSetupIfNeeded() {
        if (state.initialSceneSetupPerformed) return;
        let ready = false, setupType = "";

        if (state.lastFmColorsExtractedSuccessfully) {
            ready = true;
            setupType = "lastfm";
            state.targetBackgroundColor = clampColorLightness(state.targetBackgroundColor);
            state.colorPalette = state.colorPalette.map(item => ({ ...item, color: clampColorLightness(item.color) }));
        } else if (state.firstLastFmFetchAttempted) {
            if (state.lastFmArtProcessing) return; // Still processing art, keep waiting
            if (state.defaultColorsLoaded) {
                ready = true;
                setupType = "default";
                if (state.targetBackgroundColor !== clampColorLightness(state.defaultBackgroundColor) || !arePalettesRoughlyEqual(state.colorPalette, state.defaultColorPalette.map(item => ({ ...item, color: clampColorLightness(item.color) })))) {
                    applyDefaultColors();
                }
            }
        }

        if (ready) {
            console.log(`Performing initial scene setup with ${setupType} colors.`);
            updateDynamicM3ThemeColors(state.targetBackgroundColor, state.colorPalette);
            adjustShapesArray();
            state.initialSceneSetupPerformed = true;
            state.isInitialShapeSpawn = false;

            // --- HIDE LOADER ---
            // This triggers only once the colors are selected and applied to the scene
            const loader = document.getElementById('site-loader');
            if (loader) {
                // We add a tiny delay so the transition to the new colors is smooth
                setTimeout(() => {
                    loader.classList.add('loader-finished');
                }, 500);
            }
        }
    }


    async function extractAndApplyColorsFromAlbumArt(imageUrl) {
        if (!imageUrl) return;
        state.lastFmArtProcessing = true;
        try {
            const img = await loadImage(imageUrl);
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const MAX_SIZE = 150;
            let w = img.width, h = img.height;
            if (w > h) { if (w > MAX_SIZE) { h = ~~(h * (MAX_SIZE / w)); w = MAX_SIZE; } }
            else { if (h > MAX_SIZE) { w = ~~(w * (MAX_SIZE / h)); h = MAX_SIZE; } }
            canvas.width = w; canvas.height = h;
            ctx.drawImage(img, 0, 0, w, h);

            const dominantRgb = colorThief.getColor(img);
            let paletteRgb = colorThief.getPalette(img, MAX_PALETTE_COLORS_TO_REQUEST - 1);
            let accentRgb = null;
            const pixelData = ctx.getImageData(0, 0, w, h).data;
            const vibrantCounts = new Map();

            for (let i = 0; i < pixelData.length; i += 4) {
                const r = pixelData[i], g = pixelData[i + 1], b = pixelData[i + 2];
                const hsl = hexToHSL(rgbToHex(r, g, b));
                if (hsl.s > 0.6 && hsl.l > 0.15 && hsl.l < 0.85) {
                    const hex = rgbToHex(r, g, b);
                    vibrantCounts.set(hex, (vibrantCounts.get(hex) || 0) + 1);
                }
            }
            if (vibrantCounts.size > 0) {
                const mostVibrantHex = [...vibrantCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
                const rgb = hexToRgb(mostVibrantHex);
                accentRgb = [rgb.r, rgb.g, rgb.b];
                if (!paletteRgb.some(c => areColorsSimilar(c, accentRgb, 60))) {
                    paletteRgb.push(accentRgb);
                }
            }
            if (!paletteRgb || paletteRgb.length === 0) throw new Error('ColorThief could not generate a palette.');

            const counts = new Array(paletteRgb.length).fill(0);
            for (let i = 0; i < pixelData.length; i += 4) {
                counts[findClosestColorIndex([pixelData[i], pixelData[i + 1], pixelData[i + 2]], paletteRgb)]++;
            }

            // Set raw palette (still unclamped here)
            state.rawUnbalancedPalette = paletteRgb.map((rgb, i) => ({
                color: rgbToHex(rgb[0], rgb[1], rgb[2]).toUpperCase(),
                weight: (counts[i] / (w * h)) * 100,
                isAccent: accentRgb && rgb.every((v, j) => v === accentRgb[j])
            }));

            // Rebalance will now apply clamping internally before setting state.colorPalette
            rebalanceAndApplyPalette();

            state.previousBackgroundColorForTransition = state.currentAnimatedBackgroundColor;
            // Clamp the dominant background color
            state.targetBackgroundColor = clampColorLightness(rgbToHex(dominantRgb[0], dominantRgb[1], dominantRgb[2]).toUpperCase());

            state.previousPageBackgroundColorForTransition = state.currentPageBackgroundColor;
            state.targetPageBackgroundColor = getBestPageBackgroundColor(state.targetBackgroundColor, state.colorPalette);

            if (!state.initialSceneSetupPerformed) {
                state.currentAnimatedBackgroundColor = state.targetBackgroundColor;
                state.currentPageBackgroundColor = state.targetPageBackgroundColor;
                state.isBackgroundTransitioning = false;
            } else {
                state.backgroundColorTransitionStartTime = performance.now();
                state.isBackgroundTransitioning = true;
            }
            scheduleOldColorCleanup();

            updateDynamicM3ThemeColors(state.targetBackgroundColor, state.colorPalette); // Uses clamped colors
            if (state.firstLastFmColorChangeDone) spawnTransitionShapes();
            else state.firstLastFmColorChangeDone = true;
            state.lastFmColorsExtractedSuccessfully = true;

            updateOldMenuElementsStyle();

        } catch (err) {
            console.error("Error in hybrid color extraction:", err);
            state.lastFmColorsExtractedSuccessfully = false;
            applyDefaultColors(); // Clamps defaults
        } finally {
            state.lastFmArtProcessing = false;
            performInitialSceneSetupIfNeeded();
        }
    }


    async function loadDefaultColors() {
        try {
            const img = await loadImage(state.DEFAULT_IMAGE_URL);
            // Clamp the default background color immediately
            state.defaultBackgroundColor = clampColorLightness(rgbToHex(...colorThief.getColor(img)).toUpperCase());
            const paletteRgb = colorThief.getPalette(img, MAX_PALETTE_COLORS_TO_REQUEST);
            let uniqueRgbs = [];
            if (paletteRgb?.length > 0) {
                for (const cRgb of paletteRgb) {
                    if (!uniqueRgbs.some(eRgb => areColorsSimilar(cRgb, eRgb, COLOR_SIMILARITY_TOLERANCE))) {
                        uniqueRgbs.push(cRgb);
                    }
                }
            }
            if (uniqueRgbs.length > 0) {
                // Clamp each default palette color
                state.defaultColorPalette = uniqueRgbs.map((rgb, i) => ({
                    color: clampColorLightness(rgbToHex(...rgb).toUpperCase()),
                    weight: Math.sqrt(uniqueRgbs.length - i)
                }));
            } else {
                // Use the (already clamped) default background as fallback
                state.defaultColorPalette = [{ color: state.defaultBackgroundColor || '#CCCCCC', weight: 1 }];
            }
            state.defaultColorsLoaded = true;
            console.log("Default colors loaded and clamped.");
        } catch (e) {
            console.error("Error loading default colors:", e);
        } finally {
            performInitialSceneSetupIfNeeded();
        }
    }

    function initializeOldMenuSelectors() {
        state.oldMenu.btn = $('lastfm-button');
        state.oldMenu.sigs = document.querySelectorAll('.signature-container .signature');
        state.oldMenu.links = document.querySelectorAll('.b-c .b');
        state.oldMenu.favicon = document.querySelector('link[rel="icon"]');
        state.oldMenu.themeMeta = document.querySelector('meta[name="theme-color"]');
    }

    function handleVisibilityChange() {
        if (document.hidden) {
            if (!state.isPaused) {
                two.pause();
                state.isPaused = true;
                state.pausedByVisibility = true;
            }
            if (state.lastfmPollIntervalId) {
                clearInterval(state.lastfmPollIntervalId);
                state.lastfmPollIntervalId = null;
            }
        } else {
            if (state.isPaused && state.pausedByVisibility) {
                two.play();
                state.isPaused = false;
                state.pausedByVisibility = false;
                state.lastTime = performance.now();
            }
            fetchLastFmData(true);
        }
    }

    // --- Update Loop ---
    two.bind('update', (frameCount) => {
        if (state.isPaused) return;
        const now = performance.now();
        const delta = now - state.lastTime;
        state.lastTime = now;

        const twoW = two.width, twoH = two.height;

        // 1. Background Color Transition
        if (state.isBackgroundTransitioning) {
            const progress = Math.min((now - state.backgroundColorTransitionStartTime) / BACKGROUND_COLOR_TRANSITION_DURATION, 1);
            const prevRgb = hexToRgb(state.previousBackgroundColorForTransition);
            const targetRgb = hexToRgb(state.targetBackgroundColor);
            state.currentAnimatedBackgroundColor = rgbToHex(
                prevRgb.r + (targetRgb.r - prevRgb.r) * progress,
                prevRgb.g + (targetRgb.g - prevRgb.g) * progress,
                prevRgb.b + (targetRgb.b - prevRgb.b) * progress
            );

            const prevPageRgb = hexToRgb(state.previousPageBackgroundColorForTransition);
            const targetPageRgb = hexToRgb(state.targetPageBackgroundColor);
            state.currentPageBackgroundColor = rgbToHex(
                prevPageRgb.r + (targetPageRgb.r - prevPageRgb.r) * progress,
                prevPageRgb.g + (targetPageRgb.g - prevPageRgb.g) * progress,
                prevPageRgb.b + (targetPageRgb.b - prevPageRgb.b) * progress
            );

            if (progress >= 1) {
                state.isBackgroundTransitioning = false;
                state.currentAnimatedBackgroundColor = state.targetBackgroundColor;
                state.currentPageBackgroundColor = state.targetPageBackgroundColor;
            }
        } else if (state.currentAnimatedBackgroundColor !== state.targetBackgroundColor) {
            state.currentAnimatedBackgroundColor = state.targetBackgroundColor;
        } else {
            if (state.currentAnimatedBackgroundColor !== state.targetBackgroundColor) {
                state.currentAnimatedBackgroundColor = state.targetBackgroundColor;
            }
            if (state.currentPageBackgroundColor !== state.targetPageBackgroundColor) {
                state.currentPageBackgroundColor = state.targetPageBackgroundColor;
            }
        }

        // 2. Text Color Transition (NEW)
        if (state.isTextColorTransitioning) {
            const progress = Math.min((now - state.textColorTransitionStartTime) / TEXT_COLOR_TRANSITION_DURATION, 1);

            const prevRgb = hexToRgb(state.previousTextColorForTransition);
            const targetRgb = hexToRgb(state.targetTextColor);

            // Interpolate RGB
            state.currentTextColor = rgbToHex(
                prevRgb.r + (targetRgb.r - prevRgb.r) * progress,
                prevRgb.g + (targetRgb.g - prevRgb.g) * progress,
                prevRgb.b + (targetRgb.b - prevRgb.b) * progress
            );

            applyMenuTextColorToDom(state.currentTextColor);

            if (progress >= 1) {
                state.isTextColorTransitioning = false;
                state.currentTextColor = state.targetTextColor;
            }
        }
        // Fallback: If not transitioning, ensure we are at the target color (handles initial load)
        else if (state.currentTextColor !== state.targetTextColor) {
            state.currentTextColor = state.targetTextColor;
            applyMenuTextColorToDom(state.currentTextColor);
        }

        // 3. Trigger Updates if Background Changed
        // This ensures we recalculate the *Target* text color if the background target changes
        if (state.currentAnimatedBackgroundColor !== state.previousFrameAnimatedBgColor) {
            updateOldMenuThemeMetaTag();

            // Pass Hue and Saturation dynamically to CSS for the scrolling page background
            const hsl = hexToHSL(state.currentPageBackgroundColor);
            document.documentElement.style.setProperty('--dominant-h', hsl.h);
            // Double the saturation so the gradient has plenty of color
            document.documentElement.style.setProperty('--dominant-s', Math.min(100, hsl.s * 100 * 2) + '%');

            state.previousFrameAnimatedBgColor = state.currentAnimatedBackgroundColor;
        }

        // 4. Update Blur
        if (state.twoJsCanvas) {
            const bgColorForBlur = clampColorLightness(state.currentAnimatedBackgroundColor);
            const blurStateChanged = bgColorForBlur !== state.prevAnimatedBgColorForBlur;
            if (blurStateChanged) {
                applyBlurEffect(bgColorForBlur);
                state.prevAnimatedBgColorForBlur = bgColorForBlur;
            }
        }

        // 5. Old Color Cleanup (Optimized for Performance)
        // Checks if old colors exist and throttles their removal to prevent lag spikes.
        if (state.previousColorPaletteForCleanup.length > 0 && (now - state.paletteChangeTimestampForCleanup > CLEANUP_START_DELAY)) {
            const currentPaletteSet = new Set(state.colorPalette.map(item => item.color.toUpperCase()));

            // LIMIT: Only swap this many shapes per frame. 
            // 2 shapes/frame @ 60fps = 120 shapes swapped per second.
            // This is visually fast but computationally cheap.
            const MAX_SWAPS_PER_FRAME = 2;

            let shapesMoved = 0;
            let foundOldColor = false;

            for (let i = state.shapesData.length - 1; i >= 0; i--) {
                const sd = state.shapesData[i];
                if (sd.twoShape?.fill) {
                    const shapeColor = sd.twoShape.fill.toUpperCase();

                    // Check if this shape has an old color not in the new palette
                    if (state.previousColorPaletteForCleanup.includes(shapeColor) && !currentPaletteSet.has(shapeColor)) {
                        foundOldColor = true;

                        // Only proceed if we haven't hit our CPU budget for this frame
                        if (shapesMoved < MAX_SWAPS_PER_FRAME) {
                            sd.isMarkedForCleanupScaling = true;
                            sd.cleanupScaleStartTime = now;

                            // Fast fade duration (0.8s - 1.5s)
                            sd.cleanupScaleDuration = rand(5000, 10000);

                            state.fadingOutShapesData.push(sd);
                            state.shapesData.splice(i, 1);
                            shapesMoved++;
                        }
                    }
                }
            }

            // Instantly spawn replacements for the few we just removed
            if (shapesMoved > 0) adjustShapesArray();

            // Only stop checking when we can't find ANY old colors left in the scene
            if (!foundOldColor) {
                state.previousColorPaletteForCleanup = [];
                state.cleanupTriggeredForCurrentPaletteChange = true;
            }
        }

        // 6. Update Fading Shapes
        for (let i = state.fadingOutShapesData.length - 1; i >= 0; i--) {
            const sd = state.fadingOutShapesData[i];
            if (sd.twoShape) {
                const progress = Math.min((now - sd.cleanupScaleStartTime) / sd.cleanupScaleDuration, 1);
                sd.twoShape.opacity = 1 - easeInOutQuad(progress);

                const perpX = -sd.vy;
                const perpY = sd.vx;
                const sway = Math.sin(now * sd.curveFreq + sd.curveOffset) * sd.curveAmp;

                sd.twoShape.translation.x += (sd.vx + perpX * sway) * state.currentMovementSpeedMultiplier;
                sd.twoShape.translation.y += (sd.vy + perpY * sway) * state.currentMovementSpeedMultiplier;
                sd.twoShape.rotation += sd.rotationSpeed * state.currentRotationSpeedMultiplier;

                if (progress >= 1) {
                    if (sd.twoShape.parent) two.remove(sd.twoShape);
                    state.fadingOutShapesData.splice(i, 1);
                }
            } else {
                state.fadingOutShapesData.splice(i, 1);
            }
        }

        // 7. Update Main Shapes
        let reinitCount = 0;
        const maxReinit = Math.max(1, ~~(state.currentNumShapes / REINIT_BATCH_DIVISOR));
        for (let i = state.shapesData.length - 1; i >= 0; i--) {
            const sd = state.shapesData[i];
            if (sd.needsReinitialization) {
                if (reinitCount < maxReinit && !sd.twoShape) {
                    initializeShape(sd, false);
                    reinitCount++;
                }
                continue;
            }
            if (!sd.twoShape) {
                sd.needsReinitialization = true;
                continue;
            }

            const shape = sd.twoShape;

            if (sd.isColorTransitioning && now >= sd.colorTransitionStartTime) {
                const progress = Math.min((now - sd.colorTransitionStartTime) / sd.colorTransitionDuration, 1);
                const prevRgb = hexToRgb(sd.startColor);
                const targetRgb = hexToRgb(sd.targetColor);

                shape.fill = rgbToHex(
                    prevRgb.r + (targetRgb.r - prevRgb.r) * progress,
                    prevRgb.g + (targetRgb.g - prevRgb.g) * progress,
                    prevRgb.b + (targetRgb.b - prevRgb.b) * progress
                );

                if (progress >= 1) {
                    sd.isColorTransitioning = false;
                }
            }

            const perpX = -sd.vy;
            const perpY = sd.vx;
            const sway = Math.sin(now * sd.curveFreq + sd.curveOffset) * sd.curveAmp;

            shape.translation.x += (sd.vx + perpX * sway) * state.currentMovementSpeedMultiplier;
            shape.translation.y += (sd.vy + perpY * sway) * state.currentMovementSpeedMultiplier;
            shape.rotation += sd.rotationSpeed * state.currentRotationSpeedMultiplier;

            const halfW = sd.approxWidth / 2, halfH = sd.approxHeight / 2;
            const l = shape.translation.x - halfW, r = shape.translation.x + halfW;
            const t = shape.translation.y - halfH, b = shape.translation.y + halfH;

            const buffer = Math.max(sd.approxWidth, sd.approxHeight) * 0.7;
            if (l > twoW + buffer || r < -buffer || t > twoH + buffer || b < -buffer) {
                if (shape.parent) two.remove(shape);
                sd.twoShape = null;
                sd.needsReinitialization = true;
            }
        }

        // 8. Update Raining Cakes
        if (state.isBirthdayModeActive && rainingCakesContainer && (now - state.lastRainCakeSpawnTime > RAIN_CAKE_SPAWN_INTERVAL)) {
            spawnSmallCake();
            state.lastRainCakeSpawnTime = now;
        }
        for (let i = state.activeRainingCakes.length - 1; i >= 0; i--) {
            const cake = state.activeRainingCakes[i];
            cake.y += cake.speed * delta;
            cake.rotation += cake.rotationSpeed * delta;
            cake.element.style.transform = `rotate(${cake.rotation}deg)`;
            cake.element.style.top = `${cake.y}px`;
            if (cake.y > window.innerHeight * 1.5) {
                if (cake.element.parentNode === rainingCakesContainer) {
                    rainingCakesContainer.removeChild(cake.element);
                }
                state.activeRainingCakes.splice(i, 1);
            }
        }

        // 9. Update Transition Shapes
        for (let i = state.transitionShapesData.length - 1; i >= 0; i--) {
            const sd = state.transitionShapesData[i];
            const shape = sd.twoShape;
            if (!shape) { state.transitionShapesData.splice(i, 1); continue; }

            if (sd.isFadingIn) {
                const progress = Math.min((now - sd.spawnTime) / FADE_DURATION, 1);
                shape.opacity = progress * (sd.targetOpacity ?? 1.0);
                if (progress >= 1) sd.isFadingIn = false;
            }

            const perpX = -sd.vy;
            const perpY = sd.vx;
            const sway = Math.sin(now * sd.curveFreq + sd.curveOffset) * sd.curveAmp;

            shape.translation.x += (sd.vx + perpX * sway) * state.currentMovementSpeedMultiplier;
            shape.translation.y += (sd.vy + perpY * sway) * state.currentMovementSpeedMultiplier;
            shape.rotation += sd.rotationSpeed * state.currentRotationSpeedMultiplier;

            const buffer = Math.max(sd.approxWidth, sd.approxHeight) * 0.7;
            if (shape.translation.x < -buffer || shape.translation.x > twoW + buffer || shape.translation.y < -buffer || shape.translation.y > twoH + buffer) {
                if (shape.parent) two.remove(shape);
                state.transitionShapesData.splice(i, 1);
            }
        }
    });

    // --- JIGGLY BUTTON LOGIC (UPDATED) ---
    /**
 * Handles the physics-like spacing (jiggle) and touch-screen feedback.
 */
    function setupJigglyButtonEffects() {
        const buttons = document.querySelectorAll('.b-c .b');
        const scrollContainer = document.querySelector('.b-c');
        if (buttons.length === 0 || !scrollContainer) return;

        buttons.forEach(btn => {
            const span = btn.querySelector('.button-text');
            if (span) btn.setAttribute('data-text', span.innerHTML);

        });

        const getSUnit = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--s')) || 75;

        const buttonStates = Array.from(buttons).map(btn => ({
            el: btn,
            wordStates: wrapTextInWords(btn),
            targetY: 0, currentY: 0,
            targetX: 0, currentX: 0,
            targetScale: 1, currentScale: 1,
            targetWeight: 300, currentWeight: 300,
            targetWidthAxis: 100, currentWidthAxis: 100,
            targetOpacity: 0.8, currentOpacity: 0.8,
            targetShiftRatio: 0.5, currentShiftRatio: 0.5,
            baseOffsetTop: btn.offsetTop,
            baseOffsetLeft: btn.offsetLeft,
            trueBtnWidth: btn.offsetWidth,
            baseOffsetWidth: btn.offsetWidth,
            baseOffsetHeight: btn.offsetHeight,
            targetHeight: btn.offsetHeight,
            currentHeight: btn.offsetHeight,
            needsMeasurement: true,
            lastRoundedWeight: -1,
            lastRoundedWidth: -1,
            needsWordMeasurement: true
        }));

        state.jiggly.buttonStates = buttonStates;
        let mouseX = -99999;
        let mouseY = -99999;

        window.addEventListener('mousemove', (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
        });
        document.addEventListener('mouseleave', (e) => {
            if (e.clientX <= 0 || e.clientY <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
                mouseX = -99999;
                mouseY = -99999;
            }
        });
        window.addEventListener('mouseout', (e) => {
            if (!e.relatedTarget) {
                mouseX = -99999;
                mouseY = -99999;
            }
        });

        buttons.forEach((btn, i) => {
            btn.addEventListener('touchstart', () => {
                resetAllButtons();
                state.jiggly.touchedIndex = i;
            }, { passive: true });
        });

        document.addEventListener('touchstart', (e) => {
            if (!e.target.closest('.b')) {
                resetAllButtons();
            }
        }, { passive: true });

        // Reset selection when the user lifts their finger anywhere
        document.addEventListener('touchend', resetAllButtons, { passive: true });
        document.addEventListener('touchcancel', resetAllButtons, { passive: true });

        let maxFirstFourWidth = Math.max(...buttonStates.slice(0, 4).map(b => b.baseOffsetWidth));

        function animate() {
            const sUnit = getSUnit();
            const maxDist = sUnit * 3;
            const basePush = sUnit * 0.4;
            const containerRect = scrollContainer.getBoundingClientRect();

            const firstBtnTop = buttonStates[0].baseOffsetTop + containerRect.top;
            const lastBtnBottom = buttonStates[buttonStates.length - 1].baseOffsetTop + containerRect.top + buttonStates[buttonStates.length - 1].baseOffsetHeight;
            let outsideDistY = 0;
            if (mouseY < firstBtnTop) outsideDistY = firstBtnTop - mouseY;
            else if (mouseY > lastBtnBottom) outsideDistY = mouseY - lastBtnBottom;
            const containerFactorY = Math.max(0, 1 - (outsideDistY / maxDist));

            const horizontalFalloff = maxDist * 1.5;
            let isHoveringContainer = false;
            let globalHoverFactorX = 0;

            buttonStates.forEach((bState) => {
                const baseTop = bState.baseOffsetTop + containerRect.top;
                const baseLeft = bState.baseOffsetLeft + containerRect.left;
                const btnWidth = bState.trueBtnWidth || bState.baseOffsetWidth;
                const btnCenterY = baseTop + bState.baseOffsetHeight / 2;
                let distY = Math.abs(mouseY - btnCenterY);

                // Extend hover bounding box 50% lower when there is at least a second line
                if (bState.targetHeight > sUnit * 1.5 && mouseY > btnCenterY) {
                    distY /= 1.5;
                }

                // Calculate max width including maximum hover scale + roughly 15% width added by font-weight expansion
                let maxHoverBonus = 0.4;
                if (btnWidth > 0) {
                    let safeScale = window.innerWidth <= 768 ? (window.innerWidth - 50) / btnWidth : (window.innerWidth - baseLeft - 50) / btnWidth;
                    maxHoverBonus = Math.min(0.4, Math.max(0, safeScale - 1));
                }
                const expandedWidth = btnWidth * (1 + maxHoverBonus) * 1.15;

                const distX = mouseX < baseLeft ? Math.max(0, baseLeft - mouseX) : Math.max(0, mouseX - (baseLeft + expandedWidth));
                const localFactorX = Math.max(0, 1 - (distX / horizontalFalloff));
                globalHoverFactorX = Math.max(globalHoverFactorX, localFactorX);

                if (mouseX >= 0 && distY < maxDist * 1.5 && distX < horizontalFalloff) {
                    isHoveringContainer = true;
                }
            });

            state.jiggly.isHoveringContainer = isHoveringContainer;

            // Safely update base metrics only when not interacting and animations have settled
            // This prevents the font-weight layout shift from causing an infinite jitter loop
            const isInteracting = state.jiggly.isHoveringContainer || state.jiggly.touchedIndex !== -1;
            const allAtRest = buttonStates.every(b => Math.abs(b.currentWeight - 300) < 1 && Math.abs(b.currentScale - 1) < 0.01 && Math.abs(b.currentWidthAxis - 100) < 0.5);

            if (!isInteracting && allAtRest) {
                buttonStates.forEach(bState => {
                    if (bState.el.style.height !== 'auto') {
                        bState.el.style.height = 'auto';
                        bState.el.style.marginBottom = '0px';
                    }
                });

                buttonStates.forEach(bState => {
                    bState.currentHeight = bState.el.offsetHeight;
                    bState.targetHeight = bState.currentHeight;
                    bState.baseOffsetTop = bState.el.offsetTop;
                    bState.baseOffsetLeft = bState.el.offsetLeft;
                    bState.baseOffsetWidth = bState.el.offsetWidth;
                    bState.trueBtnWidth = bState.el.offsetWidth;
                    bState.baseOffsetHeight = bState.el.offsetHeight;
                });
                maxFirstFourWidth = Math.max(...buttonStates.slice(0, 4).map(b => b.baseOffsetWidth));
            }

            buttonStates.forEach((bState, i) => {
                // Base calculations off of cached offsets rather than dynamic ones
                const baseTop = bState.baseOffsetTop + containerRect.top;
                const baseLeft = bState.baseOffsetLeft + containerRect.left;
                const btnWidth = bState.trueBtnWidth || bState.baseOffsetWidth;
                const btnHeight = bState.baseOffsetHeight;

                let maxHoverBonus = 0.4;
                let maxTouchBonus = 0.1;
                if (btnWidth > 0) {
                    let safeScale = window.innerWidth <= 768 ? (window.innerWidth - 50) / btnWidth : (window.innerWidth - baseLeft - 50) / btnWidth;
                    maxHoverBonus = Math.min(0.4, Math.max(0, safeScale - 1));
                    maxTouchBonus = Math.min(0.1, Math.max(0, safeScale - 1));
                }
                const expandedWidth = btnWidth * (1 + maxHoverBonus) * 1.15;

                // Dynamically enforce the 50px word wrap boundary based on the current scale
                // This ensures text only wraps when it actually grows, leaving it unwrapped at rest
                const maxLayoutWidth = window.innerWidth <= 768
                    ? (window.innerWidth - 50) / bState.currentScale
                    : (window.innerWidth - baseLeft - 50) / bState.currentScale;
                bState.el.style.maxWidth = `${Math.max(0, maxLayoutWidth)}px`;

                if (state.jiggly.touchedIndex !== -1) {
                    if (i === state.jiggly.touchedIndex) {
                        bState.targetY = 0;
                        bState.targetX = 0;
                        bState.targetScale = 1 + maxTouchBonus;
                        bState.targetWeight = 700;
                        bState.targetWidthAxis = 112.5;
                        bState.targetOpacity = 1;
                        bState.targetShiftRatio = 0.5;
                    } else {
                        const distance = Math.abs(i - state.jiggly.touchedIndex);
                        const displacement = basePush * ((1 - Math.pow(0.5, distance)) / (1 - 0.5));
                        const direction = i > state.jiggly.touchedIndex ? 1 : -1;
                        bState.targetY = direction * displacement;
                        bState.targetX = 0;
                        bState.targetScale = 1;
                        bState.targetWeight = 300;
                        bState.targetWidthAxis = 100;
                        bState.targetOpacity = 0.8;
                        bState.targetShiftRatio = 0.5;
                    }
                } else if (!state.jiggly.isHoveringContainer) {
                    bState.targetY = 0;
                    bState.targetX = 0;
                    bState.targetScale = 1;
                    bState.targetWeight = 300;
                    bState.targetWidthAxis = 100;
                    bState.targetOpacity = 0.8;
                    bState.targetShiftRatio = 0.5;
                } else {
                    const btnCenterY = baseTop + btnHeight / 2;

                    let shiftRatio = 0.5;
                    if (btnHeight > 0) {
                        const localY = mouseY - baseTop;
                        shiftRatio = Math.max(0, Math.min(1, localY / btnHeight));
                    }
                    bState.targetShiftRatio = shiftRatio;

                    let distY = Math.abs(mouseY - btnCenterY);
                    let signedDistY = btnCenterY - mouseY;

                    // Extend hover bounding box 50% lower when there is at least a second line
                    if (bState.targetHeight > sUnit * 1.5 && mouseY > btnCenterY) {
                        distY /= 1.5;
                        signedDistY /= 1.5;
                    }

                    let curve = 0;
                    let textCurve = 0;
                    const factorY = Math.max(0, 1 - (distY / maxDist));
                    const distX = mouseX < baseLeft ? Math.max(0, baseLeft - mouseX) : Math.max(0, mouseX - (baseLeft + expandedWidth));
                    const localFactorX = Math.max(0, 1 - (distX / horizontalFalloff));
                    const factor = localFactorX * factorY;

                    if (factor > 0 && mouseX >= 0) {
                        // Smooth exponential falloff horizontally, smooth sine curve vertically
                        curve = Math.pow(localFactorX, 2) * Math.sin(factorY * Math.PI / 2) * Math.pow(containerFactorY, 6);
                        // Twice as exponential for bold and width
                        textCurve = Math.pow(localFactorX, 4) * Math.sin(factorY * Math.PI / 2) * Math.pow(containerFactorY, 6);
                    }

                    bState.targetScale = 1 + (maxHoverBonus * curve);
                    bState.targetOpacity = 0.8 + (0.2 * curve);
                    bState.targetWeight = 300 + (400 * curve);
                    bState.targetWidthAxis = 100 + (12.5 * curve);
                    bState.targetWeight = 300 + (400 * textCurve);
                    bState.targetWidthAxis = 100 + (12.5 * textCurve);

                    let pullX = 0;
                    let pullY = 0;
                    if (factor > 0 && mouseX >= 0) {
                        // Double the magnetic pull (12%) for the button currently being hovered over, default to 6% for others
                        const isDirectlyHovered = distX === 0 && distY < (Math.max(btnHeight, bState.targetHeight) * 0.6);
                        const pullMultiplier = isDirectlyHovered ? 0.12 : 0.06;

                        // Position magnet based on the exact resting center of the text rather than the expanded hit box
                        pullX = (mouseX - (baseLeft + btnWidth / 2)) * pullMultiplier * curve;
                        pullY = (mouseY - btnCenterY) * pullMultiplier * curve;

                        // Subtly dampen negative (leftward) pull to prevent the menu from awkwardly shifting left out of margin alignment
                        if (pullX < 0) {
                            pullX *= 0.4;
                        }
                    }

                    let pushY = 0;
                    if (globalHoverFactorX > 0 && mouseX >= 0 && Math.abs(signedDistY) < maxDist * 1.5) {
                        const normalizedDist = signedDistY / (maxDist * 1.5);
                        // Smooth curve vertically, gentle drop-off horizontally
                        const pushCurve = normalizedDist * Math.pow(1 - Math.abs(normalizedDist), 2);

                        let pushMultiplier = 4;
                        const isLastFm = bState.el.id === 'lastfm-button';
                        const isAboveLastFm = i + 1 < buttonStates.length && buttonStates[i + 1].el.id === 'lastfm-button';

                        // Add extra repulsion between Last.fm and the button above it (Spotify) to prevent overlap on hover
                        if (isAboveLastFm && signedDistY < 0) {
                            pushMultiplier = 7.5;
                        } else if (isLastFm && signedDistY > 0) {
                            pushMultiplier = 7.5;
                        }

                        pushY = pushCurve * basePush * pushMultiplier * Math.pow(globalHoverFactorX, 2) * Math.pow(containerFactorY, 6);
                    }
                    bState.targetX = pullX;
                    bState.targetY = pushY + pullY;
                }
            });

            // 1. Apply font-weight
            buttonStates.forEach(bState => {
                bState.currentWeight += (bState.targetWeight - bState.currentWeight) * 0.15;
                bState.currentWidthAxis += (bState.targetWidthAxis - bState.currentWidthAxis) * 0.15;

                const roundedWeight = Math.round(bState.currentWeight);
                const roundedWidth = Math.round(bState.currentWidthAxis * 10) / 10;

                if (bState.lastRoundedWeight !== roundedWeight || bState.lastRoundedWidth !== roundedWidth) {
                    bState.el.style.fontWeight = roundedWeight;
                    bState.el.style.fontVariationSettings = `'slnt' 0, 'wdth' ${roundedWidth}, 'GRAD' 0, 'ROND' 0`;
                    bState.el.style.height = 'auto'; // allow natural reflow
                    bState.lastRoundedWeight = roundedWeight;
                    bState.lastRoundedWidth = roundedWidth;
                    bState.needsMeasurement = true;
                    bState.needsWordMeasurement = true;
                }
            });

            // 2. Measure natural word offsets and height exactly once per frame (avoids layout thrashing)
            buttonStates.forEach(bState => {
                if (bState.needsMeasurement) {
                    bState.targetHeight = bState.el.offsetHeight;
                    bState.needsMeasurement = false;
                }
                if (bState.needsWordMeasurement) {
                    let maxRight = 0;
                    bState.wordStates.forEach(wState => {
                        wState.targetX = wState.el.offsetLeft;
                        wState.targetY = wState.el.offsetTop;
                        const rightEdge = wState.targetX + wState.el.offsetWidth;
                        if (rightEdge > maxRight) maxRight = rightEdge;
                        if (wState.currentX === null) {
                            wState.currentX = wState.targetX;
                            wState.currentY = wState.targetY;
                        }
                    });
                    if (maxRight > 0) bState.trueBtnWidth = maxRight;
                    bState.needsWordMeasurement = false;
                }
            });

            // 3. Interpolate positions and apply transforms
            buttonStates.forEach(bState => {
                if (isInteracting || !allAtRest) {
                    if (Math.abs(bState.targetHeight - bState.currentHeight) > 0.5) {
                        bState.currentHeight += (bState.targetHeight - bState.currentHeight) * 0.15;
                        bState.el.style.height = bState.currentHeight + 'px';
                    } else {
                        bState.currentHeight = bState.targetHeight;
                        bState.el.style.height = bState.targetHeight + 'px';
                    }
                    // Apply negative margin to prevent pushing sibling elements upwards
                    bState.el.style.marginBottom = (bState.baseOffsetHeight - bState.currentHeight) + 'px';

                    bState.currentShiftRatio += (bState.targetShiftRatio - bState.currentShiftRatio) * 0.15;

                    // Apply negative margin to distribute expansion up and down based on cursor position.
                    // Scaled to shift 25% higher upwards when the word wraps.
                    bState.el.style.marginBottom = ((bState.baseOffsetHeight - bState.currentHeight) * (0.25 + (1 - bState.currentShiftRatio) * 0.5)) + 'px';
                }
                bState.wordStates.forEach(wState => {
                    if (wState.currentX !== null) {
                        wState.currentX += (wState.targetX - wState.currentX) * 0.15;
                        wState.currentY += (wState.targetY - wState.currentY) * 0.15;

                        const tx = wState.currentX - wState.targetX;
                        const ty = wState.currentY - wState.targetY;

                        if (Math.abs(tx) > 0.5 || Math.abs(ty) > 0.5) {
                            wState.el.style.transform = `translate(${tx}px, ${ty}px)`;
                        } else {
                            wState.currentX = wState.targetX;
                            wState.currentY = wState.targetY;
                            wState.el.style.transform = 'none';
                        }
                    }
                });

                bState.currentY += (bState.targetY - bState.currentY) * 0.15;
                bState.currentX += (bState.targetX - bState.currentX) * 0.15;
                bState.currentScale += (bState.targetScale - bState.currentScale) * 0.15;
                bState.currentOpacity += (bState.targetOpacity - bState.currentOpacity) * 0.15;

                bState.el.style.transform = `translateY(${bState.currentY}px) scale(${bState.currentScale})`;
                bState.el.style.transform = `translate(${bState.currentX}px, ${bState.currentY}px) scale(${bState.currentScale})`;
                bState.el.style.opacity = bState.currentOpacity;
            });

            requestAnimationFrame(animate);
        }

        animate();
    }

    /**
 * Attaches global window/document listeners for state management.
 */
    function setupEventListeners() {
        // Window Resize Debounce
        window.addEventListener('resize', debounce(() => {
            if (state.twoJsCanvas) {
                applyBlurEffect(clampColorLightness(state.currentAnimatedBackgroundColor));
                state.twoJsCanvas.style.width = '100%';
                state.twoJsCanvas.style.height = '100%';
            }
            if (state.jiggly && state.jiggly.buttonStates) {
                state.jiggly.buttonStates.forEach(bState => {
                    bState.lastRoundedWeight = -1; // force remeasure properly
                    bState.lastRoundedWidth = -1;
                    bState.needsMeasurement = true;
                    bState.el.style.height = 'auto';
                    bState.el.style.marginBottom = '0px';
                    bState.needsWordMeasurement = true;
                    bState.wordStates.forEach(wState => {
                        wState.currentX = null; // Snap instantly on resize
                    });
                });
            }
        }, 250));

        // Page Visibility & Focus Logic (The Fix)
        // Resets bold/spacing if the user switches tabs or minimizes browser
        window.addEventListener('blur', resetAllButtons);
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                resetAllButtons();
                handleVisibilityChange(); // Existing visibility pause logic
            } else {
                handleVisibilityChange(); // Existing visibility resume logic
            }
        }, false);

        // Apply instantly without re-fetching colors
        window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
            applyPostProcessingFilters();
            updateOldMenuElementsStyle(true);
            updateOldMenuThemeMetaTag();
        });

        // Initialize the button hover/tap logic
        setupJigglyButtonEffects();

        // Scroll Indicator Click
        const scrollIndicator = document.getElementById('scroll-indicator');
        if (scrollIndicator) {
            scrollIndicator.addEventListener('click', () => {
                window.scrollTo({ top: window.innerHeight, behavior: 'smooth' });

                // Pause the bouncing animation for 1 second after click
                scrollIndicator.classList.add('pause-bounce');
                setTimeout(() => {
                    scrollIndicator.classList.remove('pause-bounce');
                }, 750);
            });
        }

        // Parallax Effect
        window.addEventListener('scroll', () => {
            requestAnimationFrame(() => {
                const scrollY = window.scrollY;
                // Background moves at 60% of normal scroll speed
                const parallaxOffset = scrollY * 0.4;
                if (container) {
                    container.style.transform = `translate3d(0, ${parallaxOffset}px, 0)`;
                }
                if (rainingCakesContainer) {
                    rainingCakesContainer.style.transform = `translate3d(0, ${parallaxOffset}px, 0)`;
                }

                // Update the button mask position so the fade stays locked to the screen
                const bc = document.querySelector('.b-c');
                if (bc) {
                    bc.style.setProperty('--mask-y', `${scrollY}px`);
                }

                // Shrink signature ONLY when scrolling into the new page
                const signature = document.querySelector('.signature');
                if (signature) {
                    const scaleStart = window.innerHeight * 0.85; // Start when white page fade begins
                    const scaleEnd = window.innerHeight * 1.15;   // End slightly after crossing into the page
                    const progress = Math.min(1, Math.max(0, (scrollY - scaleStart) / (scaleEnd - scaleStart)));
                    const scale = 1 - (0.25 * progress); // 25% reduction = 75% of original size
                    signature.style.transform = `scale(${scale})`;
                }

                // Fade out scroll indicator naturally over the first 20% of the scroll
                const scrollIndicator = document.getElementById('scroll-indicator');
                if (scrollIndicator) {
                    const fadeStart = 10;
                    const fadeEnd = window.innerHeight * 0.2;
                    let opacity = 1 - ((scrollY - fadeStart) / (fadeEnd - fadeStart));
                    scrollIndicator.style.opacity = Math.max(0, Math.min(1, opacity));
                }
            });
        }, { passive: true });
    }

    // --- NEW: Toggle New Page Scroll ---
    window.toggleNewPageScroll = (enable) => {
        state.enableNewPageScroll = enable;
        const newPage = document.querySelector('.new-white-page');
        const scrollIndicator = document.getElementById('scroll-indicator');

        if (enable) {
            if (newPage) newPage.style.display = '';
            if (scrollIndicator) scrollIndicator.style.display = '';
            document.body.style.overflowY = 'auto';
        } else {
            if (newPage) newPage.style.display = 'none';
            if (scrollIndicator) scrollIndicator.style.display = 'none';
            document.body.style.overflowY = 'hidden';
            window.scrollTo(0, 0); // Snap back to top
        }
    };

    // --- Initial Calls ---
    if (state.twoJsCanvas) applyBlurEffect(state.currentAnimatedBackgroundColor); // Initial bg might not be clamped yet, okay for first draw
    applyPostProcessingFilters();
    setupEventListeners(); // This will now also call setupJigglyButtonEffects
    initializeOldMenuSelectors();
    handleOldMenuLastFmUpdate(null); // Not async, fine
    loadDefaultColors(); // Clamps defaults
    fetchLastFmData(); // Fetches and clamps Last.fm colors
    resetLastFmInterval();
    window.toggleNewPageScroll(state.enableNewPageScroll);
});