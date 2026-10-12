/**
 * Rockwall Roofing & Gutters - Client Application
 * Typesafe handlers for tracking, forms, reviews carousel, and header effects.
 */

// Window augmentation for Google Tag Manager / Analytics dataLayer
declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

export interface AnalyticsEvent {
  event: string;
  placement?: string;
  service?: string;
  request_id?: string;
  [key: string]: unknown;
}

export interface InspectionFormData {
  name?: string;
  phone?: string;
  zip?: string;
  service?: string;
  message?: string;
  _honey?: string;
  request_id?: string;
  page?: string;
  [key: string]: unknown;
}

interface FormSubmitResponse {
  success: boolean | string;
  message?: string;
}

window.dataLayer = window.dataLayer || [];

/**
 * Push an event to dataLayer safely (PII-free)
 */
export function track(event: string, details: Record<string, unknown> = {}): void {
  window.dataLayer?.push({ event, ...details });
}

// 1. Phone click conversion tracking
document.querySelectorAll<HTMLAnchorElement>('a[href^="tel:"]').forEach((link) => {
  link.addEventListener('click', () => {
    track('phone_click', { placement: link.dataset.track || 'other' });
  });
});

// 2. Service-specific CTA tracking & auto-select
document.querySelectorAll<HTMLElement>('[data-service]').forEach((link) => {
  link.addEventListener('click', () => {
    const serviceSelect = document.querySelector<HTMLSelectElement>('#service');
    if (serviceSelect && link.dataset.service) {
      serviceSelect.value = link.dataset.service;
    }
    track('inspection_cta_click', {
      placement: 'service',
      service: link.dataset.service,
    });
  });
});

// 3. General inspection link clicks
document.querySelectorAll<HTMLAnchorElement>('a[href="#inspection"]:not([data-service])').forEach((link) => {
  link.addEventListener('click', () => {
    track('inspection_cta_click', {
      placement: link.closest('.hero') ? 'hero' : 'page',
    });
  });
});

// 4. Inspection Forms validation & submission
document.querySelectorAll<HTMLFormElement>('form[data-inspection-form]').forEach((form) => {
  let started = false;
  const placement = form.dataset.placement || 'unknown';

  form.addEventListener('input', () => {
    if (!started) {
      track('inspection_form_start', { placement });
      started = true;
    }
  });

  form.addEventListener('submit', async (event: SubmitEvent) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const phoneEl = (form as unknown as { phone?: HTMLInputElement }).phone;
    if (phoneEl) {
      const rawDigits = phoneEl.value.replace(/\D/g, '');
      if (!(rawDigits.length === 10 || (rawDigits.length === 11 && rawDigits.startsWith('1')))) {
        phoneEl.setCustomValidity('Please enter a 10-digit US phone number.');
        phoneEl.reportValidity();
        return;
      }
    }

    const statusEl = form.querySelector<HTMLElement>('[role="status"]');
    const submitBtn = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    const data: InspectionFormData = Object.fromEntries(
      new FormData(form) as unknown as Iterable<[string, unknown]>
    );

    // Spam honeypot check
    if (data._honey) return;

    // Capture marketing attribution parameters
    const sourceParams = new URLSearchParams(location.search);
    const attributionKeys = [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_content',
      'utm_term',
      'gclid',
      'gbraid',
      'wbraid',
    ];

    for (const key of attributionKeys) {
      const val = sourceParams.get(key);
      if (val) {
        data[key] = val.slice(0, 500);
      }
    }

    data.request_id = crypto.randomUUID();
    data.page = location.origin + location.pathname;

    if (submitBtn) submitBtn.disabled = true;
    if (statusEl) statusEl.textContent = 'Sending your request…';

    try {
      const response = await fetch('https://formsubmit.co/ajax/rockwallroofingandgutters@gmail.com', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(20000),
      });

      const result: FormSubmitResponse = await response.json();
      if (!response.ok || !(result.success === true || result.success === 'true')) {
        throw new Error('Request not accepted');
      }

      track('inspection_request_accepted', {
        request_id: data.request_id,
        service: data.service,
        placement,
      });

      if (statusEl) {
        statusEl.textContent =
          'Your request has been submitted. We’ll contact you to discuss your roof and arrange a visit. Your inspection appointment is not yet confirmed.';
      }
      form.reset();
      started = false;
    } catch {
      if (statusEl) {
        statusEl.textContent =
          'We couldn’t confirm your request. Please call 972-832-7618, or try again. Your details are still here.';
      }
      track('inspection_form_error', { placement });
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  const phoneEl = (form as unknown as { phone?: HTMLInputElement }).phone;
  phoneEl?.addEventListener('input', () => {
    phoneEl.setCustomValidity('');
  });
});

// 5. Customer Review Carousel
const reviewTrack = document.querySelector<HTMLElement>('#review-track');
if (reviewTrack) {
  const cards = Array.from(reviewTrack.querySelectorAll<HTMLElement>('.google-review-card'));
  const previousBtn = document.querySelector<HTMLButtonElement>('#review-prev');
  const nextBtn = document.querySelector<HTMLButtonElement>('#review-next');
  const statusLabel = document.querySelector<HTMLElement>('.carousel-status');

  const step = (): number => {
    if (!cards.length) return 300;
    const gap = parseFloat(getComputedStyle(reviewTrack).gap) || 16;
    return cards[0].getBoundingClientRect().width + gap;
  };

  const update = (): void => {
    const currentStep = step();
    const first = Math.round(reviewTrack.scrollLeft / currentStep);
    const visible = Math.max(1, Math.round(reviewTrack.clientWidth / currentStep));

    if (statusLabel) {
      statusLabel.textContent = `Showing reviews ${first + 1}${
        visible > 1 ? '–' + Math.min(cards.length, first + visible) : ''
      } of ${cards.length}`;
    }

    if (previousBtn) {
      previousBtn.disabled = reviewTrack.scrollLeft < 3;
    }
    if (nextBtn) {
      nextBtn.disabled = reviewTrack.scrollLeft >= reviewTrack.scrollWidth - reviewTrack.clientWidth - 3;
    }
  };

  const move = (direction: number): void => {
    reviewTrack.scrollBy({
      left: step() * direction,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
  };

  previousBtn?.addEventListener('click', () => move(-1));
  nextBtn?.addEventListener('click', () => move(1));

  reviewTrack.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.target !== reviewTrack) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      move(event.key === 'ArrowRight' ? 1 : -1);
    }
  });

  reviewTrack.addEventListener('scroll', update, { passive: true });
  new ResizeObserver(update).observe(reviewTrack);
  update();
}

