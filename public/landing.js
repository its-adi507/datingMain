// ==========================================
// MOBILE NAVIGATION
// ==========================================
const hamburger = document.getElementById('hamburger');
const navMenu = document.getElementById('navMenu');
const navLinks = document.querySelectorAll('.nav-link');

// Toggle mobile menu
hamburger.addEventListener('click', () => {
    const wasActive = navMenu.classList.contains('active');
    navMenu.classList.toggle('active');
    
    // Control body scroll based on menu state
    if (!wasActive) {
        // Menu is now active, prevent body scroll
        document.body.style.overflow = 'hidden';
    } else {
        // Menu is now inactive, allow body scroll
        document.body.style.overflow = '';
    }
    
    // Animate hamburger
    const spans = hamburger.querySelectorAll('span');
    spans[0].style.transform = navMenu.classList.contains('active') 
        ? 'rotate(45deg) translate(7px, 7px)' 
        : 'rotate(0) translate(0, 0)';
    spans[1].style.opacity = navMenu.classList.contains('active') ? '0' : '1';
    spans[2].style.transform = navMenu.classList.contains('active') 
        ? 'rotate(-45deg) translate(7px, -7px)' 
        : 'rotate(0) translate(0, 0)';
});

// Close mobile menu when clicking on a link
navLinks.forEach(link => {
    link.addEventListener('click', () => {
        navMenu.classList.remove('active');
        document.body.style.overflow = ''; // Re-enable scroll
        const spans = hamburger.querySelectorAll('span');
        spans[0].style.transform = 'rotate(0) translate(0, 0)';
        spans[1].style.opacity = '1';
        spans[2].style.transform = 'rotate(0) translate(0, 0)';
    });
});

// ==========================================
// NAVBAR SCROLL EFFECT
// ==========================================
const navbar = document.querySelector('.navbar');
let lastScroll = 0;

window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    
    if (currentScroll > 100) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
    
    lastScroll = currentScroll;
});

// ==========================================
// FLOATING HEARTS ANIMATION
// ==========================================
const heartsContainer = document.getElementById('heartsContainer');

function createHeart() {
    const heart = document.createElement('div');
    heart.classList.add('heart');
    heart.innerHTML = '❤️';
    
    // Random position
    heart.style.left = Math.random() * 100 + '%';
    
    // Random animation duration
    const duration = Math.random() * 10 + 10; // 10-20 seconds
    heart.style.animationDuration = duration + 's';
    
    // Random delay
    heart.style.animationDelay = Math.random() * 5 + 's';
    
    // Random size
    const size = Math.random() * 15 + 15; // 15-30px
    heart.style.fontSize = size + 'px';
    
    heartsContainer.appendChild(heart);
    
    // Remove heart after animation
    setTimeout(() => {
        heart.remove();
    }, (duration + 5) * 1000);
}

// Create hearts periodically
setInterval(createHeart, 1000);

// Create initial hearts
for (let i = 0; i < 15; i++) {
    setTimeout(createHeart, i * 300);
}

// ==========================================
// SMOOTH SCROLLING FOR ANCHOR LINKS
// ==========================================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const targetId = this.getAttribute('href');
        if (targetId === '#') return;
        
        const targetSection = document.querySelector(targetId);
        if (targetSection) {
            const navbarHeight = navbar.offsetHeight;
            const targetPosition = targetSection.offsetTop - navbarHeight - 20;
            
            // Fast scroll - 300ms for snappy navigation
            smoothScrollTo(targetPosition, 200);
        }
    });
});

// Custom smooth scroll function with easing
function smoothScrollTo(targetPosition, duration) {
    const startPosition = window.pageYOffset;
    const distance = targetPosition - startPosition;
    let startTime = null;
    
    function animation(currentTime) {
        if (startTime === null) startTime = currentTime;
        const timeElapsed = currentTime - startTime;
        const run = easeOutQuad(timeElapsed, startPosition, distance, duration);
        window.scrollTo(0, run);
        if (timeElapsed < duration) requestAnimationFrame(animation);
    }
    
    // Faster easing function - ease out quad
    function easeOutQuad(t, b, c, d) {
        t /= d;
        return -c * t * (t - 2) + b;
    }
    
    requestAnimationFrame(animation);
}

// Alternative polyfill for older browsers
if (!('scrollBehavior' in document.documentElement.style)) {
    const style = document.createElement('style');
    style.textContent = `
        html {
            scroll-behavior: auto !important;
        }
    `;
    document.head.appendChild(style);
}

