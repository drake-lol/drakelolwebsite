let img = new Image(),
    d = 1.5,
    defaultImage = 'assets/bgimg/full_blue_square_512.png',
    faviconImage = 'assets/favicon/full_blue_trans_square_128.png', // Path to transparent favicon
    state = "",
    c, x, w, h, R, C, I, qW, qH, frame, user;
let averageColor = "#000000";
let dominantColor = "#000000";
img.crossOrigin = "Anonymous";
img.src = defaultImage;

const O = (r, c, q, f) => {
    const v = f ? 0.3 : 0.2,
        m = f ? 0.6 : 0.8,
        s = m + Math.random() * 2 * v;
    return {
        x: c * (w / d) + (q % 2) * qW,
        y: r * (h / d) + ~~(q / 2) * qH,
        r: 360 * Math.random(),
        rS: (Math.random() - 0.5) * 0.25,
        s,
        S: w * s,
        H: h * s,
        B: c * (w / d),
        Y: r * (h / d),
        q,
        f
    };
};

const G = () => {
    document.documentElement.style.setProperty("--g", `${document.querySelector(".b-c").getBoundingClientRect().bottom + 25}px`);
    document.querySelector(".g").classList.add("i");
};

const init = () => {
    if (!c) {
        c = document.getElementById("c");
        x = c.getContext("2d");
        const o = window.devicePixelRatio || 1;
        c.width = innerWidth * o;
        c.height = innerHeight * o;
        x.scale(o, o);
    }
    w = img.width;
    h = img.height;
    C = Math.ceil(c.width / 2 / (w / d));
    R = Math.ceil(c.height / 2 / (h / d));
    qW = C * (w / d);
    qH = R * (h / d);
    I = [];
    for (let e = 0; e < 4; e++) {
        for (let t = 0; t < R; t++) {
            for (let n = 0; n < C; n++) {
                I.push(O(t, n, e));
                if (Math.random() < 0.3) {
                    I.push(O(t, n, e, !0));
                }
            }
        }
    }
    I.sort((e, t) => e.f - t.f);
    G();
    calculateColors();
    updateThemeAndFavicon();
    draw();
};

const draw = () => {
    cancelAnimationFrame(frame);
    I = I.filter(t => {
        t.r += t.rS;
        t.x = t.B + (t.q % 2) * qW;
        t.y = t.Y + ~~(t.q / 2) * qH;
        return !(t.x + t.S < -2 * innerWidth || t.y + t.H < -2 * innerHeight || t.x > 3 * innerWidth || t.y > 3 * innerHeight);
    });

    for (let e = 0; e < 4; e++) {
        for (let t = 0; t < R; t++) {
            for (let n = 0; n < C; n++) {
                if ((e % 2 == 0 && I.every(i => Math.abs(i.x - (n * (w / d))) > w)) ||
                    (e % 2 != 0 && I.every(i => Math.abs(i.x - ((C + n) * (w / d))) > w))) {
                    if (e < 2) {
                        if (I.every(i => Math.abs(i.y - (t * (h / d))) > h)) {
                            I.push(O(t, n, e));
                        }
                    } else {
                        if (I.every(i => Math.abs(i.y - ((R + t) * (h / d))) > h)) {
                            I.push(O(t, n, e));
                        }
                    }
                }
            }
        }
    }

    I.sort((e, t) => e.f - t.f);
    x.clearRect(0, 0, c.width, c.height);
    x.save();
    x.beginPath();
    x.rect(0, 0, c.width, c.height);
    x.clip();
    I.forEach(e => {
        x.save();
        x.translate(e.x, e.y);
        x.rotate(e.r * Math.PI / 180);
        x.scale(e.s, e.s);
        x.drawImage(img, -w / 2, -h / 2, w, h);
        x.restore();
    });
    x.restore();
    frame = requestAnimationFrame(draw);
};

const lastFmButton = document.getElementById('lastfm-button');
const lastFmApiUrl = 'https://lastfm-red-surf-3b97.damp-unit-21f3.workers.dev/';

const calculateColors = () => {
    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");
    tempCanvas.width = img.width;
    tempCanvas.height = img.height;
    tempCtx.drawImage(img, 0, 0, img.width, img.height);
    const imageData = tempCtx.getImageData(0, 0, img.width, img.height).data;

    let totalR = 0, totalG = 0, totalB = 0;
    const colorCounts = {};

    for (let i = 0; i < imageData.length; i += 4) {
        const r = imageData[i];
        const g = imageData[i + 1];
        const b = imageData[i + 2];
        totalR += r;
        totalG += g;
        totalB += b;
        const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
        colorCounts[hex] = (colorCounts[hex] || 0) + 1;
    }

    const pixelCount = img.width * img.height;
    const avgR = Math.round(totalR / pixelCount);
    const avgG = Math.round(totalG / pixelCount);
    const avgB = Math.round(totalB / pixelCount);
    averageColor = `#${avgR.toString(16).padStart(2, '0')}${avgG.toString(16).padStart(2, '0')}${avgB.toString(16).padStart(2, '0')}`;

    let maxCount = 0;
    for (const hex in colorCounts) {
        if (colorCounts[hex] > maxCount) {
            maxCount = colorCounts[hex];
            dominantColor = hex;
        }
    }
};

