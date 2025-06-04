document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('scene-container');
    if (!container) {
        console.error("Scene container not found!");
        return;
    }

    // UI Elements
    const onScreenShapeCountDisplay = document.getElementById('on-screen-shape-count');
    const onScreenTransitionShapeCountDisplay = document.getElementById('on-screen-transition-shape-count'); // For displaying transition shape count
    const fpsDisplay = document.getElementById('fps-counter');
    const blurToggle = document.getElementById('blur-toggle');
    const blurIntensitySlider = document.getElementById('blur-intensity-slider'); 
    const blurIntensityValueDisplay = document.getElementById('blur-intensity-value'); 
    const debugMenu = document.getElementById('debug-menu');
    const debugMenuTitle = document.getElementById('debug-menu-title');
    const debugMenuCloseBtn = document.getElementById('debug-menu-close-btn');
    const debugMenuCollapseBtn = document.getElementById('debug-menu-collapse-btn');
    const titleTextDragArea = debugMenuTitle.querySelector('.title-text-drag-area');
    const pauseResumeBtn = document.getElementById('pause-resume-btn');
    const deleteAllShapesBtn = document.getElementById('delete-all-shapes-btn'); 
    const colorPaletteControlsContainer = document.getElementById('color-palette-controls');
    const backgroundColorPicker = document.getElementById('background-color-picker');
    const numShapesSlider = document.getElementById('num-shapes-slider');
    const numShapesValueDisplay = document.getElementById('num-shapes-value');
    const scaleSlider = document.getElementById('scale-slider');
    const scaleValueDisplay = document.getElementById('scale-value');
    const rotationSlider = document.getElementById('rotation-slider');
    const rotationValueDisplay = document.getElementById('rotation-value');
    const speedSlider = document.getElementById('speed-slider');
    const speedValueDisplay = document.getElementById('speed-value');
    
    const numTransitionShapesSlider = document.getElementById('num-transition-shapes-slider');
    const numTransitionShapesValueDisplay = document.getElementById('num-transition-shapes-value');
    // Post-processing UI Elements
    const brightnessSlider = document.getElementById('brightness-slider');
    const brightnessValueDisplay = document.getElementById('brightness-value');
    const contrastSlider = document.getElementById('contrast-slider');
    const contrastValueDisplay = document.getElementById('contrast-value');
    const saturationSlider = document.getElementById('saturation-slider');
    const saturationValueDisplay = document.getElementById('saturation-value');
    const hueRotateSlider = document.getElementById('hue-rotate-slider');
    const hueRotateValueDisplay = document.getElementById('hue-rotate-value');
    // --- Last.fm UI Elements (moved inside DOMContentLoaded) ---
    // Last.fm UI Elements
    const lastfmLoadingDiv = document.getElementById('lastfm-loading');
    const lastfmErrorDiv = document.getElementById('lastfm-error');
    const lastfmNowPlayingDiv = document.getElementById('lastfm-nowplaying');
    const lastfmNotPlayingDiv = document.getElementById('lastfm-notplaying');
    const lastfmAlbumArtImg = document.getElementById('lastfm-album-art');
    const lastfmTrackDiv = document.getElementById('lastfm-track');
    const lastfmArtistDiv = document.getElementById('lastfm-artist');
    const lastfmAlbumDiv = document.getElementById('lastfm-album');
    const fetchLastFmBtn = document.getElementById('fetch-lastfm-btn');

    const cornerImage = document.querySelector('.corner-image');
    // Blur layer elements
    const blurLayer1 = document.getElementById('blur-layer-1');
    const canvasHost = document.getElementById('canvas-host'); // Innermost div, canvas parent
    let twoJsCanvas = null; 
    let isDragging = false;
    let dragStartX, dragStartY; 
    let menuInitialX, menuInitialY; 

    const DEFAULT_MENU_TOP = '20px'; 
    const DEFAULT_MENU_LEFT = '20px'; 

    let currentNumShapes = 60; 
    let currentScaleMultiplier = 1.0;
    let currentRotationSpeedMultiplier = 1.0;
    let currentMovementSpeedMultiplier = 1.0;
    let currentNumTransitionShapes = 10; // Default, will be synced with slider
    let currentBlurIntensity = 200; // Default blur intensity changed to 200px

    // Post-processing state variables
    let currentBrightness = 40; // %
    let currentContrast = 70;   // %
    let currentSaturation = 200; // %
    let currentHueRotate = 0;    // deg
    
    const NUM_PALETTE_COLORS = 6;
    let colorPalette = []; 

    // Background Color Transition Variables
    let targetBackgroundColor = '#181818';   // The desired final background color
    let previousBackgroundColorForTransition = '#181818'; // The color we are transitioning FROM
    let currentAnimatedBackgroundColor = '#181818'; // The interpolated color during transition, or targetBackgroundColor if not transitioning
    const BACKGROUND_COLOR_TRANSITION_DURATION = 500; // ms
    let backgroundColorTransitionStartTime = 0;
    let isBackgroundTransitioning = false;
    // --- Last.fm Integration Variables (moved inside DOMContentLoaded) ---
    // Variables to track state for applyBlurEffect optimization
    let prevAnimatedBgColorForBlur = currentAnimatedBackgroundColor;
    let prevBlurToggleState = blurToggle.checked;
    let prevBlurIntensityForBlur = currentBlurIntensity;

    const LASTFM_API_URL = 'https://lastfm-red-surf-3b97.damp-unit-21f3.workers.dev/';
    const LASTFM_POLL_INTERVAL = 15000; // 15 seconds
    let lastfmPollIntervalId = null;
    let currentAlbumArtUrl = ''; // Store the current album art URL to detect changes
    const colorThief = new ColorThief(); // Instantiate ColorThief
    let initialSceneSetupPerformed = false;
    let firstLastFmColorChangeDone = false; // New flag to track the first color change
    let lastFmColorsExtractedSuccessfully = false; // Flag to track successful color extraction
    let firstLastFmFetchAttempted = false; // Flag to ensure first API call is made before defaulting
    let lastFmArtProcessing = false; // Flag to indicate if Last.fm album art is currently being processed
    const REINIT_BATCH_DIVISOR = 30; // Process 1/30th of shapes per frame for re-initialization
    const DEFAULT_IMAGE_URL = '/assets/bgimg/newsquare7_512.png'; // Path to your default image
    let defaultBackgroundColor = '#121212'; // Will be updated from default image
    let defaultColorsLoaded = false; // New flag
    let defaultColorPalette = []; // Will be updated from default image

    // Corner image tap tracking for debug menu
    let cornerImageTapCount = 0;
    let lastCornerImageTapTime = 0;
    const TAP_INTERVAL_THRESHOLD = 700; // Taps must be within 700ms of each other
    const REQUIRED_TAPS_FOR_DEBUG = 7;

    let dynamicBlurLayers = []; // To store dynamically created blur layers
    const MAX_BLUR_PER_LAYER = 50; // Max blur (px) per individual layer

    // --- START: Old Menu Integration ---
    const OLD_MENU_FAVICON_BASE_SRC = '/assets/favicon/full_blue_trans_square_128.png';

    let oldMenuLastFmButton = null;
    let oldMenuSignatureSVGs = null;
    let oldMenuLinkElements = null;
    let oldMenuFaviconLink = null;
    let oldMenuThemeColorMeta = null;

    function initializeOldMenuSelectors() {
        oldMenuLastFmButton = document.getElementById('lastfm-button');
        oldMenuSignatureSVGs = document.querySelectorAll('.signature-container .signature');
        oldMenuLinkElements = document.querySelectorAll('.b-c .b'); // Selects all .b under .b-c
        oldMenuFaviconLink = document.querySelector('link[rel="icon"]');
        oldMenuThemeColorMeta = document.querySelector('meta[name="theme-color"]');
    }

    // Removed adjustOldMenuColor as it's no longer needed for static old menu colors.

    // --- HSL Color Conversion Helpers ---
    function hexToHSL(hex) {
        const rgb = hexToRgb(hex); // Assumes hexToRgb returns {r, g, b} in 0-255
        let r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
            h = s = 0; // achromatic
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return { h: h * 360, s: s, l: l }; // h in degrees 0-360, s/l in 0-1
    }

    function hslToHex(h, s, l) {
        let r, g, b;
        h /= 360; // Convert h to 0-1 range
        if (s === 0) {
            r = g = b = l; // achromatic
        } else {
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
        return rgbToHex(r * 255, g * 255, b * 255); // Assumes rgbToHex takes 0-255
    }

    function updateOldMenuElementsStyle() {
        const baseColorHex = currentAnimatedBackgroundColor || '#121212'; // Use current animated background
        const hslColor = hexToHSL(baseColorHex);
        
        // Set desired lightness and saturation for the menu text/signature.
        // Saturation is capped at 1.0 (100%) in the HSL model.
        const targetLightness = 0.85; // 90% brightness
        const targetSaturation = 1.0; // Max saturation (interpreting "200%" as fully saturated in HSL)
        const finalColorHex = hslToHex(hslColor.h, targetSaturation, targetLightness);

        if (oldMenuLinkElements) {
            oldMenuLinkElements.forEach(el => el.style.color = finalColorHex);
        }
        if (oldMenuSignatureSVGs) {
            oldMenuSignatureSVGs.forEach(svg => {
                const filledElements = svg.querySelectorAll('path, circle, rect, polygon, ellipse, line, .cls-1');
                filledElements.forEach(element => {
                    element.style.fill = finalColorHex;
                });
            });
        }
    }

    function updateOldMenuThemeMetaTag() {
        // Set a fixed theme color, e.g., the site's default background or black
        if (oldMenuThemeColorMeta) {
            oldMenuThemeColorMeta.content = currentAnimatedBackgroundColor || '#000000';
        }
    }

    // --- Color Helper Functions ---
    function hexToRgb(hex) { 
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16)
        } : { r: 24, g: 24, b: 24 }; 
    }
    function componentToHex(c) {
        const hex = Math.round(c).toString(16); 
        return hex.length == 1 ? "0" + hex : hex;
    }
    function rgbToHex(r, g, b) {
        return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
    }
    function getRandomHexColor() {
        return rgbToHex(Math.floor(Math.random() * 256), Math.floor(Math.random() * 256), Math.floor(Math.random() * 256));
    }

    // --- Initialize UI ---
    // UI elements like color pickers and sliders will be fully initialized
    // by performInitialSceneSetupIfNeeded based on Last.fm data or defaults.
    function initializeColorPaletteUI(useRandomForInitial = false) { // Changed default to false
        colorPaletteControlsContainer.innerHTML = '';
        const FIXED_NON_RANDOM_FALLBACK = '#CCCCCC'; // Fallback if no other color source

        for (let i = 0; i < NUM_PALETTE_COLORS; i++) {
            let finalColorForUISlot;

            if (colorPalette[i]) {
                // If a color already exists in the master palette for this slot, use it.
                finalColorForUISlot = colorPalette[i];
            } else {
                // No color in the master palette for this slot.
                // Decide what to put based on useRandomForInitial.
                if (useRandomForInitial) {
                    // Explicitly told to use random for initial population of empty slots
                    finalColorForUISlot = getRandomHexColor();
                } else {
                    // Not using random: try to use corresponding defaultColorPalette slot,
                    // or fall back to a fixed color if defaultColorPalette is also sparse.
                    if (defaultColorPalette && defaultColorPalette[i]) {
                        finalColorForUISlot = defaultColorPalette[i];
                    } else {
                        finalColorForUISlot = FIXED_NON_RANDOM_FALLBACK;
                    }
                }
                colorPalette[i] = finalColorForUISlot; // Update the master palette
            }

            const group = document.createElement('div');
            group.classList.add('color-input-group');
            const label = document.createElement('label');
            label.setAttribute('for', `color-picker-${i}`);
            label.textContent = `Color ${i + 1}:`;
            const input = document.createElement('input');
            input.setAttribute('type', 'color');
            input.setAttribute('id', `color-picker-${i}`);
            input.value = finalColorForUISlot; // Set the UI color picker value
            input.dataset.index = i;
            input.addEventListener('input', (e) => {
                const colorIndex = parseInt(e.target.dataset.index);
                const newHexColor = e.target.value;
                // const oldHexColor = colorPalette[colorIndex]; // oldHexColor not used
                colorPalette[colorIndex] = newHexColor; // Update the master palette
            });
            group.appendChild(label);
            group.appendChild(input);
            colorPaletteControlsContainer.appendChild(group);
        }
    }
    // Initial background color values will be set by default image loading or Last.fm
    targetBackgroundColor = '#121212'; // Temporary default
    previousBackgroundColorForTransition = '#121212'; // Temporary default
    currentAnimatedBackgroundColor = '#121212';
    
    // backgroundColorPicker.value will be set by performInitialSceneSetupIfNeeded
    
    numShapesSlider.value = currentNumShapes;
    numShapesValueDisplay.textContent = currentNumShapes;
    scaleSlider.value = currentScaleMultiplier;
    scaleValueDisplay.textContent = currentScaleMultiplier.toFixed(1);
    rotationSlider.value = currentRotationSpeedMultiplier;
    rotationValueDisplay.textContent = currentRotationSpeedMultiplier.toFixed(1);
    speedSlider.value = currentMovementSpeedMultiplier;
    speedValueDisplay.textContent = currentMovementSpeedMultiplier.toFixed(1);
    blurIntensitySlider.value = currentBlurIntensity;

    if (numTransitionShapesSlider) {
        numTransitionShapesSlider.value = currentNumTransitionShapes;
        if (numTransitionShapesValueDisplay) {
            numTransitionShapesValueDisplay.textContent = currentNumTransitionShapes;
        }
        numTransitionShapesSlider.addEventListener('input', (e) => {
            currentNumTransitionShapes = parseInt(e.target.value);
            if (numTransitionShapesValueDisplay) {
                numTransitionShapesValueDisplay.textContent = currentNumTransitionShapes;
            }
        });
    }
    blurIntensityValueDisplay.textContent = currentBlurIntensity;
    // NOTE: Ensure in your HTML, the blur-intensity-slider has max="300"
    // e.g., <input type="range" id="blur-intensity-slider" min="0" max="300" value="200">

    brightnessSlider.value = currentBrightness;
    brightnessValueDisplay.textContent = currentBrightness;
    contrastSlider.value = currentContrast;
    contrastValueDisplay.textContent = currentContrast;
    saturationSlider.value = currentSaturation; // Update slider to new default
    saturationValueDisplay.textContent = currentSaturation;
    hueRotateSlider.value = currentHueRotate;
    hueRotateValueDisplay.textContent = currentHueRotate;
    // NOTE: Ensure in your HTML, the saturation-slider has max="400"
    // e.g., <input type="range" id="saturation-slider" min="0" max="400" value="200">


    const BASE_MIN_ROTATION_SPEED = 0.002; 
    const BASE_MAX_ROTATION_SPEED = 0.01;
    const BASE_MIN_SPEED = 0.5; 
    const BASE_MAX_SPEED = 2.5;
    const SHAPE_TYPES = ['roundedRectangle', 'circle', 'ellipse', 'organic']; 
    
    const params = {
        type: Two.Types.webgl, 
        width: window.innerWidth,
        height: window.innerHeight,
        autostart: true 
    };
    const two = new Two(params).appendTo(canvasHost); // Append to the new innermost host
    let isPaused = false;
    
    if (two.renderer && two.renderer.domElement) {
        twoJsCanvas = two.renderer.domElement;
        // twoJsCanvas.style.backgroundColor will be handled by applyBlurEffect
    } else {
        console.error("Two.js canvas element not found after initialization.");
        twoJsCanvas = container.querySelector('canvas');
         // if (twoJsCanvas) { /* its background will be handled by applyBlurEffect */ }
    }

    function applyBlurEffect(bgColorToApply) {
        if (!twoJsCanvas || !canvasHost || !blurLayer1) {
            console.warn("applyBlurEffect: Missing essential elements (twoJsCanvas, canvasHost, or blurLayer1).");
            return;
        }

        // 1. Clear previously created dynamic blur layers
        dynamicBlurLayers.forEach(layer => layer.remove());
        dynamicBlurLayers = [];

        // 2. Reset styles for blurLayer1 (outermost scaler) and canvasHost (innermost, bg + final blur)
        blurLayer1.style.filter = 'none';
        blurLayer1.style.backgroundColor = 'transparent';
        blurLayer1.style.width = '100%';
        blurLayer1.style.height = '100%';
        blurLayer1.style.top = '0';
        blurLayer1.style.left = '0';
        blurLayer1.style.willChange = 'auto';

        // Ensure canvasHost is a direct child of blurLayer1 for the reset state
        if (canvasHost.parentElement !== blurLayer1) {
            blurLayer1.appendChild(canvasHost);
        }

        canvasHost.style.filter = 'none';
        canvasHost.style.backgroundColor = 'transparent'; // Will be set based on blur state
        canvasHost.style.willChange = 'auto';
        // canvasHost dimensions are implicitly 100% of its parent.

        // twoJsCanvas (the actual Two.js drawing surface) is always transparent
        twoJsCanvas.style.backgroundColor = 'transparent';
        twoJsCanvas.style.filter = 'none'; // Canvas itself never gets a direct filter

        // 3. Apply new blur effect if enabled
        if (blurToggle.checked && currentBlurIntensity > 0) {
            // BLUR IS ON
            // Scale blurLayer1 to provide an oversized area, preventing hard edges from blur.
            blurLayer1.style.width = '104%';
            blurLayer1.style.height = '104%';
            blurLayer1.style.top = '-2%';
            blurLayer1.style.left = '-2%';

            let remainingBlur = currentBlurIntensity;
            let currentParentForNextLayer = blurLayer1;

            // Create intermediate blur layers if needed
            while (remainingBlur > MAX_BLUR_PER_LAYER) {
                const dynamicLayer = document.createElement('div');
                dynamicLayer.style.position = 'absolute';
                dynamicLayer.style.width = '100%';
                dynamicLayer.style.height = '100%';
                dynamicLayer.style.top = '0';
                dynamicLayer.style.left = '0';
                dynamicLayer.style.backgroundColor = 'transparent';
                dynamicLayer.style.filter = `blur(${MAX_BLUR_PER_LAYER}px)`;
                dynamicLayer.style.willChange = 'filter'; // Hint for performance

                currentParentForNextLayer.appendChild(dynamicLayer);
                dynamicBlurLayers.push(dynamicLayer);
                currentParentForNextLayer = dynamicLayer;

                remainingBlur -= MAX_BLUR_PER_LAYER;
            }

            // canvasHost gets the background color and any final remaining blur
            canvasHost.style.backgroundColor = bgColorToApply;
            if (remainingBlur > 0) {
                canvasHost.style.filter = `blur(${remainingBlur}px)`;
                canvasHost.style.willChange = 'filter';
            }

            // Ensure canvasHost is a child of the innermost blur layer (or blurLayer1 if no dynamic layers created)
            if (canvasHost.parentElement !== currentParentForNextLayer) {
                currentParentForNextLayer.appendChild(canvasHost);
            }
        } else {
            // BLUR IS OFF
            // blurLayer1 is reset to normal size (done at the start).
            // canvasHost gets the main background color, no blur.
            canvasHost.style.backgroundColor = bgColorToApply;
            // canvasHost.parentElement is already blurLayer1 from the reset logic.
        }
    }

    if (twoJsCanvas) { // Initial call
        applyBlurEffect(currentAnimatedBackgroundColor);
    } else { // Fallback if canvas not immediately available
        console.warn("Two.js canvas not found for initial blur effect application. Blur effect might not apply correctly until canvas is ready.");
    }

    // --- Event Listeners ---
    blurToggle.addEventListener('change', () => applyBlurEffect(currentAnimatedBackgroundColor));
    blurIntensitySlider.addEventListener('input', (e) => {
        currentBlurIntensity = parseInt(e.target.value);
        blurIntensityValueDisplay.textContent = currentBlurIntensity;
        applyBlurEffect(currentAnimatedBackgroundColor); 
    });
    backgroundColorPicker.addEventListener('input', (e) => {
        previousBackgroundColorForTransition = currentAnimatedBackgroundColor;
        targetBackgroundColor = e.target.value;
        backgroundColorTransitionStartTime = performance.now();
        isBackgroundTransitioning = true;
        spawnTransitionShapes(); // Spawn transition shapes
        // The animation loop will call applyBlurEffect
    });
    numShapesSlider.addEventListener('input', (e) => {
        currentNumShapes = parseInt(e.target.value);
        numShapesValueDisplay.textContent = currentNumShapes;
        adjustShapesArray(); 
    });

    brightnessSlider.addEventListener('input', (e) => {
        currentBrightness = parseInt(e.target.value);
        brightnessValueDisplay.textContent = currentBrightness;
        applyPostProcessingFilters();
    });
    contrastSlider.addEventListener('input', (e) => {
        currentContrast = parseInt(e.target.value);
        contrastValueDisplay.textContent = currentContrast;
        applyPostProcessingFilters();
    });
    saturationSlider.addEventListener('input', (e) => {
        currentSaturation = parseInt(e.target.value);
        saturationValueDisplay.textContent = currentSaturation;
        applyPostProcessingFilters();
    });
    hueRotateSlider.addEventListener('input', (e) => {
        currentHueRotate = parseInt(e.target.value);
        hueRotateValueDisplay.textContent = currentHueRotate;
        applyPostProcessingFilters();
    });








    scaleSlider.addEventListener('input', (e) => {
        currentScaleMultiplier = parseFloat(e.target.value);
        scaleValueDisplay.textContent = currentScaleMultiplier.toFixed(1);
    });
    rotationSlider.addEventListener('input', (e) => {
        currentRotationSpeedMultiplier = parseFloat(e.target.value);
        rotationValueDisplay.textContent = currentRotationSpeedMultiplier.toFixed(1);
    });
    speedSlider.addEventListener('input', (e) => {
        currentMovementSpeedMultiplier = parseFloat(e.target.value);
        speedValueDisplay.textContent = currentMovementSpeedMultiplier.toFixed(1);
    });
    pauseResumeBtn.addEventListener('click', () => {
        isPaused = !isPaused;
        if (isPaused) { two.pause(); pauseResumeBtn.textContent = 'Resume Animation';} 
        else { two.play(); pauseResumeBtn.textContent = 'Pause Animation'; }
    });
    deleteAllShapesBtn.addEventListener('click', () => {
        while (shapesData.length > 0) {
            const shapeDataToRemove = shapesData.pop();
            if (shapeDataToRemove.twoShape) two.remove(shapeDataToRemove.twoShape);
        }
        if (onScreenShapeCountDisplay) onScreenShapeCountDisplay.textContent = '0';
        adjustShapesArray(); 
    });

    // --- Menu Interaction Logic ---
    if (debugMenuTitle && debugMenu && debugMenuCloseBtn && debugMenuCollapseBtn && titleTextDragArea) {
        titleTextDragArea.addEventListener('mousedown', (e) => {
            e.preventDefault(); isDragging = true; debugMenu.classList.add('dragging'); 
            dragStartX = e.clientX; dragStartY = e.clientY;
            menuInitialX = debugMenu.offsetLeft; menuInitialY = debugMenu.offsetTop;
            document.addEventListener('mousemove', onDrag);
            document.addEventListener('mouseup', onDragEnd);
        });
        debugMenuCollapseBtn.addEventListener('click', (e) => { e.stopPropagation(); debugMenu.classList.toggle('collapsed'); });
        debugMenuCloseBtn.addEventListener('click', (e) => { e.stopPropagation(); debugMenu.classList.add('menu-hidden'); });
    }
    document.addEventListener('keydown', (e) => {
        if (e.key === '\\') {
            const wasHidden = debugMenu.classList.contains('menu-hidden');
            debugMenu.classList.toggle('menu-hidden');
            if (wasHidden && !debugMenu.classList.contains('menu-hidden')) {
                debugMenu.style.top = DEFAULT_MENU_TOP; debugMenu.style.left = DEFAULT_MENU_LEFT;
                debugMenu.classList.remove('collapsed'); 
            }
        }
    });
    function onDrag(e) {
        if (!isDragging) return;
        const dx = e.clientX - dragStartX; const dy = e.clientY - dragStartY;
        let newLeft = menuInitialX + dx; let newTop = menuInitialY + dy;
        const maxLeft = window.innerWidth - debugMenu.offsetWidth;
        const maxTop = window.innerHeight - debugMenu.offsetHeight;
        newLeft = Math.max(0, Math.min(newLeft, maxLeft)); newTop = Math.max(0, Math.min(newTop, maxTop));
        debugMenu.style.left = newLeft + 'px'; debugMenu.style.top = newTop + 'px';
    }
    function onDragEnd() {
        if (!isDragging) return;
        isDragging = false; debugMenu.classList.remove('dragging');
        document.removeEventListener('mousemove', onDrag);
        document.removeEventListener('mouseup', onDragEnd);
    }
    
    function applyPostProcessingFilters() {
        if (!container) return; // scene-container

        let filters = [];
        if (currentBrightness !== 100) filters.push(`brightness(${currentBrightness}%)`);
        if (currentContrast !== 100) filters.push(`contrast(${currentContrast}%)`);
        if (currentSaturation !== 100) filters.push(`saturate(${currentSaturation}%)`);
        if (currentHueRotate !== 0) filters.push(`hue-rotate(${currentHueRotate}deg)`);

        if (filters.length > 0) {
            container.style.filter = filters.join(' ');
        } else {
            container.style.filter = 'none';
        }
    }

    const shapesData = []; 
    const transitionShapesData = []; // Array to hold transition shapes
    let lastTime = performance.now(); 
    let frameCountForFPS = 0;
    const fpsUpdateInterval = 1000; 
    let timeSinceLastFPSUpdate = 0;

    function getRandomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
    function getRandomFloat(min, max) { return Math.random() * (max - min) + min; }

    const spawnConfigurations = [
        { getX: (w, h, o) => -o, getY: (w, h, o) => getRandomFloat(0, h), getVX: (s) => s, getVY: (s) => getRandomFloat(-s * 0.3, s * 0.3)},
        { getX: (w, h, o) => getRandomFloat(0, w), getY: (w, h, o) => -o, getVX: (s) => getRandomFloat(-s * 0.3, s * 0.3), getVY: (s) => s},
        // Added right and bottom spawn points
        // { getX: (w, h, o) => w + o, getY: (w, h, o) => getRandomFloat(0, h), getVX: (s) => -s, getVY: (s) => getRandomFloat(-s * 0.3, s * 0.3)},
        { getX: (w, h, o) => w + o, getY: (w, h, o) => getRandomFloat(0, h), getVX: (s) => -s, getVY: (s) => getRandomFloat(-s * 0.3, s * 0.3)},
        { getX: (w, h, o) => getRandomFloat(0, w), getY: (w, h, o) => h + o, getVX: (s) => getRandomFloat(-s * 0.3, s * 0.3), getVY: (s) => -s}
    ];

    function initializeShape(shapeData) {
        if (shapeData.twoShape) two.remove(shapeData.twoShape);
        shapeData.needsReinitialization = false; // Reset reinitialization state
        const shapeType = SHAPE_TYPES[getRandomInt(0, SHAPE_TYPES.length - 1)];
        const minScreenDim = Math.min(two.width, two.height) || 600; // Fallback if dimensions are 0, e.g. initial load
        const baseSize = getRandomFloat(minScreenDim * 0.50, minScreenDim * 1.10) * currentScaleMultiplier; // Doubled default size range
        
        // Use existing paletteIndex if available, otherwise assign a new one.
        // This is crucial for replacement logic to pick up the correct new color.
        if (typeof shapeData.paletteIndex === 'undefined' || shapeData.paletteIndex >= colorPalette.length || colorPalette.length === 0) {
            shapeData.paletteIndex = colorPalette.length > 0 ? getRandomInt(0, colorPalette.length - 1) : 0;
        }
        const initialColorHex = (colorPalette.length > 0 ? colorPalette[shapeData.paletteIndex] : '#CCCCCC') || '#CCCCCC';
        let newTwoShape; let approxWidth, approxHeight; 
        switch (shapeType) {
            case 'circle':
                approxWidth = approxHeight = Math.max(10, baseSize);
                newTwoShape = two.makeCircle(0, 0, approxWidth / 2);
                break;
            case 'ellipse':
                approxWidth = Math.max(10, baseSize);
                approxHeight = Math.max(10, baseSize * getRandomFloat(0.5, 1.5));
                newTwoShape = two.makeEllipse(0, 0, approxWidth / 2, approxHeight / 2);
                break;
            case 'roundedRectangle':
                approxWidth = Math.max(10, baseSize);
                approxHeight = Math.max(10, baseSize * getRandomFloat(0.7, 1.3));
                const cornerRadius = Math.min(approxWidth, approxHeight) * 0.35;
                newTwoShape = two.makeRoundedRectangle(0, 0, approxWidth, approxHeight, cornerRadius);
                break;
            case 'organic':
                const numVertices = getRandomInt(5, 10); // Number of points for the organic shape
                const anchors = [];
                const avgRadius = baseSize / 2; // Target average radius
                for (let i = 0; i < numVertices; i++) {
                    const baseAngle = (i / numVertices) * Math.PI * 2;
                    const angleOffset = (Math.PI * 2 / numVertices) * getRandomFloat(-0.4, 0.4); // Randomize angle slightly
                    const angle = baseAngle + angleOffset;
                    const radius = avgRadius * getRandomFloat(0.5, 1.5); // Vary radius for each point
                    const x = Math.cos(angle) * radius;
                    const y = Math.sin(angle) * radius;
                    anchors.push(new Two.Anchor(x, y));
                }
                newTwoShape = new Two.Path(anchors, true, true, false); // (vertices, closed, curved, manual=false)
                approxWidth = baseSize; // Approximation for culling
                approxHeight = baseSize; // Approximation for culling
                break;
            default: // Fallback, though all SHAPE_TYPES should be handled
                console.warn("Unknown shape type in initializeShape, defaulting to roundedRectangle:", shapeType);
                approxWidth = Math.max(10, baseSize);
                approxHeight = Math.max(10, baseSize * getRandomFloat(0.7, 1.3));
                const defaultCornerRadius = Math.min(approxWidth, approxHeight) * 0.35;
                newTwoShape = two.makeRoundedRectangle(0, 0, approxWidth, approxHeight, defaultCornerRadius);
                break;
        }

        // Removed feathering/gradient logic. Shapes will now have a solid fill.
        // The canvas-wide blur (if enabled) will blur these solid shapes.
        newTwoShape.opacity = 1; // Ensure new/recycled shapes are fully visible
        newTwoShape.fill = initialColorHex;

        newTwoShape.noStroke(); newTwoShape.rotation = getRandomFloat(0, Math.PI * 2);
        shapeData.twoShape = newTwoShape; // shapeData.paletteIndex is already set
        shapeData.rotationSpeed = getRandomFloat(BASE_MIN_ROTATION_SPEED, BASE_MAX_ROTATION_SPEED) * currentRotationSpeedMultiplier * (Math.random() > 0.5 ? 1 : -1);
        shapeData.approxWidth = approxWidth; shapeData.approxHeight = approxHeight; // Store dimensions
        const speed = getRandomFloat(BASE_MIN_SPEED, BASE_MAX_SPEED) * currentMovementSpeedMultiplier;
        const offScreenOffset = Math.max(approxWidth, approxHeight) * 0.7; 
        const spawnConfig = spawnConfigurations[getRandomInt(0, spawnConfigurations.length - 1)];
        newTwoShape.translation.set(spawnConfig.getX(two.width, two.height, offScreenOffset), spawnConfig.getY(two.width, two.height, offScreenOffset));
        shapeData.vx = spawnConfig.getVX(speed); shapeData.vy = spawnConfig.getVY(speed);
        if (!newTwoShape.parent) two.add(newTwoShape);
    }
    
    function initializeTransitionShape(shapeData) {
        // If a twoShape already exists (e.g., from a previous quick transition), remove it.
        if (shapeData.twoShape && shapeData.twoShape.parent) {
            two.remove(shapeData.twoShape);
        }
        shapeData.twoShape = null; // Clear old reference

        const shapeType = SHAPE_TYPES[getRandomInt(0, SHAPE_TYPES.length - 1)];
        const minScreenDim = Math.min(two.width, two.height) || 600;
        // Make transition shapes 1.5x bigger than normal shapes on average.
        // Normal shapes: minScreenDim * 0.50 to minScreenDim * 1.10
        // Transition shapes: (minScreenDim * 0.50 * 1.5) to (minScreenDim * 1.10 * 1.5)
        const baseSize = getRandomFloat(minScreenDim * 0.75, minScreenDim * 1.65) * currentScaleMultiplier;

        // Transition shapes use the current global colorPalette
        shapeData.paletteIndex = colorPalette.length > 0 ? getRandomInt(0, colorPalette.length - 1) : 0;
        const initialColorHex = (colorPalette.length > 0 ? colorPalette[shapeData.paletteIndex] : '#FFFFFF') || '#FFFFFF'; // Default to white if palette empty

        let newTwoShape; let approxWidth, approxHeight;
        switch (shapeType) {
            case 'circle':
                approxWidth = approxHeight = Math.max(5, baseSize); // Min size 5
                newTwoShape = two.makeCircle(0, 0, approxWidth / 2);
                break;
            case 'ellipse':
                approxWidth = Math.max(5, baseSize);
                approxHeight = Math.max(5, baseSize * getRandomFloat(0.5, 1.5));
                newTwoShape = two.makeEllipse(0, 0, approxWidth / 2, approxHeight / 2);
                break;
            case 'roundedRectangle':
                approxWidth = Math.max(5, baseSize);
                approxHeight = Math.max(5, baseSize * getRandomFloat(0.7, 1.3));
                const cornerRadius = Math.min(approxWidth, approxHeight) * 0.35;
                newTwoShape = two.makeRoundedRectangle(0, 0, approxWidth, approxHeight, cornerRadius);
                break;
            case 'organic':
                const numVertices = getRandomInt(4, 8); // Slightly simpler organic shapes
                const anchors = [];
                const avgRadius = baseSize / 2;
                for (let i = 0; i < numVertices; i++) {
                    const baseAngle = (i / numVertices) * Math.PI * 2;
                    const angleOffset = (Math.PI * 2 / numVertices) * getRandomFloat(-0.3, 0.3);
                    const angle = baseAngle + angleOffset;
                    const radius = avgRadius * getRandomFloat(0.6, 1.4);
                    const x = Math.cos(angle) * radius;
                    const y = Math.sin(angle) * radius;
                    anchors.push(new Two.Anchor(x, y));
                }
                newTwoShape = new Two.Path(anchors, true, true, false);
                approxWidth = baseSize;
                approxHeight = baseSize;
                break;
            default:
                approxWidth = Math.max(5, baseSize);
                approxHeight = Math.max(5, baseSize * getRandomFloat(0.7, 1.3));
                const defaultCornerRadius = Math.min(approxWidth, approxHeight) * 0.35;
                newTwoShape = two.makeRoundedRectangle(0, 0, approxWidth, approxHeight, defaultCornerRadius);
                break;
        }

        newTwoShape.fill = initialColorHex;
        newTwoShape.opacity = 0; // Start transparent, will fade in
        newTwoShape.noStroke();
        newTwoShape.rotation = getRandomFloat(0, Math.PI * 2);

        shapeData.twoShape = newTwoShape;
        shapeData.rotationSpeed = getRandomFloat(BASE_MIN_ROTATION_SPEED, BASE_MAX_ROTATION_SPEED) * currentRotationSpeedMultiplier * 1.5 * (Math.random() > 0.5 ? 1 : -1);
        shapeData.approxWidth = approxWidth;
        shapeData.approxHeight = approxHeight;
        const speed = getRandomFloat(BASE_MIN_SPEED, BASE_MAX_SPEED) * currentMovementSpeedMultiplier * 1.2; // Slightly faster

        // Spawn off-screen using a similar mechanism to regular shapes
        const offScreenOffset = Math.max(approxWidth, approxHeight) * 0.7;
        const spawnConfig = spawnConfigurations[getRandomInt(0, spawnConfigurations.length - 1)];
        newTwoShape.translation.set(spawnConfig.getX(two.width, two.height, offScreenOffset), spawnConfig.getY(two.width, two.height, offScreenOffset));
        shapeData.vx = spawnConfig.getVX(speed); shapeData.vy = spawnConfig.getVY(speed);
        shapeData.spawnTime = performance.now(); shapeData.isFadingIn = true;
        if (!newTwoShape.parent) two.add(newTwoShape);
    }
    function adjustShapesArray() {
        while (shapesData.length > currentNumShapes) { const shapeDataToRemove = shapesData.pop(); if (shapeDataToRemove.twoShape) two.remove(shapeDataToRemove.twoShape); }
        while (shapesData.length < currentNumShapes) { const shapeData = {}; shapesData.push(shapeData); initializeShape(shapeData); }
        // Ensure all shapes have a valid paletteIndex, especially if palette was empty initially
        // and colorPalette is now populated.
        if (colorPalette.length > 0) {
            shapesData.forEach(sd => { if (typeof sd.paletteIndex === 'undefined' || sd.paletteIndex >= colorPalette.length) initializeShape(sd); });
        }
    }

    function spawnTransitionShapes() {
        // Clear existing transition shapes
        while (transitionShapesData.length > 0) {
            const shapeDataToRemove = transitionShapesData.pop();
            if (shapeDataToRemove.twoShape && shapeDataToRemove.twoShape.parent) {
                two.remove(shapeDataToRemove.twoShape);
            }
        }

        for (let i = 0; i < currentNumTransitionShapes; i++) {
            const shapeData = {}; initializeTransitionShape(shapeData); transitionShapesData.push(shapeData);
        }
    }

    two.bind('update', (frameCount) => {
        if (isPaused) return; 
        const currentTime = performance.now(); const deltaTime = currentTime - lastTime; lastTime = currentTime;
        frameCountForFPS++; timeSinceLastFPSUpdate += deltaTime;
        let currentOnScreenShapes = 0;
        let currentOnScreenTransitionShapes = 0; // To count visible transition shapes

        // Background Color Transition Logic
        if (isBackgroundTransitioning) {
            const now = performance.now();
            const elapsedTime = now - backgroundColorTransitionStartTime;
            const progress = Math.min(elapsedTime / BACKGROUND_COLOR_TRANSITION_DURATION, 1);

            const prevRgb = hexToRgb(previousBackgroundColorForTransition);
            const targetRgb = hexToRgb(targetBackgroundColor);

            const r = prevRgb.r + (targetRgb.r - prevRgb.r) * progress;
            const g = prevRgb.g + (targetRgb.g - prevRgb.g) * progress;
            const b = prevRgb.b + (targetRgb.b - prevRgb.b) * progress;

            currentAnimatedBackgroundColor = rgbToHex(r, g, b);

            if (progress >= 1) {
                isBackgroundTransitioning = false;
                currentAnimatedBackgroundColor = targetBackgroundColor; // Ensure it ends on the exact target
            }

            // Update old menu elements style and theme meta tag based on currentAnimatedBackgroundColor
            updateOldMenuElementsStyle();
            updateOldMenuThemeMetaTag();
        }
        // Apply blur effect only if relevant properties have changed
        if (twoJsCanvas) {
            const blurStateChanged = currentAnimatedBackgroundColor !== prevAnimatedBgColorForBlur ||
                                     blurToggle.checked !== prevBlurToggleState ||
                                     currentBlurIntensity !== prevBlurIntensityForBlur;

            if (blurStateChanged) {
                applyBlurEffect(currentAnimatedBackgroundColor);
                prevAnimatedBgColorForBlur = currentAnimatedBackgroundColor;
                prevBlurToggleState = blurToggle.checked;
                prevBlurIntensityForBlur = currentBlurIntensity;
            }
        }


        shapesData.forEach(shapeData => {
            // If shape is already marked for re-initialization, or has no Two.js object, skip main processing.
            // It will be handled by the staggered re-initialization logic later.
            if (shapeData.needsReinitialization || !shapeData.twoShape) {
                return;
            }

            const shape = shapeData.twoShape; // Safe to access now

            // Movement and rotation for active shapes
            shape.translation.x += shapeData.vx * currentMovementSpeedMultiplier; shape.translation.y += shapeData.vy * currentMovementSpeedMultiplier; shape.rotation += shapeData.rotationSpeed * currentRotationSpeedMultiplier;
            
            // On-screen check for counting (only for shapes not yet removed/marked)
            const shapeHalfWidth = shapeData.approxWidth / 2; const shapeHalfHeight = shapeData.approxHeight / 2;
            const shapeLeft = shape.translation.x - shapeHalfWidth; const shapeRight = shape.translation.x + shapeHalfWidth;
            const shapeTop = shape.translation.y - shapeHalfHeight; const shapeBottom = shape.translation.y + shapeHalfHeight;
            if (shapeRight > 0 && shapeLeft < two.width && shapeBottom > 0 && shapeTop < two.height) currentOnScreenShapes++;
            
            // Off-screen check for re-initialization
            const resetBuffer = Math.max(shapeData.approxWidth, shapeData.approxHeight) * 0.7; 
            const isWayOffScreen = shape.translation.x < -resetBuffer || shape.translation.x > two.width + resetBuffer || shape.translation.y < -resetBuffer || shape.translation.y > two.height + resetBuffer;
            if (isWayOffScreen) {
                two.remove(shape);
                shapeData.twoShape = null;
                shapeData.needsReinitialization = true;
                return; // Done with this shape for this frame, marked for re-initialization
            }
        });

        // Staggered re-initialization of shapes marked as 'needsReinitialization'
        const maxReinitializationsThisFrame = Math.max(1, Math.floor(currentNumShapes / REINIT_BATCH_DIVISOR));
        let reinitializedThisFrameCount = 0;
        for (const sd of shapesData) {
            if (sd.needsReinitialization && reinitializedThisFrameCount < maxReinitializationsThisFrame) {
                initializeShape(sd); // This will create a new twoShape and clear needsReinitialization
                reinitializedThisFrameCount++;
            }
        }

        // --- Transition Shapes Update Loop ---
        const FADE_DURATION = 500; // ms for fade in/out of transition shapes
        // currentOnScreenTransitionShapes is reset at the start of the update loop

        for (let i = transitionShapesData.length - 1; i >= 0; i--) {
            const shapeData = transitionShapesData[i];
            const shape = shapeData.twoShape;
            if (!shape) {
                transitionShapesData.splice(i, 1); // Remove if no twoShape
                continue;
            }

            // If shape has some opacity, count it as visible
            if (shape.opacity > 0.01) { // Using a small threshold
                currentOnScreenTransitionShapes++;
            }

            const elapsedTimeSinceSpawn = currentTime - shapeData.spawnTime; // Define elapsedTimeSinceSpawn here
            // Fade In
            if (shapeData.isFadingIn) {
                const fadeInProgress = Math.min(elapsedTimeSinceSpawn / FADE_DURATION, 1);
                shape.opacity = fadeInProgress;
                if (fadeInProgress >= 1) {
                    shapeData.isFadingIn = false;
                }
            }

            // Movement and Rotation
            shape.translation.x += shapeData.vx * currentMovementSpeedMultiplier;
            shape.translation.y += shapeData.vy * currentMovementSpeedMultiplier;
            shape.rotation += shapeData.rotationSpeed * currentRotationSpeedMultiplier;

            // Off-screen check for removal
            const resetBuffer = Math.max(shapeData.approxWidth, shapeData.approxHeight) * 0.7; 
            const isWayOffScreen = shape.translation.x < -resetBuffer ||
                                   shape.translation.x > two.width + resetBuffer ||
                                   shape.translation.y < -resetBuffer ||
                                   shape.translation.y > two.height + resetBuffer;

            if (isWayOffScreen) {
                two.remove(shape);
                transitionShapesData.splice(i, 1);
                continue; 
            }
        }
        if (timeSinceLastFPSUpdate >= fpsUpdateInterval) {
            const fps = Math.round((frameCountForFPS * 1000) / timeSinceLastFPSUpdate);
            if (fpsDisplay) fpsDisplay.textContent = fps;
            if (onScreenShapeCountDisplay) onScreenShapeCountDisplay.textContent = currentOnScreenShapes;
            if (onScreenTransitionShapeCountDisplay) {
                onScreenTransitionShapeCountDisplay.textContent = currentOnScreenTransitionShapes;
            }
            frameCountForFPS = 0; timeSinceLastFPSUpdate = 0;
        }
        // Removed per-frame update of onScreenShapeCountDisplay.textContent here.
        // It's now updated with the FPS counter.
    });

    window.addEventListener('resize', () => {
        two.width = window.innerWidth; two.height = window.innerHeight;
        if (twoJsCanvas) {
            applyBlurEffect(currentAnimatedBackgroundColor); 
        }
        if (debugMenu.offsetLeft + debugMenu.offsetWidth > window.innerWidth) debugMenu.style.left = (window.innerWidth - debugMenu.offsetWidth) + 'px';
        if (debugMenu.offsetTop + debugMenu.offsetHeight > window.innerHeight) debugMenu.style.top = (window.innerHeight - debugMenu.offsetHeight) + 'px';
        if (debugMenu.offsetLeft < 0) debugMenu.style.left = '0px';
        if (debugMenu.offsetTop < 0) debugMenu.style.top = '0px';
    });

    // --- Last.fm Integration Functions (moved inside DOMContentLoaded) ---
    function updateLastFmUI(data) {
    lastfmLoadingDiv.style.display = 'none';
    lastfmErrorDiv.style.display = 'none';
    let useDefaultColors = false; // Flag to decide if default colors should be applied
    if (fetchLastFmBtn) fetchLastFmBtn.disabled = false; // Re-enable button
    if (!data || !data.recenttracks || !data.recenttracks.track || data.recenttracks.track.length === 0) {
        lastfmNowPlayingDiv.style.display = 'none';
        lastfmNotPlayingDiv.style.display = 'block';
        lastfmNotPlayingDiv.textContent = 'No recent tracks found.';
        // Explicitly reset content of hidden "now playing" elements
        lastfmTrackDiv.textContent = '-';
        lastfmArtistDiv.textContent = '-';
        lastfmAlbumDiv.textContent = '-';
        lastfmAlbumArtImg.src = '';
        lastfmAlbumArtImg.style.display = 'none';
        handleOldMenuLastFmUpdate(data); // Update old menu based on this state
        useDefaultColors = true; // Use default colors if no recent tracks
        return;
    }

    const track = data.recenttracks.track[0];
    if (track && track['@attr'] && track['@attr'].nowplaying === 'true') {
        lastfmNowPlayingDiv.style.display = 'flex';
        lastfmNotPlayingDiv.style.display = 'none';
        lastfmTrackDiv.textContent = track.name || 'Unknown Track';
        lastfmArtistDiv.textContent = track.artist['#text'] || 'Unknown Artist';
        lastfmAlbumDiv.textContent = track.album['#text'] || 'Unknown Album';
        
        const imageUrl = track.image.find(img => img.size === 'extralarge')['#text'] || // Prefer largest for better color analysis
                         track.image.find(img => img.size === 'large')['#text'] ||
                         track.image.find(img => img.size === 'medium')['#text'] || '';

        if (imageUrl) {
            if (imageUrl !== currentAlbumArtUrl) {
                lastfmAlbumArtImg.src = imageUrl; // Set src to trigger load
                lastfmAlbumArtImg.style.display = 'block'; // Show image
                currentAlbumArtUrl = imageUrl;
                extractAndApplyColorsFromAlbumArt(imageUrl);
            } else {
                 // Album art is the same, no need to re-extract colors,
                 // but ensure UI is correct and colors are applied if needed (e.g., after manual fetch)
                 lastfmAlbumArtImg.style.display = 'block';
                 // Colors are already set from this art, no action needed here.
            }
        } else {
            lastfmAlbumArtImg.style.display = 'none';
            // No album art for the currently playing track
            useDefaultColors = true;
            // If currentAlbumArtUrl was previously set, clear it
            lastFmColorsExtractedSuccessfully = false; // No Last.fm art colors
            if (currentAlbumArtUrl !== '') { currentAlbumArtUrl = ''; } // Reset if art disappears
        }
    } else {
        lastfmNowPlayingDiv.style.display = 'none';
        lastfmAlbumArtImg.style.display = 'none';
        lastfmNotPlayingDiv.style.display = 'block';
        lastfmNotPlayingDiv.textContent = 'Not currently playing.';
        // Explicitly reset content of hidden "now playing" elements
        lastfmTrackDiv.textContent = '-';
        lastfmArtistDiv.textContent = '-';
        lastfmAlbumDiv.textContent = '-';
        lastfmAlbumArtImg.src = '';
        useDefaultColors = true; // Use default colors if not playing
        lastFmColorsExtractedSuccessfully = false; // No Last.fm art colors
        if (currentAlbumArtUrl !== '') { currentAlbumArtUrl = ''; } // Reset if art disappears
    }

    // Apply default colors if the flag is set
    if (useDefaultColors) {
        applyDefaultColors();
        lastFmColorsExtractedSuccessfully = false; // Mark that Last.fm colors were NOT used
        performInitialSceneSetupIfNeeded(); // Re-evaluate initial setup state
    }
    handleOldMenuLastFmUpdate(data); // Update old menu based on current Last.fm data
}