// ==========================================
// SWIPE CARD INTERACTIONS
// ==========================================
const swipeCardElement = document.querySelector('.swipe-card');
const swipeButtons = document.querySelectorAll('.swipe-btn');
const phoneScreen = document.querySelector('.phone-screen');

// Sample profiles for card swiping
const profiles = [
    {
        name: 'Emma',
        age: 24,
        distance: '2 miles away',
        interests: ['Photography', 'Travel', 'Music'],
        image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=600&fit=crop'
    },
    {
        name: 'Sarah',
        age: 26,
        distance: '3 miles away',
        interests: ['Yoga', 'Cooking', 'Art'],
        image: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=400&h=600&fit=crop'
    },
    {
        name: 'Olivia',
        age: 23,
        distance: '1 mile away',
        interests: ['Dancing', 'Fashion', 'Wine'],
        image: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&h=600&fit=crop'
    },
    {
        name: 'Ava',
        age: 27,
        distance: '4 miles away',
        interests: ['Reading', 'Coffee', 'Hiking'],
        image: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=400&h=600&fit=crop'
    },
    {
        name: 'Mia',
        age: 25,
        distance: '2 miles away',
        interests: ['Gaming', 'Anime', 'Tech'],
        image: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&h=600&fit=crop'
    }
];

let currentProfileIndex = 0;

function createNewCard(profile) {
    return `
        <div class="swipe-card active">
            <img src="${profile.image}" alt="Profile">
            <div class="card-info">
                <h3>${profile.name}, ${profile.age}</h3>
                <p><i class="fas fa-map-marker-alt"></i> ${profile.distance}</p>
                <div class="interests">
                    ${profile.interests.map(interest => `<span>${interest}</span>`).join('')}
                </div>
            </div>
        </div>
    `;
}

function swipeCard(direction) {
    const currentCard = phoneScreen.querySelector('.swipe-card');
    if (!currentCard) return;
    
    // Animate card out
    currentCard.style.transition = 'transform 0.5s, opacity 0.5s';
    currentCard.style.transform = direction === 'right' 
        ? 'translateX(400px) rotate(20deg)' 
        : 'translateX(-400px) rotate(-20deg)';
    currentCard.style.opacity = '0';
    
    // Load next profile after animation
    setTimeout(() => {
        currentCard.remove();
        currentProfileIndex = (currentProfileIndex + 1) % profiles.length;
        phoneScreen.insertAdjacentHTML('afterbegin', createNewCard(profiles[currentProfileIndex]));
        
        // Animate new card in
        const newCard = phoneScreen.querySelector('.swipe-card');
        newCard.style.opacity = '0';
        newCard.style.transform = 'scale(0.8)';
        
        setTimeout(() => {
            newCard.style.transition = 'transform 0.3s, opacity 0.3s';
            newCard.style.opacity = '1';
            newCard.style.transform = 'scale(1)';
        }, 50);
    }, 500);
}

// Add click events to swipe buttons
swipeButtons.forEach(button => {
    button.addEventListener('click', (e) => {
        e.preventDefault();
        
        if (button.classList.contains('like')) {
            swipeCard('right');
            // Show match notification occasionally
            if (Math.random() > 0.7) {
                showMatchNotification();
            }
        } else if (button.classList.contains('reject')) {
            swipeCard('left');
        } else if (button.classList.contains('superlike')) {
            swipeCard('right');
            showMatchNotification();
        }
        
        // Animate button
        button.style.transform = 'scale(1.2)';
        setTimeout(() => {
            button.style.transform = 'scale(1)';
        }, 200);
    });
});

// Touch swipe for mobile
let touchStartX = 0;
let touchEndX = 0;

if (swipeCardElement) {
    swipeCardElement.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    });
    
    swipeCardElement.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    });
    
    function handleSwipe() {
        if (touchEndX < touchStartX - 50) {
            swipeCard('left');
        }
        if (touchEndX > touchStartX + 50) {
            swipeCard('right');
        }
    }
}

// Show match notification
function showMatchNotification() {
    const notification = document.createElement('div');
    notification.className = 'match-popup';
    notification.innerHTML = `
        <div class="match-popup-content">
            <i class="fas fa-heart"></i>
            <h3>It's a Match!</h3>
            <p>You and ${profiles[currentProfileIndex].name} liked each other</p>
        </div>
    `;
    
    // Add styles dynamically
    notification.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) scale(0);
        background: linear-gradient(135deg, #FF4B7A, #9B4DFF);
        color: white;
        padding: 3rem;
        border-radius: 24px;
        box-shadow: 0 20px 60px rgba(155, 77, 255, 0.3);
        z-index: 10000;
        text-align: center;
        transition: transform 0.3s;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.transform = 'translate(-50%, -50%) scale(1)';
    }, 100);
    
    setTimeout(() => {
        notification.style.transform = 'translate(-50%, -50%) scale(0)';
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

// ==========================================
// ENHANCED SCROLL ANIMATIONS WITH FADE-IN
// ==========================================
const scrollObserverOptions = {
    threshold: 0.15,
    rootMargin: '0px 0px -80px 0px'
};

const scrollObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            // Add revealed class for smooth fade-in
            requestAnimationFrame(() => {
                entry.target.classList.add('revealed');
            });
            // Unobserve after revealing to improve performance
            scrollObserver.unobserve(entry.target);
        }
    });
}, scrollObserverOptions);

