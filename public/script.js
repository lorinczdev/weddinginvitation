const canvas = document.getElementById("scratch");
const ctx = canvas.getContext("2d", { willReadFrequently: true });
const instruction = document.getElementById("instruction");
const container = document.querySelector(".heart-wrapper");

function revealImagesWhenLoaded() {
    const images = Array.from(document.querySelectorAll("img"));
    if (images.length === 0) {
        document.body.classList.add("images-ready");
        return;
    }

    let pending = images.length;
    const done = () => {
        pending -= 1;
        if (pending <= 0) {
            document.body.classList.add("images-ready");
        }
    };

    images.forEach((img) => {
        if (img.complete) {
            done();
            return;
        }
        img.addEventListener("load", done, { once: true });
        img.addEventListener("error", done, { once: true });
    });
}

revealImagesWhenLoaded();

// Zabr�n�n� necht�n�mu chov�n� v prohl�e�i
canvas.addEventListener('dragstart', (e) => e.preventDefault());
canvas.addEventListener('selectstart', (e) => e.preventDefault());

let scratching = false;
let isRevealed = false;
let sparkleIntervalsStarted = false;
const sparkleIntervalIds = [];
let startupReadyDispatched = false;
let hasInitializedCanvas = false;
let pendingInitFrame = null;
let containerResizeObserver = null;
let infoPageScrollbar = null;
/** Pixel snapshot of the scratch layer right after drawing heart.png (opaque = stíratelná plocha). */
let scratchBaseline = null;

// 1. Deklarujeme obr�zek jen JEDNOU
const heartImg = new Image();

// 2. Po�k�me na na�ten� obr�zku a pak spust�me v�e ostatn�
heartImg.onload = () => {
    scheduleCanvasInit();
};

// Pokud by se obr�zek nena�etl (chyba v cest�), spust�me to aspo� se zlatou barvou
heartImg.onerror = () => {
    console.error("Obrázek vrstvy stírání (heart) nebyl nalezen!");
    scheduleCanvasInit();
};
heartImg.src = window.__inviteScratchHeartUrl || "heart.png";

if (heartImg.complete && heartImg.naturalWidth > 0) {
    scheduleCanvasInit();
}

function getContainerSize() {
    const dpr = window.devicePixelRatio || 2;
    const rect = container.getBoundingClientRect();
    const w = Math.max(0, rect.width);
    const h = Math.max(0, rect.height);
    return { dpr, w, h };
}

function initCanvas() {
    const { dpr, w, h } = getContainerSize();
    if (w < 40 || h < 40) return false;

    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    // Draw in CSS-pixel space and let DPR handle device scaling.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, w, h);

    // 1. Necháme canvas transparentní
    ctx.clearRect(0, 0, w, h);

    // 2. Vykreslíme obrázek srdce (ten, co se maže)
    if (heartImg.complete && heartImg.naturalWidth !== 0) {
        ctx.drawImage(heartImg, 0, 0, w, h);
    }

    scratchBaseline = null;
    try {
        scratchBaseline = ctx.getImageData(0, 0, canvas.width, canvas.height);
    } catch (err) {
        console.warn("Nelze uložit baseline vrstvy stírání (CORS / bezpečnost prohlížeče).", err);
    }

    // 3. Podklad (lístky) je trvale viditelný pod vrstvou heart.png.

    // 4. ZOBRAZÍME TEXT POZVÁNKY
    const invite = document.querySelector('.invite-container');
    if (invite) {
        invite.classList.remove('hidden-at-start');
        invite.style.display = 'flex';
        invite.style.opacity = '1';
    }

    // 5. ZOBRAZÍME CELÝ OBAL
    container.classList.add('ready');
    dispatchStartupReady();
    return true;
}

