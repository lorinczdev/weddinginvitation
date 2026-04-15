import { createApp } from "vue";
import { animate } from "animejs";
import { OverlayScrollbars } from "overlayscrollbars";
import "overlayscrollbars/styles/overlayscrollbars.css";
import "./style.scss";
import "./invite.js";

createApp({}).mount("#vue-app");
window.__animeAnimate = animate;
window.__OverlayScrollbars = OverlayScrollbars;

function startInstructionIconAnimation() {
  const iconEl = document.getElementById("instruction-icon");
  if (!iconEl || iconEl.dataset.waveStarted === "1") return;
  iconEl.dataset.waveStarted = "1";

  window.__instructionWaveAnimation = animate(iconEl, {
    rotate: "14deg",
    duration: 320,
    loop: true,
    alternate: true,
    ease: "inOutSine",
  });
}

// Chrome-safe startup sequence (handles caching/timing edge cases).
startInstructionIconAnimation();
window.addEventListener("DOMContentLoaded", startInstructionIconAnimation);
window.addEventListener("load", startInstructionIconAnimation);
