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
    const debugMenuContent = debugMenu ? debugMenu.querySelector('.debug-menu-content') : null;
    const birthdayModeControlGroup = document.getElementById('birthday-mode-control-group');
    const birthdayModeToggle = document.getElementById('birthday-mode-toggle');
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
    // New UI Elements for Resolution Slider
    const resolutionSlider = document.getElementById('resolution-slider');
    const resolutionValueDisplay = document.getElementById('resolution-value');
    
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
    let menuWidthForDrag, menuHeightForDrag; // Cached dimensions for dragging


    const DEFAULT_MENU_TOP = '20px'; 
    // const DEFAULT_MENU_LEFT = '20px'; // Defined later, ensure no conflict
    const DEFAULT_MENU_LEFT = '20px'; 

    let currentNumShapes = 60; 
    let currentScaleMultiplier = 1.0;
    let currentRotationSpeedMultiplier = 1.0;
    let currentMovementSpeedMultiplier = 1.0;
    let currentNumTransitionShapes = 10; // Default, will be synced with slider
    let currentBlurIntensity = 200; // Default blur intensity scaled for 64x64 canvas (was 200px for 512x512)

    // Define available resolutions
    const RESOLUTIONS = [
        { width: 16, height: 16, label: "16x16" },
        { width: 32, height: 32, label: "32x32" },
        { width: 64, height: 64, label: "64x64" },
        { width: 128, height: 128, label: "128x128" },
        { width: 256, height: 256, label: "256x256" },
        { width: 512, height: 512, label: "512x512" },
        { width: 1024, height: 1024, label: "1024x1024" },
        { width: 2048, height: 2048, label: "2048x2048" }
    ];
    let currentResolutionIndex = 2; // Default to 64x64 (index 2)
    let previousResolutionIndex = 0; // To store the index before a change

    // Post-processing state variables
    let currentBrightness = 80; // %
    let currentContrast = 120;   // %
    let currentSaturation = 200; // %
    let currentHueRotate = 0;    // deg
    
    // Maximum number of colors to request from ColorThief for the palette.
    const MAX_PALETTE_COLORS_TO_REQUEST = 8; // You can adjust this value
    const COLOR_SIMILARITY_TOLERANCE = 45; // Adjust this value (0-442).
                                           // Lower values mean colors must be more different.
                                           // Higher values mean more colors will be grouped as similar.
                                           // e.g., 30-60 is a reasonable range to start experimenting.
    const LUMINANCE_THRESHOLD = 0.55;      // Threshold for determining if a background is "light".
                                           // (0=black, 1=white). Colors above this will get the overlay.
                                           // Adjust between 0.4 (dims more colors) and 0.7 (dims only very bright colors).

    let colorPalette = []; 
    let defaultColorPalette = []; // Will be updated from default image: Array of {color: string, weight: number}
    // Background Color Transition Variables
    let targetBackgroundColor = '#181818';   // The desired final background color
    let previousBackgroundColorForTransition = '#181818'; // The color we are transitioning FROM
    let currentAnimatedBackgroundColor = '#181818'; // The interpolated color during transition, or targetBackgroundColor if not transitioning
    const BACKGROUND_COLOR_TRANSITION_DURATION = 500; // ms
    let backgroundColorTransitionStartTime = 0;
    let isBackgroundTransitioning = false;
    // --- Last.fm Integration Variables (moved inside DOMContentLoaded) ---
    // State for optimized updateBackgroundOverlayState calls
    let prevFrameAnimatedBgColorForOverlay = '#121212'; // Initialize with default
    let prevFrameColorPaletteForOverlay = []; // Initialize with empty array

    // Variables to track state for applyBlurEffect optimization
    let prevAnimatedBgColorForBlur = currentAnimatedBackgroundColor;
    let prevBlurToggleState = blurToggle.checked;
    let prevBlurIntensityForBlur = currentBlurIntensity;

    const LASTFM_API_URL = 'https://lastfm-red-surf-3b97.damp-unit-21f3.workers.dev/';
    const LASTFM_POLL_INTERVAL = 15000; // 15 seconds
    // --- Placeholder for Alternative BPM API ---
    const AUDIO_DB_API_URL_BASE = 'https://theaudiodb-api-cool-shape-691.damp-unit-21f3.workers.dev/'; // Your new worker URL
    let lastfmPollIntervalId = null;
    // State for tracking BPM fetching to avoid redundant calls
    let lastQueriedArtistForBpm = '';
    let lastQueriedTrackForBpm = '';
    let lastBpmDisplayValue = ''; // Stores the string like "BPM: 120", "BPM: N/A", or "BPM: Fetching..."

    let currentAlbumArtUrl = ''; // Store the current album art URL to detect changes
    const colorThief = new ColorThief(); // Instantiate ColorThief
    let initialSceneSetupPerformed = false;
    let firstLastFmColorChangeDone = false; // New flag to track the first color change
    let lastFmColorsExtractedSuccessfully = false; // Flag to track successful color extraction
    let firstLastFmFetchAttempted = false; // Flag to ensure first API call is made before defaulting
    let lastFmArtProcessing = false; // Flag to indicate if Last.fm album art is currently being processed
    const REINIT_BATCH_DIVISOR = 30; // Process 1/30th of shapes per frame for re-initialization
    const DEFAULT_IMAGE_URL = '/assets/bgimg/newsquare7_512.png'; // Path to your default image
    let previousFrameAnimatedBgColor = '#121212'; // Initialize with a default or the initial background
    let defaultBackgroundColor = '#121212'; // Will be updated from default image
    let defaultColorsLoaded = false; 

    let isInitialShapeSpawn = true; // Flag for initial center spawning
    // Variables for delayed old color cleanup
    let previousColorPaletteForCleanup = []; // Stores the palette before the most recent change
    let paletteChangeTimestampForCleanup = 0; // Timestamp of the last palette change
    let cleanupTriggeredForCurrentPaletteChange = true; // True if cleanup for the current old_palette has been initiated (or not needed)
    const CLEANUP_START_DELAY = 0; // Start cleanup immediately after palette change
    // Corner image tap tracking for debug menu
    let cornerImageTapCount = 0;
    let lastCornerImageTapTime = 0;
    const TAP_INTERVAL_THRESHOLD = 700; // Taps must be within 700ms of each other
    const REQUIRED_TAPS_FOR_DEBUG = 7; 

    let dynamicBlurLayers = []; // To store dynamically created blur layers
    // Viewport-relative blur constants
    const SLIDER_MAX_BLUR_INTENSITY = 300;     // Max value of the blur-intensity-slider in HTML (0-300)
    const MAX_DESIRED_TOTAL_BLUR_VW = 27.77;   // Slider at 300 -> ~300px blur on 1080p (27.77vw of 1080px)
    const MAX_BLUR_PER_LAYER_VW = 14.55;       // Each stacked blur layer can contribute up to ~157px on 1080p (14.55vw of 1080px)

    // --- START: Old Menu Integration ---
    // --- START: Raining Cakes Variables ---
    const rainingCakesContainer = document.getElementById('raining-cakes-container');
    let activeRainingCakes = [];
    const MAX_RAINING_CAKES = 15;
    const RAIN_CAKE_SPAWN_INTERVAL = 300; // ms
    let lastRainCakeSpawnTime = 0; 
    const RAIN_CAKE_MIN_SPEED = 0.08; // pixels per ms (doubled from 0.04)
    const RAIN_CAKE_MAX_SPEED = 0.24;  // pixels per ms (doubled from 0.12)
    const RAIN_CAKE_WIDTH = 60; // px, must match CSS
    const RAIN_CAKE_HEIGHT = 80; // px, must match CSS
    const OLD_MENU_FAVICON_BASE_SRC = '/assets/favicon/newsquare7_128trans.png';

    // --- Birthday Mode Variables ---
    function isJuly5th() { // Renamed for clarity
        const today = new Date();
        return today.getMonth() === 6 && today.getDate() === 5; // Month is 0-indexed (July is 6)
    }
    let isBirthdayModeActive = isJuly5th(); // Automatically active on July 5th


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
        
        const targetLightness = 0.85; // 90% brightness
        let finalSaturationForMenu;

        // If the background color's saturation is very low (i.e., it's grayscale)
        if (hslColor.s < 0.01) { // Threshold for considering it grayscale
            finalSaturationForMenu = 0; // Make menu text grayscale as well
        } else {
            finalSaturationForMenu = 1.0; // Max saturation for colored backgrounds
        }

        const finalColorHex = hslToHex(hslColor.h, finalSaturationForMenu, targetLightness);

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

    /**
     * Calculates the relative luminance of a hex color.
     * @param {string} hex - The hex color string (e.g., "#RRGGBB").
     * @returns {number} Luminance value between 0 (darkest) and 1 (lightest).
     */
    function getLuminance(hex) {
        const rgb = hexToRgb(hex); // Assumes hexToRgb returns {r, g, b} in 0-255
        if (!rgb) return 0; // Fallback for invalid hex

        // Normalize RGB values to 0-1
        let r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;

        // Convert sRGB to linear RGB
        r = (r <= 0.04045) ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
        g = (g <= 0.04045) ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
        b = (b <= 0.04045) ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);

        // Calculate luminance using the Rec. 709 formula
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

    /**
     * Adds or removes a class from the scene container based on background luminance
     * and/or palette color luminances to toggle a dimming overlay.
     * @param {string} backgroundColorHex - The current background color in hex format.
     */
    function updateBackgroundOverlayState(backgroundColorHex) {
        if (!container) return; // container is #scene-container

        let activateOverlay = false;

        // Check the main background color's luminance
        if (getLuminance(backgroundColorHex) > LUMINANCE_THRESHOLD) {
            activateOverlay = true;
        }

        // If background isn't light, check if any color in the palette is light
        if (!activateOverlay) {
            for (const item of colorPalette) { // Iterate over items {color, weight}
                if (getLuminance(item.color) > LUMINANCE_THRESHOLD) { // Use item.color
                    activateOverlay = true;
                    break;
                }
            }
        }
        container.classList.toggle('light-bg', activateOverlay);
    }

    /**
     * Checks if two RGB colors are similar based on Euclidean distance.
     * @param {number[]} rgb1 - First color as [r, g, b] array.
     * @param {number[]} rgb2 - Second color as [r, g, b] array.
     * @param {number} tolerance - Maximum distance for colors to be considered similar.
     * @returns {boolean} True if colors are similar, false otherwise.
     */
    function areColorsSimilar(rgb1, rgb2, tolerance) {
        if (!rgb1 || !rgb2 || rgb1.length !== 3 || rgb2.length !== 3) {
            // console.warn("areColorsSimilar: Invalid color input.");
            return false; 
        }
        const rDiff = rgb1[0] - rgb2[0];
        const gDiff = rgb1[1] - rgb2[1];
        const bDiff = rgb1[2] - rgb2[2];
        const distance = Math.sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff);
        return distance < tolerance;
    }

    /**
     * Quadratic easing in-out function.
     * @param {number} t - Progress ratio from 0 to 1.
     * @returns {number} Eased progress ratio.
     */
    function easeInOutQuad(t) {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }
    // --- Initialize UI ---
    
    // Helper to convert RGB object to array for areColorsSimilar
    const rgbToArr = (rgbObj) => {
        return rgbObj ? [rgbObj.r, rgbObj.g, rgbObj.b] : [0,0,0];
    };

    // --- Material You Dynamic Theme Color Helpers ---
    function lightenDarkenColor(hex, percent) {
        let { r, g, b } = hexToRgb(hex);
        const amount = Math.floor(255 * (percent / 100));
        r = Math.max(0, Math.min(255, r + amount));
        g = Math.max(0, Math.min(255, g + amount));
        b = Math.max(0, Math.min(255, b + amount));
        return rgbToHex(r, g, b);
    }

    function getWCAGContrastRatio(hex1, hex2) {
        const lum1 = getLuminance(hex1);
        const lum2 = getLuminance(hex2);
        const lighter = Math.max(lum1, lum2);
        const darker = Math.min(lum1, lum2);
        return (lighter + 0.05) / (darker + 0.05);
    }

    function getContrastColor(hex) {
        const luminance = getLuminance(hex);
        // Original threshold of 0.5 was too high, causing light buttons (e.g., HSL L=0.6-0.7)
        // to get light text, resulting in poor contrast on the button itself.
        // A lower threshold (e.g., 0.22) better distinguishes between colors needing
        // light text versus dark text. Primary accent colors are designed to be light
        // (luminance typically > 0.22), so they should receive dark text.
        return luminance > 0.22 ? '#202124' : '#E8EAED'; // Darker black and lighter white for better general contrast
    }

    function getSlightlyLessContrastColor(surfaceHexColor) {
        const surfaceLuminance = getLuminance(surfaceHexColor);
        // M3 typical "on surface variant" colors
        return surfaceLuminance > 0.5 ? '#49454F' : '#CAC4D0'; 
    }

    function updateDynamicM3ThemeColors(bgColor, accentPalette) {
        const rootStyle = document.documentElement.style;
        if (!bgColor || !accentPalette) return;

        const MIN_SATURATION_FOR_ACCENT = 0.15;
        const MIN_CONTRAST_PRIMARY_ON_SURFACE = 3.0; // For primary accent on the dark menu surface
        const MIN_TARGET_LUMINANCE_FOR_PRIMARY_ACCENT = 0.25; // Minimum perceptual brightness for the button color

        // --- Surface colors: Ensure they are "much darker" ---
        const bgHsl = hexToHSL(bgColor);
        const isBaseGrayScale = bgHsl.s < 0.05; // Threshold for considering the base color grayscale

        let surfaceHsl = { ...bgHsl };

        // Force a dark theme for the M3 variables that would typically be used by a menu/debug UI
        surfaceHsl.l = 0.12; // Target a dark lightness (e.g., ~12%)
        if (isBaseGrayScale) {
            surfaceHsl.s = 0; // Grayscale surface if base is grayscale
        } else {
            // Adjust surface color saturation: aim for ~half of the previous boost, still > original.
            surfaceHsl.s = Math.min(Math.max(bgHsl.s * 0.35, 0.10), 0.23); // Saturation (min 10%, cap 23%)
        }
        const surface = hslToHex(surfaceHsl.h, surfaceHsl.s, surfaceHsl.l);

        let surfaceContainerHighHsl = { ...surfaceHsl };
        surfaceContainerHighHsl.l = Math.min(0.95, surfaceHsl.l + 0.06); // e.g., 0.12 -> 0.18 (ensure not >1)
        // surfaceContainerHighHsl.s will be same as surfaceHsl.s (0 if grayscale)
        const surfaceContainerHigh = hslToHex(surfaceContainerHighHsl.h, surfaceContainerHighHsl.s, surfaceContainerHighHsl.l);
        
        // Ensure onSurface (title text, etc.) is always light and legible for the dark menu
        const onSurface = '#E8EAED'; // A light, high-contrast color
        const onSurfaceVariant = '#CAC4D0'; // A slightly dimmer light color for secondary text

        let outlineHsl = { ...surfaceHsl };
        outlineHsl.l = Math.min(0.95, surfaceHsl.l + 0.08); // Slightly more distinct outline
        const outline = hslToHex(outlineHsl.h, outlineHsl.s, outlineHsl.l);
        // outlineHsl.s will be same as surfaceHsl.s (0 if grayscale)

        // --- Primary Accent (adjusted to be light, for use on dark surfaces like the menu) ---
        let primaryAccent = null;
        if (accentPalette.length > 0) {
            const potentialPrimaries = accentPalette
                .map(item => ({ // item is {color, weight}
                    hex: item.color, // Use item.color for hex value
                    contrast: getWCAGContrastRatio(item.color, surface), 
                    hsl: hexToHSL(item.color)
                }))
                // Filter for light accents with good contrast on dark surface and decent saturation
                .filter(p => {
                    const meetsContrastAndLightness = p.contrast >= MIN_CONTRAST_PRIMARY_ON_SURFACE && p.hsl.l >= 0.50; // Prefer accents with at least 50% HSL lightness
                    if (!meetsContrastAndLightness) return false;
                    if (isBaseGrayScale) return true; // For grayscale, saturation doesn't matter for selection, will be zeroed out later
                    return p.hsl.s >= MIN_SATURATION_FOR_ACCENT; // For color, require saturation
                })
                .sort((a, b) => { // Prioritize saturation (if not grayscale), then contrast
                    if (isBaseGrayScale) return b.contrast - a.contrast; // For grayscale, only contrast matters for sorting
                    return b.hsl.s - a.hsl.s || b.contrast - a.contrast;
                });

            if (potentialPrimaries.length > 0) {
                let chosenPrimaryHsl = potentialPrimaries[0].hsl;
                if (isBaseGrayScale) {
                    chosenPrimaryHsl.s = 0; // Force grayscale if base is grayscale
                }
                primaryAccent = hslToHex(chosenPrimaryHsl.h, chosenPrimaryHsl.s, chosenPrimaryHsl.l);
            }
        }

        // Derive a light primary accent if not found from palette
        if (!primaryAccent) {
            let paHsl = hexToHSL(bgColor); // Start with main background's HSL for hue
            if (isBaseGrayScale) {
                paHsl.s = 0; // Grayscale accent
            } else {
                paHsl.h = (paHsl.h + 40) % 360; // Hue shift for accent
                paHsl.s = Math.min(1, Math.max(0.45, paHsl.s + 0.1)); // Ensure good saturation (min 0.45)
            }
            paHsl.l = 0.70; // Make it a light color (e.g., 70% lightness)
            primaryAccent = hslToHex(paHsl.h, paHsl.s, paHsl.l);

            // Ensure contrast with the dark surface
            if (getWCAGContrastRatio(primaryAccent, surface) < MIN_CONTRAST_PRIMARY_ON_SURFACE) {
                paHsl.l = 0.75; // Try even lighter
                // paHsl.s is already correctly set (0 if grayscale, or saturated otherwise)
                primaryAccent = hslToHex(paHsl.h, paHsl.s, paHsl.l);
                 if (getWCAGContrastRatio(primaryAccent, surface) < MIN_CONTRAST_PRIMARY_ON_SURFACE) {
                    if (isBaseGrayScale) {
                        primaryAccent = '#D3D3D3'; // Light gray fallback for grayscale themes
                    } else {
                        primaryAccent = '#89b3ff'; // A fallback light blue accent, legible on dark surfaces
                    }
                 }
            }
        }

        // Ensure the final primary accent color has a minimum target luminance.
        // This step modifies the color by increasing HSL lightness if necessary.
        let currentCalculatedAccent = primaryAccent;
        let currentLuminance = getLuminance(currentCalculatedAccent);

        if (currentLuminance < MIN_TARGET_LUMINANCE_FOR_PRIMARY_ACCENT) {
            let tempHsl = hexToHSL(currentCalculatedAccent);
            
            // Only try to increase lightness if it's not already maxed out
            if (tempHsl.l < 1.0) {
                for (let i = 0; i < 20; i++) { // Iterate up to 20 times (0.05 * 20 = 1.0, covers full HSL.l range)
                    tempHsl.l += 0.05; // Increment HSL lightness
                    if (tempHsl.l > 1.0) {
                        tempHsl.l = 1.0;
                    }
                    currentCalculatedAccent = hslToHex(tempHsl.h, tempHsl.s, tempHsl.l);
                    currentLuminance = getLuminance(currentCalculatedAccent);
                    if (currentLuminance >= MIN_TARGET_LUMINANCE_FOR_PRIMARY_ACCENT || tempHsl.l >= 1.0) {
                        break; // Target met or HSL lightness maxed out
                    }
                }
            }
            primaryAccent = currentCalculatedAccent; // Update the main primaryAccent variable
        }

        const onPrimary = getContrastColor(primaryAccent);

        // --- Secondary Container ---
        let secondaryContainer = null;
        if (accentPalette.length > 0) {
            const potentialSecondaries = accentPalette
                .filter(item => item.color.toUpperCase() !== primaryAccent.toUpperCase()) // Use item.color
                .map(item => ({ hex: item.color, hsl: hexToHSL(item.color) })) // Use item.color
                .sort((a,b) => { // Pick another saturated one if available (if not grayscale)
                    if (isBaseGrayScale) return 0; // No preference based on saturation if grayscale
                    return b.hsl.s - a.hsl.s;
                });
            if (potentialSecondaries.length > 0) {
                let secondaryHex = potentialSecondaries[0].hex; // This is now correctly a hex string
                let secondaryHsl = hexToHSL(secondaryHex);
                if (isBaseGrayScale) {
                    secondaryHsl.s = 0; // Force grayscale if base is grayscale
                } else {
                    // Reduce saturation to make it less vibrant, M3 tonal colors are often less saturated
                    secondaryHsl.s = Math.min(secondaryHsl.s, 0.4); // Cap saturation (e.g., 40%)
                }
                secondaryContainer = hslToHex(secondaryHsl.h, secondaryHsl.s, secondaryHsl.l);
            }
        }

        if (!secondaryContainer) {
            // Derive tonal secondary container from the new dark 'surface' color
            // Since surface is dark, getLuminance(surface) will be low, so this adds 12% lightness.
            secondaryContainer = lightenDarkenColor(surface, getLuminance(surface) > 0.5 ? -10 : 12);
            // If surface is grayscale, secondaryContainer will also be grayscale.
            if (areColorsSimilar(rgbToArr(hexToRgb(secondaryContainer)), rgbToArr(hexToRgb(primaryAccent)), 25)) {
                secondaryContainer = lightenDarkenColor(surface, 18); // More distinct tonal from surface
            }
        }
        const onSecondaryContainer = getContrastColor(secondaryContainer);

        // Set CSS properties
        rootStyle.setProperty('--m3-primary', primaryAccent);
        rootStyle.setProperty('--m3-on-primary', onPrimary);
        rootStyle.setProperty('--m3-secondary-container', secondaryContainer);
        rootStyle.setProperty('--m3-on-secondary-container', onSecondaryContainer);
        rootStyle.setProperty('--m3-surface', surface);
        rootStyle.setProperty('--m3-surface-container-high', surfaceContainerHigh);
        rootStyle.setProperty('--m3-on-surface', onSurface);
        rootStyle.setProperty('--m3-on-surface-variant', onSurfaceVariant);
        rootStyle.setProperty('--m3-outline', outline);
    }

    // --- Raining Cake Color Logic & Management ---
    // Global cake color variables and determineGlobalCakeLayerColors are removed.
    // Colors will be assigned per-cake.

    function getRandomColorFromPaletteWeighted(palette, fallbackColor = '#CCCCCC') {
    // Convert fallbackColor hex to a fallbackItem if it's not already an item
    const fallbackItem = (typeof fallbackColor === 'string') ? { color: fallbackColor, weight: 1 } : fallbackColor;

        if (!palette || palette.length === 0) {
            return fallbackItem;
        }

        const totalWeight = palette.reduce((sum, item) => sum + item.weight, 0);
        if (totalWeight === 0) { // All weights are zero, pick uniformly
            return palette[Math.floor(Math.random() * palette.length)];
        }

        let randomVal = Math.random() * totalWeight;
        for (const item of palette) {
            if (randomVal < item.weight) {
                return item;
            }
            randomVal -= item.weight;
        }
        // Fallback, should ideally not be reached if weights are positive
        return palette.length > 0 ? palette[palette.length - 1] : fallbackItem;
    }
    function getRandomColorFromPalette(fallbackColor) {
        const fallbackItem = { color: (fallbackColor || '#CCCCCC'), weight: 1 };
        const chosenItem = getRandomColorFromPaletteWeighted(colorPalette, fallbackItem);
        return chosenItem.color;
    }

    function getRandomColorFromPaletteUnweighted(palette, fallbackColor = '#CCCCCC') {
        if (!palette || palette.length === 0) {
            return fallbackColor;
        }
        // palette is an array of {color: string, weight: number}
        return palette[Math.floor(Math.random() * palette.length)].color;
    }

    function updateAllActiveCakeColors() {
        // This function is now intentionally left mostly empty.
        // Existing cakes will retain the colors they were spawned with.
        // New cakes will pick up new palette colors via createSmallCakeElement.
        // We might still want to update something global related to cakes here in the future,
        // but not individual existing cake colors.
    }

    function removeAllRainingCakes() {
        activeRainingCakes.forEach(cakeData => {
            if (cakeData.element.parentNode === rainingCakesContainer) {
                rainingCakesContainer.removeChild(cakeData.element);
            }
        });
        activeRainingCakes = [];
        // console.log("All raining cakes removed.");
    }


    function createSmallCakeElement() {
        const cakeDiv = document.createElement('div');
        cakeDiv.className = 'small-cake';

        const base = document.createElement('div');
        base.className = 'small-cake-layer small-cake-base';
        let baseColor = getRandomColorFromPaletteUnweighted(colorPalette, '#424242'); // Use unweighted for cakes
        base.style.backgroundColor = baseColor;

        const frosting = document.createElement('div');
        frosting.className = 'small-cake-layer small-cake-frosting';
        let frostingColor = getRandomColorFromPaletteUnweighted(colorPalette, '#F5F5F5'); // Use unweighted for cakes
        frosting.style.backgroundColor = frostingColor;

        const cherries = document.createElement('div');
        cherries.className = 'small-cake-layer small-cake-cherries';
        let cherryColor;
        if (colorPalette && colorPalette.length > 1) {
            const availableForCherries = colorPalette.filter(item => item.color.toUpperCase() !== frostingColor.toUpperCase());
            if (availableForCherries.length > 0) {
                cherryColor = availableForCherries[Math.floor(Math.random() * availableForCherries.length)].color;
            } else { // All colors in palette are the same as frosting
                cherryColor = frostingColor;
            }
        } else if (colorPalette && colorPalette.length === 1) {
            cherryColor = colorPalette[0].color; // Use the color property
        } else {
            cherryColor = '#C62828'; // Fallback if palette is empty
        }
        cherries.style.backgroundColor = cherryColor; // cherryColor is now guaranteed to be a hex string


        cakeDiv.appendChild(base);
        cakeDiv.appendChild(frosting);
        cakeDiv.appendChild(cherries);

        return {
            mainElement: cakeDiv,
            baseElement: base,
            frostingElement: frosting,
            cherriesElement: cherries
        };
    }

    function spawnSmallCake() {
        if (!isBirthdayModeActive || !rainingCakesContainer || activeRainingCakes.length >= MAX_RAINING_CAKES) {
            return;
        }

        const cakeElements = createSmallCakeElement();
        const cakeDiv = cakeElements.mainElement;

        cakeDiv.style.top = `-${RAIN_CAKE_HEIGHT}px`;
        cakeDiv.style.left = `${Math.random() * (window.innerWidth - RAIN_CAKE_WIDTH)}px`;

        const cakeData = {
            element: cakeDiv,
            baseElement: cakeElements.baseElement,
            frostingElement: cakeElements.frostingElement,
            cherriesElement: cakeElements.cherriesElement,
            y: -RAIN_CAKE_HEIGHT,
            speed: getRandomFloat(RAIN_CAKE_MIN_SPEED, RAIN_CAKE_MAX_SPEED),
            rotation: Math.random() * 360,
            rotationSpeed: (Math.random() - 0.5) * 0.2 // degrees per ms
        };

        rainingCakesContainer.appendChild(cakeDiv);
        activeRainingCakes.push(cakeData);
    }

    // UI elements like color pickers and sliders will be fully initialized
    // by performInitialSceneSetupIfNeeded based on Last.fm data or defaults.
    function initializeColorPaletteUI() { 
        colorPaletteControlsContainer.innerHTML = '';

        // If colorPalette is empty (e.g., before any colors are loaded), 
        // no pickers will be generated. This is generally fine as colorPalette
        // should be populated by defaults or Last.fm before this is called meaningfully.
        if (colorPalette.length === 0) {
            // console.warn("initializeColorPaletteUI called with an empty colorPalette. No pickers will be generated.");
            // Optionally, one could add a placeholder or a single picker for the background color here.
        }

        const totalWeight = colorPalette.reduce((sum, item) => sum + item.weight, 0);
        // console.log("Total weight for palette UI:", totalWeight);
        // console.log("Current palette for UI:", JSON.parse(JSON.stringify(colorPalette)));


        for (let i = 0; i < colorPalette.length; i++) {
            const currentColorHex = colorPalette[i].color; 

            if (!currentColorHex) {
                // This case should ideally not happen if colorPalette is populated correctly.
                // console.warn(`Color at index ${i} is undefined in colorPalette.`);
                continue; 
            }

            const group = document.createElement('div');
            group.classList.add('color-input-group');
            const label = document.createElement('label');
            label.classList.add('color-picker-label'); // Added class for specific styling
            label.setAttribute('for', `color-picker-${i}`);
            
            const percentage = (totalWeight > 0) ? (colorPalette[i].weight / totalWeight) * 100 : 0;
            label.textContent = `${percentage.toFixed(1)}% Color ${i + 1}:`;

            const input = document.createElement('input');
            input.setAttribute('type', 'color');
            input.setAttribute('id', `color-picker-${i}`);
            input.value = currentColorHex; 
            input.dataset.index = i;

            input.addEventListener('input', (e) => {
                const colorIndex = parseInt(e.target.dataset.index);
                const newHexColor = e.target.value.toUpperCase();
                // Ensure the index is valid for the current colorPalette
                if (colorIndex < colorPalette.length && colorPalette[colorIndex].color.toUpperCase() !== newHexColor) {
                    scheduleOldColorCleanup(); 
                    colorPalette[colorIndex].color = newHexColor; // Update the color in the master palette, weight remains
                    updateDynamicM3ThemeColors(targetBackgroundColor, colorPalette);
                    updateAllActiveCakeColors(); 
                }
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

    // Helper function to update the blur intensity display
    function updateBlurIntensityDisplay() {
        if (blurIntensityValueDisplay && typeof currentBlurIntensity !== 'undefined') {
            const viewportMinDim = Math.min(window.innerWidth, window.innerHeight);
            const displayBlurPx = (currentBlurIntensity / SLIDER_MAX_BLUR_INTENSITY) * MAX_DESIRED_TOTAL_BLUR_VW * viewportMinDim / 100;
            let finalDisplayValue;
            const nearestMultipleOf50 = Math.round(displayBlurPx / 50) * 50;
            if (Math.abs(displayBlurPx - nearestMultipleOf50) <= 4) {
                finalDisplayValue = nearestMultipleOf50;
            } else {
                finalDisplayValue = Math.round(displayBlurPx);
            }
            blurIntensityValueDisplay.textContent = finalDisplayValue.toString();
        }
    }

    // Initialize UI values
    numShapesSlider.value = currentNumShapes;
    numShapesValueDisplay.textContent = currentNumShapes;
    scaleSlider.value = currentScaleMultiplier;
    scaleValueDisplay.textContent = currentScaleMultiplier.toFixed(1);
    rotationSlider.value = currentRotationSpeedMultiplier;
    rotationValueDisplay.textContent = currentRotationSpeedMultiplier.toFixed(1);
    speedSlider.value = currentMovementSpeedMultiplier;
    speedValueDisplay.textContent = currentMovementSpeedMultiplier.toFixed(1);

    if (numTransitionShapesSlider) {
        numTransitionShapesSlider.value = currentNumTransitionShapes;
        if (numTransitionShapesValueDisplay) {
            numTransitionShapesValueDisplay.textContent = currentNumTransitionShapes;
        }
        // Event listener for numTransitionShapesSlider is correctly placed later
    } 
    if (blurIntensitySlider) blurIntensitySlider.value = currentBlurIntensity;
    updateBlurIntensityDisplay(); // Set initial display for blur intensity

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
    const BASE_MIN_SPEED = 0.00390625; // Scaled for 16x16 (was 0.015625 for 64x64)
    const BASE_MAX_SPEED = 0.01953125; // Scaled for 16x16 (was 0.078125 for 64x64)
    const SHAPE_TYPES = ['organic']; 

    const BASE_RESOLUTION_WIDTH = 16; // The width our BASE_MIN_SPEED/MAX_SPEED are tuned for

    function calculateRenderDimensions() {
        return RESOLUTIONS[currentResolutionIndex];
    }
    const initialRenderDims = calculateRenderDimensions();
    const params = {
        type: Two.Types.webgl, 
        width: initialRenderDims.width,
        height: initialRenderDims.height,
        autostart: true 
    };
    const two = new Two(params).appendTo(canvasHost); // Append to the new innermost host
    let isPaused = false;
    let pausedByVisibility = false; // To track if pause was due to page visibility
    
    if (two.renderer && two.renderer.domElement) {
        twoJsCanvas = two.renderer.domElement;
        // Style the canvas to stretch to fill its parent (canvasHost)
        twoJsCanvas.style.width = '100%';
        twoJsCanvas.style.height = '100%';
        twoJsCanvas.style.imageRendering = 'pixelated'; // For sharp pixel look when scaled
    } else {
        console.error("Two.js canvas element not found after initialization.");
        twoJsCanvas = container.querySelector('canvas');
    }

    // Apply blur effect and then re-assert canvas 100% style for initial setup
    if (twoJsCanvas) { 
        applyBlurEffect(currentAnimatedBackgroundColor); // Apply blur which sets up parent styles
        // Re-assert 100% size on the canvas itself after DOM manipulations by applyBlurEffect
        twoJsCanvas.style.width = '100%';
        twoJsCanvas.style.height = '100%';
    } else { 
        console.warn("Two.js canvas not found for initial blur effect application. Blur effect might not apply correctly until canvas is ready.");
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
        blurLayer1.style.position = 'absolute'; // Ensure it's positioned for top/left/width/height
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
        canvasHost.style.position = 'absolute'; // Ensure it's positioned to fill its parent
        canvasHost.style.width = '100%'; // Ensure canvasHost fills its parent
        canvasHost.style.height = '100%'; // Ensure canvasHost fills its parent
        canvasHost.style.top = '0';
        canvasHost.style.left = '0';
        canvasHost.style.willChange = 'auto';

        // twoJsCanvas (the actual Two.js drawing surface) is always transparent
        twoJsCanvas.style.backgroundColor = 'transparent';
        twoJsCanvas.style.filter = 'none'; // Canvas itself never gets a direct filter

        // 3. Apply new blur effect if enabled
        if (blurToggle.checked && currentBlurIntensity > 0) {
            // BLUR IS ON
            const viewportMinDim = Math.min(window.innerWidth, window.innerHeight);
            // Calculate effective total blur in pixels based on viewport and slider intensity
            const effectiveTotalBlurPx = (currentBlurIntensity / SLIDER_MAX_BLUR_INTENSITY) * MAX_DESIRED_TOTAL_BLUR_VW * viewportMinDim / 100;
            // Calculate max blur per layer in pixels based on viewport
            const calculatedMaxBlurPerLayerPx = MAX_BLUR_PER_LAYER_VW * viewportMinDim / 100;

            // Scale blurLayer1 to provide an oversized area, preventing hard edges from blur.
            blurLayer1.style.width = '104%';
            blurLayer1.style.height = '104%';
            blurLayer1.style.top = '-2%'; // Adjust to keep it centered
            blurLayer1.style.left = '-2%'; // Adjust to keep it centered

            let remainingBlur = effectiveTotalBlurPx;
            let currentParentForNextLayer = blurLayer1;

            // Create intermediate blur layers if needed
            while (remainingBlur > calculatedMaxBlurPerLayerPx && calculatedMaxBlurPerLayerPx > 0) { // Ensure calculatedMaxBlurPerLayerPx is positive
                const dynamicLayer = document.createElement('div');
                dynamicLayer.style.position = 'absolute';
                dynamicLayer.style.width = '100%';
                dynamicLayer.style.height = '100%';
                dynamicLayer.style.top = '0';
                dynamicLayer.style.left = '0';
                dynamicLayer.style.backgroundColor = 'transparent';
                dynamicLayer.style.filter = `blur(${calculatedMaxBlurPerLayerPx}px)`;
                dynamicLayer.style.willChange = 'filter'; // Hint for performance

                currentParentForNextLayer.appendChild(dynamicLayer);
                dynamicBlurLayers.push(dynamicLayer);
                currentParentForNextLayer = dynamicLayer;
                remainingBlur -= calculatedMaxBlurPerLayerPx;
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


    // --- Event Listeners ---
    blurToggle.addEventListener('change', () => applyBlurEffect(currentAnimatedBackgroundColor));
    blurIntensitySlider.addEventListener('input', (e) => {
        currentBlurIntensity = parseInt(e.target.value); 
        updateBlurIntensityDisplay(); // Update the displayed value
        applyBlurEffect(currentAnimatedBackgroundColor); 
    });
    // Ensure numTransitionShapesSlider event listener is here if it wasn't before or was misplaced
    if (resolutionSlider) {
        resolutionSlider.min = 0;
        resolutionSlider.max = RESOLUTIONS.length - 1;
        resolutionSlider.value = currentResolutionIndex;
        if (resolutionValueDisplay) resolutionValueDisplay.textContent = RESOLUTIONS[currentResolutionIndex].label;

        resolutionSlider.addEventListener('input', (e) => {
            const newIndex = parseInt(e.target.value);
            if (newIndex !== currentResolutionIndex) {
                previousResolutionIndex = currentResolutionIndex;
                currentResolutionIndex = newIndex;
                if (resolutionValueDisplay) resolutionValueDisplay.textContent = RESOLUTIONS[currentResolutionIndex].label;
                handleChangeResolutionMode(previousResolutionIndex, currentResolutionIndex);
            }
        });
    }

    function handleChangeResolutionMode(oldIndex, newIndex) {
        const oldRes = RESOLUTIONS[oldIndex];
        const newRes = RESOLUTIONS[newIndex];
        const scalingRatio = newRes.width / oldRes.width;

        // 2. Update Two.js rendering dimensions.
        // `calculateRenderDimensions` uses the new `isHighResModeActive`.
        const newDims = calculateRenderDimensions();
        two.width = newDims.width;
        two.height = newDims.height;

        // 3. Scale positions, sizes, and speeds of existing shapes.
        const allShapeArrays = [shapesData, fadingOutShapesData, transitionShapesData];
        allShapeArrays.forEach(arr => {
            arr.forEach(sd => {
                if (sd.twoShape) {
                    // Scale position
                    sd.twoShape.translation.x *= scalingRatio;
                    sd.twoShape.translation.y *= scalingRatio;

                    // Scale size
                    if (sd.twoShape.radius !== undefined) { // Circle
                        sd.twoShape.radius *= scalingRatio;
                    } else if (sd.twoShape.width !== undefined && sd.twoShape.height !== undefined) { // Ellipse, Rectangle, RoundedRectangle
                        sd.twoShape.width *= scalingRatio;
                        sd.twoShape.height *= scalingRatio;
                    } else if (sd.twoShape.vertices && sd.twoShape.vertices.length > 0) { // Path (organic shapes)
                        // Assumes path.scale is a scalar or we want uniform scaling.
                        // Two.Path defaults to scale = 1 (scalar).
                        const currentPathScale = (typeof sd.twoShape.scale === 'number') ? sd.twoShape.scale : 1;
                        sd.twoShape.scale = currentPathScale * scalingRatio;
                    }

                    // Scale approximate dimensions used for culling
                    if (sd.approxWidth !== undefined) {
                        sd.approxWidth *= scalingRatio;
                    }
                    if (sd.approxHeight !== undefined) {
                        sd.approxHeight *= scalingRatio;
                    }
                }

                // Scale velocities
                if (sd.vx !== undefined) {
                    sd.vx *= scalingRatio;
                }
                if (sd.vy !== undefined) {
                    sd.vy *= scalingRatio;
                }
                // Rotation speed is independent of canvas resolution, so no change needed for sd.rotationSpeed
            });
        });

        // 4. Apply blur effect. This is important as it might interact with canvas dimensions
        // or its parent styling.
        if (twoJsCanvas) applyBlurEffect(currentAnimatedBackgroundColor);

        // 5. AFTER Two.js dimensions are set AND blur effect DOM might be restructured,
        //    force the canvas element's style to 100% to ensure it stretches.
        // Ensure this happens after Two.js might have set pixel styles internally.
        if (twoJsCanvas) {
            requestAnimationFrame(() => {
                if (twoJsCanvas) { // Re-check in case of any edge conditions
                    twoJsCanvas.style.width = '100%';
                    twoJsCanvas.style.height = '100%';
                }
            });
        }
        // Shapes are not repopulated; they persist with adjusted speeds.
    }
    if (numTransitionShapesSlider) {
        // This listener was correctly placed.
        numTransitionShapesSlider.addEventListener('input', (e) => {
            currentNumTransitionShapes = parseInt(e.target.value);
            if (numTransitionShapesValueDisplay) {
                numTransitionShapesValueDisplay.textContent = currentNumTransitionShapes;
            }
        }); // Closes the event listener
    } // Closes the if block
    backgroundColorPicker.addEventListener('input', (e) => {
        previousBackgroundColorForTransition = currentAnimatedBackgroundColor;
        targetBackgroundColor = e.target.value;
        backgroundColorTransitionStartTime = performance.now();
        isBackgroundTransitioning = true;
        updateAllActiveCakeColors();
        updateDynamicM3ThemeColors(targetBackgroundColor, colorPalette);
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
        pausedByVisibility = false; // User action overrides visibility pause
        if (isPaused) {
            two.pause();
            pauseResumeBtn.textContent = 'Resume Animation';
        } else {
            two.play();
            pauseResumeBtn.textContent = 'Pause Animation';
            // If resuming, ensure the animation loop's lastTime is reset to avoid a large jump
            lastTime = performance.now();
        }
    });
    deleteAllShapesBtn.addEventListener('click', () => {
        // Clear main shapes
        while (shapesData.length > 0) {
            const shapeDataToRemove = shapesData.pop();
            if (shapeDataToRemove.twoShape && shapeDataToRemove.twoShape.parent) {
                two.remove(shapeDataToRemove.twoShape);
            }
        }
        // Clear fading out shapes
        while (fadingOutShapesData.length > 0) {
            const shapeDataToRemove = fadingOutShapesData.pop();
            if (shapeDataToRemove.twoShape && shapeDataToRemove.twoShape.parent) {
                two.remove(shapeDataToRemove.twoShape);
            }
        }
        // Clear transition shapes as well, for a full reset
        while (transitionShapesData.length > 0) {
            const shapeDataToRemove = transitionShapesData.pop();
            if (shapeDataToRemove.twoShape && shapeDataToRemove.twoShape.parent) {
                two.remove(shapeDataToRemove.twoShape);
            }
        }

        if (onScreenShapeCountDisplay) onScreenShapeCountDisplay.textContent = '0';
        if (onScreenTransitionShapeCountDisplay) onScreenTransitionShapeCountDisplay.textContent = '0';

        // After clearing, adjustShapesArray will repopulate shapesData to currentNumShapes
        adjustShapesArray(); 
    });

    // --- Menu Interaction Logic ---
    if (debugMenuTitle && debugMenu && debugMenuCloseBtn && debugMenuCollapseBtn) {
        debugMenuTitle.addEventListener('mousedown', (e) => {
            // Prevent dragging if the click is on a button within the title bar
            if (e.target.closest('.window-control-button') || e.target.closest('.title-buttons-wrapper')) {
                return;
            }
            e.preventDefault(); 
            isDragging = true; debugMenu.classList.add('dragging'); 
            dragStartX = e.clientX; dragStartY = e.clientY; // Corrected: Use e.clientX/Y
            menuInitialX = debugMenu.offsetLeft; menuInitialY = debugMenu.offsetTop;
            document.addEventListener('mousemove', onDrag);
            document.addEventListener('mouseup', onDragEnd);
            menuWidthForDrag = debugMenu.offsetWidth; // Cache width
            menuHeightForDrag = debugMenu.offsetHeight; // Cache height
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
                if (debugMenuContent) {
                    debugMenuContent.scrollTop = 0; // Scroll to top
                }
            }
        }
    });
    function onDrag(e) {
        if (!isDragging) return;
        const dx = e.clientX - dragStartX; const dy = e.clientY - dragStartY;
        let newLeft = menuInitialX + dx; let newTop = menuInitialY + dy; 
        const maxLeft = window.innerWidth - menuWidthForDrag; // Use cached width
        const maxTop = window.innerHeight - menuHeightForDrag; // Use cached height
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
    const fadingOutShapesData = []; // Array for shapes being cleaned up due to palette change
    const transitionShapesData = []; // Array to hold transition shapes
    let lastTime = performance.now(); 
    let frameCountForFPS = 0;
    const fpsUpdateInterval = 1000; 
    let timeSinceLastFPSUpdate = 0;

    // --- Helper function for color cleanup ---
    function scheduleOldColorCleanup() {
        if (colorPalette.length === 0) {
            // If current palette is empty, shapes are likely using the fallback color.
            // Treat the main fallback color as the "old color" to be cleaned up if the new palette has actual colors.
            previousColorPaletteForCleanup = ['#CCCCCC']; // Default fallback for initializeShape
        } else {
            // Deep copy the current palette, ensuring uppercase for consistent comparison
            previousColorPaletteForCleanup = colorPalette.map(item => item.color.toUpperCase());
        }
        paletteChangeTimestampForCleanup = performance.now();
        cleanupTriggeredForCurrentPaletteChange = false; // A new cleanup cycle is pending
        // console.log("Cleanup scheduled. Old palette snapshot:", previousColorPaletteForCleanup);
    }

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
        if (shapeData.twoShape && shapeData.twoShape.parent) { // Check parent before removing
             two.remove(shapeData.twoShape);
        }
        shapeData.twoShape = null; // Ensure it's cleared before creating a new one
        shapeData.needsReinitialization = false; // Reset reinitialization state
        // For debugging the specific issue:
        // if (shapeData.debugId) console.log(`DEBUG ${shapeData.debugId}: initializeShape called. Old color was ${shapeData.oldColorForDebug}, new palette first color ${colorPalette[0]}`);

        shapeData.isMarkedForCleanupScaling = false; // Reset cleanup scaling state
        shapeData.cleanupScaleStartTime = 0;       // Reset cleanup scaling start time

        const shapeType = SHAPE_TYPES[getRandomInt(0, SHAPE_TYPES.length - 1)];
        const minScreenDim = Math.min(two.width, two.height) || 600; // Fallback if dimensions are 0, e.g. initial load
        // Halved factors to halve proportional scale on 512px canvas (original factors were 0.50, 1.10)
        const baseSize = getRandomFloat(minScreenDim * 0.25, minScreenDim * 0.55) * currentScaleMultiplier; 

        const chosenColorItem = getRandomColorFromPaletteWeighted(colorPalette, { color: '#CCCCCC', weight: 1 });
        const initialColorHex = chosenColorItem.color;

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

        let targetOpacity = 1.0;
        const itemWeight = chosenColorItem.weight;

        if (colorPalette.length > 0 && itemWeight > 0) {
            const totalPaletteWeight = colorPalette.reduce((sum, pItem) => sum + pItem.weight, 0);
            if (totalPaletteWeight > 0) {
                const percentageOfTotalWeight = (itemWeight / totalPaletteWeight) * 100;

                if (percentageOfTotalWeight < 15) { // Low percentage (less dominant)
                    if (Math.random() < 0.6) { // 60% chance of lower opacity
                        targetOpacity = getRandomFloat(0.5, 0.75);
                    } else {
                        targetOpacity = getRandomFloat(0.8, 1.0);
                    }
                } else if (percentageOfTotalWeight > 60) { // High percentage (more dominant)
                    targetOpacity = 1.0;
                } else { // Medium percentage
                    if (Math.random() < 0.25) { // 25% chance of slightly lower opacity
                        targetOpacity = getRandomFloat(0.75, 0.95);
                    } else {
                        targetOpacity = 1.0;
                    }
                }
            }
        }
        // Removed feathering/gradient logic. Shapes will now have a solid fill.
        newTwoShape.opacity = targetOpacity;
        newTwoShape.fill = initialColorHex;

        newTwoShape.noStroke(); 
        newTwoShape.rotation = getRandomFloat(0, Math.PI * 2);
        shapeData.twoShape = newTwoShape; 
        shapeData.rotationSpeed = getRandomFloat(BASE_MIN_ROTATION_SPEED, BASE_MAX_ROTATION_SPEED) * currentRotationSpeedMultiplier * (Math.random() > 0.5 ? 1 : -1);
        shapeData.approxWidth = approxWidth; shapeData.approxHeight = approxHeight; // Store dimensions
        
        const baseSpeedValue = getRandomFloat(BASE_MIN_SPEED, BASE_MAX_SPEED);
        const resolutionSpeedFactor = (RESOLUTIONS[currentResolutionIndex].width / BASE_RESOLUTION_WIDTH);
        const speed = baseSpeedValue * resolutionSpeedFactor * currentMovementSpeedMultiplier;
        if (isInitialShapeSpawn) {
            // For initial spawn, 50% chance to spawn in center (dispersed), 50% at an edge
            if (Math.random() < 0.5) {
                // Spawn in the center (dispersed)
                const centerX = two.width / 2;
                const centerY = two.height / 2;
                const spawnRadius = Math.min(two.width, two.height) * 0.2; // Adjust radius
                const randomAngle = Math.random() * Math.PI * 2;
                const randomDist = Math.random() * spawnRadius;
    
                newTwoShape.translation.set(
                    centerX + Math.cos(randomAngle) * randomDist,
                    centerY + Math.sin(randomAngle) * randomDist
                );
                const velocityAngle = Math.random() * Math.PI * 2; // Random direction
                shapeData.vx = Math.cos(velocityAngle) * speed;
                shapeData.vy = Math.sin(velocityAngle) * speed;
            } else {
                // Spawn at an edge
                const offScreenOffset = Math.max(approxWidth, approxHeight) * 0.7;
                const spawnConfig = spawnConfigurations[getRandomInt(0, spawnConfigurations.length - 1)];
                newTwoShape.translation.set(spawnConfig.getX(two.width, two.height, offScreenOffset), spawnConfig.getY(two.width, two.height, offScreenOffset));
                shapeData.vx = spawnConfig.getVX(speed);
                shapeData.vy = spawnConfig.getVY(speed);
            }
        } else {
            // Normal non-initial spawning (always from edges)
            const offScreenOffset = Math.max(approxWidth, approxHeight) * 0.7; 
            const spawnConfig = spawnConfigurations[getRandomInt(0, spawnConfigurations.length - 1)];
            newTwoShape.translation.set(spawnConfig.getX(two.width, two.height, offScreenOffset), spawnConfig.getY(two.width, two.height, offScreenOffset));
            shapeData.vx = spawnConfig.getVX(speed); shapeData.vy = spawnConfig.getVY(speed);
        }
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
        // Halved factors for transition shapes as well (original factors were 0.75, 1.65)
        const baseSize = getRandomFloat(minScreenDim * 0.375, minScreenDim * 0.825) * currentScaleMultiplier;
        const chosenColorItem = getRandomColorFromPaletteWeighted(colorPalette, { color: '#FFFFFF', weight: 1 });
        const initialColorHex = chosenColorItem.color;

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

        let targetOpacity = 1.0;
        const itemWeight = chosenColorItem.weight;

        if (colorPalette.length > 0 && itemWeight > 0) {
            const totalPaletteWeight = colorPalette.reduce((sum, pItem) => sum + pItem.weight, 0);
            if (totalPaletteWeight > 0) {
                const percentageOfTotalWeight = (itemWeight / totalPaletteWeight) * 100;

                if (percentageOfTotalWeight < 15) { // Low percentage (less dominant)
                    if (Math.random() < 0.6) { // 60% chance of lower opacity
                        targetOpacity = getRandomFloat(0.5, 0.75);
                    } else {
                        targetOpacity = getRandomFloat(0.8, 1.0);
                    }
                } else if (percentageOfTotalWeight > 60) { // High percentage (more dominant)
                    targetOpacity = 1.0;
                } else { // Medium percentage
                    if (Math.random() < 0.25) { // 25% chance of slightly lower opacity
                        targetOpacity = getRandomFloat(0.75, 0.95);
                    } else {
                        targetOpacity = 1.0;
                    }
                }
            }
        }
        shapeData.targetOpacity = targetOpacity; // Store calculated target opacity
        newTwoShape.fill = initialColorHex;
        newTwoShape.opacity = 0; // Start transparent, will fade in to shapeData.targetOpacity
        newTwoShape.noStroke();
        newTwoShape.rotation = getRandomFloat(0, Math.PI * 2);

        shapeData.twoShape = newTwoShape;
        shapeData.rotationSpeed = getRandomFloat(BASE_MIN_ROTATION_SPEED, BASE_MAX_ROTATION_SPEED) * currentRotationSpeedMultiplier * 1.5 * (Math.random() > 0.5 ? 1 : -1);
        shapeData.approxWidth = approxWidth;
        shapeData.approxHeight = approxHeight;
        const baseSpeedValue = getRandomFloat(BASE_MIN_SPEED, BASE_MAX_SPEED);
        const resolutionSpeedFactor = (RESOLUTIONS[currentResolutionIndex].width / BASE_RESOLUTION_WIDTH);
        const speed = baseSpeedValue * resolutionSpeedFactor * currentMovementSpeedMultiplier * 2.4; // Apply multipliers
        // Spawn off-screen using a similar mechanism to regular shapes
        const offScreenOffset = Math.max(approxWidth, approxHeight) * 0.7;
        const spawnConfig = spawnConfigurations[getRandomInt(0, spawnConfigurations.length - 1)];
        newTwoShape.translation.set(spawnConfig.getX(two.width, two.height, offScreenOffset), spawnConfig.getY(two.width, two.height, offScreenOffset));
        shapeData.vx = spawnConfig.getVX(speed); shapeData.vy = spawnConfig.getVY(speed);
        shapeData.spawnTime = performance.now(); shapeData.isFadingIn = true;
        if (!newTwoShape.parent) two.add(newTwoShape);
    }
    function adjustShapesArray() {
        // Remove excess shapes
        while (shapesData.length > currentNumShapes) {
            const shapeDataToRemove = shapesData.pop();
            if (shapeDataToRemove.twoShape && shapeDataToRemove.twoShape.parent) { // Check parent before removing
                two.remove(shapeDataToRemove.twoShape);
            }
        }
        // Add new shapes if needed
        while (shapesData.length < currentNumShapes) {
            const shapeData = { needsReinitialization: false }; // Initialize placeholder
            shapesData.push(shapeData);
            initializeShape(shapeData); // This will create and add the Two.js shape
        }
    }
    // Removed misplaced deleteAllShapesBtn listener from here

    function spawnTransitionShapes() {
        // Only spawn transition shapes if the main shape count is greater than 0
        if (currentNumShapes <= 0) return;

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
        // Cache two.width and two.height for use throughout this frame
        const currentTwoWidth = two.width;
        const currentTwoHeight = two.height;

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
        } else {
            // If not transitioning, ensure currentAnimatedBackgroundColor reflects the target.
            // This handles cases where targetBackgroundColor might change without a formal transition start.
            if (currentAnimatedBackgroundColor !== targetBackgroundColor) {
                currentAnimatedBackgroundColor = targetBackgroundColor;
            }
        }

        // Update overlay state only if background color or palette has changed
        // Note: Comparing colorPalette references is sufficient because the array reference
        // is reassigned when the palette changes (in extractAndApplyColorsFromAlbumArt and applyDefaultColors).
        if (currentAnimatedBackgroundColor !== prevFrameAnimatedBgColorForOverlay || colorPalette !== prevFrameColorPaletteForOverlay) {
            updateBackgroundOverlayState(currentAnimatedBackgroundColor);
            prevFrameAnimatedBgColorForOverlay = currentAnimatedBackgroundColor;
            prevFrameColorPaletteForOverlay = colorPalette;
        }
        
        // Conditionally update old menu elements style and theme meta tag
        // Only call these if the background color has actually changed since the last frame.
        if (currentAnimatedBackgroundColor !== previousFrameAnimatedBgColor) {
            if (typeof updateOldMenuElementsStyle === 'function') {
                updateOldMenuElementsStyle();
                updateOldMenuThemeMetaTag();
            }
            previousFrameAnimatedBgColor = currentAnimatedBackgroundColor;
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

        // --- Delayed Old Color Cleanup Logic - Part 1: Identify and mark shapes for scaling ---
        if (!cleanupTriggeredForCurrentPaletteChange && previousColorPaletteForCleanup.length > 0 && (currentTime - paletteChangeTimestampForCleanup > CLEANUP_START_DELAY)) {
            // console.log("Cleanup start delay met. Identifying shapes for scaling. Old palette:", previousColorPaletteForCleanup);
            const currentPaletteSet = new Set(colorPalette.map(item => item.color.toUpperCase())); // Set of current palette colors (uppercase)
            let shapesMovedToFadeOut = 0;

            // Iterate backwards as we are modifying shapesData by splicing
            for (let i = shapesData.length - 1; i >= 0; i--) {
                const sd = shapesData[i];
                // Ensure shape has a visual representation and isn't already being processed (though it shouldn't be if in shapesData)
                if (sd.twoShape && sd.twoShape.fill) {
                    const shapeColor = sd.twoShape.fill.toUpperCase();
    
                    // Check if the shape's color was in the old palette AND is NOT in the new palette.
                    if (previousColorPaletteForCleanup.includes(shapeColor) && !currentPaletteSet.has(shapeColor)) {
                        sd.isMarkedForCleanupScaling = true;
                        sd.cleanupScaleStartTime = currentTime;
                        sd.cleanupScaleDuration = getRandomFloat(5000, 10000); // Varied lifetime 5-10 seconds
                        
                        fadingOutShapesData.push(sd); // Move to fadingOutShapesData
                        shapesData.splice(i, 1);      // Remove from shapesData
                        shapesMovedToFadeOut++;
                    }
                }
            }

            if (shapesMovedToFadeOut > 0) {
                // console.log(`Moved ${shapesMovedToFadeOut} shapes to fadingOutShapesData.`);
                adjustShapesArray(); // Call to refill shapesData with new shapes
            }

            cleanupTriggeredForCurrentPaletteChange = true; // Mark that this palette change's cleanup has been initiated
            previousColorPaletteForCleanup = []; // Clear the old palette; shapes are now individually managed for scaling
        }

        // --- Process shapes that are fading out due to color cleanup ---
        for (let i = fadingOutShapesData.length - 1; i >= 0; i--) {
            const shapeData = fadingOutShapesData[i];
            
            if (shapeData.twoShape) { // Should always be true if logic is correct
                const elapsedScalingTime = currentTime - shapeData.cleanupScaleStartTime;
                let rawProgress = Math.min(elapsedScalingTime / shapeData.cleanupScaleDuration, 1);
                let easedProgress = easeInOutQuad(rawProgress);

                shapeData.twoShape.opacity = 1 - easedProgress;

                // Optional: Continue moving/rotating fading shapes
                shapeData.twoShape.translation.x += shapeData.vx * currentMovementSpeedMultiplier;
                shapeData.twoShape.translation.y += shapeData.vy * currentMovementSpeedMultiplier;
                shapeData.twoShape.rotation += shapeData.rotationSpeed * currentRotationSpeedMultiplier;

                // Count for on-screen display if still visible and on screen
                if (shapeData.twoShape.opacity > 0.01) {
                    const shapeHalfWidth = shapeData.approxWidth / 2;
                    const shapeHalfHeight = shapeData.approxHeight / 2;
                    const shapeLeft = shapeData.twoShape.translation.x - shapeHalfWidth;
                    const shapeRight = shapeData.twoShape.translation.x + shapeHalfWidth;
                    const shapeTop = shapeData.twoShape.translation.y - shapeHalfHeight;
                    const shapeBottom = shapeData.twoShape.translation.y + shapeHalfHeight;
                    if (shapeRight > 0 && shapeLeft < currentTwoWidth && shapeBottom > 0 && shapeTop < currentTwoHeight) {
                        currentOnScreenShapes++;
                    }
                }

                if (rawProgress >= 1) { // Fade complete
                    if (shapeData.twoShape.parent) {
                        two.remove(shapeData.twoShape);
                    }
                    fadingOutShapesData.splice(i, 1); // Remove from this array
                }
            } else {
                // Safeguard: remove if no twoShape (shouldn't happen)
                fadingOutShapesData.splice(i, 1);
            }
        }

        // --- Process regular shapes in shapesData ---
        shapesData.forEach(shapeData => {
            // Shapes in shapesData are active or placeholders.
            // Cleanup scaling is handled by the fadingOutShapesData loop.
            if (shapeData.needsReinitialization || !shapeData.twoShape) {
                // This shapeData is a placeholder or its twoShape was removed (e.g., off-screen).
                // Staggered re-initialization below will handle it.
                return;
            }

            const shape = shapeData.twoShape; // Safe to access now

            // Movement and rotation for active shapes
            shape.translation.x += shapeData.vx * currentMovementSpeedMultiplier; shape.translation.y += shapeData.vy * currentMovementSpeedMultiplier; shape.rotation += shapeData.rotationSpeed * currentRotationSpeedMultiplier;
            
            // On-screen check for counting (only for shapes not yet removed/marked)
            const shapeHalfWidth = shapeData.approxWidth / 2; const shapeHalfHeight = shapeData.approxHeight / 2;
            const shapeLeft = shape.translation.x - shapeHalfWidth; const shapeRight = shape.translation.x + shapeHalfWidth;
            const shapeTop = shape.translation.y - shapeHalfHeight; const shapeBottom = shape.translation.y + shapeHalfHeight;
            if (shapeRight > 0 && shapeLeft < currentTwoWidth && shapeBottom > 0 && shapeTop < currentTwoHeight) currentOnScreenShapes++;

            // Off-screen check for re-initialization
            const resetBuffer = Math.max(shapeData.approxWidth, shapeData.approxHeight) * 0.7;
            const isWayOffScreen = shape.translation.x < -resetBuffer || shape.translation.x > currentTwoWidth + resetBuffer || shape.translation.y < -resetBuffer || shape.translation.y > currentTwoHeight + resetBuffer;
            if (isWayOffScreen) {
                if (shape.parent) two.remove(shape); // Ensure removal from Two.js scene
                shapeData.twoShape = null;
                shapeData.needsReinitialization = true;
                // This shapeData object remains in shapesData and will be re-initialized.
                return; 
            }
        });

        // Staggered re-initialization of shapes marked as 'needsReinitialization'
        const maxReinitializationsThisFrame = Math.max(1, Math.floor(currentNumShapes / REINIT_BATCH_DIVISOR));
        let reinitializedThisFrameCount = 0;
        for (const sd of shapesData) {
            if (sd.needsReinitialization && reinitializedThisFrameCount < maxReinitializationsThisFrame && !sd.twoShape) { // Ensure we only re-init if twoShape is null
                initializeShape(sd); // This will create a new twoShape and clear needsReinitialization
                reinitializedThisFrameCount++;
            }
        }

        // --- Raining Cakes Logic ---
        if (isBirthdayModeActive && rainingCakesContainer && (currentTime - lastRainCakeSpawnTime > RAIN_CAKE_SPAWN_INTERVAL)) {
            spawnSmallCake();
            lastRainCakeSpawnTime = currentTime;
        }

        for (let i = activeRainingCakes.length - 1; i >= 0; i--) {
            const cakeData = activeRainingCakes[i];
            cakeData.y += cakeData.speed * deltaTime;
            
            cakeData.rotation += cakeData.rotationSpeed * deltaTime;
            cakeData.element.style.transform = `rotate(${cakeData.rotation}deg)`;
            cakeData.element.style.top = `${cakeData.y}px`;

            if (cakeData.y > window.innerHeight) {
                // Check if parentNode exists and is the correct container before removing
                if (cakeData.element.parentNode === rainingCakesContainer) {
                    rainingCakesContainer.removeChild(cakeData.element);
                }
                activeRainingCakes.splice(i, 1);
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
                shape.opacity = fadeInProgress * (shapeData.targetOpacity !== undefined ? shapeData.targetOpacity : 1.0);
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
                                   shape.translation.x > currentTwoWidth + resetBuffer ||
                                   shape.translation.y < -resetBuffer ||
                                   shape.translation.y > currentTwoHeight + resetBuffer;

            if (isWayOffScreen) {
                two.remove(shape);
                transitionShapesData.splice(i, 1);
                continue; 
            }
        }
        if (timeSinceLastFPSUpdate >= fpsUpdateInterval) {
            const fps = Math.round((frameCountForFPS * 1000) / timeSinceLastFPSUpdate);
            if (fpsDisplay) fpsDisplay.textContent = fps;
            if (onScreenShapeCountDisplay) {
                let displayText = `${currentOnScreenShapes}`;
                if (fadingOutShapesData.length > 0) {
                    displayText += ` (${fadingOutShapesData.length} fading out)`;
                }
                onScreenShapeCountDisplay.textContent = displayText;
            }
            if (onScreenTransitionShapeCountDisplay) {
                onScreenTransitionShapeCountDisplay.textContent = currentOnScreenTransitionShapes;
            }
            frameCountForFPS = 0; timeSinceLastFPSUpdate = 0;
        }
        // Removed per-frame update of onScreenShapeCountDisplay.textContent here.
        // It's now updated with the FPS counter.
    });

    let resizeDebounceTimer;
    const DEBOUNCE_DELAY = 250; // milliseconds

    window.addEventListener('resize', () => {
        clearTimeout(resizeDebounceTimer);
        resizeDebounceTimer = setTimeout(() => {
            const newRenderDims = calculateRenderDimensions();
            // It's important that two.width and two.height are updated immediately
            // for Two.js internal calculations, even if the visual effect (blur) is debounced.
            // However, since calculateRenderDimensions() returns fixed 64x64,
            // these lines might not even be strictly necessary if Two.js doesn't
            // re-evaluate its internal viewport based on these if they don't change.
            // For safety, we'll keep them, but the main performance gain comes from
            // debouncing applyBlurEffect.
            if (two.width !== newRenderDims.width || two.height !== newRenderDims.height) {
                two.width = newRenderDims.width;
                two.height = newRenderDims.height;
            }

            if (twoJsCanvas) {
                applyBlurEffect(currentAnimatedBackgroundColor);
                // After blur effect and potential DOM changes, re-assert 100% size on the canvas itself
                // This ensures it stretches correctly after a resize.
                twoJsCanvas.style.width = '100%';
                twoJsCanvas.style.height = '100%';
            }
            updateBlurIntensityDisplay(); // Update the displayed value as it's viewport-dependent

            // Adjust debug menu position
            if (debugMenu.offsetLeft + debugMenu.offsetWidth > window.innerWidth) debugMenu.style.left = (window.innerWidth - debugMenu.offsetWidth) + 'px';
            if (debugMenu.offsetTop + debugMenu.offsetHeight > window.innerHeight) debugMenu.style.top = (window.innerHeight - debugMenu.offsetHeight) + 'px';
            if (debugMenu.offsetLeft < 0) debugMenu.style.left = '0px';
            if (debugMenu.offsetTop < 0) debugMenu.style.top = '0px';
        }, DEBOUNCE_DELAY);
    });

    // --- Last.fm Integration Functions (moved inside DOMContentLoaded) ---
    async function fetchBpmFromAudioDB(artistToFetch, trackTitleToFetch) {
        // If the UI has already changed to a different song by the time this async function's core logic starts,
        // it's best to not proceed with this specific fetch, as a new one will be triggered for the new song.
        if (lastfmTrackDiv.textContent !== trackTitleToFetch || lastfmArtistDiv.textContent !== artistToFetch) {
            // console.log(`BPM fetch for ${artistToFetch} - ${trackTitleToFetch} aborted as UI already displays a different song.`);
            return;
        }
        // Note: The "Fetching..." message is set by updateLastFmUI before calling this.

        try {
            // Sanitize artist and track names: remove non-alphanumeric characters
            const sanitizedArtist = artistToFetch.replace(/[^a-zA-Z0-9]/g, '');
            const sanitizedTrack = trackTitleToFetch.replace(/[^a-zA-Z0-9]/g, '');

            // Construct query parameters for TheAudioDB worker: ?s=artist&t=track
            const queryParams = new URLSearchParams({
                s: sanitizedArtist,
                t: sanitizedTrack
            });
            const response = await fetch(`${AUDIO_DB_API_URL_BASE}?${queryParams.toString()}`);

            if (!response.ok) {
                let errorDetails = `status: ${response.status}, statusText: ${response.statusText}`;
                try {
                    // Try to get text first, as JSON parsing might fail for non-JSON 500 responses
                    const textBody = await response.text(); // Consume the body
                    errorDetails += `, body: ${textBody}`;
                } catch (e) {
                    errorDetails += ` (could not read error response body: ${e.message})`;
                }
                throw new Error(`TheAudioDB API error! ${errorDetails}`);
            }

            const responseText = await response.text();
            let data;
            try {
                data = JSON.parse(responseText);
            } catch (parseError) {
                console.error("Error parsing JSON from TheAudioDB:", parseError, "Raw response text:", responseText);
                throw new Error(`TheAudioDB API response was not valid JSON. Raw text: ${responseText.substring(0, 100)}...`);
            }
            // console.log("AudioDB Response:", data); // Uncomment to inspect

            let foundBpm = null;
            let resultBpmText;
            // TheAudioDB usually returns track details in an array, often `track` or `tracks`.
            // The BPM is typically in `intTrackBPM`.
            if (data.track && data.track.length > 0 && data.track[0].intTrackBPM) {
                foundBpm = parseInt(data.track[0].intTrackBPM, 10);
            } else if (data.tracks && data.tracks.length > 0 && data.tracks[0].intTrackBPM) { // Alternative common structure
                foundBpm = parseInt(data.tracks[0].intTrackBPM, 10);
            }

            if (foundBpm && !isNaN(foundBpm) && foundBpm > 0) { // BPM should be a positive number
                resultBpmText = `BPM: ${foundBpm}`;
            } else {
                resultBpmText = 'BPM: N/A';
            }

            // Update global BPM state IF this fetch was for the song that is currently marked as "being queried for BPM"
            if (artistToFetch === lastQueriedArtistForBpm && trackTitleToFetch === lastQueriedTrackForBpm) {
                lastBpmDisplayValue = resultBpmText;
            }

            // Update UI IF the song currently displayed in the UI is the one this fetch was for.
            // This handles race conditions where the UI might have changed again *during* the await fetch().
            if (lastfmTrackDiv.textContent === trackTitleToFetch && lastfmArtistDiv.textContent === artistToFetch) {
                // lastfmBpmDiv was removed
            }

        } catch (error) {
            console.error('Error fetching BPM from TheAudioDB:', error);
            const errorBpmText = 'BPM: N/A';
            if (artistToFetch === lastQueriedArtistForBpm && trackTitleToFetch === lastQueriedTrackForBpm) {
                lastBpmDisplayValue = errorBpmText;
            }
            if (lastfmTrackDiv.textContent === trackTitleToFetch && lastfmArtistDiv.textContent === artistToFetch) {
                // lastfmBpmDiv was removed
            }
        }
    }

    function updateLastFmUI(data) {
        lastfmLoadingDiv.style.display = 'none';
        lastfmErrorDiv.style.display = 'none';
        let useDefaultColors = false; // Flag to decide if default colors should be applied
        if (fetchLastFmBtn) fetchLastFmBtn.disabled = false; // Re-enable button

        if (!data || !data.recenttracks || !data.recenttracks.track || data.recenttracks.track.length === 0) {
            lastfmNowPlayingDiv.style.display = 'none';
            lastfmNotPlayingDiv.style.display = 'block';
            lastfmNotPlayingDiv.textContent = 'No recent tracks found.';
            lastfmTrackDiv.textContent = '-';
            lastfmArtistDiv.textContent = '-';
            lastfmAlbumDiv.textContent = '-';
            // lastfmBpmDiv was removed
            lastQueriedArtistForBpm = ''; // Reset BPM tracking state
            lastQueriedTrackForBpm = '';
            lastBpmDisplayValue = '';
            lastfmAlbumArtImg.src = '';
            lastfmAlbumArtImg.style.display = 'none';
            handleOldMenuLastFmUpdate(data);
            useDefaultColors = true;
            return;
        }

        const track = data.recenttracks.track[0];
        if (track && track['@attr'] && track['@attr'].nowplaying === 'true') {
            lastfmNowPlayingDiv.style.display = 'flex';
            lastfmNotPlayingDiv.style.display = 'none';

            const currentTrackName = track.name || 'Unknown Track';
            const currentArtistName = track.artist['#text'] || 'Unknown Artist';

            lastfmTrackDiv.textContent = currentTrackName;
            lastfmArtistDiv.textContent = currentArtistName;
            lastfmAlbumDiv.textContent = track.album['#text'] || 'Unknown Album';

            if (track.bpm && track.bpm !== "0") { // BPM available directly from Last.fm
                lastBpmDisplayValue = `BPM: ${track.bpm}`;
                // lastfmBpmDiv.textContent = lastBpmDisplayValue; // lastfmBpmDiv was removed
                // lastfmBpmDiv.style.display = 'block'; // lastfmBpmDiv was removed
                // Update our knowledge of this song's BPM status
                lastQueriedArtistForBpm = currentArtistName;
                lastQueriedTrackForBpm = currentTrackName;
            } else {
                // BPM not available from Last.fm, decide whether to fetch from TheAudioDB
                if (currentArtistName !== lastQueriedArtistForBpm || currentTrackName !== lastQueriedTrackForBpm) {
                    // This is a new song, or we haven't queried for this specific song before.
                    lastQueriedArtistForBpm = currentArtistName;
                    lastQueriedTrackForBpm = currentTrackName;
                    lastBpmDisplayValue = 'BPM: Fetching...'; // Set initial state for this new query
                    // lastfmBpmDiv.textContent = lastBpmDisplayValue; // lastfmBpmDiv was removed
                    // lastfmBpmDiv.style.display = 'block'; // lastfmBpmDiv was removed
                    fetchBpmFromAudioDB(currentArtistName, currentTrackName);
                } else {
                    // Same song as the last query, display the stored/previous result for it.
                    // lastBpmDisplayValue could be "Fetching...", "N/A", or an actual BPM.
                    // lastfmBpmDiv.textContent = lastBpmDisplayValue; // lastfmBpmDiv was removed
                    // lastfmBpmDiv.style.display = 'block'; // lastfmBpmDiv was removed
                }
            }
            
            const imageUrl = track.image.find(img => img.size === 'extralarge')['#text'] ||
                             track.image.find(img => img.size === 'large')['#text'] ||
                             track.image.find(img => img.size === 'medium')['#text'] || '';

            if (imageUrl) {
                if (imageUrl !== currentAlbumArtUrl) {
                    lastfmAlbumArtImg.src = imageUrl;
                    lastfmAlbumArtImg.style.display = 'block';
                    currentAlbumArtUrl = imageUrl;
                    extractAndApplyColorsFromAlbumArt(imageUrl);
                } else {
                    lastfmAlbumArtImg.style.display = 'block';
                }
            } else {
                lastfmAlbumArtImg.style.display = 'none';
                useDefaultColors = true;
                lastFmColorsExtractedSuccessfully = false;
                if (currentAlbumArtUrl !== '') { currentAlbumArtUrl = ''; }
            }
        } else { // Not currently playing
            lastfmNowPlayingDiv.style.display = 'none';
            lastfmAlbumArtImg.style.display = 'none';
            lastfmNotPlayingDiv.style.display = 'block';
            lastfmNotPlayingDiv.textContent = 'Not currently playing.';
            lastfmTrackDiv.textContent = '-';
            lastfmArtistDiv.textContent = '-';
            lastfmAlbumDiv.textContent = '-';
            // lastfmBpmDiv was removed
            lastQueriedArtistForBpm = ''; // Reset BPM tracking state
            lastQueriedTrackForBpm = '';
            lastBpmDisplayValue = '';
            lastfmAlbumArtImg.src = '';
            useDefaultColors = true;
            lastFmColorsExtractedSuccessfully = false;
            if (currentAlbumArtUrl !== '') { currentAlbumArtUrl = ''; }
        }

        if (useDefaultColors) {
            applyDefaultColors();
            lastFmColorsExtractedSuccessfully = false;
            performInitialSceneSetupIfNeeded();
        }
        handleOldMenuLastFmUpdate(data);
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
    scheduleOldColorCleanup(); // Schedule cleanup before changing the palette
    previousBackgroundColorForTransition = currentAnimatedBackgroundColor;
    targetBackgroundColor = defaultBackgroundColor;
    backgroundColorTransitionStartTime = performance.now();
    isBackgroundTransitioning = true; // Ensure transition is triggered
    colorPalette = defaultColorPalette.length > 0 ? defaultColorPalette.map(item => ({ ...item })) : []; // Deep copy
    updateAllActiveCakeColors();
    initializeColorPaletteUI(false); // Update UI pickers to show default palette (or random if defaults not loaded)
    updateDynamicM3ThemeColors(defaultBackgroundColor, defaultColorPalette);
}

function arePalettesRoughlyEqual(paletteA, paletteB) {
    if (!paletteA || !paletteB) return false; // Ensure both palettes exist
    if (paletteA.length !== paletteB.length) return false;
    if (paletteA.length === 0 && paletteB.length === 0) return true;
    // Compare both color and weight for equality
    for (let i = 0; i < paletteA.length; i++) {
        if (paletteA[i].color !== paletteB[i].color || paletteA[i].weight !== paletteB[i].weight) {
            return false;
        }
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
        updateBackgroundOverlayState(targetBackgroundColor); // Set initial overlay state
        updateDynamicM3ThemeColors(targetBackgroundColor, colorPalette); // Set M3 theme
        updateAllActiveCakeColors(); // Determine and apply colors to any existing cakes
        initializeColorPaletteUI(); // Update UI based on the now populated colorPalette
        adjustShapesArray(); // Spawn shapes
        initialSceneSetupPerformed = true; // Mark that initial setup is done
        isInitialShapeSpawn = false; // After first setup, subsequent spawns are not initial
    }

}

async function extractAndApplyColorsFromAlbumArt(imageUrl) {
    if (!imageUrl || !colorThief) return;
    lastFmColorsExtractedSuccessfully = false; // Assume failure until success
    lastFmArtProcessing = true; // Indicate that art processing has started

    const img = new Image();
    img.crossOrigin = "Anonymous"; // Important for ColorThief
    img.src = imageUrl;

    let tempColorPaletteHolder = []; // To hold colors during extraction
    img.onload = () => {
        try {
            const dominantColorRgb = colorThief.getColor(img);
            const paletteRgb = colorThief.getPalette(img, MAX_PALETTE_COLORS_TO_REQUEST);

            previousBackgroundColorForTransition = currentAnimatedBackgroundColor;
            targetBackgroundColor = rgbToHex(dominantColorRgb[0], dominantColorRgb[1], dominantColorRgb[2]).toUpperCase();
            backgroundColorTransitionStartTime = performance.now();
            isBackgroundTransitioning = true;
            
            scheduleOldColorCleanup(); // Schedule cleanup before changing the palette

            let uniquePaletteRgb = [];
            if (paletteRgb && paletteRgb.length > 0) {
                for (const candidateRgb of paletteRgb) {
                    let isUnique = true;
                    for (const existingRgb of uniquePaletteRgb) {
                        if (areColorsSimilar(candidateRgb, existingRgb, COLOR_SIMILARITY_TOLERANCE)) {
                            isUnique = false;
                            break;
                        }
                    }
                    if (isUnique) {
                        uniquePaletteRgb.push(candidateRgb);
                    }
                }
            }

            tempColorPaletteHolder = []; // Initialize to hold {color, weight} objects
            if (uniquePaletteRgb.length > 0) {
                const numUniqueColors = uniquePaletteRgb.length;
                uniquePaletteRgb.forEach((rgb, index) => {
                    tempColorPaletteHolder.push({
                        color: rgbToHex(rgb[0], rgb[1], rgb[2]).toUpperCase(),
                        weight: Math.sqrt(numUniqueColors - index) // Weight based on sqrt of dominance order
                    });
                });
            } else {
                // Fallback if no unique colors are found after filtering,
                // or if ColorThief initially returned no palette.
                let fallbackHex = '#CCCCCC';
                if (targetBackgroundColor) { // Use dominant color as the primary fallback
                    fallbackHex = targetBackgroundColor;
                } else if (paletteRgb && paletteRgb.length > 0) { // If dominant failed but original palette had something
                    fallbackHex = rgbToHex(paletteRgb[0][0], paletteRgb[0][1], paletteRgb[0][2]).toUpperCase();
                }
                tempColorPaletteHolder.push({ color: fallbackHex, weight: 1 });
            }
            colorPalette = tempColorPaletteHolder; // Assign the new dynamic palette

            console.log(`Extracted ${colorPalette.length} colors from album art.`); // Log the number of colors
            if (backgroundColorPicker) {
                backgroundColorPicker.value = targetBackgroundColor;
            }
            
            // Ensure M3 themes and cakes are updated with the new palette structure
            updateDynamicM3ThemeColors(targetBackgroundColor, colorPalette);

            if (firstLastFmColorChangeDone) {
                spawnTransitionShapes(); // Spawn only after the first successful color change
            } else {
                firstLastFmColorChangeDone = true; // Mark that the first color change has happened
            }
            updateDynamicM3ThemeColors(targetBackgroundColor, colorPalette);
            initializeColorPaletteUI(); // Update palette UI with new colors

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
            defaultBackgroundColor = rgbToHex(...colorThief.getColor(img)).toUpperCase();
            const paletteRgb = colorThief.getPalette(img, MAX_PALETTE_COLORS_TO_REQUEST);
            let uniqueDefaultPaletteRgb = [];
            
            if (paletteRgb && paletteRgb.length > 0) {
                for (const candidateRgb of paletteRgb) {
                    let isUnique = true;
                    for (const existingRgb of uniqueDefaultPaletteRgb) {
                        if (areColorsSimilar(candidateRgb, existingRgb, COLOR_SIMILARITY_TOLERANCE)) {
                            isUnique = false;
                            break;
                        }
                    }
                    if (isUnique) {
                        uniqueDefaultPaletteRgb.push(candidateRgb);
                    }
                }
            }

            if (uniqueDefaultPaletteRgb.length > 0) {
                const numUniqueColors = uniqueDefaultPaletteRgb.length;
                defaultColorPalette = uniqueDefaultPaletteRgb.map((rgb, index) => ({
                    color: rgbToHex(...rgb).toUpperCase(),
                    weight: Math.sqrt(numUniqueColors - index) // Weight based on sqrt of dominance order
                }));
            } else {
                // Fallback if ColorThief returns no palette for the default image
                // or if all colors were too similar.
                let fallbackHex = defaultBackgroundColor ? defaultBackgroundColor.toUpperCase() : '#CCCCCC';
                defaultColorPalette = [{ color: fallbackHex, weight: 1 }];
            }
            
            // Ensure M3 themes are updated if default colors are applied before Last.fm
            // updateDynamicM3ThemeColors(defaultBackgroundColor, defaultColorPalette); // This might be too early if Last.fm overrides
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
                if (debugMenuContent) {
                    debugMenuContent.scrollTop = 0; // Scroll to top
                }
                cornerImageTapCount = 0; // Reset tap count after opening
            }
        });
    }
    applyPostProcessingFilters(); // Apply initial post-processing filter state

    // --- Birthday Mode UI Setup ---
    if (birthdayModeControlGroup && birthdayModeToggle) {
        if (isJuly5th()) {
            birthdayModeControlGroup.style.display = 'flex'; // Or 'block' depending on your layout needs
            birthdayModeToggle.checked = isBirthdayModeActive;

            birthdayModeToggle.addEventListener('change', (e) => {
                isBirthdayModeActive = e.target.checked;
                if (!isBirthdayModeActive) {
                    removeAllRainingCakes();
                }
            });
        }
    }
    // --- Page Visibility API ---
    function handleVisibilityChange() {
        if (document.hidden) {
            // Page is hidden
            if (!isPaused) { // Only pause if not already paused by user
                two.pause();
                isPaused = true;
                pausedByVisibility = true;
                if (pauseResumeBtn) pauseResumeBtn.textContent = 'Resume Animation';
                console.log("Page hidden, animation paused.");
            }
            if (lastfmPollIntervalId) {
                clearInterval(lastfmPollIntervalId);
                lastfmPollIntervalId = null;
                console.log("Page hidden, Last.fm polling stopped.");
            }
        } else {
            // Page is visible
            if (isPaused && pausedByVisibility) { // Only resume if paused by visibility
                two.play();
                isPaused = false;
                pausedByVisibility = false;
                if (pauseResumeBtn) pauseResumeBtn.textContent = 'Pause Animation';
                lastTime = performance.now(); // Reset lastTime to prevent jump
                console.log("Page visible, animation resumed.");
            }
            fetchLastFmData(true); // Fetch Last.fm data immediately and restart interval
        }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange, false);

}); // End of main DOMContentLoaded
