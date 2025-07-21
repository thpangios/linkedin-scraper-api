// Fixed: Use namespace import for better compatibility
import * as moment from 'moment-timezone';
import { Location } from './index';
import { Page } from 'puppeteer';
import countries from 'i18n-iso-countries';
import cities from 'all-the-cities';

export const getIsCountry = (text: string): boolean => {
  const countriesList = Object.values(countries.getNames('en'));
  const lowerCaseText = text.toLowerCase();

  // Some custom text that we assume is also a country (lower cased)
  // But is not detected correctly by the iso-countries module
  if (['united states', 'the netherlands'].includes(lowerCaseText)) {
    return true;
  }

  return !!countriesList.find(country => country.toLowerCase() === lowerCaseText);
};

export const getIsCity = (text: string): boolean => {
  const lowerCaseText = text.toLowerCase();

  if (['new york'].includes(lowerCaseText)) {
    return true;
  }

  return !!cities.find(city => city.name.toLowerCase() === lowerCaseText);
};

// Fixed: Use moment.MomentInput instead of redundant union
export const formatDate = (date: moment.MomentInput): string => {
  if (date === 'Present') {
    return moment().format();
  }

  return moment(date, 'MMMY').format();
};

// Fixed: Use consistent moment.MomentInput types
export const getDurationInDays = (formattedStartDate: moment.MomentInput, formattedEndDate: moment.MomentInput): number | null => {
  if (!formattedStartDate || !formattedEndDate) return null;
  // +1 to include the start date
  return moment(formattedEndDate).diff(moment(formattedStartDate), 'days') + 1;
};

export const getLocationFromText = (text: string): Location | null => {
  // Text is something like: Amsterdam Oud-West, North Holland Province, Netherlands

  if (!text) return null;

  const cleanText = text.replace(' Area', '').trim();
  const parts = cleanText.split(', ');

  let city: string | null = null;
  let province: string | null = null;
  let country: string | null = null;

  // If there are 3 parts, we can be sure of the order of each part
  // So that must be a: city, province/state and country
  if (parts.length === 3) {
    city = parts[0];
    province = parts[1];
    country = parts[2];

    return {
      city,
      province,
      country
    };
  }

  // If we only have 2 parts, we don't know exactly what each part is;
  // it could still be: city, province/state or a country
  // For example: Sacramento, California Area
  if (parts.length === 2) {
    // 2 possible scenario's are most likely. We strictly check for the following:
    // first: city + country
    // second: city + province/state

    if (getIsCity(parts[0]) && getIsCountry(parts[1])) {
      return {
        city: parts[0],
        province: null, // Fixed: explicit null instead of undefined variable
        country: parts[1]
      };
    }

    // If the second part is NOT a country, it's probably a province/state
    if (getIsCity(parts[0]) && !getIsCountry(parts[1])) {
      return {
        city: parts[0],
        province: parts[1],
        country: null // Fixed: explicit null instead of undefined variable
      };
    }

    return {
      city: null, // Fixed: explicit null instead of undefined variable
      province: parts[0],
      country: parts[1]
    };
  }

  // If we only have one part we'll end up here

  // Just find out if it's one of: city, province/state or country
  if (getIsCountry(parts[0])) {
    return {
      city: null, // Fixed: explicit null
      province: null, // Fixed: explicit null
      country: parts[0]
    };
  } 
  
  if (getIsCity(parts[0])) {
    return {
      city: parts[0],
      province: null, // Fixed: explicit null
      country: null // Fixed: explicit null
    };
  }

  // Else, it must be a province/state. We just don't know and assume it is.
  return {
    city: null, // Fixed: explicit null
    province: parts[0],
    country: null // Fixed: explicit null
  };
};

export const getCleanText = (text: string | null): string | null => {
  const regexRemoveMultipleSpaces = / +/g;
  const regexRemoveLineBreaks = /(\r\n\t|\n|\r\t)/gm;

  if (!text) return null;

  const cleanText = text
    .replace(regexRemoveLineBreaks, '')
    .replace(regexRemoveMultipleSpaces, ' ')
    .replace('...', '')
    .replace('See more', '')
    .replace('See less', '')
    .trim();

  return cleanText;
};

export const statusLog = (section: string, message: string, scraperSessionId?: string | number): void => {
  const sessionPart = (scraperSessionId) ? ` (${scraperSessionId})` : '';
  const messagePart = (message) ? `: ${message}` : '';
  console.log(`Scraper (${section})${sessionPart}${messagePart}`);
};

// Fixed: Promise typing and resolve without argument issues
export const autoScroll = async (page: Page): Promise<void> => {
  await page.evaluate(async (): Promise<void> => {
    await new Promise<void>((resolve): void => {
      let totalHeight = 0;
      const distance = 500;
      const timer = setInterval((): void => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve(); // Fixed: resolve() now properly matches Promise<void>
        }
      }, 100);
    });
  });
};

// Fixed: Add error handling for malformed URLs
export const getHostname = (url: string): string | null => {
  try {
    return new URL(url).hostname;
  } catch (error) {
    // Return null for malformed URLs instead of throwing
    return null;
  }
};