function scheduleCanvasInit(attempt = 0) {
    if (pendingInitFrame !== null) {
        cancelAnimationFrame(pendingInitFrame);
    }

    pendingInitFrame = requestAnimationFrame(() => {
        pendingInitFrame = null;

        const { w, h } = getContainerSize();
        const styles = window.getComputedStyle(container);
        const aspectRatio = (styles.aspectRatio || "").replace(/\s+/g, "");
        const maxWidth = styles.maxWidth || "";
        const hasStableSize = w >= 40 && h >= 40;
        const hasExpectedStyles = aspectRatio === "1/1" && maxWidth !== "none";
        const canRetry = attempt < 30;

        if ((!hasStableSize || !hasExpectedStyles) && canRetry) {
            scheduleCanvasInit(attempt + 1);
            return;
        }

        hasInitializedCanvas = initCanvas() || hasInitializedCanvas;
    });
}

function ensureInitOnContainerResize() {
    if (containerResizeObserver || !container || typeof ResizeObserver !== "function") return;
    containerResizeObserver = new ResizeObserver(() => {
        if (!isRevealed) {
            scheduleCanvasInit();
        }
    });
    containerResizeObserver.observe(container);
}

function dispatchStartupReady() {
    if (startupReadyDispatched) return;
    startupReadyDispatched = true;
    window.dispatchEvent(new Event("invite:ready"));
}

canvas.addEventListener("pointerdown", (e) => {
    if (isRevealed) return;
    if (e.cancelable) e.preventDefault();
    scratching = true;
    canvas.setPointerCapture(e.pointerId);
    scratch(e);
});

canvas.addEventListener("pointermove", scratch);

["pointerup", "pointercancel", "pointerleave"].forEach((evt) =>
    canvas.addEventListener(evt, (e) => {
        scratching = false;
        if (canvas.hasPointerCapture(e.pointerId)) {
            canvas.releasePointerCapture(e.pointerId);
        }
    })
);

function scratch(e) {
    if (!scratching || isRevealed) return;
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();

    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX;
    const clientY = e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const insideCanvas = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;
    if (!insideCanvas) return;

    const side = Math.min(rect.width, rect.height);
    const brushRadius = Math.round(Math.min(78, Math.max(40, side * 0.15)));

    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(x, y, brushRadius, 0, Math.PI * 2);
    ctx.fill();

    checkReveal();
}

function checkReveal() {
    const base = scratchBaseline?.data;
    if (!base || base.length === 0) return;

    let opaqueInLayer = 0;
    for (let i = 3; i < base.length; i += 4) {
        if (base[i] >= 128) opaqueInLayer += 1;
    }
    if (opaqueInLayer < 80) return;

    try {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;
        let clearedFromLayer = 0;

        for (let i = 3; i < pixels.length; i += 4) {
            const wasPartOfLayer = base[i] >= 128;
            const nowGone = pixels[i] < 128;
            if (wasPartOfLayer && nowGone) clearedFromLayer += 1;
        }

        const percentage = (clearedFromLayer / opaqueInLayer) * 100;
        if (percentage > 20) {
            revealEverything();
        }
    } catch (err) {
        console.warn("Nelze změřit postup stírání.", err);
    }
}

function revealEverything() {
    if (isRevealed) return;
    isRevealed = true;
    createConfetti();

    if (instruction) {
        instruction.style.transition = "opacity 1s ease";
        instruction.style.opacity = "0";
        setTimeout(() => { instruction.style.visibility = "hidden"; }, 1000);
    }

    canvas.style.transition = "opacity 1s ease";
    canvas.style.opacity = "0";

    setTimeout(() => {
        canvas.style.display = "none";
        revealCalendarButtons();
    }, 1000);
}

function revealCalendarButtons() {
    const calWrapper = document.getElementById("calendar-wrapper");
    if (!calWrapper) return;

    calWrapper.classList.remove("hidden");
    calWrapper.style.display = "flex";
    calWrapper.style.visibility = "visible";
    calWrapper.style.opacity = "1";
    calWrapper.style.pointerEvents = "none";

    const buttons = Array.from(calWrapper.querySelectorAll(".calendar-btn"));
    buttons.forEach((button) => {
        button.style.opacity = "0";
        button.style.transform = "translateY(22px) scale(0.96)";
    });

    const animeAnimate = window.__animeAnimate;
    if (typeof animeAnimate !== "function") {
        buttons.forEach((button) => {
            button.style.opacity = "1";
            button.style.transform = "translateY(0) scale(1)";
        });
        calWrapper.style.pointerEvents = "auto";
        calWrapper.classList.add("visible");
        return;
    }

    animeAnimate(buttons, {
        opacity: [0, 1],
        translateY: [22, 0],
        scale: [0.96, 1],
        duration: 850,
        delay: (_target, index) => index * 140,
        ease: "outExpo",
        onComplete: () => {
            calWrapper.style.pointerEvents = "auto";
            calWrapper.classList.add("visible");
        }
    });
}

