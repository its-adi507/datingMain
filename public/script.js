if (typeof userData === 'undefined') {
    console.error('No user data found - redirecting to auth');
    window.location.href = '/auth';
    throw new Error('Authentication required');
}

// Socket initialization
let socket;

/**
 * Get cookie value by name
 */
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

// Initialize Socket.io connection
function initSocket() {
    // We rely on the browser sending the HttpOnly cookie automatically
    socket = io();


    socket.on('connect', () => {
        console.log('✅ Connected to real-time server');
        console.log('✅ Connected to general_Room');

        // Send heartbeat every 60 seconds to keep presence alive
        setInterval(() => {
            socket.emit('heartbeat');
        }, 60000); // 60 seconds
    });

    socket.on('disconnect', (reason) => {
        console.log('🔌 Disconnected from server:', reason);
    });

    socket.on('connect_error', (err) => {
        console.error('❌ Socket connection error:', err.message);
    });

    socket.on('reconnect', (attemptNumber) => {
        console.log('🔄 Reconnected to server (attempt ' + attemptNumber + ')');
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
        console.log('🔄 Attempting to reconnect (attempt ' + attemptNumber + ')...');
    });

    socket.on('reconnect_error', (err) => {
        console.error('❌ Reconnection error:', err.message);
    });

    // Log all incoming events
    socket.onAny((event, ...args) => {
        console.log(`📥 [Socket Received] ${event}:`, args);
    });

    // General Room Broadcast Listener
    socket.on('general_broadcast', (data) => {
        // console.log('📢 [General Broadcast]:', data);
    });

    // Handle presence updates from general room
    socket.on('presence_update', (data) => {
        // console.log('👤 Presence Update:', data);
        const { userId, status, lastSeen } = data;

        // 1. Update Friend List Item
        const friendItem = document.querySelector(`.friend-item[data-friend-id="${userId}"]`);
        if (friendItem) {
            friendItem.dataset.friendStatus = status;
            const statusDot = friendItem.querySelector('.status-dot');
            const statusText = friendItem.querySelector('p');
            if (statusDot) {
                statusDot.className = `status-dot ${status}`;
            }
            if (statusText) {
                statusText.innerHTML = `<span class="status-dot ${status}"></span> ${status === 'online' ? 'Online' : 'Offline'}`;
            }
        }

        // 2. Update Chat Header if currently chatting with this user
        if (currentChatFriend === userId) {
            const chatStatusDot = document.getElementById('chatUserStatus');
            const chatStatusText = document.getElementById('chatUserStatusText');
            if (chatStatusDot) chatStatusDot.className = `status-dot ${status}`;
            if (chatStatusText) chatStatusText.textContent = status === 'online' ? 'Online' : 'Offline';
        }
    });

    // Handle incoming message notifications (Red Dot)
    socket.on('message_notification', (data) => {
        const { senderId, message, timestamp } = data;
        // console.log('📩 Message Notification:', data);

        // If we are already chatting with this user, don't show badge
        if (currentChatFriend === senderId) return;

        // Find the friend item
        const friendItem = document.querySelector(`.friend-item[data-friend-id="${senderId}"]`);
        if (friendItem) {
            // Check if badge already exists
            let badge = friendItem.querySelector('.unread-badge');
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'unread-badge';
                badge.textContent = '1';
                friendItem.appendChild(badge);
            } else {
                let currentCount = parseInt(badge.textContent);
                if (isNaN(currentCount)) currentCount = 0;
                badge.textContent = currentCount + 1;
            }

            // Move friend to top of list (optional, but good UX)
            friendItem.parentNode.prepend(friendItem);
        }
    });

    socket.on('force_disconnect', (reason) => {
        console.warn('⚠️ Disconnected:', reason);
        alert('You have been logged out because you logged in from another device/tab.');
        window.location.reload();
    });
}


// Start socket connection
initSocket();

/**
 * Populate user data throughout the page
 */
function populateUserData() {
    // console.log('Populating user data:', userData);

    // Update profile name
    const profileNameElements = document.querySelectorAll('.profile-name, .user-name, .profile-username, #profileUsername');
    profileNameElements.forEach(el => {
        el.textContent = userData.name;
    });

    // Update profile picture
    const profilePicElements = document.querySelectorAll('.profile-pic, .user-avatar, #profilePic');
    profilePicElements.forEach(el => {
        el.src = userData.profilePicture || `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/2764.svg`;
    });

    // Update bio
    const bioElements = document.querySelectorAll('.profile-bio, .user-bio, #profileBio');
    bioElements.forEach(el => {
        el.textContent = userData.bio || 'No bio yet';
    });

    // Update tags
    const tagsContainer = document.querySelector('.profile-tags, .user-tags');
    if (tagsContainer) {
        // Keep the "Add Tag" button if it exists
        const addTagBtn = tagsContainer.querySelector('#addTagBtn');

        // Clear all except addTagBtn
        tagsContainer.innerHTML = '';

        if (userData.tags && userData.tags.length > 0) {
            userData.tags.forEach(tag => {
                const tagSpan = document.createElement('span');
                tagSpan.className = 'tag';
                tagSpan.innerHTML = `${tag} <button class="tag-remove">×</button>`;
                tagsContainer.appendChild(tagSpan);
            });
        }

        if (addTagBtn) {
            tagsContainer.appendChild(addTagBtn);
        }
    }

    const likesCount = document.getElementById('likesCount');
    if (likesCount) likesCount.textContent = userData.likesCounter || 0;

    const likesSentCount = document.getElementById('likesSentCount');
    if (likesSentCount) likesSentCount.textContent = userData.likesSentCounter || 0;

    const matchesCount = document.getElementById('matchesCount');
    if (matchesCount) matchesCount.textContent = userData.matchesCounter || 0;

    const postsCount = document.getElementById('postsCount');
    // postsCount will be updated by fetchUserPosts

    // Update posts grid
    fetchUserPosts();
}

async function fetchUserPosts() {
    const postsGrid = document.getElementById('postsGrid');
    const postsCount = document.getElementById('postsCount');

    if (!postsGrid) return;

    try {
        // Fetch posts from API (uses cache)
        const response = await fetch(`/posts/${userData.id}`);
        const data = await response.json();

        if (data.success) {
            const posts = data.posts;

            // Update counter
            if (postsCount) postsCount.textContent = posts.length;

            // Render grid
            postsGrid.innerHTML = '';

            if (posts.length > 0) {
                posts.forEach(post => {
                    const postItem = document.createElement('div');
                    postItem.className = 'post-item';
                    // Use standard image structure
                    postItem.innerHTML = `<img src="${post.imageUrl}" alt="Post">`;
                    postsGrid.appendChild(postItem);
                });
            } else {
                postsGrid.innerHTML = '<p class="no-posts">No posts yet</p>';
            }
        }
    } catch (error) {
        console.error('Error fetching posts:', error);
        postsGrid.innerHTML = '<p class="error-posts">Failed to load posts</p>';
    }
}

// Pagination State
let lastProfileId = null;
let isFetchingProfiles = false;
let hasMoreProfiles = true;

// DOM Elements
const cardStack = document.getElementById('cardStack');
const emptyState = document.querySelector('.empty-state');
const likeBtn = document.getElementById('likeBtn');
const rejectBtn = document.getElementById('rejectBtn');
const superLikeBtn = document.getElementById('superLikeBtn');
const matchOverlay = document.getElementById('matchOverlay');
const closeMatchBtn = document.getElementById('closeMatchBtn');
const goToChatBtn = document.getElementById('goToChatBtn');

if (closeMatchBtn) {
    closeMatchBtn.addEventListener('click', () => {
        matchOverlay.style.display = 'none';
    });
}

