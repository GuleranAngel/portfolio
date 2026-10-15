// Angel OS: the portfolio as a small operating system.
// Desktop browsers get windows, menus and a dock; phones get a home screen with full-screen apps.
const mode = document.documentElement.dataset.mode;

// switch shells when the window crosses the phone breakpoint (rotating a tablet, resizing a laptop window)
const mq = matchMedia('(max-width: 759px)');
mq.addEventListener('change', () => location.reload());

if (mode === 'phone') import('./phone.js');
else import('./desk.js');