function createConfetti() {
    const confContainer = document.getElementById("confetti-container");
    const colors = ["#f06292", "#f48fb1", "#ec407a", "#ffd1e1", "#ffffff"];
    const hearts = ["♥", "❤", "💕"];
    const particleCount = window.matchMedia("(pointer: coarse)").matches ? 80 : 150;

    for (let i = 0; i < particleCount; i++) {
        const confetti = document.createElement("div");
        confetti.className = "confetti";
        confetti.classList.add("heart-particle");

        confetti.style.left = "50vw";
        confetti.style.top = "50vh";

        // Náhodný výběr barvy a typu srdíčka
        const color = colors[Math.floor(Math.random() * colors.length)];
        const heart = hearts[Math.floor(Math.random() * hearts.length)];
        const sizePx = Math.random() * 14 + 12;

        confetti.textContent = heart;
        confetti.style.color = color;
        confetti.style.fontSize = `${sizePx}px`;
        confetti.style.width = `${sizePx}px`;
        confetti.style.height = `${sizePx}px`;
        confetti.style.lineHeight = "1";
        confetti.style.display = "flex";
        confetti.style.alignItems = "center";
        confetti.style.justifyContent = "center";
        confetti.style.textShadow = "0 2px 6px rgba(0,0,0,0.18)";
        confetti.style.backgroundColor = "transparent";

        confContainer.appendChild(confetti);

        const angle = Math.random() * Math.PI * 2;
        const velocity = Math.random() * 600 + 200;
        const destX = Math.cos(angle) * velocity;
        const destY = Math.sin(angle) * velocity;

        // N�hodn� rotace pro efekt "m�h�n�" ve vzduchu
        const randomRotation = Math.random() * 1080 - 540;

        confetti.animate([
            {
                transform: `translate(-50%, -50%) scale(0) rotate(0deg)`,
                opacity: 1
            },
            {
                transform: `translate(calc(-50% + ${destX}px), calc(-50% + ${destY + 250}px)) scale(1) rotate(${randomRotation}deg)`,
                opacity: 0
            }
        ], {
            duration: Math.random() * 3000 + 5000, // Trv�n� 5-8 sekund
            easing: "cubic-bezier(0.1, 0.5, 0.2, 1)",
            fill: "forwards"
        }).onfinish = () => confetti.remove();
    }
}

function addSparklesToText(elementId) {
    const element = document.getElementById(elementId);
    if (!element) return;

    return setInterval(() => {
        const computed = window.getComputedStyle(element);
        if (
            computed.display === "none" ||
            computed.visibility === "hidden" ||
            Number.parseFloat(computed.opacity || "1") < 0.05
        ) {
            return;
        }

        const rect = element.getBoundingClientRect();
        if (
            rect.width < 2 ||
            rect.height < 2 ||
            rect.bottom < 0 ||
            rect.right < 0 ||
            rect.top > window.innerHeight ||
            rect.left > window.innerWidth
        ) {
            return;
        }

        const sparkle = document.createElement("div");
        sparkle.className = "sparkle";

        // N�hodn� pozice v r�mci textu
        const x = rect.left + Math.max(2, Math.random() * rect.width);
        const y = rect.top + Math.max(2, Math.random() * rect.height);
        sparkle.style.position = "fixed";
        sparkle.style.left = `${x}px`;
        sparkle.style.top = `${y}px`;

        // N�hodn� animace
        sparkle.style.animation = `sparkleAnim ${Math.random() * 0.55 + 0.65}s ease-out forwards`;
        sparkle.style.width = `${Math.random() * 5 + 4}px`;
        sparkle.style.height = sparkle.style.width;
        sparkle.style.opacity = `${Math.random() * 0.35 + 0.65}`;
        sparkle.style.setProperty("--sparkle-rotate", `${Math.random() * 360}deg`);

        document.body.appendChild(sparkle);
        animateSparkle(sparkle);
    }, 120); // Jak rychle se jiskry objevuj� (men�� ��slo = v�c jisk�en�)
}