async function fetchLastFmData(isManualFetch = false) {
    lastfmLoadingDiv.style.display = 'block';
    lastfmErrorDiv.style.display = 'none';
    lastfmNotPlayingDiv.style.display = 'none';
    lastfmNowPlayingDiv.style.display = 'none';
    if (fetchLastFmBtn) fetchLastFmBtn.disabled = true; // Disable button during fetch
    try {
        const response = await fetch(LASTFM_API_URL);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        // updateLastFmUI will handle applying colors (either Last.fm or default)
        updateLastFmUI(data); // This function will handle color extraction/application
                              // and may call performInitialSceneSetupIfNeeded internally
    } catch (error) {
        console.error('Error fetching Last.fm data:', error);
        lastfmLoadingDiv.style.display = 'none';
        lastfmErrorDiv.style.display = 'block';
        lastfmNowPlayingDiv.style.display = 'none';
        lastfmNotPlayingDiv.style.display = 'none';
        if (fetchLastFmBtn) fetchLastFmBtn.disabled = false; // Re-enable button on error
        handleOldMenuLastFmUpdate(null); // Pass null to indicate error/default state for old menu
        applyDefaultColors(); // Apply default colors on error
                              // This will also call initializeColorPaletteUI and may trigger background transition
    } finally {
        // This block executes regardless of try/catch outcome
        if (!firstLastFmFetchAttempted) {
            firstLastFmFetchAttempted = true;
        }
        // Always attempt scene setup after the first fetch attempt is fully processed (including error handling)
        // This ensures that if default colors are ready, and Last.fm processing (even if error) is done,
        // the scene can be set up with defaults.
        performInitialSceneSetupIfNeeded();
    }

    if (isManualFetch) {
        resetLastFmInterval();
    }
}