// Add scroll reveal classes to all elements
function initScrollReveal() {
    // Section headers
    document.querySelectorAll('.section-header').forEach((el, index) => {
        el.classList.add('scroll-reveal');
        scrollObserver.observe(el);
    });
    
    // Feature cards with stagger
    document.querySelectorAll('.feature-card').forEach((el, index) => {
        el.classList.add('scroll-reveal');
        el.style.transitionDelay = `${index * 0.1}s`;
        scrollObserver.observe(el);
    });
    
    // Steps with alternating directions
    document.querySelectorAll('.step').forEach((el, index) => {
        if (index % 2 === 0) {
            el.classList.add('scroll-reveal-left');
        } else {
            el.classList.add('scroll-reveal-right');
        }
        el.style.transitionDelay = `${index * 0.15}s`;
        scrollObserver.observe(el);
    });
    
    // Profile cards with scale effect
    document.querySelectorAll('.profile-card').forEach((el, index) => {
        el.classList.add('scroll-reveal-scale');
        el.style.transitionDelay = `${index * 0.1}s`;
        scrollObserver.observe(el);
    });
    
    // Testimonial cards
    document.querySelectorAll('.testimonial-card').forEach((el, index) => {
        el.classList.add('scroll-reveal');
        el.style.transitionDelay = `${index * 0.12}s`;
        scrollObserver.observe(el);
    });
    
    // Download section
    const downloadSection = document.querySelector('.download-content');
    if (downloadSection) {
        downloadSection.classList.add('scroll-reveal');
        scrollObserver.observe(downloadSection);
    }
    
    // Footer sections
    document.querySelectorAll('.footer-section').forEach((el, index) => {
        el.classList.add('scroll-reveal');
        el.style.transitionDelay = `${index * 0.1}s`;
        scrollObserver.observe(el);
    });
}

// ==========================================
// STATS COUNTER ANIMATION
// ==========================================
function animateCounter(element, target, duration = 2000) {
    const start = 0;
    const increment = target / (duration / 16);
    let current = start;
    
    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            element.textContent = formatNumber(target);
            clearInterval(timer);
        } else {
            element.textContent = formatNumber(Math.floor(current));
        }
    }, 16);
}

function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M+';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(0) + 'K+';
    }
    return num.toString();
}

// Animate stats when they come into view
const stats = document.querySelectorAll('.stat h3');
let statsAnimated = false;

const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting && !statsAnimated) {
            statsAnimated = true;
            const values = [5000000, 2000000, 500000];
            stats.forEach((stat, index) => {
                setTimeout(() => {
                    animateCounter(stat, values[index]);
                }, index * 200);
            });
        }
    });
}, { threshold: 0.5 });

const heroStats = document.querySelector('.hero-stats');
if (heroStats) {
    statsObserver.observe(heroStats);
}

// ==========================================
// PROFILE CARD HOVER EFFECTS
// ==========================================
const profileCards = document.querySelectorAll('.profile-card');

profileCards.forEach(card => {
    card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateY(-10px) rotate(2deg)';
    });
    
    card.addEventListener('mouseleave', () => {
        card.style.transform = 'translateY(0) rotate(0deg)';
    });
});

// ==========================================
// BUTTON CLICK EFFECTS
// ==========================================
const buttons = document.querySelectorAll('.btn');

buttons.forEach(button => {
    button.addEventListener('click', function(e) {
        // Create ripple effect
        const ripple = document.createElement('span');
        const rect = this.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;
        
        ripple.style.cssText = `
            position: absolute;
            width: ${size}px;
            height: ${size}px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.5);
            top: ${y}px;
            left: ${x}px;
            transform: scale(0);
            animation: ripple 0.6s ease-out;
            pointer-events: none;
        `;
        
        this.style.position = 'relative';
        this.style.overflow = 'hidden';
        this.appendChild(ripple);
        
        setTimeout(() => ripple.remove(), 600);
    });
});

