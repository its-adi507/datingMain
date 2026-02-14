// Country codes data
const countries = [
    { code: 'IN', dialCode: '+91', name: 'India', flag: 'in' },
    { code: 'US', dialCode: '+1', name: 'United States', flag: 'us' },
    { code: 'GB', dialCode: '+44', name: 'United Kingdom', flag: 'gb' },
    { code: 'CA', dialCode: '+1', name: 'Canada', flag: 'ca' },
    { code: 'AU', dialCode: '+61', name: 'Australia', flag: 'au' },
    { code: 'AE', dialCode: '+971', name: 'United Arab Emirates', flag: 'ae' },
    { code: 'SA', dialCode: '+966', name: 'Saudi Arabia', flag: 'sa' },
    { code: 'SG', dialCode: '+65', name: 'Singapore', flag: 'sg' },
    { code: 'MY', dialCode: '+60', name: 'Malaysia', flag: 'my' },
    { code: 'PK', dialCode: '+92', name: 'Pakistan', flag: 'pk' },
    { code: 'BD', dialCode: '+880', name: 'Bangladesh', flag: 'bd' },
    { code: 'LK', dialCode: '+94', name: 'Sri Lanka', flag: 'lk' },
    { code: 'NP', dialCode: '+977', name: 'Nepal', flag: 'np' },
];

// State
let currentMode = 'login'; // 'login' or 'register'
let currentCountrySelector = null;
let selectedCountry = { login: countries[0], register: countries[0] };

// Elements
const tabBtns = document.querySelectorAll('.tab-btn');
const authTabs = document.querySelector('.auth-tabs');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');

// Login elements
const loginCountrySelector = document.getElementById('loginCountrySelector');
const loginCountryFlag = document.getElementById('loginCountryFlag');
const loginCountryCode = document.getElementById('loginCountryCode');
const loginMobile = document.getElementById('loginMobile');
const loginSendOtpBtn = document.getElementById('loginSendOtpBtn');
const loginMobileStep = document.getElementById('loginMobileStep');
const loginOtpStep = document.getElementById('loginOtpStep');
const loginBackBtn = document.getElementById('loginBackBtn');
const loginPhoneDisplay = document.getElementById('loginPhoneDisplay');
const loginVerifyBtn = document.getElementById('loginVerifyBtn');
const loginResendBtn = document.getElementById('loginResendBtn');

// Register elements
const registerCountrySelector = document.getElementById('registerCountrySelector');
const registerCountryFlag = document.getElementById('registerCountryFlag');
const registerCountryCode = document.getElementById('registerCountryCode');
const registerName = document.getElementById('registerName');
const registerMobile = document.getElementById('registerMobile');
const registerSendOtpBtn = document.getElementById('registerSendOtpBtn');
const registerDetailsStep = document.getElementById('registerDetailsStep');
const registerOtpStep = document.getElementById('registerOtpStep');
const registerBackBtn = document.getElementById('registerBackBtn');
const registerPhoneDisplay = document.getElementById('registerPhoneDisplay');
const registerVerifyBtn = document.getElementById('registerVerifyBtn');
const registerResendBtn = document.getElementById('registerResendBtn');

// Modal elements
const countryModal = document.getElementById('countryModal');
const modalClose = document.getElementById('modalClose');
const countrySearch = document.getElementById('countrySearch');
const countryList = document.getElementById('countryList');

// Tab Switching
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;

        // Update active tab
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Update active form
        loginForm.classList.remove('active');
        registerForm.classList.remove('active');

        if (tab === 'login') {
            loginForm.classList.add('active');
            authTabs.classList.remove('register-active');
            currentMode = 'login';
        } else {
            registerForm.classList.add('active');
            authTabs.classList.add('register-active');
            currentMode = 'register';
        }
    });
});

// Country Selector
function openCountryModal(mode) {
    currentCountrySelector = mode;
    countryModal.classList.add('active');
    populateCountries();
    countrySearch.value = '';
    countrySearch.focus();
}

function closeCountryModal() {
    countryModal.classList.remove('active');
}

function populateCountries(filter = '') {
    countryList.innerHTML = '';
    const filtered = countries.filter(c =>
        c.name.toLowerCase().includes(filter.toLowerCase()) ||
        c.dialCode.includes(filter)
    );

    filtered.forEach(country => {
        const item = document.createElement('div');
        item.className = 'country-item';
        item.innerHTML = `
            <img src="https://flagcdn.com/w40/${country.flag}.png" alt="${country.code}">
            <span class="country-name">${country.name}</span>
            <span class="country-code">${country.dialCode}</span>
        `;
        item.addEventListener('click', () => selectCountry(country));
        countryList.appendChild(item);
    });
}

