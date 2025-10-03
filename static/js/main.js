// This script will run once the entire HTML document has been fully loaded and parsed.
document.addEventListener('DOMContentLoaded', () => {

    // --- DOM Element Selection ---
    const problemInput = document.getElementById('problemInput');
    const getHintBtn = document.getElementById('getHintBtn');
    const chatBox = document.querySelector('.chat-box');
    const contextInput = document.getElementById('contextInput');
    const inputArea = document.getElementById('inputArea');
    const conversationArea = document.getElementById('conversationArea');
    const conversationInput = document.getElementById('conversationInput');
    const sendMessageBtn = document.getElementById('sendMessageBtn');
    const newProblemFromConvo = document.getElementById('newProblemFromConvo');
    const newProblemArea = document.getElementById('newProblemArea');
    const newProblemBtn = document.getElementById('newProblemBtn');
    const anotherHintBtn = document.getElementById('anotherHintBtn');
    const themeSelect = document.getElementById('themeSelect');
    const timerDisplay = document.getElementById('timer');
    const startTimerBtn = document.getElementById('startTimer');
    const resetTimerBtn = document.getElementById('resetTimer');
    const particlesToggle = document.getElementById('particlesToggle');
    const particlesCanvas = document.getElementById('particlesCanvas');
    const promptBtns = document.querySelectorAll('.prompt-btn');
    const fullscreenChatModal = document.getElementById('fullscreenChatModal');
    const fullscreenChatLog = document.getElementById('fullscreenChatLog');
    const toggleFullscreenChat = document.getElementById('toggleFullscreenChat');
    const closeFullscreenChat = document.getElementById('closeFullscreenChat');

    // --- State Management ---
    let currentProblem = '';
    let currentContext = '';
    let conversationHistory = []; // Store all previous hints and responses
    let conversationMode = false; // Track if we're in conversation mode
    let currentMessageType = 'general'; // Track current message type

    // --- Timer Management ---
    let timerInterval = null;
    let timeLeft = 25 * 60; // 25 minutes in seconds
    let savedTime = 25 * 60; // Save the last edited time
    let isRunning = false;

    // --- Particles Management ---
    let particlesActive = false;
    let animationId = null;
    let particles = [];
    let ctx = null;

    // Code symbols for particles
    const codeSymbols = ['{}', '[]', '()', '<>', '//', '/*', '*/', '=>', '&&', '||', '++', '--', '==', '!=', '+=', '-=', '*=', '/=', '%=', '<<', '>>', '&', '|', '^', '~', '!', '?', ':', ';', '=', '+', '-', '*', '/', '%', '.', ',', '_', '$', '#', '@'];

    class Particle {
        constructor() {
            this.reset();
        }

        reset() {
            this.x = Math.random() * window.innerWidth;
            this.y = Math.random() * window.innerHeight;
            this.symbol = codeSymbols[Math.floor(Math.random() * codeSymbols.length)];
            this.size = Math.random() * 20 + 10;
            this.speedX = (Math.random() - 0.5) * 0.5;
            this.speedY = (Math.random() - 0.5) * 0.5;
            this.opacity = Math.random() * 0.5 + 0.1;
            this.rotation = Math.random() * 360;
            this.rotationSpeed = (Math.random() - 0.5) * 2;
        }

        update() {
            this.x += this.speedX;
            this.y += this.speedY;
            this.rotation += this.rotationSpeed;

            // Wrap around screen edges
            if (this.x < -50) this.x = window.innerWidth + 50;
            if (this.x > window.innerWidth + 50) this.x = -50;
            if (this.y < -50) this.y = window.innerHeight + 50;
            if (this.y > window.innerHeight + 50) this.y = -50;
        }

        draw() {
            if (!ctx) return;

            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.rotation * Math.PI / 180);
            ctx.globalAlpha = this.opacity;
            ctx.font = `${this.size}px 'Courier New', monospace`;
            ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--fg');
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.symbol, 0, 0);
            ctx.restore();
        }
    }

    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    function parseTimeInput(input) {
        // Handle various input formats: "25:00", "25", "25.5", "1500" (seconds)
        const trimmed = input.trim();

        // Format: MM:SS
        if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
            const [minutes, seconds] = trimmed.split(':').map(Number);
            if (seconds < 60) {
                return minutes * 60 + seconds;
            }
        }

        // Format: MM (minutes only)
        if (/^\d+$/.test(trimmed)) {
            const minutes = parseInt(trimmed);
            if (minutes > 0 && minutes <= 999) {
                return minutes * 60;
            }
        }

        // Format: MM.SS (decimal minutes)
        if (/^\d+\.\d+$/.test(trimmed)) {
            const minutes = parseFloat(trimmed);
            if (minutes > 0 && minutes <= 999) {
                return Math.round(minutes * 60);
            }
        }

        // Format: SSSS (seconds only)
        if (/^\d{3,4}$/.test(trimmed)) {
            const seconds = parseInt(trimmed);
            if (seconds > 0 && seconds <= 3600) { // Max 1 hour
                return seconds;
            }
        }

        return null; // Invalid format
    }

    function updateTimerDisplay() {
        timerDisplay.value = formatTime(timeLeft);
    }

    function handleTimerEdit() {
        const input = timerDisplay.value;
        const newTimeInSeconds = parseTimeInput(input);

        if (newTimeInSeconds !== null) {
            // Stop timer if running
            if (isRunning) {
                clearInterval(timerInterval);
                isRunning = false;
                startTimerBtn.textContent = 'start';
                startTimerBtn.classList.remove('running');
            }

            timeLeft = newTimeInSeconds;
            savedTime = newTimeInSeconds; // Save the new time as the reset time
            updateTimerDisplay();
        } else {
            // Invalid input, revert to current time
            updateTimerDisplay();
        }
    }

    function startTimer() {
        if (!isRunning) {
            isRunning = true;
            startTimerBtn.textContent = 'pause';
            startTimerBtn.classList.add('running');

            timerInterval = setInterval(() => {
                timeLeft--;
                updateTimerDisplay();

                if (timeLeft <= 0) {
                    clearInterval(timerInterval);
                    isRunning = false;
                    startTimerBtn.textContent = 'start';
                    startTimerBtn.classList.remove('running');
                    timeLeft = savedTime; // Reset to saved time instead of 25:00
                    updateTimerDisplay();

                    // Optional: Add notification or sound here
                    if (Notification.permission === 'granted') {
                        new Notification('Pomodoro Complete!', {
                            body: 'Time to take a break!',
                            icon: '/favicon.ico'
                        });
                    }
                }
            }, 1000);
        } else {
            // Pause timer
            clearInterval(timerInterval);
            isRunning = false;
            startTimerBtn.textContent = 'start';
            startTimerBtn.classList.remove('running');
        }
    }

    function resetTimer() {
        clearInterval(timerInterval);
        isRunning = false;
        timeLeft = savedTime; // Reset to saved time instead of 25:00
        startTimerBtn.textContent = 'start';
        startTimerBtn.classList.remove('running');
        updateTimerDisplay();
    }

    // --- Theme Management ---
    function initTheme() {
        const savedTheme = localStorage.getItem('theme') || 'system';

        const applyTheme = (theme) => {
            document.documentElement.setAttribute('data-theme', theme);
            updateMetaTheme(theme);
        };

        const prefersDarkMatcher = window.matchMedia('(prefers-color-scheme: dark)');

        // If no theme saved or set to 'system', follow system preference
        if (!savedTheme || savedTheme === 'system') {
            const systemTheme = prefersDarkMatcher.matches ? 'dark' : 'light';
            applyTheme(systemTheme);
            // Default to system for future loads if unset
            if (!savedTheme) localStorage.setItem('theme', 'system');
            // React to system changes if user stays in 'system' mode
            prefersDarkMatcher.addEventListener('change', (e) => {
                if (localStorage.getItem('theme') === 'system') {
                    applyTheme(e.matches ? 'dark' : 'light');
                }
            });
        } else {
            applyTheme(savedTheme);
        }

        // Set the dropdown value
        themeSelect.value = savedTheme;
    }

    function changeTheme() {
        const selectedTheme = themeSelect.value;
        localStorage.setItem('theme', selectedTheme);

        if (selectedTheme === 'system') {
            const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const theme = systemDark ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', theme);
            updateMetaTheme(theme);
        } else {
            document.documentElement.setAttribute('data-theme', selectedTheme);
            updateMetaTheme(selectedTheme);
        }
    }

    function updateMetaTheme(theme) {
        const metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (metaThemeColor) {
            let color = '#f0f2f5'; // default light
            if (theme === 'dark') color = '#1a1a1a';
            else if (theme === 'focus') color = '#000000';
            else if (theme === 'chill') color = '#1a1625';
            metaThemeColor.content = color;
        }
    }

    /**
     * A reusable function to add a new message to the chatBox.
     * @param {string} text - The text content of the message.
     * @param {string} sender - The sender of the message, either 'user' or 'bot'.
     * @param {string} messageType - The type of message (hint, analyze, suggest, explain, optimize, general).
     * @returns {HTMLElement} - The newly created message div, so we can modify it later if needed.
     */
    function displayMessage(text, sender, messageType = 'general') {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('chat-message');
        messageDiv.classList.add(sender);

        // Add message type indicator for bot messages
        if (sender === 'bot' && messageType !== 'general') {
            const typeDiv = document.createElement('div');
            typeDiv.classList.add('message-type');
            typeDiv.classList.add(messageType);
            typeDiv.textContent = messageType.toUpperCase();
            messageDiv.appendChild(typeDiv);
        }

        // Process text for enhanced formatting
        const processedText = enhanceMessageFormatting(text);
        const textDiv = document.createElement('div');
        textDiv.innerHTML = processedText;
        messageDiv.appendChild(textDiv);

        chatBox.appendChild(messageDiv);
        chatBox.scrollTop = chatBox.scrollHeight;

        // Also add to fullscreen chat if it's open
        if (fullscreenChatModal && fullscreenChatModal.style.display !== 'none') {
            const fullscreenMessageDiv = messageDiv.cloneNode(true);
            fullscreenChatLog.appendChild(fullscreenMessageDiv);
            fullscreenChatLog.scrollTop = fullscreenChatLog.scrollHeight;
        }


        return messageDiv;
    }

    /**
     * Open fullscreen chat modal
     */
    function openFullscreenChat() {
        if (!fullscreenChatModal || !fullscreenChatLog) return;

        // Copy all existing messages to fullscreen chat
        fullscreenChatLog.innerHTML = '';
        const messages = chatBox.querySelectorAll('.chat-message');
        messages.forEach(message => {
            const clonedMessage = message.cloneNode(true);
            fullscreenChatLog.appendChild(clonedMessage);
        });

        // Show modal
        fullscreenChatModal.style.display = 'flex';
        document.body.style.overflow = 'hidden'; // Prevent background scrolling

        // Scroll to bottom
        fullscreenChatLog.scrollTop = fullscreenChatLog.scrollHeight;

        // Add a subtle entrance animation
        const modalContent = fullscreenChatModal.querySelector('.fullscreen-modal-content');
        if (modalContent) {
            modalContent.style.transform = 'scale(0.9) translateY(20px)';
            modalContent.style.opacity = '0';
            setTimeout(() => {
                modalContent.style.transition = 'all 0.3s ease';
                modalContent.style.transform = 'scale(1) translateY(0)';
                modalContent.style.opacity = '1';
            }, 10);
        }
    }

    /**
     * Close fullscreen chat modal
     */
    function closeFullscreenChatModal() {
        if (!fullscreenChatModal) return;

        fullscreenChatModal.style.display = 'none';
        document.body.style.overflow = ''; // Restore scrolling
    }


    /**
     * HTML escape function to prevent XSS attacks
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Enhance message formatting with code highlighting, complexity tags, and callout boxes
     * SECURITY: All user content is escaped before applying formatting
     */
    function enhanceMessageFormatting(text) {
        // First, escape ALL HTML to prevent XSS
        let processedText = escapeHtml(text);

        // Convert inline code (backticks) to styled code - content already escaped
        processedText = processedText.replace(/`([^`]+)`/g, '<code>$1</code>');

        // Convert code blocks (triple backticks) to styled pre blocks - content already escaped
        processedText = processedText.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

        // Add complexity tags for time/space complexity mentions - content already escaped
        processedText = processedText.replace(/\bTime Complexity:\s*O\([^)]+\)/gi, '<span class="complexity-tag time">$&</span>');
        processedText = processedText.replace(/\bSpace Complexity:\s*O\([^)]+\)/gi, '<span class="complexity-tag space">$&</span>');
        processedText = processedText.replace(/\bAlgorithm:\s*[^<]+/gi, '<span class="complexity-tag algorithm">$&</span>');

        // Convert key ideas to callout boxes - content already escaped
        processedText = processedText.replace(/\*\*Key Idea:\*\*([^*]+)/gi, '<div class="callout-box key-idea"><strong>Key Idea:</strong>$1</div>');
        processedText = processedText.replace(/\*\*Important:\*\*([^*]+)/gi, '<div class="callout-box warning"><strong>Important:</strong>$1</div>');
        processedText = processedText.replace(/\*\*Note:\*\*([^*]+)/gi, '<div class="callout-box info"><strong>Note:</strong>$1</div>');

        // Convert newlines to <br> tags
        processedText = processedText.replace(/\n/g, '<br>');

        return processedText;
    }

    // Helper to enable/disable input and button
    function setInputState(disabled) {
        problemInput.disabled = disabled;
        getHintBtn.disabled = disabled;
        if (!disabled) {
            problemInput.focus();
        }
    }

    // Helper to enable/disable conversation input
    function setConversationState(disabled) {
        conversationInput.disabled = disabled;
        sendMessageBtn.disabled = disabled;
        if (!disabled) {
            conversationInput.focus();
        }
    }


    // Helper to switch between different UI modes
    function showNewProblemMode() {
        inputArea.style.display = 'none';
        conversationArea.style.display = 'none';
        newProblemArea.style.display = 'flex';
        conversationMode = false;
    }

    function showConversationMode() {
        inputArea.style.display = 'none';
        newProblemArea.style.display = 'none';
        conversationArea.style.display = 'flex';
        conversationMode = true;
        conversationInput.focus();
    }

    function showInputMode() {
        inputArea.style.display = 'flex';
        conversationArea.style.display = 'none';
        newProblemArea.style.display = 'none';
        problemInput.value = ''; // Clear the input
        contextInput.value = ''; // Clear the context
        conversationInput.value = ''; // Clear conversation input
        problemInput.focus(); // Focus on the input

        // Reset conversation state
        currentProblem = '';
        currentContext = '';
        conversationHistory = [];
        conversationMode = false;
    }

    /**
     * Function to request another hint for the same problem
     */
    async function handleAnotherHint() {
        if (!currentProblem) {
            return; // No current problem to get another hint for
        }

        // Disable the another hint button to prevent multiple clicks
        anotherHintBtn.disabled = true;

        // Display a loading message
        const loadingMessage = displayMessage('Thinking...', 'bot');
        loadingMessage.classList.add('loading');

        try {
            // Prepare request with conversation history
            const requestBody = {
                problemName: currentProblem,
                context: currentContext,
                conversationHistory: conversationHistory,
                requestType: 'another_hint'
            };

            const response = await fetch('/get_hint', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json();
                displayMessage(`Error: ${errorData.error || 'Something went wrong.'}`, 'bot');
                return;
            }

            const data = await response.json();

            // Remove loading message
            loadingMessage.remove();

            // Display the new hint
            let botResponse = data.hint;
            displayMessage(botResponse, 'bot');

            // Store this interaction in conversation history
            conversationHistory.push({
                userInput: currentProblem,
                context: currentContext,
                botResponse: botResponse
            });

        } catch (error) {
            loadingMessage.remove();
            console.error('Error fetching another hint:', error);
            displayMessage("Oops! I couldn't reach the server. Please ensure the backend is running.", 'bot');
        } finally {
            anotherHintBtn.disabled = false; // Re-enable the button
        }
    }

    /**
     * Function to handle quick action buttons
     */
    function handleQuickAction(action) {
        if (!currentProblem) {
            displayMessage("Error: No current problem to discuss. Please start a new problem first.", 'bot');
            return;
        }

        // Update active button
        quickActionBtns.forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.querySelector(`[data-action="${action}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }

        // Set message type
        currentMessageType = action;

        // Generate appropriate message based on action
        let message = '';
        switch (action) {
            case 'hint':
                message = 'Can you give me a hint for this problem?';
                break;
            case 'analyze':
                message = 'Can you analyze my approach or code?';
                break;
            case 'suggest':
                message = 'Can you suggest a different approach?';
                break;
            case 'explain':
                message = 'Can you explain the key concepts for this problem?';
                break;
            case 'optimize':
                message = 'How can I optimize my solution?';
                break;
            default:
                message = 'Can you help me with this problem?';
        }

        // Set the message in the input
        conversationInput.value = message;
        conversationInput.focus();

        // Auto-send the message
        handleConversationMessage();
    }

    /**
     * Function to handle ongoing conversation messages
     */
    async function handleConversationMessage() {
        const userMessage = conversationInput.value.trim();

        if (!userMessage) {
            return; // Don't send empty messages
        }

        if (!currentProblem) {
            displayMessage("Error: No current problem to discuss. Please start a new problem first.", 'bot');
            return;
        }

        // Display the user's message
        displayMessage(userMessage, 'user');

        // Clear the input and reset height
        conversationInput.value = '';
        conversationInput.style.height = 'auto';
        autoExpandTextarea(conversationInput);

        // Disable controls and display loading message
        setConversationState(true);
        const loadingMessage = displayMessage('Thinking...', 'bot');
        loadingMessage.classList.add('loading');

        try {
            // Prepare request for conversation
            const requestBody = {
                message: userMessage,
                problemName: currentProblem,
                conversationHistory: conversationHistory,
                messageType: currentMessageType
            };

            const response = await fetch('/conversation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json();
                displayMessage(`Error: ${errorData.error || 'Something went wrong.'}`, 'bot');
                return;
            }

            const data = await response.json();

            // Remove loading message
            loadingMessage.remove();

            // Display the bot's response
            const botResponse = data.response;
            displayMessage(botResponse, 'bot', currentMessageType);

            // Store this interaction in conversation history
            conversationHistory.push({
                userInput: userMessage,
                botResponse: botResponse,
                messageType: currentMessageType
            });


            // Reset message type
            currentMessageType = 'general';

        } catch (error) {
            loadingMessage.remove();
            console.error('Error sending conversation message:', error);
            displayMessage("Oops! I couldn't reach the server. Please ensure the backend is running.", 'bot');
        } finally {
            setConversationState(false); // Re-enable conversation input
        }
    }

    /**
     * This function contains the main logic that runs when the user asks for a hint.
     * It is now an 'async' function because it will use 'await' for the fetch API call.
     */
    async function handleHintRequest() {
        const userInput = problemInput.value.trim();
        const context = contextInput.value.trim();

        if (!userInput) {
            return; // Don't send empty messages
        }

        // 1. Display the user's own message in the chat box.
        displayMessage(userInput, 'user');

        // 2. Disable controls and display a loading message.
        setInputState(true);
        const loadingMessage = displayMessage('Thinking...', 'bot');
        loadingMessage.classList.add('loading');

        try {
            // 3. Make the actual API call to our Flask backend
            const requestBody = {
                problemName: userInput,
                requestType: 'first_hint'
            };
            if (context) {
                requestBody.context = context;
            }

            const response = await fetch('/get_hint', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            // Check if the response was successful (HTTP status 200-299)
            if (!response.ok) {
                // If not successful, parse the error message from the backend
                const errorData = await response.json();
                displayMessage(`Error: ${errorData.error || 'Something went wrong.'}`, 'bot');
                return; // Stop execution
            }

            // 4. Parse the JSON response from the backend
            const data = await response.json();

            // 5. Remove the loading message
            loadingMessage.remove();

            // 6. Display the bot's actual response
            let botResponse = data.hint;
            displayMessage(botResponse, 'bot');

            // 7. Check if the problem was recognized
            if (botResponse.toLowerCase().includes("i'm not familiar with that problem")) {
                // Problem not recognized - keep input visible and don't save to context
                showInputMode(); // Keep input visible
                // Don't store in conversation history or set current problem
            } else {
                // Problem recognized - switch to conversation mode and save context
                showConversationMode();
                currentProblem = userInput;
                currentContext = context;

                // Store this interaction in conversation history
                conversationHistory.push({
                    userInput: userInput,
                    context: context,
                    botResponse: botResponse,
                    messageType: 'hint'
                });

            }

        } catch (error) {
            // 8. Handle network errors (e.g., server not running, connection issues)
            loadingMessage.remove(); // Remove loading message even on network error
            console.error('Error fetching hint:', error);
            displayMessage("Oops! I couldn't reach the server. Please ensure the backend is running.", 'bot');
        } finally {
            // This block always runs after try/catch, regardless of success or error
            setInputState(false); // Re-enable input and button
        }
    }

    // --- Event Listeners ---
    // Handle form submission
    inputArea.addEventListener('submit', (event) => {
        event.preventDefault();
        handleHintRequest();
    });

    getHintBtn.addEventListener('click', handleHintRequest);

    problemInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault(); // Prevents default behavior (like form submission)
            handleHintRequest();
        }
    });

    // New problem button event listener
    newProblemBtn.addEventListener('click', showInputMode);

    // Another hint button event listener
    anotherHintBtn.addEventListener('click', handleAnotherHint);

    // Conversation form event listeners
    conversationArea.addEventListener('submit', (event) => {
        event.preventDefault();
        handleConversationMessage();
    });

    sendMessageBtn.addEventListener('click', handleConversationMessage);

    conversationInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault(); // Prevents default behavior (new line)
            handleConversationMessage();
        }
        // Allow Shift+Enter for new lines
    });

    // New problem from conversation button
    newProblemFromConvo.addEventListener('click', showInputMode);


    // Quick action buttons
    const quickActionBtns = document.querySelectorAll('.quick-action-btn');
    quickActionBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const action = btn.dataset.action;
            handleQuickAction(action);
        });
    });

    // Fullscreen chat event listeners
    if (toggleFullscreenChat) {
        toggleFullscreenChat.addEventListener('click', openFullscreenChat);
    }
    if (closeFullscreenChat) {
        closeFullscreenChat.addEventListener('click', closeFullscreenChatModal);
    }
    if (fullscreenChatModal) {
        // Close modal when clicking outside
        fullscreenChatModal.addEventListener('click', function(e) {
            if (e.target === fullscreenChatModal) {
                closeFullscreenChatModal();
            }
        });
        // Close modal with Escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && fullscreenChatModal.style.display !== 'none') {
                closeFullscreenChatModal();
            }
        });
    }

    // Theme select event listener
    themeSelect.addEventListener('change', changeTheme);

    // Timer event listeners
    startTimerBtn.addEventListener('click', startTimer);
    resetTimerBtn.addEventListener('click', resetTimer);

    // Timer edit event listeners
    timerDisplay.addEventListener('blur', handleTimerEdit);
    timerDisplay.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            timerDisplay.blur();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            updateTimerDisplay(); // Revert changes
            timerDisplay.blur();
        }
    });

    // Timer input validation
    timerDisplay.addEventListener('input', (e) => {
        // Allow only digits and colon
        e.target.value = e.target.value.replace(/[^0-9:]/g, '');
    });

    // Particles dropdown event listener
    particlesToggle.addEventListener('change', toggleParticles);

    // Window resize handler for particles
    window.addEventListener('resize', () => {
        if (particlesActive) {
            initParticles();
        }
    });

    // Header sticky shadow on scroll
    const headerEl = document.querySelector('.header');
    const onScroll = () => {
        if (!headerEl) return;
        if (window.scrollY > 4) headerEl.classList.add('stuck');
        else headerEl.classList.remove('stuck');
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    // Auto-expand textarea functionality
    function autoExpandTextarea(textarea) {
        if (!textarea) return;

        // Reset height to auto to get the correct scrollHeight
        textarea.style.height = 'auto';

        // Set height to scrollHeight (content height)
        const newHeight = Math.min(textarea.scrollHeight, 240); // Max 240px
        textarea.style.height = newHeight + 'px';
    }

    // Add auto-expand to conversation input
    if (conversationInput) {
        conversationInput.addEventListener('input', function() {
            autoExpandTextarea(this);
        });

        // Initialize height
        autoExpandTextarea(conversationInput);
    }

    // --- Initial Setup ---
    initTheme(); // Initialize theme on page load
    updateTimerDisplay(); // Initialize timer display
    initParticlesState(); // Initialize particles state (this will call initParticles if needed)
    setInputState(false); // Ensure input/button are enabled and focused on load

    // Initialize ARIA states
    particlesToggle.setAttribute('aria-pressed', particlesActive);
    promptBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            let promptText = '';
            if (btn.dataset.prompt === 'hint') promptText = 'Can I get a hint for my problem?';
            if (btn.dataset.prompt === 'analyze') promptText = 'Can you analyze my code?';
            if (btn.dataset.prompt === 'suggest') promptText = 'Can you suggest a related problem?';
            problemInput.value = promptText; // Set input value to the prompt text
            handleHintRequest(); // Then trigger the request
        });
    });

    function initParticlesState() {
        const savedState = localStorage.getItem('particlesActive');
        // If there is no saved state, default to true. Otherwise, use the saved state.
        const shouldBeActive = savedState === null ? true : savedState === 'true';

        // Set dropdown value
        particlesToggle.value = shouldBeActive ? 'on' : 'off';
        particlesActive = shouldBeActive;

        if (shouldBeActive) {
            particlesCanvas.classList.add('active');
            // Initialize particles if needed
            if (particles.length === 0) {
                initParticles();
            }
            // Start the animation if it's not already running
            if (!animationId) {
                animateParticles();
            }
        } else {
            particlesActive = false;
            particlesCanvas.classList.remove('active');
        }
    }

    function initParticles() {
        particlesCanvas.width = window.innerWidth;
        particlesCanvas.height = window.innerHeight;

        // Initialize context
        ctx = particlesCanvas.getContext('2d');

        // Create particles
        particles = [];
        const particleCount = Math.min(200, Math.floor((window.innerWidth * window.innerHeight) / 5000));

        for (let i = 0; i < particleCount; i++) {
            particles.push(new Particle());
        }
    }

    function animateParticles() {
        if (!particlesActive || !ctx) return;

        ctx.clearRect(0, 0, particlesCanvas.width, particlesCanvas.height);

        particles.forEach(particle => {
            particle.update();
            particle.draw();
        });

        animationId = requestAnimationFrame(animateParticles);
    }

    function toggleParticles() {
        const selectedValue = particlesToggle.value;
        particlesActive = selectedValue === 'on';

        if (particlesActive) {
            // Initialize particles if not already done
            if (particles.length === 0) {
                initParticles();
            }
            particlesCanvas.classList.add('active');
            // Start animation
            if (!animationId) {
                animateParticles();
            }
        } else {
            particlesCanvas.classList.remove('active');
            if (animationId) {
                cancelAnimationFrame(animationId);
                animationId = null;
            }
        }

        // Update aria-pressed state
        particlesToggle.setAttribute('aria-pressed', particlesActive);

        // Save preference
        localStorage.setItem('particlesActive', particlesActive);
    }
});
