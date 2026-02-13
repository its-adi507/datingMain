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
        if (userData.profilePicture) {
            el.src = `api/assets/profile/${userData.id}.png`;
        } else {
            // Use first letter of name as fallback
            el.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name)}&background=667eea&color=fff&size=200`;
        }
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
    if (postsCount) postsCount.textContent = userData.postsCounter || 0;

    // Update posts grid
    const postsGrid = document.getElementById('postsGrid');
    if (postsGrid) {
        postsGrid.innerHTML = '';
        if (userData.posts && userData.posts.length > 0) {
            userData.posts.forEach((postUrl, index) => {
                const postItem = document.createElement('div');
                postItem.className = 'post-item';
                postItem.innerHTML = `<img src="${postUrl}" alt="Post ${index + 1}">`;
                postsGrid.appendChild(postItem);
            });
        } else {
            postsGrid.innerHTML = '<p class="no-posts">No posts yet</p>';
        }
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
        matchOverlay.style.display = 'none';
        if (friendId && friendName) {
            openChat(friendId, friendName, 'online');
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
        if (currentCards === 0 && isOnSwipeScreen) showLoader('Finding new matches...');

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
        <img src="/api/assets/profile/${profile.id}.png" alt="${profile.name}" onerror="this.src='https://i.pravatar.cc/400?u=fallback'">
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

function switchView(targetId) {
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
    localStorage.setItem('activeSection', targetId);
    localStorage.setItem('activeSectionTime', Date.now().toString());
    setCookie('activeSection', targetId);

    // Lazy load data based on section
    if (targetId === 'left-sidebar') {
        loadMatchesView();
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
        renderFriends(window.initialMatcshes);
        // Clear it so we don't use stale injected data if they refresh manually later? 
        // Actually keep it for this session.
    }
    // 2. Try localStorage cache (Client-side cache)
    else {
        const cached = localStorage.getItem('cachedFriends');
        if (cached) {
            renderFriends(JSON.parse(cached));
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

        if (data.success) {
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
        `;

        friendItem.addEventListener('click', () => {
            openChat(friend.id, friend.name, friend.online ? 'online' : 'offline');
        });

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

// Chat Functionality
const friendItems = document.querySelectorAll('.friend-item');
const chatBackBtn = document.getElementById('chatBackBtn');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const chatSendBtn = document.getElementById('chatSendBtn');
const chatUserName = document.getElementById('chatUserName');
const chatUserStatusText = document.getElementById('chatUserStatusText');
const chatUserStatus = document.getElementById('chatUserStatus');

let currentChatFriend = null;

function openChat(friendId, friendName, friendStatus) {
    currentChatFriend = friendId;
    chatUserName.textContent = friendName;

    // Update status
    chatUserStatus.className = `status-dot ${friendStatus}`;
    chatUserStatusText.textContent = friendStatus === 'online' ? 'Online' : 'Offline';

    // Load messages
    loadChatMessages(friendId);

    // Switch to chat view
    switchView('chat-view');
}

function loadChatMessages(friendId) {
    chatMessages.innerHTML = '';
    const messages = mockMessages[friendId] || [];

    messages.forEach(msg => {
        addMessageToChat(msg.text, msg.sent, msg.time);
    });

    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addMessageToChat(text, sent, time) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sent ? 'sent' : ''}`;
    messageDiv.innerHTML = `
        <div class="message-bubble">
            <div>${text}</div>
            <div class="message-time">${time}</div>
        </div>
    `;
    chatMessages.appendChild(messageDiv);
}

// Friend item click
friendItems.forEach(item => {
    item.addEventListener('click', () => {
        const friendId = item.dataset.friendId;
        const friendName = item.dataset.friendName;
        const friendStatus = item.dataset.friendStatus;
        openChat(friendId, friendName, friendStatus);
    });
});

// Chat back button
chatBackBtn.addEventListener('click', () => {
    switchView('left-sidebar');
});

// Send message
function sendMessage() {
    const text = chatInput.value.trim();
    if (text && currentChatFriend) {
        const now = new Date();
        const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        addMessageToChat(text, true, time);
        chatInput.value = '';

        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // Save to mock data
        if (!mockMessages[currentChatFriend]) {
            mockMessages[currentChatFriend] = [];
        }
        mockMessages[currentChatFriend].push({ text, sent: true, time });
    }
}

chatSendBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

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
        showLoader();
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