if (goToChatBtn) {
    goToChatBtn.addEventListener('click', () => {
        const friendId = goToChatBtn.dataset.friendId;
        const friendName = goToChatBtn.dataset.friendName;
        const friendImage = goToChatBtn.dataset.friendImage;
        matchOverlay.style.display = 'none';
        if (friendId && friendName) {
            openChat(friendId, friendName, 'online', friendImage);
        }
    });
}
const matchedUserName = document.getElementById('matchedUserName');
const myMatchImg = document.getElementById('myMatchImg');
const theirMatchImg = document.getElementById('theirMatchImg');
const swipeActions = document.querySelector('.swipe-actions');
const resetModal = document.getElementById('resetModal');
const resetSwipesBtn = document.getElementById('resetSwipesBtn');
const closeResetModal = document.getElementById('closeResetModal');
const resetOptionBtns = document.querySelectorAll('.btn-reset-option');
const confirmModal = document.getElementById('confirmModal');
const confirmTitle = document.getElementById('confirmTitle');
const confirmMessage = document.getElementById('confirmMessage');
const okConfirmBtn = document.getElementById('okConfirmBtn');
const cancelConfirmBtn = document.getElementById('cancelConfirmBtn');

async function fetchMoreProfiles() {
    if (isFetchingProfiles || !hasMoreProfiles) return;

    try {
        isFetchingProfiles = true;

        // Show global loader if stack is empty AND we are on the swipe screen
        const currentCards = document.querySelectorAll('.card').length;
        const isOnSwipeScreen = sections['swipe-container'].classList.contains('section-active');
        if (currentCards === 0 && isOnSwipeScreen) showLoader('Fetching latest data...');

        const url = `/matches?limit=10${lastProfileId ? `&lastId=${lastProfileId}` : ''}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.success && data.profiles.length > 0) {
            const newProfiles = data.profiles;
            lastProfileId = newProfiles[newProfiles.length - 1].id;

            // Add to stack at the bottom
            newProfiles.reverse().forEach(profile => {
                const card = createCard(profile);
                cardStack.insertBefore(card, cardStack.firstChild);
            });

            // Re-setup drag events
            document.querySelectorAll('.card').forEach(setupDragEvents);

            emptyState.style.display = 'none';
            if (swipeActions) swipeActions.style.display = 'flex';
        } else {
            hasMoreProfiles = false;
        }
    } catch (error) {
        console.error('Fetch profiles error:', error);
    } finally {
        isFetchingProfiles = false;
        hideLoader();

        // Final end-of-deck check
        if (document.querySelectorAll('.card').length === 0 && !hasMoreProfiles) {
            emptyState.style.display = 'flex';
            emptyState.innerHTML = '<i class="fas fa-heart-broken"></i><p>No more profiles nearby!</p>';
            if (swipeActions) swipeActions.style.display = 'none';
        }
    }
}

// Mock Data (This will likely be removed or integrated with the API call)
const profiles = [
];

// Mock chat messages
const mockMessages = {
    1: [
        { text: 'Hey! How are you?', sent: false, time: '10:30 AM' },
        { text: 'Hi Sarah! I\'m great, thanks!', sent: true, time: '10:32 AM' },
        { text: 'Want to grab coffee sometime?', sent: false, time: '10:35 AM' }
    ],
    2: [
        { text: 'Love your profile!', sent: false, time: 'Yesterday' },
        { text: 'Thank you! 😊', sent: true, time: 'Yesterday' }
    ],
    3: [
        { text: 'Hi there!', sent: true, time: '2:15 PM' },
        { text: 'Hello! Nice to match with you!', sent: false, time: '2:20 PM' }
    ]
};

function init() {
    cardStack.innerHTML = '';
    cardStack.appendChild(emptyState);
    fetchMoreProfiles();
}

function createCard(profile) {
    const el = document.createElement('div');
    el.classList.add('card');
    el.dataset.id = profile.id;
    el.innerHTML = `
        <img src="${profile.image}" alt="${profile.name}" onerror="this.src='/assets/profile/default.png'">
        <div class="card-content">
            <h2 class="card-name">${profile.name}, <span class="card-age">${profile.age}</span></h2>
            <p class="card-bio">${profile.bio}</p>
        </div>
    `;
    return el;
}

function setupDragEvents(card) {
    let isDragging = false;
    let startX = 0;
    let currentX = 0;

    const onMouseDown = (e) => {
        isDragging = true;
        startX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        card.style.transition = 'none';
    };

    const onMouseMove = (e) => {
        if (!isDragging) return;

        const x = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        const y = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;

        currentX = x - startX;
        currentY = y - startY;

        const rotate = currentX * 0.1;
        card.style.transform = `translate(${currentX}px, ${currentY}px) rotate(${rotate}deg)`;

        // Visual feedback
        if (currentY < -100) {
            card.style.boxShadow = `0 10px 40px -10px rgba(47, 181, 255, 0.5)`; // Blue for super like
        } else if (currentX > 0) {
            card.style.boxShadow = `0 10px 40px -10px rgba(76, 202, 79, 0.5)`; // Green for like
        } else {
            card.style.boxShadow = `0 10px 40px -10px rgba(236, 94, 111, 0.5)`; // Red for reject
        }
    };

    const onMouseUp = () => {
        if (!isDragging) return;
        isDragging = false;

        const threshold = 100;

        if (currentY < -threshold) {
            swipeUp(card);
        } else if (currentX > threshold) {
            swipeRight(card);
        } else if (currentX < -threshold) {
            swipeLeft(card);
        } else {
            resetCard(card);
        }
    };

    let startY = 0;
    let currentY = 0;

    const onMouseDownExtended = (e) => {
        onMouseDown(e);
        startY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
    };

    card.addEventListener('mousedown', onMouseDownExtended);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    card.addEventListener('touchstart', onMouseDownExtended);
    window.addEventListener('touchmove', onMouseMove);
    window.addEventListener('touchend', onMouseUp);
}

function swipeRight(card) {
    card.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
    card.style.transform = 'translateX(200%) rotate(30deg)';
    card.style.opacity = '0';
    showDecoration('heart');
    handleSwipeAction(card.dataset.id, 'like');
    setTimeout(() => {
        card.remove();
        checkEmpty();
    }, 300);
}

function swipeLeft(card) {
    card.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
    card.style.transform = 'translateX(-200%) rotate(-30deg)';
    card.style.opacity = '0';
    handleSwipeAction(card.dataset.id, 'reject');
    setTimeout(() => {
        card.remove();
        checkEmpty();
    }, 300);
}

function swipeUp(card) {
    card.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
    card.style.transform = 'translateY(-200vh) scale(0.5)';
    card.style.opacity = '0';
    showDecoration('star');
    handleSwipeAction(card.dataset.id, 'superlike');
    setTimeout(() => {
        card.remove();
        checkEmpty();
    }, 300);
}

async function handleSwipeAction(targetId, action) {
    try {
        const response = await fetch('/swipe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetId, action })
        });
        const data = await response.json();

        // Update local likesSentCounter
        if (data.success && (action === 'like' || action === 'superlike')) {
            if (typeof userData !== 'undefined') {
                userData.likesSentCounter = (userData.likesSentCounter || 0) + 1;
                const likesSentCount = document.getElementById('likesSentCount');
                if (likesSentCount) likesSentCount.textContent = userData.likesSentCounter;
            }
        }

        if (data.success && data.isMatch) {
            showMatchOverlay(data.matchedUser);
            // Update local matches counter
            if (typeof userData !== 'undefined') {
                userData.matchesCounter = (userData.matchesCounter || 0) + 1;
                const matchesCount = document.getElementById('matchesCount');
                if (matchesCount) matchesCount.textContent = userData.matchesCounter;
            }
        }
    } catch (error) {
        console.error('Swipe action error:', error);
    }
}

function showMatchOverlay(matchedUser) {
    if (!matchedUser) return;

    const matchedUserNameEl = document.getElementById('matchedUserName');
    if (matchedUserNameEl) matchedUserNameEl.textContent = matchedUser.name;

    const myMatchImg = document.getElementById('myMatchImg');
    const theirMatchImg = document.getElementById('theirMatchImg');

    if (myMatchImg) myMatchImg.src = userData.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name)}`;
    if (theirMatchImg) theirMatchImg.src = matchedUser.image;

    matchOverlay.style.display = 'flex';

    // Store target ID for the "Send Message" button
    goToChatBtn.dataset.friendId = matchedUser.id;
    goToChatBtn.dataset.friendName = matchedUser.name;
}

function resetCard(card) {
    card.style.transition = 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.3s ease';
    card.style.transform = 'translateX(0) rotate(0)';
    card.style.boxShadow = '0 10px 40px -10px rgba(0,0,0,0.15)';
}

function checkEmpty() {
    const cards = document.querySelectorAll('.card');

    // Trigger prefetch
    if (cards.length <= 5) {
        fetchMoreProfiles();
    }

    // Show global loader if we just swiped the last card, still fetching, and on swipe screen
    const isOnSwipeScreen = sections['swipe-container'].classList.contains('section-active');
    if (cards.length === 0 && isFetchingProfiles && isOnSwipeScreen) {
        showLoader('Finding new matches...');
    }

    if (cards.length === 0 && !isFetchingProfiles && !hasMoreProfiles) {
        emptyState.style.display = 'flex';
        emptyState.innerHTML = '<i class="fas fa-heart-broken"></i><p>No more profiles nearby!</p>';
        if (swipeActions) swipeActions.style.display = 'none';
    }
}

function showDecoration(type) {
    const decoration = document.createElement('i');
    decoration.className = type === 'heart' ? 'fas fa-heart' : 'fas fa-star';
    decoration.style.position = 'fixed';
    decoration.style.left = '50%';
    decoration.style.top = '50%';
    decoration.style.transform = 'translate(-50%, -50%) scale(0)';
    decoration.style.color = type === 'heart' ? '#fe3c72' : '#2fb5ff';
    decoration.style.fontSize = '100px';
    decoration.style.zIndex = '3000';
    decoration.style.transition = 'transform 0.5s ease-out, opacity 0.5s ease-in';

    document.body.appendChild(decoration);

    void decoration.offsetWidth;

    decoration.style.transform = 'translate(-50%, -50%) scale(2)';
    decoration.style.opacity = '0';

    setTimeout(() => {
        decoration.remove();
    }, 500);
}

// Button Listeners
likeBtn.addEventListener('click', () => {
    const cards = document.querySelectorAll('.card');
    if (cards.length > 0) {
        swipeRight(cards[cards.length - 1]);
    }
});

rejectBtn.addEventListener('click', () => {
    const cards = document.querySelectorAll('.card');
    if (cards.length > 0) {
        swipeLeft(cards[cards.length - 1]);
    }
});

superLikeBtn.addEventListener('click', () => {
    const cards = document.querySelectorAll('.card');
    if (cards.length > 0) {
        swipeUp(cards[cards.length - 1]);
    }
});

closeMatchBtn.addEventListener('click', () => {
    matchOverlay.style.display = 'none';
});

goToChatBtn.addEventListener('click', () => {
    matchOverlay.style.display = 'none';
    switchView('left-sidebar'); // Navigate to messages
});

// Reset Swipes Logic
if (resetSwipesBtn) {
    resetSwipesBtn.addEventListener('click', () => {
        resetModal.style.display = 'flex';
    });
}

if (closeResetModal) {
    closeResetModal.addEventListener('click', () => {
        resetModal.style.display = 'none';
    });
}

resetOptionBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
        const type = btn.dataset.type;
        const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);

        const confirmReset = await showCustomConfirm(
            `Reset ${typeLabel}`,
            `Are you sure you want to clear your ${type} list? This action cannot be undone.`
        );

        if (confirmReset) {
            try {
                const response = await fetch('/reset-swipes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type })
                });
                const data = await response.json();

                if (data.success) {
                    showSnackbar(`${type.charAt(0).toUpperCase() + type.slice(1)} reset successfully!`, 'success');
                    resetModal.style.display = 'none';

                    // Update local userData counters if necessary
                    if (type === 'matches') {
                        userData.matchesCounter = 0;
                    } else if (type === 'liked' || type === 'superliked') {
                        userData.likesSentCounter = 0;
                    }

                    // Re-populate UI to show updated counters
                    populateUserData();

                    // Refresh profiles if we reset something that might give us new matches
                    if (type === 'liked' || type === 'superliked' || type === 'rejected' || type === 'matches') {
                        lastProfileId = null;
                        hasMoreProfiles = true;
                        cardStack.innerHTML = '';
                        cardStack.appendChild(emptyState);
                        fetchMoreProfiles();
                    }
                } else {
                    showSnackbar(data.error || 'Failed to reset interactions.', 'error');
                }
            } catch (error) {
                console.error('Reset swipes error:', error);
                showSnackbar('An error occurred during reset.', 'error');
            }
        }
    });
});

