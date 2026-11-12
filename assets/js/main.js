import SiteSearch from './search.js';

class MobileMenu {
  constructor() {
    this.initElements();
    this.bindEvents();
  }

  initElements() {
    this.mobileMenuBtn = document.getElementById('mobile-menu-btn');
    this.mobileMenuOverlay = document.getElementById('mobile-menu-overlay');
    this.mobileMenuSidebar = document.getElementById('mobile-menu-sidebar');
    this.mobileMenuBackdrop = document.getElementById('mobile-menu-backdrop');
    this.mobileMenuClose = document.getElementById('mobile-menu-close');

    this.startX = 0;
    this.currentX = 0;
    this.isDragging = false;
  }

  bindEvents() {
    this.mobileMenuBtn.addEventListener('click', () => this.open());
    this.mobileMenuClose.addEventListener('click', () => this.close());
    this.mobileMenuBackdrop.addEventListener('click', () => this.close());

    // Touch gestures
    this.mobileMenuBackdrop.addEventListener('touchstart', (e) => this.handleTouchStart(e));
    this.mobileMenuBackdrop.addEventListener('touchmove', (e) => this.handleTouchMove(e));
    this.mobileMenuBackdrop.addEventListener('touchend', (e) => this.handleTouchEnd(e));
  }

  open() {
    document.body.style.overflow = 'hidden';
    this.mobileMenuOverlay.classList.remove('hidden');
    requestAnimationFrame(() => {
      this.mobileMenuBackdrop.classList.remove('opacity-0');
      this.mobileMenuBackdrop.classList.add('opacity-100');
      this.mobileMenuSidebar.classList.remove('-translate-x-full');
      this.mobileMenuSidebar.classList.add('translate-x-0');
      // The drawer is hidden at load, so bring the current page into view now.
      [...this.mobileMenuSidebar.querySelectorAll('.active-nav-item')].pop()
        ?.scrollIntoView({ block: 'center' });
    });
  }

  close() {
    document.body.style.overflow = '';
    this.mobileMenuBackdrop.classList.remove('opacity-100');
    this.mobileMenuBackdrop.classList.add('opacity-0');
    this.mobileMenuSidebar.classList.remove('translate-x-0');
    this.mobileMenuSidebar.classList.add('-translate-x-full');
    setTimeout(() => {
      this.mobileMenuOverlay.classList.add('hidden');
    }, 300);
  }

  handleTouchStart(e) {
    this.startX = e.touches[0].clientX;
    this.isDragging = true;
  }

  handleTouchMove(e) {
    if (!this.isDragging) return;
    this.currentX = e.touches[0].clientX;
    const diffX = this.currentX - this.startX;

    if (diffX < 0) {
      const translateX = Math.max(diffX, -320);
      this.mobileMenuSidebar.style.transform = `translateX(${translateX}px)`;
    }
  }

  handleTouchEnd(e) {
    if (!this.isDragging) return;
    this.isDragging = false;

    const diffX = this.currentX - this.startX;
    this.mobileMenuSidebar.style.transform = '';

    if (diffX < -80) {
      this.close();
    }
  }
}

class ThemeToggle {
  constructor() {
    this.initElements();
    this.updateTheme();
    this.bindEvents();
  }

  initElements() {
    this.themeToggle = document.getElementById('theme-toggle');
    this.darkIcon = document.getElementById('theme-toggle-dark-icon');
    this.lightIcon = document.getElementById('theme-toggle-light-icon');
  }

  bindEvents() {
    this.themeToggle.addEventListener('click', () => this.toggle());
  }

  updateTheme() {
    const dark = document.documentElement.classList.contains('dark');
    this.darkIcon.classList.toggle('hidden', !dark);
    this.lightIcon.classList.toggle('hidden', dark);
  }

  toggle() {
    const dark = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', dark);
    try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch (e) {}
    this.updateTheme();
  }
}

class ImageModal {
  constructor() {
    this.initElements();
    this.bindEvents();
  }

  initElements() {
    this.imageModal = document.getElementById('image-modal');
    this.imageModalClose = document.getElementById('image-modal-close');
    this.imageModalImg = document.getElementById('image-modal-img');
    this.imageModalCaption = document.getElementById('image-modal-caption');
  }

  bindEvents() {
    this.imageModalClose.addEventListener('click', () => this.close());
    this.imageModal.addEventListener('click', (e) => {
      if (e.target === this.imageModal || e.target.classList.contains('backdrop-blur-sm')) {
        this.close();
      }
    });
    document.addEventListener('keydown', (e) => this.handleKeydown(e));
  }

  handleKeydown(e) {
    if (e.key === 'Escape' && !this.imageModal.classList.contains('hidden')) {
      this.close();
    }
  }

