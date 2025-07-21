import puppeteer, { Page, Browser } from 'puppeteer';
import treeKill from 'tree-kill';

import blockedHostsList from './blocked-hosts';
import { getDurationInDays, formatDate, getCleanText, getLocationFromText, statusLog, getHostname, Location } from './utils';
import { SessionExpired } from './errors';

export interface Profile {
  fullName: string | null;
  title: string | null;
  location: Location | null;
  photo: string | null;
  description: string | null;
  url: string;
}

interface RawProfile {
  fullName: string | null;
  title: string | null;
  location: string | null;
  photo: string | null;
  description: string | null;
  url: string;
}

export interface Experience {
  title: string | null;
  company: string | null;
  employmentType: string | null;
  location: Location | null;
  startDate: string | null;
  endDate: string | null;
  endDateIsPresent: boolean;
  durationInDays: number | null;
  description: string | null;
}

interface RawExperience {
  title: string | null;
  company: string | null;
  employmentType: string | null;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  endDateIsPresent: boolean;
  description: string | null;
}

export interface Education {
  schoolName: string | null;
  degreeName: string | null;
  fieldOfStudy: string | null;
  startDate: string | null;
  endDate: string | null;
  durationInDays: number | null;
}

interface RawEducation {
  schoolName: string | null;
  degreeName: string | null;
  fieldOfStudy: string | null;
  startDate: string | null;
  endDate: string | null;
}

export interface VolunteerExperience {
  title: string | null;
  company: string | null;
  startDate: string | null;
  endDate: string | null;
  endDateIsPresent: boolean;
  durationInDays: number | null;
  description: string | null;
}

interface RawVolunteerExperience {
  title: string | null;
  company: string | null;
  startDate: string | null;
  endDate: string | null;
  endDateIsPresent: boolean;
  description: string | null;
}

export interface Skill {
  skillName: string | null;
  endorsementCount: number | null;
}

interface ScraperUserDefinedOptions {
  sessionCookieValue: string;
  keepAlive?: boolean;
  userAgent?: string;
  timeout?: number;
  headless?: boolean | 'new' | 'shell';
}

interface ScraperOptions {
  sessionCookieValue: string;
  keepAlive: boolean;
  userAgent: string;
  timeout: number;
  headless: boolean | 'new' | 'shell';
}

// Modern Puppeteer v24+ compatible launch options type
type ModernPuppeteerLaunchOptions = Parameters<typeof puppeteer.launch>[0];

async function smartScroll(page: Page): Promise<void> {
  await page.evaluate(async (): Promise<void> => {
    await new Promise<void>((resolve): void => {
      let totalHeight = 0;
      const distance = 400;
      const maxScrolls = 10;
      let scrollCount = 0;
      
      const timer = setInterval((): void => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        scrollCount++;

        // Stop if we've reached the bottom or made too many scrolls
        if (totalHeight >= scrollHeight - window.innerHeight || scrollCount >= maxScrolls) {
          clearInterval(timer);
          resolve();
        }
      }, 200);
    });
  });
}

export class LinkedInProfileScraper {
  readonly options: ScraperOptions = {
    sessionCookieValue: '',
    keepAlive: false,
    timeout: 60000,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    headless: 'new'
  };

  private browser: Browser | null = null;

  constructor(userDefinedOptions: ScraperUserDefinedOptions) {
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
    statusLog(logSection, `Using options: ${JSON.stringify({ ...this.options, sessionCookieValue: '[REDACTED]' })}`);
  }