function resetLastFmInterval() {
    if (lastfmPollIntervalId) {
        clearInterval(lastfmPollIntervalId);
    }
    lastfmPollIntervalId = setInterval(fetchLastFmData, LASTFM_POLL_INTERVAL);
}

function applyDefaultColors() {
    previousBackgroundColorForTransition = currentAnimatedBackgroundColor;
    targetBackgroundColor = defaultBackgroundColor;
    backgroundColorTransitionStartTime = performance.now();
    isBackgroundTransitioning = true;
    colorPalette = defaultColorPalette.length > 0 ? [...defaultColorPalette] : []; // Use a copy, ensure fallback if default still loading
    // If applying default colors, the UI palette should also reflect this.
    initializeColorPaletteUI(false); // Update UI pickers to show default palette (or random if defaults not loaded)
}

function arePalettesRoughlyEqual(paletteA, paletteB) {
    if (!paletteA || !paletteB) return false; // Ensure both palettes exist
    if (paletteA.length !== paletteB.length) return false;
    if (paletteA.length === 0 && paletteB.length === 0) return true;
    for (let i = 0; i < paletteA.length; i++) {
        if (paletteA[i] !== paletteB[i]) return false;
    }
    return true;
}

function performInitialSceneSetupIfNeeded() {
    if (initialSceneSetupPerformed) return;

    let colorsAreReadyForSetup = false;
    let setupType = ""; // "lastfm" or "default"

    if (lastFmColorsExtractedSuccessfully) {
        // Scenario 1: Last.fm colors successfully extracted. Use them.
        colorsAreReadyForSetup = true;
        setupType = "lastfm";
    } else {
        // Last.fm colors are not (yet) successfully extracted.
        if (firstLastFmFetchAttempted) {
            // The first Last.fm API fetch has been attempted.
            if (lastFmArtProcessing) {
                // Album art is currently being processed. Wait for it to complete.
                // This state will be resolved when extractAndApplyColorsFromAlbumArt calls performInitialSceneSetupIfNeeded again.
                // console.log("performInitialSceneSetupIfNeeded: Waiting for Last.fm album art processing to complete.");
            } else {
                // Last.fm fetch attempted, and no album art is currently being processed.
                // This means either:
                //  - No song is playing / no album art was found by Last.fm.
                //  - Album art processing was attempted but failed (e.g., image load error, ColorThief error).
                // In these cases, we can now safely consider using default colors if they are loaded.
                if (defaultColorsLoaded) {
                    colorsAreReadyForSetup = true;
                    setupType = "default";
                    // Ensure the application is actually using the true default colors,
                    // especially if applyDefaultColors() was called earlier with preliminary defaults.
                    if (targetBackgroundColor !== defaultBackgroundColor ||
                        !arePalettesRoughlyEqual(colorPalette, defaultColorPalette)) {
                         console.warn("performInitialSceneSetupIfNeeded: Re-applying default colors as current state differs from loaded defaults (after Last.fm attempt, no art processing).");
                         applyDefaultColors();
                    }
                } else {
                    // console.log("performInitialSceneSetupIfNeeded: Default colors not loaded yet. Waiting for them.");
                }
            }
        } else {
            // First Last.fm fetch not yet attempted. We must wait for it.
            // console.log("performInitialSceneSetupIfNeeded: Waiting for the first Last.fm fetch attempt before deciding on colors.");
        }
    }

    if (colorsAreReadyForSetup) {
        console.log(`Performing initial scene setup with ${setupType} colors.`);
        if (backgroundColorPicker) backgroundColorPicker.value = targetBackgroundColor;
        initializeColorPaletteUI(false); // Use derived palette for UI
        adjustShapesArray(); // Spawn shapes
        initialSceneSetupPerformed = true; // Mark that initial setup is done
    }

}