// Universal Navigation
const navItems = document.querySelectorAll('.bottom-nav .nav-item');
const sections = {
    'left-sidebar': document.querySelector('.left-sidebar'),
    'swipe-container': document.querySelector('.swipe-container'),
    'right-sidebar': document.querySelector('.profile-section'),
    'chat-view': document.querySelector('.chat-view')
};

/**
 * Helper to set a cookie
 */
function setCookie(name, value, days = 7) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = "; expires=" + date.toUTCString();
    document.cookie = name + "=" + (value || "") + expires + "; path=/; SameSite=Lax";
}

function switchView(targetId, type = 1) {
    const excludeView = ['chat-view'];
    // Hide all sections
    Object.values(sections).forEach(section => {
        section.classList.remove('section-active');
    });

    // Show target section
    const targetSection = sections[targetId];
    if (targetSection) {
        targetSection.classList.add('section-active');
    }

    // Update Nav Icons
    navItems.forEach(item => {
        if (item.dataset.target === targetId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // Persist view with timestamp and Cookie (for SSR)
    if (!excludeView.includes(targetId)) {
        localStorage.setItem('activeSection', targetId);
        localStorage.setItem('activeSectionTime', Date.now().toString());
        setCookie('activeSection', targetId);
    }

    // Lazy load data based on section
    if (targetId === 'left-sidebar') {
        type == 1 ? loadMatchesView() : null;
    } else if (targetId === 'right-sidebar') {
        loadProfileView();
    }
}

/**
 * Lazy load and render Matches
 */
function loadMatchesView() {
    // 1. Try injected data first (Server-side rendering bridge)
    if (window.initialMatches) {
        // Handle both legacy array and new object format
        const friends = Array.isArray(window.initialMatches) ? window.initialMatches : window.initialMatches.friends;
        if (Array.isArray(friends)) {
            renderFriends(friends);
        }
    }
    // 2. Try localStorage cache (Client-side cache)
    else {
        const cached = localStorage.getItem('cachedFriends');
        if (cached && cached !== 'undefined') {
            try {
                renderFriends(JSON.parse(cached));
            } catch (e) {
                console.error('Invalid cached friends data', e);
                localStorage.removeItem('cachedFriends');
            }
        }
    }

    // 3. Always fetch fresh data in background to keep it updated
    fetchFriends();
}

/**
 * Lazy load and render Profile
 */
let isFullProfileLoaded = false;
async function loadProfileView() {
    // 1. Initial render from what we have (might be partial/minimal)
    populateUserData();

    // 2. If we only have minimal data, fetch the full profile in background
    // We check for 'bio' as a marker of full data injection
    if (!userData.bio && !isFullProfileLoaded) {
        console.log('🔄 Fetching full profile details in background...');
        try {
            const response = await fetch('/api/auth/me');
            const data = await response.json();
            if (data.success) {
                // Update global userData with full details
                Object.assign(window.userData, data.user);
                isFullProfileLoaded = true;
                populateUserData(); // Re-populate with full data
                console.log('✅ Full profile details loaded');
            }
        } catch (error) {
            console.error('Failed to fetch full profile:', error);
        }
    }
}

async function fetchFriends() {
    const friendListContainer = document.querySelector('.friend-list');
    if (!friendListContainer) return;

    try {
        const response = await fetch('/api/friends');
        const data = await response.json();

        if (data.success && Array.isArray(data.friends)) {
            renderFriends(data.friends);
            // Cache in localStorage for next load
            localStorage.setItem('cachedFriends', JSON.stringify(data.friends));
            localStorage.setItem('cachedFriendsTime', Date.now().toString());
        }
    } catch (error) {
        console.error('Fetch friends error:', error);
    }
}

function renderFriends(friends) {
    console.log(friends)
    if (!friends) {
        return
    }
    const friendListContainer = document.querySelector('.friend-list');
    if (!friendListContainer) return;

    // Update badge count
    const badge = document.querySelector('.sidebar.left-sidebar .badge');
    if (badge) badge.textContent = friends.length;

    if (friends.length === 0) {
        friendListContainer.innerHTML = '<p class="empty-friends">No matches yet. Keep swiping!</p>';
        return;
    }

    friendListContainer.innerHTML = '';
    friends.forEach(friend => {
        const friendItem = document.createElement('div');
        friendItem.className = 'friend-item';
        friendItem.dataset.friendId = friend.id;
        friendItem.dataset.friendName = friend.name;
        friendItem.dataset.friendStatus = friend.online ? 'online' : 'offline';

        friendItem.innerHTML = `
            <img src="${friend.image}" alt="${friend.name}">
            <div class="friend-info">
                <h4>${friend.name}</h4>
                <p><span class="status-dot ${friend.online ? 'online' : 'offline'}"></span> ${friend.online ? 'Online' : 'Offline'}</p>
            </div>
            ${friend.unreadCount > 0 ? `<span class="unread-badge">${friend.unreadCount}</span>` : ''}
        `;

        // Click handler is managed by global event delegation (lines 1156+)
        // friendItem.addEventListener('click', () => {
        //     openChat(friend.id, friend.name, friend.online ? 'online' : 'offline', friend.image);
        // });

        friendListContainer.appendChild(friendItem);
    });
}

// Nav Click Listeners
navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const target = e.currentTarget.dataset.target;
        switchView(target);
    });
});