  public setup = async (): Promise<void> => {
    const logSection = 'setup';

    try {
      statusLog(logSection, `Launching Puppeteer with Chrome for Testing...`);

      const launchOptions: ModernPuppeteerLaunchOptions = {
        headless: this.options.headless as any,
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

      this.browser = await puppeteer.launch(launchOptions);

      statusLog(logSection, 'Chrome for Testing launched successfully!');

      // Verify login status
      await this.checkIfLoggedIn();
      statusLog(logSection, 'Setup completed successfully!');

    } catch (err) {
      await this.close();
      statusLog(logSection, 'An error occurred during setup.');
      throw err;
    }
  };

  private createPage = async (): Promise<Page> => {
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

      // Close extra pages
      const allPages = await this.browser.pages();
      for (let i = 1; i < allPages.length; i++) {
        await allPages[i].close();
      }

      statusLog(logSection, `Blocking resources: ${blockedResources.join(', ')}`);

      // Enhanced anti-detection with modern typing
      await page.evaluateOnNewDocument((): void => {
        // Override the `plugins` property to use a custom getter
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5]
        });

        // Override the `languages` property to use a custom getter
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en']
        });

        // Override the `webdriver` property
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false
        });

        // Mock chrome object
        (window as any).chrome = {
          runtime: {}
        };

        // Modern PermissionStatus object implementation
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters: PermissionDescriptor): Promise<PermissionStatus> => {
          if (parameters.name === 'notifications') {
            return Promise.resolve({
              state: Notification.permission as PermissionState,
              name: 'notifications' as PermissionName,
              onchange: null,
              addEventListener: () => {},
              removeEventListener: () => {},
              dispatchEvent: () => false
            } as PermissionStatus);
          }
          return originalQuery.call(window.navigator.permissions, parameters);
        };

        // Randomize canvas fingerprint
        const getContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function(this: HTMLCanvasElement, ...args: any[]): any {
          if (args[0] === '2d') {
            const context = (getContext as any).apply(this, args);
            if (context) {
              const originalFillText = (context as CanvasRenderingContext2D).fillText;
              (context as CanvasRenderingContext2D).fillText = function(...textArgs: any[]) {
                return originalFillText.apply(this, textArgs as [string, number, number, number?]);
              };
            }
            return context;
          }
          return (getContext as any).apply(this, args);
        };
      });

      const blockedHosts = this.getBlockedHosts();
      statusLog(logSection, `Blocking scripts from ${Object.keys(blockedHosts).length} unwanted hosts.`);

      await page.setRequestInterception(true);

      page.on('request', (req) => {
        const resourceType = req.resourceType();
        const url = req.url();
        const hostname = getHostname(url);

        // Block unnecessary resources
        if (blockedResources.includes(resourceType)) {
          return req.abort();
        }

        // Block known tracking domains
        if (hostname && blockedHosts[hostname]) {
          statusLog('blocked', `${resourceType}: ${hostname}`);
          return req.abort();
        }

        // Allow the request
        return req.continue();
      });

      await page.setUserAgent(this.options.userAgent);

      await page.setViewport({
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1
      });

      // Set extra headers to appear more human
      await page.setExtraHTTPHeaders({
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      });

      statusLog(logSection, 'Setting LinkedIn session cookie...');

      await page.setCookie({
        name: 'li_at',
        value: this.options.sessionCookieValue,
        domain: '.linkedin.com',
        path: '/',
        httpOnly: true,
        secure: true
      });

      statusLog(logSection, 'Session cookie set successfully!');

      return page;
    } catch (err) {
      await this.close();
      statusLog(logSection, 'An error occurred during page setup.');
      throw err;
    }
  };

  private getBlockedHosts = (): Record<string, boolean> => {
    const blockedHostsArray = blockedHostsList.split('\n');

    let blockedHostsObject = blockedHostsArray.reduce((prev, curr) => {
      const frags = curr.split(' ');
      if (frags.length > 1 && frags[0] === '0.0.0.0') {
        prev[frags[1].trim()] = true;
      }
      return prev;
    }, {} as Record<string, boolean>);

    // Add additional known tracking domains
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

  public close = (page?: Page): Promise<void> => {
    return new Promise<void>(async (resolve, reject): Promise<void> => {
      const loggerPrefix = 'close';

      if (page) {
        try {
          statusLog(loggerPrefix, 'Closing page...');
          await page.close();
          statusLog(loggerPrefix, 'Page closed successfully!');
        } catch (err) {
          reject(err);
          return;
        }
      }

      if (this.browser) {
        try {
          statusLog(loggerPrefix, 'Closing browser...');
          await this.browser.close();
          statusLog(loggerPrefix, 'Browser closed successfully!');

          const browserProcess = this.browser.process();
          const browserProcessPid = browserProcess?.pid;

          if (browserProcessPid) {
            statusLog(loggerPrefix, `Killing browser process pid: ${browserProcessPid}...`);

            treeKill(browserProcessPid, 'SIGKILL', (err) => {
              if (err) {
                reject(`Failed to kill browser process pid: ${browserProcessPid}`);
                return;
              }
              statusLog(loggerPrefix, `Browser process ${browserProcessPid} killed successfully.`);
              resolve();
            });
          } else {
            resolve();
          }
        } catch (err) {
          reject(err);
        }
      } else {
        resolve();
      }
    });
  };

  public checkIfLoggedIn = async (): Promise<void> => {
    const logSection = 'checkIfLoggedIn';
    const page = await this.createPage();

    statusLog(logSection, 'Checking LinkedIn login status...');

    try {
      await page.goto('https://www.linkedin.com/feed', {
        waitUntil: 'networkidle2',
        timeout: this.options.timeout
      });

      // Use modern page.waitForTimeout instead of workarounds
      await new Promise(resolve => setTimeout(resolve, 2000));

      const currentUrl = page.url();
      const isLoggedIn = currentUrl.includes('/feed') || currentUrl.includes('/in/');

      await page.close();

      if (isLoggedIn) {
        statusLog(logSection, 'Login verified - session is active!');
      } else {
        const errorMessage = 'Session expired! Please update your li_at cookie value.';
        statusLog(logSection, errorMessage);
        throw new SessionExpired(errorMessage);
      }
    } catch (err) {
      await page.close();
      if (err instanceof SessionExpired) {
        throw err;
      }
      throw new Error(`Login check failed: ${(err as Error).message}`);
    }
  };

  /**
   * Modern LinkedIn Profile Scraper - 2025 Edition
   * Optimized for Puppeteer 24.14.0 with Chrome for Testing
   */
  public run = async (profileUrl: string): Promise<{
    userProfile: Profile;
    experiences: Experience[];
    education: Education[];
    volunteerExperiences: VolunteerExperience[];
    skills: Skill[];
  }> => {
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
      
      statusLog(logSection, `🎯 Navigating to: ${profileUrl}`, scraperSessionId);

      await page.goto(profileUrl, {
        waitUntil: 'networkidle0',
        timeout: this.options.timeout
      });

      statusLog(logSection, '📄 LinkedIn profile page loaded!', scraperSessionId);

      // Wait for main content
      await page.waitForSelector('main', { timeout: 15000 });
      
      // Smart scrolling to load all content
      statusLog(logSection, '📜 Loading all profile content...', scraperSessionId);
      await smartScroll(page);
      
      // Wait for dynamic content to stabilize
      await new Promise(resolve => setTimeout(resolve, 3000));

      statusLog(logSection, '🔍 Extracting profile data using modern techniques...', scraperSessionId);

      // Extract profile data using JSON-LD + modern HTML selectors
      const rawUserProfileData: RawProfile = await page.evaluate((): RawProfile => {
        const url = window.location.href;
        
        // Try JSON-LD first (most reliable)
        const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
        let profileData: any = {};
        
        for (const script of jsonLdScripts) {
          try {
            const data = JSON.parse(script.textContent || '');
            if (data['@graph']) {
              const person = data['@graph'].find((item: any) => item['@type'] === 'Person');
              if (person) {
                profileData = person;
                break;
              }
            } else if (data['@type'] === 'Person') {
              profileData = data;
              break;
            }
          } catch {
            continue;
          }
        }
        
        // Modern HTML selectors with multiple fallbacks
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

        return { fullName, title, location, photo, description, url } as RawProfile;
      });

      const userProfile: Profile = {
        ...rawUserProfileData,
        fullName: getCleanText(rawUserProfileData.fullName),
        title: getCleanText(rawUserProfileData.title),
        location: rawUserProfileData.location ? getLocationFromText(rawUserProfileData.location) : null,
        description: getCleanText(rawUserProfileData.description)
      };

      statusLog(logSection, `👤 Profile data extracted: ${userProfile.fullName || 'Unknown'}`, scraperSessionId);

      // Extract experience data
      statusLog(logSection, '💼 Extracting experience data...', scraperSessionId);

      const rawExperiencesData: RawExperience[] = await page.evaluate((): RawExperience[] => {
        const data: RawExperience[] = [];
        
        const experienceSelectors = [
          'section[data-section="experience"] ul li',
          '#experience-section .pv-entity',
          '.experience-section .pv-position-entity'
        ];

        let experienceNodes: NodeListOf<Element> | null = null;
        
        for (const selector of experienceSelectors) {
          experienceNodes = document.querySelectorAll(selector);
          if (experienceNodes.length > 0) break;
        }

        if (experienceNodes) {
          // Use Array.from to properly iterate over NodeListOf<Element>
          Array.from(experienceNodes).forEach((node): void => {
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
            } catch {
              // Skip problematic nodes
            }
          });
        }

        return data;
      });

      const experiences: Experience[] = rawExperiencesData.map((rawExp): Experience => {
        const startDate = formatDate(rawExp.startDate);
        const endDate = formatDate(rawExp.endDate) || null;
        const durationInDays = rawExp.endDateIsPresent && startDate ? 
          getDurationInDays(startDate, new Date()) : 
          (startDate && endDate ? getDurationInDays(startDate, endDate) : null);

        return {
          ...rawExp,
          title: getCleanText(rawExp.title),
          company: getCleanText(rawExp.company),
          employmentType: getCleanText(rawExp.employmentType),
          location: rawExp.location ? getLocationFromText(rawExp.location) : null,
          startDate, endDate,
          endDateIsPresent: rawExp.endDateIsPresent,
          durationInDays,
          description: getCleanText(rawExp.description)
        };
      });

      statusLog(logSection, `💼 Found ${experiences.length} experience entries`, scraperSessionId);

      // Extract education data
      statusLog(logSection, '🎓 Extracting education data...', scraperSessionId);

      const rawEducationData: RawEducation[] = await page.evaluate((): RawEducation[] => {
        const data: RawEducation[] = [];
        
        const educationSelectors = [
          'section[data-section="education"] ul li',
          '#education-section .pv-entity',
          '.education-section .pv-education-entity'
        ];

        let educationNodes: NodeListOf<Element> | null = null;
        
        for (const selector of educationSelectors) {
          educationNodes = document.querySelectorAll(selector);
          if (educationNodes.length > 0) break;
        }

        if (educationNodes) {
          Array.from(educationNodes).forEach((node): void => {
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
            } catch {
              // Skip problematic nodes
            }
          });
        }

        return data;
      });

      const education: Education[] = rawEducationData.map((rawEdu): Education => ({
        ...rawEdu,
        schoolName: getCleanText(rawEdu.schoolName),
        degreeName: getCleanText(rawEdu.degreeName),
        fieldOfStudy: getCleanText(rawEdu.fieldOfStudy),
        startDate: formatDate(rawEdu.startDate),
        endDate: formatDate(rawEdu.endDate),
        durationInDays: getDurationInDays(formatDate(rawEdu.startDate), formatDate(rawEdu.endDate))
      }));

      statusLog(logSection, `🎓 Found ${education.length} education entries`, scraperSessionId);

      // Extract volunteer experiences
      const rawVolunteerExperiences: RawVolunteerExperience[] = await page.evaluate((): RawVolunteerExperience[] => {
        const data: RawVolunteerExperience[] = [];
        const nodes = document.querySelectorAll('.volunteering-section ul li.ember-view');

        Array.from(nodes).forEach((node): void => {
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
          } catch {
            // Skip problematic nodes
          }
        });

        return data;
      });

      const volunteerExperiences: VolunteerExperience[] = rawVolunteerExperiences.map((rawVol): VolunteerExperience => ({
        ...rawVol,
        title: getCleanText(rawVol.title),
        company: getCleanText(rawVol.company),
        description: getCleanText(rawVol.description),
        startDate: formatDate(rawVol.startDate),
        endDate: formatDate(rawVol.endDate),
        durationInDays: getDurationInDays(formatDate(rawVol.startDate), formatDate(rawVol.endDate))
      }));

      // Extract skills
      statusLog(logSection, '🏅 Extracting skills data...', scraperSessionId);

      const skills: Skill[] = await page.evaluate((): Skill[] => {
        const skillSelectors = [
          '.pv-skill-categories-section ol > .ember-view',
          'section[data-section="skills"] ul li'
        ];

        let skillNodes: NodeListOf<Element> | null = null;
        
        for (const selector of skillSelectors) {
          skillNodes = document.querySelectorAll(selector);
          if (skillNodes.length > 0) break;
        }

        if (!skillNodes) return [];

        return Array.from(skillNodes).map((node): Skill => {
          try {
            const skillNameElement = node.querySelector('.pv-skill-category-entity__name-text') ||
                                   node.querySelector('.mr1.hoverable-link-text.t-bold');
            const skillName = skillNameElement?.textContent?.trim() || null;

            const endorsementElement = node.querySelector('.pv-skill-category-entity__endorsement-count');
            const endorsementText = endorsementElement?.textContent?.trim() || '0';
            const endorsementCount = parseInt(endorsementText.replace(/\D/g, '')) || 0;

            return { skillName, endorsementCount };
          } catch {
            return { skillName: null, endorsementCount: 0 };
          }
        }).filter((skill): skill is Skill => skill.skillName !== null);
      });

      statusLog(logSection, `🏅 Found ${skills.length} skills`, scraperSessionId);
      statusLog(logSection, `✅ Profile scraping completed successfully!`, scraperSessionId);

      if (!this.options.keepAlive) {
        statusLog(logSection, '🔄 Closing browser session...');
        await this.close(page);
      } else {
        statusLog(logSection, '💾 Keeping browser session alive in memory.');
        await page.close();
      }

      return {
        userProfile,
        experiences,
        education,
        volunteerExperiences,
        skills
      };

    } catch (err) {
      await this.close();
      statusLog(logSection, `❌ Scraping failed: ${(err as Error).message}`);
      throw err;
    }
  };
}