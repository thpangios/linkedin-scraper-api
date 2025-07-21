import puppeteer, { Page, Browser } from 'puppeteer'
import treeKill from 'tree-kill';

import blockedHostsList from './blocked-hosts';

import { getDurationInDays, formatDate, getCleanText, getLocationFromText, statusLog, getHostname } from './utils'
import { SessionExpired } from './errors';

export interface Location {
  city: string | null;
  province: string | null;
  country: string | null
}

interface RawProfile {
  fullName: string | null;
  title: string | null;
  location: string | null;
  photo: string | null;
  description: string | null;
  url: string;
}

export interface Profile {
  fullName: string | null;
  title: string | null;
  location: Location | null;
  photo: string | null;
  description: string | null;
  url: string;
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

interface RawEducation {
  schoolName: string | null;
  degreeName: string | null;
  fieldOfStudy: string | null;
  startDate: string | null;
  endDate: string | null;
}

export interface Education {
  schoolName: string | null;
  degreeName: string | null;
  fieldOfStudy: string | null;
  startDate: string | null;
  endDate: string | null;
  durationInDays: number | null;
}

interface RawVolunteerExperience {
  title: string | null;
  company: string | null;
  startDate: string | null;
  endDate: string | null;
  endDateIsPresent: boolean;
  description: string | null;
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

export interface Skill {
  skillName: string | null;
  endorsementCount: number | null;
}

interface ScraperUserDefinedOptions {
  sessionCookieValue: string;
  keepAlive?: boolean;
  userAgent?: string;
  timeout?: number;
  headless?: boolean;
}

interface ScraperOptions {
  sessionCookieValue: string;
  keepAlive: boolean;
  userAgent: string;
  timeout: number;
  headless: boolean;
}

async function autoScroll(page: Page) {
  await page.evaluate(() => {
    return new Promise<void>((resolve) => {
      let totalHeight = 0;
      const distance = 300;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight - window.innerHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 150);
    });
  });
}

export class LinkedInProfileScraper {
  readonly options: ScraperOptions = {
    sessionCookieValue: '',
    keepAlive: false,
    timeout: 30000,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    headless: true
  }

  private browser: Browser | null = null;

  constructor(userDefinedOptions: ScraperUserDefinedOptions) {
    const logSection = 'constructing';
    const errorPrefix = 'Error during setup.';

    if (!userDefinedOptions.sessionCookieValue) {
      throw new Error(`${errorPrefix} Option "sessionCookieValue" is required.`);
    }
    
    if (userDefinedOptions.sessionCookieValue && typeof userDefinedOptions.sessionCookieValue !== 'string') {
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
    
    if (userDefinedOptions.headless !== undefined && typeof userDefinedOptions.headless !== 'boolean') {
      throw new Error(`${errorPrefix} Option "headless" needs to be a boolean.`);
    }

    this.options = Object.assign(this.options, userDefinedOptions);

    statusLog(logSection, `Using options: ${JSON.stringify(this.options)}`);
  }

  public setup = async () => {
    const logSection = 'setup'

    try {
      statusLog(logSection, `Launching puppeteer in the ${this.options.headless ? 'background' : 'foreground'}...`)

      this.browser = await puppeteer.launch({
        headless: this.options.headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-features=VizDisplayCompositor',
          '--disable-web-security',
          '--disable-features=site-per-process',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920,1080',
          '--no-first-run',
          '--no-default-browser-check',
          '--disable-extensions',
          '--disable-plugins',
          '--disable-images',
          '--disable-javascript',
          '--user-agent=' + this.options.userAgent
        ],
        timeout: this.options.timeout,
        ignoreDefaultArgs: ['--enable-automation']
      })

      statusLog(logSection, 'Puppeteer launched!')

      await this.checkIfLoggedIn();

      statusLog(logSection, 'Done!')
    } catch (err) {
      await this.close();
      statusLog(logSection, 'An error occurred during setup.')
      throw err
    }
  };