// Chat Functionality with Socket.IO
const friendItems = document.querySelectorAll('.friend-item');
const chatBackBtn = document.getElementById('chatBackBtn');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const chatSendBtn = document.getElementById('chatSendBtn');
const chatUserName = document.getElementById('chatUserName');
const chatUserStatusText = document.getElementById('chatUserStatusText');
const chatUserStatus = document.getElementById('chatUserStatus');

let currentChatFriend = null;
let currentChatRoomId = null;

// Pagination state for chat messages
let oldestCursor = null;  // Cursor for loading older messages
let newestCursor = null;  // Cursor for loading newer messages  
let isLoadingMessages = false;  // Prevent multiple simultaneous loads
let hasOlderMessages = true;  // Track if more old messages exist
let hasNewerMessages = false;  // Track if more new messages exist


/**
 * Toggle chat loader
 * @param {boolean} show - true to show, false to hide
 * Automatically positions at center if no messages, or at bottom if messages exist
 */

function toggleChatLoader(show) {
    const loaderId = 'chat-dynamic-loader';
    const existingLoader = document.getElementById(loaderId);
    const messagesContainer = document.getElementById('chatMessages');

    if (!messagesContainer) return;

    if (show) {
        if (!existingLoader) {
            const loaderHtml = `
                <div class="chat-loader" id="${loaderId}" style="display: flex;">
                    <div class="loader-hearts">
                        <div class="heart heart-1">💗</div>
                        <div class="heart heart-2">💖</div>
                        <div class="heart heart-3">💕</div>
                    </div>
                    <div class="loader-text">Loading messages...</div>
                </div>`;
            messagesContainer.insertAdjacentHTML('beforeend', loaderHtml);

            // Scroll to show the loader after a short delay
            setTimeout(() => {
                const newLoader = document.getElementById(loaderId);
                if (newLoader) {
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                }
            }, 50);
        }
    } else {
        if (existingLoader) {
            existingLoader.remove();
        }
    }
}

/**
 * Open chat with a friend
 */
/**
 * Open chat with a friend
 */
async function openChat(friendId, friendName, friendStatus, friendImage) {
    // Show loader
    toggleChatLoader(true);

    // Switch to chat view
    switchView('chat-view');

    // Emit seen event
    socket.emit('messages_seen', { friendId: friendId });

    // 1. Clear unread badge locally for instant feedback
    const friendItem = document.querySelector(`.friend-item[data-friend-id="${friendId}"]`);
    if (friendItem) {
        const badge = friendItem.querySelector('.unread-badge');
        if (badge) badge.remove();
    }

    // Leave previous chat if any
    if (currentChatFriend && currentChatFriend !== friendId) {
        socket.emit('leave_chat', { friendId: currentChatFriend });
    }

    currentChatFriend = friendId;
    chatUserName.textContent = friendName;

    // Reset pagination state
    oldestCursor = null;
    newestCursor = null;
    hasOlderMessages = true;
    hasNewerMessages = false;
    isLoadingMessages = false;

    // Remove existing scroll listener to avoid duplicates
    chatMessages.removeEventListener('scroll', handleChatScroll);

    // Update profile picture
    const chatAvatar = document.querySelector('.chat-user-avatar img');
    if (chatAvatar && friendImage) {
        chatAvatar.src = friendImage;
        chatAvatar.alt = friendName;
    }

    // Update status
    chatUserStatus.className = `status-dot ${friendStatus}`;
    chatUserStatusText.textContent = friendStatus === 'online' ? 'Online' : 'Offline';

    // Join chat room via Socket.IO
    socket.emit('join_chat', { friendId });

    // Load messages from API
    await loadChatMessages(friendId);

    // Add scroll listener for pagination
    chatMessages.addEventListener('scroll', handleChatScroll);

    // Mark messages as read
    markMessagesAsRead(friendId);

    // Hide loader
    toggleChatLoader(false);
}

/**
 * Handle chat scroll for pagination
 */
function handleChatScroll() {
    if (isLoadingMessages) return;

    // Scroll to top -> Load older messages
    if (chatMessages.scrollTop === 0 && hasOlderMessages) {
        loadOlderMessages();
    }

    // Scroll to bottom -> Load newer messages
    // Use a small buffer (e.g. 50px) to trigger before hitting exact bottom
    if (chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight < 50 && hasNewerMessages) {
        loadNewerMessages();
    }
}

/**
 * Load initial chat messages
 */
