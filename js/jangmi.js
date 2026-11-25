(() => {
  const pages = [...document.querySelectorAll('.portfolio-page')];
  const current = document.getElementById('currentPage');
  const prev = document.getElementById('prevPage');
  const next = document.getElementById('nextPage');
  let activeIndex = 0;

  const setActive = (index) => {
    activeIndex = Math.max(0, Math.min(pages.length - 1, index));
    pages.forEach((page, i) => page.classList.toggle('is-active', i === activeIndex));
    current.textContent = String(activeIndex + 1).padStart(2, '0');
  };

  const observer = new IntersectionObserver((entries) => {
    const visible = entries
      .filter(entry => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    visible.target.classList.add('is-visible');
    setActive(pages.indexOf(visible.target));
  }, { rootMargin: '-18% 0px -18% 0px', threshold: [0.25, 0.5, 0.75] });

  pages.forEach(page => observer.observe(page));

  prev.addEventListener('click', () => {
    const target = pages[Math.max(0, activeIndex - 1)];
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  next.addEventListener('click', () => {
    const target = pages[Math.min(pages.length - 1, activeIndex + 1)];
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'PageDown' || event.key === 'ArrowRight') {
      next.click();
    } else if (event.key === 'ArrowUp' || event.key === 'PageUp' || event.key === 'ArrowLeft') {
      prev.click();
    }
  });

  document.querySelectorAll('.topbar__nav a').forEach(link => {
    link.addEventListener('click', () => {
      setTimeout(() => setActive(pages.indexOf(document.querySelector(link.hash))), 250);
    });
  });
})();
