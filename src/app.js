/* Events contain no names, phone numbers, ZIP codes, or message content.
   Configure GA4/GTM separately; an unconnected dataLayer is not analytics storage. */
window.dataLayer = window.dataLayer || [];
function track(event, details = {}) { window.dataLayer.push({ event, ...details }); }
document.querySelectorAll('a[href^="tel:"]').forEach(link => link.addEventListener('click', () => track('phone_click', { placement: link.dataset.track || 'other' })));
document.querySelectorAll('[data-service]').forEach(link => link.addEventListener('click', () => { document.querySelector('#service').value = link.dataset.service; track('inspection_cta_click', { placement: 'service', service: link.dataset.service }); }));
document.querySelectorAll('a[href="#inspection"]:not([data-service])').forEach(link => link.addEventListener('click', () => track('inspection_cta_click', { placement: link.closest('.hero') ? 'hero' : 'page' })));
for (const form of document.querySelectorAll('form[data-inspection-form]')) {
 let started = false;
 form.addEventListener('input', () => { if (!started) { track('inspection_form_start', { placement: form.dataset.placement }); started = true; } });
 form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const phone = form.phone.value.replace(/\D/g, '');
  if (!(phone.length === 10 || (phone.length === 11 && phone.startsWith('1')))) {
   form.phone.setCustomValidity('Please enter a 10-digit US phone number.'); form.phone.reportValidity(); return;
  }
  const status = form.querySelector('[role="status"]');
  const button = form.querySelector('button[type="submit"]');
  const data = Object.fromEntries(new FormData(form));
  if (data._honey) return;
  const source = new URLSearchParams(location.search);
  ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','gclid','gbraid','wbraid'].forEach(key => { if(source.has(key)) data[key] = source.get(key).slice(0,500); });
  data.request_id = crypto.randomUUID();
  data.page = location.origin + location.pathname;
  button.disabled = true; status.textContent = 'Sending your request…';
  try {
   const response = await fetch('https://formsubmit.co/ajax/rockwallroofingandgutters@gmail.com', { method:'POST', headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(20000) });
   const result = await response.json();
   if (!response.ok || !(result.success === true || result.success === 'true')) throw new Error('Request not accepted');
   track('inspection_request_accepted', { request_id: data.request_id, service: data.service, placement: form.dataset.placement });
   status.textContent = 'Your request has been submitted. We’ll contact you to discuss your roof and arrange a visit. Your inspection appointment is not yet confirmed.';
   form.reset(); started = false;
  } catch {
   status.textContent = 'We couldn’t confirm your request. Please call 972-832-7618, or try again. Your details are still here.';
   track('inspection_form_error', { placement: form.dataset.placement });
  } finally {button.disabled = false;}
 });
 form.phone.addEventListener('input', () => form.phone.setCustomValidity(''));
}

const reviewTrack = document.querySelector('#review-track');
if (reviewTrack) {
 const cards = [...reviewTrack.querySelectorAll('.google-review-card')];
 const previous = document.querySelector('#review-prev');
 const next = document.querySelector('#review-next');
 const status = document.querySelector('.carousel-status');
 const step = () => cards[0].getBoundingClientRect().width + parseFloat(getComputedStyle(reviewTrack).gap);
 const update = () => {
  const first = Math.round(reviewTrack.scrollLeft / step());
  const visible = Math.max(1, Math.round(reviewTrack.clientWidth / step()));
  status.textContent = 'Showing reviews ' + (first + 1) + (visible > 1 ? '–' + Math.min(cards.length, first + visible) : '') + ' of ' + cards.length;
  previous.disabled = reviewTrack.scrollLeft < 3;
  next.disabled = reviewTrack.scrollLeft >= reviewTrack.scrollWidth - reviewTrack.clientWidth - 3;
 };
 const move = direction => reviewTrack.scrollBy({left:step() * direction, behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
 previous.addEventListener('click', () => move(-1));
 next.addEventListener('click', () => move(1));
 reviewTrack.addEventListener('keydown', event => { if(event.target !== reviewTrack) return; if(event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); move(event.key === 'ArrowRight' ? 1 : -1); } });
 reviewTrack.addEventListener('scroll', update, {passive:true});
 new ResizeObserver(update).observe(reviewTrack);
 update();
}

document.querySelectorAll('.review-expand').forEach(button => button.addEventListener('click', () => {
 const expanded = button.getAttribute('aria-expanded') !== 'true';
 document.getElementById(button.getAttribute('aria-controls')).classList.toggle('expanded', expanded);
 button.setAttribute('aria-expanded', String(expanded));
 button.textContent = expanded ? 'Read less' : 'Read more';
}));

// Measure the header so the fullscreen trial fills the space below navigation.
if (document.querySelector('link[href="fullscreen-hero.css"]')) {
 const updateHeroViewport = () => {
  const height = ['.topbar','header'].reduce((total,selector) => total + (document.querySelector(selector)?.getBoundingClientRect().height || 0), 0);
  document.documentElement.style.setProperty('--site-header-height', height + 'px');
 };
 const headerObserver = new ResizeObserver(updateHeroViewport);
 ['.topbar','header'].forEach(selector => headerObserver.observe(document.querySelector(selector)));
 updateHeroViewport();
}

const mobileNavigation = document.querySelector('.mobile-nav');
if (mobileNavigation) {
 mobileNavigation.querySelectorAll('a').forEach(link => link.addEventListener('click', () => mobileNavigation.open = false));
 document.addEventListener('keydown', event => { if(event.key === 'Escape' && mobileNavigation.open) { mobileNavigation.open = false; mobileNavigation.querySelector('summary').focus(); } });
 document.addEventListener('click', event => { if (!mobileNavigation.contains(event.target)) mobileNavigation.open = false; });
}

const floatingHeader = document.querySelector('header');
if (floatingHeader) {
 let headerFramePending = false;
 const refreshHeaderGlass = () => { floatingHeader.classList.toggle('is-scrolled', window.scrollY > 30); headerFramePending = false; };
 window.addEventListener('scroll', () => { if (!headerFramePending) { headerFramePending = true; requestAnimationFrame(refreshHeaderGlass); } }, {passive:true});
 refreshHeaderGlass();
}