async function loadChatMessages(friendId) {
    try {
        const response = await fetch(`/api/chat/${friendId}`);
        const data = await response.json();

        if (data.success) {
            currentChatRoomId = data.chatId;
            chatMessages.innerHTML = '';

            // Redis returns newest first (xrevrange), but we want to display chronological (oldest top, newest bottom)
            // So we reverse the array to [Oldest, ..., Newest]
            const chronoMessages = data.messages.reverse();

            if (chronoMessages.length > 0) {
                // Set cursors
                oldestCursor = chronoMessages[0].id;
                newestCursor = chronoMessages[chronoMessages.length - 1].id;

                // If we got full limit, assume there might be older messages
                // For newer messages, initial load is at the "newest" tip, so usually no newer messages yet
                // unless we implement jumping to specific point later.
                hasOlderMessages = data.messages.length >= 50;
                hasNewerMessages = false;

                chronoMessages.forEach(msg => {
                    const isSent = msg.sentBy === userData.id;
                    appendMessage(msg, isSent, false);
                });

                // Scroll to bottom
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
        }
    } catch (error) {
        console.error('Load chat messages error:', error);
    }
}

/**
 * Load older messages (Pagination Up)
 */
async function loadOlderMessages() {
    if (!oldestCursor || isLoadingMessages) return;

    isLoadingMessages = true;
    const currentHeight = chatMessages.scrollHeight;

    // Show top loader or visual indicator if needed

    try {
        const response = await fetch(`/api/chat/${currentChatFriend}?cursor=${oldestCursor}&direction=older`);
        const data = await response.json();

        if (data.success && data.messages.length > 0) {
            // Update cursor to the new oldest
            // API returns [NewerOld ... OlderOld] (xrevrange)
            // We want to display [OlderOld ... NewerOld] -> [Existing]
            const messages = data.messages.reverse();
            oldestCursor = messages[0].id; // Newest of the batch (wait, reversed means 0 is Oldest)
            // Actually: API xrevrange returns [Max ... Min]. 
            // Reversed: [Min ... Max].
            // So messages[0] is the absolute oldest of this batch.
            oldestCursor = messages[0].id;

            messages.forEach(msg => {
                const isSent = msg.sentBy === userData.id;
                const time = new Date(msg.timestamp).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit'
                });
                // Prepend message
                appendMessage(msg, isSent, true);
            });

            // Maintain scroll position
            chatMessages.scrollTop = chatMessages.scrollHeight - currentHeight;

            hasOlderMessages = data.messages.length >= 50;
        } else {
            hasOlderMessages = false;
        }
    } catch (error) {
        console.error('Error loading older messages:', error);
    } finally {
        isLoadingMessages = false;
    }
}

/**
 * Load newer messages (Pagination Down)
 */
async function loadNewerMessages() {
    if (!newestCursor || isLoadingMessages) return;

    isLoadingMessages = true;

    try {
        const response = await fetch(`/api/chat/${currentChatFriend}?cursor=${newestCursor}&direction=newer`);
        const data = await response.json();

        if (data.success && data.messages.length > 0) {
            // API returns [OlderNew ... NewerNew] (xrange) - Correct chronological order
            const messages = data.messages;
            newestCursor = messages[messages.length - 1].id;

            messages.forEach(msg => {
                const isSent = msg.sentBy === userData.id;
                const time = new Date(msg.timestamp).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit'
                });
                appendMessage(msg, isSent, false);
            });

            hasNewerMessages = data.messages.length >= 50;
        } else {
            hasNewerMessages = false;
        }
    } catch (error) {
        console.error('Error loading newer messages:', error);
    } finally {
        isLoadingMessages = false;
    }
}

const HEART_SVG = '<svg class="heart-icon" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';

/**
 * Append message to chat interface
 * @param {object} msg - Message object { message, timestamp, id, sentBy, seen }
 * @param {boolean} isSent - True if sent by current user
 * @param {boolean} prepend - True to prepend to top (loading older messages)
 */