async function extractAndApplyColorsFromAlbumArt(imageUrl) {
    if (!imageUrl || !colorThief) return;
    lastFmColorsExtractedSuccessfully = false; // Assume failure until success
    lastFmArtProcessing = true; // Indicate that art processing has started

    const img = new Image();
    img.crossOrigin = "Anonymous"; // Important for ColorThief
    img.src = imageUrl;

    // Use a temporary palette array during extraction to avoid modifying
    // the main colorPalette until extraction is successful.
    let tempColorPalette = [];
    img.onload = () => {
        try {
            const dominantColorRgb = colorThief.getColor(img);
            const paletteRgb = colorThief.getPalette(img, NUM_PALETTE_COLORS);

            previousBackgroundColorForTransition = currentAnimatedBackgroundColor;
            targetBackgroundColor = rgbToHex(dominantColorRgb[0], dominantColorRgb[1], dominantColorRgb[2]);
            backgroundColorTransitionStartTime = performance.now();
            isBackgroundTransitioning = true;
            // Color palette will be updated next, then shapes spawned.

            tempColorPalette = new Array(NUM_PALETTE_COLORS);
            for (let i = 0; i < NUM_PALETTE_COLORS; i++) {
                if (paletteRgb && paletteRgb[i]) {
                    tempColorPalette[i] = rgbToHex(paletteRgb[i][0], paletteRgb[i][1], paletteRgb[i][2]);
                } else {
                    // Fallback: Use a random color if palette is too small
                    tempColorPalette[i] = getRandomHexColor();
                }
            }
            colorPalette = tempColorPalette; // Assign the fully formed new palette

            if (backgroundColorPicker) {
                backgroundColorPicker.value = targetBackgroundColor;
            }

            if (firstLastFmColorChangeDone) {
                spawnTransitionShapes(); // Spawn only after the first successful color change
            } else {
                firstLastFmColorChangeDone = true; // Mark that the first color change has happened
            }
            initializeColorPaletteUI(false); // Update palette UI with new colors

            // applyBlurEffect will be handled by the animation loop for smooth transition

            lastFmColorsExtractedSuccessfully = true; // Mark successful extraction
            lastFmArtProcessing = false; // Art processing finished
            // If this is the very first successful fetch with album art, ensure scene setup happens
            performInitialSceneSetupIfNeeded(); 

        } catch (e) {
            console.error("Error processing image with ColorThief:", e);
            // Fallback to default colors on ColorThief error
            lastFmColorsExtractedSuccessfully = false; // Mark failure
            lastFmArtProcessing = false; // Art processing finished (with error)
            performInitialSceneSetupIfNeeded(); // Re-evaluate initial setup state
        }
    };
    img.onerror = () => {
        console.error("Failed to load album art image for color extraction:", imageUrl);
        // Fallback to default colors on image load error
        lastFmColorsExtractedSuccessfully = false; // Ensure flag is false
        lastFmArtProcessing = false; // Art processing finished (with error)
        // applyDefaultColors() will be called by updateLastFmUI or fetchLastFmData if this path leads to no art.
        // The important part here is that lastFmArtProcessing is false so performInitialSceneSetupIfNeeded can proceed with defaults if ready.
        performInitialSceneSetupIfNeeded(); // Re-evaluate initial setup state
    };
}