function animateSparkle(sparkle) {
    const animeAnimate = window.__animeAnimate;
    if (typeof animeAnimate !== "function") {
        sparkle.style.animation = `sparkleAnim ${Math.random() * 0.55 + 0.65}s ease-out forwards`;
        setTimeout(() => sparkle.remove(), 1100);
        return;
    }

    const baseRotation = Math.random() * 360;
    animeAnimate(sparkle, {
        rotate: [`${baseRotation}deg`, `${baseRotation + Math.random() * 65 - 32.5}deg`],
        scale: [0, 1.55, 0],
        opacity: [0, 1, 0],
        duration: Math.random() * 260 + 700,
        ease: "outExpo",
        onComplete: () => sparkle.remove()
    });
}

// Spust�me jisk�en� pro nadpis a instrukce
function startSparkles() {
    if (sparkleIntervalsStarted) return;
    sparkleIntervalsStarted = true;
    const mainTitle = document.getElementById("main-title");
    if (mainTitle) {
        mainTitle.style.removeProperty("position");
    }
    sparkleIntervalIds.push(addSparklesToText("main-title"));
    sparkleIntervalIds.push(addSparklesToText("initials"));
    sparkleIntervalIds.push(addSparklesToText("wedding-date"));
}

startSparkles();

function stopSparkles() {
    while (sparkleIntervalIds.length > 0) {
        const intervalId = sparkleIntervalIds.pop();
        if (intervalId) clearInterval(intervalId);
    }
    sparkleIntervalsStarted = false;
}

function stopHeroAnimations() {
    stopSparkles();
    const waveAnimation = window.__instructionWaveAnimation;
    if (waveAnimation && typeof waveAnimation.pause === "function") {
        waveAnimation.pause();
    }
}

/*
function downloadIcs() {
    // Definice ud�losti (bez diakritiky pro maxim�ln� kompatibilitu)
    const title = "Svatba Anicky a Pitra";
    const location = "Zahradni a plesovy dum, Teplice";
    const startDate = "20260606T130000";
    const endDate = "20260606T235900";

    // Sestaven� obsahu ICS souboru
    const icsContent = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "BEGIN:VEVENT",
        "DTSTART:" + startDate,
        "DTEND:" + endDate,
        "SUMMARY:" + title,
        "LOCATION:" + location,
        "END:VEVENT",
        "END:VCALENDAR"
    ].join("\n");

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);

    // Vytvo�en� skryt�ho odkazu
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'svatba.ics');

    // Trik pro iPhone: p�id�n� do dokumentu a vynucen� kliknut�
    document.body.appendChild(link);
    link.click();

    // Vy�i�t�n� pam�ti
    setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    }, 200);
}
*/

