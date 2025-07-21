import { Page } from 'puppeteer';
export interface Location {
    city: string | null;
    province: string | null;
    country: string | null;
}
export declare const getIsCountry: (text: string) => boolean;
export declare const getIsCity: (text: string) => boolean;
export declare const formatDate: (date: string | Date | null) => string | null;
export declare const getDurationInDays: (formattedStartDate: string | Date | null, formattedEndDate: string | Date | null) => number | null;
export declare const getLocationFromText: (text: string) => Location | null;
export declare const getCleanText: (text: string | null) => string | null;
export declare const statusLog: (section: string, message: string, scraperSessionId?: string | number) => void;
export declare const autoScroll: (page: Page) => Promise<void>;
export declare const getHostname: (url: string) => string | null;