const updateThemeAndFavicon = () => {
    document.querySelector('meta[name="theme-color"]').setAttribute("content", averageColor);
};

// Function to darken a hex color
const darkenColor = (hex, factor) => {
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);

    r = Math.max(0, Math.floor(r * factor));
    g = Math.max(0, Math.floor(g * factor));
    b = Math.max(0, Math.floor(b * factor));

    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};


// Function to create the combined favicon
const updateFavicon = (coverArtUrl, isPlaying) => {
    const faviconCanvas = document.createElement('canvas');
    faviconCanvas.width = 128;
    faviconCanvas.height = 128;
    const faviconCtx = faviconCanvas.getContext('2d');

    const transparentFavicon = new Image();
    transparentFavicon.crossOrigin = "Anonymous";
    transparentFavicon.src = faviconImage;

    transparentFavicon.onload = () => {
        if (isPlaying && coverArtUrl) {
            const coverArt = new Image();
            coverArt.crossOrigin = "Anonymous";
            coverArt.src = coverArtUrl;

            coverArt.onload = () => {
                // Darken the average color for the background
                const darkenedAverageColor = darkenColor(averageColor, 0.7); //Darken by 30%

                // Draw darkened average color as background
                faviconCtx.fillStyle = darkenedAverageColor;
                faviconCtx.fillRect(0, 0, 128, 128);

                // Apply blur and darken
                faviconCtx.filter = 'blur(8px) brightness(0.7)';
                faviconCtx.drawImage(coverArt, 0, 0, 128, 128);
                faviconCtx.filter = 'none'; // Reset filter

                // Draw the transparent favicon on top
                faviconCtx.drawImage(transparentFavicon, 0, 0, 128, 128);
                setFavicon(faviconCanvas);
            };
        } else {
            // If no cover art, just draw the transparent favicon
            faviconCtx.drawImage(transparentFavicon, 0, 0, 128, 128);
            setFavicon(faviconCanvas);
        }
    };
};

const setFavicon = (canvas) => {
    const faviconLink = document.querySelector('link[rel="icon"]');
    faviconLink.type = 'image/png';
    faviconLink.href = canvas.toDataURL('image/png');
}

const updateLastFm = async () => {
    try {
        const response = await fetch(lastFmApiUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        const isPlaying = data.recenttracks?.track?.[0]?.["@attr"]?.nowplaying === "true";
        user = data.recenttracks?.["@attr"]?.user || user;

        if (isPlaying) {
            const track = data.recenttracks.track[0];
            lastFmButton.textContent = `Listening to ${track.name} by ${track.artist["#text"]}`;
            lastFmButton.href = track.url || `https://last.fm/user/${user}`;

            let imageUrl = track.image[track.image.length - 1]["#text"] || defaultImage;
            if (imageUrl.includes("2a96cbd8b46e442fc41c2b86b821562f")) {
                imageUrl = defaultImage;
            }

            if (imageUrl !== img.src) {
                const lastFmImage = new Image();
                lastFmImage.crossOrigin = "Anonymous";
                lastFmImage.onload = () => {
                    img.src = lastFmImage.src;
                    calculateColors();
                    updateThemeAndFavicon();
                    draw();
                    updateFavicon(imageUrl, isPlaying);
                };
                lastFmImage.src = imageUrl;
            } else {
                updateFavicon(imageUrl, isPlaying);
            }

            state = "playing";

        } else {
            lastFmButton.textContent = "Last.fm";
            lastFmButton.href = user ? `https://www.last.fm/user/${user}` : "#";
            if (state !== "Last.fm") {
                img.src = defaultImage;
                calculateColors();
                updateThemeAndFavicon();
                init();
                updateFavicon(null, isPlaying);
                state = "Last.fm";
            }
        }

    } catch (error) {
        console.error("Error fetching Last.fm data:", error);
        lastFmButton.textContent = "Last.fm";
        lastFmButton.href = "#";
        if (state !== "Error") {
            img.src = defaultImage;
            init();
            state = "Error";
            updateFavicon(null, false);
        }
    }
};

// Initial setup:
img.onload = init;

updateLastFm();
setInterval(updateLastFm, 10000);

document.querySelectorAll('.b').forEach(e => e.addEventListener('contextmenu', e => e.preventDefault()));
window.addEventListener('resize', G);