"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHostname = exports.autoScroll = exports.statusLog = exports.getCleanText = exports.getLocationFromText = exports.getDurationInDays = exports.formatDate = exports.getIsCity = exports.getIsCountry = void 0;
const tslib_1 = require("tslib");
const moment_timezone_1 = tslib_1.__importDefault(require("moment-timezone"));
const i18n_iso_countries_1 = tslib_1.__importDefault(require("i18n-iso-countries"));
const all_the_cities_1 = tslib_1.__importDefault(require("all-the-cities"));
const getIsCountry = (text) => {
    const countriesList = Object.values(i18n_iso_countries_1.default.getNames('en'));
    const lowerCaseText = text.toLowerCase();
    if (['united states', 'the netherlands'].includes(lowerCaseText)) {
        return true;
    }
    return !!countriesList.find(country => country.toLowerCase() === lowerCaseText);
};
exports.getIsCountry = getIsCountry;
const getIsCity = (text) => {
    const lowerCaseText = text.toLowerCase();
    if (['new york'].includes(lowerCaseText)) {
        return true;
    }
    return !!all_the_cities_1.default.find((city) => city.name.toLowerCase() === lowerCaseText);
};
exports.getIsCity = getIsCity;
const formatDate = (date) => {
    if (!date)
        return null;
    if (date === 'Present') {
        return (0, moment_timezone_1.default)().format();
    }
    return (0, moment_timezone_1.default)(date, 'MMMY').format();
};
exports.formatDate = formatDate;
const getDurationInDays = (formattedStartDate, formattedEndDate) => {
    if (!formattedStartDate || !formattedEndDate)
        return null;
    return (0, moment_timezone_1.default)(formattedEndDate).diff((0, moment_timezone_1.default)(formattedStartDate), 'days') + 1;
};
exports.getDurationInDays = getDurationInDays;
const getLocationFromText = (text) => {
    if (!text)
        return null;
    const cleanText = text.replace(' Area', '').trim();
    const parts = cleanText.split(', ');
    let city = null;
    let province = null;
    let country = null;
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
    if (parts.length === 2) {
        if ((0, exports.getIsCity)(parts[0]) && (0, exports.getIsCountry)(parts[1])) {
            return {
                city: parts[0],
                province: null,
                country: parts[1]
            };
        }
        if ((0, exports.getIsCity)(parts[0]) && !(0, exports.getIsCountry)(parts[1])) {
            return {
                city: parts[0],
                province: parts[1],
                country: null
            };
        }
        return {
            city: null,
            province: parts[0],
            country: parts[1]
        };
    }
    if ((0, exports.getIsCountry)(parts[0])) {
        return {
            city: null,
            province: null,
            country: parts[0]
        };
    }
    if ((0, exports.getIsCity)(parts[0])) {
        return {
            city: parts[0],
            province: null,
            country: null
        };
    }
    return {
        city: null,
        province: parts[0],
        country: null
    };
};
exports.getLocationFromText = getLocationFromText;
const getCleanText = (text) => {
    const regexRemoveMultipleSpaces = / +/g;
    const regexRemoveLineBreaks = /(\r\n\t|\n|\r\t)/gm;
    if (!text)
        return null;
    const cleanText = text
        .replace(regexRemoveLineBreaks, '')
        .replace(regexRemoveMultipleSpaces, ' ')
        .replace('...', '')
        .replace('See more', '')
        .replace('See less', '')
        .trim();
    return cleanText;
};
exports.getCleanText = getCleanText;
const statusLog = (section, message, scraperSessionId) => {
    const sessionPart = (scraperSessionId) ? ` (${scraperSessionId})` : '';
    const messagePart = (message) ? `: ${message}` : '';
    console.log(`Scraper (${section})${sessionPart}${messagePart}`);
};
exports.statusLog = statusLog;
const autoScroll = async (page) => {
    await page.evaluate(async () => {
        await new Promise((resolve) => {
            let totalHeight = 0;
            const distance = 500;
            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;
                if (totalHeight >= scrollHeight) {
                    clearInterval(timer);
                    resolve();
                }
            }, 100);
        });
    });
};
exports.autoScroll = autoScroll;
const getHostname = (url) => {
    try {
        return new URL(url).hostname;
    }
    catch (error) {
        return null;
    }
};
exports.getHostname = getHostname;
//# sourceMappingURL=index.js.map