function appendMessage(msg, isSent, prepend = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;
    if (msg.id) messageDiv.dataset.messageId = msg.id;
    if (msg.seen && isSent) messageDiv.dataset.seen = 'true';

    const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Heart Status Logic for Sender
    let statusHtml = '';
    if (isSent) {
        let hearts = HEART_SVG; // Default 1 heart (sending/optimistic)
        let seenClass = '';

        // If message has an ID, it's at least delivered/saved -> Default 2 hearts (grey)
        if (msg.id) {
            hearts = HEART_SVG + HEART_SVG;
        }

        // If seen, mark as seen (CSS will turn them red)
        if (msg.seen) {
            hearts = hearts.replace(/class="heart-icon"/g, 'class="heart-icon seen"');
            seenClass = 'seen';
        }

        statusHtml = `<div class="message-status ${seenClass}">${hearts}</div>`;
    }

    messageDiv.innerHTML = `
        <div class="message-bubble">
            <div class="message-text">${msg.message}</div>
            <div class="message-info">
                <div class="message-time">${time}</div>
                ${statusHtml}
            </div>
        </div>
    `;

    if (prepend) {
        chatMessages.prepend(messageDiv);
    } else {
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

/**
 * Mark messages as read
 */
async function markMessagesAsRead(friendId) {
    try {
        await fetch(`/api/chat/${friendId}/mark-read`, {
            method: 'POST'
        });
        // Update unread count
        updateUnreadCount();
    } catch (error) {
        console.error('Mark read error:', error);
    }
}

/**
 * Update unread message count badge
 */
async function updateUnreadCount() {
    try {
        const response = await fetch('/api/chat/unread-count');
        const data = await response.json();

        if (data.success) {
            const badge = document.querySelector('.nav-item[data-target="left-sidebar"] .badge');
            if (badge) {
                badge.textContent = data.unreadCount;
                badge.style.display = data.unreadCount > 0 ? 'block' : 'none';
            }
        }
    } catch (error) {
        console.error('Update unread count error:', error);
    }
}

// Listen for chat_joined confirmation
socket.on('chat_joined', (data) => {
    console.log('✅ Joined chat room:', data.chatRoomId);
    currentChatRoomId = data.chatRoomId;
});

// Handle new messages
socket.on('new_message', (data) => {
    // Check for Optimistic Update (My message came back)
    if (data.tempId) {
        const tempMsg = document.querySelector(`.message[data-message-id="${data.tempId}"]`);
        if (tempMsg) {
            // Update ID
            tempMsg.dataset.messageId = data.id;

            // Update Status to 2 Hearts (Delivered)
            const statusContainer = tempMsg.querySelector('.message-status');
            if (statusContainer) {
                statusContainer.innerHTML = HEART_SVG + HEART_SVG;
            }
            return; // Stop here, don't append duplicate
        }
    }

    // Standard append for others or if temp not found
    if (currentChatRoomId === data.chatRoomId) {
        // If it's my message but no tempId (shouldn't happen with new logic but safe fallback)
        // or if it's friend's message
        const isSent = data.sentBy === userData.id;

        appendMessage(data, isSent, false);

        chatMessages.scrollTop = chatMessages.scrollHeight;

        // If I am receiving a message in active chat -> Mark Seen
        if (!isSent) {
            socket.emit('messages_seen', { friendId: currentChatFriend });
            // Also locally mark as read? markMessagesAsRead does API call.
            // But visually we just want to remove badge (already done by openChat/message_notification check?)
            // message_notification check: "If we are already chatting with this user, don't show badge" -> handled.
        }
    } else {
        // Message from different chat - show notification
        showUnreadNotification(data); // This is not defined in snippets but assumed to exist or unrelated

        // Also trigger unread count update?
        // message_notification handles the badge update locally.
        // updateUnreadCount fetches from API? expensive to call every time.
        // Let message_notification handle it.
    }
});

// Handle Messages Seen (Read Receipt)
socket.on('messages_seen', (data) => {
    const { seenBy, chatRoomId } = data;
    // If I am looking at this chat (should be yes if seenBy is currentChatFriend)
    if (currentChatFriend === seenBy) {
        // Mark all my sent messages as seen
        const myMessages = document.querySelectorAll('.message.sent');
        myMessages.forEach(msg => {
            if (msg.dataset.seen === 'true') return; // Already seen

            const statusContainer = msg.querySelector('.message-status');
            if (statusContainer) {
                // Add seen class to container and hearts
                // Use a loop or just replace innerHTML?
                // Replacing innerHTML with "seen" version of hearts is cleaner
                // But simple class toggle is CSS friendly

                // Add seen class to hearts
                const hearts = statusContainer.querySelectorAll('.heart-icon');
                hearts.forEach(h => h.classList.add('seen'));
            }
            msg.dataset.seen = 'true';
        });
    }
});

/**
 * Show unread message notification
 */
function showUnreadNotification(messageData) {
    // Create notification popup
    const notification = document.createElement('div');
    notification.className = 'unread-notification';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: white;
        padding: 15px 20px;
        border-radius: 12px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        max-width: 300px;
        animation: slideIn 0.3s ease;
    `;
    notification.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 5px;">New Message</div>
        <div style="color: #666; font-size: 14px;">${messageData.message}</div>
    `;

    document.body.appendChild(notification);

    // Auto remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Friend item click - use event delegation for dynamically added items
document.addEventListener('click', (e) => {
    const friendItem = e.target.closest('.friend-item');
    if (friendItem) {
        const friendId = friendItem.dataset.friendId;
        const friendName = friendItem.dataset.friendName;
        const friendStatus = friendItem.dataset.friendStatus || 'offline';
        const friendImage = friendItem.querySelector('img')?.src;
        openChat(friendId, friendName, friendStatus, friendImage);
    }
});

// Chat back button
if (chatBackBtn) {
    chatBackBtn.addEventListener('click', () => {
        // Leave chat room
        if (currentChatFriend) {
            socket.emit('leave_chat', { friendId: currentChatFriend });
            currentChatFriend = null;
            currentChatRoomId = null;
        }
        chatMessages.innerHTML = '';
        switchView('left-sidebar', type = 2);
    });
}

// Send message
// Send message
function sendMessage() {
    const text = chatInput.value.trim();
    if (text && currentChatFriend) {

        const tempId = 'temp-' + Date.now();
        const timestamp = Date.now();

        // Optimistic UI: Append immediately
        appendMessage({
            message: text,
            timestamp: timestamp,
            id: tempId,
            sentBy: userData.id,
            seen: false
        }, true, false);

        // Send via Socket.IO
        socket.emit('send_message', {
            friendId: currentChatFriend,
            message: text,
            tempId: tempId
        });

        chatInput.value = '';

        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

if (chatSendBtn) {
    chatSendBtn.addEventListener('click', sendMessage);
}

if (chatInput) {
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
}

// Update unread count on page load
updateUnreadCount();

// Profile Editing
const profileUsername = document.getElementById('profileUsername');
const profileBio = document.getElementById('profileBio');
const profilePicEdit = document.getElementById('profilePicEdit');
const addTagBtn = document.getElementById('addTagBtn');

// Make username editable on click
profileUsername.addEventListener('click', () => {
    profileUsername.contentEditable = 'true';
    profileUsername.focus();
});

profileUsername.addEventListener('blur', () => {
    profileUsername.contentEditable = 'false';
});

// Make bio editable on click
profileBio.addEventListener('click', () => {
    profileBio.contentEditable = 'true';
    profileBio.focus();
});

profileBio.addEventListener('blur', () => {
    profileBio.contentEditable = 'false';
});

// Editable state tracking
let localTags = [];
const originalData = { name: '', bio: '', tags: [] };
let isProfileModified = false;
let isSaving = false;

function checkChanges() {
    const currentName = profileUsername.textContent.trim();
    const currentBio = profileBio.textContent.trim();
    const saveBtn = document.getElementById('saveProfileBtn');

    const hasNameChanged = currentName !== originalData.name;
    const hasBioChanged = currentBio !== originalData.bio;
    const hasTagsChanged = JSON.stringify([...localTags].sort()) !== JSON.stringify([...originalData.tags].sort());

    isProfileModified = hasNameChanged || hasBioChanged || hasTagsChanged;

    if (isProfileModified) {
        saveBtn.classList.add('visible');
    } else {
        saveBtn.classList.remove('visible');
    }
}

// Profile Fields Observers (for contenteditable)
profileUsername.addEventListener('input', checkChanges);
profileBio.addEventListener('input', checkChanges);

// Tag Modal Logic
const tagModal = document.getElementById('tagModal');
const closeTagModal = document.getElementById('closeTagModal');
const confirmTagsBtn = document.getElementById('confirmTagsBtn');
const selectedTagsPreview = document.getElementById('selectedTagsPreview');
const tagOptions = document.querySelectorAll('.tag-opt');

const openModal = () => {
    tagModal.classList.add('active');
    updateModalPreview();
};

const closeModal = () => {
    tagModal.classList.remove('active');
};

const updateModalPreview = () => {
    selectedTagsPreview.innerHTML = '';
    localTags.forEach(tag => {
        const span = document.createElement('span');
        span.className = 'tag';
        span.innerHTML = `${tag} <button class="tag-remove">&times;</button>`;
        span.querySelector('.tag-remove').onclick = () => removeTag(tag);
        selectedTagsPreview.appendChild(span);
    });

    // Update highlights in the grid
    tagOptions.forEach(opt => {
        if (localTags.includes(opt.textContent)) {
            opt.classList.add('selected');
        } else {
            opt.classList.remove('selected');
        }
    });
};

const toggleTag = (tag) => {
    if (localTags.includes(tag)) {
        localTags = localTags.filter(t => t !== tag);
    } else {
        localTags.push(tag);
    }
    updateModalPreview();
};

const removeTag = (tag) => {
    localTags = localTags.filter(t => t !== tag);
    updateModalPreview();
    renderLocalTags();
    checkChanges();
};

tagOptions.forEach(opt => {
    opt.onclick = () => toggleTag(opt.textContent);
});

confirmTagsBtn.onclick = () => {
    renderLocalTags();
    closeModal();
    checkChanges();
};

closeTagModal.onclick = closeModal;
window.onclick = (e) => { if (e.target === tagModal) closeModal(); };

const renderLocalTags = () => {
    const tagContainer = document.querySelector('.profile-tags');
    // Keep only the add button
    const addBtn = document.querySelector('.tag-add');
    tagContainer.innerHTML = '';

    localTags.forEach(tag => {
        const span = document.createElement('span');
        span.className = 'tag';
        span.innerHTML = `${tag} <button class="tag-remove">&times;</button>`;
        span.querySelector('.tag-remove').onclick = () => removeTag(tag);
        tagContainer.appendChild(span);
    });

    tagContainer.appendChild(addBtn);
};

// Add tag button click
addTagBtn.addEventListener('click', openModal);

// Save Profile Logic
const saveProfileBtn = document.getElementById('saveProfileBtn');
saveProfileBtn.addEventListener('click', async () => {
    // Prevent redundant clicks if not modified or already saving
    if (!isProfileModified || isSaving) return;

    try {
        isSaving = true;
        showLoader('Updating...');
        const updatedMeta = {
            name: profileUsername.textContent.trim(),
            bio: profileBio.textContent.trim(),
            tags: localTags
        };

        const response = await fetch('/api/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedMeta)
        });

        const data = await response.json();
        if (data.success) {
            showSnackbar('Profile updated successfully!');

            // Mark as not modified immediately
            isProfileModified = false;

            // Transition button to Click/Success state
            const saveBtn = document.getElementById('saveProfileBtn');
            const icon = saveBtn.querySelector('i');
            const text = saveBtn.querySelector('span');

            icon.className = 'fas fa-check';
            text.textContent = 'Saved';
            saveBtn.style.background = '#4cca4f';
            saveBtn.style.color = 'white';

            // Update original data to match current
            originalData.name = updatedMeta.name;
            originalData.bio = updatedMeta.bio;
            originalData.tags = [...localTags];

            setTimeout(() => {
                checkChanges();
                // Reset button style for next edit
                icon.className = 'fas fa-save';
                text.textContent = 'Save';
                saveBtn.style.background = '';
                saveBtn.style.color = '';
            }, 2000);
        } else {
            showSnackbar('Error: ' + (data.error || 'Failed to save'), 'error');
        }
    } catch (error) {
        console.error('Save profile error:', error);
        showSnackbar('Connection error while saving', 'error');
    } finally {
        isSaving = false;
        hideLoader();
    }
});

// Update populateUserData to initialize originalData
const originalPopulate = populateUserData;
populateUserData = () => {
    originalPopulate();
    // Cache original values for change tracking
    originalData.name = userData.name || 'Alex Johnson';
    originalData.bio = userData.bio || '';
    originalData.tags = [...(userData.tags || [])];
    localTags = [...originalData.tags];

    // Enable contenteditable for fields
    profileUsername.contentEditable = 'true';
    profileBio.contentEditable = 'true';
};

// Logout logic
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        showLoader('Logging out...');

        // Disconnect socket before navigating
        if (socket) {
            socket.disconnect();
        }

        // Standard navigation allows server-side redirect to work
        window.location.href = '/api/auth/logout';
    });
}

// Verify authentication on page load
document.addEventListener('DOMContentLoaded', () => {
    // 1. Restore last active section OR default to swipe
    const savedSection = localStorage.getItem('activeSection');
    const savedTime = localStorage.getItem('activeSectionTime');
    const now = Date.now();

    let activeId = 'swipe-container';
    // 5 minutes = 300,000ms
    if (savedSection && savedTime && (now - parseInt(savedTime)) < 300000) {
        activeId = savedSection;
    }

    // 2. Switch to active view (this triggers the specific lazy-load functions)
    switchView(activeId);

    // 3. Initialize core features (Swiping engine)
    init();
});
/**
 * Custom promise-based confirm dialog
 */
function showCustomConfirm(title, message) {
    return new Promise((resolve) => {
        confirmTitle.textContent = title;
        confirmMessage.textContent = message;
        confirmModal.style.display = 'flex';

        const handleOk = () => {
            cleanup();
            resolve(true);
        };

        const handleCancel = () => {
            cleanup();
            resolve(false);
        };

        const cleanup = () => {
            okConfirmBtn.removeEventListener('click', handleOk);
            cancelConfirmBtn.removeEventListener('click', handleCancel);
            confirmModal.style.display = 'none';
        };

        okConfirmBtn.addEventListener('click', handleOk);
        cancelConfirmBtn.addEventListener('click', handleCancel);
    });
}

// Profile Picture Upload Logic
const fileInput = document.getElementById('fileInput');
const uploadModal = document.getElementById('uploadModal');
const closeUploadModal = document.getElementById('closeUploadModal');
const cancelUploadBtn = document.getElementById('cancelUploadBtn');
const saveProfilePicBtn = document.getElementById('saveProfilePicBtn');
const imageToCrop = document.getElementById('imageToCrop');
const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');
const rotateLeftBtn = document.getElementById('rotateLeftBtn');
const rotateRightBtn = document.getElementById('rotateRightBtn');

let cropper = null;

if (profilePicEdit) {
    profilePicEdit.addEventListener('click', (e) => {
        console.log('📸 Profile picture edit clicked');
        e.preventDefault();
        e.stopPropagation();
        if (fileInput) {
            fileInput.click();
        } else {
            console.error('❌ File input not found');
        }
    });
}

if (fileInput) {
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                imageToCrop.src = e.target.result;
                uploadModal.style.display = 'flex';

                // Initialize Cropper
                if (cropper) {
                    cropper.destroy();
                }
                setTimeout(() => {
                    cropper = new Cropper(imageToCrop, {
                        aspectRatio: 1,
                        viewMode: 1,
                        dragMode: 'move',
                        autoCropArea: 1,
                        restore: false,
                        guides: false,
                        center: false,
                        highlight: false,
                        cropBoxMovable: false,
                        cropBoxResizable: false,
                        toggleDragModeOnDblclick: false,
                    });
                }, 100);
            };
            reader.readAsDataURL(file);
        }
    });
}

