// Constants
const API_ENDPOINTS = {
    UNIVERSITIES: 'http://universities.hipolabs.com/search',
    COUNTRY_INFO: 'https://restcountries.com/v3.1/name',
    GEMINI: 'https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent'
};

const GEMINI_API_KEY = 'AIzaSyDfz3QhwrVXMrauKbV9CdAPoA9uLC-JNXo';

// DOM Elements
const elements = {
    countryInput: document.getElementById('countryInput'),
    searchBtn: document.getElementById('searchBtn'),
    loading: document.getElementById('loading'),
    error: document.getElementById('error'),
    results: document.getElementById('results'),
    topUnisList: document.getElementById('topUnisList'),
    uniList: document.getElementById('uniList'),
    modal: document.getElementById('uniModal'),
    modalContent: document.querySelector('.modal-content'),
    closeBtn: document.querySelector('.close-btn'),
    
    // University search elements
    uniSearchInput: document.getElementById('uniSearchInput'),
    uniSearchBtn: document.getElementById('uniSearchBtn'),
    uniSearchLoading: document.getElementById('uniSearchLoading'),
    uniSearchError: document.getElementById('uniSearchError'),
    uniSearchResults: document.getElementById('uniSearchResults')
};

// Event Listeners
elements.searchBtn.addEventListener('click', handleSearch);
elements.countryInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSearch();
});
elements.uniSearchBtn.addEventListener('click', handleUniSearch);
elements.uniSearchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleUniSearch();
});
elements.closeBtn.addEventListener('click', closeModal);
window.addEventListener('click', (e) => {
    if (e.target === elements.modal) closeModal();
});

// Main search handler for country search
async function handleSearch() {
    const country = elements.countryInput.value.trim();
    
    if (!country) {
        showError('Please enter a country name');
        return;
    }

    showLoading(true);
    clearResults();

    try {
        // Validate country name
        const countryInfo = await fetchCountryInfo(country);
        if (!countryInfo) throw new Error('Country not found');

        // Fetch universities
        const universities = await fetchUniversities(country);
        if (universities.length === 0) throw new Error('No universities found for this country');

        // Process and display results
        await displayResults(universities, countryInfo);
    } catch (error) {
        showError(error.message);
    } finally {
        showLoading(false);
    }
}

// University search handler
async function handleUniSearch() {
    const universityName = elements.uniSearchInput.value.trim();
    
    if (!universityName) {
        showUniSearchError('Please enter a university name');
        return;
    }

    showUniSearchLoading(true);
    clearUniSearchResults();

    try {
        const details = await fetchUniversityDetails(universityName);
        displayUniversityDetails(details);
    } catch (error) {
        showUniSearchError(error.message);
    } finally {
        showUniSearchLoading(false);
    }
}

// API Calls
async function fetchCountryInfo(country) {
    try {
        const response = await fetch(`${API_ENDPOINTS.COUNTRY_INFO}/${encodeURIComponent(country)}`);
        if (!response.ok) return null;
        const data = await response.json();
        return data[0];
    } catch (error) {
        console.error('Error fetching country info:', error);
        return null;
    }
}

async function fetchUniversities(country) {
    const response = await fetch(`${API_ENDPOINTS.UNIVERSITIES}?country=${encodeURIComponent(country)}`);
    if (!response.ok) throw new Error('Failed to fetch universities');
    return await response.json();
}

async function fetchUniversityDetails(universityName) {
    const prompt = `Provide the information for ${universityName}:
    Format the response in clear sections with bullet points. and ignore the information that is not available`;

    const response = await fetch(`${API_ENDPOINTS.GEMINI}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [{ text: prompt }]
            }]
        })
    });

    if (!response.ok) throw new Error('Failed to fetch university details');
    
    const data = await response.json();
    if (!data.candidates || !data.candidates[0]?.content?.parts[0]?.text) {
        throw new Error('No information available for this university');
    }
    
    return data.candidates[0].content.parts[0].text;
}

// Display Functions
function displayResults(universities, countryInfo) {
    elements.results.classList.remove('hidden');

    // Sort universities by name
    universities.sort((a, b) => a.name.localeCompare(b.name));

    // Get top universities using Gemini API
    fetchTopUniversities(countryInfo.name.common, universities.slice(0, 10))
        .then(topUnis => {
            elements.topUnisList.innerHTML = topUnis.map(uni => createUniversityCard(uni, true)).join('');
        })
        .catch(error => {
            console.error('Error fetching top universities:', error);
            // Fallback to showing first 5 universities
            const topUnis = universities.slice(0, 5);
            elements.topUnisList.innerHTML = topUnis.map(uni => createUniversityCard(uni, true)).join('');
        });

    // Display all universities
    elements.uniList.innerHTML = universities.map(uni => createUniversityCard(uni)).join('');

    // Add click events to university cards
    document.querySelectorAll('.uni-card').forEach(card => {
        card.addEventListener('click', () => showUniversityDetails(card.dataset.uni));
    });
}

async function fetchTopUniversities(country, universities) {
    const prompt = `From this list of universities in ${country}, identify the top 5 based on academic reputation and rankings:\n${universities.map(u => u.name).join('\n')}`;

    try {
        const response = await fetch(`${API_ENDPOINTS.GEMINI}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }]
            })
        });

        const data = await response.json();
        const topUnisList = data.candidates[0].content.parts[0].text
            .split('\n')
            .filter(line => line.trim())
            .map(line => line.replace(/^\d+\.\s*/, '').trim());

        return universities.filter(uni => 
            topUnisList.some(topUni => uni.name.toLowerCase().includes(topUni.toLowerCase()))
        );
    } catch (error) {
        throw new Error('Failed to identify top universities');
    }
}