// --- Initial Default Color Extraction ---
function loadDefaultColors() {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = DEFAULT_IMAGE_URL;
    img.onload = () => {
        try {
            defaultBackgroundColor = rgbToHex(...colorThief.getColor(img));
            defaultColorPalette = colorThief.getPalette(img, NUM_PALETTE_COLORS).map(c => rgbToHex(...c));
            defaultColorsLoaded = true;
            console.log("Default colors loaded successfully.");
        } catch (e) { console.error("Error loading default colors:", e); }
        // Attempt initial scene setup regardless of success/failure of default color loading,
        // as Last.fm might provide colors, or we might proceed with hardcoded fallbacks if defaults failed.
        performInitialSceneSetupIfNeeded(); // Now that defaults are loaded, perform initial setup
    };
}
    // --- START: Old Menu Integration Logic (continued) ---
    function updateOldMenuFavicon(coverArtUrlForFavicon, isPlaying) {
        if (!oldMenuFaviconLink) return;

        const faviconCanvas = document.createElement('canvas');
        faviconCanvas.width = 128; faviconCanvas.height = 128;
        const faviconCtx = faviconCanvas.getContext('2d');
        const baseFaviconImg = new Image();
        baseFaviconImg.crossOrigin = "Anonymous";
        baseFaviconImg.src = OLD_MENU_FAVICON_BASE_SRC;

        baseFaviconImg.onload = () => {
            if (isPlaying && coverArtUrlForFavicon) {
                const coverArtImg = new Image();
                coverArtImg.crossOrigin = "Anonymous";
                coverArtImg.src = coverArtUrlForFavicon;
                coverArtImg.onload = () => {
                    faviconCtx.filter = 'blur(4px) brightness(0.7)';
                    faviconCtx.drawImage(coverArtImg, 0, 0, 128, 128);
                    faviconCtx.filter = 'none';
                    faviconCtx.drawImage(baseFaviconImg, 0, 0, 128, 128);
                    oldMenuFaviconLink.href = faviconCanvas.toDataURL('image/png');
                };
                coverArtImg.onerror = () => {
                    faviconCtx.drawImage(baseFaviconImg, 0, 0, 128, 128);
                    oldMenuFaviconLink.href = faviconCanvas.toDataURL('image/png');
                };
            } else {
                faviconCtx.drawImage(baseFaviconImg, 0, 0, 128, 128);
                oldMenuFaviconLink.href = faviconCanvas.toDataURL('image/png');
            }
        };
        baseFaviconImg.onerror = () => console.error("Failed to load base favicon for old menu:", OLD_MENU_FAVICON_BASE_SRC);
    }

    function handleOldMenuLastFmUpdate(lastFmData) {
        if (!oldMenuLastFmButton) initializeOldMenuSelectors();

        const isPlaying = lastFmData?.recenttracks?.track?.[0]?.["@attr"]?.nowplaying === "true";
        const user = lastFmData?.recenttracks?.["@attr"]?.user;
        let currentTrackImageUrl = null, trackName = null, artistName = null, trackUrl = null;

        if (isPlaying) {
            const track = lastFmData.recenttracks.track[0];
            trackName = track.name?.replace(/\s*\(.*?\)\s*/g, ' ') || 'Unknown Track';
            artistName = track.artist?.["#text"]?.replace(/\s*\(.*?\)\s*/g, ' ') || 'Unknown Artist';
            trackUrl = track.url || (user ? `https://www.last.fm/user/${user}` : "#");
            const imgInfo = track.image?.find(img => img.size === 'extralarge' || img.size === 'large');
            if (imgInfo?.["#text"] && !imgInfo["#text"].includes("2a96cbd8b46e442fc41c2b86b821562f")) {
                currentTrackImageUrl = imgInfo["#text"];
            }
        }

        // Call updated style/theme/favicon functions with fixed/simplified logic
        updateOldMenuElementsStyle();
        updateOldMenuFavicon(currentTrackImageUrl, isPlaying);
        updateOldMenuThemeMetaTag();

        if (oldMenuLastFmButton) {
            if (isPlaying && trackName && artistName) {
                oldMenuLastFmButton.textContent = `Listening to ${trackName} by ${artistName}`;
                oldMenuLastFmButton.href = trackUrl;
            } else {
                oldMenuLastFmButton.textContent = "Last.fm";
                oldMenuLastFmButton.href = user ? `https://www.last.fm/user/${user}` : "#";
            }
        }
    }
    // --- END: Old Menu Integration Logic ---

    // Initial fetch
    fetchLastFmData();
    resetLastFmInterval(); // Start the polling interval
    if (fetchLastFmBtn) {
        fetchLastFmBtn.addEventListener('click', () => fetchLastFmData(true));
    }
    loadDefaultColors(); // Start loading default colors immediately
    
    // Initialize selectors for old menu elements after DOM is loaded
    initializeOldMenuSelectors();
    handleOldMenuLastFmUpdate(null); // Initial call to set default state for old menu

    // Event listener for corner image taps
    if (cornerImage && debugMenu) {
        cornerImage.addEventListener('click', () => {
            const currentTime = performance.now();

            if ((currentTime - lastCornerImageTapTime) > TAP_INTERVAL_THRESHOLD) {
                cornerImageTapCount = 1; // Reset and count this tap as the first
            } else {
                cornerImageTapCount++;
            }
            lastCornerImageTapTime = currentTime;

            if (cornerImageTapCount >= REQUIRED_TAPS_FOR_DEBUG) {
                debugMenu.classList.remove('menu-hidden');
                debugMenu.style.top = DEFAULT_MENU_TOP; // Reset position
                debugMenu.style.left = DEFAULT_MENU_LEFT;
                debugMenu.classList.remove('collapsed'); // Ensure it's not collapsed
                cornerImageTapCount = 0; // Reset tap count after opening
            }
        });
    }
    applyPostProcessingFilters(); // Apply initial post-processing filter state
}); // End of main DOMContentLoaded