function addToCalendar() {
    const title = "Svatba Aničky a Péti";
    const details = "Zveme Vás na naši svatbu v kostele sv. Jana Křtitele v Teplicích.";
    const location = "Zámecké nám. 135, 415 01 Teplice 1";
    const startDate = "20260606T130000";
    const endDate = "20260606T235900";

    // 1. Zjistíme, zda je uživatel na zařízení od Apple (iPhone, iPad, Mac)
    const isApple = /iPhone|iPad|iPod|Macintosh/i.test(navigator.userAgent);

    if (isApple) {
        // Pro Apple vytvoříme soubor .ics (v kalendáři se otevře jako nová událost)
        const icsContent = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "BEGIN:VEVENT",
            "URL:" + document.URL,
            "DTSTART:" + startDate,
            "DTEND:" + endDate,
            "SUMMARY:" + title,
            "DESCRIPTION:" + details,
            "LOCATION:" + location,
            "END:VEVENT",
            "END:VCALENDAR"
        ].join("\n");

        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
        const url = window.URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'svatba.ics');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } else {
        // Pro ostatní (Android, PC) použijeme Google Calendar link
        const googleUrl = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${startDate}/${endDate}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(location)}&sf=true&output=xml`;
        window.open(googleUrl, '_blank');
    }

}


const form = document.getElementById('rsvp-form');
if (form) {
    form.addEventListener('submit', function (e) {
        // Necháme Formspree, aby udělalo svou práci (odeslání)
        // Ale přidáme malý trik, aby uživatel viděl potvrzení přímo u nás

        const formContainer = document.getElementById('rsvp-form');

        // Počkáme vteřinu a pak schováme formulář a ukážeme díky
        setTimeout(() => {
            formContainer.innerHTML = `
                <div style="text-align: center; padding: 20px; animation: fadeIn 1s;">
                    <h3 style="font-family: 'Great Vibes', cursive; color: #b8860b; font-size: 2.5rem;">Děkujeme!</h3>
                    <p style="font-family: 'Archivo Narrow', sans-serif;">Vaše odpověď byla v pořádku odeslána. <br> Moc se na Vás těšíme!</p>
                </div>
            `;
        }, 500);
    });
}

function startCountdown() {
    const targetDate = new Date(2026, 5, 6, 10, 0, 0).getTime();

    const timerInterval = setInterval(() => {
        const now = new Date().getTime();
        const diff = targetDate - now;

        if (diff < 0) {
            clearInterval(timerInterval);
            document.querySelectorAll("#countdown, .countdown-container").forEach(el => {
                el.innerHTML = "<span style='color:#b8860b; font-size:1.2rem;'>Dnes je náš den! 💕</span>";
            });
            return;
        }

        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);

        // 1. Aktualizace hlavní stránky (ID jsou unikátní)
        const d1 = document.getElementById("days");
        const h1 = document.getElementById("hours");
        const m1 = document.getElementById("minutes");
        const s1 = document.getElementById("seconds");

        if (d1) d1.innerText = d;
        if (h1) h1.innerText = h.toString().padStart(2, '0');
        if (m1) m1.innerText = m.toString().padStart(2, '0');
        if (s1) s1.innerText = s.toString().padStart(2, '0');

        // 2. Aktualizace VŠECH ostatních stránek (pomocí tříd)
        // querySelectorAll najde všechny výskyty a .forEach je všechny naráz přepíše
        document.querySelectorAll(".days-val").forEach(el => el.innerText = d);
        document.querySelectorAll(".hours-val").forEach(el => el.innerText = h.toString().padStart(2, '0'));
        document.querySelectorAll(".minutes-val").forEach(el => el.innerText = m.toString().padStart(2, '0'));
        document.querySelectorAll(".seconds-val").forEach(el => el.innerText = s.toString().padStart(2, '0'));

    }, 1000);
}

// ... (ponech začátek se stíráním až po funkci revealEverything beze změny) ...

function showInfo() {
    const mainTitle = document.getElementById("main-title");
    const initials = document.getElementById("initials");
    const heart = document.querySelector(".heart-wrapper");
    const instruction = document.getElementById("instruction");
    const calendar = document.getElementById("calendar-wrapper");
    const infoPage = document.getElementById("info-page");

    stopHeroAnimations();

    // Skryjeme úvod
    [mainTitle, initials, heart, instruction].forEach(element => {
        if (element) element.style.display = "none";
    });
    if (calendar) {
        calendar.classList.add("hidden");
        calendar.style.display = "none";
    }
    if (infoPage) {
        infoPage.classList.remove("hidden");
        infoPage.style.display = "flex";
        window.scrollTo(0, 0);
        if (infoPageScrollbar && typeof infoPageScrollbar.update === "function") {
            infoPageScrollbar.update(true);
        }
    }
}

function setupModernScrollbar() {
    const infoPage = document.getElementById("info-page");
    const createOverlayScrollbars = window.__OverlayScrollbars;
    if (!infoPage || typeof createOverlayScrollbars !== "function") return;
    if (infoPageScrollbar) return;

    infoPageScrollbar = createOverlayScrollbars(infoPage, {
        overflow: {
            x: "hidden",
        },
        scrollbars: {
            autoHide: "scroll",
            autoHideDelay: 650,
            theme: "os-theme-light"
        }
    });
}

function setupDresscodeLightbox() {
    const galleryImages = Array.from(document.querySelectorAll(".dress-gallery-img"));
    if (galleryImages.length === 0) return;

    const lightbox = document.createElement("div");
    lightbox.className = "dress-lightbox";
    lightbox.setAttribute("aria-hidden", "true");
    lightbox.setAttribute("role", "dialog");

    const previewImage = document.createElement("img");
    previewImage.className = "dress-lightbox-image";
    previewImage.alt = "";

    const closeButton = document.createElement("button");
    closeButton.className = "dress-lightbox-close";
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "Zavřít náhled obrázku");
    closeButton.textContent = "×";

    lightbox.append(previewImage, closeButton);
    document.body.appendChild(lightbox);

    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const zoomBounds = { min: 1, max: 4 };
    const zoomStep = 0.25;
    const zoomToggle = 2;

    let scale = 1;
    let panX = 0;
    let panY = 0;
    let pointerId = null;
    let dragStartX = 0;
    let dragStartY = 0;
    let startPanX = 0;
    let startPanY = 0;

    const updateTransform = () => {
        previewImage.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
        lightbox.classList.toggle("is-zoomed", scale > 1);
    };

    const resetView = () => {
        scale = 1;
        panX = 0;
        panY = 0;
        previewImage.classList.remove("is-dragging");
        updateTransform();
    };

    const closeLightbox = () => {
        lightbox.classList.remove("is-open");
        lightbox.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
        resetView();
    };

    const openLightbox = (sourceImage) => {
        previewImage.src = sourceImage.currentSrc || sourceImage.src;
        previewImage.alt = sourceImage.alt || "Dress code inspirace";
        resetView();
        lightbox.classList.add("is-open");
        lightbox.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
    };

    galleryImages.forEach((image) => {
        image.addEventListener("click", () => openLightbox(image));
    });

    [
        { button: "[data-dress-women-more]", imageId: "dress-women-second-img" },
        { button: "[data-dress-men-more]", imageId: "dress-men-second-img" }
    ].forEach(({ button, imageId }) => {
        const moreBtn = document.querySelector(button);
        const targetImg = document.getElementById(imageId);
        if (!moreBtn || !targetImg) return;
        moreBtn.addEventListener("click", () => openLightbox(targetImg));
    });

    closeButton.addEventListener("click", closeLightbox);

    lightbox.addEventListener("click", (event) => {
        if (event.target !== lightbox) return;
        closeLightbox();
    });

    document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;
        closeLightbox();
    });

    previewImage.addEventListener("wheel", (event) => {
        event.preventDefault();
        const direction = event.deltaY > 0 ? -1 : 1;
        scale = clamp(scale + direction * zoomStep, zoomBounds.min, zoomBounds.max);
        if (scale === 1) {
            panX = 0;
            panY = 0;
        }
        updateTransform();
    }, { passive: false });

    previewImage.addEventListener("dblclick", (event) => {
        event.preventDefault();
        scale = scale > 1 ? 1 : zoomToggle;
        if (scale === 1) {
            panX = 0;
            panY = 0;
        }
        updateTransform();
    });

    previewImage.addEventListener("pointerdown", (event) => {
        if (scale <= 1) return;
        pointerId = event.pointerId;
        dragStartX = event.clientX;
        dragStartY = event.clientY;
        startPanX = panX;
        startPanY = panY;
        previewImage.classList.add("is-dragging");
        previewImage.setPointerCapture(pointerId);
    });

    previewImage.addEventListener("pointermove", (event) => {
        const isActivePointer = pointerId !== null && event.pointerId === pointerId;
        if (!isActivePointer) return;
        panX = startPanX + (event.clientX - dragStartX);
        panY = startPanY + (event.clientY - dragStartY);
        updateTransform();
    });

    const stopDragging = (event) => {
        const isActivePointer = pointerId !== null && event.pointerId === pointerId;
        if (!isActivePointer) return;
        previewImage.releasePointerCapture(pointerId);
        pointerId = null;
        previewImage.classList.remove("is-dragging");
    };

    previewImage.addEventListener("pointerup", stopDragging);
    previewImage.addEventListener("pointercancel", stopDragging);
}

startCountdown();

window.addEventListener("resize", () => {
    if (!isRevealed) initCanvas();
});

function setupBackgroundMusic() {
    const audio = document.getElementById("invite-bg-audio");
    const muteBtn = document.getElementById("music-mute");
    const volumeInput = document.getElementById("music-volume");
    if (!audio || !muteBtn || !volumeInput) return;

    const controls = muteBtn.closest(".music-controls");

    const storage = {
        volume: "inviteBgMusicVol",
        muted: "inviteBgMusicMuted",
        playing: "inviteBgMusicPlaying",
    };

    const readStored = (key, fallback) => {
        try {
            return localStorage.getItem(key) ?? fallback;
        } catch {
            return fallback;
        }
    };

    const writeStored = (key, value) => {
        try {
            localStorage.setItem(key, value);
        } catch {
            /* ignore */
        }
    };

    const persistPlaybackIntent = () => {
        if (audio.played.length === 0) return;
        writeStored(storage.playing, !audio.paused ? "1" : "0");
    };

    const persist = () => {
        writeStored(storage.volume, String(audio.volume));
        writeStored(storage.muted, audio.muted ? "1" : "0");
        persistPlaybackIntent();
    };

    const tryPlay = () => {
        const playAttempt = audio.play();
        if (playAttempt && typeof playAttempt.catch === "function") {
            playAttempt.catch(() => {});
        }
    };

    const setMutedUi = (muted) => {
        muteBtn.setAttribute("aria-pressed", muted ? "true" : "false");
        muteBtn.classList.toggle("is-muted", muted);
    };

    const syncPlayingState = () => {
        if (!controls) return;
        const audible = !audio.paused && !audio.muted;
        controls.classList.toggle("music-controls--playing", audible);
    };

    const syncAudioFromElement = () => {
        writeStored(storage.volume, String(audio.volume));
        writeStored(storage.muted, audio.muted ? "1" : "0");
        persistPlaybackIntent();
        syncPlayingState();
    };

    const storedWantPlaying = readStored(storage.playing, "1") === "1";

    const rawVol = Number.parseFloat(readStored(storage.volume, "0.35"));
    const vol = Number.isFinite(rawVol) ? Math.min(1, Math.max(0, rawVol)) : 0.35;
    volumeInput.value = String(vol);
    audio.volume = vol;
    audio.muted = readStored(storage.muted, "0") === "1";
    setMutedUi(audio.muted);
    syncPlayingState();

    ["play", "pause", "ended", "volumechange"].forEach((type) => {
        audio.addEventListener(type, syncAudioFromElement);
    });

    muteBtn.addEventListener("click", () => {
        audio.muted = !audio.muted;
        setMutedUi(audio.muted);
        persist();
        tryPlay();
    });

    volumeInput.addEventListener("input", () => {
        const next = Number.parseFloat(volumeInput.value);
        audio.volume = Number.isFinite(next) ? next : audio.volume;
        audio.muted = false;
        setMutedUi(false);
        persist();
        tryPlay();
    });

    const unlockPlayback = () => tryPlay();
    const unlockOnceOpts = { capture: true, once: true };
    document.addEventListener("pointerdown", unlockPlayback, unlockOnceOpts);
    document.addEventListener("keydown", unlockPlayback, unlockOnceOpts);

    window.addEventListener("pagehide", () => {
        persist();
    });

    if (storedWantPlaying) {
        tryPlay();
    }
    window.addEventListener("pageshow", (event) => {
        if (!event.persisted) return;
        if (readStored(storage.playing, "1") !== "1") return;
        tryPlay();
    });
}

window.addEventListener("DOMContentLoaded", () => {
    ensureInitOnContainerResize();
    if (!hasInitializedCanvas) scheduleCanvasInit();
    setupModernScrollbar();
    setupDresscodeLightbox();
    setupBackgroundMusic();
});

window.addEventListener("load", () => {
    if (!hasInitializedCanvas) scheduleCanvasInit();
});
