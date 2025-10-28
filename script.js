document.addEventListener('DOMContentLoaded', () => {
    const $ = id => document.getElementById(id);
    const container = $('scene-container');
    if (!container) return console.error("Scene container not found!");

    // --- State ---
    const state = {
        isPaused: false, pausedByVisibility: false,
        currentNumShapes: 60, currentScaleMultiplier: 1.0, currentRotationSpeedMultiplier: 1.0,
        currentMovementSpeedMultiplier: 1.0, currentNumTransitionShapes: 10, currentBlurIntensity: 300,
        currentResolutionIndex: 2, previousResolutionIndex: 0,
        currentBrightness: 80, currentContrast: 120, currentSaturation: 200, currentHueRotate: 0,
        rawUnbalancedPalette: [], currentDominanceCap: 60,
        currentAccentBoost: 0.5, currentMinThreshold: 1, colorPalette: [], defaultColorPalette: [],
        targetBackgroundColor: '#181818', previousBackgroundColorForTransition: '#181818',
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
    const BACKGROUND_COLOR_TRANSITION_DURATION = 500;
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
    const MAX_LIGHTNESS = 0.35;
    const SPAWN_CONFIGS = [
        { getX: (w, h, o) => -o, getY: (w, h, o) => rand(0, h), getVX: (s) => s, getVY: (s) => rand(-s * 0.3, s * 0.3)},
        { getX: (w, h, o) => rand(0, w), getY: (w, h, o) => -o, getVX: (s) => rand(-s * 0.3, s * 0.3), getVY: (s) => s},
        { getX: (w, h, o) => w + o, getY: (w, h, o) => rand(0, h), getVX: (s) => -s, getVY: (s) => rand(-s * 0.3, s * 0.3)},
        { getX: (w, h, o) => rand(0, w), getY: (w, h, o) => h + o, getVX: (s) => rand(-s * 0.3, s * 0.3), getVY: (s) => -s}
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
    // New helper to clamp lightness
    const clampColorLightness = (hexColor) => {
        let hsl = hexToHSL(hexColor);
        if (hsl.l >= MAX_LIGHTNESS + 0.001) { // Check if lightness is 80% or more
            hsl.l = MAX_LIGHTNESS; // Clamp it
            return hslToHex(hsl.h, hsl.s, hsl.l); // Convert back to hex
        }
        return hexColor; // Return original if below threshold
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
                .sort((a,b) => isGray ? 0 : b.hsl.s - a.hsl.s);
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

    function getRandomColorFromPaletteWeighted(palette, fallback = {color: '#CCCCCC', weight: 1}) {
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
        container.style.filter = filters.length > 0 ? filters.join(' ') : 'none';
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
        // Shapes get colors from state.colorPalette, which is already clamped
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

        newTwoShape.fill = chosenColorItem.color; // Use the (already clamped) color
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

        if (state.isInitialShapeSpawn && !isTransition && Math.random() < 0.5) {
            const center = { x: two.width / 2, y: two.height / 2 };
            const spawnRadius = Math.min(two.width, two.height) * 0.2;
            const angle = Math.random() * Math.PI * 2, dist = Math.random() * spawnRadius;
            newTwoShape.translation.set(center.x + Math.cos(angle) * dist, center.y + Math.sin(angle) * dist);
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

    function updateOldMenuElementsStyle() {
        // Use the potentially UNCLAMPED background color as the base for text color calculation
        const baseColorHex = state.currentAnimatedBackgroundColor || '#121212';
        const hsl = hexToHSL(baseColorHex);

        const targetLightness = 0.85; // Target 85% lightness for contrast
        const finalSat = (hsl.s < 0.01) ? 0 : 1.0; // Keep saturation logic

        // Calculate the final color WITHOUT clamping the lightness
        const finalHex = hslToHex(hsl.h, finalSat, targetLightness);

        // Apply the UNCLAMPED finalHex to the old menu elements
        if (state.oldMenu.links) state.oldMenu.links.forEach(el => el.style.color = finalHex);
        if (state.oldMenu.sigs) {
            state.oldMenu.sigs.forEach(svg => {
                svg.querySelectorAll('path, circle, rect, polygon, ellipse, line, .cls-1')
                   .forEach(el => el.style.fill = finalHex);
            });
        }
    }

    function updateOldMenuThemeMetaTag() {
        if (state.oldMenu.themeMeta) {
            // Use the clamped background color for the theme tag
            state.oldMenu.themeMeta.content = state.currentAnimatedBackgroundColor ? clampColorLightness(state.currentAnimatedBackgroundColor) : '#000000';
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

    function handleOldMenuLastFmUpdate(data) {
        if (!state.oldMenu.btn) initializeOldMenuSelectors();
        const isPlaying = data?.recenttracks?.track?.[0]?.["@attr"]?.nowplaying === "true";
        const user = data?.recenttracks?.["@attr"]?.user;
        let artUrl = null, trackName = null, artistName = null, trackUrl = null;

        if (isPlaying) {
            const track = data.recenttracks.track[0];
            trackName = track.name?.replace(/\s*\(.*?\)\s*/g, ' ') || 'Unknown Track';
            artistName = track.artist?.["#text"]?.replace(/\s*\(.*?\)\s*/g, ' ') || 'Unknown Artist';
            trackUrl = track.url || (user ? `https://www.last.fm/user/${user}` : "#");
            const imgInfo = track.image?.find(img => img.size === 'extralarge' || img.size === 'large');
            if (imgInfo?.["#text"] && !imgInfo["#text"].includes("2a96cbd8b46e442fc41c2b86b821562f")) {
                artUrl = imgInfo["#text"];
            }
        }
        updateOldMenuElementsStyle();
        updateOldMenuFavicon(artUrl, isPlaying);
        updateOldMenuThemeMetaTag();
        if (state.oldMenu.btn) {
            if (isPlaying && trackName && artistName) {
                state.oldMenu.btn.textContent = `Listening to ${trackName} by ${artistName}`;
                state.oldMenu.btn.href = trackUrl;
            } else {
                state.oldMenu.btn.textContent = "Last.fm";
                state.oldMenu.btn.href = user ? `https://www.last.fm/user/${user}` : "#";
            }
        }
    }

    function updateLastFmUI(data) {
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
        handleOldMenuLastFmUpdate(data);
    }


    async function fetchLastFmData(isManual = false) {
        try {
            const res = await fetch(LASTFM_API_URL);
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            const data = await res.json();
            updateLastFmUI(data);
        } catch (error) {
            console.error('Error fetching Last.fm data:', error);
            handleOldMenuLastFmUpdate(null);
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
        // Clamp the default background color before applying
        state.targetBackgroundColor = clampColorLightness(state.defaultBackgroundColor);
        state.backgroundColorTransitionStartTime = performance.now();
        state.isBackgroundTransitioning = true;
        // Clamp the default palette colors before applying
        state.colorPalette = state.defaultColorPalette.length > 0 ?
            state.defaultColorPalette.map(item => ({ ...item, color: clampColorLightness(item.color) })) :
            [];
        updateDynamicM3ThemeColors(state.targetBackgroundColor, state.colorPalette); // Will use clamped colors
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
            ready = true; setupType = "lastfm";
            // Ensure Last.fm colors are clamped if they haven't been already
            state.targetBackgroundColor = clampColorLightness(state.targetBackgroundColor);
            state.colorPalette = state.colorPalette.map(item => ({...item, color: clampColorLightness(item.color)}));

        } else if (state.firstLastFmFetchAttempted) {
            if (state.lastFmArtProcessing) return; // Wait
            if (state.defaultColorsLoaded) {
                ready = true; setupType = "default";
                 // Ensure default colors are used (and clamped by applyDefaultColors)
                if (state.targetBackgroundColor !== clampColorLightness(state.defaultBackgroundColor) || !arePalettesRoughlyEqual(state.colorPalette, state.defaultColorPalette.map(item => ({...item, color: clampColorLightness(item.color)})))) {
                    applyDefaultColors(); // This already clamps
                }
            }
        }

        if (ready) {
            console.log(`Performing initial scene setup with ${setupType} colors.`);
            // updateBackgroundOverlayState(state.targetBackgroundColor); // Removed
            updateDynamicM3ThemeColors(state.targetBackgroundColor, state.colorPalette); // Uses clamped colors
            adjustShapesArray();
            state.initialSceneSetupPerformed = true;
            state.isInitialShapeSpawn = false;
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
            if (w > h) { if (w > MAX_SIZE) { h = ~~(h * (MAX_SIZE / w)); w = MAX_SIZE; }}
            else { if (h > MAX_SIZE) { w = ~~(w * (MAX_SIZE / h)); h = MAX_SIZE; }}
            canvas.width = w; canvas.height = h;
            ctx.drawImage(img, 0, 0, w, h);

            const dominantRgb = colorThief.getColor(img);
            let paletteRgb = colorThief.getPalette(img, MAX_PALETTE_COLORS_TO_REQUEST - 1);
            let accentRgb = null;
            const pixelData = ctx.getImageData(0, 0, w, h).data;
            const vibrantCounts = new Map();

            for (let i = 0; i < pixelData.length; i += 4) {
                const r = pixelData[i], g = pixelData[i+1], b = pixelData[i+2];
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
                counts[findClosestColorIndex([pixelData[i], pixelData[i+1], pixelData[i+2]], paletteRgb)]++;
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
            state.backgroundColorTransitionStartTime = performance.now();
            state.isBackgroundTransitioning = true;
            scheduleOldColorCleanup();

            updateDynamicM3ThemeColors(state.targetBackgroundColor, state.colorPalette); // Uses clamped colors
            if (state.firstLastFmColorChangeDone) spawnTransitionShapes();
            else state.firstLastFmColorChangeDone = true;
            state.lastFmColorsExtractedSuccessfully = true;

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

        // Background Color Transition (Target color is already clamped)
        if (state.isBackgroundTransitioning) {
            const progress = Math.min((now - state.backgroundColorTransitionStartTime) / BACKGROUND_COLOR_TRANSITION_DURATION, 1);
            const prevRgb = hexToRgb(state.previousBackgroundColorForTransition); // Previous might not be clamped, that's okay for transition source
            const targetRgb = hexToRgb(state.targetBackgroundColor); // Target is clamped
            state.currentAnimatedBackgroundColor = rgbToHex( // Resulting intermediate color might exceed clamp temporarily, clamped in relevant functions (M3, blur)
                prevRgb.r + (targetRgb.r - prevRgb.r) * progress,
                prevRgb.g + (targetRgb.g - prevRgb.g) * progress,
                prevRgb.b + (targetRgb.b - prevRgb.b) * progress
            );
            if (progress >= 1) {
                state.isBackgroundTransitioning = false;
                state.currentAnimatedBackgroundColor = state.targetBackgroundColor; // Ensure end state is clamped target
            }
        } else if (state.currentAnimatedBackgroundColor !== state.targetBackgroundColor) {
            state.currentAnimatedBackgroundColor = state.targetBackgroundColor; // Ensure state reflects clamped target
        }

        // Update Old Menu Theme (Uses clamping internally)
        if (state.currentAnimatedBackgroundColor !== state.previousFrameAnimatedBgColor) {
            updateOldMenuElementsStyle();
            updateOldMenuThemeMetaTag();
            state.previousFrameAnimatedBgColor = state.currentAnimatedBackgroundColor;
        }

        // Update Blur (Uses clamping internally via clampColorLightness if needed)
        if (state.twoJsCanvas) {
             const bgColorForBlur = clampColorLightness(state.currentAnimatedBackgroundColor); // Clamp before applying to blur
            const blurStateChanged = bgColorForBlur !== state.prevAnimatedBgColorForBlur; // Compare clamped versions
            if (blurStateChanged) {
                 applyBlurEffect(bgColorForBlur); // Apply clamped color
                 state.prevAnimatedBgColorForBlur = bgColorForBlur; // Store clamped color
            }
        }


        // Old Color Cleanup (Trigger) - Compares against clamped state.colorPalette
        if (!state.cleanupTriggeredForCurrentPaletteChange && state.previousColorPaletteForCleanup.length > 0 && (now - state.paletteChangeTimestampForCleanup > CLEANUP_START_DELAY)) {
            const currentPaletteSet = new Set(state.colorPalette.map(item => item.color.toUpperCase())); // Current palette is clamped
            let shapesMoved = 0;
            for (let i = state.shapesData.length - 1; i >= 0; i--) {
                const sd = state.shapesData[i];
                if (sd.twoShape?.fill) {
                    // Shape color might be from old unclamped palette
                    const shapeColor = sd.twoShape.fill.toUpperCase();
                    // Check if old palette had it AND new clamped palette doesn't
                    if (state.previousColorPaletteForCleanup.includes(shapeColor) && !currentPaletteSet.has(shapeColor)) {
                        sd.isMarkedForCleanupScaling = true;
                        sd.cleanupScaleStartTime = now;
                        sd.cleanupScaleDuration = rand(5000, 10000);
                        state.fadingOutShapesData.push(sd);
                        state.shapesData.splice(i, 1);
                        shapesMoved++;
                    }
                }
            }
            if (shapesMoved > 0) adjustShapesArray(); // Refill with new clamped colors
            state.cleanupTriggeredForCurrentPaletteChange = true;
            state.previousColorPaletteForCleanup = [];
        }


        // Update Fading Shapes
        for (let i = state.fadingOutShapesData.length - 1; i >= 0; i--) {
            const sd = state.fadingOutShapesData[i];
            if (sd.twoShape) {
                const progress = Math.min((now - sd.cleanupScaleStartTime) / sd.cleanupScaleDuration, 1);
                sd.twoShape.opacity = 1 - easeInOutQuad(progress);
                sd.twoShape.translation.x += sd.vx * state.currentMovementSpeedMultiplier;
                sd.twoShape.translation.y += sd.vy * state.currentMovementSpeedMultiplier;
                sd.twoShape.rotation += sd.rotationSpeed * state.currentRotationSpeedMultiplier;

                if (progress >= 1) {
                    if (sd.twoShape.parent) two.remove(sd.twoShape);
                    state.fadingOutShapesData.splice(i, 1);
                }
            } else {
                state.fadingOutShapesData.splice(i, 1);
            }
        }

        // Update Main Shapes (Combined Loop)
        let reinitCount = 0;
        const maxReinit = Math.max(1, ~~(state.currentNumShapes / REINIT_BATCH_DIVISOR));
        for (let i = state.shapesData.length - 1; i >= 0; i--) {
            const sd = state.shapesData[i];
            if (sd.needsReinitialization) {
                if (reinitCount < maxReinit && !sd.twoShape) {
                    initializeShape(sd, false); // Gets clamped color
                    reinitCount++;
                }
                continue;
            }
            if (!sd.twoShape) {
                sd.needsReinitialization = true;
                continue;
            }

            const shape = sd.twoShape;
            shape.translation.x += sd.vx * state.currentMovementSpeedMultiplier;
            shape.translation.y += sd.vy * state.currentMovementSpeedMultiplier;
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

        // Update Raining Cakes
        if (state.isBirthdayModeActive && rainingCakesContainer && (now - state.lastRainCakeSpawnTime > RAIN_CAKE_SPAWN_INTERVAL)) {
            spawnSmallCake(); // Uses clamped colors
            state.lastRainCakeSpawnTime = now;
        }
        for (let i = state.activeRainingCakes.length - 1; i >= 0; i--) {
            const cake = state.activeRainingCakes[i];
            cake.y += cake.speed * delta;
            cake.rotation += cake.rotationSpeed * delta;
            cake.element.style.transform = `rotate(${cake.rotation}deg)`;
            cake.element.style.top = `${cake.y}px`;
            if (cake.y > window.innerHeight) {
                if (cake.element.parentNode === rainingCakesContainer) {
                    rainingCakesContainer.removeChild(cake.element);
                }
                state.activeRainingCakes.splice(i, 1);
            }
        }

        // Update Transition Shapes
        for (let i = state.transitionShapesData.length - 1; i >= 0; i--) {
            const sd = state.transitionShapesData[i];
            const shape = sd.twoShape;
            if (!shape) { state.transitionShapesData.splice(i, 1); continue; }

            if (sd.isFadingIn) {
                const progress = Math.min((now - sd.spawnTime) / FADE_DURATION, 1);
                shape.opacity = progress * (sd.targetOpacity ?? 1.0);
                if (progress >= 1) sd.isFadingIn = false;
            }

            shape.translation.x += sd.vx * state.currentMovementSpeedMultiplier;
            shape.translation.y += sd.vy * state.currentMovementSpeedMultiplier;
            shape.rotation += sd.rotationSpeed * state.currentRotationSpeedMultiplier;

            const buffer = Math.max(sd.approxWidth, sd.approxHeight) * 0.7;
            if (shape.translation.x < -buffer || shape.translation.x > twoW + buffer || shape.translation.y < -buffer || shape.translation.y > twoH + buffer) {
                if(shape.parent) two.remove(shape);
                state.transitionShapesData.splice(i, 1);
            }
        }
    });

    // --- JIGGLY BUTTON LOGIC (UPDATED) ---
    function setupJigglyButtonEffects() {
        // Use the specific selector for menu links
        const buttons = document.querySelectorAll('.b-c .b');
        const scrollContainer = document.querySelector('.b-c'); // Get the scrollable container
        if (buttons.length === 0 || !scrollContainer) return;

        const buttonArray = Array.from(buttons);
        
        // Function to get the current --s variable value as a number
        const getSUnit = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--s')) || 75;

        buttons.forEach((button, index) => {
            
            button.addEventListener('mouseenter', () => {
                const targetIndex = index;
                
                // --- KEY CHANGES HERE ---
                const basePush = getSUnit() * 0.4; // Base push for the nearest neighbor
                const falloffBase = 0.5; // Falloff ratio. 0.5 = 50% falloff per button
                // --- END KEY CHANGES ---

                // --- 1. SCROLL INTO VIEW ---
                const containerRect = scrollContainer.getBoundingClientRect();
                const buttonRect = button.getBoundingClientRect();
                
                // Check if button is fully visible within the container
                // Adding a 1px buffer for safety
                const isTopVisible = buttonRect.top >= containerRect.top - 1;
                const isBottomVisible = buttonRect.bottom <= containerRect.bottom + 1;

                if (!isTopVisible || !isBottomVisible) {
                    // This will scroll the parent container (.b-c)
                    // to make the button visible.
                    button.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }

                // --- 2. APPLY CUMULATIVE PUSH ---
                let cumulativePushDown = 0;
                let cumulativePushUp = 0;

                // Iterate downwards from the hovered button
                for (let i = targetIndex + 1; i < buttonArray.length; i++) {
                    const distance = i - targetIndex; // 1, 2, 3...
                    const falloff = Math.pow(falloffBase, distance - 1); // 1, 0.5, 0.25...
                    const push = basePush * falloff;
                    cumulativePushDown += push;
                    buttonArray[i].style.transform = `translateY(${cumulativePushDown}px)`;
                }

                // Iterate upwards from the hovered button
                for (let i = targetIndex - 1; i >= 0; i--) {
                    const distance = targetIndex - i; // 1, 2, 3...
                    const falloff = Math.pow(falloffBase, distance - 1); // 1, 0.5, 0.25...
                    const push = basePush * falloff;
                    cumulativePushUp -= push; // Negative to push up
                    buttonArray[i].style.transform = `translateY(${cumulativePushUp}px)`;
                }

                // Ensure the hovered button itself is not translated
                if (button.style.transform) {
                     button.style.transform = '';
                }
            });
            
            button.addEventListener('mouseleave', () => {
                // When the mouse leaves, reset all buttons
                buttons.forEach(btn => {
                    btn.style.transform = ''; // Reset to CSS default (lets :hover scale work)
                });
            });
        });

        // Add a mouseleave listener to the *container* as a fallback
        // to reset all buttons if the mouse leaves the whole area.
        scrollContainer.addEventListener('mouseleave', () => {
             buttons.forEach(btn => {
                btn.style.transform = '';
            });
        });
    }

    // --- Event Listeners Setup ---
    function setupEventListeners() {
        // Window Resize
        window.addEventListener('resize', debounce(() => {
            if (state.twoJsCanvas) {
                applyBlurEffect(clampColorLightness(state.currentAnimatedBackgroundColor)); // Clamp on resize too
                state.twoJsCanvas.style.width = '100%';
                state.twoJsCanvas.style.height = '100%';
            }
        }, 250));

        // Page Visibility
        document.addEventListener('visibilitychange', handleVisibilityChange, false);
        
        // Setup the button hover logic
        setupJigglyButtonEffects();
    }

    // --- Initial Calls ---
    if (state.twoJsCanvas) applyBlurEffect(state.currentAnimatedBackgroundColor); // Initial bg might not be clamped yet, okay for first draw
    applyPostProcessingFilters();
    setupEventListeners(); // This will now also call setupJigglyButtonEffects
    initializeOldMenuSelectors();
    handleOldMenuLastFmUpdate(null);
    loadDefaultColors(); // Clamps defaults
    fetchLastFmData(); // Fetches and clamps Last.fm colors
    resetLastFmInterval();
});