// 6. Review Expansion ("Read more" / "Read less")
document.querySelectorAll<HTMLButtonElement>('.review-expand').forEach((button) => {
  button.addEventListener('click', () => {
    const controlsId = button.getAttribute('aria-controls');
    if (!controlsId) return;
    const contentEl = document.getElementById(controlsId);
    if (!contentEl) return;

    const isExpanded = button.getAttribute('aria-expanded') === 'true';
    const nextState = !isExpanded;

    contentEl.classList.toggle('expanded', nextState);
    button.setAttribute('aria-expanded', String(nextState));
    button.textContent = nextState ? 'Read less' : 'Read more';
  });
});

// 7. Fullscreen hero measurement (if enabled)
if (document.querySelector('link[href="fullscreen-hero.css"]')) {
  const updateHeroViewport = (): void => {
    const height = ['.topbar', 'header'].reduce((total, selector) => {
      const el = document.querySelector<HTMLElement>(selector);
      return total + (el?.getBoundingClientRect().height || 0);
    }, 0);
    document.documentElement.style.setProperty('--site-header-height', `${height}px`);
  };

  const headerObserver = new ResizeObserver(updateHeroViewport);
  ['.topbar', 'header'].forEach((selector) => {
    const el = document.querySelector(selector);
    if (el) headerObserver.observe(el);
  });
  updateHeroViewport();
}

// 8. Mobile Navigation Drawer
const mobileNavigation = document.querySelector<HTMLDetailsElement>('.mobile-nav');
if (mobileNavigation) {
  mobileNavigation.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      mobileNavigation.open = false;
    });
  });

  document.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'Escape' && mobileNavigation.open) {
      mobileNavigation.open = false;
      mobileNavigation.querySelector('summary')?.focus();
    }
  });

  document.addEventListener('click', (event: MouseEvent) => {
    if (mobileNavigation.open && !mobileNavigation.contains(event.target as Node)) {
      mobileNavigation.open = false;
    }
  });
}

// 9. Sticky Glass Floating Navbar Scroll Effect
const floatingHeader = document.querySelector<HTMLElement>('header');
if (floatingHeader) {
  let headerFramePending = false;
  const refreshHeaderGlass = (): void => {
    floatingHeader.classList.toggle('is-scrolled', window.scrollY > 30);
    headerFramePending = false;
  };

  window.addEventListener(
    'scroll',
    () => {
      if (!headerFramePending) {
        headerFramePending = true;
        requestAnimationFrame(refreshHeaderGlass);
      }
    },
    { passive: true }
  );

  refreshHeaderGlass();
}
