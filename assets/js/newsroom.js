document.addEventListener("DOMContentLoaded", function () {
  var bar = document.querySelector("[data-reading-progress]");
  if (!bar) return;

  var content = document.querySelector(".page__content");
  if (!content) return;

  var updateProgress = function () {
    var contentRect = content.getBoundingClientRect();
    var contentTop = contentRect.top + window.scrollY;
    var contentBottom = contentRect.bottom + window.scrollY;
    var viewport = window.innerHeight;
    var start = contentTop;
    var end = contentBottom - viewport;
    var progress = 0;

    if (end <= start) {
      progress = 1;
    } else {
      progress = (window.scrollY - start) / (end - start);
      progress = Math.min(Math.max(progress, 0), 1);
    }

    bar.style.width = (progress * 100).toFixed(2) + "%";
  };

  updateProgress();
  document.addEventListener("scroll", updateProgress, { passive: true });
  window.addEventListener("resize", updateProgress);
});