function selectCountry(country) {
    selectedCountry[currentCountrySelector] = country;

    if (currentCountrySelector === 'login') {
        loginCountryFlag.src = `https://flagcdn.com/w40/${country.flag}.png`;
        loginCountryCode.textContent = country.dialCode;
    } else {
        registerCountryFlag.src = `https://flagcdn.com/w40/${country.flag}.png`;
        registerCountryCode.textContent = country.dialCode;
    }

    closeCountryModal();
}

loginCountrySelector.addEventListener('click', () => openCountryModal('login'));
registerCountrySelector.addEventListener('click', () => openCountryModal('register'));
modalClose.addEventListener('click', closeCountryModal);
countrySearch.addEventListener('input', (e) => populateCountries(e.target.value));

// Click outside modal to close
countryModal.addEventListener('click', (e) => {
    if (e.target === countryModal) {
        closeCountryModal();
    }
});

// OTP Input Handling
function setupOtpInputs(container) {
    const inputs = container.querySelectorAll('.otp-box');

    inputs.forEach((input, index) => {
        input.addEventListener('input', (e) => {
            if (e.target.value.length === 1 && index < inputs.length - 1) {
                inputs[index + 1].focus();
            }
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                inputs[index - 1].focus();
            }
        });

        // Only allow numbers
        input.addEventListener('keypress', (e) => {
            if (!/[0-9]/.test(e.key)) {
                e.preventDefault();
            }
        });
    });
}

setupOtpInputs(loginOtpStep);
setupOtpInputs(registerOtpStep);

function getOtpValue(container) {
    const inputs = container.querySelectorAll('.otp-box');
    return Array.from(inputs).map(input => input.value).join('');
}

function clearOtpInputs(container) {
    const inputs = container.querySelectorAll('.otp-box');
    inputs.forEach(input => input.value = '');
    inputs[0].focus();
}

// Login Flow
loginSendOtpBtn.addEventListener('click', async () => {
    const mobile = loginMobile.value.trim();

    if (!mobile || mobile.length < 10) {
        showError('Please enter a valid mobile number');
        return;
    }

    const fullNumber = selectedCountry.login.dialCode + mobile;
    loginPhoneDisplay.textContent = fullNumber;

    showLoader('Sending OTP...');

    try {
        const response = await fetch('/api/auth/send-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mobile: fullNumber, isLogin: true })
        });

        const data = await response.json();
        hideLoader();

        if (!response.ok) {
            if (data.shouldRegister) {
                showWarning(data.error);
                // Switch to register tab after 2 seconds
                setTimeout(() => {
                    document.querySelector('[data-tab="register"]').click();
                }, 2000);
            } else {
                showError(data.error || 'Failed to send OTP');
            }
            return;
        }

        showSuccess('OTP sent successfully!');

        // Show OTP step
        loginMobileStep.classList.remove('active');
        loginOtpStep.classList.add('active');

        // Focus first OTP input
        setTimeout(() => {
            loginOtpStep.querySelector('.otp-box').focus();
        }, 300);
    } catch (error) {
        hideLoader();
        console.error('Send OTP error:', error);
        showError('Failed to send OTP. Please try again.');
    }
});

loginBackBtn.addEventListener('click', () => {
    loginOtpStep.classList.remove('active');
    loginMobileStep.classList.add('active');
    clearOtpInputs(loginOtpStep);
});

loginVerifyBtn.addEventListener('click', async () => {
    const otp = getOtpValue(loginOtpStep);

    if (otp.length !== 6) {
        showError('Please enter complete OTP');
        return;
    }

    const fullNumber = loginPhoneDisplay.textContent;

    showLoader('Verifying OTP...');

    try {
        // Use fetch instead of form submit to handle errors gracefully
        const response = await fetch('/api/auth/verify-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mobile: fullNumber, otp })
        });

        // Check if response is redirect (success) or JSON (error/success with body)
        // verify-otp might return redirect or JSON depending on backend
        // Let's assume it returns JSON on error, and we handle success manually or follow redirect

        if (response.redirected) {
            window.location.href = response.url;
            return;
        }

        // Check content type to see if it's JSON
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            if (response.ok) {
                showSuccess('Login successful!');
                setTimeout(() => {
                    window.location.href = '/';
                }, 1000);
            } else {
                hideLoader();
                // If it's a new user, data.isNewUser might be true?
                if (data.isNewUser) {
                    showSuccess('New user! Redirecting to registration...');
                    // Logic to switch to register...
                    // ...
                } else {
                    showError(data.error || 'Failed to verify OTP');
                }
            }
        } else {
            // If not JSON and OK, probably success page (if no redirect)
            if (response.ok) {
                window.location.href = '/';
            } else {
                hideLoader();
                showError('Unknown error during login');
            }
        }
    } catch (error) {
        hideLoader();
        console.error('Verify OTP error:', error);
        showError('Failed to verify OTP. Please try again.');
    }
});