// Add ripple animation
const style = document.createElement('style');
style.textContent = `
    @keyframes ripple {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }
    
    .match-popup-content i {
        font-size: 4rem;
        margin-bottom: 1rem;
        animation: pulse 0.5s ease-in-out;
    }
    
    .match-popup-content h3 {
        font-size: 2rem;
        margin-bottom: 0.5rem;
    }
    
    .match-popup-content p {
        font-size: 1.1rem;
        opacity: 0.9;
    }
`;
document.head.appendChild(style);


// ==========================================
// LAZY LOADING IMAGES WITH FADE-IN
// ==========================================
function initLazyLoadImages() {
    const images = document.querySelectorAll('img[src]');
    
    const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                
                // If image already loaded, just fade it in
                if (img.complete) {
                    img.classList.add('loaded');
                } else {
                    // Wait for image to load, then fade in
                    img.addEventListener('load', () => {
                        requestAnimationFrame(() => {
                            img.classList.add('loaded');
                        });
                    });
                }
                
                imageObserver.unobserve(img);
            }
        });
    }, {
        threshold: 0.01,
        rootMargin: '50px'
    });
    
    images.forEach(img => imageObserver.observe(img));
}

// ==========================================
// CURSOR EFFECT (DESKTOP ONLY)
// ==========================================
if (window.innerWidth > 768) {
    const cursor = document.createElement('div');
    cursor.className = 'custom-cursor';
    cursor.style.cssText = `
        width: 40px;
        height: 40px;
        border: 2px solid rgba(255, 75, 122, 0.5);
        border-radius: 50%;
        position: fixed;
        pointer-events: none;
        z-index: 10000;
        transition: transform 0.2s, border-color 0.2s;
        display: none;
    `;
    document.body.appendChild(cursor);
    
    document.addEventListener('mousemove', (e) => {
        cursor.style.display = 'block';
        cursor.style.left = (e.clientX - 20) + 'px';
        cursor.style.top = (e.clientY - 20) + 'px';
    });
    
    // Change cursor on hover
    const interactiveElements = document.querySelectorAll('a, button, .swipe-btn, .profile-card');
    
    interactiveElements.forEach(el => {
        el.addEventListener('mouseenter', () => {
            cursor.style.transform = 'scale(1.5)';
            cursor.style.borderColor = 'rgba(255, 75, 122, 1)';
        });
        
        el.addEventListener('mouseleave', () => {
            cursor.style.transform = 'scale(1)';
            cursor.style.borderColor = 'rgba(255, 75, 122, 0.5)';
        });
    });
}

// ==========================================
// PAGE LOADING - BULLETPROOF SCROLL FIX
// ==========================================

// IMMEDIATELY ensure scrolling works - this runs before anything else
(function forceEnableScroll() {
    document.documentElement.style.overflowY = 'auto';
    document.documentElement.style.overflowX = 'hidden';
    document.body.style.overflowY = 'auto';
    document.body.style.overflowX = 'hidden';
    document.body.style.height = 'auto';
    document.body.style.minHeight = '100vh';
    document.body.style.position = 'relative';
})();

// Safety net: forcefully enable scroll every 500ms for the first 5 seconds
let scrollFixInterval = setInterval(() => {
    if (!document.querySelector('.nav-menu.active')) {
        document.body.style.overflow = '';
        document.body.style.overflowY = 'auto';
        document.body.style.overflowX = 'hidden';
    }
}, 500);

setTimeout(() => clearInterval(scrollFixInterval), 5000);

// Initialize page when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    try {
        // Initialize scroll reveal animations right away
        initScrollReveal();
        initLazyLoadImages();
    } catch(e) {
        console.warn('Init error (non-critical):', e);
    }
});

// When fully loaded, clean up and finalize
window.addEventListener('load', () => {
    try {
        // Force remove any loading state
        document.body.classList.remove('loading');
        document.body.classList.add('loaded');
        
        // Remove ANY loading overlays that might exist
        document.querySelectorAll('.loading-overlay').forEach(el => {
            el.style.opacity = '0';
            el.style.pointerEvents = 'none';
            setTimeout(() => el.remove(), 500);
        });
        
        // FORCE scrolling to work
        document.body.style.overflow = '';
        document.body.style.overflowY = 'auto';
        document.body.style.overflowX = 'hidden';
        document.documentElement.style.overflowY = 'auto';
        document.documentElement.style.overflowX = 'hidden';
        
        // Preload profile images
        if (typeof profiles !== 'undefined') {
            profiles.forEach(profile => {
                const img = new Image();
                img.src = profile.image;
            });
        }
        
        // Touch optimizations
        if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
            document.body.classList.add('touch-device');
            enableTouchOptimizations();
        }
        
        // Set viewport height
        setViewportHeight();
        
        console.log('LoveMatch loaded successfully!');
    } catch(e) {
        console.warn('Load handler error:', e);
        // Even if there's an error, FORCE scrolling
        document.body.style.overflow = '';
        document.body.style.overflowY = 'auto';
        document.body.classList.remove('loading');
    }
});

