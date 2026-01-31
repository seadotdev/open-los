/**
 * Open LOS - Experimental Activity Feed UI
 * Ultra-simple, activity-first design based on "Web as Activity Hub" pattern
 */

// DOM Elements
const aiToggle = document.getElementById('ai-toggle');
const aiPanel = document.getElementById('ai-panel');
const aiClose = document.getElementById('ai-close');
const aiInput = document.getElementById('ai-input');
const aiSend = document.getElementById('ai-send');
const aiMessages = document.getElementById('ai-messages');
const filterBtns = document.querySelectorAll('.filter-btn');
const feedItems = document.querySelectorAll('.feed-item');

// AI Panel Toggle
function toggleAiPanel() {
    aiPanel.classList.toggle('open');
    aiToggle.classList.toggle('active');
    if (aiPanel.classList.contains('open')) {
        aiInput.focus();
    }
}

aiToggle.addEventListener('click', toggleAiPanel);
aiClose.addEventListener('click', toggleAiPanel);

// AI Chat (Mock Implementation)
function addAiMessage(text, type = 'assistant') {
    const msg = document.createElement('div');
    msg.className = `ai-message ${type}`;
    msg.innerHTML = `<p>${text}</p>`;
    aiMessages.appendChild(msg);
    aiMessages.scrollTop = aiMessages.scrollHeight;
}

function handleAiSend() {
    const text = aiInput.value.trim();
    if (!text) return;

    addAiMessage(text, 'user');
    aiInput.value = '';

    // Simulate AI response
    setTimeout(() => {
        const responses = [
            "I found 3 deals with covenant issues. Acme Corp has a DSCR breach, and 2 others are approaching thresholds.",
            "The TechStart Inc deal is currently in Underwriting. All required documents have been collected and it's ready for credit analysis.",
            "Based on the current pipeline, you have 12 active deals worth $45M in total exposure. 5 are in Origination, 4 in Underwriting, and 3 in Closing.",
            "I can help you draft a waiver request for the Acme Corp covenant breach. Would you like me to prepare the documentation?",
        ];
        const response = responses[Math.floor(Math.random() * responses.length)];
        addAiMessage(response, 'assistant');
    }, 800);
}

aiSend.addEventListener('click', handleAiSend);
aiInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleAiSend();
});

// Feed Filtering
filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        // Update active state
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const filter = btn.dataset.filter;

        feedItems.forEach(item => {
            if (filter === 'all') {
                item.style.display = 'flex';
            } else {
                const itemType = item.dataset.type;
                item.style.display = itemType === filter ? 'flex' : 'none';
            }
        });
    });
});

// Action Button Handlers (Demo purposes)
document.querySelectorAll('.action-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.textContent.trim();

        // Visual feedback
        const originalText = btn.textContent;
        btn.textContent = 'Processing...';
        btn.disabled = true;

        setTimeout(() => {
            if (action === 'Approve') {
                btn.textContent = 'Approved';
                btn.style.background = 'var(--status-success)';
            } else if (action === 'Decline') {
                btn.textContent = 'Declined';
            } else {
                btn.textContent = originalText;
            }
            btn.disabled = false;
        }, 600);
    });
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Cmd/Ctrl + K to open AI panel
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        toggleAiPanel();
    }
    // Escape to close AI panel
    if (e.key === 'Escape' && aiPanel.classList.contains('open')) {
        toggleAiPanel();
    }
});

// Mock: Real-time activity simulation
function simulateNewActivity() {
    const types = [
        { type: 'update', title: 'New document uploaded', body: 'Financial projections for Q1 2026' },
        { type: 'approval', title: 'Approval request submitted', body: 'Stage transition requires review' },
        { type: 'communication', title: 'New email received', body: 'Borrower responded to information request' },
    ];

    // In a real app, this would be WebSocket events from the API
    console.log('Activity feed ready. In production, WebSocket events would appear here.');
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    simulateNewActivity();
    console.log('Open LOS Activity Hub initialized');
    console.log('Press Cmd/Ctrl + K to open AI assistant');
});