function createUniversityCard(uni, isTop = false) {
    const uniData = JSON.stringify(uni).replace(/"/g, '&quot;');
    
    return `
        <div class="uni-card" data-uni="${uniData}">
            <h3>${uni.name}</h3>
            <div class="stats">
                ${isTop ? '<span class="stat"><i class="fas fa-star"></i> Top Rated</span>' : ''}
                <span class="stat"><i class="fas fa-globe"></i> ${uni.country}</span>
            </div>
            <div class="links">
                <a href="${uni.web_pages[0]}" target="_blank" class="primary-button">
                    <i class="fas fa-external-link-alt"></i> Visit Website
                </a>
            </div>
        </div>
    `;
}

function displayUniversityDetails(details) {
    const sections = details.split('\n\n').filter(section => section.trim());
    
    const formattedDetails = `
        <div class="uni-details-header">
            <h2>${elements.uniSearchInput.value}</h2>
        </div>
        <div class="uni-details-content">
            ${sections.map(section => `
                <div class="details-section">
                    ${formatDetailSection(section)}
                </div>
            `).join('')}
        </div>
    `;

    elements.uniSearchResults.innerHTML = formattedDetails;
    elements.uniSearchResults.classList.remove('hidden');
}

function formatDetailSection(section) {
    const lines = section.split('\n');
    const title = lines[0].replace(/^\d+\.\s*/, '');
    const content = lines.slice(1);

    return `
        <h3><i class="fas fa-info-circle"></i> ${title}</h3>
        <ul class="details-list">
            ${content.map(line => `
                <li>
                    <i class="fas fa-chevron-right"></i>
                    <span>${line.replace(/^[•-]\s*/, '')}</span>
                </li>
            `).join('')}
        </ul>
    `;
}

// Modal Functions
function showUniversityModal(uni) {
    const details = `
        <h2>${uni.name}</h2>
        <div class="uni-details">
            <p><strong>Country:</strong> ${uni.country}</p>
            <p><strong>Alpha Code:</strong> ${uni.alpha_two_code}</p>
            <p><strong>Website:</strong> <a href="${uni.web_pages[0]}" target="_blank">${uni.web_pages[0]}</a></p>
            <p><strong>Domains:</strong> ${uni.domains.join(', ')}</p>
        </div>
    `;

    document.getElementById('uniDetails').innerHTML = details;
    elements.modal.classList.remove('hidden');
}

// Utility Functions
function showLoading(show) {
    elements.loading.classList.toggle('hidden', !show);
    elements.searchBtn.disabled = show;
}

function showUniSearchLoading(show) {
    elements.uniSearchLoading.classList.toggle('hidden', !show);
    elements.uniSearchBtn.disabled = show;
}

function showError(message) {
    elements.error.textContent = message;
    elements.error.classList.remove('hidden');
    setTimeout(() => elements.error.classList.add('hidden'), 5000);
}

function showUniSearchError(message) {
    elements.uniSearchError.textContent = message;
    elements.uniSearchError.classList.remove('hidden');
    setTimeout(() => elements.uniSearchError.classList.add('hidden'), 5000);
}

function clearResults() {
    elements.error.classList.add('hidden');
    elements.results.classList.add('hidden');
    elements.topUnisList.innerHTML = '';
    elements.uniList.innerHTML = '';
}

function clearUniSearchResults() {
    elements.uniSearchError.classList.add('hidden');
    elements.uniSearchResults.classList.add('hidden');
    elements.uniSearchResults.innerHTML = '';
}

function closeModal() {
    elements.modal.classList.add('hidden');
}

// Error handling for fetch requests
window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
    showError('An unexpected error occurred. Please try again later.');
});