// Touch optimizations for mobile devices
function enableTouchOptimizations() {
    // Remove hover effects on touch devices
    const style = document.createElement('style');
    style.textContent = `
        @media (hover: none) and (pointer: coarse) {
            .feature-card:hover,
            .profile-card:hover,
            .testimonial-card:hover {
                transform: none;
            }
            
            .btn:hover {
                transform: none;
            }
            
            .nav-link:hover::after {
                width: 0;
            }
        }
    `;
    document.head.appendChild(style);
    
    // Add active states for better touch feedback
    const touchElements = document.querySelectorAll('.btn, .swipe-btn, .profile-card');
    touchElements.forEach(el => {
        el.addEventListener('touchstart', function() {
            this.style.opacity = '0.8';
        }, { passive: true });
        
        el.addEventListener('touchend', function() {
            this.style.opacity = '1';
        }, { passive: true });
    });
}

// Set viewport height for mobile browsers
function setViewportHeight() {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
}

// Update on resize and orientation change
window.addEventListener('resize', setViewportHeight);
window.addEventListener('orientationchange', () => {
    setTimeout(setViewportHeight, 200);
});

// ==========================================
// PERFORMANCE OPTIMIZATION & SMOOTH SCROLLING
// ==========================================
// Debounce function for scroll events
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Throttle function for high-frequency events
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Optimized scroll handler with throttle
const optimizedScrollHandler = throttle(() => {
    const scrolled = window.pageYOffset;
    
    // Navbar effects
    if (scrolled > 100) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
    
    // Parallax effect for hero (only on larger screens)
    if (window.innerWidth > 768) {
        const heroImage = document.querySelector('.hero-image');
        if (heroImage && scrolled < window.innerHeight) {
            requestAnimationFrame(() => {
                heroImage.style.transform = `translateY(${scrolled * 0.3}px)`;
            });
        }
    }
}, 16); // 60fps = ~16ms

window.addEventListener('scroll', optimizedScrollHandler, { passive: true });

// Smooth resize handler
const handleResize = debounce(() => {
    // Recalculate viewport height for mobile
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
    
    // Adjust phone mockup size based on viewport
    adjustPhoneMockupSize();
}, 250);

window.addEventListener('resize', handleResize, { passive: true });

// Initial viewport height calculation
const vh = window.innerHeight * 0.01;
document.documentElement.style.setProperty('--vh', `${vh}px`);

// Adjust phone mockup based on screen size
function adjustPhoneMockupSize() {
    const phoneFrame = document.querySelector('.phone-frame');
    if (!phoneFrame) return;
    
    const screenWidth = window.innerWidth;
    let scale = 1;
    
    if (screenWidth < 375) {
        scale = 0.85;
    } else if (screenWidth < 425) {
        scale = 0.9;
    } else if (screenWidth < 640) {
        scale = 0.95;
    }
    
    requestAnimationFrame(() => {
        phoneFrame.style.transform = `scale(${scale})`;
    });
}

// Initial call
adjustPhoneMockupSize();

// Smooth orientation change handling
window.addEventListener('orientationchange', () => {
    setTimeout(() => {
        handleResize();
        window.scrollTo(0, window.pageYOffset + 1);
        window.scrollTo(0, window.pageYOffset - 1);
    }, 200);
});

// Momentum scrolling for iOS
if (CSS.supports('-webkit-overflow-scrolling', 'touch')) {
    document.documentElement.style.webkitOverflowScrolling = 'touch';
}

// Request Animation Frame polyfill
(function() {
    var lastTime = 0;
    var vendors = ['webkit', 'moz'];
    for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
        window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
        window.cancelAnimationFrame =
          window[vendors[x]+'CancelAnimationFrame'] || window[vendors[x]+'CancelRequestAnimationFrame'];
    }

    if (!window.requestAnimationFrame)
        window.requestAnimationFrame = function(callback) {
            var currTime = new Date().getTime();
            var timeToCall = Math.max(0, 16 - (currTime - lastTime));
            var id = window.setTimeout(function() { callback(currTime + timeToCall); },
              timeToCall);
            lastTime = currTime + timeToCall;
            return id;
        };

    if (!window.cancelAnimationFrame)
        window.cancelAnimationFrame = function(id) {
            clearTimeout(id);
        };
}());