// Cropper Controls
if (zoomInBtn) zoomInBtn.addEventListener('click', () => cropper && cropper.zoom(0.1));
if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => cropper && cropper.zoom(-0.1));
if (rotateLeftBtn) rotateLeftBtn.addEventListener('click', () => cropper && cropper.rotate(-90));
if (rotateRightBtn) rotateRightBtn.addEventListener('click', () => cropper && cropper.rotate(90));

function closeUpload() {
    uploadModal.style.display = 'none';
    if (cropper) {
        cropper.destroy();
        cropper = null;
    }
    fileInput.value = '';
}

if (closeUploadModal) closeUploadModal.addEventListener('click', closeUpload);
if (cancelUploadBtn) cancelUploadBtn.addEventListener('click', closeUpload);

if (saveProfilePicBtn) {
    saveProfilePicBtn.addEventListener('click', () => {
        if (!cropper) return;

        showLoader('Uploading profile picture...');
        cropper.getCroppedCanvas({
            width: 500,
            height: 500
        }).toBlob(async (blob) => {
            const formData = new FormData();
            formData.append('photo', blob, 'profile.png');

            try {
                const response = await fetch('/api/profile/upload-photo', {
                    method: 'POST',
                    body: formData
                });
                const data = await response.json();

                if (data.success) {
                    showSnackbar('Profile picture updated!', 'success');

                    // Update local data
                    userData.profilePicture = data.url;
                    populateUserData();

                    // Force refresh cache (optional, but good visual feedback)
                    const profilePics = document.querySelectorAll('#profilePic, .profile-pic, .user-avatar');
                    profilePics.forEach(img => {
                        img.src = data.url;
                    });

                    closeUpload();
                } else {
                    showSnackbar(data.error || 'Upload failed', 'error');
                }
            } catch (error) {
                console.error('Upload error:', error);
                showSnackbar('An error occurred during upload', 'error');
            } finally {
                hideLoader();
            }
        });
    });
}

