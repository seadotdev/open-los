/**
 * Open LOS - Traditional Loan Origination System UI
 * Standard, familiar design for lending professionals
 */

// DOM Elements
const navItems = document.querySelectorAll('.nav-item[data-view]');
const views = document.querySelectorAll('.view');
const pageTitle = document.getElementById('page-title');

// View titles mapping
const viewTitles = {
    dashboard: 'Dashboard',
    pipeline: 'Pipeline',
    deals: 'All Deals',
    borrowers: 'Borrowers',
    documents: 'Documents',
    covenants: 'Covenant Monitoring',
    reports: 'Reports'
};

// Navigation
function navigateTo(viewId) {
    // Update nav active state
    navItems.forEach(item => {
        item.classList.toggle('active', item.dataset.view === viewId);
    });

    // Show selected view
    views.forEach(view => {
        view.classList.toggle('active', view.id === `view-${viewId}`);
    });

    // Update page title
    pageTitle.textContent = viewTitles[viewId] || 'Dashboard';

    // Store in URL hash for bookmarking
    window.location.hash = viewId;
}

// Navigation click handlers
navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        navigateTo(item.dataset.view);
    });
});

// Handle initial load and browser back/forward
function handleHashChange() {
    const hash = window.location.hash.slice(1) || 'dashboard';
    navigateTo(hash);
}

window.addEventListener('hashchange', handleHashChange);
document.addEventListener('DOMContentLoaded', handleHashChange);

// Kanban Card Interactions
document.querySelectorAll('.kanban-card').forEach(card => {
    card.addEventListener('click', () => {
        // In a real app, this would open a deal detail modal/page
        const borrower = card.querySelector('.borrower-name').textContent;
        console.log(`Opening deal: ${borrower}`);
    });
});

// Table Row Interactions
document.querySelectorAll('.data-table tbody tr').forEach(row => {
    row.addEventListener('click', (e) => {
        // Don't trigger if clicking a button
        if (e.target.closest('button')) return;

        // In a real app, this would open the deal/entity detail
        const name = row.querySelector('.borrower-name, .borrower-cell .borrower-name');
        if (name) {
            console.log(`Opening: ${name.textContent}`);
        }
    });
});

// Button Actions (Demo purposes)
document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const text = btn.textContent.trim();

        // Simulate actions
        if (text === 'New Deal') {
            alert('New Deal form would open here');
        } else if (text === 'Export' || text === 'Export CSV') {
            console.log('Exporting data...');
            btn.textContent = 'Exporting...';
            setTimeout(() => {
                btn.textContent = text;
                alert('Export complete');
            }, 1000);
        } else if (text === 'Generate') {
            console.log('Generating report...');
            btn.textContent = 'Generating...';
            setTimeout(() => {
                btn.textContent = text;
                alert('Report generated');
            }, 1500);
        }
    });
});

// Alert Item Actions
document.querySelectorAll('.alert-item .btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const alertItem = btn.closest('.alert-item');
        const action = btn.textContent.trim();

        if (action === 'Approve') {
            alertItem.style.opacity = '0.5';
            btn.textContent = 'Approved';
            btn.disabled = true;
        } else if (action === 'Review' || action === 'Request' || action === 'Send Reminder') {
            // Navigate to appropriate view or open modal
            console.log(`Action: ${action}`);
        }
    });
});

// Search functionality
const searchInput = document.querySelector('.search-box input');
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        // In a real app, this would filter results or show search suggestions
        console.log(`Searching: ${query}`);
    });

    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const query = e.target.value.trim();
            if (query) {
                // Perform search
                console.log(`Search submitted: ${query}`);
            }
        }
    });
}

// Notification bell
const notificationBtn = document.querySelector('.notifications .icon-btn');
if (notificationBtn) {
    notificationBtn.addEventListener('click', () => {
        // In a real app, this would show a notifications dropdown
        console.log('Showing notifications...');
    });
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Cmd/Ctrl + K for search
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (searchInput) {
            searchInput.focus();
        }
    }

    // Quick navigation with numbers
    if (e.altKey && e.key >= '1' && e.key <= '7') {
        e.preventDefault();
        const viewIndex = parseInt(e.key) - 1;
        const viewKeys = Object.keys(viewTitles);
        if (viewIndex < viewKeys.length) {
            navigateTo(viewKeys[viewIndex]);
        }
    }
});

// Initialize
console.log('Open LOS Traditional UI initialized');
console.log('Keyboard shortcuts:');
console.log('  Cmd/Ctrl + K: Focus search');
console.log('  Alt + 1-7: Quick navigation');
