"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LinkedInProfileScraper = void 0;
const tslib_1 = require("tslib");
const puppeteer_1 = tslib_1.__importDefault(require("puppeteer"));
const tree_kill_1 = tslib_1.__importDefault(require("tree-kill"));
const blocked_hosts_1 = tslib_1.__importDefault(require("./blocked-hosts"));
const utils_1 = require("./utils");
const errors_1 = require("./errors");
async function smartScroll(page) {
    await page.evaluate(async () => {
        await new Promise((resolve) => {
            let totalHeight = 0;
            const distance = 400;
            const maxScrolls = 10;
            let scrollCount = 0;
            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;
                scrollCount++;
                if (totalHeight >= scrollHeight - window.innerHeight || scrollCount >= maxScrolls) {
                    clearInterval(timer);
                    resolve();
                }
            }, 200);
        });
    });
}
class LinkedInProfileScraper {
    options = {
        sessionCookieValue: '',
        keepAlive: false,
        timeout: 60000,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        headless: 'new'
    };
    browser = null;
    constructor(userDefinedOptions) {
        const logSection = 'constructing';
        const errorPrefix = 'Error during setup.';
        if (!userDefinedOptions.sessionCookieValue) {
            throw new Error(`${errorPrefix} Option "sessionCookieValue" is required.`);
        }
        if (typeof userDefinedOptions.sessionCookieValue !== 'string') {
            throw new Error(`${errorPrefix} Option "sessionCookieValue" needs to be a string.`);
        }
        if (userDefinedOptions.userAgent && typeof userDefinedOptions.userAgent !== 'string') {
            throw new Error(`${errorPrefix} Option "userAgent" needs to be a string.`);
        }
        if (userDefinedOptions.keepAlive !== undefined && typeof userDefinedOptions.keepAlive !== 'boolean') {
            throw new Error(`${errorPrefix} Option "keepAlive" needs to be a boolean.`);
        }
        if (userDefinedOptions.timeout !== undefined && typeof userDefinedOptions.timeout !== 'number') {
            throw new Error(`${errorPrefix} Option "timeout" needs to be a number.`);
        }
        if (userDefinedOptions.headless !== undefined &&
            typeof userDefinedOptions.headless !== 'boolean' &&
            userDefinedOptions.headless !== 'new' &&
            userDefinedOptions.headless !== 'shell') {
            throw new Error(`${errorPrefix} Option "headless" needs to be a boolean, 'new', or 'shell'.`);
        }
        this.options = Object.assign(this.options, userDefinedOptions);
        (0, utils_1.statusLog)(logSection, `Using options: ${JSON.stringify({ ...this.options, sessionCookieValue: '[REDACTED]' })}`);
    }
    setup = async () => {
        const logSection = 'setup';
        try {
            (0, utils_1.statusLog)(logSection, `Launching Puppeteer with Chrome for Testing...`);
            const launchOptions = {
                headless: this.options.headless,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-blink-features=AutomationControlled',
                    '--exclude-switches=enable-automation',
                    '--disable-extensions-file-access-check',
                    '--disable-extensions-http-throttling',
                    '--disable-extensions-except',
                    '--disable-plugins',
                    '--disable-hang-monitor',
                    '--disable-web-security',
                    '--disable-features=site-per-process,TranslateUI,VizDisplayCompositor',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--disable-gpu',
                    '--window-size=1920,1080',
                    '--no-first-run',
                    '--no-default-browser-check',
                    '--disable-default-apps',
                    '--disable-popup-blocking',
                    '--disable-prompt-on-repost',
                    '--disable-backgrounding-occluded-windows',
                    '--disable-renderer-backgrounding',
                    '--disable-features=Translate',
                    '--disable-ipc-flooding-protection',
                    '--enable-features=NetworkService,NetworkServiceLogging',
                    '--force-color-profile=srgb',
                    '--metrics-recording-only',
                    '--use-mock-keychain',
                    '--disable-background-timer-throttling',
                    '--disable-backgrounding-occluded-windows',
                    '--disable-renderer-backgrounding',
                    '--disable-field-trial-config',
                    '--disable-back-forward-cache',
                    '--enable-features=NetworkService',
                    '--disable-features=ImprovedCookieControls,LazyFrameLoading,GlobalMediaControls,DestroyProfileOnBrowserClose,MediaRouter,DialMediaRouteProvider,AcceptCHFrame,AutoExpandDetailsElement,CertificateTransparencyComponentUpdater,AvoidUnnecessaryBeforeUnloadCheckSync,Translate',
                    '--aggressive-cache-discard',
                    '--disable-background-networking',
                    '--disable-default-apps',
                    '--disable-domain-reliability',
                    '--disable-component-update',
                    '--disable-client-side-phishing-detection',
                    '--ignore-certificate-errors'
                ],
                timeout: this.options.timeout,
                ignoreDefaultArgs: ['--enable-automation', '--enable-blink-features=IdleDetection']
            };
            this.browser = await puppeteer_1.default.launch(launchOptions);
            (0, utils_1.statusLog)(logSection, 'Chrome for Testing launched successfully!');
            await this.checkIfLoggedIn();
            (0, utils_1.statusLog)(logSection, 'Setup completed successfully!');
        }
        catch (err) {
            await this.close();
            (0, utils_1.statusLog)(logSection, 'An error occurred during setup.');
            throw err;
        }
    };
    createPage = async () => {
        const logSection = 'setup page';
        if (!this.browser) {
            throw new Error('Browser not set.');
        }
        const blockedResources = [
            'image', 'media', 'font', 'texttrack', 'object', 'beacon',
            'csp_report', 'imageset', 'stylesheet'
        ];
        try {
            const pages = await this.browser.pages();
            const page = pages.length > 0 ? pages[0] : await this.browser.newPage();
            const allPages = await this.browser.pages();
            for (let i = 1; i < allPages.length; i++) {
                await allPages[i].close();
            }
            (0, utils_1.statusLog)(logSection, `Blocking resources: ${blockedResources.join(', ')}`);
            await page.evaluateOnNewDocument(() => {
                Object.defineProperty(navigator, 'plugins', {
                    get: () => [1, 2, 3, 4, 5]
                });
                Object.defineProperty(navigator, 'languages', {
                    get: () => ['en-US', 'en']
                });
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => false
                });
                window.chrome = {
                    runtime: {}
                };
                const originalQuery = window.navigator.permissions.query;
                window.navigator.permissions.query = (parameters) => {
                    if (parameters.name === 'notifications') {
                        return Promise.resolve({
                            state: Notification.permission,
                            name: 'notifications',
                            onchange: null,
                            addEventListener: () => { },
                            removeEventListener: () => { },
                            dispatchEvent: () => false
                        });
                    }
                    return originalQuery.call(window.navigator.permissions, parameters);
                };
                const getContext = HTMLCanvasElement.prototype.getContext;
                HTMLCanvasElement.prototype.getContext = function (...args) {
                    if (args[0] === '2d') {
                        const context = getContext.apply(this, args);
                        if (context) {
                            const originalFillText = context.fillText;
                            context.fillText = function (...textArgs) {
                                return originalFillText.apply(this, textArgs);
                            };
                        }
                        return context;
                    }
                    return getContext.apply(this, args);
                };
            });
            const blockedHosts = this.getBlockedHosts();
            (0, utils_1.statusLog)(logSection, `Blocking scripts from ${Object.keys(blockedHosts).length} unwanted hosts.`);
            await page.setRequestInterception(true);
            page.on('request', (req) => {
                const resourceType = req.resourceType();
                const url = req.url();
                const hostname = (0, utils_1.getHostname)(url);
                if (blockedResources.includes(resourceType)) {
                    return req.abort();
                }
                if (hostname && blockedHosts[hostname]) {
                    (0, utils_1.statusLog)('blocked', `${resourceType}: ${hostname}`);
                    return req.abort();
                }
                return req.continue();
            });
            await page.setUserAgent(this.options.userAgent);
            await page.setViewport({
                width: 1920,
                height: 1080,
                deviceScaleFactor: 1
            });
            await page.setExtraHTTPHeaders({
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            });
            (0, utils_1.statusLog)(logSection, 'Setting LinkedIn session cookie...');
            await page.setCookie({
                name: 'li_at',
                value: this.options.sessionCookieValue,
                domain: '.linkedin.com',
                path: '/',
                httpOnly: true,
                secure: true
            });
            (0, utils_1.statusLog)(logSection, 'Session cookie set successfully!');
            return page;
        }
        catch (err) {
            await this.close();
            (0, utils_1.statusLog)(logSection, 'An error occurred during page setup.');
            throw err;
        }
    };
    getBlockedHosts = () => {
        const blockedHostsArray = blocked_hosts_1.default.split('\n');
        let blockedHostsObject = blockedHostsArray.reduce((prev, curr) => {
            const frags = curr.split(' ');
            if (frags.length > 1 && frags[0] === '0.0.0.0') {
                prev[frags[1].trim()] = true;
            }
            return prev;
        }, {});
        return {
            ...blockedHostsObject,
            'static.chartbeat.com': true,
            'scdn.cxense.com': true,
            'api.cxense.com': true,
            'www.googletagmanager.com': true,
            'connect.facebook.net': true,
            'platform.twitter.com': true,
            'tags.tiqcdn.com': true,
            'smartlock.google.com': true,
            'cdn.embedly.com': true
        };
    };
    close = (page) => {
        return new Promise(async (resolve, reject) => {
            const loggerPrefix = 'close';
            if (page) {
                try {
                    (0, utils_1.statusLog)(loggerPrefix, 'Closing page...');
                    await page.close();
                    (0, utils_1.statusLog)(loggerPrefix, 'Page closed successfully!');
                }
                catch (err) {
                    reject(err);
                    return;
                }
            }
            if (this.browser) {
                try {
                    (0, utils_1.statusLog)(loggerPrefix, 'Closing browser...');
                    await this.browser.close();
                    (0, utils_1.statusLog)(loggerPrefix, 'Browser closed successfully!');
                    const browserProcess = this.browser.process();
                    const browserProcessPid = browserProcess?.pid;
                    if (browserProcessPid) {
                        (0, utils_1.statusLog)(loggerPrefix, `Killing browser process pid: ${browserProcessPid}...`);
                        (0, tree_kill_1.default)(browserProcessPid, 'SIGKILL', (err) => {
                            if (err) {
                                reject(`Failed to kill browser process pid: ${browserProcessPid}`);
                                return;
                            }
                            (0, utils_1.statusLog)(loggerPrefix, `Browser process ${browserProcessPid} killed successfully.`);
                            resolve();
                        });
                    }
                    else {
                        resolve();
                    }
                }
                catch (err) {
                    reject(err);
                }
            }
            else {
                resolve();
            }
        });
    };
    checkIfLoggedIn = async () => {
        const logSection = 'checkIfLoggedIn';
        const page = await this.createPage();
        (0, utils_1.statusLog)(logSection, 'Checking LinkedIn login status...');
        try {
            await page.goto('https://www.linkedin.com/feed', {
                waitUntil: 'networkidle2',
                timeout: this.options.timeout
            });
            await new Promise(resolve => setTimeout(resolve, 2000));
            const currentUrl = page.url();
            const isLoggedIn = currentUrl.includes('/feed') || currentUrl.includes('/in/');
            await page.close();
            if (isLoggedIn) {
                (0, utils_1.statusLog)(logSection, 'Login verified - session is active!');
            }
            else {
                const errorMessage = 'Session expired! Please update your li_at cookie value.';
                (0, utils_1.statusLog)(logSection, errorMessage);
                throw new errors_1.SessionExpired(errorMessage);
            }
        }
        catch (err) {
            await page.close();
            if (err instanceof errors_1.SessionExpired) {
                throw err;
            }
            throw new Error(`Login check failed: ${err.message}`);
        }
    };
    run = async (profileUrl) => {
        const logSection = 'run';
        const scraperSessionId = Date.now();
        if (!this.browser) {
            throw new Error('Browser is not set. Please run the setup method first.');
        }
        if (!profileUrl) {
            throw new Error('No profileUrl given.');
        }
        if (!profileUrl.includes('linkedin.com/')) {
            throw new Error('The given URL to scrape is not a linkedin.com url.');
        }
        try {
            const page = await this.createPage();
            (0, utils_1.statusLog)(logSection, `🎯 Navigating to: ${profileUrl}`, scraperSessionId);
            await page.goto(profileUrl, {
                waitUntil: 'networkidle0',
                timeout: this.options.timeout
            });
            (0, utils_1.statusLog)(logSection, '📄 LinkedIn profile page loaded!', scraperSessionId);
            await page.waitForSelector('main', { timeout: 15000 });
            (0, utils_1.statusLog)(logSection, '📜 Loading all profile content...', scraperSessionId);
            await smartScroll(page);
            await new Promise(resolve => setTimeout(resolve, 3000));
            (0, utils_1.statusLog)(logSection, '🔍 Extracting profile data using modern techniques...', scraperSessionId);
            const rawUserProfileData = await page.evaluate(() => {
                const url = window.location.href;
                const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
                let profileData = {};
                for (const script of jsonLdScripts) {
                    try {
                        const data = JSON.parse(script.textContent || '');
                        if (data['@graph']) {
                            const person = data['@graph'].find((item) => item['@type'] === 'Person');
                            if (person) {
                                profileData = person;
                                break;
                            }
                        }
                        else if (data['@type'] === 'Person') {
                            profileData = data;
                            break;
                        }
                    }
                    catch {
                        continue;
                    }
                }
                const fullName = profileData.name ||
                    document.querySelector('h1.text-heading-xlarge')?.textContent?.trim() ||
                    document.querySelector('h1')?.textContent?.trim() ||
                    null;
                const title = profileData.jobTitle ||
                    document.querySelector('.text-body-medium.break-words')?.textContent?.trim() ||
                    document.querySelector('.pv-text-details__left-panel h2')?.textContent?.trim() ||
                    null;
                const location = (profileData.address?.addressLocality) ||
                    document.querySelector('.text-body-small.inline.t-black--light.break-words')?.textContent?.trim() ||
                    null;
                const photo = profileData.image ||
                    document.querySelector('img.pv-top-card-profile-picture__image')?.getAttribute('src') ||
                    document.querySelector('button img[width="200"]')?.getAttribute('src') ||
                    null;
                const description = profileData.description ||
                    document.querySelector('div.display-flex.full-width')?.textContent?.trim() ||
                    document.querySelector('.pv-about__summary-text')?.textContent?.trim() ||
                    null;
                return { fullName, title, location, photo, description, url };
            });
            const userProfile = {
                ...rawUserProfileData,
                fullName: (0, utils_1.getCleanText)(rawUserProfileData.fullName),
                title: (0, utils_1.getCleanText)(rawUserProfileData.title),
                location: rawUserProfileData.location ? (0, utils_1.getLocationFromText)(rawUserProfileData.location) : null,
                description: (0, utils_1.getCleanText)(rawUserProfileData.description)
            };
            (0, utils_1.statusLog)(logSection, `👤 Profile data extracted: ${userProfile.fullName || 'Unknown'}`, scraperSessionId);
            (0, utils_1.statusLog)(logSection, '💼 Extracting experience data...', scraperSessionId);
            const rawExperiencesData = await page.evaluate(() => {
                const data = [];
                const experienceSelectors = [
                    'section[data-section="experience"] ul li',
                    '#experience-section .pv-entity',
                    '.experience-section .pv-position-entity'
                ];
                let experienceNodes = null;
                for (const selector of experienceSelectors) {
                    experienceNodes = document.querySelectorAll(selector);
                    if (experienceNodes.length > 0)
                        break;
                }
                if (experienceNodes) {
                    Array.from(experienceNodes).forEach((node) => {
                        try {
                            const titleElement = node.querySelector('h3') ||
                                node.querySelector('.mr1.t-bold span') ||
                                node.querySelector('[data-field="title"]');
                            const title = titleElement?.textContent?.trim() || null;
                            const companyElement = node.querySelector('span.t-14.t-normal') ||
                                node.querySelector('.pv-entity__secondary-title');
                            const company = companyElement?.textContent?.replace(/·.*/, '')?.trim() || null;
                            const employmentTypeElement = node.querySelector('.pv-entity__secondary-title span');
                            const employmentType = employmentTypeElement?.textContent?.trim() || null;
                            const locationElement = node.querySelector('.t-14.t-black--light.t-normal') ||
                                node.querySelector('.pv-entity__location span:nth-child(2)');
                            const location = locationElement?.textContent?.trim() || null;
                            const dateElement = node.querySelector('.pv-entity__date-range span:nth-child(2)');
                            const dateText = dateElement?.textContent?.trim() || '';
                            const [startPart, endPart] = dateText.split('–').map(s => s?.trim());
                            const startDate = startPart || null;
                            const endDateIsPresent = endPart?.toLowerCase().includes('present') || false;
                            const endDate = (endPart && !endDateIsPresent) ? endPart : 'Present';
                            const descriptionElement = node.querySelector('.pv-entity__description') ||
                                node.querySelector('[data-field="description"]');
                            const description = descriptionElement?.textContent?.trim() || null;
                            if (title || company) {
                                data.push({
                                    title, company, employmentType, location,
                                    startDate, endDate, endDateIsPresent, description
                                });
                            }
                        }
                        catch {
                        }
                    });
                }
                return data;
            });
            const experiences = rawExperiencesData.map((rawExp) => {
                const startDate = (0, utils_1.formatDate)(rawExp.startDate);
                const endDate = (0, utils_1.formatDate)(rawExp.endDate) || null;
                const durationInDays = rawExp.endDateIsPresent && startDate ?
                    (0, utils_1.getDurationInDays)(startDate, new Date()) :
                    (startDate && endDate ? (0, utils_1.getDurationInDays)(startDate, endDate) : null);
                return {
                    ...rawExp,
                    title: (0, utils_1.getCleanText)(rawExp.title),
                    company: (0, utils_1.getCleanText)(rawExp.company),
                    employmentType: (0, utils_1.getCleanText)(rawExp.employmentType),
                    location: rawExp.location ? (0, utils_1.getLocationFromText)(rawExp.location) : null,
                    startDate, endDate,
                    endDateIsPresent: rawExp.endDateIsPresent,
                    durationInDays,
                    description: (0, utils_1.getCleanText)(rawExp.description)
                };
            });
            (0, utils_1.statusLog)(logSection, `💼 Found ${experiences.length} experience entries`, scraperSessionId);
            (0, utils_1.statusLog)(logSection, '🎓 Extracting education data...', scraperSessionId);
            const rawEducationData = await page.evaluate(() => {
                const data = [];
                const educationSelectors = [
                    'section[data-section="education"] ul li',
                    '#education-section .pv-entity',
                    '.education-section .pv-education-entity'
                ];
                let educationNodes = null;
                for (const selector of educationSelectors) {
                    educationNodes = document.querySelectorAll(selector);
                    if (educationNodes.length > 0)
                        break;
                }
                if (educationNodes) {
                    Array.from(educationNodes).forEach((node) => {
                        try {
                            const schoolNameElement = node.querySelector('h3.pv-entity__school-name') ||
                                node.querySelector('.mr1.hoverable-link-text.t-bold');
                            const schoolName = schoolNameElement?.textContent?.trim() || null;
                            const degreeElement = node.querySelector('.pv-entity__degree-name .pv-entity__comma-item') ||
                                node.querySelector('.t-14.t-normal');
                            const degreeName = degreeElement?.textContent?.trim() || null;
                            const fieldElement = node.querySelector('.pv-entity__fos .pv-entity__comma-item');
                            const fieldOfStudy = fieldElement?.textContent?.trim() || null;
                            const dateElements = node.querySelectorAll('.pv-entity__dates time');
                            const startDate = dateElements[0]?.textContent?.trim() || null;
                            const endDate = dateElements[1]?.textContent?.trim() || null;
                            if (schoolName) {
                                data.push({ schoolName, degreeName, fieldOfStudy, startDate, endDate });
                            }
                        }
                        catch {
                        }
                    });
                }
                return data;
            });
            const education = rawEducationData.map((rawEdu) => ({
                ...rawEdu,
                schoolName: (0, utils_1.getCleanText)(rawEdu.schoolName),
                degreeName: (0, utils_1.getCleanText)(rawEdu.degreeName),
                fieldOfStudy: (0, utils_1.getCleanText)(rawEdu.fieldOfStudy),
                startDate: (0, utils_1.formatDate)(rawEdu.startDate),
                endDate: (0, utils_1.formatDate)(rawEdu.endDate),
                durationInDays: (0, utils_1.getDurationInDays)((0, utils_1.formatDate)(rawEdu.startDate), (0, utils_1.formatDate)(rawEdu.endDate))
            }));
            (0, utils_1.statusLog)(logSection, `🎓 Found ${education.length} education entries`, scraperSessionId);
            const rawVolunteerExperiences = await page.evaluate(() => {
                const data = [];
                const nodes = document.querySelectorAll('.volunteering-section ul li.ember-view');
                Array.from(nodes).forEach((node) => {
                    try {
                        const titleElement = node.querySelector('.pv-entity__summary-info h3');
                        const title = titleElement?.textContent?.trim() || null;
                        const companyElement = node.querySelector('.pv-entity__summary-info span.pv-entity__secondary-title');
                        const company = companyElement?.textContent?.trim() || null;
                        const dateElement = node.querySelector('.pv-entity__date-range span:nth-child(2)');
                        const dateText = dateElement?.textContent?.trim() || '';
                        const [startPart, endPart] = dateText.split('–').map(s => s?.trim());
                        const startDate = startPart || null;
                        const endDateIsPresent = endPart?.toLowerCase() === 'present' || false;
                        const endDate = (endPart && !endDateIsPresent) ? endPart : 'Present';
                        const descriptionElement = node.querySelector('.pv-entity__description');
                        const description = descriptionElement?.textContent?.trim() || null;
                        if (title) {
                            data.push({ title, company, startDate, endDate, endDateIsPresent, description });
                        }
                    }
                    catch {
                    }
                });
                return data;
            });
            const volunteerExperiences = rawVolunteerExperiences.map((rawVol) => ({
                ...rawVol,
                title: (0, utils_1.getCleanText)(rawVol.title),
                company: (0, utils_1.getCleanText)(rawVol.company),
                description: (0, utils_1.getCleanText)(rawVol.description),
                startDate: (0, utils_1.formatDate)(rawVol.startDate),
                endDate: (0, utils_1.formatDate)(rawVol.endDate),
                durationInDays: (0, utils_1.getDurationInDays)((0, utils_1.formatDate)(rawVol.startDate), (0, utils_1.formatDate)(rawVol.endDate))
            }));
            (0, utils_1.statusLog)(logSection, '🏅 Extracting skills data...', scraperSessionId);
            const skills = await page.evaluate(() => {
                const skillSelectors = [
                    '.pv-skill-categories-section ol > .ember-view',
                    'section[data-section="skills"] ul li'
                ];
                let skillNodes = null;
                for (const selector of skillSelectors) {
                    skillNodes = document.querySelectorAll(selector);
                    if (skillNodes.length > 0)
                        break;
                }
                if (!skillNodes)
                    return [];
                return Array.from(skillNodes).map((node) => {
                    try {
                        const skillNameElement = node.querySelector('.pv-skill-category-entity__name-text') ||
                            node.querySelector('.mr1.hoverable-link-text.t-bold');
                        const skillName = skillNameElement?.textContent?.trim() || null;
                        const endorsementElement = node.querySelector('.pv-skill-category-entity__endorsement-count');
                        const endorsementText = endorsementElement?.textContent?.trim() || '0';
                        const endorsementCount = parseInt(endorsementText.replace(/\D/g, '')) || 0;
                        return { skillName, endorsementCount };
                    }
                    catch {
                        return { skillName: null, endorsementCount: 0 };
                    }
                }).filter((skill) => skill.skillName !== null);
            });
            (0, utils_1.statusLog)(logSection, `🏅 Found ${skills.length} skills`, scraperSessionId);
            (0, utils_1.statusLog)(logSection, `✅ Profile scraping completed successfully!`, scraperSessionId);
            if (!this.options.keepAlive) {
                (0, utils_1.statusLog)(logSection, '🔄 Closing browser session...');
                await this.close(page);
            }
            else {
                (0, utils_1.statusLog)(logSection, '💾 Keeping browser session alive in memory.');
                await page.close();
            }
            return {
                userProfile,
                experiences,
                education,
                volunteerExperiences,
                skills
            };
        }
        catch (err) {
            await this.close();
            (0, utils_1.statusLog)(logSection, `❌ Scraping failed: ${err.message}`);
            throw err;
        }
    };
}
exports.LinkedInProfileScraper = LinkedInProfileScraper;
//# sourceMappingURL=index.js.map