  open(src, alt, caption) {
    this.imageModalImg.src = src;
    this.imageModalImg.alt = alt;
    if (caption) {
      this.imageModalCaption.innerHTML = caption;
      this.imageModalCaption.classList.remove('hidden');
    } else {
      this.imageModalCaption.classList.add('hidden');
    }
    this.imageModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  close() {
    this.imageModal.classList.add('hidden');
    document.body.style.overflow = '';
    this.imageModalImg.src = '';
    this.imageModalImg.alt = '';
    this.imageModalCaption.innerHTML = '';
    this.imageModalCaption.classList.add('hidden');
    const active = document.activeElement;
    if (active && (this.imageModal.contains(active) || active.classList.contains('zoom-trigger'))) {
      active.blur();
    }
  }
}

// Copy code functionality
function copyCode(button) {
  const codeBlock = button.closest('.group').querySelector('code');
  const text = codeBlock.textContent;

  navigator.clipboard.writeText(text).then(() => {
    const originalSvg = button.innerHTML;
    button.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
    </svg>`;

    setTimeout(() => {
      button.innerHTML = originalSvg;
    }, 2000);
  });
}

// Image modal functionality
let imageModalInstance;
function openImageModal(src, alt, caption) {
  if (imageModalInstance) {
    imageModalInstance.open(src, alt, caption);
  }
}

// Make functions available globally
window.copyCode = copyCode;
window.openImageModal = openImageModal;

function scrollToActiveItem() {
  const sidebarScrollbar = document.querySelector("aside .nav-container");
  const activeItems = document.querySelectorAll(".active-nav-item");
  const visibleActiveItem = Array.from(activeItems).find(function (activeItem) {
    return activeItem.getBoundingClientRect().height > 0;
  });

  if (!visibleActiveItem) {
    return;
  }

  const yOffset = visibleActiveItem.clientHeight;
  const yDistance = visibleActiveItem.getBoundingClientRect().top - sidebarScrollbar.getBoundingClientRect().top;
  sidebarScrollbar.scrollTo({
    behavior: "instant",
    top: yDistance - yOffset
  });
}

class TableOfContents {
  constructor() {
    this.tocContainer = document.getElementById('toc-nav');
    if (!this.tocContainer) return;

    this.tocLinks = Array.from(this.tocContainer.querySelectorAll('.toc-link'));
    if (this.tocLinks.length === 0) return;

    this.headings = [];
    this.tocLinks.forEach((link) => {
      const id = link.getAttribute('href').slice(1);
      const element = document.getElementById(id);
      if (element) {
        this.headings.push({ link, element });
      }
    });

    if (this.headings.length === 0) return;

    this.currentIdx = 0;

    this.ticking = false;
    window.addEventListener('scroll', () => this.onScroll(), { passive: true });
    window.addEventListener('resize', () => this.onScroll(), { passive: true });
    this.updateActive();
  }

  onScroll() {
    if (!this.ticking) {
      requestAnimationFrame(() => {
        this.updateActive();
        this.ticking = false;
      });
      this.ticking = true;
    }
  }

  updateActive() {
    const offset = 120;
    let activeIdx = 0;

    for (let i = 0; i < this.headings.length; i++) {
      if (this.headings[i].element.getBoundingClientRect().top <= offset) {
        activeIdx = i;
      } else {
        break;
      }
    }

    let prevIdx = this.currentIdx;
    this.currentIdx = activeIdx;

    this.headings.forEach(({ link }, idx) => {
      link.classList.toggle('is-active', idx === activeIdx);
    });

    if (activeIdx !== prevIdx) {
      const activeLink = this.headings[activeIdx].link;
      const scrollContainer = this.tocContainer.closest('.overflow-y-auto');
      if (scrollContainer) {
        const containerRect = scrollContainer.getBoundingClientRect();
        const linkRect = activeLink.getBoundingClientRect();
        if (linkRect.top < containerRect.top || linkRect.bottom > containerRect.bottom) {
          activeLink.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      }
    }
  }
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new SiteSearch();

  // Fonts and images can shift the layout after the browser has jumped to
  // a #heading, leaving it under the header; jump again once loaded.
  window.addEventListener('load', () => {
    if (location.hash.length > 1) {
      document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
    }
  }, { once: true });
  new MobileMenu();
  new ThemeToggle();
  imageModalInstance = new ImageModal();

  // Make sure the active menu item is visible
  scrollToActiveItem();

  // Right-side in-page TOC scroll-spy
  new TableOfContents();

  // Add line numbers to code blocks that have data-linenos="true"
  document.querySelectorAll('code[data-linenos="true"]').forEach(function(code) {
    const lines = code.textContent.split('\n');
    const lineCount = lines.length;

    // Create line numbers
    const lineNumbers = document.createElement('div');
    lineNumbers.className = 'absolute left-0 top-0 p-4 text-muted text-sm font-mono select-none pointer-events-none';
    lineNumbers.style.width = '3rem';

    for (let i = 1; i <= lineCount; i++) {
      const lineNum = document.createElement('div');
      lineNum.textContent = i;
      lineNumbers.appendChild(lineNum);
    }

    // Add padding to code for line numbers
    code.style.paddingLeft = '3.5rem';
    code.parentElement.style.position = 'relative';
    code.parentElement.appendChild(lineNumbers);
  });
});