  private createPage = async (): Promise<Page> => {
    const logSection = 'setup page'

    if (!this.browser) {
      throw new Error('Browser not set.');
    }

    const blockedResources = ['image', 'media', 'font', 'texttrack', 'object', 'beacon', 'csp_report', 'imageset'];

    try {
      const page = await this.browser.newPage()

      const firstPage = (await this.browser.pages())[0];
      if (firstPage) await firstPage.close();

      statusLog(logSection, `Blocking the following resources: ${blockedResources.join(', ')}`)

      const blockedHosts = this.getBlockedHosts();
      const blockedResourcesByHost = ['script', 'xhr', 'fetch', 'document']

      statusLog(logSection, `Should block scripts from ${Object.keys(blockedHosts).length} unwanted hosts to speed up the crawling.`);

      await page.setRequestInterception(true);

      page.on('request', (req) => {
        if (blockedResources.includes(req.resourceType())) {
          return req.abort()
        }

        const hostname = getHostname(req.url());

        if (blockedResourcesByHost.includes(req.resourceType()) && hostname && blockedHosts[hostname] === true) {
          statusLog('blocked script', `${req.resourceType()}: ${hostname}: ${req.url()}`);
          return req.abort();
        }

        return req.continue()
      })

      // Anti-detection measures
      await page.evaluateOnNewDocument(() => {
        // Remove webdriver traces
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false,
        });
        
        // Mock plugins and languages
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en'],
        });
        
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5],
        });
      });

      await page.setUserAgent(this.options.userAgent)

      await page.setViewport({
        width: 1920,
        height: 1080
      })

      statusLog(logSection, `Setting session cookie using cookie: ${this.options.sessionCookieValue.substring(0, 20)}...`)

      await page.setCookie({
        'name': 'li_at',
        'value': this.options.sessionCookieValue,
        'domain': '.linkedin.com'
      })

      statusLog(logSection, 'Session cookie set!')
      statusLog(logSection, 'Done!')

      return page;
    } catch (err) {
      await this.close();
      statusLog(logSection, 'An error occurred during page setup.')
      statusLog(logSection, err.message)
      throw err
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

    blockedHostsObject = {
      ...blockedHostsObject,
      'static.chartbeat.com': true,
      'scdn.cxense.com': true,
      'api.cxense.com': true,
      'www.googletagmanager.com': true,
      'connect.facebook.net': true,
      'platform.twitter.com': true,
      'tags.tiqcdn.com': true,
      'dev.visualwebsiteoptimizer.com': true,
      'smartlock.google.com': true,
      'cdn.embedly.com': true
    }

    return blockedHostsObject;
  }

  public close = (page?: Page): Promise<void> => {
    return new Promise(async (resolve, reject) => {
      const loggerPrefix = 'close';

      if (page) {
        try {
          statusLog(loggerPrefix, 'Closing page...');
          await page.close();
          statusLog(loggerPrefix, 'Closed page!');
        } catch (err) {
          reject(err)
        }
      }

      if (this.browser) {
        try {
          statusLog(loggerPrefix, 'Closing browser...');
          await this.browser.close();
          statusLog(loggerPrefix, 'Closed browser!');

          const browserProcessPid = this.browser.process()?.pid;

          if (browserProcessPid) {
            statusLog(loggerPrefix, `Killing browser process pid: ${browserProcessPid}...`);

            treeKill(browserProcessPid, 'SIGKILL', (err) => {
              if (err) {
                return reject(`Failed to kill browser process pid: ${browserProcessPid}`);
              }

              statusLog(loggerPrefix, `Killed browser pid: ${browserProcessPid} Closed browser.`);
              resolve()
            });
          }
        } catch (err) {
          reject(err);
        }
      }

      return resolve()
    })
  }

  public checkIfLoggedIn = async () => {
    const logSection = 'checkIfLoggedIn';
    const page = await this.createPage();

    statusLog(logSection, 'Checking if we are still logged in...')

    await page.goto('https://www.linkedin.com/login', {
      waitUntil: 'networkidle2',
      timeout: this.options.timeout
    })

    const url = page.url()
    const isLoggedIn = !url.endsWith('/login')

    await page.close();

    if (isLoggedIn) {
      statusLog(logSection, 'All good. We are still logged in.')
    } else {
      const errorMessage = 'Bad news, we are not logged in! Your session seems to be expired. Use your browser to login again with your LinkedIn credentials and extract the "li_at" cookie value for the "sessionCookieValue" option.';
      statusLog(logSection, errorMessage)
      throw new SessionExpired(errorMessage)
    }
  };

  /**
   * MODERN 2025 LinkedIn Profile Scraper using JSON-LD + HTML fallbacks
   */
  public run = async (profileUrl: string) => {
    const logSection = 'run'
    const scraperSessionId = new Date().getTime();

    if (!this.browser) {
      throw new Error('Browser is not set. Please run the setup method first.')
    }

    if (!profileUrl) {
      throw new Error('No profileUrl given.')
    }

    if (!profileUrl.includes('linkedin.com/')) {
      throw new Error('The given URL to scrape is not a linkedin.com url.')
    }

    try {
      const page = await this.createPage();

      statusLog(logSection, `Navigating to LinkedIn profile: ${profileUrl}`, scraperSessionId)

      await page.goto(profileUrl, {
        waitUntil: 'networkidle0',
        timeout: this.options.timeout
      });

      statusLog(logSection, 'LinkedIn profile page loaded!', scraperSessionId)

      // Wait for main content to load
      await page.waitForSelector('main', { timeout: 10000 });
      
      statusLog(logSection, 'Getting all the LinkedIn profile data by scrolling the page to the bottom, so all the data gets loaded into the page...', scraperSessionId)

      await autoScroll(page);

      // Wait for dynamic content to load
      await page.waitFor(2000);

      statusLog(logSection, 'Parsing data...', scraperSessionId)

      // Modern 2025 Profile Data Extraction using JSON-LD + HTML fallbacks
      const rawUserProfileData: RawProfile = await page.evaluate(() => {
        const url = window.location.href;
        
        // 1. Try JSON-LD structured data first (most reliable)
        const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
        let profileData: any = {};
        
        for (const script of jsonLdScripts) {
          try {
            const data = JSON.parse(script.textContent || '');
            if (data['@graph']) {
              // LinkedIn uses @graph structure
              const person = data['@graph'].find((item: any) => item['@type'] === 'Person');
              if (person) {
                profileData = person;
                break;
              }
            } else if (data['@type'] === 'Person') {
              profileData = data;
              break;
            }
          } catch (e) {
            // Skip invalid JSON
            continue;
          }
        }
        
        // 2. HTML fallbacks with modern selectors
        const fullName = profileData.name || 
          document.querySelector('h1')?.textContent?.trim() ||
          document.querySelector('[data-generated-suggestion-target]')?.textContent?.trim() ||
          document.querySelector('.text-heading-xlarge')?.textContent?.trim() ||
          null;
          
        const title = profileData.jobTitle || 
          document.querySelector('.text-body-medium.break-words')?.textContent?.trim() ||
          document.querySelector('[data-generated-suggestion-target] + div')?.textContent?.trim() ||
          document.querySelector('.pv-text-details__left-panel h2')?.textContent?.trim() ||
          null;
          
        const location = (profileData.address && profileData.address.addressLocality) || 
          document.querySelector('[data-test-id="profile-location"]')?.textContent?.trim() ||
          document.querySelector('.text-body-small.inline.t-black--light.break-words')?.textContent?.trim() ||
          null;
          
        const photo = profileData.image || 
          document.querySelector('img[data-ghost-classes]')?.getAttribute('src') ||
          document.querySelector('.pv-top-card__photo img')?.getAttribute('src') ||
          document.querySelector('button img[width="200"]')?.getAttribute('src') ||
          null;
          
        const description = profileData.description || 
          document.querySelector('[data-generated-suggestion-target="about"]')?.textContent?.trim() ||
          document.querySelector('.display-flex.full-width')?.textContent?.trim() ||
          null;

        return {
          fullName,
          title,
          location,
          photo,
          description,
          url
        } as RawProfile
      })

      const userProfile: Profile = {
        ...rawUserProfileData,
        fullName: getCleanText(rawUserProfileData.fullName),
        title: getCleanText(rawUserProfileData.title),
        location: rawUserProfileData.location ? getLocationFromText(rawUserProfileData.location) : null,
        description: getCleanText(rawUserProfileData.description),
      }

      statusLog(logSection, `Got user profile data: ${JSON.stringify(userProfile)}`, scraperSessionId)

      // Modern Experience Data Extraction
      statusLog(logSection, `Parsing experiences data...`, scraperSessionId)

      const rawExperiencesData: RawExperience[] = await page.evaluate(() => {
        let data: RawExperience[] = []

        // Modern LinkedIn experience selectors
        const experienceSelectors = [
          'section[data-section="experience"] ul li',
          '[data-section="experience"] .pvs-list__item',
          '.experience-section ul .pv-entity',
          'main section:nth-child(4) ul li' // Fallback position-based
        ];

        let experienceNodes: NodeListOf<Element> | null = null;
        
        for (const selector of experienceSelectors) {
          experienceNodes = document.querySelectorAll(selector);
          if (experienceNodes.length > 0) break;
        }

        if (experienceNodes && experienceNodes.length > 0) {
          Array.from(experienceNodes).forEach((node) => {
            try {
              const titleElement = node.querySelector('div[data-field="title"]') || 
                                 node.querySelector('.mr1.t-bold span') ||
                                 node.querySelector('.pv-entity__summary-info h3') ||
                                 node.querySelector('h3');
              const title = titleElement?.textContent?.trim() || null;

              const companyElement = node.querySelector('span.t-14.t-normal') ||
                                   node.querySelector('.pv-entity__secondary-title') ||
                                   node.querySelector('[data-field="company"]');
              const company = companyElement?.textContent?.replace(/·.*/, '')?.trim() || null;

              const employmentTypeElement = node.querySelector('.pv-entity__secondary-title span');
              const employmentType = employmentTypeElement?.textContent?.trim() || null;

              const locationElement = node.querySelector('.t-14.t-black--light.t-normal') ||
                                    node.querySelector('.pv-entity__location span:nth-child(2)');
              const location = locationElement?.textContent?.trim() || null;

              const dateElement = node.querySelector('.t-14.t-black--light.t-normal') ||
                                node.querySelector('.pv-entity__date-range span:nth-child(2)');
              const dateText = dateElement?.textContent?.trim() || '';

              const startDatePart = dateText?.split('–')[0]?.trim() || dateText?.split(' - ')[0]?.trim() || null;
              const startDate = startDatePart || null;

              const endDatePart = dateText?.split('–')[1]?.trim() || dateText?.split(' - ')[1]?.trim() || null;
              const endDateIsPresent = endDatePart?.toLowerCase().includes('present') || false;
              const endDate = (endDatePart && !endDateIsPresent) ? endDatePart : 'Present';

              const descriptionElement = node.querySelector('[data-field="description"]') ||
                                        node.querySelector('.pv-entity__description');
              const description = descriptionElement?.textContent?.trim() || null;

              if (title || company) { // Only add if we have at least title or company
                data.push({
                  title,
                  company,
                  employmentType,
                  location,
                  startDate,
                  endDate,
                  endDateIsPresent,
                  description
                });
              }
            } catch (e) {
              // Skip problematic nodes
              return;
            }
          });
        }

        return data;
      });

      const experiences: Experience[] = rawExperiencesData.map((rawExperience) => {
        const startDate = formatDate(rawExperience.startDate);
        const endDate = formatDate(rawExperience.endDate) || null;
        const endDateIsPresent = rawExperience.endDateIsPresent;

        const durationInDaysWithEndDate = (startDate && endDate && !endDateIsPresent) ? getDurationInDays(startDate, endDate) : null
        const durationInDaysForPresentDate = (endDateIsPresent && startDate) ? getDurationInDays(startDate, new Date()) : null
        const durationInDays = endDateIsPresent ? durationInDaysForPresentDate : durationInDaysWithEndDate;

        return {
          ...rawExperience,
          title: getCleanText(rawExperience.title),
          company: getCleanText(rawExperience.company),
          employmentType: getCleanText(rawExperience.employmentType),
          location: rawExperience?.location ? getLocationFromText(rawExperience.location) : null,
          startDate,
          endDate,
          endDateIsPresent,
          durationInDays,
          description: getCleanText(rawExperience.description)
        }
      })

      statusLog(logSection, `Got experiences data: ${JSON.stringify(experiences)}`, scraperSessionId)

      // Modern Education Data Extraction
      statusLog(logSection, `Parsing education data...`, scraperSessionId)

      const rawEducationData: RawEducation[] = await page.evaluate(() => {
        let data: RawEducation[] = []

        const educationSelectors = [
          'section[data-section="education"] ul li',
          '[data-section="education"] .pvs-list__item',
          '.education-section ul .pv-entity',
          'main section:nth-child(5) ul li' // Fallback
        ];

        let educationNodes: NodeListOf<Element> | null = null;
        
        for (const selector of educationSelectors) {
          educationNodes = document.querySelectorAll(selector);
          if (educationNodes.length > 0) break;
        }

        if (educationNodes && educationNodes.length > 0) {
          Array.from(educationNodes).forEach((node) => {
            try {
              const schoolNameElement = node.querySelector('.mr1.hoverable-link-text.t-bold') ||
                                      node.querySelector('h3.pv-entity__school-name') ||
                                      node.querySelector('[data-field="school_name"]');
              const schoolName = schoolNameElement?.textContent?.trim() || null;

              const degreeElement = node.querySelector('.t-14.t-normal') ||
                                  node.querySelector('.pv-entity__degree-name .pv-entity__comma-item');
              const degreeName = degreeElement?.textContent?.trim() || null;

              const fieldElement = node.querySelector('.t-14.t-normal span') ||
                                 node.querySelector('.pv-entity__fos .pv-entity__comma-item');
              const fieldOfStudy = fieldElement?.textContent?.trim() || null;

              const dateElements = node.querySelectorAll('time') ||
                                 node.querySelectorAll('.pv-entity__dates time');
              
              const startDate = dateElements[0]?.textContent?.trim() || null;
              const endDate = dateElements[1]?.textContent?.trim() || null;

              if (schoolName) { // Only add if we have at least school name
                data.push({
                  schoolName,
                  degreeName,
                  fieldOfStudy,
                  startDate,
                  endDate
                });
              }
            } catch (e) {
              return;
            }
          });
        }

        return data
      });

      const education: Education[] = rawEducationData.map(rawEducation => {
        const startDate = formatDate(rawEducation.startDate)
        const endDate = formatDate(rawEducation.endDate)

        return {
          ...rawEducation,
          schoolName: getCleanText(rawEducation.schoolName),
          degreeName: getCleanText(rawEducation.degreeName),
          fieldOfStudy: getCleanText(rawEducation.fieldOfStudy),
          startDate,
          endDate,
          durationInDays: getDurationInDays(startDate, endDate),
        }
      })

      statusLog(logSection, `Got education data: ${JSON.stringify(education)}`, scraperSessionId)

      // Modern Volunteer Experience
      statusLog(logSection, `Parsing volunteer experience data...`, scraperSessionId)

      const rawVolunteerExperiences: RawVolunteerExperience[] = await page.evaluate(() => {
        let data: RawVolunteerExperience[] = []

        const volunteerSelectors = [
          'section[data-section="volunteering"] ul li',
          '.volunteering-section ul li.ember-view'
        ];

        let volunteerNodes: NodeListOf<Element> | null = null;
        
        for (const selector of volunteerSelectors) {
          volunteerNodes = document.querySelectorAll(selector);
          if (volunteerNodes.length > 0) break;
        }

        if (volunteerNodes && volunteerNodes.length > 0) {
          Array.from(volunteerNodes).forEach((node) => {
            try {
              const titleElement = node.querySelector('.pv-entity__summary-info h3');
              const title = titleElement?.textContent?.trim() || null;
              
              const companyElement = node.querySelector('.pv-entity__summary-info span.pv-entity__secondary-title');
              const company = companyElement?.textContent?.trim() || null;

              const dateElement = node.querySelector('.pv-entity__date-range span:nth-child(2)');
              const dateText = dateElement?.textContent?.trim() || '';
              
              const startDatePart = dateText?.split('–')[0]?.trim() || null;
              const startDate = startDatePart || null;

              const endDatePart = dateText?.split('–')[1]?.trim() || null;
              const endDateIsPresent = endDatePart?.toLowerCase() === 'present' || false;
              const endDate = (endDatePart && !endDateIsPresent) ? endDatePart : 'Present';

              const descriptionElement = node.querySelector('.pv-entity__description')
              const description = descriptionElement?.textContent?.trim() || null;

              if (title) {
                data.push({
                  title,
                  company,
                  startDate,
                  endDate,
                  endDateIsPresent,
                  description
                });
              }
            } catch (e) {
              return;
            }
          });
        }

        return data
      });

      const volunteerExperiences: VolunteerExperience[] = rawVolunteerExperiences.map(rawVolunteerExperience => {
        const startDate = formatDate(rawVolunteerExperience.startDate)
        const endDate = formatDate(rawVolunteerExperience.endDate)

        return {
          ...rawVolunteerExperience,
          title: getCleanText(rawVolunteerExperience.title),
          company: getCleanText(rawVolunteerExperience.company),
          description: getCleanText(rawVolunteerExperience.description),
          startDate,
          endDate,
          durationInDays: getDurationInDays(startDate, endDate),
        }
      })

      statusLog(logSection, `Got volunteer experience data: ${JSON.stringify(volunteerExperiences)}`, scraperSessionId)

      // Modern Skills Data Extraction
      statusLog(logSection, `Parsing skills data...`, scraperSessionId)

      const skills: Skill[] = await page.evaluate(() => {
        const skillSelectors = [
          'section[data-section="skills"] ul li',
          '.pv-skill-categories-section ol > .ember-view',
          '[data-section="skills"] .pvs-list__item'
        ];

        let skillNodes: NodeListOf<Element> | null = null;
        
        for (const selector of skillSelectors) {
          skillNodes = document.querySelectorAll(selector);
          if (skillNodes.length > 0) break;
        }

        if (!skillNodes) return [];

        return Array.from(skillNodes).map((node) => {
          try {
            const skillNameElement = node.querySelector('.mr1.hoverable-link-text.t-bold') ||
                                   node.querySelector('.pv-skill-category-entity__name-text') ||
                                   node.querySelector('[data-field="skill_name"]');
            const skillName = skillNameElement?.textContent?.trim() || null;

            const endorsementElement = node.querySelector('.t-14.t-black--light.t-normal') ||
                                     node.querySelector('.pv-skill-category-entity__endorsement-count');
            const endorsementText = endorsementElement?.textContent?.trim() || '0';
            const endorsementCount = parseInt(endorsementText.replace(/\D/g, '')) || 0;

            return {
              skillName,
              endorsementCount
            } as Skill;
          } catch (e) {
            return {
              skillName: null,
              endorsementCount: 0
            } as Skill;
          }
        }).filter(skill => skill.skillName) as Skill[];
      });

      statusLog(logSection, `Got skills data: ${JSON.stringify(skills)}`, scraperSessionId)

      statusLog(logSection, `Done! Returned profile details for: ${profileUrl}`, scraperSessionId)

      if (!this.options.keepAlive) {
        statusLog(logSection, 'Not keeping the session alive.')
        await this.close(page)
        statusLog(logSection, 'Done. Puppeteer is closed.')
      } else {
        statusLog(logSection, 'Done. Puppeteer is being kept alive in memory.')
        await page.close()
      }

      return {
        userProfile,
        experiences,
        education,
        volunteerExperiences,
        skills
      }
    } catch (err) {
      await this.close()
      statusLog(logSection, 'An error occurred during a run.')
      throw err;
    }
  }
}