// ============================================
// POST UPLOAD FUNCTIONALITY
// ============================================

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    const addPostBtn = document.getElementById('addPostBtn');
    const postUploadModal = document.getElementById('postUploadModal');
    const modalClose = document.getElementById('modalClose');
    const modalOverlay = document.getElementById('modalOverlay');
    const capturePhotoBtn = document.getElementById('capturePhotoBtn');
    const postUploadDeviceBtn = document.getElementById('postUploadDeviceBtn');
    const postFileInput = document.getElementById('postFileInput');
    const postCameraInput = document.getElementById('cameraInput');

    // Crop Elements
    const postCropContainer = document.getElementById('postCropContainer');
    const postCropImage = document.getElementById('postCropImage');
    const postCropControls = document.getElementById('postCropControls');
    const confirmPostBtn = document.getElementById('confirmPostBtn');
    const cancelCropBtn = document.getElementById('cancelCropBtn');

    let cropper = null;
    let croppedBlob = null;

    // console.log('Post upload elements:', {
    //     addPostBtn,
    //     postUploadModal,
    //     modalClose,
    //     modalOverlay,
    //     capturePhotoBtn,
    //     uploadFileBtn
    // });

    // Open modal
    if (addPostBtn) {
        addPostBtn.addEventListener('click', () => {
            console.log('Add Post button clicked!');
            postUploadModal.classList.add('active');
            console.log('Modal classes:', postUploadModal.className);
        });
    } else {
        console.error('addPostBtn not found!');
    }

    // Close modal
    // Webcam Elements
    const cameraContainer = document.getElementById('cameraContainer');
    const uploadOptions = document.getElementById('uploadOptions');
    const cameraPreview = document.getElementById('cameraPreview');
    const cameraCanvas = document.getElementById('cameraCanvas');
    const captureBtn = document.getElementById('captureBtn');
    const closeCameraBtn = document.getElementById('closeCameraBtn');

    let mediaStream = null;

    // Open Camera UI
    if (capturePhotoBtn) {
        capturePhotoBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            // Check if mobile device
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            console.log('Camera button clicked. isMobile:', isMobile, 'UserAgent:', navigator.userAgent);

            if (isMobile) {
                // Use native file picker with capture on mobile
                console.log('Mobile detected, opening file picker');
                postCameraInput.click();
            } else {
                // Use Webcam UI on desktop
                console.log('Desktop detected, starting webcam');
                startCamera();
            }
        });
    }

    async function startCamera() {
        try {
            uploadOptions.style.display = 'none';
            cameraContainer.style.display = 'block';

            mediaStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'user',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            });

            cameraPreview.srcObject = mediaStream;
        } catch (error) {
            console.error('Camera access error:', error);
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                showSnackbar('Camera access denied. Please enable permissions in browser settings.');
            } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
                showSnackbar('Camera is in use by another application.');
            } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
                showSnackbar('No camera device found.');
            } else {
                showSnackbar('Could not access camera: ' + error.message);
            }
            stopCamera();
        }
    }

    function stopCamera() {
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
            mediaStream = null;
        }
        if (cameraPreview) cameraPreview.srcObject = null;
        if (cameraContainer) cameraContainer.style.display = 'none';
        if (uploadOptions) uploadOptions.style.display = 'flex';
    }

    // Capture Photo
    if (captureBtn) {
        captureBtn.addEventListener('click', () => {
            if (!mediaStream) return;

            // Set canvas dimensions to match video
            cameraCanvas.width = cameraPreview.videoWidth;
            cameraCanvas.height = cameraPreview.videoHeight;

            // Draw video frame to canvas
            const ctx = cameraCanvas.getContext('2d');

            // Mirror flip context if needed (to match preview)
            ctx.translate(cameraCanvas.width, 0);
            ctx.scale(-1, 1);

            ctx.drawImage(cameraPreview, 0, 0, cameraCanvas.width, cameraCanvas.height);

            // Convert to blob and upload
            cameraCanvas.toBlob(blob => {
                const file = new File([blob], "camera_capture.jpg", { type: "image/jpeg" });
                stopCamera();
                startCrop(file); // Send to cropper instead of direct upload
            }, 'image/jpeg', 0.9);
        });
    }

    // Close Camera
    if (closeCameraBtn) {
        closeCameraBtn.addEventListener('click', stopCamera);
    }

    // Close modal should also stop camera
    function closePostModal() {
        stopCamera();
        postUploadModal.classList.remove('active');
    }

    if (modalClose) modalClose.addEventListener('click', closePostModal);
    if (modalOverlay) modalOverlay.addEventListener('click', closePostModal);

    // File upload button click
    if (postUploadDeviceBtn) {
        postUploadDeviceBtn.addEventListener('click', () => {
            postFileInput.click();
        });
    }

    // Handle file selection for cropping
    if (postFileInput) {
        postFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                startCrop(file);
            }
        });
    }

    // Start Cropper
    function startCrop(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            postCropImage.src = e.target.result;

            // Show crop UI, hide others
            uploadOptions.style.display = 'none';
            if (cameraContainer) cameraContainer.style.display = 'none';
            postCropContainer.style.display = 'flex';
            postCropControls.style.display = 'flex';

            // Init Cropper
            if (cropper) cropper.destroy();
            cropper = new Cropper(postCropImage, {
                aspectRatio: 1, // Square posts
                viewMode: 1,
                dragMode: 'move',
                autoCropArea: 1,
                restore: false,
                guides: true,
                center: true,
                highlight: false,
                cropBoxMovable: true,
                cropBoxResizable: true,
                toggleDragModeOnDblclick: false,
            });
        };
        reader.readAsDataURL(file);
    }

    // Confirm Crop & Post
    if (confirmPostBtn) {
        confirmPostBtn.addEventListener('click', () => {
            if (!cropper) return;

            // Get cropped canvas
            cropper.getCroppedCanvas({
                width: 1080,
                height: 1080,
                fillColor: '#000000'
            }).toBlob((blob) => {
                if (!blob) return;

                const file = new File([blob], "post_image.jpg", { type: "image/jpeg" });

                // Cleanup UI
                resetCropUI();

                // Upload
                handlePostUpload(file);
            }, 'image/jpeg', 0.9);
        });
    }

    // Cancel Crop
    if (cancelCropBtn) {
        cancelCropBtn.addEventListener('click', () => {
            resetCropUI();
            uploadOptions.style.display = 'flex';
            postFileInput.value = '';
        });
    }

    function resetCropUI() {
        if (cropper) {
            cropper.destroy();
            cropper = null;
        }
        postCropContainer.style.display = 'none';
        postCropControls.style.display = 'none';
        postCropImage.src = '';
    }

    // Handle file selection (both camera and file)
    async function handlePostUpload(file) {
        if (!file) return;

        try {
            // showLoader('Uploading...'); // Old loader
            const bottomNav = document.querySelector('.bottom-nav');
            if (bottomNav) bottomNav.classList.add('uploading');

            closePostModal();

            // Create FormData
            const formData = new FormData();
            formData.append('image', file);
            formData.append('caption', ''); // Can add caption input later

            // Upload to API
            // Note: dashboardRouter is mounted at root '/', so the path is '/posts'
            const response = await fetch('/posts', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                showSnackbar('Post created successfully! 🎉');

                // Optimistic UI: Add post to top of feed
                const postsGrid = document.getElementById('postsGrid');
                const postsCount = document.getElementById('postsCount');

                if (postsGrid) {
                    const post = data.post;
                    const postItem = document.createElement('div');
                    postItem.className = 'post-item';
                    postItem.innerHTML = `<img src="${post.imageUrl}" alt="Post">`;

                    // Remove 'no posts' message if it exists
                    const noPostsMsg = postsGrid.querySelector('.no-posts');
                    if (noPostsMsg) {
                        noPostsMsg.remove();
                    }

                    postsGrid.prepend(postItem);
                }

                if (postsCount) {
                    const currentCount = parseInt(postsCount.textContent) || 0;
                    postsCount.textContent = currentCount + 1;
                }

            } else {
                showSnackbar('Failed to create post: ' + (data.error || 'Unknown error'));
            }

        } catch (error) {
            console.error('Upload error:', error);
            showSnackbar('Failed to upload post');
        } finally {
            // hideLoader();
            const bottomNav = document.querySelector('.bottom-nav');
            if (bottomNav) bottomNav.classList.remove('uploading');
        }
    }
});