loginResendBtn.addEventListener('click', async () => {
    const fullNumber = loginPhoneDisplay.textContent;
    showLoader('Resending OTP...');
    try {
        const response = await fetch('/api/auth/send-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mobile: fullNumber, isLogin: true })
        });
        const data = await response.json();
        hideLoader();
        if (response.ok) {
            showSuccess('OTP sent successfully!');
            clearOtpInputs(loginOtpStep);
        } else {
            showError(data.error || 'Failed to resend OTP');
        }
    } catch (error) {
        hideLoader();
        showError('Failed to resend OTP');
    }
});

// Register Flow
registerSendOtpBtn.addEventListener('click', async () => {
    const name = registerName.value.trim();
    const mobile = registerMobile.value.trim();

    if (!name || name.length < 3) {
        showError('Please enter your full name (minimum 3 characters)');
        return;
    }

    if (!mobile || mobile.length < 10) {
        showError('Please enter a valid mobile number');
        return;
    }

    const fullNumber = selectedCountry.register.dialCode + mobile;
    registerPhoneDisplay.textContent = fullNumber;

    showLoader('Sending OTP...');

    try {
        const response = await fetch('/api/auth/send-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mobile: fullNumber, isLogin: false })
        });

        const data = await response.json();
        hideLoader();

        if (!response.ok) {
            if (data.shouldLogin) {
                showWarning(data.error);
                // Switch to login tab after 2 seconds
                setTimeout(() => {
                    document.querySelector('[data-tab="login"]').click();
                }, 2000);
            } else {
                showError(data.error || 'Failed to send OTP');
            }
            return;
        }

        showSuccess('OTP sent successfully!');

        // Store name for later use
        sessionStorage.setItem('registerName', name);
        sessionStorage.setItem('registerMobile', fullNumber);

        // Show OTP step
        registerDetailsStep.classList.remove('active');
        registerOtpStep.classList.add('active');

        // Focus first OTP input
        setTimeout(() => {
            registerOtpStep.querySelector('.otp-box').focus();
        }, 300);
    } catch (error) {
        hideLoader();
        console.error('Send OTP error:', error);
        showError('Failed to send OTP. Please try again.');
    }
});

registerBackBtn.addEventListener('click', () => {
    registerOtpStep.classList.remove('active');
    registerDetailsStep.classList.add('active');
    clearOtpInputs(registerOtpStep);
});

registerVerifyBtn.addEventListener('click', async () => {
    const otp = getOtpValue(registerOtpStep);

    if (otp.length !== 6) {
        showError('Please enter complete OTP');
        return;
    }

    const name = sessionStorage.getItem('registerName');
    const mobile = sessionStorage.getItem('registerMobile');

    showLoader('Registering...');

    try {
        // Use fetch instead of form submit to handle errors gracefully
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, mobile, otp })
        });

        const data = await response.json();

        if (response.ok) {
            // Clear session storage
            sessionStorage.removeItem('registerName');
            sessionStorage.removeItem('registerMobile');

            showSuccess('Registration successful!');

            // Redirect to home after short delay
            setTimeout(() => {
                window.location.href = '/';
            }, 1000);
        } else {
            hideLoader();
            showError(data.error || 'Failed to register');
        }
    } catch (error) {
        hideLoader();
        console.error('Register error:', error);
        showError('Failed to register. Please try again.');
    }
});

registerResendBtn.addEventListener('click', async () => {
    const fullNumber = registerPhoneDisplay.textContent;
    const name = sessionStorage.getItem('registerName');
    showLoader('Resending OTP...');
    try {
        const response = await fetch('/api/auth/send-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mobile: fullNumber, isLogin: false })
        });
        const data = await response.json();
        hideLoader();
        if (response.ok) {
            showSuccess('OTP sent successfully!');
            clearOtpInputs(registerOtpStep);
        } else {
            showError(data.error || 'Failed to resend OTP');
        }
    } catch (error) {
        hideLoader();
        showError('Failed to resend OTP');
    }
});

// Mobile number formatting (optional)
function formatMobileInput(input) {
    input.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/[^0-9]/g, '');
    });
}

formatMobileInput(loginMobile);
formatMobileInput(registerMobile);

// Initialize
populateCountries();
